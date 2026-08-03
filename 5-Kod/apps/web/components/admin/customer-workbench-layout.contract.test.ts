import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const topnav = readFileSync(new URL('../portal/Topnav.module.css', import.meta.url), 'utf8')
const css = readFileSync(new URL('./kunder-v2.module.css', import.meta.url), 'utf8')
const list = readFileSync(new URL('./CustomerWorkbenchList.tsx', import.meta.url), 'utf8')

describe('customer workbench layout', () => {
  it('fills the shell through the readonly fieldset without a floating inner card', () => {
    expect(topnav).toContain(":has(.main :global(.workbench))")
    expect(css).toMatch(/\.board\s*\{[\s\S]*?border-radius:\s*0;[\s\S]*?box-shadow:\s*none;/)
    expect(css).toMatch(/\.paneInner\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?margin:\s*0;/)
  })

  it('announces filters and the selected customer', () => {
    expect(list).toContain('<h2 className={styles.listTitle}>Kunder</h2>')
    expect(list).toContain('aria-pressed={i === filter}')
    expect(list).toContain("aria-current={selected ? 'page' : undefined}")
  })
})
