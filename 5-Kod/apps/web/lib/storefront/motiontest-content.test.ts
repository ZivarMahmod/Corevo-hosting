import { describe, expect, it } from 'vitest'

import type { Service } from '@/lib/tenant-data'
import { resolveMotiontestView } from './motiontest-content'

const SERVICES = [
  ['Herrklippning', 30, 36900],
  ['Herrklippning Student', 30, 32900],
  ['Herrklippning, långt skägg, varm handduk', 45, 45900],
  ['Herrklippning, kort skägg, varm handduk', 30, 41900],
  ['Pensionärsklippning', 30, 32900],
  ['Barnklippning, upp till 8 år', 30, 29900],
  ['Skäggtrimning', 15, 22900],
].map(([name, duration_min, price_cents], index) => ({
  id: `freshcut-service-${index + 1}`,
  tenant_id: 'tenant-freshcut',
  name,
  description: null,
  duration_min,
  price_cents,
  active: true,
})) as Service[]

describe('resolveMotiontestView', () => {
  it('keeps verified services as the canonical input rows', () => {
    const view = resolveMotiontestView(SERVICES, {
      name: 'FreshCut Bokhållaregatan',
      address: 'Bokhållaregatan 2, 582 24 Linköping',
      hours: null,
    })

    expect(view.verifiedServices.map((entry) => entry.service)).toEqual(SERVICES)
    expect(view.verifiedServices.map((entry) => entry.service.id)).toEqual([
      'freshcut-service-1',
      'freshcut-service-2',
      'freshcut-service-3',
      'freshcut-service-4',
      'freshcut-service-5',
      'freshcut-service-6',
      'freshcut-service-7',
    ])
    expect(view.verifiedServices.every((entry) => entry.provenance === 'verified')).toBe(true)
  })

  it('keeps provisional womens services separate from production Service rows', () => {
    const view = resolveMotiontestView(SERVICES, null)

    expect(view.prototypeServices).toEqual([
      { name: 'Damklippning', priceCents: 39900, provenance: 'prototype' },
      { name: 'Dam student', priceCents: 34900, provenance: 'prototype' },
      { name: 'Dam pensionär', priceCents: 32900, provenance: 'prototype' },
    ])
    for (const service of view.prototypeServices) {
      expect(service).not.toHaveProperty('id')
      expect(service).not.toHaveProperty('service')
      expect(service).not.toHaveProperty('bookingUrl')
    }
  })

  it('marks the second salon as a non-bookable prototype location', () => {
    const view = resolveMotiontestView(SERVICES, {
      name: 'FreshCut',
      address: 'Bokhållaregatan 2, 582 24 Linköping',
      hours: null,
    })

    expect(view.locations).toEqual([
      {
        name: 'FreshCut',
        address: 'Bokhållaregatan 2, 582 24 Linköping',
        provenance: 'verified',
        bookable: true,
      },
      {
        name: 'FreshCut Sankt Larsgatan',
        address: 'Sankt Larsgatan 17, Linköping',
        provenance: 'prototype',
        bookable: false,
      },
    ])
  })
})
