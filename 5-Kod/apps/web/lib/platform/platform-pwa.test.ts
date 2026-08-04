import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(
  fs.readFileSync(path.join(WEB_ROOT, 'public', 'pwa', 'platform.webmanifest'), 'utf8'),
)

function pngSize(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(path.join(WEB_ROOT, 'public', file.replace(/^\//, '')))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('platform-PWA', () => {
  it('har en egen stabil appidentitet och startar i plattformen', () => {
    expect(manifest).toMatchObject({
      name: 'Corevo Platform',
      id: '/platform',
      start_url: '/platform',
      scope: '/',
      display: 'standalone',
    })
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

})
