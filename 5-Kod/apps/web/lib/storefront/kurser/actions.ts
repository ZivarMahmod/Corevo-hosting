'use server'

import { revalidateTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { currentRequestTenant } from '@/lib/tenant-data'
import { createServiceClient } from '@/lib/platform/service'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { sendEventConfirmationEmail } from '@/lib/notifications/events'
import { formatEventStart, type KursSubmitState } from '@/lib/storefront/kurser/types'

// Anonym kursanmälan följer intake-mönstret från
// lib/storefront/offert/intake.ts: tenant ur middleware-headern (aldrig
// klienten), rate-limit, server-side re-gate av modulen, servervalidering,
// EN insert. Anon RLS isolerar INTE tenant — .eq-filtren + server-resolvat
// tenant_id är den enda isoleringen.

export async function submitEventRegistration(
  _prev: KursSubmitState,
  formData: FormData,
): Promise<KursSubmitState> {
  // a. Tenant from the middleware header (never the client).
  const ctx = await currentRequestTenant()
  if (!ctx) return { phase: 'error', message: 'Okänd verksamhet.' }

  // b. Read + trim + validate the fields.
  const name = (formData.get('name') ?? '').toString().trim()
  const email = (formData.get('email') ?? '').toString().trim()
  const phone = (formData.get('phone') ?? '').toString().trim()
  const message = (formData.get('message') ?? '').toString().trim()
  const partySize = Number.parseInt((formData.get('party_size') ?? '').toString(), 10)
  const eventId = (formData.get('event_id') ?? '').toString().trim()
  const requestId = (formData.get('request_id') ?? '').toString().trim()

  if (!eventId) return { phase: 'error', message: 'Något gick fel. Ladda om sidan och försök igen.' }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return { phase: 'error', message: 'Ladda om sidan och försök igen.' }
  }
  if (!name || name.length > 120) {
    return { phase: 'error', message: 'Fyll i ditt namn (max 120 tecken).' }
  }
  if (!email || email.length > 160 || !email.includes('@') || !email.includes('.')) {
    return { phase: 'error', message: 'Kontrollera e-postadressen.' }
  }
  if (phone && phone.length > 40) {
    return { phase: 'error', message: 'Kontrollera telefonnumret (max 40 tecken).' }
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) {
    return { phase: 'error', message: 'Välj antal platser (1–8).' }
  }
  if (message.length > 2000) {
    return { phase: 'error', message: 'Meddelandet är för långt (max 2000 tecken).' }
  }

  // c. Ett exakt återförsök är redan klart och ska inte kunna fastna på en
  // senare rate-limit eller moduländring. Nyckeln är fortfarande bunden till
  // hela payloaden; samma nyckel med ändrade uppgifter nekas.
  const writer = createServiceClient()
  if (!writer) return { phase: 'error', message: 'Något gick fel. Försök igen.' }
  const { data: existing, error: existingError } = await writer
    .from('event_registrations')
    .select('event_id, name, email, phone, party_size, message')
    .eq('tenant_id', ctx.id)
    .eq('idempotency_key', requestId)
    .maybeSingle()
  if (existingError) return { phase: 'error', message: 'Något gick fel. Försök igen.' }
  if (existing) {
    if (
      existing.event_id !== eventId
      || existing.name !== name
      || existing.email !== email
      || (existing.phone ?? '') !== phone
      || existing.party_size !== partySize
      || (existing.message ?? '') !== message
    ) {
      return {
        phase: 'error',
        message: 'Anmälan matchar inte ditt tidigare försök. Ladda om sidan och försök igen.',
      }
    }
    return { phase: 'done' }
  }

  // d. Rate-limit the anon write per IP+tenant (same shape as offert/booking).
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('event', ctx.id, ip), LIMITS.event))) {
    return { phase: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  // e. Re-gate the live kurser module at the server boundary.
  const supabase = createPublicClient()
  const { data: moduleRow } = await supabase
    .from('tenant_modules')
    .select('state')
    .eq('tenant_id', ctx.id) // app-layer tenant isolation (anon RLS does NOT do this)
    .eq('module_key', 'kurser')
    .maybeSingle()
  // Ingen rad alls ⇒ modulen är av (0056 backfillar bara kunder som FAKTISKT har
  // kurser). Till skillnad från booking finns här ingen "ingen rad = live"-arv.
  if (!moduleRow || moduleRow.state !== 'live') {
    return { phase: 'error', message: 'Anmälan är inte öppen just nu.' }
  }

  // f. Läs eventet: rätt tenant, open, i framtiden. Anon FÅR läsa tenant_events.
  const { data: event } = await supabase
    .from('tenant_events')
    .select('id, title, starts_at, capacity, price_cents, status')
    .eq('tenant_id', ctx.id) // app-layer tenant isolation
    .eq('id', eventId)
    .maybeSingle()
  if (!event || event.status !== 'open' || new Date(event.starts_at).getTime() < Date.now()) {
    return { phase: 'error', message: 'Tillfället är inte öppet för anmälan längre.' }
  }

  // g. Atomisk kapacitetsvakt + insert genom en server-only RPC. Funktionen
  //    låser eventraden och räknar både bekräftade platser och checkout-holds,
  //    så två samtidiga anmälningar kan aldrig överboka eventet.
  const { data: registration, error } = await writer.rpc('create_onsite_event_registration', {
    p_tenant: ctx.id,
    p_event: event.id,
    p_name: name,
    p_email: email,
    p_phone: phone || '',
    p_party_size: partySize,
    p_message: message || '',
    p_idempotency_key: requestId,
  })
  if (error?.code === '23P01') {
    const left = Number.parseInt(error.details ?? '', 10)
    return {
      phase: 'error',
      message:
        !Number.isFinite(left) || left <= 0
          ? 'Tyvärr, tillfället är fullbokat.'
          : `Tyvärr, det finns bara ${left} ${left === 1 ? 'plats' : 'platser'} kvar.`,
    }
  }
  if (error) {
    return { phase: 'error', message: 'Något gick fel. Försök igen.' }
  }

  // h. Bekräftelsemejl — best-effort by contract, never blocks the anmälan.
  if (!(
    registration
    && typeof registration === 'object'
    && !Array.isArray(registration)
    && registration.already_registered === true
  )) {
    await sendEventConfirmationEmail({
      supabase: writer,
      tenantId: ctx.id,
      tenantName: ctx.name,
      to: email,
      name,
      eventTitle: event.title,
      startsAtText: formatEventStart(event.starts_at),
      partySize,
      priceCents: event.price_cents,
    })
  }

  // i. Bust the per-tenant storefront cache so "platser kvar" refreshes.
  revalidateTag(`tenant:${ctx.slug.trim().toLowerCase()}`)
  return { phase: 'done' }
}
