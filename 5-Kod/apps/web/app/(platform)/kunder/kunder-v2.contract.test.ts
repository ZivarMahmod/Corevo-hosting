import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../../..')
const readWeb = (relative: string) => {
  const file = resolve(webRoot, relative)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

describe('goal-72/80 customer master–detail and full-width workspace contract', () => {
  it('owns the tenant fetch and honest card mapping in a persistent layout', () => {
    const layout = readWeb('app/(platform)/kunder/(board)/layout.tsx')

    expect(readWeb('app/(platform)/kunder/layout.tsx')).toBe('')

    expect(layout).toContain("import { listTenantsWithStats } from '@/lib/platform/tenants'")
    expect(layout).toContain("import type { KundCardVM } from '@/components/platform/KunderBoard'")
    expect(layout).toContain("import { KunderBoardLazy } from '@/components/platform/KunderBoardLazy'")
    expect(layout).toContain('const tenants = await listTenantsWithStats()')
    expect(layout).toContain('const rows: KundCardVM[] = tenants.map((tenant) => ({')
    expect(layout).toContain('owner: tenant.ownerName ?? tenant.owner')
    expect(layout).toContain('lastLabel: relativeTenantActivity(tenant.lastActivityAt)')
    expect(layout).toContain('<KunderBoardLazy tenants={rows}>{children}</KunderBoardLazy>')

    const lazyBoard = readWeb('components/platform/KunderBoardLazy.tsx')
    expect(lazyBoard).toContain("import('./KunderBoard')")
    expect(lazyBoard).toContain('ssr: false')

    const page = readWeb('app/(platform)/kunder/(board)/page.tsx')
    expect(page).not.toContain('listTenantsWithStats')
    expect(page).not.toContain('LegacyCustomersClient')
  })

  it('keeps the list skeleton and gives a selected customer the canonical full-width workspace', () => {
    const board = readWeb('components/platform/KunderBoard.tsx')
    const css = readWeb('components/platform/kunder-v2.module.css')

    expect(board).toContain(
      'className={`workbench ${styles.board}${hasSelection ? ` ${styles.boardState}` : \'\'}`}',
    )
    expect(board).toContain('{!hasSelection ? <aside className={styles.list}')
    expect(board).toContain("data-mobile-view={hasSelection ? 'card' : 'list'}")
    expect(css).toMatch(/\.board\s*\{[\s\S]*?grid-template-columns:\s*400px 1fr;/)
    expect(css).toMatch(/\.boardState\s*\{[\s\S]*?grid-template-columns:\s*1fr;/)
    expect(css).toMatch(/\.list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?border-right:/)
    expect(css).toMatch(/\.rows\s*\{[\s\S]*?overflow-y:\s*auto;/)
    expect(css).toMatch(
      /\.pane\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?min-height:\s*0;[\s\S]*?min-width:\s*0;/,
    )
    expect(css).toMatch(/\.paneInner\s*\{[\s\S]*?max-width:\s*1320px;[\s\S]*?margin:\s*0 auto;/)
    expect(css).toContain('.rowOn')
    expect(css).toContain('.search')
    expect(css).toContain('.chipOn')
  })

  it('renders index, create, loading and error states as pane children', () => {
    const index = readWeb('app/(platform)/kunder/(board)/page.tsx')
    expect(index).toContain('className={styles.pane}')
    expect(index).toContain('className={`${styles.paneInner} ${styles.prompt}`}')
    expect(index).toContain('Välj en kund')
    expect(index).not.toContain('<main className={styles.pane}>')

    const create = readWeb('app/(platform)/kunder/(board)/ny/page.tsx')
    const lazyEntry = readWeb('components/platform/OnboardingEntryLazy.tsx')
    expect(create).toContain('className={styles.pane}')
    expect(create).toContain('styles.paneInnerWide')
    expect(create).toContain('<OnboardingEntryLazy')
    expect(lazyEntry).toContain("import('./onboarding-studio/OnboardingStudio')")
    expect(lazyEntry).toContain("import('./CreateTenantForm')")
    expect(lazyEntry.match(/ssr: false/g)).toHaveLength(2)
    expect(create).toContain('<Link href="/kunder" className={styles.back}>')
    expect(create).not.toContain('<main className={styles.pane}>')

    for (const relative of [
      'app/(platform)/kunder/loading.tsx',
      'app/(platform)/kunder/error.tsx',
      'app/(platform)/kunder/(board)/[id]/loading.tsx',
      'app/(platform)/kunder/(board)/[id]/error.tsx',
    ]) {
      const source = readWeb(relative)
      expect(source, relative).toContain('className={styles.pane}')
      expect(source, relative).toContain('styles.paneInner')
      expect(source, relative).not.toContain('<main className={styles.pane}>')
    }

    for (const relative of [
      'app/(platform)/kunder/loading.tsx',
      'app/(platform)/kunder/error.tsx',
    ]) {
      const source = readWeb(relative)
      expect(source, relative).toContain('styles.boardState')
    }
  })

  it('changes only the detail shell while preserving all 14 tab keys and module gates', () => {
    const page = readWeb('app/(platform)/kunder/(board)/[id]/page.tsx')
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
