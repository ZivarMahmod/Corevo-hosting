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

export type MotiontestPrototypeSceneCopy = {
  eyebrow: string
  title: string
  body?: string
}

export type MotiontestPrototypeCopy = {
  provenance: 'prototype'
  scenes: {
    entrance: MotiontestPrototypeSceneCopy
    chair: MotiontestPrototypeSceneCopy
    craft: MotiontestPrototypeSceneCopy
    range: MotiontestPrototypeSceneCopy
    return: MotiontestPrototypeSceneCopy
    mirror: MotiontestPrototypeSceneCopy
  }
  rangeLabels: string[]
  resultLabels: string[]
}

export type MotiontestView = {
  verifiedServices: MotiontestVerifiedService[]
  prototypeServices: MotiontestPrototypeService[]
  prototypeCopy: MotiontestPrototypeCopy
  locations: MotiontestLocation[]
}

const PROTOTYPE_SERVICES: readonly MotiontestPrototypeService[] = [
  { name: 'Damklippning · prototyp', priceCents: 39900, provenance: 'prototype' },
  { name: 'Dam student · prototyp', priceCents: 34900, provenance: 'prototype' },
  { name: 'Dam pensionär · prototyp', priceCents: 32900, provenance: 'prototype' },
]

const PROTOTYPE_LOCATION: MotiontestLocation = {
  name: 'FreshCut Sankt Larsgatan',
  address: 'Sankt Larsgatan 17, Linköping',
  provenance: 'prototype',
  bookable: false,
}

const PROTOTYPE_COPY: MotiontestPrototypeCopy = {
  provenance: 'prototype',
  scenes: {
    entrance: { eyebrow: '01 / Entrén', title: 'Kliv in.' },
    chair: {
      eyebrow: '02 / Stolen',
      title: 'Slå dig ner.',
      body: 'Stolen, capen och verktygen är redo. Här börjar arbetet.',
    },
    craft: {
      eyebrow: '03 / Hantverket',
      title: 'Händerna gör skillnaden.',
      body: 'Vi lyssnar först och klipper sedan — med sax, maskin, kam och precision.',
    },
    range: { eyebrow: '04 / Utbudet', title: 'Olika hår. Samma noggrannhet.' },
    return: { eyebrow: '05 / Formen', title: 'Tillbaka till helheten.' },
    mirror: {
      eyebrow: '06 / Spegeln',
      title: 'Resultatet är ditt.',
      body: 'Ett rent avslut, en skarp linje och en form som håller.',
    },
  },
  rangeLabels: ['Herr', 'Student', 'Barn', 'Senior', 'Skägg', 'Dam · preliminärt'],
  resultLabels: ['Ung', 'Barn', 'Dam · preliminärt', 'Senior', 'Skägg'],
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
    prototypeCopy: {
      ...PROTOTYPE_COPY,
      scenes: {
        entrance: { ...PROTOTYPE_COPY.scenes.entrance },
        chair: { ...PROTOTYPE_COPY.scenes.chair },
        craft: { ...PROTOTYPE_COPY.scenes.craft },
        range: { ...PROTOTYPE_COPY.scenes.range },
        return: { ...PROTOTYPE_COPY.scenes.return },
        mirror: { ...PROTOTYPE_COPY.scenes.mirror },
      },
      rangeLabels: [...PROTOTYPE_COPY.rangeLabels],
      resultLabels: [...PROTOTYPE_COPY.resultLabels],
    },
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
