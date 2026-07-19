/** Mobilens avsiktströsklar är gemensamma för iPhone och Android. Webbläsaren får
 * vinna scroll/zoom före dessa trösklar; först ett stationärt långtryck lyfter kortet. */
export const TOUCH_DRAG_HOLD_MS = 300
export const TOUCH_DRAG_SLOP_PX = 10
export const EDGE_AUTO_SCROLL_ZONE_PX = 56
export const EDGE_AUTO_SCROLL_MAX_PX_PER_SECOND = 600

export type TouchDragIntent = 'pressing' | 'scroll' | 'lifted'

export function touchDragIntent(elapsedMs: number, distancePx: number): TouchDragIntent {
  if (distancePx > TOUCH_DRAG_SLOP_PX) return 'scroll'
  if (elapsedMs >= TOUCH_DRAG_HOLD_MS) return 'lifted'
  return 'pressing'
}

/** Ghostens övre vänstra hörn. Greppunkten bevaras så kortet aldrig hoppar till
 * fingercentrum när långtrycket övergår från pressing till lifted. */
export function dragGhostPosition(
  clientX: number,
  clientY: number,
  grabOffsetX: number,
  grabOffsetY: number,
): { left: number; top: number } {
  return { left: clientX - grabOffsetX, top: clientY - grabOffsetY }
}

/** Kvadratisk kantacceleration: lugn nära nollzonen, snabbast precis vid/utanför
 * kanten. Negativt värde scrollar upp, positivt ned. */
export function edgeAutoScrollVelocity(pointerY: number, top: number, bottom: number): number {
  if (pointerY < top + EDGE_AUTO_SCROLL_ZONE_PX) {
    const strength = Math.min(
      1,
      Math.max(0, (top + EDGE_AUTO_SCROLL_ZONE_PX - pointerY) / EDGE_AUTO_SCROLL_ZONE_PX),
    )
    return -EDGE_AUTO_SCROLL_MAX_PX_PER_SECOND * strength * strength
  }
  if (pointerY > bottom - EDGE_AUTO_SCROLL_ZONE_PX) {
    const strength = Math.min(
      1,
      Math.max(0, (pointerY - (bottom - EDGE_AUTO_SCROLL_ZONE_PX)) / EDGE_AUTO_SCROLL_ZONE_PX),
    )
    return EDGE_AUTO_SCROLL_MAX_PX_PER_SECOND * strength * strength
  }
  return 0
}
