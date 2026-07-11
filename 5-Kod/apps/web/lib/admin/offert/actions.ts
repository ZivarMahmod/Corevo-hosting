'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import { kronorToCents } from '@/lib/admin/format'
import type { ActionState } from '@/lib/admin/actions'
import { sendOffertReplyEmail } from '@/lib/notifications/offert'
import { logger } from '@/lib/observability'
import { OFFERT_STATUSES, offertTransitionAllowed, type OffertStatus } from './types'

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

  // FSM-vakt (goal-54 körning 3): statusövergångar följer OFFERT_ALLOWED_FROM —
  // "Offererad" och vidare är en process, inte en fri etikett.
  const { data: current } = await supabase
    .from('offert_requests')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!current) return { error: 'Förfrågan hittades inte.' }
  if (!offertTransitionAllowed(current.status, status as OffertStatus)) {
    return { error: 'Ogiltig statusövergång.' }
  }

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
 * Svara kunden på en offertförfrågan (goal-54 körning 3, A4). Mejlar svarstexten
 * (+ ev. sparad prisuppskattning) till kundens e-post via mejl-rälsen, sparar
 * reply_message/replied_at och flyttar status → 'quoted' (när övergången är
 * tillåten). DB-write först; mejlfel efter lyckad write rapporteras ärligt men
 * rullar inte tillbaka svaret.
 */
export async function sendOffertReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar förfrågan.' }

  const reply = String(fd.get('reply') ?? '').trim()
  if (!reply) return { error: 'Skriv ett svar till kunden.' }
  if (reply.length > 6000) return { error: 'Svaret är för långt (max 6000 tecken).' }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('offert_requests')
    .select('status, customer_name, customer_email, subject, estimate_cents')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!row) return { error: 'Förfrågan hittades inte.' }
  if (!row.customer_email) {
    return { error: 'Förfrågan saknar e-postadress — kontakta kunden per telefon.' }
  }

  const nextStatus = offertTransitionAllowed(row.status, 'quoted') ? 'quoted' : row.status
  const { error } = await supabase
    .from('offert_requests')
    .update({ reply_message: reply, replied_at: new Date().toISOString(), status: nextStatus })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  const sent = await sendOffertReplyEmail({
    supabase,
    tenantId: ctx.tenant.id,
    tenantName: ctx.tenant.name,
    to: row.customer_email,
    customerName: row.customer_name,
    subject: row.subject,
    replyMessage: reply,
    estimateCents: row.estimate_cents,
  })

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/offerter')
  if (!sent.ok) {
    logger.warn('offert.reply_email_failed', { tenantId: ctx.tenant.id, requestId: id })
    return {
      error:
        'Svaret sparades men mejlet kunde inte skickas just nu — försök igen eller kontakta kunden direkt.',
    }
  }
  return { success: 'Svaret är skickat till kunden.' }
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
