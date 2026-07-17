import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CLIENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'client.ts')

describe('Stripe client contract', () => {
  it('pins the payload schema version used by this SDK release', () => {
    const source = readFileSync(CLIENT, 'utf8')

    expect(source).toContain("apiVersion: '2026-05-27.dahlia'")
  })
})
