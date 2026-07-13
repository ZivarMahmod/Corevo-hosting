'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenantById } from '@/lib/admin/tenant'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Offertens FÖRFRÅGNINGSTYPER (goal-64) ─────────────────────────────────────
// Mallarna ritar chips FÖRE fritexten: Aurora ['Bröllop','Företag','Event & fest',
// 'Begravning'], Källa ['Bröllopsmorgon','Möhippa','Företag','Privat kväll'], Siluett
// ['Editorial / plåtning', …]. Chipsen fanns REDAN i storefronten — OffertForm renderar
// `config.subjects` som radios och intaken sparar valet i offert_requests.subject.
// Det som SAKNADES var att kunden aldrig kunde bestämma listan: den låg bara i
// tenant_modules.config-jsonb:en och ingen yta skrev till den. Den här actionen är
// den saknade halvan.
//
// VARFÖR `subjects` och inte ett nytt `request_types`: fältet finns redan, är parsat
// (parseOffertConfig), renderat och lagrat. Ett andra fält med samma betydelse hade
// gett två sanningar om samma lista — och den ena hade tystnat.
//
// TOM LISTA = INGA CHIPS. Vi hittar aldrig på typer åt en kund; en tom lista faller
// tillbaka på fritext, precis som OffertForm redan gör (`hasChips`).

/** Samma tak som parseOffertConfig läser med: max 8 chips, 60 tecken styck. */
const MAX_SUBJECTS = 8
const MAX_SUBJECT_LEN = 60

export async function saveOffertSubjects(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  // En rad per typ i en textarea — enklaste ytan som inte kan gå sönder. Tomma rader
  // faller bort, dubbletter tas bort (samma chip två gånger är alltid ett misstag).
  const raw = String(fd.get('subjects') ?? '')
  const subjects = [
    ...new Set(
      raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.slice(0, MAX_SUBJECT_LEN)),
    ),
  ].slice(0, MAX_SUBJECTS)

  // MERGE, never clobber: config är co-owned jsonb (mode/response_days/currency/payment
  // bor där också). Läs → spreada → sätt bara `subjects`.
  const { data: row } = await supabase
    .from('tenant_modules')
    .select('config')
    .eq('tenant_id', tenantId) // tenant-fencen
    .eq('module_key', 'offert')
    .maybeSingle()
  if (!row) return { error: 'Offert-modulen är inte påslagen för den här kunden.' }

  const prev = (row.config ?? {}) as Record<string, unknown>
  const config = { ...prev, subjects }

  const { error } = await supabase
    .from('tenant_modules')
    .update({ config })
    .eq('tenant_id', tenantId)
    .eq('module_key', 'offert')
  if (error) {
    await reportActionError('saveOffertSubjects', error, { tenantId })
    return { error: GENERIC }
  }

  // Storefronten cachar per tenant — offertsidan måste visa de nya chipsen direkt.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/offerter')
  await logPlatformAction(supabase, {
    action: 'tenant.module_config',
    tenantId,
    actorId: user.id,
    meta: { module: 'offert', subjects: subjects.length }, // antal, aldrig innehållet
  })

  return {
    success:
      subjects.length > 0
        ? `${subjects.length} förfrågningstyper sparade. Visas som val i offertformuläret.`
        : 'Inga förfrågningstyper — formuläret visar fritext istället för chips.',
  }
}
