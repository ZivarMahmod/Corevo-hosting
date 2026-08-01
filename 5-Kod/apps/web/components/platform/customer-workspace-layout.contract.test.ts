import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (name: string) => fs.readFileSync(path.resolve(__dirname, name), 'utf8')

describe('goal-80 superadmin customer workspace design contract', () => {
  it('protects the full-width detail pane and wrapping customer tabs', () => {
    const board = read('kunder-v2.module.css')
    const detail = read('tenant-detail.module.css')

    expect(board).toMatch(/\.pane\s*\{[^}]*min-width:\s*0;/s)
    expect(board).toMatch(/\.paneInner\s*\{[^}]*max-width:\s*1320px;/s)
    expect(detail).toMatch(
      /\.subtabs\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*6px;/s,
    )
    expect(detail).toMatch(
      /\.twoCol\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.5fr\)\s+minmax\(0,\s*1fr\);/s,
    )
    expect(detail).toMatch(/\.col\s*\{[^}]*min-width:\s*0;/s)
  })
})
