import { describe, expect, it } from 'vitest'
import {
  TOUCH_DRAG_HOLD_MS,
  TOUCH_DRAG_SLOP_PX,
  dragGhostPosition,
  edgeAutoScrollVelocity,
  touchDragIntent,
} from './calendar-gestures'

describe('mobil bokningsgest', () => {
  it('låser drag först efter 500 ms och lämnar tidig 10 px-rörelse till scroll', () => {
    expect(TOUCH_DRAG_HOLD_MS).toBe(500)
    expect(TOUCH_DRAG_SLOP_PX).toBe(10)
    expect(touchDragIntent(499, 0)).toBe('pressing')
    expect(touchDragIntent(200, 9.9)).toBe('pressing')
    expect(touchDragIntent(200, 10.1)).toBe('scroll')
    expect(touchDragIntent(500, 9.9)).toBe('lifted')
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
