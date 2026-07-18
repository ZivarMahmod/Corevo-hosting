'use server'

// Bransch-kundbildens skriv-lager (FAS 2 steg 3, rapport 02 §5). Skriver till
// verticals-tabellen — RLS verticals_admin_write (0027) släpper bara igenom
// platform_admin, och platformCtx re-checkar rollen server-side.
//
// ARVSREGLERNA (rapport 02 §4): terminologi = LIVE-ARV (slår direkt på alla
// kunder i branschen — admin-skalet läser verticals.terminology per render);
// default_modules/default_template = KOPIA vid onboarding (påverkar bara NYA
// kunder). UI:t säger detta i klartext vid varje form.

import { revalidatePath } from 'next/cache'
import { platformAdminCtx } from '../guard'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
import { isSelectableTheme } from '@/lib/platform/theme-palettes'
import { COPY_OVERRIDE_KEYS } from '@/components/storefront/theme-content'
import { type ActionState, GENERIC } from './shared'

// Nycklarna kundbilden redigerar. business = rapport 06:s förslag ("Salongsadmin"
// → bransch-ord); resolveTerm har call-site-fallback så extra nycklar är säkra.
const TERM_KEYS = [
  'staff',
  'staff_plural',
  'service',
  'service_plural',
  'unit',
  'unit_plural',
  'business',
  // goal-55 8A: navens bransch-styrda huvud-CTA. Måste finnas här — save:n
  // skriver om HELA terminology-jsonben, annars raderas nycklarna vid nästa spar.
  'primary_cta_label',
  'primary_cta_href',
] as const

/** Terminologi — live-arv. Tomt fält = tillbaka till standard (nyckeln droppas). */
export async function saveVerticalTerminology(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformAdminCtx()
  const key = String(fd.get('vertical') ?? '').trim()
  if (!key) return { error: GENERIC }

  const terminology: Record<string, string> = {}
  for (const k of TERM_KEYS) {
    const v = String(fd.get(`term_${k}`) ?? '').trim()
    if (v) terminology[k] = v
  }

  const { error } = await supabase.from('verticals').update({ terminology }).eq('key', key)
  if (error) return { error: GENERIC }

  revalidatePath('/branscher')
  revalidatePath(`/branscher/${key}`)
  return { success: 'Terminologin sparad — gäller direkt för alla kunder i branschen.' }
}

/** Bransch-mall-text (goal-57 körning 12) — LIVE-ARV som terminologin: fälten är
 *  fallback under varje kunds egna settings.copy, så en kund med egen text ser
 *  ingen skillnad. Skriver om HELA default_copy-jsonben (samma mönster som
 *  terminologin — nycklar utanför formuläret skulle raderas, därför itererar vi
 *  ALLA COPY_OVERRIDE_KEYS). Tomt fält = nyckeln droppas = temats standard. */
export async function saveVerticalCopy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformAdminCtx()
  const key = String(fd.get('vertical') ?? '').trim()
  if (!key) return { error: GENERIC }

  const copy: Record<string, string> = {}
  for (const k of COPY_OVERRIDE_KEYS) {
    const v = String(fd.get(`copy_${k}`) ?? '').trim()
    if (v && v.length <= 4000) copy[k] = v
  }

  const { error } = await supabase.from('verticals').update({ default_copy: copy }).eq('key', key)
  if (error) return { error: GENERIC }

  revalidatePath('/branscher')
  revalidatePath(`/branscher/${key}`)
  return { success: 'Bransch-mallens texter sparade — gäller kunder utan egen text (inom ~5 min).' }
}

/** Modul-förval + default-mall — kopieras vid onboarding, rör aldrig befintliga. */
export async function saveVerticalDefaults(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformAdminCtx()
  const key = String(fd.get('vertical') ?? '').trim()
  if (!key) return { error: GENERIC }

  const { data: modules } = await supabase.from('modules').select('key')
  const defaultModules: Record<string, ModuleState> = {}
  for (const m of modules ?? []) {
    const v = String(fd.get(`mod_${m.key}`) ?? '')
    if ((MODULE_STATES as readonly string[]).includes(v)) defaultModules[m.key] = v as ModuleState
  }
  // Bokningen golvas till live — samma regel som onboardingen (booking är kärnan).
  if (defaultModules.booking === 'off' || defaultModules.booking === 'draft') {
    defaultModules.booking = 'live'
  }

  const rawTemplate = String(fd.get('default_template') ?? '').trim()
  const defaultTemplate = isSelectableTheme(rawTemplate) ? rawTemplate : null

  const { error } = await supabase
    .from('verticals')
    .update({ default_modules: defaultModules, default_template: defaultTemplate })
    .eq('key', key)
  if (error) return { error: GENERIC }

  revalidatePath('/branscher')
  revalidatePath(`/branscher/${key}`)
  return { success: 'Förvalen sparade — gäller nya kunder som onboardas i branschen.' }
}
