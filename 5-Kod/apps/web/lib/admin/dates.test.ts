import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { isoWeekNumber, todayInTz } from './dates'

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
