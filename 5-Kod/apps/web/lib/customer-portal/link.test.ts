import { describe, expect, it } from 'vitest'
import { buildPortalLinkFragment, parsePortalLinkFragment } from './link'

const id = '123e4567-e89b-42d3-a456-426614174000'
const secret = 'A'.repeat(43)

describe('customer portal fragment format', () => {
  it('round-trips public link id + raw one-time secret without a query string', () => {
    const fragment = buildPortalLinkFragment({ linkPublicId: id, secret, keyVersion: 1 })
    expect(fragment).toBe(`#v1.${id}.${secret}`)
    expect(fragment).not.toContain('?')
    expect(parsePortalLinkFragment(fragment)).toEqual({ linkPublicId: id, secret, keyVersion: 1 })
  })

  it.each([
    '',
    '#',
    `?token=${secret}`,
    `#${id}.${secret}`,
    `#v1.${id}.short`,
    `#v1.${id}.${secret}.extra`,
    `#v2.${id}.${secret}`,
    `#v1.not-a-uuid.${secret}`,
  ])('rejects malformed or unsupported fragments: %s', (fragment) => {
    expect(parsePortalLinkFragment(fragment)).toBeNull()
  })
})
