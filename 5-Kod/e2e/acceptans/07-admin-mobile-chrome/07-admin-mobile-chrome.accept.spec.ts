import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../..')
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')

test.describe('07 Kundadmin mobilchrome — source contract @readonly @contract', () => {
  test('07-C01 portrait uses one banner and a two-level icon-and-label dock', () => {
    const component = read('apps/web/components/portal/Topnav.tsx')
    const css = read('apps/web/components/portal/Topnav.module.css')

    expect(component).toContain('styles.mobilePageTitle')
    expect(component).toContain('styles.mobileHelp')
    expect(component).toContain('styles.mobileContext')
    expect(component).toContain('mobileNavIcon(area.id)')
    expect(component).not.toContain('mobileNavGlyph')
    expect(css).toMatch(/\.mobileContextAction\s*\{[\s\S]*?min-height:\s*44px;/)
    expect(css).toMatch(/\.mobileNavItem\s*\{[\s\S]*?min-height:\s*44px;/)
    expect(css).not.toMatch(/\.mobileFabButton\s*\{[\s\S]*?border-radius:\s*999px;/)
  })

  test('07-C02 landscape folds the same controls into 66px rails at the canonical breakpoint', () => {
    const css = read('apps/web/components/portal/Topnav.module.css')
    const modal = read('apps/web/components/portal/ui/modal.module.css')
    const global = read('apps/web/app/portal-global.css')

    expect(css).toContain('@media (orientation: landscape) and (max-height: 520px)')
    expect(css).toMatch(/\.adminMobileChrome \.bar\s*\{[\s\S]*?width:\s*66px;/)
    expect(css).toMatch(
      /\.adminMobileChrome \.mobileContext\s*\{[\s\S]*?right:\s*0;[\s\S]*?width:\s*66px;/,
    )
    expect(css).not.toMatch(
      /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.mobileAdmin \.bar/,
    )
    expect(css).toContain('.mobileRailPrevious')
    expect(css).toContain('.mobileRailNext')
    expect(modal).toContain('@media (orientation: landscape) and (max-height: 520px)')
    expect(modal).toContain(".overlay[data-portal='admin']")
    expect(global).toContain('@media (orientation: landscape) and (max-height: 520px)')
    expect(global).toContain("[data-portal='admin'] .bo-cmdk-overlay")
  })

  test('07-C03 calendar pages through three days and moves the whole booking without a grip', () => {
    const component = read('apps/web/components/admin/CalendarBoard.tsx')
    const css = read('apps/web/components/admin/calendar.module.css')
    const gestures = read('apps/web/components/admin/calendar-gestures.ts')
    const help = read('apps/web/components/admin/CalendarHelp.tsx')

    expect(component).toContain('CalendarDayNeighbors')
    expect(component).toContain('styles.dayTrack')
    expect(component).toContain('styles.daySlide')
    expect(css).toContain('scroll-snap-type: x mandatory')
    expect(component).not.toContain('calendarSwipeDirection')
    expect(component).not.toContain('SWIPE_THRESHOLD_PX = 48')
    expect(component).toContain('data-calendar-booking')
    expect(gestures).toContain('TOUCH_DRAG_HOLD_MS = 300')
    expect(gestures).toContain('TOUCH_DRAG_SLOP_PX = 10')
    expect(component).toContain('addMonths(date, dir)')
    expect(component).toContain("view === 'manad'")
    expect(component).toContain('if (!drag.active) return')
    expect(component).toContain('onOpen(booking)')
    expect(component).not.toContain('CalendarBubble')
    expect(component).toContain('styles.blockGhost')
    expect(component).not.toContain('data-booking-drag-handle')
    expect(component).not.toContain('touchDragHandle')
    expect(css).not.toContain('.touchDragHandle')
    expect(css).toMatch(/\.blockDrag\s*\{[\s\S]*?touch-action:\s*pan-x pan-y pinch-zoom;/)
    expect(css).toMatch(/\.dayTrack\s*\{[\s\S]*?display:\s*flex;/)
    expect(css).toMatch(/\.daySlide\s*\{[\s\S]*?flex:\s*0 0 100%;/)
    expect(help).toContain('Håll bokningen')
  })

  test('07-C04 compact cards keep outcomes optional and touch surfaces calm', () => {
    const component = read('apps/web/components/admin/CalendarBoard.tsx')
    const page = read('apps/web/app/(admin)/admin/bokningar/page.tsx')
    const css = read('apps/web/components/admin/calendar.module.css')
    const drawer = read('apps/web/components/admin/BookingDrawer.tsx')

    expect(component).toContain('styles.blockEnd')
    expect(component).toContain('timeLabel(booking.endTs, tz)')
    expect(page).not.toContain('unresolvedCount')
    expect(page).not.toContain('calendarStyles.unresolvedQueue')
    expect(css).not.toContain('.unresolvedSummary')
    expect(drawer).toContain("target: 'completed'")
    expect(drawer).toContain('Uteblev')
    expect(component).not.toContain('styles.freeAreaArmed')
    expect(css).toMatch(/\.offHours\s*\{[^}]*background:\s*var\(--c-paper\);/)
  })

  test('07-C05 customers get their real create action while More has no generic action rail', () => {
    const topnav = read('apps/web/components/portal/Topnav.tsx')
    const form = read('apps/web/components/admin/CreateCustomerForm.tsx')

    expect(topnav).toContain("activeMobileArea?.id === 'kunder'")
    expect(topnav).toContain('/admin/kunder?ny=1')
    expect(topnav).toContain('mobileNavigation?.tabs.some')
    expect(form).toContain("searchParams.has('ny')")
    expect(form).toContain("router.replace('/admin/kunder', { scroll: false })")
    expect(form).toContain('<Modal')
  })
})
