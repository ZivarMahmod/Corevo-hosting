'use server'

import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { sendContactMessageEmail } from '@/lib/notifications/kontakt'
import {
  CONTACT_HONEYPOT,
  CONTACT_MAX,
  type ContactSubmitState,
} from './types'

// Anonym KONTAKT-INTAKE (goal-64). Alla 12 Claude Design-mallar ritar ett kontakt-
// formulär; motorn hade ingen endpoint, så agenterna amputerade det ("en submit som
// inte skickar något är värre än inget formulär"). Det här är rälsen. Kör som anon —
// EXAKT samma fence som offert-intaken (lib/storefront/offert/intake.ts):
//   • tenant kommer ur middleware-headern `x-corevo-tenant-slug`, ALDRIG från klienten.
//     App-lagret sätter tenant_id; anon-RLS isolerar INTE (public-insert-policyn i 0057
//     är `with check (true)`), så det server-resolvade id:t är den ENDA isoleringen.
//   • rate-limit på varje anonym skrivning.
//   • honeypot mot bottar.
//
// SKILLNAD mot offert: INGEN modul-gate. /kontakt är ingen modul — sidan finns alltid
// i varje mall och kan inte stängas av. Det finns alltså inget `state !== 'live'` att
// spärra mot; en gate här skulle stänga en dörr som designen säger ska stå öppen.

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
  return { id: tenant.id, slug: tenant.slug, name: tenant.name ?? '' }
}

/**
 * Skicka ett anonymt kontaktmeddelande. Resolvar tenant server-side, rate-limitar,
 * validerar, skriver EN rad i contact_messages och mejlar den till kunden.
 *
 * Fältuppsättningen VARIERAR per mall (filen är lag): Aurora ber om namn/telefon/
 * meddelande, Calytrix om namn/e-post/meddelande, Eloria lägger till "Tillfälle & datum"
 * (→ subject). Därför är bara `name` + `message` hårt obligatoriska här, och minst EN
 * kanal (e-post ELLER telefon) måste finnas — annars kan kunden inte svara.
 */
export async function submitContactMessage(
  _prev: ContactSubmitState,
  formData: FormData,
): Promise<ContactSubmitState> {
  // a. Honeypot FÖRST — före tenant-slagningen och före rate-limit-bucketen, så en
  //    bot varken kostar oss en DB-runda eller äter upp en riktig besökares kvot.
  //    Tyst "done": boten ska tro att den lyckades och gå vidare. Ett felmeddelande
  //    hade bara lärt den vad den skulle undvika nästa gång.
  if ((formData.get(CONTACT_HONEYPOT) ?? '').toString().trim() !== '') {
    return { phase: 'done' }
  }

  // b. Tenant ur middleware-headern (aldrig klienten).
  const ctx = await getTenantContext()
  if (!ctx) return { phase: 'error', message: 'Okänt företag.' }

  // c. Rate-limit den anonyma skrivningen per IP+tenant. Fails open vid DB-fel.
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('kontakt', ctx.id, ip), LIMITS.kontakt))) {
    return { phase: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  // d. Läs + trimma fälten.
  const name = (formData.get('name') ?? '').toString().trim()
  const email = (formData.get('email') ?? '').toString().trim()
  const phone = (formData.get('phone') ?? '').toString().trim()
  const subject = (formData.get('subject') ?? '').toString().trim()
  const message = (formData.get('message') ?? '').toString().trim()

  if (!name || name.length > CONTACT_MAX.name) {
    return { phase: 'error', message: `Fyll i ditt namn (max ${CONTACT_MAX.name} tecken).` }
  }
  // Minst en väg tillbaka. Utan kanal är meddelandet en återvändsgränd — kunden ser
  // det i inkorgen men kan aldrig svara.
  if (!email && !phone) {
    return { phase: 'error', message: 'Lämna e-post eller telefon så vi kan nå dig.' }
  }
  if (email && (email.length > CONTACT_MAX.email || !email.includes('@') || !email.includes('.'))) {
    return { phase: 'error', message: 'Kontrollera e-postadressen.' }
  }
  if (phone && phone.length > CONTACT_MAX.phone) {
    return { phase: 'error', message: `Kontrollera telefonnumret (max ${CONTACT_MAX.phone} tecken).` }
  }
  if (subject.length > CONTACT_MAX.subject) {
    return { phase: 'error', message: `Ämnet är för långt (max ${CONTACT_MAX.subject} tecken).` }
  }
  if (!message) {
    return { phase: 'error', message: 'Skriv ditt meddelande.' }
  }
  if (message.length > CONTACT_MAX.message) {
    return { phase: 'error', message: `Meddelandet är för långt (max ${CONTACT_MAX.message} tecken).` }
  }

  // e. Skriv EXAKT en rad. DB:n sätter status ('new')/created_at. tenant_id är det
  //    server-resolvade id:t — den enda isoleringen, eftersom anon-RLS är permissiv.
  const supabase = createPublicClient()
  const { error } = await supabase.from('contact_messages').insert({
    tenant_id: ctx.id,
    name,
    email: email || null,
    phone: phone || null,
    subject: subject || null,
    message,
  })
  if (error) {
    return { phase: 'error', message: 'Något gick fel. Försök igen.' }
  }

  // f. Mejla kunden — BEST-EFFORT, EFTER den lyckade skrivningen. Meddelandet är redan
  //    durabelt; ett mejlfel får aldrig krascha formuläret för besökaren eller ta bort
  //    hennes rad. sendContactMessageEmail kastar aldrig, men vi bältar ändå: den här
  //    submiten ska lyckas även om mejlrälsen är nere. Ingen PII loggas.
  try {
    await sendContactMessageEmail({
      supabase,
      tenantId: ctx.id,
      tenantName: ctx.name,
      name,
      email: email || null,
      phone: phone || null,
      subject: subject || null,
      message,
    })
  } catch {
    // Medvetet tyst: raden ligger kvar i admin-inkorgen och kunden ser den där.
  }

  // OBS: ingen revalidateTag här. Kontaktmeddelanden syns bara i admin-inkorgen —
  // inget på den publika, cachade storefronten ändras av en insändning.
  return { phase: 'done' }
}
