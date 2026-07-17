import 'server-only'

// PAYPAL — betal-räls #2 (goal-64). Zivar har VALT att ha med PayPal, men KONTOT
// finns inte än. Därför är integrationen byggd HELT klar och GATAD PÅ NYCKLARNA:
// saknas PAYPAL_CLIENT_ID/PAYPAL_SECRET är paypalReady() false → PayPal renderas
// aldrig som val i kassan, startPaypalCheckout degraderar, och webhooken svarar
// tyst 200. Den dag nycklarna läggs in tänds allt UTAN en rad ny kod.
// Ops-anvisning: 5-Kod/docs/ops/paypal.md
//
// Samma degrade-modell som getStripe() (lib/stripe/client.ts): ingen secret → null,
// aldrig en krasch i build/CI/lokalt.
//
// Workers-runtime: ren fetch, inget Node-SDK (PayPals officiella SDK drar in Node-
// http och skulle inte gå att köra på OpenNext/Workers).
//
// PENGAFLÖDET (medveten avvikelse mot Stripe): Stripe kör DIRECT charge på KUNDENS
// connected account — pengarna landar hos salongen. PayPal Connect/Partner-onboarding
// kräver ett godkänt partneravtal som inte finns; v1 tar därför emot betalningen på
// PLATTFORMENS PayPal-konto (Zivars). Det är dokumenterat i ops-filen och måste vara
// ett medvetet val innan PayPal slås på för en kund som inte är Zivar själv.

const LIVE = 'https://api-m.paypal.com'
const SANDBOX = 'https://api-m.sandbox.paypal.com'

type PaypalCreds = { clientId: string; secret: string; base: string }

/** Nycklarna ur miljön, eller null. ENDA stället som avgör om PayPal finns. */
function creds(): PaypalCreds | null {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_SECRET
  if (!clientId || !secret) return null
  // PAYPAL_ENV = 'live' → produktion. Allt annat (inkl. osatt) → sandbox. Fail-safe:
  // en glömd env-var betalar aldrig med riktiga pengar.
  const base = process.env.PAYPAL_ENV === 'live' ? LIVE : SANDBOX
  return { clientId, secret, base }
}

/** Är PayPal konfigurerat? Kassan frågar denna INNAN den renderar PayPal som val. */
export function paypalReady(): boolean {
  return creds() !== null
}

/** OAuth2 client-credentials-token. PayPal-token lever 8h; vi hämtar per anrop
 *  (Workers har ingen delad process-cache mellan isolat att lita på). */
