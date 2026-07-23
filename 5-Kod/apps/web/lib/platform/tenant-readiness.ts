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
  }
}

type ReadinessRpcClient = {
  rpc: (
    name: string,
    args: { p_tenant: string },
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

/** Read the DB-owned readiness fail-closed; UI never derives its own green state. */
export async function readTenantLaunchReadiness(
  client: unknown,
  tenantId: string,
): Promise<TenantLaunchReadiness> {
  const candidate = client as Partial<ReadinessRpcClient>
  if (typeof candidate.rpc !== 'function') return unavailableTenantLaunchReadiness()
  const { data, error } = await candidate.rpc('tenant_launch_readiness', {
    p_tenant: tenantId,
  })
  if (error) return unavailableTenantLaunchReadiness()
  return parseTenantLaunchReadiness(data)
}
