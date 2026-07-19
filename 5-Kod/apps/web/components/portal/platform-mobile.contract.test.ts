import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('goal-72 S5: superadminens mobilkontrakt', () => {
  it('kopplar in plattformens mobilnavigation utan att ändra adminens gren', () => {
    const shell = read('components/portal/PortalShell.tsx')

    expect(shell).toContain('platformMobileNavigation(topAreas)')
    expect(shell).toContain('adminMobileNavigation(topAreas)')
    expect(shell).not.toContain('isPlatform ? undefined : adminMobileNavigation(topAreas)')
  })

  it('beräknar mobilens aktiva route separat och ger fyra flikar sex kolumner', () => {
    const component = read('components/portal/Topnav.tsx')
    const css = read('components/portal/Topnav.module.css')

    expect(component).toContain('const activeMobileArea =')
    expect(component).toContain('area.id === activeMobileArea?.id')
    expect(component).toContain('mobileNavigation.tabs.length > 3')
    expect(css).toMatch(/\.mobileNavSixCol\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6, 1fr\);/)
  })

  it('behåller safe-area/FAB och visar plattformsdrawers som bottenark', () => {
    const topnav = read('components/portal/Topnav.module.css')
    const global = read('app/portal-global.css')

    expect(topnav).toContain('env(safe-area-inset-bottom)')
    expect(topnav).toMatch(/\.mobileNav\s*\{[\s\S]*?z-index:\s*25;/)
    expect(topnav).toMatch(
      /\.platformMobileFabButton\s*\{[\s\S]*?width:\s*46px;[\s\S]*?height:\s*46px;/,
    )
    expect(global).toContain('[data-portal="platform"] .bo-drawer')
    expect(topnav).not.toMatch(
      /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.mobileAdmin \.bar/,
    )
  })

  it('låter kundlistan växla list/detalj och håller onboarding inom telefonbredden', () => {
    const board = read('components/platform/kunder-v2.module.css')
    const studioPanel = read('components/platform/onboarding-studio/PanelHost.tsx')
    const fallback = read('components/platform/CreateTenantForm.module.css')

    expect(board).toMatch(/@media \(max-width: 767px\)[\s\S]*?data-mobile-view='list'/)
    expect(board).toMatch(/@media \(max-width: 767px\)[\s\S]*?grid-template-columns:\s*1fr;/)
    expect(studioPanel).toContain("width: 'min(420px, 100%)'")
    expect(studioPanel).toContain("boxSizing: 'border-box'")
    expect(fallback).toMatch(/\.stepper > \*\s*\{[\s\S]*?min-width:\s*0;/)
    expect(fallback).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?grid-template-columns:\s*1fr(?:\s*!important)?;/,
    )
  })
})
