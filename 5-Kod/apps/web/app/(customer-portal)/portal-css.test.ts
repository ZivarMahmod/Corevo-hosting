import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = () => readFileSync(new URL('./portal.css', import.meta.url), 'utf8')

describe('customer portal canonical CSS', () => {
  it('carries the approved premium design tokens instead of the retired dark theme', () => {
    const source = css()
    for (const token of [
      '--bg:#f3efe6', '--surface-1:#fffdf8', '--surface-2:#faf7f0', '--surface-dark:#191a17',
      '--ink-1:#20211d', '--ink-2:#74736b', '--ink-3:#99968d', '--line-1:#ddd7ca',
      '--line-2:#cbbca9', '--action:#191a17', '--action-hover:#25261f',
      '--action-text:#fffdf8', '--copper:#a97141', '--copper-light:#deb68d',
      '--positive:#466a57', '--negative:#9d4a42', '--tap-min:44px',
      '--button-primary-h:48px', '--container-tablet:760px',
      '--container-desktop:1160px', '--col-left:250px', '--col-main:760px',
      '--layout-gap:40px',
    ]) expect(source.replace(/\s/g, '')).toContain(token)
    expect(source).toContain('--font-display:var(--font-spectral),"Spectral",Georgia')
    expect(source).not.toContain('--bg:#121210')
  })

  it('implements the canonical responsive navigation and all acceptance breakpoints', () => {
    const source = css()
    expect(source).toMatch(/\.cp-bottomnav\s*\{[^}]*position:\s*fixed/s)
    expect(source).toMatch(/\.cp-sidenav\s*\{[^}]*display:\s*none/s)
    expect(source).toContain('@media (min-width:390px)')
    expect(source).toMatch(/@media \(max-width:359px\)[\s\S]*\.cp-identity\s*\{[^}]*flex-direction:\s*column/)
    expect(source).toContain('@media (min-width:780px)')
    expect(source).toMatch(/@media \(min-width:780px\)[\s\S]*\.cp-bottomnav\s*\{[^}]*display:\s*none/)
    expect(source).toMatch(/@media \(min-width:780px\)[\s\S]*\.cp-sidenav\s*\{[^}]*display:\s*flex/)
    expect(source).toMatch(/\.cp-bottomnav\s*\{[^}]*background:\s*var\(--surface-dark\)/s)
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

  it('implements the canonical contact-change sheet and its independent 768px dialog breakpoint', () => {
    const source = css()
    expect(source).toMatch(/\.cp-contact-change-layer\s*\{[^}]*position:\s*fixed;[^}]*align-items:\s*flex-end/s)
    expect(source).toMatch(/\.cp-contact-change-scrim\s*\{[^}]*background:\s*rgba\(0,0,0,\.56\)/s)
    expect(source).toMatch(/\.cp-contact-change-dialog\s*\{[^}]*width:\s*100%;[^}]*max-height:\s*calc\(100dvh - 16px\);[^}]*background:\s*var\(--surface-2\)/s)
    expect(source).toMatch(/\.cp-contact-change-handle\s*\{[^}]*width:\s*32px;[^}]*height:\s*4px/s)
    expect(source).toMatch(/@media \(min-width:768px\)[\s\S]*\.cp-contact-change-layer\s*\{[^}]*align-items:\s*center/s)
    expect(source).toMatch(/@media \(min-width:768px\)[\s\S]*\.cp-contact-change-dialog\s*\{[^}]*max-width:\s*440px;[^}]*background:\s*var\(--surface-3\)/s)
    expect(source).toMatch(/@media \(prefers-reduced-motion:reduce\)[\s\S]*\.cp-contact-change-dialog\s*\{[^}]*transform:\s*none/s)
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

  it('keeps long profile content inside the viewport and preserves DOM button order at desktop', () => {
    const source = css()
    expect(source).toMatch(/\.customer-portal\s*\{[^}]*overflow-x:\s*hidden/s)
    expect(source).toMatch(/\.cp-profile-name>div\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/s)
    expect(source).toMatch(/\.cp-contact-copy\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/s)
    expect(source).toMatch(/\.cp-menu-copy\s*\{[^}]*min-width:\s*0/s)
    expect(source).toMatch(/\.cp-name-actions\s*\{[^}]*flex-direction:\s*column(?:;|\})/s)
    expect(source).not.toMatch(/\.cp-name-actions\s*\{[^}]*flex-direction:\s*column-reverse/s)
    expect(source).toMatch(/@media \(min-width:768px\)[\s\S]*\.cp-name-actions\s*\{[^}]*flex-direction:\s*row/s)
  })
})
