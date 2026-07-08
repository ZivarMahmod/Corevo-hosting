'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Publik kontakt: e-post + telefon (settings.contact) + adress (primär location) ──
// Super-admin redigerar det som visas i storefrontens footer, utan att logga in i
// kundens egen admin. Öppettider redigeras INTE här — de härleds ur personalens
// veckoscheman (Personal-fliken). Merge, never clobber: settings är co-owned jsonb.

// Loose e-postkoll: tom → null (rensa); annars måste den se ut som en adress.
function emailOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v.slice(0, 200) : undefined
}

export async function saveTenantContact(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }

  const email = emailOrNull(fd.get('email'))
  if (email === undefined) return { error: 'Ogiltig e-postadress.' }
  const phone = String(fd.get('phone') ?? '').trim().slice(0, 40) || null
  const address = String(fd.get('address') ?? '').trim().slice(0, 300) || null

  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  // 1) contact (email/phone) → settings.contact. MERGE: spread prev, sätt bara contact.
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = { ...prev, contact: { email, phone } }
  const { error: sErr } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (sErr) {
    await reportActionError('saveTenantContact.settings', sErr, { tenantId })
    return { error: GENERIC }
  }

  // 2) adress → primär location. Uppdatera om den finns; skapa annars en primär plats
  //    (bara när en adress angetts — vi skapar ingen tom plats).
  const { data: loc } = await supabase
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (loc?.id) {
    const { error: lErr } = await supabase
      .from('locations')
      .update({ address })
      .eq('id', loc.id)
      .eq('tenant_id', tenantId)
    if (lErr) {
      await reportActionError('saveTenantContact.locUpdate', lErr, { tenantId })
      return { error: GENERIC }
    }
  } else if (address) {
    const { error: lErr } = await supabase.from('locations').insert({
      tenant_id: tenantId,
      name: tenant.name ?? 'Salong',
      address,
      timezone: 'Europe/Stockholm',
      is_primary: true,
      active: true,
    })
    if (lErr) {
      await reportActionError('saveTenantContact.locInsert', lErr, { tenantId })
      return { error: GENERIC }
    }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, { action: 'tenant.contact', tenantId, actorId: user.id })
  return { success: 'Kontakt & adress sparad. Publika sajten uppdaterad.' }
}
