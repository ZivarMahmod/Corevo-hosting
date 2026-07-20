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
  // Schemasidans staff-id hör till den gamla platsen. När platsen byts måste
  // översikten välja en person ur den nya, platsfiltrerade listan i stället för
  // att 404:a eller öppna fel person.
  if (pathname.startsWith('/admin/scheman')) params.delete('staff')
  params.set('plats', nextValue || PLATS_ALLA)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
