import { test, expect } from 'vitest'
import { unsplashSrcSet } from './img'

const U = 'https://images.unsplash.com/photo-123?w=1600&q=80&auto=format&fit=crop'

test('genererar 4 bredder ur en Unsplash-URL och behåller övriga params', () => {
  const s = unsplashSrcSet(U)
  expect(s).toBeDefined()
  const parts = s!.split(', ')
  expect(parts).toHaveLength(4)
  expect(parts[0]).toBe('https://images.unsplash.com/photo-123?w=480&q=80&auto=format&fit=crop 480w')
  expect(parts[3]).toContain('w=1600')
  expect(parts[3].endsWith(' 1600w')).toBe(true)
})

test('undefined för icke-Unsplash, tom och w-lös URL', () => {
  expect(unsplashSrcSet(null)).toBeUndefined()
  expect(unsplashSrcSet('')).toBeUndefined()
  expect(unsplashSrcSet('/r2/upload.jpg')).toBeUndefined()
  expect(unsplashSrcSet('https://images.unsplash.com/photo-1?q=80')).toBeUndefined()
})
