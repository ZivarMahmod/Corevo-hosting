import { describe, expect, it } from 'vitest'
import type { SiteEditorTab } from './SidaStudioV2.manifest'
import {
  editorFieldTargets,
  resolveEditorFieldTarget,
  resolveEditorPickMessage,
} from './SidaStudioV2.pick'

const tabs: SiteEditorTab[] = [
  {
    id: 'allmant',
    label: 'Allmänt',
    sub: '',
    path: '',
    cards: [
      { id: 'logo', title: 'Logotyp', imageSlot: 'logo_url' },
      { id: 'footer', title: 'Sidfot', fields: [{ key: 'sharedCopy', label: 'Delad text' }] },
    ],
  },
  {
    id: 'hem',
    label: 'Hem',
    sub: '',
    path: '',
    cards: [
      { id: 'hero', title: 'Hero', fields: [{ key: 'heroTitle', label: 'Rubrik' }] },
      { id: 'hero-images', title: 'Hero-bilder', imageSlot: 'hero_images', imageLimit: 2 },
      { id: 'stats', title: 'Fakta', statsDefaults: [['1', 'En'], ['2', 'Två']] },
    ],
  },
  {
    id: 'kontakt',
    label: 'Kontakt',
    sub: '',
    path: '/kontakt',
    cards: [
      { id: 'contact-copy', title: 'Kontakt', fields: [{ key: 'sharedCopy', label: 'Delad text' }] },
    ],
  },
  {
    id: 'bokning',
    label: 'Bokning',
    sub: '',
    path: '?boka=1',
    cards: [],
  },
]

describe('SidaStudioV2 field target resolver', () => {
  it('derives the allowlist from every enabled manifest tab and its built-in controls', () => {
    const fields = editorFieldTargets(tabs, 'hem').map((target) => target.field)

    expect(fields).toEqual(expect.arrayContaining([
      'heroTitle',
      'sharedCopy',
      'name',
      'color_primary',
      'color_accent',
      'color_bg',
      'color_fg',
      'seo.title',
      'seo.description',
      'contact.email',
      'contact.phone',
      'location.address',
      'social.instagram',
      'social.facebook',
      'social.tiktok',
      'opening_hours.0.time',
      'opening_hours.6.time',
      'booking.variant',
      'booking.pickerMode',
      'booking.staffAvatars',
      'logo_url',
      'hero_images.0',
      'hero_images.1',
      'stats.0.value',
      'stats.0.label',
      'stats.1.value',
      'stats.1.label',
    ]))
  })

  it('selects duplicate ownership from the active tab before manifest order', () => {
    expect(resolveEditorFieldTarget(tabs, 'kontakt', 'sharedCopy')).toMatchObject({
      field: 'sharedCopy',
      tabId: 'kontakt',
      cardId: 'contact-copy',
    })
    expect(resolveEditorFieldTarget(tabs, 'hem', 'sharedCopy')).toMatchObject({
      field: 'sharedCopy',
      tabId: 'allmant',
      cardId: 'footer',
    })
  })

  it('normalizes known storefront aliases and rejects unknown or out-of-range fields', () => {
    expect(resolveEditorFieldTarget(tabs, 'hem', 'tenant.name')?.field).toBe('name')
    expect(resolveEditorFieldTarget(tabs, 'hem', 'branding.hero_images.1')?.field).toBe('hero_images.1')
    expect(resolveEditorFieldTarget(tabs, 'hem', 'openingHours.2.time')?.field).toBe('opening_hours.2.time')
    expect(resolveEditorFieldTarget(tabs, 'hem', 'hours.Onsdag')?.field).toBe('opening_hours.2.time')
    expect(resolveEditorFieldTarget(tabs, 'hem', 'hero_images.2')).toBeNull()
    expect(resolveEditorFieldTarget(tabs, 'hem', 'document.body > a')).toBeNull()
  })

  it('revalidates the source, origin, window and allowlist before resolving a bridge pick', () => {
    const iframeWindow = {} as Window
    const message = {
      origin: 'https://admin.corevo.test',
      source: iframeWindow,
      data: { source: 'corevo-sida', type: 'editor-pick-field', field: 'heroTitle' },
    } as MessageEvent

    expect(resolveEditorPickMessage(message, iframeWindow, 'https://admin.corevo.test', tabs, 'hem'))
      .toMatchObject({ field: 'heroTitle', tabId: 'hem' })
    expect(resolveEditorPickMessage({ ...message, origin: 'https://evil.test' } as MessageEvent, iframeWindow, 'https://admin.corevo.test', tabs, 'hem'))
      .toBeNull()
    expect(resolveEditorPickMessage({ ...message, source: {} as Window } as MessageEvent, iframeWindow, 'https://admin.corevo.test', tabs, 'hem'))
      .toBeNull()
    expect(resolveEditorPickMessage({ ...message, data: { ...message.data, source: 'other' } } as MessageEvent, iframeWindow, 'https://admin.corevo.test', tabs, 'hem'))
      .toBeNull()
    expect(resolveEditorPickMessage({ ...message, data: { ...message.data, field: 'body > a' } } as MessageEvent, iframeWindow, 'https://admin.corevo.test', tabs, 'hem'))
      .toBeNull()
  })
})
