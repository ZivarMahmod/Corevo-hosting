import { describe, expect, it } from 'vitest'
import { shouldLoadBookingRealtime } from './realtime-routes'

describe('booking realtime route budget', () => {
  it.each(['/admin', '/admin/bokningar', '/admin/bokningar/123', '/personal', '/personal/arbetstider'])(
    'loads the subscriber on live booking surfaces: %s',
    (pathname) => expect(shouldLoadBookingRealtime(pathname)).toBe(true),
  )

  it.each([
    '/admin/installningar',
    '/admin/tjanster',
    '/admin/personal',
    '/admin/kunder',
    '/kunder',
    '/slutkunder',
    '/salonger', // permanent legacy alias
    '/fakturering',
    '/login',
  ])('does not download realtime on unrelated surfaces: %s', (pathname) => {
    expect(shouldLoadBookingRealtime(pathname)).toBe(false)
  })
})
