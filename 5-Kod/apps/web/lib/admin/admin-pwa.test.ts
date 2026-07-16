import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/pwa/admin-manifest/route'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function pngSize(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(path.join(WEB_ROOT, 'public', file.replace(/^\//, '')))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('admin-PWA', () => {
  it('har en stabil appidentitet och startar i kalendern', async () => {
    const response = GET()
    const manifest = (await response.json()) as {
      id?: string
      start_url?: string
      scope?: string
      display?: string
    }

    expect(response.headers.get('content-type')).toContain('application/manifest+json')
    expect(manifest.id).toBe('/admin')
    expect(manifest.start_url).toBe('/admin/bokningar?vy=dag')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
  })

  it('annonserar verkliga PNG-ikoner med rätt mått', async () => {
    const manifest = (await GET().json()) as {
      icons: { src: string; sizes: string; type: string }[]
    }

    for (const size of [192, 512]) {
      const icon = manifest.icons.find((candidate) => candidate.sizes === `${size}x${size}`)
      expect(icon?.type).toBe('image/png')
      expect(icon && pngSize(icon.src)).toEqual({ width: size, height: size })
    }
  })

  it('låser inte zoom eller fingernyp i adminlayouten', () => {
    const layout = fs.readFileSync(path.join(WEB_ROOT, 'app', '(admin)', 'layout.tsx'), 'utf8')
    expect(layout).toContain("width: 'device-width'")
    expect(layout).toContain('initialScale: 1')
    expect(layout).not.toContain('userScalable: false')
    expect(layout).not.toContain('maximumScale: 1')
  })
})
