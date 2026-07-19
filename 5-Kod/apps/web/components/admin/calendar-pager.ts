export type CalendarDaySlideIndex = 0 | 1 | 2

/** Närmaste av exakt tre fullbreddsslides. Vid ogiltig bredd stannar mittendagen,
 * vilket är det enda säkra utfallet under en tillfällig resize till noll. */
export function nearestDaySlide(scrollLeft: number, clientWidth: number): CalendarDaySlideIndex {
  if (!Number.isFinite(clientWidth) || clientWidth <= 0) return 1
  return Math.max(0, Math.min(2, Math.round(scrollLeft / clientWidth))) as CalendarDaySlideIndex
}

export function visibleMinuteAtScrollTop(
  dayStart: number,
  scrollTop: number,
  pixelsPerMinute: number,
): number {
  if (pixelsPerMinute <= 0) return dayStart
  return dayStart + Math.max(0, scrollTop) / pixelsPerMinute
}

export function scrollTopForVisibleMinute(
  dayStart: number,
  visibleMinute: number,
  pixelsPerMinute: number,
): number {
  return Math.max(0, (visibleMinute - dayStart) * pixelsPerMinute)
}
