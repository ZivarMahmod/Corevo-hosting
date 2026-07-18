'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { kronorToCents } from '../billing'
import { logPlatformAction } from '../audit'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'
import { revalidateTenantById } from '@/lib/admin/tenant'
import { LOYALTY_INTERVALS, type LoyaltyInterval } from '@/lib/storefront/lojalitet/types'

// KLUBBENS NIVÅER i kundkortet (goal-64). Super-admin fyller loyalty_plans (0057) åt en
// VALD kund: namn, pris, intervall, förmåner, markerad nivå, ordning.
//
// Mönstret är actions/services.ts ORDAGRANT: allt går via platformCtx() (RLS-bypass som
// platform_admin), tenant_id valideras server-side och LITAS ALDRIG på från klienten, varje
// update/delete är `.eq('tenant_id', tenantId)`-scopad (en tampererad plan_id kan inte nå en
// annan kunds nivå), och efteråt bustas kundens cache + en audit-rad skrivs.
//
// Utan den här ytan vore nivåerna döda kolumner: Källas Droppe/Källa/Flod syns bara på
// klubbsidan om KUNDEN kan skriva in dem. Render-on-present betyder att tomt = tomt — så
// tomt måste gå att fylla.

/** Förmåner: en per rad i en textarea → string[] (jsonb). Tomma rader faller bort. */
function perksFrom(fd: FormData): string[] {
  return String(fd.get('perks') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20) // defensivt tak; en klubbnivå med 20 förmåner är redan orimlig
    .map((line) => line.slice(0, 160))
}

/** Formulärets intervall → ett av 0057:s check-värden. Okänt → 'month' (mallarnas vanligaste). */
function intervalFrom(fd: FormData): LoyaltyInterval {
  const raw = String(fd.get('interval') ?? '').trim()
  return (LOYALTY_INTERVALS as readonly string[]).includes(raw) ? (raw as LoyaltyInterval) : 'month'
}

/** kr → öre (>= 0). Blankt/ogiltigt → 0: en nivå FÅR vara gratis (poängklubb utan pris),
 *  men den får aldrig bli ett slumppris. */
function priceFrom(fd: FormData): number {
  const cents = kronorToCents(String(fd.get('price') ?? ''))
  return cents === null || cents < 0 ? 0 : cents
}

function sortFrom(fd: FormData): number {
  const n = Number(String(fd.get('sort_order') ?? '').trim())
  return Number.isInteger(n) && n >= 0 ? n : 0
}

/** Lägg till en nivå i kundens klubb. */
export async function createLoyaltyPlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 80)
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!name) return { error: 'Ge nivån ett namn (t.ex. Droppe).' }

  // Tenanten måste finnas — klientens tenantId är bara en påstådd sträng tills nu.
  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Kunden finns inte.' }

  const { data: created, error } = await supabase
    .from('loyalty_plans')
    .insert({
      tenant_id: tenantId,
      name,
      price_cents: priceFrom(fd),
      interval: intervalFrom(fd),
      perks: perksFrom(fd),
      featured: fd.get('featured') === 'on',
      sort_order: sortFrom(fd),
      active: true,
    })
    .select('id')
    .single()
  if (error || !created) {
    await reportActionError('createLoyaltyPlan.insert', error, { tenantId })
    return { error: GENERIC }
  }

  await revalidateTenantById(supabase, tenantId) // klubbsidan cachas under tenant:<slug>
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.loyalty_plan_create',
    tenantId,
    actorId: user.id,
    entityId: created.id,
    meta: { name },
  })
  return { success: 'Nivån tillagd.' }
}

/** Redigera en nivå (namn, pris, intervall, förmåner, markerad, ordning, aktiv). */
export async function updateLoyaltyPlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const planId = String(fd.get('planId') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 80)
  if (!tenantId || !planId) return { error: 'Saknar nivå.' }
  if (!name) return { error: 'Ge nivån ett namn.' }

  const { error } = await supabase
    .from('loyalty_plans')
    .update({
      name,
      price_cents: priceFrom(fd),
      interval: intervalFrom(fd),
      perks: perksFrom(fd),
      featured: fd.get('featured') === 'on',
      sort_order: sortFrom(fd),
      active: fd.get('active') === 'on',
    })
    .eq('id', planId)
    .eq('tenant_id', tenantId) // scope-fence: aldrig en annan kunds nivå
  if (error) {
    await reportActionError('updateLoyaltyPlan.update', error, { tenantId })
    return { error: GENERIC }
  }

  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.loyalty_plan_update',
    tenantId,
    actorId: user.id,
    entityId: planId,
    meta: { name },
  })
  return { success: 'Sparat.' }
}

/** Ta bort en nivå. Medlemmar som valt den behålls (loyalty_members.plan_id → NULL,
 *  ON DELETE SET NULL) — medlemskapet är kundens, inte nivåns. */
export async function deleteLoyaltyPlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const planId = String(fd.get('planId') ?? '')
  if (!tenantId || !planId) return { error: 'Saknar nivå.' }

  const { error } = await supabase
    .from('loyalty_plans')
    .delete()
    .eq('id', planId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('deleteLoyaltyPlan.delete', error, { tenantId })
    return { error: GENERIC }
  }

  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.loyalty_plan_delete',
    tenantId,
    actorId: user.id,
    entityId: planId,
    meta: {},
  })
  return { success: 'Nivån borttagen.' }
}
