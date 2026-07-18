import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('del 01: ägar-adminens responsiva kontrakt', () => {
  it('har exakt mobilbrytpunkt, bottennav och safe-area i det delade toppnavet', () => {
    const css = read('components/portal/Topnav.module.css')
    const adminCss = read('components/portal/AdminTopnav.module.css')
    const component = read('components/portal/Topnav.tsx')
    const theme = read('components/portal/ThemeSwitch.tsx')
    const modal = read('components/portal/ui/modal.module.css')

    expect(css).toContain('@media (max-width: 767px)')
    expect(css).toContain('.mobileNav')
    expect(css).toContain('env(safe-area-inset-bottom)')
    expect(component).toContain('mobileNavigation')
    expect(component).toContain('aria-label="Mobilnavigering"')
    expect(component).toContain('mobileNavGlyph(area.id)')
    expect(component).toContain("mobileNavGlyph('more')")
    expect(adminCss).toMatch(/\.mobileNavIcon\s*\{[\s\S]*?font-size:\s*16px;/)
    expect(css).toMatch(/\.mobileNavItem\s*\{[\s\S]*?font-size:\s*9\.5px;/)
    expect(css).toMatch(/\.mobileNav\s*\{[\s\S]*?z-index:\s*25;/)
    expect(component).toContain('className={styles.mobileFabLabel}')
    expect(component).toContain('{mobileNavigation.action.label}</span>')
    expect(css).toMatch(
      /\.mobileFabButton\s*\{[\s\S]*?width:\s*46px;[\s\S]*?height:\s*46px;[\s\S]*?background:\s*#2f5f47;/i,
    )
    expect(css).toContain('env(safe-area-inset-top)')
    const mobileHeaderStart = css.indexOf('@media (max-width: 767px)')
    const calendarHeaderOverride = css.indexOf(
      ".shell[data-portal='admin']:has(.main > :global(.workbench))",
      mobileHeaderStart,
    )
    const sharedMobileHeader = css.slice(mobileHeaderStart, calendarHeaderOverride)
    expect(sharedMobileHeader).toMatch(
      /\.mobileAdmin \.brandSub\s*\{[\s\S]*?display:\s*block;[\s\S]*?font-size:\s*7\.5px;/,
    )
    expect(theme).toContain('THEME_EVENT')
    expect(theme).toContain('dispatchEvent')
    expect(css).not.toContain('padding: 20px 14px 72px;')
    expect(modal).toMatch(/\.cardNoFooter \.body\s*\{[\s\S]*?safe-area-inset-bottom/)
    expect(component).toMatch(
      /className=\{styles\.mobileMoreLink[\s\S]*?onClick=\{\(\) => setMobileMoreOpen\(false\)\}/,
    )
  })

  it('matchar kalenderns Mobil v2-skal utan att ändra övriga adminrutter', () => {
    const css = read('components/portal/Topnav.module.css')
    const calendarCss = read('components/admin/calendar.module.css')
    const component = read('components/portal/Topnav.tsx')

    expect(css).toContain(".shell[data-portal='admin']:has(.main > :global(.workbench))")
    expect(css).toMatch(
      /:has\(\.main > :global\(\.workbench\)\)[\s\S]*?\.mobileAdmin \.brandSub\s*\{[\s\S]*?display:\s*block;/,
    )
    expect(css).toMatch(
      /:has\(\.main > :global\(\.workbench\)\)[\s\S]*?\.mobileActions\s*\{[\s\S]*?display:\s*none;/,
    )
    expect(css).toMatch(
      /:has\(\.main > :global\(\.workbench\)\)[\s\S]*?\.mobileNavIcon\s*\{[\s\S]*?display:\s*none;/,
    )
    expect(css).toMatch(
      /:has\(\.main > :global\(\.workbench\)\)[\s\S]*?\.mobileNavItemActive::after\s*\{[\s\S]*?background:\s*var\(--c-forest\);/,
    )
    expect(css).toMatch(
      /:has\(\.main > :global\(\.workbench\)\)[\s\S]*?\.mobileFabLabel\s*\{[\s\S]*?display:\s*none;/,
    )
    // 2026-07-18: sök-triggern lever i dockens verktygsrad (aldrig fixed — den
    // hamnade bakom bottennavens täckande yta).
    expect(calendarCss).not.toContain('.mobileCalendarSearchAction')
    expect(calendarCss).toMatch(/\.mobileSearchTrigger\s*\{[\s\S]*?border-radius:\s*999px;/)
    expect(component).toContain('mobileMoreAccountLink')
    expect(component).toContain('openMobileAccount')
    expect(component).toContain('styles.mobileNavIcon')
  })

  it('pressar ihop alla kalenderkolumner på mobil utan vågrät scroll', () => {
    const css = read('components/admin/calendar.module.css')

    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.dayWrap\s*\{[\s\S]*?--col-min:\s*0px;/,
    )
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.dayWrap\s*\{[\s\S]*?width:\s*100%;/)
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.resChips\s*\{[\s\S]*?scrollbar-width:\s*none;/,
    )
    expect(css).toContain(
      'background: color-mix(in srgb, var(--bk, var(--c-gold)) 16%, var(--c-paper));',
    )
  })

  it('placerar Blockera 38x38 på datumraden och växlaren ensam under', () => {
    const css = read('components/admin/calendar.module.css')
    const component = read('components/admin/CalendarBoard.tsx')

    expect(component).toContain('mobileBlockBtn')
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.mobileBlockBtn\s*\{[\s\S]*?width:\s*38px;[\s\S]*?height:\s*38px;/,
    )
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.viewSwitch\s*\{[\s\S]*?width:\s*100%;/,
    )
  })

  it('autoscrollar till nu en gång per öppnad dag och aldrig efter datarefresh', () => {
    const component = read('components/admin/CalendarBoard.tsx')

    expect(component).toContain('lastAutoScrollKey')
    expect(component).not.toMatch(
      /centeredCalendarScrollTop[\s\S]*?\}, \[bookings\.length, date, staff\.length/,
    )
    expect(component.indexOf('lastAutoScrollKey.current = key')).toBeGreaterThan(
      component.indexOf('window.requestAnimationFrame'),
    )
  })

  it('har ett riktigt Omboka-flöde som ersätter desktop-drag på touch', () => {
    const drawer = read('components/admin/BookingDrawer.tsx')

    expect(drawer).toContain('Omboka')
    expect(drawer).toContain('moveBooking')
    expect(drawer).toContain('rescheduleStartIso')
    expect(drawer).toContain('eligibleRescheduleStaff')
    expect(drawer).toContain('rescheduleFirstFieldRef')
    expect(drawer).toContain('rescheduleTriggerRef')
  })

  it('gör adminens drawers till bottom sheets under 768 px', () => {
    const css = read('app/portal-global.css')

    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?data-portal=['"]admin['"][\s\S]*?bo-drawer/,
    )
    expect(css).toContain('env(safe-area-inset-bottom)')
  })

  it('har mobilkanon för översikt och kundarbetsbord utan att ta bort innehåll', () => {
    const dashboard = read('app/(admin)/admin/dashboard.module.css')
    const customers = read('components/admin/kunder-v2.module.css')

    expect(dashboard).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.greeting\s*\{[\s\S]*?font-size:\s*21px;/,
    )
    expect(dashboard).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.upRow\s*\{[\s\S]*?grid-template-areas:/,
    )
    expect(customers).toContain('@media (max-width: 767px)')
    expect(customers).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.board\s*\{[\s\S]*?env\(safe-area-inset-bottom\)/,
    )
  })
})
