'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { logoutCurrentPortalSession } from '@/lib/customer-portal/logout'

export async function logoutPortalAction() {
  noStore()
  return logoutCurrentPortalSession()
}
