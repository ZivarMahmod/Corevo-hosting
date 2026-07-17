import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const uploadSurfaces = [
  'lib/r2/upload.ts',
  'lib/admin/media/types.ts',
  'components/admin/BrandingForm.tsx',
  'components/admin/StorefrontMediaForm.tsx',
  'components/platform/CreateTenantForm.tsx',
  'components/platform/PlatformBrandingForm.tsx',
  'components/platform/SidaStudioV2.tsx',
] as const

describe('SVG upload hardening', () => {
  it.each(uploadSurfaces)('%s does not accept user-supplied SVG files', (relativePath) => {
    const source = readFileSync(path.join(WEB_ROOT, relativePath), 'utf8')

    expect(source).not.toContain('image/svg+xml')
  })

  it('keeps the upload error message aligned with the actual safe formats', () => {
    const source = readFileSync(path.join(WEB_ROOT, 'lib/r2/upload.ts'), 'utf8')

    expect(source).not.toMatch(/PNG, JPG, WEBP, SVG eller GIF/)
    expect(source).toMatch(/PNG, JPG, WEBP eller GIF/)
  })
})
