import { describe, expect, it } from 'vitest'
import { addDomain } from './add-domain.mjs'

function fakeFetch(response) {
  const calls = []
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init })
      return { ok: true, json: async () => response }
    },
  }
}

describe('addDomain', () => {
  it('attaches one exact domain in Cloudflare without editing wrangler.jsonc', async () => {
    const { calls, fetch } = fakeFetch({ success: true, result: {} })
    const out = await addDomain({
      slug: 'velo',
      token: 'token',
      accountId: 'account',
      zoneId: 'zone',
      fetchImpl: fetch,
    })
    expect(out).toEqual({ pattern: 'velo.corevo.se', attached: true })
    expect(calls[0].url).toContain('/accounts/account/workers/domains')
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ hostname: 'velo.corevo.se', zone_id: 'zone' })
  })

  it('fails before Cloudflare for a reserved label', async () => {
    await expect(addDomain({ slug: 'booking', token: 'token' })).rejects.toThrow(/reserved\/POS/)
  })
})
