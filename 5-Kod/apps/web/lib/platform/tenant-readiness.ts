import type { Database } from '@corevo/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'

export const READINESS_LABELS = {
  tenant_settings: 'Grundinställningar saknas',
  primary_location: 'En aktiv primär plats saknas',
  owner: 'En aktiv ägare saknas',
  canonical_host: 'Den kanoniska adressen är ogiltig',
  bookable_service: 'En bokningsbar tjänst saknas',
  bookable_staff: 'Bokningsbar personal saknas',
  service_assignment: 'Personal behöver kopplas till en tjänst',
  working_hours: 'Arbetstid för bokningsbar personal saknas',
  confirmed_opening_hours: 'Platsens öppettider behöver bekräftas',
  readiness_unavailable: 'Readiness kunde inte kontrolleras',
} as const

export type TenantReadinessKey = keyof typeof READINESS_LABELS

export type TenantLaunchReadiness = {
  ready: boolean
  bookingRequired: boolean
  canonicalHost: string | null
  tenantStatus: string
  missing: TenantReadinessKey[]
  moduleReadiness: TenantModuleReadiness
}

export type ModuleReadiness = {
  state: ModuleState
  missing: string[]
  publicReadable: boolean
  publicActionAllowed: boolean
}

export type TenantModuleReadiness = {
  ready: boolean
  tenantStatus: string
  modules: Record<string, ModuleReadiness>
}

const KNOWN_KEYS = new Set<TenantReadinessKey>(
  Object.keys(READINESS_LABELS) as TenantReadinessKey[],
)

export function unavailableTenantLaunchReadiness(): TenantLaunchReadiness {
  return {
    ready: false,
    bookingRequired: false,
    canonicalHost: null,
    tenantStatus: 'unknown',
    missing: ['readiness_unavailable'],
    moduleReadiness: unavailableTenantModuleReadiness(),
  }
}

export function unavailableTenantModuleReadiness(): TenantModuleReadiness {
  return { ready: false, tenantStatus: 'unknown', modules: {} }
}

export function parseTenantModuleReadiness(
  value: unknown,
): TenantModuleReadiness {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return unavailableTenantModuleReadiness()
  }
  const raw = value as Record<string, unknown>
  if (
    typeof raw.ready !== 'boolean' ||
    typeof raw.tenant_status !== 'string' ||
    !raw.tenant_status ||
    !raw.modules ||
    typeof raw.modules !== 'object' ||
    Array.isArray(raw.modules)
  ) {
    return unavailableTenantModuleReadiness()
  }

  const modules: Record<string, ModuleReadiness> = {}
  for (const [key, value] of Object.entries(
    raw.modules as Record<string, unknown>,
  )) {
    if (!key || !value || typeof value !== 'object' || Array.isArray(value)) {
      return unavailableTenantModuleReadiness()
    }
    const row = value as Record<string, unknown>
    if (
      !(MODULE_STATES as readonly unknown[]).includes(row.state) ||
      !Array.isArray(row.missing) ||
      !row.missing.every((item) => typeof item === 'string') ||
      typeof row.public_readable !== 'boolean' ||
      typeof row.public_action_allowed !== 'boolean'
    ) {
      return unavailableTenantModuleReadiness()
    }
    modules[key] = {
      state: row.state as ModuleState,
      missing: row.missing,
      publicReadable: row.public_readable,
      publicActionAllowed: row.public_action_allowed,
    }
  }

  return {
    ready:
      raw.ready &&
      Object.values(modules).every(
        (module) =>
          module.state !== 'live' ||
          (module.missing.length === 0 && module.publicActionAllowed),
      ),
    tenantStatus: raw.tenant_status,
    modules,
  }
}

export function parseTenantLaunchReadiness(value: unknown): TenantLaunchReadiness {
  if (!value || typeof value !== 'object') return unavailableTenantLaunchReadiness()
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.missing)) return unavailableTenantLaunchReadiness()

  const missing: TenantReadinessKey[] = []
  for (const item of raw.missing) {
    if (typeof item !== 'string' || !KNOWN_KEYS.has(item as TenantReadinessKey)) {
      return unavailableTenantLaunchReadiness()
    }
    missing.push(item as TenantReadinessKey)
  }

  return {
    ready: raw.ready === true && missing.length === 0,
    bookingRequired: raw.booking_required === true,
    canonicalHost:
      typeof raw.canonical_host === 'string' && raw.canonical_host.trim()
        ? raw.canonical_host.trim().toLowerCase()
        : null,
    tenantStatus:
      typeof raw.tenant_status === 'string' && raw.tenant_status
        ? raw.tenant_status
        : 'unknown',
    missing,
    moduleReadiness: unavailableTenantModuleReadiness(),
  }
}

/** Read the DB-owned readiness fail-closed; UI never derives its own green state. */
export async function readTenantLaunchReadiness(
  client: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantLaunchReadiness> {
  const [launch, modules] = await Promise.all([
    client.rpc('tenant_launch_readiness', { p_tenant: tenantId }),
    client.rpc('tenant_module_readiness', { p_tenant: tenantId }),
  ])
  if (launch.error) return unavailableTenantLaunchReadiness()
  return {
    ...parseTenantLaunchReadiness(launch.data),
    moduleReadiness: modules.error
      ? unavailableTenantModuleReadiness()
      : parseTenantModuleReadiness(modules.data),
  }
}
