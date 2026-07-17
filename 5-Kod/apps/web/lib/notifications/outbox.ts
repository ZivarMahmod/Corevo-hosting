import 'server-only'
import type { Json } from '@corevo/db'
import { createServiceClient } from '@/lib/platform/service'
import { logger } from '@/lib/observability'
import type { ChannelDecision, NotificationCategory, NotificationChannel } from './router'

// Kommunikationsledgern (plan 014): EN rad per utskicksbeslut — varför, kanal,
// samtyckesögonblick, leverans, kostnad. Skrivs ENDAST via service-role (RLS ger
// klientroller bara läs). Best-effort: ledgerfel får aldrig blockera ett utskick,
// och utan service-nyckel degraderar loggningen tyst (samma mönster som erase).
//
// Statusmodell: queued → sent → delivered / failed / skipped. Sändarna skriver
// facit direkt (sent/failed/skipped); 'queued' är retry-sömmen (plan 012) för
// framtida producenter som vill efterleverera via cron-svepet.

export type OutboxWrite = {
  tenantId: string
  customerId?: string | null
  bookingId?: string | null
  staffId?: string | null
  eventType: string
  category: NotificationCategory
  decision: ChannelDecision
  status: 'sent' | 'failed' | 'skipped'
  /** Kanal som faktiskt användes (kan vara decisionens fallback). */
  usedChannel?: NotificationChannel | null
  skipReason?: string | null
  costOre?: number | null
  providerRef?: string | null
}

export async function logOutbox(entry: OutboxWrite): Promise<void> {
  try {
    const admin = createServiceClient()
    if (!admin) {
      logger.info('outbox.skipped_no_service_role', { event: entry.eventType })
      return
    }
    const { error } = await admin.from('notifications_outbox').insert({
      tenant_id: entry.tenantId,
      customer_id: entry.customerId ?? null,
      booking_id: entry.bookingId ?? null,
      staff_id: entry.staffId ?? null,
      event_type: entry.eventType,
      category: entry.category,
      chosen_channel: entry.usedChannel ?? entry.decision.channel,
      fallback_channel: entry.decision.fallback,
      consent_state: entry.decision.consentState as Json,
      status: entry.status,
      skip_reason: entry.skipReason ?? entry.decision.skipReason ?? null,
      cost_ore: entry.costOre ?? null,
      provider_ref: entry.providerRef ?? null,
      sent_at: entry.status === 'sent' ? new Date().toISOString() : null,
    })
    if (error) logger.warn('outbox.write_failed', { event: entry.eventType, error: error.message })
  } catch (err) {
    logger.warn('outbox.write_threw', {
      event: entry.eventType,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
