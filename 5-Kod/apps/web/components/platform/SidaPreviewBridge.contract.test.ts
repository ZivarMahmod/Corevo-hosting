import { describe, expect, it } from 'vitest'
import { directPreviewHref } from './SidaPreviewBridge.route'

describe('directPreviewHref', () => {
  it('keeps direct preview navigation inside the current preview', () => {
    expect(directPreviewHref('freshcut', '/blogg', '?page=2', '?theme=snitt&copy=preview'))
      .toBe('/salong-preview/freshcut/blogg?theme=snitt&copy=preview&page=2')
    expect(directPreviewHref('freshcut', '/blogg/post', '', '?theme=snitt'))
      .toBe('/salong-preview/freshcut/blogg/post?theme=snitt')
    expect(directPreviewHref('freshcut', '', '', '?theme=freshcut', '#kontakt'))
      .toBe('/salong-preview/freshcut?theme=freshcut#kontakt')
  })
})
