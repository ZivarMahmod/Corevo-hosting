const MAX_PARTNER_PRICE_ORE = 100_000_000

/** Parse a root-entered major-unit amount into the integer minor unit stored in DB. */
export function parsePartnerPriceOre(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const ore = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(ore) || ore < 0 || ore > MAX_PARTNER_PRICE_ORE) return null
  return ore
}

export function formatPartnerMoney(
  minorUnits: number,
  currency: string,
  locale = 'sv-SE',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100)
}

export function partnerPriceInputValue(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2)
}
