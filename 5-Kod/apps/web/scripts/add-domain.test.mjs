import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addDomain } from './add-domain.mjs'

const WR = `{
  // keep me
  "name": "bokningsplatformen",
  "routes": [
    { "pattern": "booking.corevo.se", "custom_domain": true },
    { "pattern": "superbooking.corevo.se", "custom_domain": true },
    { "pattern": "minbooking.corevo.se", "custom_domain": true },
    { "pattern": "mina.corevo.se", "custom_domain": true },
    { "pattern": "*.boka.corevo.se/*", "zone_name": "corevo.se" }
  ]
}
`

let dir, wranglerPath
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fix35-'))
  wranglerPath = join(dir, 'wrangler.jsonc')
  writeFileSync(wranglerPath, WR, 'utf8')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

// A mock CF fetch that always succeeds + records PUTs.
function mockFetch(puts) {
  return async (url, init) => {
    if (init?.method === 'PUT') puts.push({ url, body: JSON.parse(init.body) })
    return { ok: true, status: 200, json: async () => ({ success: true, result: {} }) }
  }
}

describe('addDomain', () => {
  it('file-protects WITHOUT a token (added, not attached), comments preserved', async () => {
    const out = await addDomain({ wranglerPath, slug: 'klippstudio' })
    expect(out).toMatchObject({ added: true, attached: false, pattern: 'klippstudio.corevo.se' })
    const text = readFileSync(wranglerPath, 'utf8')
    expect(text).toContain('{ "pattern": "klippstudio.corevo.se", "custom_domain": true }')
    expect(text).toContain('keep me')
  })

  it('refuses a reserved slug BEFORE writing anything', async () => {
    await expect(addDomain({ wranglerPath, slug: 'mina' })).rejects.toThrow(/reserved\/POS/)
    expect(readFileSync(wranglerPath, 'utf8')).toBe(WR) // file untouched
  })

  it('with a token: file-protects AND live-attaches with the right body', async () => {
    const puts = []
    const out = await addDomain({
      wranglerPath,
      slug: 'klippstudio',
      token: 'tok',
      accountId: 'acct',
      zoneId: 'z1',
      fetchImpl: mockFetch(puts),
    })
    expect(out).toMatchObject({ added: true, attached: true })
    expect(puts).toHaveLength(1)
    expect(puts[0].url).toContain('/accounts/acct/workers/domains')
    expect(puts[0].body).toEqual({
      environment: 'production',
      hostname: 'klippstudio.corevo.se',
      service: 'bokningsplatformen',
      zone_id: 'z1',
    })
  })

  it('is idempotent — second call does not re-add the file line', async () => {
    await addDomain({ wranglerPath, slug: 'klippstudio' })
    const out2 = await addDomain({ wranglerPath, slug: 'klippstudio' })
    expect(out2.added).toBe(false)
    const occurrences = readFileSync(wranglerPath, 'utf8').split('klippstudio.corevo.se').length - 1
    expect(occurrences).toBe(1)
  })
})
