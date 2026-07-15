import { describe, it, expect } from 'vitest'
import {
  greetingFor,
  parseHM,
  hourInTz,
  laneBlock,
  occupancyPct,
  comparisonPct,
  countdownMinutes,
  hmToMinutes,
  sumMergedMinutes,
} from './dashboard-view'

describe('greetingFor', () => {
  it('byter vid 10 och 17', () => {
    expect(greetingFor(6)).toBe('God morgon')
    expect(greetingFor(9.99)).toBe('God morgon')
    expect(greetingFor(10)).toBe('God dag')
    expect(greetingFor(16.9)).toBe('God dag')
    expect(greetingFor(17)).toBe('God kväll')
    expect(greetingFor(23)).toBe('God kväll')
  })
})

describe('parseHM', () => {
  it('tolkar HH:MM och HH:MM:SS', () => {
    expect(parseHM('09:30')).toBe(9.5)
    expect(parseHM('18:00:00')).toBe(18)
    expect(parseHM('00:15')).toBe(0.25)
  })
  it('skräp → 0', () => {
    expect(parseHM('')).toBe(0)
    expect(parseHM('x:y')).toBe(0)
  })
})

describe('hourInTz', () => {
  it('konverterar UTC till lokal timme', () => {
    // 2026-07-15T07:30:00Z = 09:30 i Stockholm (sommartid, +2)
    expect(hourInTz('2026-07-15T07:30:00Z', 'Europe/Stockholm')).toBeCloseTo(9.5, 5)
  })
})

describe('laneBlock', () => {
  it('positionerar ett block i mitten', () => {
    const { left, width } = laneBlock(12, 13, 9, 18) // 9h fönster
    expect(left).toBeCloseTo((3 / 9) * 100, 4)
    expect(width).toBeCloseTo((1 / 9) * 100, 4)
  })
  it('klampar block som börjar före fönstret', () => {
    const { left, width } = laneBlock(8, 10, 9, 18)
    expect(left).toBe(0)
    expect(width).toBeCloseTo((1 / 9) * 100, 4)
  })
  it('klampar block som slutar efter fönstret', () => {
    const { width } = laneBlock(17, 20, 9, 18)
    expect(width).toBeCloseTo((1 / 9) * 100, 4)
  })
  it('helt utanför fönstret → width 0', () => {
    expect(laneBlock(19, 20, 9, 18).width).toBe(0)
  })
  it('midnattsövergång (endH rullat till 0) klampas till dagsslut', () => {
    const { width } = laneBlock(23, 0.5, 9, 24)
    expect(width).toBeGreaterThan(0)
    expect(width).toBeCloseTo((1 / 15) * 100, 4) // 23→24 i ett 15h-fönster
  })
  it('nollängd (start === slut) → width 0, inte en falsk midnatt', () => {
    expect(laneBlock(12, 12, 9, 18).width).toBe(0)
  })
})

describe('occupancyPct', () => {
  it('bokade/arbetsminuter', () => {
    expect(occupancyPct(270, 540)).toBe(50)
    expect(occupancyPct(540, 540)).toBe(100)
  })
  it('tak 100 även vid överbook', () => {
    expect(occupancyPct(600, 540)).toBe(100)
  })
  it('ingen arbetstid → 0 (ingen division med noll)', () => {
    expect(occupancyPct(120, 0)).toBe(0)
  })
})

describe('comparisonPct', () => {
  it('räknar förändring', () => {
    expect(comparisonPct(112, 100)).toBe(12)
    expect(comparisonPct(80, 100)).toBe(-20)
  })
  it('inget underlag → null (döljer chipet)', () => {
    expect(comparisonPct(500, 0)).toBeNull()
  })
})

describe('countdownMinutes', () => {
  it('minuter kvar', () => {
    expect(countdownMinutes(0, 18 * 60000)).toBe(18)
  })
  it('aldrig negativt', () => {
    expect(countdownMinutes(10 * 60000, 0)).toBe(0)
  })
})

describe('hmToMinutes', () => {
  it('minuter sedan midnatt', () => {
    expect(hmToMinutes('09:00')).toBe(540)
    expect(hmToMinutes('18:30:00')).toBe(1110)
  })
})

describe('sumMergedMinutes', () => {
  it('ett pass', () => {
    expect(sumMergedMinutes([[540, 1080]])).toBe(540) // 09–18
  })
  it('två skilda pass summeras', () => {
    expect(sumMergedMinutes([[540, 720], [900, 1080]])).toBe(360) // 09–12 + 15–18
  })
  it('överlappande pass dubbelräknas INTE', () => {
    expect(sumMergedMinutes([[540, 780], [720, 900]])).toBe(360) // 09–13 + 12–15 = 09–15
  })
  it('osorterad input hanteras', () => {
    expect(sumMergedMinutes([[900, 1080], [540, 720]])).toBe(360)
  })
  it('tomt → 0', () => {
    expect(sumMergedMinutes([])).toBe(0)
  })
})
