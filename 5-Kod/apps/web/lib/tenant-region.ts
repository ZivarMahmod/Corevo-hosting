export type TenantRegion = {
  countryCode: string
  locale: string
  currency: string
  defaultTimeZone: string
}

export const DEFAULT_TENANT_REGION: TenantRegion = {
  countryCode: 'SE',
  locale: 'sv-SE',
  currency: 'SEK',
  defaultTimeZone: 'Europe/Stockholm',
}

export function formatTenantMoney(
  amountCents: number,
  region: Pick<TenantRegion, 'locale' | 'currency'> = DEFAULT_TENANT_REGION,
): string {
  return new Intl.NumberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}
