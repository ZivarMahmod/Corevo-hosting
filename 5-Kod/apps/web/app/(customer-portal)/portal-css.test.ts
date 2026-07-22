import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = () => readFileSync(new URL('./portal.css', import.meta.url), 'utf8')

describe('customer portal canonical CSS', () => {
  it('carries the exact design tokens instead of re-derived values', () => {
    const source = css()
    for (const token of [
      '--bg:#121210', '--surface-1:#1C1C18', '--surface-2:#25251F', '--surface-3:#2E2E28',
      '--ink-1:#F0F0EA', '--ink-2:#C8C8BD', '--ink-3:#96968C', '--line-1:#33332C',
      '--line-2:#4A4A41', '--action:#2F5F47', '--action-hover:#3A7357',
      '--action-text:#E9F2EC', '--positive:#9AC4A5', '--warning:#D6AC6A',
      '--negative:#D68F85', '--tap-min:44px', '--button-primary-h:48px',
      '--topbar-h-mobile:60px', '--topbar-h-desktop:56px', '--container-tablet:760px',
      '--container-desktop:1248px', '--col-left:232px', '--col-main:680px',
      '--col-right:288px', '--layout-gap:24px',
    ]) expect(source.replace(/\s/g, '')).toContain(token)
  })

  it('implements the canonical responsive navigation and all acceptance breakpoints', () => {
    const source = css()
    expect(source).toMatch(/\.cp-bottomnav\s*\{[^}]*position:\s*fixed/s)
    expect(source).toMatch(/\.cp-sidenav\s*\{[^}]*display:\s*none/s)
    expect(source).toContain('@media (min-width:390px)')
    expect(source).toMatch(/@media \(max-width:359px\)[\s\S]*\.cp-identity\s*\{[^}]*flex-direction:\s*column/)
    expect(source).toContain('@media (min-width:768px)')
    expect(source).toContain('@media (min-width:1024px)')
    expect(source).toContain('@media (min-width:1248px)')
    expect(source).toMatch(/@media \(min-width:1024px\)[\s\S]*\.cp-bottomnav\s*\{[^}]*display:\s*none/)
    expect(source).toMatch(/@media \(min-width:1024px\)[\s\S]*\.cp-sidenav\s*\{[^}]*display:\s*block/)
  })

  it('keeps focus visible and disables motion when the user requests it', () => {
    const source = css()
    expect(source).toContain(':focus-visible')
    expect(source).toContain('outline:var(--focus-ring-width) solid var(--focus-ring)')
    expect(source).toContain('@media (prefers-reduced-motion:reduce)')
    expect(source).toContain('transition-duration:0ms!important')
    expect(source).toMatch(/@media \(prefers-reduced-motion:reduce\)[\s\S]*\.cp-skip\s*\{[^}]*top:\s*-100%;[^}]*transform:\s*none/)
    expect(source).toMatch(/@media \(prefers-reduced-motion:reduce\)[\s\S]*\.cp-skip:focus\s*\{[^}]*top:\s*var\(--space-2\)/)
    expect(source).toContain('@media (prefers-contrast:more)')
    expect(source).toContain('@media (forced-colors:active)')
  })
})
