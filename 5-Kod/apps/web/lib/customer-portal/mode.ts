export const CUSTOMER_PORTAL_MODES = [
  'off',
  'legacy_account',
  'passwordless_tenant',
  'global_account',
] as const

export type CustomerPortalMode = (typeof CUSTOMER_PORTAL_MODES)[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isCustomerPortalMode(value: unknown): value is CustomerPortalMode {
  return typeof value === 'string' && CUSTOMER_PORTAL_MODES.some((mode) => mode === value)
}

export function readCustomerPortalMode(settings: unknown): CustomerPortalMode | null {
  if (!isRecord(settings) || !isRecord(settings.customer_portal)) return null
  const mode = settings.customer_portal.mode
  return isCustomerPortalMode(mode) ? mode : null
}

export function resolveCustomerPortalCapabilities(settings: unknown) {
  const mode = readCustomerPortalMode(settings)

  switch (mode) {
    case 'legacy_account':
      return { mode, legacyAccount: true, passwordless: false } as const
    case 'passwordless_tenant':
      return { mode, legacyAccount: false, passwordless: true } as const
    case 'off':
    case 'global_account':
      return { mode, legacyAccount: false, passwordless: false } as const
    default:
      return { mode: null, legacyAccount: false, passwordless: false } as const
  }
}

export type LegacyPortalModeDecision =
  | { ok: true; nextMode: 'off' | 'legacy_account' | null }
  | { ok: false }

export function resolveLegacyPortalModeChange(
  currentMode: CustomerPortalMode | null,
  legacyAccountRequested: boolean,
): LegacyPortalModeDecision {
  if (currentMode === 'off' || currentMode === 'legacy_account') {
    return { ok: true, nextMode: legacyAccountRequested ? 'legacy_account' : 'off' }
  }
  return legacyAccountRequested ? { ok: false } : { ok: true, nextMode: null }
}
