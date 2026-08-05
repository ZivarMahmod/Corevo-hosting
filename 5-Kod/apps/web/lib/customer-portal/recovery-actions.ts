'use server'

import { unstable_noStore as noStore } from 'next/cache'
import {
  getPortalRecoveryState,
  resendPortalRecovery,
  startPortalRecovery,
  verifyPortalRecovery,
} from '@/lib/customer-portal/recovery'
import { getClientIp } from '@/lib/security/rate-limit'

export async function startRecoveryAction(tenantSlug: string, lookup: string) {
  noStore()
  return startPortalRecovery({ tenantSlug, lookup, ip: await getClientIp() })
}

export async function resendRecoveryAction(tenantSlug: string) {
  noStore()
  return resendPortalRecovery({ tenantSlug, ip: await getClientIp() })
}

export async function getRecoveryStateAction(tenantSlug: string) {
  noStore()
  const state = await getPortalRecoveryState({ tenantSlug })
  if (state.state !== 'sent') return state
  return {
    state: state.state,
    attemptsRemaining: state.attemptsRemaining,
    retryAfterSeconds: Math.max(0, Math.ceil((Date.parse(state.resendAfter) - Date.now()) / 1000)),
  } as const
}

export async function verifyRecoveryAction(tenantSlug: string, code: string) {
  noStore()
  return verifyPortalRecovery({ tenantSlug, code, ip: await getClientIp() })
}
