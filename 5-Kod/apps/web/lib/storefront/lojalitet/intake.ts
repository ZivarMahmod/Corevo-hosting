'use server'

import { headers } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import type { JoinClubState } from './types'

// KLUBBENS INTAG (goal-64) — designens `joinClub()` blir sann.
//
// I de 12 .dc.html-mallarna gör "GÅ MED"-knappen ingenting: `joinClub: () =>
// this.setState({ clubJoined: true })` byter bara en ruta på skärmen. Här blir den en
// riktig medlem: e-post → en rad i loyalty_members, knuten till kundens EGET kundregister
// (public.customers, 0011) — samma entitet som bokningen skapar, så klubbmedlemmen och
// gästen som bokat är samma person.
//
// SÄKERHETSMÖNSTRET ÄR KOPIERAT UR lib/storefront/offert/intake.ts, punkt för punkt:
//   • tenanten kommer ur middleware-headern `x-corevo-tenant-slug` — ALDRIG från klienten.
//     (Anon-RLS isolerar inte tenants; den server-resolvade identiteten är enda fencen.)
//   • rate-limit per IP+tenant före skrivningen (LIMITS.loyalty).
//   • modulen re-gatas SERVER-side: lojalitet måste vara `live`. draft/off/paused nekar.
//   • sedan EN rad.
//
// SKILLNADEN mot offert-intaket, och varför: offerten skriver rakt in i offert_requests,
// som har en permissiv anon-insert-policy. Klubben kan inte det — raden pekar på
// public.customers, vars RLS är `for all to authenticated`: anon får varken läsa eller
// skapa en kund. Att ge anon en insert-policy på hela PII-kundregistret för att få in en
// e-postadress vore att riva ner huset för att öppna ett fönster. Vägen in är i stället
// public.join_loyalty_club() (migration 0057) — SECURITY DEFINER, granted to anon, exakt
// samma konstruktion som create_public_booking (0015) redan använder för gästbokningen.
// Funktionen resolverar tenanten ur slug:en, GATAR MODULEN EN GÅNG TILL (app-lagret är
// bypassbart — funktionen är det inte), återanvänder private.resolve_customer_id() (samma
// contact_hash-dedup som bokningen: en e-post som redan bokat blir ingen andra kundrad)
// och upsertar medlemsraden.
//
// INGEN BETALNING: prenumerationsnivåerna (Källas Droppe/Källa/Flod) VISAR sitt pris, men
// ingenting dras här. Nivån sparas som avsikt (loyalty_members.plan_id) och kundens
// "starta"-CTA går via offert-förfrågan tills betal-rälsen för abonnemang finns. En knapp
// som låtsas ta betalt är värre än ingen knapp.

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
 * Gå med i klubben (anonymt gästintag). Resolverar tenanten + modulens läge server-side,
 * rate-limitar skrivningen, validerar e-posten och skapar/uppdaterar EN medlemsrad.
 *
 * IDEMPOTENT: samma e-post två gånger → samma rad (unique (tenant_id, customer_id) +
 * ON CONFLICT DO UPDATE i funktionen). Kunden som dubbelklickar får "Välkommen", inte ett
 * fel — och kundregistret får ingen dubblett.
 */
export async function joinLoyaltyClub(
  _prev: JoinClubState,
  formData: FormData,
): Promise<JoinClubState> {
  // a. Tenant ur middleware-headern (aldrig klienten).
  const ctx = await getTenantContext()
  if (!ctx) return { phase: 'error', message: 'Okänt företag.' }

  // b. Rate-limit per IP+tenant (samma form som offert/bokning). Fails open vid DB-fel.
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('loyalty', ctx.id, ip), LIMITS.loyalty))) {
    return { phase: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  // c. Re-gate SERVER-side: lojalitet måste vara LIVE. En pausad/avstängd klubb tar inte
  //    emot medlemmar, hur gammal eller tampererad sidan i webbläsaren än är. (RPC:n gatar
  //    en gång till — det här är bara det snälla felmeddelandet.)
  const supabase = createPublicClient()
  const { data: moduleRow } = await supabase
    .from('tenant_modules')
    .select('state')
    .eq('tenant_id', ctx.id) // app-layer tenant isolation (anon RLS does NOT do this)
    .eq('module_key', 'lojalitet')
    .maybeSingle()
  if (!moduleRow || moduleRow.state !== 'live') {
    return { phase: 'error', message: 'Klubben är inte öppen just nu.' }
  }

  // d. Fälten. E-posten är det enda som KRÄVS — den är medlemskapets nyckel (dedup:en i
  //    resolve_customer_id hashar den). Namn och nivå är valfria.
  const email = (formData.get('email') ?? '').toString().trim()
  const name = (formData.get('name') ?? '').toString().trim()
  const planId = (formData.get('planId') ?? '').toString().trim()

  if (!email || email.length > 160 || !email.includes('@') || !email.includes('.')) {
    return { phase: 'error', message: 'Kontrollera e-postadressen.' }
  }
  if (name.length > 120) {
    return { phase: 'error', message: 'Namnet är för långt (max 120 tecken).' }
  }

  // e. EN rad, via definer-funktionen. p_plan valideras DÄR mot kundens egna aktiva nivåer
  //    — en tampererad plan_id från en annan tenant kan aldrig fastna på raden.
  const { error } = await supabase.rpc('join_loyalty_club', {
    p_tenant_slug: ctx.slug,
    p_email: email,
    ...(name ? { p_name: name } : {}),
    ...(planId ? { p_plan: planId } : {}),
  })
  if (error) {
    // module_not_live = klubben stängdes mellan gate och skrivning. Alla andra fel är våra.
    return {
      phase: 'error',
      message: error.message.includes('module_not_live')
        ? 'Klubben är inte öppen just nu.'
        : 'Något gick fel. Försök igen.',
    }
  }

  // f. Buste per-tenant-cachen (samma tag som loadern + resten av storefronten).
  revalidateTag(`tenant:${ctx.slug.trim().toLowerCase()}`)
  return { phase: 'done' }
}
