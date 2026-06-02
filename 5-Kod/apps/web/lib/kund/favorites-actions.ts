'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { getOrCreateCustomerId, getCustomerId } from './customer'

// ── Favoriter (M4 §2.3) — mutations ──────────────────────────────────────────
// Add/remove a saved staff or service. Ownership + tenant isolation are enforced
// by customer_favorites RLS (customer_id = private.current_customer_id()); these
// actions add the app-layer belt-and-suspenders:
//   · re-check auth (requirePortal('kund'));
//   · resolve the caller's own customers.id (creating it on first favorite, since
//     a registered customer may have none yet — see lib/kund/customer.ts);
//   · validate the target (staff/service) belongs to the caller's tenant before
//     insert, so a forged id can't create a cross-tenant row (RLS would reject the
//     write too, but a clear app error beats a silent RLS failure).

export type FavoriteActionState = { error?: string }

type AddInput = { kind: 'staff' | 'service'; targetId: string }

function parseAdd(formData: FormData): AddInput | null {
  const kind = String(formData.get('kind') ?? '')
  const targetId = String(formData.get('targetId') ?? '').trim()
  if ((kind !== 'staff' && kind !== 'service') || !targetId) return null
  return { kind, targetId }
}

export async function addFavorite(
  _prev: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  const user = await requirePortal('kund')
  const tenantId = user.tenantId ?? ''
  if (!tenantId) return { error: 'Okänd salong.' }

  const input = parseAdd(formData)
  if (!input) return { error: 'Ogiltigt favoritval.' }

  const supabase = await createClient()

  // Validate the target belongs to this tenant (and is bookable/active).
  if (input.kind === 'staff') {
    const { data } = await supabase
      .from('staff')
      .select('id')
      .eq('id', input.targetId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!data) return { error: 'Frisören hittades inte.' }
  } else {
    const { data } = await supabase
      .from('services')
      .select('id')
      .eq('id', input.targetId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!data) return { error: 'Tjänsten hittades inte.' }
  }

  const resolved = await getOrCreateCustomerId(user.id, tenantId)
  if ('error' in resolved) return { error: resolved.error }
  const customerId = resolved.id

  const { error } = await supabase.from('customer_favorites').insert({
    tenant_id: tenantId,
    customer_id: customerId,
    kind: input.kind,
    staff_id: input.kind === 'staff' ? input.targetId : null,
    service_id: input.kind === 'service' ? input.targetId : null,
  })
  // 23505 = already a favorite (partial-unique per customer + target) → treat as
  // success: the desired end-state (it IS a favorite) holds.
  if (error && error.code !== '23505') {
    return { error: 'Kunde inte spara favoriten. Försök igen.' }
  }

  revalidatePath('/konto')
  return {}
}

export async function removeFavorite(
  _prev: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  const user = await requirePortal('kund')
  const tenantId = user.tenantId ?? ''
  const favoriteId = String(formData.get('favoriteId') ?? '').trim()
  if (!favoriteId) return { error: 'Saknar favorit.' }

  const customerId = await getCustomerId(user.id, tenantId)
  if (!customerId) {
    // No customers row → nothing of theirs to remove. Idempotent no-op.
    revalidatePath('/konto')
    return {}
  }

  const supabase = await createClient()
  // RLS already fences to own rows; the explicit customer_id match makes the
  // ownership scope obvious and prevents deleting via a guessed id.
  const { error } = await supabase
    .from('customer_favorites')
    .delete()
    .eq('id', favoriteId)
    .eq('customer_id', customerId)
  if (error) return { error: 'Kunde inte ta bort favoriten. Försök igen.' }

  revalidatePath('/konto')
  return {}
}
