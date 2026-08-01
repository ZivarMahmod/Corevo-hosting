import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { themeContentCompatibility } from '@/lib/platform/theme-capabilities'

const WEB_ROOT = path.resolve(__dirname, '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('safe storefront template switch', () => {
  it('requires one of two copy choices and keeps preview equal to publish', () => {
    const picker = read('components/platform/ThemePicker.tsx')
    const studio = read('components/platform/SidaStudioV2.tsx')
    const action = read('lib/platform/actions/theme.ts')

    expect(picker).toContain('name="copyMode"')
    expect(picker).toContain('value="keep"')
    expect(picker).toContain('value="template"')
    expect(picker).toContain('useState<ThemeCopyMode | null>(null)')
    expect(picker).toContain('disabled={pending || copyMode === null}')
    expect(picker).toContain('Kontroll före mallbyte:')
    expect(studio).toContain('contentSlotKeys={[')
    expect(picker).toContain("onPreview?.(key, 'keep')")
    expect(picker).toContain('onClick={() => pick(current)}')
    expect(studio).toContain("q.set('copy', previewCopyMode)")
    expect(studio).toContain("previewCopyMode === 'template'")
    expect(studio).toContain('if (previewingTemplateDefaults) return')
    expect(action).toContain("fd.get('copyMode')")
    expect(action).toContain('materializeThemeCopy')

    const previewRoot = path.join(WEB_ROOT, 'app', 'salong-preview')
    const previewFiles = fs.readdirSync(previewRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('getTenantCopy('))

    expect(previewFiles).toHaveLength(10)
    for (const file of previewFiles) {
      expect(fs.readFileSync(file, 'utf8'), file).toMatch(
        /getTenantCopy\([^)]*theme,\s*copyMode,?\s*\)/,
      )
    }
  })

  it('reports current content that the selected theme hides without deleting it', () => {
    const hidden = themeContentCompatibility(
      'freshcut',
      'snitt',
      ['heroTitle', 'gallery_images', 'homeSecondTitle'],
    )
    expect(hidden).toContain('galleri på startsidan')
    expect(hidden).toContain('Rubrik, mittensektionen')
    expect(hidden).not.toContain('heroTitle')
  })
})
