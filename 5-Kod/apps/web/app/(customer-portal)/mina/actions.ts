'use server'

import { unstable_noStore as noStore } from 'next/cache'
import {
  cancelPortalBooking,
  type PortalCancellationInput,
} from '@/lib/customer-portal/actions'
import { logoutCurrentPortalSession } from '@/lib/customer-portal/logout'
import { updatePortalCustomerName } from '@/lib/customer-portal/profile'
import {
  finalizePortalContactChange,
  resendPortalContactChange,
  startPortalContactChange,
  submitPortalContactChangeDestination,
  verifyPortalContactChangeCurrent,
} from '@/lib/customer-portal/contact-change'
import type { PortalContactChangeAction } from '@/lib/customer-portal/types'
import {
  revokeOtherPortalSessions,
  revokePortalBookingTrusts,
} from '@/lib/customer-portal/security-devices'

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

export async function startPortalContactChangeAction(action: PortalContactChangeAction) {
  noStore()
  return startPortalContactChange(action)
}

export async function verifyPortalContactChangeCurrentAction(code: string) {
  noStore()
  return verifyPortalContactChangeCurrent(code)
}

export async function submitPortalContactChangeDestinationAction(destination: string) {
  noStore()
  return submitPortalContactChangeDestination(destination)
}

export async function resendPortalContactChangeAction(stage: 'current' | 'new') {
  noStore()
  return resendPortalContactChange(stage)
}

export async function finalizePortalContactChangeAction(code: string) {
  noStore()
  return finalizePortalContactChange(code)
}

export async function revokeOtherPortalSessionsAction() {
  noStore()
  return revokeOtherPortalSessions()
}

export async function revokePortalBookingTrustsAction() {
  noStore()
  return revokePortalBookingTrusts()
}
