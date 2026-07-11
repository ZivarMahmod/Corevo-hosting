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
import { platformCtx } from '../guard'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
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
] as const

/** Terminologi — live-arv. Tomt fält = tillbaka till standard (nyckeln droppas). */
export async function saveVerticalTerminology(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformCtx()
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

/** Modul-förval + default-mall — kopieras vid onboarding, rör aldrig befintliga. */
export async function saveVerticalDefaults(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformCtx()
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
  // Bara riktiga renderbara teman (freshcut = kundens, aldrig ett bransch-default).
  const VALID = ['salvia', 'leander', 'zigge', 'linnea', 'edit', 'flora']
  const defaultTemplate = VALID.includes(rawTemplate) ? rawTemplate : null

  const { error } = await supabase
    .from('verticals')
    .update({ default_modules: defaultModules, default_template: defaultTemplate })
    .eq('key', key)
  if (error) return { error: GENERIC }

  revalidatePath('/branscher')
  revalidatePath(`/branscher/${key}`)
  return { success: 'Förvalen sparade — gäller nya kunder som onboardas i branschen.' }
}
