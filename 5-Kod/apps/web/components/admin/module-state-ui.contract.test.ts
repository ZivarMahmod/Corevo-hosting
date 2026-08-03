import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = path.resolve(__dirname, '../..')

function source(relativePath: string) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8')
}

describe('binary module UI', () => {
  it('disables module controls and explains why', () => {
    const boundary = source('components/admin/ModuleWriteBoundary.tsx')
    expect(boundary).toContain('<fieldset')
    expect(boundary).toContain('disabled={readOnly}')
    expect(boundary).toContain('ändringar är låsta tills modulen')
  })

  it.each([
    'app/(admin)/admin/blogg/page.tsx',
    'app/(admin)/admin/webshop/page.tsx',
    'app/(admin)/admin/kurser/page.tsx',
    'app/(admin)/admin/offerter/page.tsx',
    'app/(admin)/admin/media/page.tsx',
    'app/(admin)/admin/lojalitet/page.tsx',
    'app/(admin)/admin/presentkort/page.tsx',
  ])('%s contains no paused module state', (file) => {
    const page = source(file)
    expect(page).toContain('<ModuleWriteBoundary')
    expect(page).not.toContain("=== 'paused'")
  })

  it('uses one auto-saving on/off switch in the platform module list', () => {
    const modulesCard = source('components/platform/ModulesCard.tsx')
    expect(modulesCard).toContain('className="pswitch"')
    expect(modulesCard).toContain('name="binary"')
    expect(modulesCard).toContain('name="enabled"')
    expect(modulesCard).toContain('formRef.current?.requestSubmit()')
    expect(modulesCard).toContain("module.state === 'live'")
    expect(modulesCard).not.toContain('<select')
  })

  it('guards the two platform-only write paths in live only', () => {
    const loyalty = source('lib/platform/actions/loyalty.ts')
    const offert = source('lib/platform/actions/offert.ts')
    expect(loyalty).toContain("state === 'live'")
    expect(loyalty.match(/await loyaltyWritable\(tenantId\)/g)).toHaveLength(3)
    expect(offert).toContain("state !== 'live'")
  })

  it('does not turn module read failures into false off states', () => {
    const adminModules = source('lib/admin/modules.ts')
    const platformModules = source('lib/platform/tenant-modules-admin.ts')
    expect(adminModules).toContain("throw new Error('Kunde inte läsa modulstatus.')")
    expect(platformModules).toContain("throw new Error('Kunde inte läsa modulstatus.')")
  })

  it('keeps back-office overlays above navigation in one shared layer scale', () => {
    const portalCss = source('app/portal-global.css')
    const modalCss = source('components/portal/ui/modal.module.css')
    const topnavCss = source('components/portal/Topnav.module.css')
    const personalCss = source('components/personal/personal-pwa.module.css')
    const calendarCss = source('components/admin/calendar.module.css')
    const tenantDetailCss = source('components/platform/tenant-detail.module.css')
    expect(portalCss).toContain('--z-bo-nav: 40')
    expect(portalCss).toContain('--z-bo-drawer: 90')
    expect(portalCss).toContain('--z-bo-modal: 100')
    expect(portalCss).toContain('--z-bo-toast: 120')
    expect(modalCss).toContain('z-index: var(--z-bo-modal)')
    expect(topnavCss).toContain('z-index: var(--z-bo-nav)')
    expect(personalCss).toContain('z-index: var(--z-bo-modal, 100)')
    expect(calendarCss).toContain('z-index: var(--z-bo-drawer, 90)')
    expect(tenantDetailCss).not.toMatch(/z-index:\s*62/)
  })
})
