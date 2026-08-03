import { describe, expect, it } from 'vitest'
import {
  READINESS_LABELS,
  parseTenantModuleReadiness,
  parseTenantLaunchReadiness,
  readTenantLaunchReadiness,
  unavailableTenantModuleReadiness,
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
      moduleReadiness: unavailableTenantModuleReadiness(),
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

  it('parses the DB-owned module states and blockers', () => {
    expect(
      parseTenantModuleReadiness({
        ready: false,
        tenant_status: 'active',
        modules: {
          booking: {
            state: 'live',
            missing: ['working_hours'],
            public_readable: true,
            public_action_allowed: false,
          },
          shop: {
            state: 'live',
            missing: [],
            public_readable: true,
            public_action_allowed: false,
          },
        },
      }),
    ).toEqual({
      ready: false,
      tenantStatus: 'active',
      modules: {
        booking: {
          state: 'live',
          missing: ['working_hours'],
          publicReadable: true,
          publicActionAllowed: false,
        },
        shop: {
          state: 'live',
          missing: [],
          publicReadable: true,
          publicActionAllowed: false,
        },
      },
    })
  })

  it('fails module readiness closed on a malformed row', () => {
    expect(
      parseTenantModuleReadiness({
        ready: true,
        tenant_status: 'active',
        modules: { shop: { state: 'banana', missing: [] } },
      }),
    ).toEqual(unavailableTenantModuleReadiness())
  })

  it('reads launch and module readiness without merging their meanings', async () => {
    const rpc = async (name: string) =>
      name === 'tenant_launch_readiness'
        ? {
            data: {
              ready: true,
              booking_required: false,
              canonical_host: 'demo.corevo.se',
              tenant_status: 'provisioning',
              missing: [],
            },
            error: null,
          }
        : {
            data: {
              ready: false,
              tenant_status: 'provisioning',
              modules: {},
            },
            error: null,
          }

    await expect(
      readTenantLaunchReadiness({ rpc } as never, 'tenant-a'),
    ).resolves.toMatchObject({
      ready: true,
      moduleReadiness: {
        ready: false,
        tenantStatus: 'provisioning',
        modules: {},
      },
    })
  })
})
