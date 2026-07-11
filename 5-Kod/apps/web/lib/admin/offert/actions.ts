'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import { kronorToCents } from '@/lib/admin/format'
import type { ActionState } from '@/lib/admin/actions'
import { OFFERT_STATUSES } from './types'

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

export async function updateOffertRequest(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar förfrågan.' }

  const status = String(fd.get('status') ?? '').trim()
  if (!(OFFERT_STATUSES as readonly string[]).includes(status))
    return { error: 'Ogiltig status.' }

  const noteRaw = String(fd.get('note') ?? '').trim()
  const note = noteRaw === '' ? null : noteRaw

  const estimateRaw = String(fd.get('estimate') ?? '').trim()
  let estimate_cents: number | null = null
  if (estimateRaw !== '') {
    const parsed = kronorToCents(estimateRaw)
    if (parsed === null || parsed < 0) return { error: 'Ogiltigt belopp.' }
    estimate_cents = parsed
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('offert_requests')
    .update({ status, note, estimate_cents })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/offerter')
  return { success: 'Förfrågan uppdaterad.' }
}

/**
 * @deprecated Superseded by {@link updateOffertRequest} (the only offert-status UI,
 * OffertInbox.tsx, dispatches updateOffertRequest — which also persists note +
 * estimate_cents). setOffertStatus has 0 call sites and is a divergent dead
 * write-path (status-only). Kept per build-once-never-delete; do NOT wire new UI
 * to it — use updateOffertRequest so note/estimate stay in sync.
 */
export async function setOffertStatus(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar förfrågan.' }

  const status = String(fd.get('status') ?? '').trim()
  if (!(OFFERT_STATUSES as readonly string[]).includes(status))
    return { error: 'Ogiltig status.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('offert_requests')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/offerter')
  return { success: 'Status uppdaterad.' }
}
