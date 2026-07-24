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
      id: '/mina',
      start_url: '/mina/',
      scope: '/mina/',
      display: 'standalone',
      theme_color: '#191a17',
      background_color: '#191a17',
    })
    expect(JSON.stringify(manifest))
      .not.toMatch(/freshcut|tenantName|customerName|token|bookingId|\?/)

    expect(manifest.icons).toEqual([
      {
        src: '/pwa/corevo-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/corevo-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/corevo-icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/pwa/corevo-icon-monochrome.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'monochrome',
      },
    ])
    for (const icon of manifest.icons) {
      const size = Number.parseInt(icon.sizes, 10)
      expect(pngSize(icon.src)).toEqual({ width: size, height: size })
    }

    const layout = fs.readFileSync(
      path.join(WEB_ROOT, 'app', '(customer-portal)', 'layout.tsx'),
      'utf8',
    )
    expect(layout).toContain("manifest: '/api/customer-portal/manifest'")
    expect(layout).toContain("apple: '/pwa/corevo-apple-touch-icon-180.png'")
    expect(pngSize('/pwa/corevo-apple-touch-icon-180.png')).toEqual({ width: 180, height: 180 })
    expect(layout).not.toMatch(/kund-sw|serviceWorker|navigator\.serviceWorker/)

    const installPrompt = fs.readFileSync(
      path.join(WEB_ROOT, 'components', 'customer-portal', 'InstallPromptCard.tsx'),
      'utf8',
    )
    expect(installPrompt).toContain('src="/pwa/corevo-icon-192.png"')
    expect(installPrompt).toContain('unoptimized')
    expect(installPrompt).not.toContain('customer-portal-icon')
  })
})
