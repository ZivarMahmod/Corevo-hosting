import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./NavShell.tsx', import.meta.url), 'utf8')

describe('NavShell layout contract', () => {
  it('writes measured nav height where storefront roots can inherit it', () => {
    expect(source).toContain("closest<HTMLElement>('[data-world=\"storefront\"]')")
    expect(source).toContain("target.style.setProperty('--nav-h'")
  })
})
