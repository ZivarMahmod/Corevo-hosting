import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('Kalender Mobil v2', () => {
  it('använder kolumnrubriken som enda personalval och låter samma klick visa alla igen', () => {
    const component = read('components/admin/CalendarBoard.tsx')

    expect(component).not.toContain('className={styles.resChips}')
    expect(component).toContain("view !== 'dag' && staff.length > 1 && (")
    expect(component).toContain('className={styles.resSelect}')
    expect(component).toContain('onStaffToggle')
    expect(component).toContain("go({ resurs: resurs === staffId ? '' : staffId })")
    expect(component).toContain('Visa alla')
  })

  it('flyttar mobilens datum, bläddring och diskreta vyval till en egen bottendocka', () => {
    const component = read('components/admin/CalendarBoard.tsx')
    const css = read('components/admin/calendar.module.css')

    expect(component).toContain('mobileCalendarDock')
    expect(component).toContain('mobileDateToggle')
    expect(component).toContain('mobileViewSwitch')
    expect(component).toContain('mobileCalendarPicker')
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.toolbar\s*\{[\s\S]*?display:\s*none;/)
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.mobileCalendarDock\s*\{[\s\S]*?display:\s*block;/,
    )
  })

  it('skriver ut vad mobilens sekundära kalenderverktyg gör', () => {
    const component = read('components/admin/CalendarBoard.tsx')
    const search = read('components/admin/CalendarSearch.tsx')

    expect(search).toContain('Sök kund')
    expect(component).toContain('Avbokade')
    expect(component).toContain('Hjälp')
    expect(component).toContain('Blockera')
  })

  it('begränsar månadsstatusen till vald månad och behåller beläggning och avbokningar', () => {
    const component = read('components/admin/CalendarBoard.tsx')

    expect(component).toContain('dayKey(booking.startTs, tz).startsWith(date.slice(0, 7))')
    expect(component).toContain('dayStats?.occupancy')
    expect(component).toContain('cancelled === 1')
  })
})
