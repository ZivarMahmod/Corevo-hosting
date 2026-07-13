'use server'

import { headers } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { createServiceClient, hasServiceRole } from '@/lib/platform/service'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { sendEventConfirmationEmail } from '@/lib/notifications/events'
import { logger } from '@/lib/observability'
import { formatEventStart, type KursSubmitState } from '@/lib/storefront/kurser/types'

// Anonym kurs-ANMÄLAN (goal-54 körning 4). EXAKT intake-mönstret från
// lib/storefront/offert/intake.ts: tenant ur middleware-headern (aldrig
// klienten), rate-limit, server-side re-gate av modulen, servervalidering,
// EN insert. Anon RLS isolerar INTE tenant — .eq-filtren + server-resolvat
// tenant_id är den enda isoleringen.

/** Resolve the request's tenant from the middleware header (never the client). */
async function getTenantContext(): Promise<{ id: string; slug: string; name: string } | null> {
  const h = await headers()
  const slug = h.get('x-corevo-tenant-slug')
  if (!slug) return null
  const supabase = createPublicClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (!tenant) return null
  return { id: tenant.id, slug: tenant.slug, name: tenant.name }
}

export async function submitEventRegistration(
  _prev: KursSubmitState,
  formData: FormData,
): Promise<KursSubmitState> {
  // a. Tenant from the middleware header (never the client).
  const ctx = await getTenantContext()
  if (!ctx) return { phase: 'error', message: 'Okänd verksamhet.' }

  // b. Rate-limit the anon write per IP+tenant (same shape as offert/booking).
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('event', ctx.id, ip), LIMITS.event))) {
    return { phase: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  // c. Re-gate SERVER-side: bara LIVE tar emot anmälningar (paused visar listan
  //    läsbar, draft/off är inte publik alls).
  //
  //    BUGG (goal-64): den här gaten läste `booking`, medan sidan och adminytan gatar
  //    på `kurser` — modulen fick sin egen nyckel i migration 0056. En kund med
  //    kurser=live men booking=off såg alltså kurslistan men kunde inte anmäla sig:
  //    formuläret svarade "Anmälan är inte öppen just nu" utan att något var stängt.
  //    En florist som säljer kurser men inte tidsbokning träffades av det direkt.
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

  // d. Read + trim + validate the fields.
  const name = (formData.get('name') ?? '').toString().trim()
  const email = (formData.get('email') ?? '').toString().trim()
  const phone = (formData.get('phone') ?? '').toString().trim()
  const message = (formData.get('message') ?? '').toString().trim()
  const partySize = Number.parseInt((formData.get('party_size') ?? '').toString(), 10)
  const eventId = (formData.get('event_id') ?? '').toString().trim()

  if (!eventId) return { phase: 'error', message: 'Något gick fel. Ladda om sidan och försök igen.' }
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

  // e. Läs eventet: rätt tenant, open, i framtiden. Anon FÅR läsa tenant_events.
  const { data: event } = await supabase
    .from('tenant_events')
    .select('id, title, starts_at, capacity, price_cents, status')
    .eq('tenant_id', ctx.id) // app-layer tenant isolation
    .eq('id', eventId)
    .maybeSingle()
  if (!event || event.status !== 'open' || new Date(event.starts_at).getTime() < Date.now()) {
    return { phase: 'error', message: 'Tillfället är inte öppet för anmälan längre.' }
  }

  // f. KAPACITETSVAKT: sum confirmed party_size via the SERVICE client (anon may
  //    not read event_registrations — same choice as loadUpcomingEvents). When
  //    the service key is missing (local dev) we let the insert through with a
  //    structured warn instead of blocking legitimate anmälningar.
  //    ponytail-ceiling: check-then-insert is not transactional — two samtidiga
  //    anmälningar kan tillsammans överboka med några platser. Acceptabelt för
  //    kurs-skala; en DB-side vakt (RPC/constraint) är nästa steg om det bränns.
  if (hasServiceRole()) {
    const svc = createServiceClient()
    if (svc) {
      const { data: regs } = await svc
        .from('event_registrations')
        .select('party_size')
        .eq('tenant_id', ctx.id)
        .eq('event_id', event.id)
        .eq('status', 'confirmed')
      const taken = (regs ?? []).reduce((sum, r) => sum + r.party_size, 0)
      const left = event.capacity - taken
      if (partySize > left) {
        return {
          phase: 'error',
          message:
            left <= 0
              ? 'Tyvärr, tillfället är fullbokat.'
              : `Tyvärr, det finns bara ${left} ${left === 1 ? 'plats' : 'platser'} kvar.`,
        }
      }
    }
  } else {
    logger.warn('event.registration.capacity_guard_skipped', { tenantId: ctx.id, eventId: event.id })
  }

  // g. Insert exactly ONE row (DB defaults handle status/created_at). tenant_id
  //    is the server-resolved id (the only isolation; anon RLS is insert-only).
  const { error } = await supabase.from('event_registrations').insert({
    tenant_id: ctx.id,
    event_id: event.id,
    name,
    email,
    phone: phone || null,
    party_size: partySize,
    message: message || null,
  })
  if (error) {
    return { phase: 'error', message: 'Något gick fel. Försök igen.' }
  }

  // h. Bekräftelsemejl — best-effort by contract, never blocks the anmälan.
  await sendEventConfirmationEmail({
    supabase,
    tenantId: ctx.id,
    tenantName: ctx.name,
    to: email,
    name,
    eventTitle: event.title,
    startsAtText: formatEventStart(event.starts_at),
    partySize,
    priceCents: event.price_cents,
  })

  // i. Bust the per-tenant storefront cache so "platser kvar" refreshes.
  revalidateTag(`tenant:${ctx.slug.trim().toLowerCase()}`)
  return { phase: 'done' }
}
