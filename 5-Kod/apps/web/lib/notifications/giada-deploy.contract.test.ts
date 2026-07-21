import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const deploy = readFileSync(
  resolve(import.meta.dirname, '../../../../../.github/workflows/deploy.yml'),
  'utf8',
)

describe('Giada production secret contract', () => {
  it('installs both server-only Giada values before deployment', () => {
    expect(deploy).toContain('GIADA_SMS_BASE_URL: ${{ secrets.GIADA_SMS_BASE_URL }}')
    expect(deploy).toContain('GIADA_SMS_API_KEY: ${{ secrets.GIADA_SMS_API_KEY }}')
    expect(deploy).toContain('wrangler secret put GIADA_SMS_BASE_URL')
    expect(deploy).toContain('wrangler secret put GIADA_SMS_API_KEY')
  })
})
