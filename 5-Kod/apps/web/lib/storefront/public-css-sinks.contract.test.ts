import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const STORED_CSS_BREAKOUT = '</style><script>alert("stored-css-xss")</script><style>'

const surfaces = [
  ['public storefront', 'app/(public)/layout.tsx'],
  ['booking shell', 'app/boka/layout.tsx'],
  ['cancellation shell', 'app/avboka/[id]/page.tsx'],
] as const

function sourceAt(relativePath: string): string {
  return readFileSync(path.join(WEB_ROOT, relativePath), 'utf8')
}

function simulateStoredCssSink(source: string, css: string): string {
  const readsStoredCss = source.includes('settings.customOverride?.css')
  const rendersRawHtml = source.includes('dangerouslySetInnerHTML')
  return readsStoredCss && rendersRawHtml ? `<style>${css}</style>` : ''
}

describe('public tenant CSS sinks', () => {
  it.each(surfaces)('%s never renders stored custom CSS as raw style HTML', (_label, relativePath) => {
    const source = sourceAt(relativePath)
    const simulatedHtml = simulateStoredCssSink(source, STORED_CSS_BREAKOUT)

    expect(simulatedHtml).not.toContain('<script>')
    expect(source).not.toContain('settings.customOverride?.css')
    expect(source).not.toContain('dangerouslySetInnerHTML')
  })

  it.each(surfaces)('%s retains safe token branding', (_label, relativePath) => {
    const source = sourceAt(relativePath)

    expect(source).toContain("import { injectTenantTokens } from '@corevo/ui'")
    expect(source).toContain('style={injectTenantTokens(settings.branding) as CSSProperties}')
  })
})
