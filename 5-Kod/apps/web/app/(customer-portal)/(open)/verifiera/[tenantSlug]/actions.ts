'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { getPortalRecoveryState, verifyPortalRecovery } from '@/lib/customer-portal/recovery'
import { getClientIp } from '@/lib/security/rate-limit'

export async function getRecoveryStateAction(tenantSlug: string) {
  noStore()
  return getPortalRecoveryState({ tenantSlug })
}

export async function verifyRecoveryAction(tenantSlug: string, code: string) {
  noStore()
  return verifyPortalRecovery({ tenantSlug, code, ip: await getClientIp() })
}
