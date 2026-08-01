import { describe, expect, it } from 'vitest'
import {
  createGiftCardCode,
  hashGiftCardCode,
  normalizeGiftCardCode,
} from './gift-card-code'

const SECRET = 'goal91-test-secret-with-at-least-32-bytes'
const TENANT = '11111111-1111-4111-8111-111111111111'
const REQUEST = '22222222-2222-4222-8222-222222222222'

describe('gift-card-code', () => {
  it('derives one retry-safe 128-bit code and stores only its digest and mask', async () => {
    const first = await createGiftCardCode(TENANT, REQUEST, SECRET)
    const retry = await createGiftCardCode(TENANT, REQUEST, SECRET)

    expect(first).toEqual(retry)
    expect(first.rawCode).toMatch(/^(?:[0-9A-F]{4}-){7}[0-9A-F]{4}$/)
    expect(first.codeHash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.maskedCode).toBe(`••••-${first.lastFour}`)
    expect(first.codeHash).toBe(await hashGiftCardCode(first.rawCode))
  })

  it('normalizes typed separators and changes identity with the request key', async () => {
    const first = await createGiftCardCode(TENANT, REQUEST, SECRET)
    const second = await createGiftCardCode(
      TENANT,
      '33333333-3333-4333-8333-333333333333',
      SECRET,
    )

    expect(normalizeGiftCardCode(` ${first.rawCode.toLowerCase().replaceAll('-', ' ')} `)).toBe(
      first.rawCode.replaceAll('-', ''),
    )
    expect(second.codeHash).not.toBe(first.codeHash)
  })

  it('fails closed without a dedicated strong secret', async () => {
    await expect(createGiftCardCode(TENANT, REQUEST, '')).rejects.toThrow('GIFT_CARD_HMAC_KEY')
    await expect(createGiftCardCode(TENANT, REQUEST, 'too-short')).rejects.toThrow(
      'GIFT_CARD_HMAC_KEY',
    )
  })
})
