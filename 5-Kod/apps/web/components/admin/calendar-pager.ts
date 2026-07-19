export type CalendarDaySlideIndex = 0 | 1 | 2

/** Närmaste av exakt tre fullbreddsslides. Vid ogiltig bredd stannar mittendagen,
 * vilket är det enda säkra utfallet under en tillfällig resize till noll. */
export function nearestDaySlide(scrollLeft: number, clientWidth: number): CalendarDaySlideIndex {
  if (!Number.isFinite(clientWidth) || clientWidth <= 0) return 1
  return Math.max(0, Math.min(2, Math.round(scrollLeft / clientWidth))) as CalendarDaySlideIndex
}
