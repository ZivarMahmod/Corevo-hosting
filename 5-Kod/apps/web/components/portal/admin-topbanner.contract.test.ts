import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
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

type QuickAction = { href: string; label: string; icon: string }

function quickActionsFromPortalShell(source: string): {
  platform: QuickAction[]
  admin: QuickAction[]
} {
  const sourceFile = ts.createSourceFile('PortalShell.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let result: { platform: QuickAction[]; admin: QuickAction[] } | null = null

  function readBranch(expression: ts.Expression): QuickAction[] {
    if (!ts.isArrayLiteralExpression(expression)) {
      throw new Error('quickActions branch must be an array literal')
    }

    return expression.elements.map((element) => {
      if (!ts.isObjectLiteralExpression(element)) {
        throw new Error('quickActions entries must be object literals')
      }
      const values = Object.fromEntries(element.properties.map((property) => {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer)) {
          throw new Error('quickActions properties must use string literals')
        }
        return [property.name.getText(sourceFile), property.initializer.text]
      }))
      return { href: values.href ?? '', label: values.label ?? '', icon: values.icon ?? '' }
    })
  }

  function visit(node: ts.Node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === 'quickActions' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression
    ) {
      if (result) throw new Error('PortalShell must declare quickActions exactly once')
      const expression = node.initializer.expression
      if (!ts.isConditionalExpression(expression) || expression.condition.getText(sourceFile) !== 'isPlatform') {
        throw new Error('quickActions must branch directly on isPlatform')
      }
      result = {
        platform: readBranch(expression.whenTrue),
        admin: readBranch(expression.whenFalse),
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  if (!result) throw new Error('PortalShell quickActions prop is missing')
  return result
}

describe('del 02: universal toppbanner v2', () => {
  it('behåller en gemensam toppbanner men matchar kundadminens desktopordning', () => {
    // v3 (2026-07-18): sök är en cirkulär ikonknapp — ingen textetikett, ingen kbd-bricka.
    // ⌘K/Ctrl+K lever kvar som global genväg och annonseras i title-attributet.
    expect(topnav).toContain('aria-label="Sök kund, bokning eller sida"')
    expect(topnav).not.toContain('<kbd>')
    expect(topnav).toContain("title={`Sök (${isMac ? '⌘' : 'Ctrl'} K)`}")
    expect(topnav.indexOf('{extra ?')).toBeLessThan(topnav.indexOf('{contextLink ?'))
    expect(topnav).toContain('<ThemeSwitch variant={themeVariant} />')
    expect(topnav).toContain('name="external"')
  })

  it('bär genvägsraden som cirkulära ikonknappar i bannern, inte som dashboardkort', () => {
    expect(topnav).toContain('styles.quickGroup')
    expect(topnav).toContain('styles.quickTab')
    expect(portalShell).toContain("{ href: '/admin/bokningar?ny=1', label: 'Ny bokning', icon: 'plus' }")
    expect(portalShell).toContain("{ href: '/admin/bokningar?blockera=1', label: 'Blockera tid', icon: 'block' }")
    expect(portalShell).toContain("{ href: '/admin/kunder', label: 'Kunder', icon: 'users' }")
    expect(portalShell).toContain("{ href: '/admin/statistik', label: 'Statistik', icon: 'chartBars' }")
    expect(dashboardPage).not.toContain('GENVÄGAR')
    // Mobilen har FAB + flikar — genvägsraden är desktop/tablet.
    expect(css).toMatch(/\.mobileAdmin \.quickGroup\s*\{[\s\S]*?display:\s*none;/)
  })

  it('ger plattformen exakt fyra genvägar utan att ändra kundadminens array', () => {
    const { platform, admin } = quickActionsFromPortalShell(portalShell)

    expect(platform).toEqual([
      { href: '/salonger/ny', label: 'Ny kund', icon: 'plus' },
      { href: '/kunder', label: 'Slutkunder', icon: 'users' },
      { href: '/drift-och-logg', label: 'Loggar', icon: 'alert' },
      { href: '/fakturering', label: 'Fakturering', icon: 'dollar' },
    ])
    expect(admin).toEqual([
      { href: '/admin/bokningar?ny=1', label: 'Ny bokning', icon: 'plus' },
      { href: '/admin/bokningar?blockera=1', label: 'Blockera tid', icon: 'block' },
      { href: '/admin/kunder', label: 'Kunder', icon: 'users' },
      { href: '/admin/statistik', label: 'Statistik', icon: 'chartBars' },
    ])
  })

  it('visar otillåtna ytor låsta i stället för att dölja dem', () => {
    expect(topnav).toContain('styles.navLinkLocked')
    expect(topnav).toContain('styles.mobileMoreLinkLocked')
    expect(topnav).toContain('Kräver behörighet från ägaren')
    expect(topnav).toContain('aria-disabled="true"')
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
    expect(adminCss).toMatch(/\.search\s*\{[\s\S]*?width:\s*34px;[\s\S]*?border-radius:\s*50%;/)
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.mobileAdmin \.bar\s*\{[\s\S]*?padding:\s*0 16px;[\s\S]*?gap:\s*10px;/,
    )
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.mobileAdmin \.nav\s*\{[\s\S]*?gap:\s*2px;/,
    )
    expect(adminCss).toMatch(/\.mobileNavIcon\s*\{[\s\S]*?font-size:\s*16px;/)
    expect(css).toMatch(
      /\.mobileFabButton\s*\{[\s\S]*?width:\s*46px;[\s\S]*?height:\s*46px;[\s\S]*?box-shadow:\s*0 8px 20px rgba\(0, 0, 0, 0\.45\);/,
    )
  })
})
