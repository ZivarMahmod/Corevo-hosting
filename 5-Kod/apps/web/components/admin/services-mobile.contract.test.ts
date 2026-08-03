import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('services mobile table', () => {
  it('keeps the online and edit actions inside the mobile viewport', () => {
    const source = readFileSync(new URL('./ServicesManager.tsx', import.meta.url), 'utf8')

    expect(source).toContain('<div className="services-table">')
    expect(source).toContain('.services-table .ptable { min-width: 0; table-layout: fixed; }')
    expect(source).toContain('.services-table .ptable td:nth-child(4) { display: none; }')
  })
})
