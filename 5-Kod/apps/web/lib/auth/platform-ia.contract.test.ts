import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const exists = (relative: string) => fs.existsSync(path.join(webRoot, relative))

describe('goal-72 S6 platform information architecture', () => {
  it('owns tenants at /kunder and final customers at /slutkunder', () => {
    for (const route of [
      'app/(platform)/kunder/(board)/page.tsx',
      'app/(platform)/kunder/(board)/ny/page.tsx',
      'app/(platform)/kunder/(board)/[id]/page.tsx',
      'app/(platform)/slutkunder/page.tsx',
    ]) {
      expect(exists(route), route).toBe(true)
    }
    expect(exists('app/(platform)/salonger')).toBe(false)
  })

  it('leaves the customer admin route tree untouched', () => {
    for (const route of [
      'app/(admin)/admin/kunder/layout.tsx',
      'app/(admin)/admin/kunder/page.tsx',
      'app/(admin)/admin/kunder/[id]/page.tsx',
    ]) {
      expect(exists(route), route).toBe(true)
    }
  })

  it('redirects only the legacy tenant route on the superadmin host', async () => {
    const redirects = await nextConfig.redirects?.()
    expect(redirects).toContainEqual({
      source: '/salonger/:path*',
      destination: '/kunder/:path*',
      permanent: true,
      has: [{ type: 'host', value: '^superbooking\\.corevo\\.se$' }],
    })
    expect(redirects?.some(({ source }) => source === '/kunder' || source.startsWith('/kunder/'))).toBe(
      false,
    )
  })
})
