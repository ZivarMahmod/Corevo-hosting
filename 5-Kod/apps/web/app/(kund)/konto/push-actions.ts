'use server'

import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getCustomerId } from '@/lib/kund/customer'
import { logger } from '@/lib/observability'

// Plan 015 steg 4: spara kundens push-prenumeration + tänd push_enabled.
// Körs som den INLOGGADE kunden — RLS (0091) släpper bara igenom rader vars
// customer hör till auth.uid(), så en kund kan aldrig skriva någon annans sub.

export type SavePushState = { ok?: boolean; error?: string }

export async function savePushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}): Promise<SavePushState> {
  const user = await requirePortal('kund')
  const tenantId = user.tenantId
  if (!tenantId) return { error: 'Ingen verksamhet.' }
  const endpoint = input.endpoint?.trim()
  if (!endpoint || !input.p256dh || !input.auth) return { error: 'Ofullständig prenumeration.' }

  const supabase = await createClient()
  const customerId = await getCustomerId(user.id, tenantId)
  if (!customerId) return { error: 'Hittade inte ditt kundkort.' }

  // Endpoint är unik: samma browser som prenumererar om skriver över sin rad.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      tenant_id: tenantId,
      customer_id: customerId,
      endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 200) ?? null,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    logger.warn('push.subscription_save_failed', { error: error.message })
    return { error: 'Kunde inte spara. Försök igen.' }
  }

  // Tänd push-kanalen i kundens prefs (routern väljer push först — plan 014).
  const { error: prefsError } = await supabase.from('customer_notification_prefs').upsert(
    { customer_id: customerId, tenant_id: tenantId, push_enabled: true },
    { onConflict: 'customer_id' },
  )
  if (prefsError) {
    // Suben är sparad — prefs-missen är inte fatal, men logga den.
    logger.warn('push.prefs_update_failed', { error: prefsError.message })
  }

  return { ok: true }
}
