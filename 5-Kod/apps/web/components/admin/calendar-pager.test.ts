import { describe, expect, it } from 'vitest'
import { nearestDaySlide } from './calendar-pager'

describe('native tredagars-pager', () => {
  it('låter båda dagarna vara synliga tills bladet passerar sin mittpunkt', () => {
    expect(nearestDaySlide(0, 393)).toBe(0)
    expect(nearestDaySlide(393, 393)).toBe(1)
    expect(nearestDaySlide(393 + 196, 393)).toBe(1)
    expect(nearestDaySlide(393 + 197, 393)).toBe(2)
    expect(nearestDaySlide(786, 393)).toBe(2)
  })

  it('klampar trasiga eller överskjutna scrollvärden till tre verkliga slides', () => {
    expect(nearestDaySlide(-40, 393)).toBe(0)
    expect(nearestDaySlide(1_500, 393)).toBe(2)
    expect(nearestDaySlide(200, 0)).toBe(1)
  })
})
