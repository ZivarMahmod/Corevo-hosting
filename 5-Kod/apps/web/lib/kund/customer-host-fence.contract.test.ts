import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('customer portal layout order', () => {
  it('checks account, host and active customer relation before loading tenant branding', () => {
    const source = fs.readFileSync(path.join(WEB_ROOT, 'app/(kund)/konto/layout.tsx'), 'utf8')
    const user = source.indexOf("requirePortal('kund')")
    const host = source.indexOf('await currentKundTenant()')
    const relation = source.indexOf(".from('customers')")
    const fence = source.indexOf('!canRenderCustomerPortal({')
    const branding = source.indexOf('await currentTenant()')

    expect(user).toBeGreaterThan(-1)
    expect(host).toBeGreaterThan(user)
    expect(relation).toBeGreaterThan(host)
    expect(fence).toBeGreaterThan(relation)
    expect(branding).toBeGreaterThan(fence)
    expect(source).toContain(".eq('status', 'active')")
    expect(source).toContain('Byt konto')
  })
})
