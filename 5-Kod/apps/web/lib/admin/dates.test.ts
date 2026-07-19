import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  addDays,
  addMonths,
  calendarDayTriplet,
  dayKey,
  dayRangeUtc,
  isoWeekNumber,
  todayInTz,
} from './dates'

describe('tenant-local today', () => {
  it('uses the tenant month at a UTC month boundary', () => {
    expect(todayInTz('Europe/Stockholm', new Date('2026-01-31T23:30:00.000Z'))).toBe('2026-02-01')
  })

  it('drives the customer new-month chip without a UTC shortcut', () => {
    const page = readFileSync(
      resolve(import.meta.dirname, '../../app/(admin)/admin/kunder/[id]/page.tsx'),
      'utf8',
    )
    expect(page).toContain('todayInTz(tz).slice(0, 7)')
    expect(page).not.toContain('new Date().toISOString().slice(0, 7)')
  })
})

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

describe('kalenderns tredagarsfönster', () => {
  it('går korrekt över månads-, års- och skottårsskiften', () => {
    expect(calendarDayTriplet('2026-01-01')).toEqual(['2025-12-31', '2026-01-01', '2026-01-02'])
    expect(calendarDayTriplet('2024-02-29')).toEqual(['2024-02-28', '2024-02-29', '2024-03-01'])
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('bucketar ett UTC-instant på tenantens lokala kalenderdag', () => {
    expect(dayKey('2026-07-19T22:30:00.000Z', 'Europe/Stockholm')).toBe('2026-07-20')
  })

  it('klampar månadssteg i stället för att spilla över', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('behåller lokala dygn över både 23- och 25-timmars DST-dygn', () => {
    const spring = dayRangeUtc('2026-03-29', 'Europe/Stockholm')
    const autumn = dayRangeUtc('2026-10-25', 'Europe/Stockholm')
    expect(new Date(spring.toUtc).getTime() - new Date(spring.fromUtc).getTime()).toBe(
      23 * 60 * 60 * 1000,
    )
    expect(new Date(autumn.toUtc).getTime() - new Date(autumn.fromUtc).getTime()).toBe(
      25 * 60 * 60 * 1000,
    )
  })
})
