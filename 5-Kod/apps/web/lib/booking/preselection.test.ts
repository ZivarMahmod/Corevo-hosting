import { describe, expect, it } from 'vitest'
import {
  buildTenantBookingPath,
  resolveBookingSearchParams,
  resolveBookingQueryPreselection,
  resolveLocationSelection,
} from './preselection'

const LOCATION_A = '11111111-1111-4111-8111-111111111111'
const LOCATION_B = '22222222-2222-4222-8222-222222222222'
const SERVICE_GLOBAL = '33333333-3333-4333-8333-333333333333'
const SERVICE_A = '44444444-4444-4444-8444-444444444444'
const SERVICE_B = '55555555-5555-4555-8555-555555555555'

const locations = [{ id: LOCATION_A }, { id: LOCATION_B }]
const services = [
  { id: SERVICE_GLOBAL, locationId: null },
  { id: SERVICE_A, locationId: LOCATION_A },
  { id: SERVICE_B, locationId: LOCATION_B },
]

describe('resolveBookingQueryPreselection', () => {
  it('accepts an active same-tenant location and a compatible active service', () => {
    expect(resolveBookingQueryPreselection({
      rawLocationId: LOCATION_A,
      rawServiceId: SERVICE_A,
      locations,
      services,
    })).toEqual({ locationId: LOCATION_A, serviceId: SERVICE_A })
  })

  it('omits missing, inactive or cross-tenant ids against the loaded tenant data', () => {
    expect(resolveBookingQueryPreselection({
      rawLocationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      rawServiceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      locations,
      services,
    })).toEqual({ locationId: null, serviceId: null })
  })

  it('omits an incompatible service but keeps the valid location', () => {
    expect(resolveBookingQueryPreselection({
      rawLocationId: LOCATION_A,
      rawServiceId: SERVICE_B,
      locations,
      services,
    })).toEqual({ locationId: LOCATION_A, serviceId: null })
  })

  it('keeps a valid service when a multi-location link has no usable location', () => {
    expect(resolveBookingQueryPreselection({
      rawLocationId: null,
      rawServiceId: SERVICE_GLOBAL,
      locations,
      services,
    })).toEqual({ locationId: null, serviceId: SERVICE_GLOBAL })
  })

  it('validates a service against the implicit location for a one-location tenant', () => {
    expect(resolveBookingQueryPreselection({
      rawLocationId: null,
      rawServiceId: SERVICE_B,
      locations: [{ id: LOCATION_A }],
      services,
    })).toEqual({ locationId: null, serviceId: null })
  })
})

describe('resolveBookingSearchParams', () => {
  it('reads canonical plats/tjanst and accepts location/service compatibility aliases', () => {
    expect(resolveBookingSearchParams({
      searchParams: { plats: LOCATION_A, tjanst: SERVICE_A },
      locations,
      services,
    })).toEqual({ locationId: LOCATION_A, serviceId: SERVICE_A })
    expect(resolveBookingSearchParams({
      searchParams: { location: LOCATION_B, service: SERVICE_B },
      locations,
      services,
    })).toEqual({ locationId: LOCATION_B, serviceId: SERVICE_B })
  })

  it('gives canonical keys precedence and rejects array/duplicate-shaped values', () => {
    expect(resolveBookingSearchParams({
      searchParams: {
        plats: ['bad', LOCATION_A],
        location: LOCATION_A,
        tjanst: ['bad', SERVICE_A],
        service: SERVICE_A,
      },
      locations,
      services,
    })).toEqual({ locationId: null, serviceId: null })
  })
})

describe('buildTenantBookingPath', () => {
  it('builds the canonical same-tenant path in stable plats/tjanst order', () => {
    expect(buildTenantBookingPath({ locationId: LOCATION_A, serviceId: SERVICE_A }))
      .toBe(`/boka?plats=${LOCATION_A}&tjanst=${SERVICE_A}`)
  })

  it('omits each invalid context value independently and never accepts a free href', () => {
    expect(buildTenantBookingPath({ locationId: 'evil', serviceId: SERVICE_GLOBAL }))
      .toBe(`/boka?tjanst=${SERVICE_GLOBAL}`)
    expect(buildTenantBookingPath({ locationId: LOCATION_A, serviceId: 'javascript:alert(1)' }))
      .toBe(`/boka?plats=${LOCATION_A}`)
    expect(buildTenantBookingPath({ locationId: null, serviceId: null })).toBe('/boka')
  })
})

describe('resolveLocationSelection', () => {
  it('keeps a compatible deep-linked service and advances to staff', () => {
    expect(resolveLocationSelection({
      services,
      currentService: services[0]!,
      locationId: LOCATION_B,
      compact: false,
    })).toEqual({ service: services[0], step: 2 })
  })

  it('clears an incompatible service and returns the wizard to step one', () => {
    expect(resolveLocationSelection({
      services,
      currentService: services[1]!,
      locationId: LOCATION_B,
      compact: false,
    })).toEqual({ service: null, step: 1 })
  })

  it('chooses the first compatible service in compact mode', () => {
    expect(resolveLocationSelection({
      services,
      currentService: services[1]!,
      locationId: LOCATION_B,
      compact: true,
    })).toEqual({ service: services[0], step: 1 })
  })
})
