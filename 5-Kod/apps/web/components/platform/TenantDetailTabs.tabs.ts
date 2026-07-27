import type { TenantTabKey } from './TenantDetailTabs'

const slugs: Record<TenantTabKey, string> = {
  Översikt: 'oversikt', Tjänster: 'tjanster', Kunder: 'kunder', Personal: 'personal',
  Kurser: 'kurser', Klubben: 'klubben', Webshop: 'webshop', Blogg: 'blogg',
  Offerter: 'offerter', Meddelanden: 'meddelanden', Bildbibliotek: 'bildbibliotek',
  Sida: 'sida', Integrationer: 'integrationer', Drift: 'drift',
}

export const tenantTabSlug = (key: TenantTabKey) => slugs[key]

export function resolveTenantTabKey(
  available: readonly TenantTabKey[],
  requested: string | null | undefined,
): TenantTabKey {
  return available.find((key) => slugs[key] === requested?.toLowerCase()) ?? 'Översikt'
}

export function tenantTabHref(pathname: string, key: TenantTabKey, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch)
  params.set('kundflik', tenantTabSlug(key))
  return `${pathname}?${params.toString()}`
}
