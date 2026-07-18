import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('partner route boundaries', () => {
  it('admits partners to their tenant-scoped operating surfaces', () => {
    for (const path of [
      'app/(platform)/platform/page.tsx',
      'app/(platform)/kunder/(board)/[id]/page.tsx',
      'app/(platform)/slutkunder/page.tsx',
      'app/(platform)/personal-plattform/page.tsx',
      'app/(platform)/utskick/page.tsx',
      'app/(platform)/drift-och-logg/page.tsx',
      'app/(platform)/fakturering/page.tsx',
    ]) {
      expect(read(path), path).toContain('requirePlatformOperator')
    }
  })

  it('keeps Corevo-global and partner-management routes root-only', () => {
    for (const path of [
      'app/(platform)/branscher/page.tsx',
      'app/(platform)/integrationer/page.tsx',
      'app/(platform)/domaner/page.tsx',
      'app/(platform)/roller/page.tsx',
      'app/(platform)/installningar/page.tsx',
      'app/(platform)/partners/page.tsx',
      'app/(platform)/partners/[id]/page.tsx',
    ]) {
      expect(read(path), path).toContain('requirePlatformAdmin')
    }
  })

  it('checks a partner preview slug through the RLS-scoped cookie client', () => {
    const preview = read('app/salong-preview/[slug]/preview-shell.tsx')
    expect(preview).toContain('if (user.partnerAdmin)')
    expect(preview).toContain(".from('tenants')")
    expect(preview).toContain(".eq('slug', slug)")
    expect(preview).toContain('if (!scoped) notFound()')
  })

  it('never exposes global cron health to a partner', () => {
    const drift = read('app/(platform)/drift-och-logg/page.tsx')
    expect(drift).toContain('user.platformAdmin ? readCronHealth() : Promise.resolve(null)')
  })
})
