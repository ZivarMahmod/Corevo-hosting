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
    expect(component).toContain('pagerNavigationPending')
    expect(component).toContain('setPagerNavigationPending(true)')
    expect(component).toContain('setPagerNavigationPending(false)')
    expect(component).toContain(
      'inert={pagerNavigationPending || index !== activeDaySlide ? true : undefined}',
    )
    expect(component).toContain('pagerCenteredKey')
    expect(component).toContain('const previousDayStart = pagerDayStart.current')
    expect(component).toContain('pagerCenteredKey.current !== pagerKey')
  })

  it('ger mobilen en egen topphjälp och bottensök utan en permanent verktygsrad', () => {
    const component = read('components/admin/CalendarBoard.tsx')
    const search = read('components/admin/CalendarSearch.tsx')
    const help = read('components/admin/CalendarHelp.tsx')
    const cancelled = read('components/admin/CancelledLog.tsx')

    expect(component).toContain('mobileCalendarHeaderHelp')
    // 2026-07-18: sök-TRIGGERN bor i bottennaven bredvid FAB:en (Topnav) och
    // öppnar arket via MOBILE_SEARCH_EVENT — CalendarSearch äger bara arket.
    expect(component).not.toContain('mobileCalendarSearchAction')
    expect(component).not.toContain('mobileCalendarUtilities')
    expect(search).toContain('MOBILE_SEARCH_EVENT')
    expect(search).not.toContain('mobileSearchTrigger')
    expect(component).toContain('<CalendarHelp mobileHeader>')
    expect(component).toContain('<CancelledLog tz={tz} label="Avbokade tider" embedded />')
    expect(component).toContain('<CalendarSearch tz={tz} mobileSheet />')
    expect(search).toContain('mobileSheet?: boolean')
    expect(search).toContain('Sök i kalendern')
    expect(help).toContain('mobileHeader?: boolean')
    expect(help).toContain('children?: ReactNode')
    expect(cancelled).toContain('embedded?: boolean')
    expect(cancelled).toContain('styles.logEmbedded')
  })

  it('begränsar månadsstatusen till vald månad och behåller beläggning och avbokningar', () => {
    const component = read('components/admin/CalendarBoard.tsx')

    expect(component).toContain('dayKey(booking.startTs, tz).startsWith(date.slice(0, 7))')
    expect(component).toContain('dayStats?.occupancy')
    expect(component).toContain('cancelled === 1')
  })
})