async function accessToken(c: PaypalCreds): Promise<string | null> {
  const basic = btoa(`${c.clientId}:${c.secret}`)
  const res = await fetch(`${c.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null
  const json = (await res.json()) as { access_token?: string }
  return json.access_token ?? null
}

export type PaypalOrder = { id: string; approveUrl: string }

/**
 * Skapa en PayPal-order och returnera länken kunden ska skickas till (approve).
 *
 * `amountCents` kommer ALLTID från shop_orders.total_cents (server-side uppslaget) —
 * aldrig från klienten. `reference` = vår order-id, så capture/webhook kan hitta
 * tillbaka till rätt order utan att lita på någon query-param.
 */
export async function createPaypalOrder(args: {
  amountCents: number
  currency: string
  reference: string
  returnUrl: string
  cancelUrl: string
}): Promise<PaypalOrder | null> {
  const c = creds()
  if (!c) return null
  const token = await accessToken(c)
  if (!token) return null

  const res = await fetch(`${c.base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      // Idempotens redan vid SKAPANDET: samma order → samma PayPal-order, även om
      // kunden dubbelklickar "Slutför köp".
      'paypal-request-id': `order-${args.reference}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: args.reference,
          custom_id: args.reference, // följer med hela vägen till capture-webhooken
          amount: {
            currency_code: args.currency.toUpperCase(),
            value: (args.amountCents / 100).toFixed(2), // PayPal vill ha major units som sträng
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: 'PAY_NOW',
            return_url: args.returnUrl,
            cancel_url: args.cancelUrl,
          },
        },
      },
    }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    id?: string
    links?: { rel?: string; href?: string }[]
  }
  const approve = json.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href
  if (!json.id || !approve) return null
  return { id: json.id, approveUrl: approve }
}

export type PaypalCapture = {
  /** COMPLETED = pengarna är tagna. Allt annat → vi markerar ALDRIG ordern som betald. */
  status: string
  /** Vår shop_orders.id (custom_id) — sanningen om vilken order som betalades. */
  reference: string | null
  amountCents: number | null
  currency: string | null
  /** Capture-id:t krävs för en idempotent refund om vår order redan är terminal. */
  captureId: string | null
}

/**
 * Fånga (capture) en godkänd PayPal-order. IDEMPOTENT mot PayPal: en re-capture av en
 * redan fångad order svarar 422 ORDER_ALREADY_CAPTURED — vi läser då upp ordern i
 * stället för att fela, så en dubbel-leverans (retry, dubbelklick, webhook+return
 * samtidigt) ger exakt EN effekt.
 */
export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalCapture | null> {
  const c = creds()
  if (!c) return null
  const token = await accessToken(c)
  if (!token) return null

  const res = await fetch(`${c.base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'paypal-request-id': `capture-${paypalOrderId}`,
    },
  })

  if (res.ok) return readOrder(await res.json())

  // Redan fångad → hämta ordern och läs dess sanna status (idempotens, inte ett fel).
  if (res.status === 422) {
    const get = await fetch(`${c.base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (get.ok) return readOrder(await get.json())
  }
  return null
}

/** PayPals order-JSON → vår smala vy. Beloppet läses ur purchase_unit, inte ur klienten. */
function readOrder(raw: unknown): PaypalCapture {
  const o = raw as {
    status?: string
    purchase_units?: {
      reference_id?: string
      custom_id?: string
      amount?: { value?: string; currency_code?: string }
      payments?: { captures?: { id?: string; amount?: { value?: string; currency_code?: string } }[] }
    }[]
  }
  const pu = o.purchase_units?.[0]
  const capture = pu?.payments?.captures?.[0]
  const amt = capture?.amount ?? pu?.amount
  return {
    status: o.status ?? 'UNKNOWN',
    reference: pu?.custom_id ?? pu?.reference_id ?? null,
    amountCents: amt?.value ? Math.round(Number(amt.value) * 100) : null,
    currency: amt?.currency_code ?? null,
    captureId: capture?.id ?? null,
  }
}

/** Återbetala en PayPal-capture. `paypal-request-id` gör retries idempotenta. */
export async function refundPaypalCapture(captureId: string): Promise<boolean> {
  const c = creds()
  if (!c || !captureId) return false
  const token = await accessToken(c)
  if (!token) return false

  const res = await fetch(
    `${c.base}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'paypal-request-id': `refund-${captureId}`,
      },
      body: '{}',
    },
  )
  return res.ok
}

/**
 * Verifiera en webhook-signatur hos PayPal (motsvarar Stripes constructEventAsync).
 * PayPal har ingen HMAC vi kan räkna själva — signaturen valideras genom ett anrop
 * till deras verify-endpoint med webhook-id:t.
 *
 * Saknas PAYPAL_WEBHOOK_ID kan vi INTE bevisa avsändaren → returnera false. Ett
 * osignerat "betalt"-event får aldrig markera en order som betald.
 */
export async function verifyPaypalWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const c = creds()
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!c || !webhookId) return false
  const token = await accessToken(c)
  if (!token) return false

  const res = await fetch(`${c.base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  })
  if (!res.ok) return false
  const json = (await res.json()) as { verification_status?: string }
  return json.verification_status === 'SUCCESS'
}
