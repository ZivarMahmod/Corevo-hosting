import type { Service, TenantLocation } from '@/lib/tenant-data'

export type MotiontestProvenance = 'verified' | 'prototype'

export type MotiontestVerifiedService = {
  provenance: 'verified'
  service: Service
}

export type MotiontestPrototypeService = {
  name: string
  priceCents: number
  provenance: 'prototype'
}

export type MotiontestLocation = {
  name: string
  address: string | null
  provenance: MotiontestProvenance
  bookable: boolean
}

export type MotiontestView = {
  verifiedServices: MotiontestVerifiedService[]
  prototypeServices: MotiontestPrototypeService[]
  locations: MotiontestLocation[]
}

const PROTOTYPE_SERVICES: readonly MotiontestPrototypeService[] = [
  { name: 'Damklippning', priceCents: 39900, provenance: 'prototype' },
  { name: 'Dam student', priceCents: 34900, provenance: 'prototype' },
  { name: 'Dam pensionär', priceCents: 32900, provenance: 'prototype' },
]

const PROTOTYPE_LOCATION: MotiontestLocation = {
  name: 'FreshCut Sankt Larsgatan',
  address: 'Sankt Larsgatan 17, Linköping',
  provenance: 'prototype',
  bookable: false,
}

/**
 * The single overlay between live storefront rows and motiontest-only content.
 * Verified services are wrapped, never copied into a second service model.
 */
export function resolveMotiontestView(
  services: Service[],
  location: TenantLocation | null,
): MotiontestView {
  return {
    verifiedServices: services.map((service) => ({ provenance: 'verified', service })),
    prototypeServices: PROTOTYPE_SERVICES.map((service) => ({ ...service })),
    locations: [
      {
        name: location?.name?.trim() || 'FreshCut Bokhållaregatan',
        address: location?.address?.trim() || null,
        provenance: 'verified',
        bookable: location !== null,
      },
      { ...PROTOTYPE_LOCATION },
    ],
  }
}
