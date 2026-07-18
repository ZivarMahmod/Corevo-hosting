import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../../..')
const readWeb = (relative: string) => {
  const file = resolve(webRoot, relative)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

describe('goal-72 S4 salonger master–detalj route contract', () => {
  it('owns the tenant fetch and honest card mapping in a persistent layout', () => {
    const layout = readWeb('app/(platform)/salonger/(board)/layout.tsx')

    expect(readWeb('app/(platform)/salonger/layout.tsx')).toBe('')

    expect(layout).toContain("import { listTenantsWithStats } from '@/lib/platform/tenants'")
    expect(layout).toContain(
      "import { SalongerBoard, type SalongCardVM } from '@/components/platform/SalongerBoard'",
    )
    expect(layout).toContain('const tenants = await listTenantsWithStats()')
    expect(layout).toContain('const rows: SalongCardVM[] = tenants.map((tenant) => ({')
    expect(layout).toContain('owner: tenant.ownerName ?? tenant.owner')
    expect(layout).toContain('lastLabel: relativeTenantActivity(tenant.lastActivityAt)')
    expect(layout).toContain('<SalongerBoard tenants={rows}>{children}</SalongerBoard>')

    const page = readWeb('app/(platform)/salonger/(board)/page.tsx')
    expect(page).not.toContain('listTenantsWithStats')
    expect(page).not.toContain('SalongerClient')
  })

  it('keeps the workbench as the direct platform-main child with the canonical skeleton', () => {
    const board = readWeb('components/platform/SalongerBoard.tsx')
    const css = readWeb('components/platform/salonger-v2.module.css')

    expect(board).toContain('className={`workbench ${styles.board}`}')
    expect(board).toContain("data-mobile-view={hasSelection ? 'card' : 'list'}")
    expect(css).toMatch(/\.board\s*\{[\s\S]*?grid-template-columns:\s*400px 1fr;/)
    expect(css).toMatch(/\.list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?border-right:/)
    expect(css).toMatch(/\.rows\s*\{[\s\S]*?overflow-y:\s*auto;/)
    expect(css).toMatch(/\.pane\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?min-height:\s*0;/)
    expect(css).toMatch(/\.paneInner\s*\{[\s\S]*?max-width:\s*880px;[\s\S]*?margin:\s*0 auto;/)
    expect(css).toContain('.rowOn')
    expect(css).toContain('.search')
    expect(css).toContain('.chipOn')
  })

  it('renders index, create, loading and error states as pane children', () => {
    const index = readWeb('app/(platform)/salonger/(board)/page.tsx')
    expect(index).toContain('className={styles.pane}')
    expect(index).toContain('className={`${styles.paneInner} ${styles.prompt}`}')
    expect(index).toContain('Välj en kund')
    expect(index).not.toContain('<main className={styles.pane}>')

    const create = readWeb('app/(platform)/salonger/(board)/ny/page.tsx')
    expect(create).toContain('className={styles.pane}')
    expect(create).toContain('styles.paneInnerWide')
    expect(create).toContain('<OnboardingStudio')
    expect(create).toContain('<Link href="/salonger" className={styles.back}>')
    expect(create).not.toContain('<main className={styles.pane}>')

    for (const relative of [
      'app/(platform)/salonger/loading.tsx',
      'app/(platform)/salonger/error.tsx',
      'app/(platform)/salonger/(board)/[id]/loading.tsx',
      'app/(platform)/salonger/(board)/[id]/error.tsx',
    ]) {
      const source = readWeb(relative)
      expect(source, relative).toContain('className={styles.pane}')
      expect(source, relative).toContain('styles.paneInner')
      expect(source, relative).not.toContain('<main className={styles.pane}>')
    }

    for (const relative of [
      'app/(platform)/salonger/loading.tsx',
      'app/(platform)/salonger/error.tsx',
    ]) {
      const source = readWeb(relative)
      expect(source, relative).toContain('styles.boardState')
    }
  })

  it('changes only the detail shell while preserving all 14 tab keys and module gates', () => {
    const page = readWeb('app/(platform)/salonger/(board)/[id]/page.tsx')
    const tabs = readWeb('components/platform/TenantDetailTabs.tsx')
    const keys = [...tabs.matchAll(/\| '([^']+)'/g)].map((match) => match[1])

    expect(keys).toEqual([
      'Översikt',
      'Tjänster',
      'Kunder',
      'Personal',
      'Kurser',
      'Klubben',
      'Webshop',
      'Blogg',
      'Offerter',
      'Meddelanden',
      'Bildbibliotek',
      'Sida',
      'Integrationer',
      'Drift',
    ])
    expect(page).toContain('className={boardStyles.pane}')
    expect(page).toContain('className={boardStyles.paneInner}')
    expect(page).not.toContain('<main className={boardStyles.pane}>')
    expect(page).toContain('<TenantDetailTabs tabs={tabs} />')
    expect(page).toContain('...(shopOn && {')
    expect(page).toContain('...(bloggOn && {')
    expect(page).toContain('...(kurserOn && {')
    expect(page).toContain('...(lojalitetOn && {')
    expect(page).toContain('...(offertOn && {')
    expect(page).toContain('...(mediaOn && mediaUsage')
  })
})
