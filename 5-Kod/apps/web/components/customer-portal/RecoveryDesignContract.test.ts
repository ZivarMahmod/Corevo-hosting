import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'app/(customer-portal)/portal.css'), 'utf8')
  .replace(/\s+/g, '')

describe('recovery canonical CSS contract', () => {
  it('uses the canonical form-card spacing and narrow recovery container', () => {
    expect(css).toContain('.cp-layout-recoverymain{max-width:440px;')
    expect(css).toContain('.cp-recovery-card{width:100%;padding:var(--space-4);')
    expect(css).toMatch(/@media\(min-width:768px\)[\s\S]*?\.cp-recovery-card\{padding:var\(--space-5\)\}/)
    const tabletRules = css.slice(css.indexOf('@media(min-width:768px)'), css.indexOf('@media(min-width:1024px)'))
    expect(tabletRules).toContain('.cp-layout-recoverymain{max-width:440px;margin:0auto;padding:0}')
  })

  it('uses the premium graphite toast with exact placement and canonical stacking', () => {
    expect(css).toContain('.cp-toast{position:fixed;z-index:var(--z-toast);right:var(--space-4);bottom:calc(var(--bottomnav-h)+var(--space-4));')
    expect(css).toContain('padding:var(--space-3)var(--space-4);background:var(--surface-dark);border:var(--border-width)solidrgba(255,255,255,.1);border-radius:14px;color:#fff!important;box-shadow:var(--shadow-card)')
    expect(css).toContain('.cp-toast.cp-icon{width:var(--icon-md);height:var(--icon-md)}')
    expect(css).toMatch(/@media\(min-width:1024px\)[\s\S]*?\.cp-toast\{bottom:var\(--space-4\)\}/)
  })

  it('uses exact disabled surfaces, opacity and 16px error icons', () => {
    expect(css).toContain('.cp-input:disabled{background:var(--surface-1);color:var(--ink-3);cursor:not-allowed}')
    expect(css).toContain('.cp-btn:disabled,.cp-btn[aria-disabled="true"]{cursor:not-allowed;opacity:.45}')
    expect(css).toContain('.cp-form-error.cp-icon{width:var(--icon-sm);height:var(--icon-sm);')
  })
})
