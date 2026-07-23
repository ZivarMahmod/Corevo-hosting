import { describe, expect, it } from 'vitest'
import {
  READINESS_LABELS,
  parseTenantLaunchReadiness,
  unavailableTenantLaunchReadiness,
} from './tenant-readiness'

describe('tenant launch readiness presentation', () => {
  it('parses the DB response without inventing readiness', () => {
    expect(
      parseTenantLaunchReadiness({
        ready: false,
        booking_required: true,
        canonical_host: 'freshcut.boka.corevo.se',
        tenant_status: 'provisioning',
        missing: ['owner', 'working_hours'],
      }),
    ).toEqual({
      ready: false,
      bookingRequired: true,
      canonicalHost: 'freshcut.boka.corevo.se',
      tenantStatus: 'provisioning',
      missing: ['owner', 'working_hours'],
    })
  })

  it('fails closed when the DB payload is malformed', () => {
    expect(parseTenantLaunchReadiness({ ready: true, missing: 'nope' })).toEqual(
      unavailableTenantLaunchReadiness(),
    )
    expect(parseTenantLaunchReadiness(null).ready).toBe(false)
  })

  it('has concrete Swedish copy for every stable DB key', () => {
    for (const key of [
      'tenant_settings',
      'primary_location',
      'owner',
      'canonical_host',
      'bookable_service',
      'bookable_staff',
      'service_assignment',
      'working_hours',
      'confirmed_opening_hours',
      'readiness_unavailable',
    ] as const) {
      expect(READINESS_LABELS[key]).toBeTruthy()
    }
  })
})
