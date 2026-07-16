import { describe, expect, it } from 'vitest'
import { patchPreviewImageSource } from './SidaPreviewBridge'

describe('SidaPreviewBridge responsive image preview', () => {
  it('removes stale responsive candidates for a custom image and restores them for the SSR source', () => {
    const attributes = new Map<string, string>([
      ['src', 'https://images.example/default.jpg'],
      ['srcset', 'https://images.example/default-640.jpg 640w, https://images.example/default-1280.jpg 1280w'],
      ['sizes', '100vw'],
    ])
    const image = {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
      hasAttribute: (name: string) => attributes.has(name),
    } as unknown as HTMLImageElement

    patchPreviewImageSource(image, 'https://r2.example/custom.webp')
    expect(attributes.get('src')).toBe('https://r2.example/custom.webp')
    expect(attributes.has('srcset')).toBe(false)
    expect(attributes.has('sizes')).toBe(false)

    patchPreviewImageSource(image, 'https://images.example/default.jpg')
    expect(attributes.get('srcset')).toContain('default-1280.jpg')
    expect(attributes.get('sizes')).toBe('100vw')
  })
})
