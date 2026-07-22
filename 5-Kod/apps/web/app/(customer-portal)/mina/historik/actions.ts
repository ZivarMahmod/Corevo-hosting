'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { listPortalBookings } from '@/lib/customer-portal/data'
import type { PortalBookingCursor } from '@/lib/customer-portal/types'

export async function loadMorePortalHistory(cursor: PortalBookingCursor) {
  noStore()
  const result = await listPortalBookings({ scope: 'history', pageSize: 20, cursor })
  if (result.outcome !== 'ok') return { outcome: 'unavailable' as const }
  return {
    outcome: 'ok' as const,
    items: result.items,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  }
}
