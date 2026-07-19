/** Mobilchromets kontextknappar pratar med kalendern utan att portalskalet
 * behöver känna till kalenderns interna state. */
export const MOBILE_SEARCH_EVENT = 'corevo:mobile-search'
export const MOBILE_HELP_EVENT = 'corevo:mobile-help'
export const MOBILE_CALENDAR_SHIFT_EVENT = 'corevo:mobile-calendar-shift'
export const MOBILE_CALENDAR_META_EVENT = 'corevo:mobile-calendar-meta'
export const MOBILE_CALENDAR_META_REQUEST_EVENT = 'corevo:mobile-calendar-meta-request'
export const MOBILE_CALENDAR_DATE_EVENT = 'corevo:mobile-calendar-date'

export type MobileCalendarMeta = {
  title: string
  meta: string
  previous: string
  next: string
  step: 'day' | 'week' | 'month'
}
