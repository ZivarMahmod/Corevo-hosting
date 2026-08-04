import { describe, expect, it } from 'vitest'
import {
  TOUCH_DRAG_HOLD_MS,
  TOUCH_DRAG_SLOP_PX,
  dragGhostPosition,
  edgeAutoScrollVelocity,
} from './calendar-gestures'

describe('mobil bokningsgest', () => {
  it('låser de trösklar som CalendarBoard använder för långtryck och scroll', () => {
    expect(TOUCH_DRAG_HOLD_MS).toBe(300)
    expect(TOUCH_DRAG_SLOP_PX).toBe(10)
  })

  it('bevarar den exakta greppunkten när ghosten lyfts', () => {
    expect(dragGhostPosition(150, 220, 20, 35)).toEqual({ left: 130, top: 185 })
  })

  it('autoscrollar kvadratiskt i 56 px-kantzonen och klampar vid 600 px/s', () => {
    expect(edgeAutoScrollVelocity(300, 100, 500)).toBe(0)
    expect(edgeAutoScrollVelocity(128, 100, 500)).toBeCloseTo(-150)
    expect(edgeAutoScrollVelocity(472, 100, 500)).toBeCloseTo(150)
    expect(edgeAutoScrollVelocity(100, 100, 500)).toBe(-600)
    expect(edgeAutoScrollVelocity(500, 100, 500)).toBe(600)
    expect(edgeAutoScrollVelocity(40, 100, 500)).toBe(-600)
  })
})
