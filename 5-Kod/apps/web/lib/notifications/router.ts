// Kanalroutern (plan 014): väljer billigaste opt-in-kanal för ETT utskick.
// Ren funktion — DB-läsningarna (prefs/subs) görs av anroparen så reglerna kan
// enhetstestas utan klient. Regelordning: push (0 kr) → e-post (0 kr) → SMS (kostar).
//
//   · transactional: får ALLTID gå ut (bekräftelser/kvitton är avtalsleverans,
//     speglar settings.ts:38-45). Kanal-opt-out styr VILKEN kanal, aldrig OM.
//   · marketing: kräver marketing_consent + typ-opt-in — annars allowed=false.
//   · App-kund (prefs-rad finns): SMS väljs ALDRIG automatiskt — sms_enabled
//     defaultar false i 0091 och sätts bara av kundens eget val.
//   · Gäst (ingen prefs-rad): dagens beteende — e-post först, SMS-fallback när
//     e-post saknas och verksamheten har SMS på (tenantSmsEnabled).

export type NotificationCategory = 'transactional' | 'marketing'
export type NotificationChannel = 'push' | 'email' | 'sms'

/** Speglar customer_notification_prefs-raden (0091). null ⇒ gäst utan konto. */
export type CustomerPrefs = {
  push_enabled: boolean
  email_enabled: boolean
  sms_enabled: boolean
  preferred_channel: NotificationChannel | null
  marketing_consent: boolean
  want_reminders: boolean
  want_offers: boolean
  want_open_slots: boolean
  want_recommendations: boolean
}

export type ChannelDecision = {
  allowed: boolean
  channel: NotificationChannel | null
  fallback: NotificationChannel | null
  skipReason?: string
  /** Ögonblicksbild till outbox.consent_state — inga PII, bara flaggor. */
  consentState: Record<string, unknown>
}

/** Typ-opt-in för marknadsföring (transaktionellt har ingen typ-grind). */
const MARKETING_OPT_IN: Record<string, keyof CustomerPrefs> = {
  offer: 'want_offers',
  open_slot: 'want_open_slots',
  recommendation: 'want_recommendations',
}

export function resolveChannel(input: {
  category: NotificationCategory
  /** t.ex. 'booking_confirmation', 'offer', 'open_slot' */
  type: string
  prefs: CustomerPrefs | null
  hasPushSubscription: boolean
  hasEmail: boolean
  hasPhone: boolean
  /** Verksamhetens SMS-toggle (tenant_settings.sms_enabled) — gäst-fallbacken. */
  tenantSmsEnabled: boolean
}): ChannelDecision {
  const { category, type, prefs, hasPushSubscription, hasEmail, hasPhone, tenantSmsEnabled } = input
  const consentState: Record<string, unknown> = {
    category,
    type,
    has_prefs: prefs !== null,
    push_enabled: prefs?.push_enabled ?? false,
    email_enabled: prefs?.email_enabled ?? true,
    sms_enabled: prefs?.sms_enabled ?? null,
    marketing_consent: prefs?.marketing_consent ?? false,
    tenant_sms_enabled: tenantSmsEnabled,
  }

  if (category === 'marketing') {
    if (!prefs?.marketing_consent) {
      return { allowed: false, channel: null, fallback: null, skipReason: 'no_consent', consentState }
    }
    const optInKey = MARKETING_OPT_IN[type]
    if (optInKey && prefs[optInKey] !== true) {
      return { allowed: false, channel: null, fallback: null, skipReason: 'type_opt_out', consentState }
    }
  }

  // Kanalkandidater i kostnadsordning. App-kund: kanalflaggor styr; SMS kräver
  // kundens EGET val (sms_enabled). Gäst: e-post → SMS via tenant-togglen.
  const candidates: NotificationChannel[] = []
  if (hasPushSubscription && (prefs?.push_enabled ?? false)) candidates.push('push')
  if (hasEmail && (prefs?.email_enabled ?? true)) candidates.push('email')
  if (hasPhone && (prefs ? prefs.sms_enabled : tenantSmsEnabled)) candidates.push('sms')

  if (candidates.length === 0) {
    // Transaktionellt måste kunna nå kunden: sista utväg är e-post om adress finns
    // (kanal-opt-out får inte tysta en bekräftelse helt — settings.ts-kontraktet).
    if (category === 'transactional' && hasEmail) {
      return { allowed: true, channel: 'email', fallback: null, consentState }
    }
    return { allowed: false, channel: null, fallback: null, skipReason: 'no_channel', consentState }
  }

  return {
    allowed: true,
    channel: candidates[0]!,
    fallback: candidates[1] ?? null,
    consentState,
  }
}
