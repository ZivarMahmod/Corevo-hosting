'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Schemavy-kioskens puls: server-datat (bokningsantal, frånvaro) hämtas om med
 * jämna mellanrum via router.refresh() så en iPad som står framme hela dagen
 * aldrig visar gammalt läge. Ingen UI — bara intervallet.
 */
export function KioskAutoRefresh({ seconds = 120 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), seconds * 1000)
    return () => window.clearInterval(id)
  }, [router, seconds])
  return null
}
