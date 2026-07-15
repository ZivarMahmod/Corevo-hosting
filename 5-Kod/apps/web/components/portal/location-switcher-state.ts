import { PLATS_ALLA } from '@/lib/admin/plats-constants'

/** URL-filtret är sidans uttryckliga val och vinner över den globala cookie-fallbacken. */
export function effectiveLocationValue(
  urlValue: string | null,
  cookieValue: string,
  validLocationIds: readonly string[],
): string {
  if (urlValue === PLATS_ALLA) return ''
  if (urlValue && validLocationIds.includes(urlValue)) return urlValue
  if (cookieValue === PLATS_ALLA) return ''
  return validLocationIds.includes(cookieValue) ? cookieValue : ''
}

/** Behåller sidans övriga filter men gör det nya globala platsvalet explicit i URL:en. */
export function locationSelectionTarget(
  pathname: string,
  currentSearch: string,
  nextValue: string,
): string {
  const params = new URLSearchParams(currentSearch)
  params.set('plats', nextValue || PLATS_ALLA)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
