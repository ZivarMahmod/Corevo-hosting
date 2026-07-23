import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/customer-portal/manifest/route'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function pngSize(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(path.join(WEB_ROOT, 'public', file.replace(/^\//, '')))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('customer portal PWA', () => {
  it('is neutral, portal-scoped, installable and never reuses the legacy customer worker', async () => {
    const response = GET()
    const manifest = await response.json() as {
      name: string
      short_name: string
      id: string
      start_url: string
      scope: string
      display: string
      theme_color: string
      background_color: string
      icons: { src: string; sizes: string; type: string; purpose?: string }[]
    }

    expect(response.headers.get('content-type')).toContain('application/manifest+json')
    expect(manifest).toMatchObject({
      name: 'Mina bokningar · Corevo',
      short_name: 'Mina bokningar',
      id: '/mina/',
      start_url: '/mina/',
      scope: '/mina/',
      display: 'standalone',
      theme_color: '#191a17',
      background_color: '#f3efe6',
    })
    expect(JSON.stringify(manifest))
      .not.toMatch(/freshcut|tenantName|customerName|token|bookingId|\?/)

    for (const size of [192, 512]) {
      const icon = manifest.icons.find((candidate) => candidate.sizes === `${size}x${size}`)
      expect(icon?.type).toBe('image/png')
      expect(icon && pngSize(icon.src)).toEqual({ width: size, height: size })
    }
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)

    const layout = fs.readFileSync(
      path.join(WEB_ROOT, 'app', '(customer-portal)', 'layout.tsx'),
      'utf8',
    )
    expect(layout).toContain("manifest: '/api/customer-portal/manifest'")
    expect(layout).toContain("apple: '/pwa/customer-portal-icon-180.png'")
    expect(layout).not.toMatch(/kund-sw|serviceWorker|navigator\.serviceWorker/)
  })
})
