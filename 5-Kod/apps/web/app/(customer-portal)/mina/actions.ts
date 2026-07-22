'use server'

import { unstable_noStore as noStore } from 'next/cache'
import {
  cancelPortalBooking,
  type PortalCancellationInput,
} from '@/lib/customer-portal/actions'
import { logoutCurrentPortalSession } from '@/lib/customer-portal/logout'

export async function cancelPortalBookingAction(input: PortalCancellationInput) {
  noStore()
  return cancelPortalBooking(input)
}

export async function logoutPortalAction() {
  noStore()
  return logoutCurrentPortalSession()
}
