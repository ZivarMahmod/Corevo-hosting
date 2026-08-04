import { describe, expect, it } from 'vitest'
import {
  bloggPageRange,
  formatBloggLongDate,
  formatBloggMonthYear,
  formatBloggShortDate,
  mapBloggPost,
  parseBloggPage,
} from './types'

describe('blogg pagination', () => {
  it('accepts only positive safe integers', () => {
    expect(parseBloggPage(undefined)).toBe(1)
    expect(parseBloggPage('1')).toBe(1)
    expect(parseBloggPage('12')).toBe(12)
    for (const value of ['', '0', '-1', '1.5', '01', 'abc', '9007199254740992', ['2']]) {
      expect(parseBloggPage(value)).toBe(1)
    }
  })

  it('builds inclusive Supabase ranges without overlap', () => {
    expect(bloggPageRange(1, 6)).toEqual({ from: 0, to: 5 })
    expect(bloggPageRange(2, 6)).toEqual({ from: 6, to: 11 })
  })
})

describe('blogg dates', () => {
  it('formats the canonical long and short Swedish dates and hides invalid values', () => {
    expect(formatBloggLongDate('2026-07-04T12:00:00Z')).toBe('4 juli 2026')
    expect(formatBloggShortDate('2026-07-04T12:00:00Z')).toBe('4 juli')
    expect(formatBloggMonthYear('2026-07-04T12:00:00Z')).toBe('Juli 2026')
    expect(formatBloggLongDate('invalid')).toBeNull()
    expect(formatBloggShortDate(null)).toBeNull()
    expect(formatBloggMonthYear(null)).toBeNull()
  })
})

describe('blogg row mapping', () => {
  it('normalizes the joined cover asset and empty tag once for list and detail loaders', () => {
    expect(mapBloggPost({
      id: 'post-1',
      title: 'Rubrik',
      slug: 'rubrik',
      excerpt: null,
      body: 'Text',
      cover_asset_id: 'asset-1',
      published_at: '2026-07-04T12:00:00Z',
      tag: '   ',
      media_assets: [{ url: 'https://cdn.example/post.webp', alt: 'Bukett' }],
    })).toMatchObject({
      coverImageUrl: 'https://cdn.example/post.webp',
      coverImageAlt: 'Bukett',
      tag: null,
    })
  })
})
