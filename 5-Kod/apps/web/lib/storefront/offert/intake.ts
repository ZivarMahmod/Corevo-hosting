'use server'

import { headers } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { parseOffertConfig, type OffertSubmitState } from './types'

// Anonymous offert INTAKE (multi-bransch spår 5). Turns the storefront offert form
// into a working guest submission that inserts ONE row into offert_requests, which
// the admin OffertInbox then triages. Runs as the anon role — the SAME fence as the
// public booking flow (app/boka/actions.ts):
//   • tenant identity comes from the middleware header `x-corevo-tenant-slug`, NEVER
//     from the client. The app layer sets tenant_id; anon RLS does NOT isolate it
//     (the public-insert policy is with_check TRUE), so the .eq filters + the
//     server-resolved id are the ONLY isolation.
//   • the variant (mode) is re-resolved SERVER-side from tenant_modules.config — a
//     client never dictates it.
//   • BETAL-RAILS PAUSADE (beslut 14.2): an offert is an underlag. payment_status is
//     never set/touched here; estimate_cents/note/customer_id stay admin-only/null.

/** Resolve the request's tenant from the middleware header (never the client). */
async function getTenantContext(): Promise<{ id: string; slug: string } | null> {
  const h = await headers()
  const slug = h.get('x-corevo-tenant-slug')
  if (!slug) return null
  const supabase = createPublicClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (!tenant) return null
  return { id: tenant.id, slug: tenant.slug }
}

/**
 * Submit an anonymous offert request. Resolves the tenant + variant server-side,
 * rate-limits the write, validates per variant, then inserts ONE offert_requests
 * row (DB defaults handle status/payment_status/currency/details/created_at).
 */
export async function submitOffertRequest(
  _prev: OffertSubmitState,
  formData: FormData,
): Promise<OffertSubmitState> {
  // a. Tenant from the middleware header (never the client).
  const ctx = await getTenantContext()
  if (!ctx) return { phase: 'error', message: 'Okänd salong.' }

  // b. Rate-limit the anon write per IP+tenant (same shape as booking; G10). Fails
  //    open on DB error.
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('offert', ctx.id, ip), LIMITS.offert))) {
    return { phase: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  // c. Re-gate SERVER-side: the offert module must be LIVE. draft/off/paused all
  //    reject — a stale page or a tampered request must not slip a row in while the
  //    storefront surface is closed. (Mirrors the loader's app-layer tenant filter.)
  const supabase = createPublicClient()
  const { data: moduleRow } = await supabase
    .from('tenant_modules')
    .select('state, config')
    .eq('tenant_id', ctx.id) // app-layer tenant isolation (anon RLS does NOT do this)
    .eq('module_key', 'offert')
    .maybeSingle()
  if (!moduleRow || moduleRow.state !== 'live') {
    return { phase: 'error', message: 'Formuläret är inte aktivt just nu.' }
  }

  // d. Authoritative variant from the resolved config (never a client value).
  const { mode } = parseOffertConfig(moduleRow.config)

  // e. Read + trim the fields. The variant decides which are required.
  const name = (formData.get('name') ?? '').toString().trim()
  const email = (formData.get('email') ?? '').toString().trim()
  const phone = (formData.get('phone') ?? '').toString().trim()
  const subject = (formData.get('subject') ?? '').toString().trim()
  const message = (formData.get('message') ?? '').toString().trim()

  if (!name || name.length > 120) {
    return { phase: 'error', message: 'Fyll i ditt namn (max 120 tecken).' }
  }
  if (!email && !phone) {
    return { phase: 'error', message: 'Lämna e-post eller telefon så vi kan nå dig.' }
  }
  if (email && (email.length > 160 || !email.includes('@') || !email.includes('.'))) {
    return { phase: 'error', message: 'Kontrollera e-postadressen.' }
  }
  if (phone && phone.length > 40) {
    return { phase: 'error', message: 'Kontrollera telefonnumret (max 40 tecken).' }
  }
  // estimate_form: a subject (what it concerns) is required alongside the scope.
  if (mode === 'estimate_form' && (!subject || subject.length > 200)) {
    return { phase: 'error', message: 'Fyll i vad det gäller (max 200 tecken).' }
  }
  // message: required for request_quote + estimate_form; optional for callback.
  if (mode !== 'callback' && !message) {
    return {
      phase: 'error',
      message: mode === 'estimate_form' ? 'Beskriv omfattningen.' : 'Beskriv ditt behov.',
    }
  }
  if (message.length > 4000) {
    return { phase: 'error', message: 'Meddelandet är för långt (max 4000 tecken).' }
  }

  // f. Insert exactly ONE row. ONLY these columns — DB defaults handle
  //    status/payment_status/currency/details/created_at; estimate_cents/note/
  //    customer_id stay untouched (admin-only / guest). tenant_id is the
  //    server-resolved id (the only isolation, since anon RLS is permissive).
  const { error } = await supabase.from('offert_requests').insert({
    tenant_id: ctx.id,
    mode,
    customer_name: name,
    customer_email: email || null,
    customer_phone: phone || null,
    subject: mode === 'estimate_form' ? subject || null : null,
    message: message || null,
  })
  if (error) {
    return { phase: 'error', message: 'Något gick fel. Försök igen.' }
  }

  // g. Bust the per-tenant storefront cache (tenant:<slug>) — same tag the loader
  //    + the rest of the storefront use.
  revalidateTag(`tenant:${ctx.slug.trim().toLowerCase()}`)
  return { phase: 'done' }
}
