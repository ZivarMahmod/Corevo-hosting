// Supabase Edge Function: Web Push-sändning (plan 015). Speglar send-email:
// Workern kan inte VAPID-signera bekvämt, så appen POST:ar hit och Deno-runtimen
// skickar via web-push (npm). Degraderar med 503 när VAPID-secrets saknas —
// appens push.ts tolkar det som "kanal otillgänglig" och routern faller vidare.
//
// Auth: delad hemlighet (`x-relay-secret` = EMAIL_RELAY_SECRET) — EXAKT samma
// mönster som send-email, fail CLOSED: osatt secret avvisar allt. Funktionen
// deployas med verify_jwt=false; hemligheten är enda grinden.
// Döda endpoints (404/410 från push-tjänsten) revocas i push_subscriptions.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Payload = {
  customer_id?: unknown
  title?: unknown
  body?: unknown
  url?: unknown
}

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' })

  // Delad hemlighet — fail CLOSED (osatt secret ⇒ 401 för alla, aldrig öppen).
  const expected = Deno.env.get('EMAIL_RELAY_SECRET')
  const provided = req.headers.get('x-relay-secret')
  if (!expected || provided !== expected) {
    return json(401, { ok: false, error: 'unauthorized' })
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:booking@corevo.se'
  if (!vapidPublic || !vapidPrivate) {
    // Ej konfigurerad — tyst degrade (aldrig ett falskt "skickat").
    return json(503, { ok: false, error: 'vapid_not_configured' })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }
  const customerId = typeof payload.customer_id === 'string' ? payload.customer_id : ''
  const title = typeof payload.title === 'string' ? payload.title : ''
  const body = typeof payload.body === 'string' ? payload.body : ''
  const url = typeof payload.url === 'string' && payload.url ? payload.url : '/konto'
  if (!customerId || !title) return json(400, { ok: false, error: 'missing_fields' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('customer_id', customerId)
    .is('revoked_at', null)
  if (error) return json(500, { ok: false, error: 'subscription_read_failed' })
  if (!subs || subs.length === 0) return json(200, { ok: true, sent: 0 })

  let sent = 0
  const dead: string[] = []
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url }),
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      // 404/410 = endpointen är död (avinstallerad/återkallad) → revoca raden.
      if (status === 404 || status === 410) dead.push(sub.id)
    }
  }
  if (dead.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ revoked_at: new Date().toISOString() })
      .in('id', dead)
  }

  return json(200, { ok: true, sent, revoked: dead.length })
})
