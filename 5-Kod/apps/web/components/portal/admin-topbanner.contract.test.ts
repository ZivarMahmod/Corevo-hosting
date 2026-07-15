import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { nextThemeMode } from './ThemeSwitch'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')
const topnav = read('components/portal/Topnav.tsx')
const portalShell = read('components/portal/PortalShell.tsx')
const switcher = read('components/portal/LocationSwitcher.tsx')
const detailsHook = read('components/portal/useDismissibleDetails.ts')
const css = read('components/portal/Topnav.module.css')
const adminCss = read('components/portal/AdminTopnav.module.css')
const dashboardPage = read('app/(admin)/admin/page.tsx')
const adminData = read('lib/admin/data.ts')

describe('del 02: universal toppbanner v2', () => {
  it('behåller en gemensam toppbanner men matchar kundadminens desktopordning', () => {
    expect(topnav).toContain('Sök kund, bokning…')
    expect(topnav.indexOf('{extra ?')).toBeLessThan(topnav.indexOf('{contextLink ?'))
    expect(topnav).toContain('<ThemeSwitch variant={themeVariant} />')
    expect(topnav).toContain('name="external"')
  })

  it('har den kompletta kontomenyn och ingen notifieringsyta', () => {
    expect(portalShell).toContain("href: '/admin/installningar/konto'")
    expect(portalShell).toContain("label: 'Mitt konto'")
    expect(portalShell).toContain("label: 'Hjälp & support'")
    expect(`${topnav}\n${portalShell}`).not.toMatch(/notis|notification|badge/i)
  })

  it('annonserar Mer som aktuell sida när en samlad mobilflik är aktiv', () => {
    expect(topnav).toContain("aria-current={mobileMoreActive ? 'page' : undefined}")
    expect(topnav).toContain('mobileNavGlyph(area.id)')
    expect(topnav).toContain("mobileNavGlyph('more')")
    expect(topnav).toContain('className={styles.mobileFabLabel}')
  })

  it('gör platsväljaren till den kanoniska globala menyn', () => {
    expect(switcher).toContain('<details')
    expect(switcher).toContain('PLATS — FILTRERAR ALLT')
    expect(switcher).toContain('Valet följer med till alla flikar.')
    expect(switcher).toContain('PLATS_COOKIE')
    expect(switcher).not.toContain('<select')
  })

  it('låter det globala platsvalet styra översiktens data och utskrivna plats', () => {
    expect(dashboardPage).toContain('resolvePlats(')
    expect(dashboardPage).toContain('dashboardData(tenant.id, dayRange, prevRange')
    expect(dashboardPage).toContain('locationId: locationFilter || undefined')
    expect(dashboardPage).toContain("selectedLocation?.name ?? 'Alla platser'")
    expect(adminData).toContain('locationId?: string')
    expect(adminData).toContain(".eq('location_id', options.locationId)")
  })

  it('håller Topnav-overlays exklusiva utan att stänga Mer runt en nästlad platsmeny', () => {
    expect(topnav).toContain('const openCommandPalette = useCallback')
    expect(topnav).toContain('const openMobileMore = useCallback')
    expect(topnav).toContain('const openMobileAccount = useCallback')
    expect(topnav.match(/closePortalDetails\(\)/g)?.length).toBeGreaterThanOrEqual(3)
    expect(topnav).toContain('data-portal-details')
    expect(switcher).toContain('data-portal-details')
    expect(detailsHook).toContain('details[data-portal-details][open]')
    expect(detailsHook).toContain("window.addEventListener('keydown', onKeyDown, true)")
    expect(detailsHook).toContain('event.stopPropagation()')
  })

  it('stänger kontoytan direkt för både interna och externa kontolänkar', () => {
    expect(topnav.match(/onClick=\{onNavigate\}/g)).toHaveLength(2)
    expect(topnav).toContain('const closeDesktopAccount = useCallback')
    expect(topnav).toContain('accountRef.current.open = false')
    expect(topnav).toContain(
      '<AccountLinks items={accountLinks} onNavigate={closeDesktopAccount} />',
    )
  })

  it('stänger mobilens dialoger när layouten växlar upp till iPad eller desktop', () => {
    expect(topnav).toContain("window.matchMedia('(min-width: 768px)')")
    expect(topnav).toContain("desktop.addEventListener('change', closeMobileSurfaces)")
    expect(topnav).toContain("desktop.removeEventListener('change', closeMobileSurfaces)")
  })

  it('cyklar snabbvalet auto till ljust till mörkt och tillbaka', () => {
    expect(nextThemeMode('auto')).toBe('light')
    expect(nextThemeMode('light')).toBe('dark')
    expect(nextThemeMode('dark')).toBe('auto')
  })

  it('har kanonens 60/56/52-höjder och exakta brytpunkter', () => {
    expect(css).toMatch(/\.mobileAdmin \.bar\s*\{[\s\S]*?height:\s*60px;/)
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.mobileAdmin \.bar\s*\{[\s\S]*?height:\s*56px;/,
    )
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.mobileAdmin \.bar\s*\{[\s\S]*?height:\s*52px;/,
    )
    expect(css).toMatch(/\.mobileAdmin \.mark\s*\{[\s\S]*?background:\s*var\(--c-paper-3\);/)
    expect(adminCss).toMatch(/\.brandName\s*\{[\s\S]*?font-size:\s*15px;/)
    expect(adminCss).toMatch(/\.brandSub\s*\{[\s\S]*?font-size:\s*8\.5px;/)
    expect(adminCss).toMatch(/\.search\s*\{[\s\S]*?width:\s*170px;/)
    expect(adminCss).toMatch(/\.searchWithExtra\s*\{[\s\S]*?width:\s*150px;/)
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.mobileAdmin \.bar\s*\{[\s\S]*?padding:\s*0 16px;[\s\S]*?gap:\s*10px;/,
    )
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.mobileAdmin \.nav\s*\{[\s\S]*?gap:\s*2px;/,
    )
    expect(adminCss).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.search,[\s\S]*?width:\s*34px;/,
    )
    expect(adminCss).toMatch(/\.mobileNavIcon\s*\{[\s\S]*?font-size:\s*16px;/)
    expect(css).toMatch(
      /\.mobileFabButton\s*\{[\s\S]*?width:\s*46px;[\s\S]*?height:\s*46px;[\s\S]*?box-shadow:\s*0 8px 20px rgba\(0, 0, 0, 0\.45\);/,
    )
  })
})
