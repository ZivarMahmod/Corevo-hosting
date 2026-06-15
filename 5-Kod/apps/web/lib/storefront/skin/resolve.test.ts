import { describe, it, expect } from 'vitest'
import type { Tables } from '@corevo/db'
import { resolveSlots, resolveSkin } from './resolve'

// Template-skin resolution core. Covers: empty inputs degrade to an empty skin
// (today's prod reality — all tables empty), template defaults apply when a tenant
// has no value, tenant content_slots override (text + asset), asset_id resolves to
// the media_assets row (and degrades to url=null when the id is dangling), and
// slots group into sections ordered by template_slots.sort_order.

// ---- row factories (full DB Row shapes; only the relevant fields vary) ----

function tmpl(over: Partial<Tables<'templates'>> = {}): Tables<'templates'> {
  return {
    created_at: '2026-01-01T00:00:00Z',
    key: 'edit',
    name: 'Edit',
    sections: [],
    status: 'active',
    tags: [],
    tokens: {},
    updated_at: null,
    ...over,
  }
}

function tslot(over: Partial<Tables<'template_slots'>> = {}): Tables<'template_slots'> {
  return {
    aspect_hint: null,
    asset_role: null,
    default_asset_key: null,
    default_kind: null,
    default_text: null,
    id: `ts-${over.slot_key ?? 'x'}`,
    kind: 'text',
    label: 'Slot',
    module_key: null,
    module_view: null,
    repeatable: false,
    section_key: 'hero',
    slot_key: 'slot',
    sort_order: 0,
    template_key: 'edit',
    ...over,
  }
}

function cslot(over: Partial<Tables<'content_slots'>> = {}): Tables<'content_slots'> {
  return {
    asset_id: null,
    created_at: '2026-01-01T00:00:00Z',
    id: `cs-${over.slot_key ?? 'x'}`,
    kind: 'text',
    module_ref: null,
    slot_key: 'slot',
    template_key: 'edit',
    tenant_id: 't1',
    text_value: null,
    updated_at: null,
    updated_by: null,
    ...over,
  }
}

function asset(over: Partial<Tables<'media_assets'>> = {}): Tables<'media_assets'> {
  return {
    alt: null,
    content_hash: null,
    created_at: '2026-01-01T00:00:00Z',
    height: null,
    id: 'a1',
    library_item_id: null,
    r2_key: 't/a1.png',
    size_bytes: 1024,
    source: 'upload',
    tenant_id: 't1',
    type: 'image/png',
    updated_at: null,
    url: 'https://pub-test.r2.dev/t/a1.png',
    width: null,
    ...over,
  }
}

// ---------------------------------------------------------------------------

describe('resolveSlots — (a) all-empty inputs', () => {
  it('empty template_slots/content/media → {} (no throw)', () => {
    expect(resolveSlots([], [], [])).toEqual({})
  })
})

describe('resolveSlots — (b) declared slot, NO content → template defaults', () => {
  it('text default applied when no tenant value', () => {
    const slots = resolveSlots([tslot({ slot_key: 'title', default_text: 'Hej' })], [], [])
    expect(slots.title).toEqual({ kind: 'text', slotKey: 'title', value: 'Hej', text: 'Hej' })
  })

  it('asset default surfaces the default_asset_key (url null — key only, no row)', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'hero', kind: 'asset', default_asset_key: 'stock-hero' })],
      [],
      [],
    )
    expect(slots.hero).toEqual({
      kind: 'asset',
      slotKey: 'hero',
      assetId: null,
      url: null,
      alt: null,
      width: null,
      height: null,
      defaultAssetKey: 'stock-hero',
    })
  })

  it('declared slot with NO default of any kind → empty', () => {
    const slots = resolveSlots([tslot({ slot_key: 'bare', kind: 'text' })], [], [])
    expect(slots.bare).toEqual({ kind: 'empty', slotKey: 'bare' })
  })

  it('default_kind overrides the slot kind for the default branch', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'flex', kind: 'text', default_kind: 'asset', default_asset_key: 'k' })],
      [],
      [],
    )
    expect(slots.flex).toMatchObject({ kind: 'asset', defaultAssetKey: 'k' })
  })
})

