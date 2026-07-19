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
    expect(component).toContain('mobileNavIcon(area.id)')
    expect(component).toContain("mobileNavIcon('more')")
    expect(component).not.toContain('mobileNavGlyph')
    expect(adminCss).toContain('.mobileNavIcon')
    expect(css).toMatch(/\.mobileNavItem\s*\{[\s\S]*?min-height:\s*44px;/)
    expect(css).toMatch(/\.mobileNav\s*\{[\s\S]*?z-index:\s*25;/)
    expect(component).toContain('styles.mobileContext')
    expect(component).toContain('styles.mobileHelp')
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

  it('matchar kalenderns tvånivådocka och liggande sidräcken', () => {
    const css = read('components/portal/Topnav.module.css')
    const calendarCss = read('components/admin/calendar.module.css')
    const component = read('components/portal/Topnav.tsx')

    expect(css).toContain(".shell[data-portal='admin']:has(.main > :global(.workbench))")
    expect(css).toContain('@media (orientation: landscape) and (max-height: 520px)')
    expect(css).toMatch(/\.mobileContext\s*\{[\s\S]*?width:\s*66px;/)
    expect(css).toContain('.mobileRailPrevious')
    expect(css).toContain('.mobileRailNext')
    expect(calendarCss).not.toContain('.mobileCalendarSearchAction')
    expect(calendarCss).not.toContain('.mobileSearchTrigger')
    expect(component).toContain('MOBILE_SEARCH_EVENT')
    expect(component).toContain('mobileMoreAccountLink')
    expect(component).toContain('openMobileAccount')
    expect(component).toContain('styles.mobileNavIcon')
    expect(component).toContain('calendarMeta?.step === \'month\'')
    expect(component).toContain('disabled={calendarStepDisabled}')
    expect(component).toContain('<Icon name="clock" size={19}')
    expect(component).toContain('<Icon name="help" size={19}')
    expect(component).toContain('<Icon name="chevronDown" size={11}')
    expect(css).toContain('.adminMobileChrome .bar')
    expect(css).not.toMatch(
      /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.mobileAdmin \.bar/,
    )
    expect(css).toMatch(/\.adminMobileChrome \.mobileNavItem\s*\{[\s\S]*?min-height:\s*46px;/)
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

  it('placerar vyval under bannern och Blockera i den gemensamma kontextraden', () => {
    const css = read('components/admin/calendar.module.css')
    const component = read('components/admin/CalendarBoard.tsx')
    const topnav = read('components/portal/Topnav.tsx')

    expect(component).toContain('mobileViewSwitch')
    expect(topnav).toContain('/admin/bokningar?blockera=1')
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.viewSwitch\s*\{[\s\S]*?width:\s*100%;/,
    )
  })

  it('ger kundvyn Sök + Ny kund och döljer kontextraden på Mer-sidor', () => {
    const topnav = read('components/portal/Topnav.tsx')
    const createCustomer = read('components/admin/CreateCustomerForm.tsx')

    expect(topnav).toContain("activeMobileArea?.id === 'kunder'")
    expect(topnav).toContain('/admin/kunder?ny=1')
    expect(topnav).toContain('mobileNavigation?.tabs.some')
    expect(createCustomer).toContain('useSearchParams')
    expect(createCustomer).toContain("searchParams.has('ny')")
    expect(createCustomer).toContain("router.replace('/admin/kunder', { scroll: false })")
    expect(createCustomer).toContain('<Modal')
  })

  it('scope:ar liggande dialoger och sökpaneler till admin utan att påverka plattformen', () => {
    const modalComponent = read('components/portal/ui/Modal.tsx')
    const modalCss = read('components/portal/ui/modal.module.css')
    const globalCss = read('app/portal-global.css')

    expect(modalComponent).toContain("data-portal={adminPortal ? 'admin' : undefined}")
    expect(modalCss).toMatch(
      /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.overlay\[data-portal='admin'\]/,
    )
    expect(modalCss).not.toMatch(
      /@media \(orientation: landscape\) and \(max-height: 520px\)\s*\{\s*\.overlay\s*\{/,
    )
    expect(globalCss).toContain("[data-portal='admin'] .bo-cmdk-overlay")
    expect(globalCss).toContain('place-items: stretch end')
    expect(modalCss).toMatch(/\.close\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/)
  })

  it('använder ett native tredagarsblad och klampad navigering utan touchend-tröskel', () => {
    const component = read('components/admin/CalendarBoard.tsx')
    const css = read('components/admin/calendar.module.css')

    expect(component).toContain('nearestDaySlide(scroller.scrollLeft, scroller.clientWidth)')
    expect(component).toContain("scroller.addEventListener('scrollend', onScrollEnd)")
    expect(component).toContain('addMonths(date, dir)')
    expect(component).toContain("view === 'manad'")
    expect(component).not.toContain('onTouchEnd')
    expect(component).not.toContain('Math.abs(dx) < 48')
    expect(css).toContain('scroll-snap-type: x mandatory')
    expect(css).toContain('scroll-snap-stop: always')
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
    const topnav = read('components/portal/Topnav.module.css')
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
    expect(topnav).not.toMatch(
      /:has\([^{]*?workbench[^{]*?\)[^{]*?\.mobile(?:Actions|Nav|NavIcon|NavItem)/,
    )
  })
})
