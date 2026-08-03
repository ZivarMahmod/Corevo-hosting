import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(
  fs.readFileSync(path.join(WEB_ROOT, 'public', 'pwa', 'admin.webmanifest'), 'utf8'),
)

function pngSize(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(path.join(WEB_ROOT, 'public', file.replace(/^\//, '')))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('admin-PWA', () => {
  it('har en stabil appidentitet och startar i kalendern', () => {
    const typedManifest = manifest as {
      id?: string
      start_url?: string
      scope?: string
      display?: string
    }

    expect(typedManifest.id).toBe('/admin')
    expect(typedManifest.start_url).toBe('/admin/bokningar?vy=dag')
    expect(typedManifest.scope).toBe('/')
    expect(typedManifest.display).toBe('standalone')
  })

  it('annonserar verkliga PNG-ikoner med rätt mått', () => {
    const typedManifest = manifest as {
      icons: { src: string; sizes: string; type: string }[]
    }

    for (const size of [192, 512]) {
      const icon = typedManifest.icons.find((candidate) => candidate.sizes === `${size}x${size}`)
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
