// goal-36 R4 — proof-floor unit + ENFORCEMENT.
//
// 1. checkProofFloor PASSES a real, non-trivial look (carserv).
// 2. checkProofFloor THROWS on stubs (too few regions / no booking marker).
// 3. ENFORCEMENT: every templates/*.proof.test.ts imports + calls proofFloor —
//    so a copy-paste smoke stub cannot pass as "VERIFIERAD 0FAIL".

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { proofFloor, checkProofFloor } from './proof-floor'
import { CARSERV_REGION_MANIFEST } from '../manifest/carserv'
import { CARSERV_PAGE_HTML } from '../templates/carserv'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(HERE, '..', 'templates')

// 1. accepts a real look — also exercises the describe form.
proofFloor(CARSERV_REGION_MANIFEST, CARSERV_PAGE_HTML)

describe('checkProofFloor rejects stubs', () => {
  it('throws when regions are below the floor', () => {
    expect(() => checkProofFloor({ templateKey: 'carserv', regions: [] }, CARSERV_PAGE_HTML)).toThrow(/regions/)
  })
  it('throws when no <corevo-module> booking marker is woven', () => {
    expect(() => checkProofFloor(CARSERV_REGION_MANIFEST, '<div>no module here</div>')).toThrow(/booking marker|module/)
  })
  it('throws when PAGE_HTML is empty', () => {
    expect(() => checkProofFloor(CARSERV_REGION_MANIFEST, '')).toThrow(/empty/)
  })
})

describe('R4 enforcement: every per-look proof calls proofFloor', () => {
  const proofs = existsSync(TEMPLATES_DIR)
    ? readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.proof.test.ts'))
    : []

  it('finds the per-look proofs', () => {
    expect(proofs.length).toBeGreaterThanOrEqual(3)
  })

  for (const f of proofs) {
    it(`${f} imports and calls proofFloor`, () => {
      const src = readFileSync(join(TEMPLATES_DIR, f), 'utf8')
      expect(src, `${f} must import proofFloor`).toMatch(/import\s*\{[^}]*\bproofFloor\b[^}]*\}\s*from\s*['"][^'"]*proof-floor['"]/)
      expect(src, `${f} must call proofFloor(...)`).toMatch(/\bproofFloor\s*\(/)
    })
  }
})
