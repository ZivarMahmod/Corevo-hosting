import { describe, expect, it } from 'vitest'
import Page, { metadata } from './page'

describe('/oppna/[tenantSlug]', () => {
  it('is a neutral no-index bootstrap without URL credentials', async () => {
    expect(metadata).toMatchObject({
      robots: { index: false, follow: false },
      referrer: 'no-referrer',
    })

    const element = await Page({ params: Promise.resolve({ tenantSlug: 'freshcut' }) })
    const exchange = element.props.children[0]
    expect(exchange.props).toEqual({ tenantSlug: 'freshcut' })
    expect(exchange.props).not.toHaveProperty('token')
    expect(exchange.props).not.toHaveProperty('secret')
  })

  it('fails closed before rendering when the initial GET contains a query string', async () => {
    await expect(
      Page({
        params: Promise.resolve({ tenantSlug: 'freshcut' }),
        searchParams: Promise.resolve({ token: 'must-never-be-accepted' }),
      }),
    ).rejects.toThrow()
  })
})
