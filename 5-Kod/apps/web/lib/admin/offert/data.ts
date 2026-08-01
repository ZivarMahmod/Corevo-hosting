import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { OffertRequestRow } from './types'

export async function listOffertRequests(tenantId: string): Promise<OffertRequestRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('offert_requests')
    .select(
      'id, customer_name, customer_email, customer_phone, mode, subject, message, details, estimate_cents, currency, status, payment_status, note, lifecycle_version, reply_delivery_state, reply_outbox_id, reply_error_code, reply_pending_message, reply_message, replied_at, created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`listOffertRequests: ${error.message}`)
  return data ?? []
}
