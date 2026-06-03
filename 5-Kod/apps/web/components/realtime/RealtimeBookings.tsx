'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

/**
 * Invisible realtime subscriber. Listens on a Postgres-changes channel for any
 * write to `bookings` and re-runs the *server* render (router.refresh()) — the
 * channel is only a SIGNAL, never a data source. The RLS-fenced server query is
 * what actually reads rows, so we never trust the realtime payload.
 *
 * The channel policy is `to authenticated`, so the socket MUST carry a hydrated
 * JWT before we subscribe — otherwise the subscription succeeds but yields ZERO
 * events silently. We therefore await getSession() + setAuth() before .subscribe(),
 * and re-set the token on every refresh so a long-lived back-office tab survives
 * JWT rotation.
 *
 * `tenantId` is the trusted, server-resolved tenant id (from the verified JWT in
 * the layout). When omitted (platform_admin) we subscribe cross-tenant; RLS still
 * fences the channel to is_platform_admin().
 */
export function RealtimeBookings({ tenantId }: { tenantId?: string }) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const supabase = createClient()

    // ~500ms-debounced: a burst of writes collapses into a single server re-render.
    const debouncedRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => router.refresh(), 500)
    }

    // Keep the socket's JWT fresh across token rotation (long-lived tabs).
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) supabase.realtime.setAuth(session.access_token)
    })

    void (async () => {
      // AUTH-RACE FIX: hydrate the session and push the token onto the socket
      // BEFORE subscribing. getSession() populates the auth store but does not by
      // itself guarantee the token is on the realtime socket, so we setAuth too.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      // Strict-mode (or a fast tenant change) may have torn us down mid-await.
      if (cancelled) return
      if (session) await supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel('rt-bookings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
          },
          () => debouncedRefresh(),
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      if (channel) supabase.removeChannel(channel)
      authListener.subscription.unsubscribe()
    }
  }, [tenantId, router])

  return null
}
