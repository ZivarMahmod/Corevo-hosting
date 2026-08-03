import { describe, expect, it } from 'vitest'
import { bookingCtaSlots } from './booking-cta-slots'

describe('bookingCtaSlots', () => {
  it('exposes active service destinations for every storefront template', () => {
    const slots = bookingCtaSlots('leander', [
      { id: '10000000-0000-4000-8000-000000000001', name: 'Klippning', active: true },
      { id: '10000000-0000-4000-8000-000000000002', name: 'Dold tjänst', active: false },
    ], {})

    expect(slots).toEqual([{
      id: 'service:10000000-0000-4000-8000-000000000001',
      label: 'Klippning',
      group: 'Tjänster',
    }])
  })
})
