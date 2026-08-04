export type TenantRegion = {
  countryCode: string
  locale: string
  currency: string
  defaultTimeZone: string
}

export type TenantLegal = { orgNr: string | null; vatRate: number | null }

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

export function parseTenantMoneyInput(raw: string): number | null {
  const value = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!value) return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null
}

export function tenantMoneyInputValue(amountCents: number | null | undefined): string {
  return amountCents == null ? '' : String(amountCents / 100)
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function parseTenantLegal(settings: unknown): TenantLegal {
  const legal = record(record(settings).legal)
  const orgNr = typeof legal.org_nr === 'string' && legal.org_nr.trim()
    ? legal.org_nr.trim()
    : null
  const rawVatRate = typeof legal.vat_rate === 'string' ? legal.vat_rate.trim() : legal.vat_rate
  const vatRate = typeof rawVatRate === 'number'
    ? rawVatRate
    : typeof rawVatRate === 'string' && rawVatRate
      ? Number(rawVatRate)
      : Number.NaN
  return {
    orgNr,
    vatRate: Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100 ? vatRate : null,
  }
}

export function parseTenantLegalInput(orgNrInput: unknown, vatRateInput: unknown): TenantLegal | null {
  const orgNr = String(orgNrInput ?? '').trim().slice(0, 40) || null
  const rawVatRate = String(vatRateInput ?? '').trim().replace(',', '.')
  if (!rawVatRate) return { orgNr, vatRate: null }
  const vatRate = Number(rawVatRate)
  return Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100
    ? { orgNr, vatRate }
    : null
}
