import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResolvedSkin } from './types'

const { loadTenantSkin } = vi.hoisted(() => ({ loadTenantSkin: vi.fn() }))

vi.mock('./load-skin', () => ({ loadTenantSkin }))

import { resolveStorefrontSkinContent } from './content'

const skin: ResolvedSkin = {
  templateKey: 'salvia',
  tokens: {},
  cssVars: {},
  slots: {
    'hero.title': {
      kind: 'text',
      slotKey: 'hero.title',
      value: 'Samma rubrik',
      text: 'Samma rubrik',
    },
  },
  sections: [],
  hasTenantContent: true,
  authoredSlotKeys: ['hero.title'],
}

describe('shared storefront skin content', () => {
  beforeEach(() => loadTenantSkin.mockReset())

  it('applies authored Salvia content once through the shared resolver', async () => {
    loadTenantSkin.mockResolvedValue(skin)

    await expect(
      resolveStorefrontSkinContent('tenant-1', 'salvia', { heroTitle: 'Bas' }, {}),
    ).resolves.toMatchObject({ copy: { heroTitle: 'Samma rubrik' } })
    expect(loadTenantSkin).toHaveBeenCalledOnce()
    expect(loadTenantSkin).toHaveBeenCalledWith('tenant-1', 'salvia')
  })

  it('does not start a second skin path for other themes', async () => {
    await expect(
      resolveStorefrontSkinContent('tenant-1', 'snitt', { heroTitle: 'Bas' }, {}),
    ).resolves.toMatchObject({ copy: { heroTitle: 'Bas' } })
    expect(loadTenantSkin).not.toHaveBeenCalled()
  })

  it('keeps the existing content when Salvia has no authored slots', async () => {
    loadTenantSkin.mockResolvedValue({ ...skin, hasTenantContent: false, authoredSlotKeys: [] })

    await expect(
      resolveStorefrontSkinContent('tenant-1', 'salvia', { heroTitle: 'Bas' }, {}),
    ).resolves.toMatchObject({ copy: { heroTitle: 'Bas' } })
  })

  it('is the only skin-content path used by public home and preview home', () => {
    const webRoot = resolve(import.meta.dirname, '..', '..', '..')
    const publicPage = readFileSync(resolve(webRoot, 'app', '(public)', 'page.tsx'), 'utf8')
    const previewPage = readFileSync(
      resolve(webRoot, 'app', 'salong-preview', '[slug]', 'page.tsx'),
      'utf8',
    )

    for (const source of [publicPage, previewPage]) {
      expect(source).toContain('resolveStorefrontSkinContent(')
      expect(source).not.toContain('loadTenantSkin(')
      expect(source).not.toContain('applySkinOverlay(')
    }
  })
})
