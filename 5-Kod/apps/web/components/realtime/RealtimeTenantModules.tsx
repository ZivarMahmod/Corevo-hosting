'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export function RealtimeTenantModules({ tenantId }: { tenantId?: string }) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch {
      return
    }

    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => router.refresh(), 300)
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) supabase.realtime.setAuth(session.access_token)
    })

    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (session) await supabase.realtime.setAuth(session.access_token)
        const scope = tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}
        channel = supabase
          .channel(`rt-tenant-modules-${tenantId ?? 'platform'}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tenant_module_revisions', ...scope },
            refresh,
          )
          .subscribe()
      } catch {
        // Realtime is a refresh signal; the page remains usable without the socket.
      }
    })()

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      if (channel) supabase.removeChannel(channel)
      authListener.subscription.unsubscribe()
    }
  }, [router, tenantId])

  return null
}
