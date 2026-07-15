import { describe, it, expect } from 'vitest'
import { isoWeekNumber } from './dates'

describe('isoWeekNumber', () => {
  it('räknar mitt i året', () => {
    expect(isoWeekNumber('2026-07-15')).toBe(29) // designens exempel: onsdag v.29
  })
  it('nyårsvecka som tillhör föregående år', () => {
    expect(isoWeekNumber('2016-01-01')).toBe(53) // fredag → v.53 av 2015
    expect(isoWeekNumber('2016-01-04')).toBe(1) // första måndagen → v.1
  })
  it('sista dagarna som tillhör nästa års v.1', () => {
    expect(isoWeekNumber('2024-12-30')).toBe(1) // måndag → v.1 av 2025
  })
  it('torsdagen 4 jan ligger alltid i v.1', () => {
    expect(isoWeekNumber('2021-01-04')).toBe(1)
  })
})