describe('resolveSlots — (c) content_slot text override', () => {
  it('tenant text_value wins over the template default', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'title', default_text: 'Default' })],
      [cslot({ slot_key: 'title', kind: 'text', text_value: 'Tenant copy' })],
      [],
    )
    expect(slots.title).toEqual({
      kind: 'text',
      slotKey: 'title',
      value: 'Tenant copy',
      text: 'Tenant copy',
    })
  })

  it('a { sv } locale-object text_value is coerced to its sv string', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'title' })],
      [cslot({ slot_key: 'title', kind: 'text', text_value: { sv: 'Svenska' } })],
      [],
    )
    expect(slots.title).toMatchObject({ kind: 'text', text: 'Svenska' })
  })

  it('a non-string/non-{sv} text_value keeps value but text = null', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'title' })],
      [cslot({ slot_key: 'title', kind: 'text', text_value: [1, 2, 3] })],
      [],
    )
    expect(slots.title).toEqual({ kind: 'text', slotKey: 'title', value: [1, 2, 3], text: null })
  })
})

describe('resolveSlots — (d) content_slot asset resolves to media_assets', () => {
  it('asset_id resolves to the media row url/alt/dims', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'hero', kind: 'asset', default_asset_key: 'stock' })],
      [cslot({ slot_key: 'hero', kind: 'asset', asset_id: 'a1' })],
      [asset({ id: 'a1', url: 'https://x/a1.png', alt: 'Hero', width: 1200, height: 600 })],
    )
    expect(slots.hero).toEqual({
      kind: 'asset',
      slotKey: 'hero',
      assetId: 'a1',
      url: 'https://x/a1.png',
      alt: 'Hero',
      width: 1200,
      height: 600,
      defaultAssetKey: 'stock',
    })
  })
})

describe('resolveSlots — (e) asset_id with no matching media_asset', () => {
  it('dangling asset_id → url/alt/dims null (no throw)', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'hero', kind: 'asset' })],
      [cslot({ slot_key: 'hero', kind: 'asset', asset_id: 'missing' })],
      [asset({ id: 'a1' })], // a1 present, 'missing' is not
    )
    expect(slots.hero).toMatchObject({
      kind: 'asset',
      assetId: 'missing',
      url: null,
      alt: null,
      width: null,
      height: null,
    })
  })
})

describe('resolveSlots — module slots', () => {
  it('content module_ref passes through untouched', () => {
    const ref = { module: 'booking', view: 'grid' }
    const slots = resolveSlots(
      [tslot({ slot_key: 'embed', kind: 'module', module_key: 'booking' })],
      [cslot({ slot_key: 'embed', kind: 'module', module_ref: ref })],
      [],
    )
    expect(slots.embed).toEqual({ kind: 'module', slotKey: 'embed', moduleRef: ref })
  })

  it('declared module with no content → module with null ref (declared, unset)', () => {
    const slots = resolveSlots(
      [tslot({ slot_key: 'embed', kind: 'module', module_key: 'booking' })],
      [],
      [],
    )
    expect(slots.embed).toEqual({ kind: 'module', slotKey: 'embed', moduleRef: null })
  })
})

describe('resolveSkin — (f) sections grouped + ordered by sort_order', () => {
  it('groups slots into sections, both ordered by sort_order', () => {
    const templateSlots: Tables<'template_slots'>[] = [
      tslot({ slot_key: 'cta', section_key: 'footer', sort_order: 30, default_text: 'Boka' }),
      tslot({ slot_key: 'title', section_key: 'hero', sort_order: 10, default_text: 'Rubrik' }),
      tslot({ slot_key: 'lede', section_key: 'hero', sort_order: 20, default_text: 'Ingress' }),
    ]
    const skin = resolveSkin(tmpl({ key: 'edit' }), templateSlots, [], [])

    // hero comes before footer (first hero slot sort_order 10 < footer's 30).
    expect(skin.sections.map((s) => s.sectionKey)).toEqual(['hero', 'footer'])
    // within hero: title (10) then lede (20).
    expect(skin.sections[0]!.slots.map((s) => s.slotKey)).toEqual(['title', 'lede'])
    expect(skin.sections[1]!.slots.map((s) => s.slotKey)).toEqual(['cta'])
    // flat slot map carries every declared slot too.
    expect(Object.keys(skin.slots).sort()).toEqual(['cta', 'lede', 'title'])
  })

  it('empty inputs → empty-but-valid skin (no throw)', () => {
    const skin = resolveSkin(tmpl({ key: 'edit' }), [], [], [])
    expect(skin).toEqual({
      templateKey: 'edit',
      tokens: {},
      cssVars: {},
      slots: {},
      sections: [],
    })
  })

  it('parses tokens into cssVars on the resolved skin', () => {
    const skin = resolveSkin(
      tmpl({ key: 'edit', tokens: { color: { bg: '#111' } } }),
      [],
      [],
      [],
    )
    expect(skin.tokens).toEqual({ color: { bg: '#111' } })
    expect(skin.cssVars).toEqual({ '--sf-color-bg': '#111' })
  })
})
