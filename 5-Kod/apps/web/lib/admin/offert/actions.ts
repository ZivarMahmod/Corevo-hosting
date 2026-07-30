'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import { kronorToCents } from '@/lib/admin/format'
import type { ActionState } from '@/lib/admin/actions'
import { dispatchNotificationOutboxById } from '@/lib/notifications/outbox'
import { createServiceClient } from '@/lib/platform/service'
import { logger } from '@/lib/observability'
import { OFFERT_STATUSES } from './types'
import { deliverImmediateOffertOutbox } from './reply-delivery'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

function formVersion(fd: FormData): number | null {
  const raw = String(fd.get('lifecycleVersion') ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  const version = Number(raw)
  return Number.isSafeInteger(version) ? version : null
}

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data
}

export async function updateOffertRequest(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'offert')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar förfrågan.' }
  const expectedVersion = formVersion(fd)
  if (expectedVersion === null) return { error: 'Förfrågan måste laddas om.' }

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
  const { data, error } = await supabase.rpc('update_offert_request', {
    p_tenant: ctx.tenant.id,
    p_request: id,
    p_expected_version: expectedVersion,
    p_status: status,
    p_note: note,
    p_estimate_cents: estimate_cents,
  })
  if (error) return { error: GENERIC }
  const row = firstRow(data)
  if (!row || row.outcome === 'not_found') return { error: 'Förfrågan hittades inte.' }
  if (row.outcome === 'stale') return { error: 'Förfrågan har ändrats. Ladda om och försök igen.' }
  if (row.outcome === 'delivery_pending') {
    return { error: 'Ett kundsvar skickas fortfarande. Vänta tills leveransen är klar.' }
  }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/offerter')
  return {
    success: row.outcome === 'unchanged'
      ? 'Inga ändringar att spara.'
      : 'Förfrågan uppdaterad.',
  }
}

/**
 * Radera en offertförfrågan — så spam faktiskt går att rensa. Utan den här kunde
 * en inkorg full av skräp aldrig städas; "skapa utan ta bort" var hela gapet.
 *
 * AFFÄRS-VAKT: en offert som blivit en affär får INTE raderas — regeln bor i
 * offertDeletable (types.ts), som både UI:t och den här actionen filtrerar genom.
 * Statusen läses ur DB:n, ALDRIG ur formuläret: klienten skickar bara ett id, så
 * en klient som ljuger om statusen kan inte radera bort en accepterad affär.
 *
 * Samma auth-fence som modulens övriga actions: moduleCtx(fd) (dual-guard —
 * platform_admin via hidden tenantId, salon_admin FORCERAD ur JWT) och varje
 * query .eq('tenant_id', ctx.tenant.id). RLS är djupförsvar, inte ersättning.
 */
export async function deleteOffertRequest(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'offert')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar förfrågan.' }
  const expectedVersion = formVersion(fd)
  if (expectedVersion === null) return { error: 'Förfrågan måste laddas om.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('delete_offert_request', {
    p_tenant: ctx.tenant.id,
    p_request: id,
    p_expected_version: expectedVersion,
  })
  if (error) return { error: GENERIC }
  const row = firstRow(data)
  if (!row || row.outcome === 'not_found') return { error: 'Förfrågan hittades inte.' }
  if (row.outcome === 'stale') return { error: 'Förfrågan har ändrats. Ladda om och försök igen.' }
  if (row.outcome === 'protected') {
    return {
      error:
        'Förfrågan har blivit en affär (accepterad eller betald) och kan inte raderas — stäng den i stället.',
    }
  }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/offerter')
  return { success: 'Förfrågan raderad.' }
}

/**
 * DB:n köar ett idempotent svar, den befintliga outboxen levererar exakt raden
 * och DB-finalize får ensam sätta "quoted"/reply_message efter sent/delivered.
 */
export async function sendOffertReply(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState & { lifecycleVersion?: number }> {
  const ctx = await moduleCtx(fd, 'offert')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar förfrågan.' }
  const expectedVersion = formVersion(fd)
  if (expectedVersion === null) return { error: 'Förfrågan måste laddas om.' }

  const reply = String(fd.get('reply') ?? '').trim()
  if (!reply) return { error: 'Skriv ett svar till kunden.' }
  if (reply.length > 6000) return { error: 'Svaret är för långt (max 6000 tecken).' }

  const supabase = await createClient()
  const queued = await supabase.rpc('enqueue_offert_reply', {
    p_tenant: ctx.tenant.id,
    p_request: id,
    p_expected_version: expectedVersion,
    p_reply: reply,
  })
  if (queued.error) return { error: GENERIC }
  const row = firstRow(queued.data)
  if (!row || row.outcome === 'not_found') return { error: 'Förfrågan hittades inte.' }
  if (row.outcome === 'missing_email') {
    return {
      error: 'Förfrågan saknar e-postadress — kontakta kunden per telefon.',
      lifecycleVersion: row.version,
    }
  }
  if (row.outcome === 'stale') {
    return {
      error: 'Förfrågan har ändrats. Ladda om och försök igen.',
      lifecycleVersion: row.version,
    }
  }
  if (row.outcome === 'delivery_pending') {
    return {
      error: 'Ett annat kundsvar skickas fortfarande.',
      lifecycleVersion: row.version,
    }
  }
  if (row.outcome === 'status_conflict') {
    return {
      error: 'Förfrågan kan inte offereras från sin nuvarande status.',
      lifecycleVersion: row.version,
    }
  }
  if (!row.outbox_id) return { error: GENERIC }

  try {
    await dispatchNotificationOutboxById(row.outbox_id, deliverImmediateOffertOutbox)
  } catch {
    // Provider-ack kan ha nått DB även om dispatch-svaret tappades. Finalize
    // måste därför alltid få läsa den exakta outboxraden innan utfallet visas.
    logger.warn('offert.reply_dispatch_uncertain', {
      tenantId: ctx.tenant.id,
      requestId: id,
    })
  }

  const admin = createServiceClient()
  if (!admin) {
    return {
      error: 'Leveransen kunde inte bekräftas. Försök igen.',
      lifecycleVersion: row.version,
    }
  }
  const finalized = await admin.rpc('finalize_offert_reply', {
    p_tenant: ctx.tenant.id,
    p_request: id,
    p_outbox: row.outbox_id,
  })

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/offerter')
  if (finalized.error) {
    return {
      error: 'Leveransen kunde inte bekräftas. Försök igen.',
      lifecycleVersion: row.version,
    }
  }
  const delivery = firstRow(finalized.data)
  if (!delivery) {
    return {
      error: 'Leveransen kunde inte bekräftas. Försök igen.',
      lifecycleVersion: row.version,
    }
  }
  if (delivery.outcome === 'sent' || delivery.outcome === 'already_sent') {
    return { success: 'Svaret är skickat till kunden.' }
  }
  if (delivery.outcome === 'pending') {
    return {
      error: 'Svaret skickas fortfarande. Försök igen om en stund.',
      lifecycleVersion: delivery.version,
    }
  }
  return {
    error: 'Svaret kunde inte skickas. Texten är sparad för ett nytt försök.',
    lifecycleVersion: delivery.version,
  }
}
