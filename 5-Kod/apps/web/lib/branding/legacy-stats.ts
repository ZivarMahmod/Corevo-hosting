const LEGACY_SNITT_STATS = [
  ['5,0★', 'Snittbetyg'],
  ['Tre', 'Stolar'],
  ['75 min', 'Snitt per besök'],
] as const

type BrandingWithStats = { stats?: unknown }

function isExactLegacySnittStats(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== LEGACY_SNITT_STATS.length) return false
  return LEGACY_SNITT_STATS.every(([expectedValue, expectedLabel], index) => {
    const row = value[index]
    return Array.isArray(row)
      && row.length === 2
      && row[0] === expectedValue
      && row[1] === expectedLabel
  })
}

/**
 * A former Snitt template default was persisted as if it were tenant-owned
 * facts. Remove only that exact, ordered triple and only for Snitt. Any real
 * customer-created stats — including partial or edited rows — pass untouched.
 */
export function withoutLegacySnittStats<T extends BrandingWithStats>(theme: string, branding: T): T {
  return theme === 'snitt' && isExactLegacySnittStats(branding.stats)
    ? { ...branding, stats: [] }
    : branding
}
