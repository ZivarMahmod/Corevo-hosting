import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('kundadminens publika länk', () => {
  it('prioriterar tenantens verifierade domän framför slug-domänen', () => {
    const shell = fs.readFileSync(path.join(WEB_ROOT, 'components', 'portal', 'PortalShell.tsx'), 'utf8')

    expect(shell).toContain(".from('tenant_domains')")
    expect(shell).toContain(".eq('verified', true)")
    expect(shell).toContain('tenantStorefrontUrl(bundle?.tenant.slug, adminDomain?.domain)')

    const studio = fs.readFileSync(
      path.join(WEB_ROOT, 'app', '(admin)', 'admin', 'sida', 'redigera', 'page.tsx'),
      'utf8',
    )
    expect(studio).toContain('tenantStorefrontUrl(row.slug, detail.primaryDomain)')
  })
})
