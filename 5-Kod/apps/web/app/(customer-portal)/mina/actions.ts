'use server'

import { unstable_noStore as noStore } from 'next/cache'
import {
  cancelPortalBooking,
  type PortalCancellationInput,
} from '@/lib/customer-portal/actions'
import { logoutCurrentPortalSession } from '@/lib/customer-portal/logout'
import { updatePortalCustomerName } from '@/lib/customer-portal/profile'

export async function cancelPortalBookingAction(input: PortalCancellationInput) {
  noStore()
  return cancelPortalBooking(input)
}

export async function logoutPortalAction() {
  noStore()
  return logoutCurrentPortalSession()
}

export async function updatePortalNameAction(name: string) {
  noStore()
  return updatePortalCustomerName(name)
}
