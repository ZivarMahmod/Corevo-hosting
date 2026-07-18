import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../../..')
const readWeb = (relative: string) => {
  const file = resolve(webRoot, relative)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

describe('size-limited Worker client boundaries', () => {
  it('keeps the interactive calendar outside the Worker without moving server data reads', () => {
    const page = readWeb('app/(admin)/admin/bokningar/page.tsx')
    const lazy = readWeb('components/admin/CalendarBoardLazy.tsx')

    expect(page).toContain("import { CalendarBoardLazy } from '@/components/admin/CalendarBoardLazy'")
    expect(page).toContain('<CalendarBoardLazy')
    expect(page).not.toContain("CalendarBoard,\n  type CalendarBlock")
    expect(page).toContain("import type { CalendarBlock, CalendarView } from '@/components/admin/CalendarBoard'")
    expect(page).toContain('const [')
    expect(page).toContain('listBookings(tenant.id')

    expect(lazy).toContain("import('./CalendarBoard')")
    expect(lazy).toContain('ssr: false')
    expect(lazy).toContain('aria-live="polite"')
  })

  it('keeps the interactive site studio outside the Worker while the page owns authorization and reads', () => {
    const page = readWeb('app/(admin)/admin/sida/page.tsx')
    const lazy = readWeb('components/platform/SidaStudioV2Lazy.tsx')

    expect(page).toContain("import { SidaStudioV2Lazy } from '@/components/platform/SidaStudioV2Lazy'")
    expect(page).toContain('<SidaStudioV2Lazy')
    expect(page).not.toContain('  SidaStudioV2,')
    expect(page).toContain('const user = await requireAdminArea(')
    expect(page).toContain('loadSiteRevisionState(')

    expect(lazy).toContain("import('./SidaStudioV2')")
    expect(lazy).toContain('ssr: false')
    expect(lazy).toContain('aria-live="polite"')
  })

  it('keeps the superadmin site studio outside the Worker while tenant scoping stays on the page', () => {
    const page = readWeb('app/(platform)/kunder/(board)/[id]/page.tsx')
    const lazy = readWeb('components/platform/SidaStudioLazy.tsx')

    expect(page).toContain("import { SidaStudioLazy } from '@/components/platform/SidaStudioLazy'")
    expect(page).toContain('<SidaStudioLazy')
    expect(page).not.toContain("import { SidaStudio } from '@/components/platform/SidaStudio'")
    expect(page).toContain('await requirePlatformOperator()')
    expect(page).toContain('const detail = await getTenantDetail(id)')

    expect(lazy).toContain("import('./SidaStudio')")
    expect(lazy).toContain('ssr: false')
    expect(lazy).toContain('aria-live="polite"')
  })
})
