'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { resendPortalRecovery, startPortalRecovery } from '@/lib/customer-portal/recovery'
import { getClientIp } from '@/lib/security/rate-limit'

export async function startRecoveryAction(tenantSlug: string, lookup: string) {
  noStore()
  return startPortalRecovery({ tenantSlug, lookup, ip: await getClientIp() })
}

export async function resendRecoveryAction(tenantSlug: string) {
  noStore()
  return resendPortalRecovery({ tenantSlug, ip: await getClientIp() })
}
