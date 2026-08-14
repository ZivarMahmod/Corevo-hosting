const LIVE_FRESHCUT_ORIGIN = 'https://freshcut.corevo.se'

export function resolveLiveFreshCutOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  let target: URL
  try {
    target = new URL(value)
  } catch {
    throw new Error(`LIVE_FRESHCUT_BASE_URL must be the exact ${LIVE_FRESHCUT_ORIGIN} origin.`)
  }

  if (value !== LIVE_FRESHCUT_ORIGIN || target.origin !== LIVE_FRESHCUT_ORIGIN) {
    throw new Error(`LIVE_FRESHCUT_BASE_URL must be the exact ${LIVE_FRESHCUT_ORIGIN} origin.`)
  }
  return LIVE_FRESHCUT_ORIGIN
}
