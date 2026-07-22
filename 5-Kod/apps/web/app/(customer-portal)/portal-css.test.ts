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

  it('keeps the exact avatar, card-gap and centered desktop topbar contracts', () => {
    const source = css()
    expect(source).toMatch(/\.cp-tenant-avatar\s*\{[^}]*background:\s*var\(--surface-2\);[^}]*color:\s*var\(--ink-1\)/s)
    expect(source).not.toContain('.cp-card+.cp-card')
    expect(source).toMatch(/\.cp-topbar-inner\s*\{[^}]*max-width:\s*var\(--container-desktop\);[^}]*margin:\s*(?:0\s+)?auto/s)
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

  it('implements the canonical cancellation sheet, destructive action and desktop dialog', () => {
    const source = css()
    expect(source).toMatch(/\.cp-cancel-layer\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*var\(--z-scrim\)/s)
    expect(source).toMatch(/\.cp-cancel-scrim\s*\{[^}]*background:\s*rgba\(0,0,0,\.56\)/s)
    expect(source).toMatch(/\.cp-cancel-layer\s*\{[^}]*align-items:\s*flex-end/s)
    expect(source).toMatch(/\.cp-cancel-dialog\s*\{[^}]*position:\s*relative;[^}]*max-height:\s*calc\(100dvh - 16px\);[^}]*overflow-y:\s*auto/s)
    expect(source).toMatch(/\.cp-cancel-handle\s*\{[^}]*width:\s*32px;[^}]*height:\s*4px;[^}]*background:\s*var\(--line-2\)/s)
    expect(source).toMatch(/\.cp-btn-danger\s*\{[^}]*border-color:\s*var\(--negative\);[^}]*color:\s*var\(--negative\)!important/s)
    expect(source).toMatch(/@media \(min-width:1024px\)[\s\S]*\.cp-cancel-layer\s*\{[^}]*align-items:\s*center/s)
    expect(source).toMatch(/@media \(min-width:1024px\)[\s\S]*\.cp-cancel-dialog\s*\{[^}]*max-width:\s*440px;[^}]*background:\s*var\(--surface-3\);[^}]*box-shadow:\s*var\(--shadow-dialog\)/s)
    expect(source).toMatch(/@media \(prefers-reduced-motion:reduce\)[\s\S]*\.cp-cancel-dialog\s*\{[^}]*transform:\s*none/)
  })

  it('keeps the 320px and 768px states as full-width bottom sheets and switches at 1024px only', () => {
    const source = css()
    expect(source).toMatch(/\.cp-cancel-dialog\s*\{[^}]*width:\s*100%;[^}]*border-radius:\s*var\(--radius-dialog\) var\(--radius-dialog\) 0 0/s)
    const tablet = source.match(/@media \(min-width:768px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(tablet).not.toContain('.cp-cancel-dialog')
    expect(source).toMatch(/@media \(min-width:1024px\)[\s\S]*\.cp-cancel-layer\s*\{[^}]*align-items:\s*center/s)
    expect(source).toMatch(/@media \(min-width:1024px\)[\s\S]*\.cp-cancel-dialog\s*\{[^}]*max-width:\s*440px/s)
  })

  it('defines a 140ms exit and collapses it to 0ms for reduced motion', () => {
    const source = css()
    expect(source).toMatch(/\.cp-cancel-layer\[data-closing="true"\][^{]*\{[^}]*animation:[^;}]*140ms/s)
    expect(source).toMatch(/\.cp-cancel-layer\[data-closing="true"\][\s\S]*\.cp-cancel-dialog\s*\{[^}]*animation:[^;}]*140ms/s)
    expect(source).toMatch(/@media \(prefers-reduced-motion:reduce\)[\s\S]*\.cp-cancel-layer\[data-closing="true"\][^{]*\{[^}]*animation-duration:\s*0ms!important/s)
  })

  it('fully scopes body-portaled cancellation UI to the portal box, font, focus and motion contracts', () => {
    const source = css()
    expect(source).toMatch(/\.cp-cancel-layer,\.cp-cancel-layer \*,\.cp-cancel-toast\s*\{[^}]*box-sizing:\s*border-box/s)
    expect(source).toMatch(/\.cp-cancel-layer,\.cp-cancel-toast\s*\{[^}]*font:\s*var\(--text-body-weight\) var\(--text-body-size\)\/var\(--text-body-line\) var\(--font-ui\)/s)
    expect(source).toMatch(/\.cp-cancel-layer button\s*\{[^}]*font:\s*inherit/s)
    expect(source).toMatch(/\.cp-cancel-layer :focus-visible,\.cp-cancel-toast:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring-width\) solid var\(--focus-ring\);[^}]*outline-offset:\s*var\(--focus-ring-offset\)/s)
    expect(source).toMatch(/\.cp-cancel-dialog h2\s*\{[^}]*font-size:\s*var\(--text-h2-size\);[^}]*line-height:\s*var\(--text-h2-line\);[^}]*font-weight:\s*var\(--text-h2-weight\)/s)
    expect(source).toMatch(/\.cp-cancel-toast\s*\{[^}]*margin:\s*0/s)
    expect(source).toMatch(/@media \(prefers-reduced-motion:reduce\)[\s\S]*\.cp-cancel-layer,\.cp-cancel-layer \*,\.cp-cancel-toast\s*\{[^}]*transition-duration:\s*0ms!important;[^}]*animation-duration:\s*0ms!important/s)
    expect(source).toMatch(/@media \(forced-colors:active\)[\s\S]*\.cp-cancel-layer :focus-visible,\.cp-cancel-toast:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring-width\) solid Highlight/s)
  })

  it('keeps the calendar download action full-width on mobile with exact status tokens', () => {
    const source = css()
    expect(source).toMatch(/\.cp-calendar-download\s*\{[^}]*width:\s*100%;[^}]*display:\s*grid;[^}]*gap:\s*var\(--space-2\)/s)
    expect(source).toMatch(/\.cp-calendar-download \.cp-btn\s*\{[^}]*width:\s*100%/s)
    expect(source).toMatch(/\.cp-calendar-status\s*\{[^}]*font:\s*var\(--text-meta-weight\) var\(--text-meta-size\)\/var\(--text-meta-line\) var\(--font-ui\)/s)
    expect(source).toMatch(/\.cp-calendar-status-success\s*\{[^}]*color:\s*var\(--positive\)!important/s)
    expect(source).toMatch(/\.cp-calendar-status-error\s*\{[^}]*color:\s*var\(--negative\)!important/s)
    expect(source).toMatch(/@media \(min-width:768px\)[\s\S]*\.cp-calendar-download\s*\{[^}]*width:\s*auto/s)
  })
})
