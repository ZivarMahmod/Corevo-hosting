import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../../..')
const readWeb = (relative: string) => readFileSync(resolve(webRoot, relative), 'utf8')

describe('platform settings workspace route contract', () => {
  it('self-gates the root and keeps it as the mobile category index', () => {
    const root = readWeb('app/(platform)/installningar/page.tsx')

    expect(root).toContain('await requirePlatformAdmin()')
    expect(root).toContain('<SettingsWorkspace')
    expect(root).toContain('mobileIndex')
    expect(root).toContain('rootHref="/installningar"')
    expect(root).toContain('groups={PLATFORM_SETTINGS_GROUPS}')
    expect(root).toContain('searchEntries={platformSettingsSearchEntries(categories)}')
  })

  it('self-gates every category and uses the platform root as the mobile back target', () => {
    const categoryPath = resolve(import.meta.dirname, '[kategori]/page.tsx')
    expect(existsSync(categoryPath), '[kategori]/page.tsx is missing').toBe(true)
    if (!existsSync(categoryPath)) return

    const category = readFileSync(categoryPath, 'utf8')
    expect(category).toContain('await requirePlatformAdmin()')
    expect(category).toContain('<SettingsWorkspace')
    expect(category).toContain('rootHref="/installningar"')
    expect(category).toContain('groups={PLATFORM_SETTINGS_GROUPS}')
    expect(category).toContain('searchEntries={platformSettingsSearchEntries(categories)}')
    expect(category).toContain("category.id === 'sakerhet'")
    expect(category).toContain('<SecuritySettings')
    expect(category).toContain('<BillingSettings')
  })

  it('generalizes the shared workspace without changing admin defaults or CSS', () => {
    const workspace = readWeb('components/admin/SettingsWorkspace.tsx')
    const navigation = readWeb('components/admin/SettingsV2.tsx')
    const css = readWeb('components/admin/settings-v2.module.css')

    expect(workspace).toContain("rootHref = '/admin/installningar'")
    expect(workspace).toContain('groups={groups}')
    expect(workspace).toContain('searchEntries={searchEntries}')
    expect(workspace).toContain('mobileIndex ? styles.mobileHidden')
    expect(workspace).toContain("mobileIndex ? '' : styles.workspace")
    expect(navigation).toContain('groups = SETTINGS_GROUPS')
    expect(navigation).toContain('providedSearchEntries ?? settingsSearchEntries')
    expect(css).toContain('grid-template-columns: 308px minmax(0, 1fr)')
    expect(css).toContain('--settings-bg: #121210')
  })

  it('reuses real security and billing surfaces without duplicating billing data', () => {
    const settings = readWeb('app/(platform)/installningar/Settings.tsx')

    expect(settings).toContain('<AccountSecurity')
    expect(settings).toContain('Audit-guard mot radering')
    expect(settings).toContain('href="/personal-plattform"')
    expect(settings).toContain('Modell: manuell (flöde 2)')
    expect(settings).toContain('href="/fakturering"')
    expect(settings).not.toContain('billingUnderlag')
    expect(settings).not.toContain('<table')
    expect(settings).not.toContain('PlatformBrandingForm')
  })
})
