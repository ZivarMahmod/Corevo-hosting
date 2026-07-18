import { afterEach, describe, expect, it } from 'vitest'
import { inviteRedirectUrl } from './invite'

const originalStaffHost = process.env.NEXT_PUBLIC_STAFF_HOST
const originalPlatformHost = process.env.NEXT_PUBLIC_PLATFORM_HOST

afterEach(() => {
  if (originalStaffHost === undefined) delete process.env.NEXT_PUBLIC_STAFF_HOST
  else process.env.NEXT_PUBLIC_STAFF_HOST = originalStaffHost
  if (originalPlatformHost === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_HOST
  else process.env.NEXT_PUBLIC_PLATFORM_HOST = originalPlatformHost
})

describe('invite redirect hosts', () => {
  it('sends both owner and staff onboarding to the primary booking door', () => {
    delete process.env.NEXT_PUBLIC_PLATFORM_HOST
    process.env.NEXT_PUBLIC_STAFF_HOST = 'minbooking.example.test'

    expect(inviteRedirectUrl('admin')).toBe('https://booking.corevo.se/valkommen')
    expect(inviteRedirectUrl('staff')).toBe('https://booking.corevo.se/valkommen')
  })

  it('honours the configured primary booking host for both roles', () => {
    process.env.NEXT_PUBLIC_PLATFORM_HOST = 'booking.example.test'
    process.env.NEXT_PUBLIC_STAFF_HOST = 'minbooking.example.test'

    expect(inviteRedirectUrl('admin')).toBe('https://booking.example.test/valkommen')
    expect(inviteRedirectUrl('staff')).toBe('https://booking.example.test/valkommen')
  })
})
