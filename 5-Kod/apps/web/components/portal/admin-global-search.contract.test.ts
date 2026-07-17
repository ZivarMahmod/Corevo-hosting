import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('kundadminens globala sök', () => {
  it('söker verkliga kunder och bokningar med stale-request-skydd', () => {
    const actions = read('lib/admin/calendar-actions.ts')
    const palette = read('components/portal/ui/CommandPalette.tsx')
    const shell = read('components/portal/PortalShell.tsx')

    expect(actions).toContain('export async function searchAdminPalette')
    expect(actions).toContain('/admin/kunder/${customer.id}')
    expect(actions).toContain('open=${booking.id}')
    expect(palette).toContain('requestSequence')
    expect(palette).toContain('searchAdminPalette(term)')
    expect(shell).toContain('remoteAdminSearch={!isPlatform}')
  })

  it('använder samma sökord för inställningar i Ctrl-K som i inställningsnavet', () => {
    const palette = read('components/portal/ui/CommandPalette.tsx')
    const shell = read('components/portal/PortalShell.tsx')

    expect(palette).toContain('keywords?: string')
    expect(palette).toContain("it.keywords ?? ''")
    expect(shell).toContain('settingsSearchEntries(categories)')
    expect(shell).toContain("kind: 'Inställning'")
    expect(shell).toContain('keywords: entry.keywords')
  })
})
