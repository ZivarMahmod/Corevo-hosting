// XSS-sanerare — adversariell fuzz-svit (Sajtbyggare S2).
//
// Saneraren körs vid SPAR (server-action), aldrig per render-request. Den MÅSTE:
//   (a) strippa ALLA exekverbara vektorer (script/handlers/javascript:/data:/srcset/
//       style/expression()/nästlade-missformade moduler), och
//   (b) BEHÅLLA en giltig <corevo-module type="booking" pos="reservation"> intakt
//       (type+pos) — annars väver render-bron inte in modulen.
//
// Sviten kör mot den RIKTIGA edge-allowlist-saneraren (html-react-parser → htmlparser2),
// ALDRIG jsdom/DOMPurify. Bevis i BÅDA riktningar (rad: goal-37 maxning §2).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  sanitizeHtml,
  isSafeUrl,
  sanitizeColor,
  sanitizeFontFamily,
  KNOWN_MODULE_TYPES,
} from './sanitize'

describe('sanitizeHtml — strips executable vectors', () => {
  it('strips <script> tag AND its text content', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).toContain('ok')
    expect(out.toLowerCase()).not.toContain('<script')
    expect(out).not.toContain('alert(1)')
  })

  it('strips on* event handlers from allowlisted tags', () => {
    const out = sanitizeHtml('<a href="https://ok.se" onclick="steal()">x</a>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('steal')
    expect(out).toContain('https://ok.se') // safe href kept
  })

  it('strips onerror on a non-allowlisted carrier (img) — whole tag dropped', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">')
    expect(out.toLowerCase()).not.toContain('<img')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('alert')
  })

  it('neutralizes javascript: in href (drops the attribute, keeps text)', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(out.toLowerCase()).not.toContain('javascript:')
    expect(out).toContain('click')
  })

  it('catches entity/whitespace-obfuscated javascript: (parser decodes first)', () => {
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false)
    expect(isSafeUrl('  JaVaScRiPt:alert(1)')).toBe(false)
    const out = sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>')
    expect(out.toLowerCase()).not.toContain('javascript:')
  })

  it('srcset vector: <img srcset="…javascript:…"> — carrier not allowlisted → dropped', () => {
    const out = sanitizeHtml('<img srcset="x.jpg, javascript:alert(1) 2x">')
    expect(out).not.toContain('srcset')
    expect(out.toLowerCase()).not.toContain('javascript:')
  })

  it('style/expression vector: inline style attr stripped from allowlisted tag', () => {
    const out = sanitizeHtml('<p style="background:url(javascript:alert(1))">hi</p>')
    expect(out).not.toContain('style')
    expect(out.toLowerCase()).not.toContain('javascript:')
    expect(out).toContain('hi')
  })

  it('legacy CSS expression() never survives (no raw style passthrough)', () => {
    const out = sanitizeHtml('<p style="width:expression(alert(1))">x</p>')
    expect(out.toLowerCase()).not.toContain('expression(')
    expect(out).not.toContain('style')
  })

  it('data: URI in href is rejected', () => {
    expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    const out = sanitizeHtml('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>')
    expect(out).not.toContain('data:text/html')
  })

  it('data:image/svg+xml with onload is rejected as a URL', () => {
    expect(isSafeUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false)
  })

  it('strips <iframe>/<object>/<embed> entirely (subtree gone)', () => {
    const out = sanitizeHtml('<iframe src="evil"></iframe><object data="x"></object><embed src="y">')
    expect(out.toLowerCase()).not.toMatch(/<iframe|<object|<embed/)
  })

  it('strips inline <style> blocks including their CSS text', () => {
    const out = sanitizeHtml('<style>body{background:url(javascript:alert(1))}</style><p>ok</p>')
    expect(out.toLowerCase()).not.toContain('<style')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('ok')
  })

  it('escapes stray < > & in text so re-injection is impossible', () => {
    const out = sanitizeHtml('<p>5 < 6 && 7 > 2</p>')
    expect(out).toContain('&lt;')
    expect(out).toContain('&gt;')
    expect(out).toContain('&amp;')
  })
})

describe('sanitizeHtml — <corevo-module> survival + rejection (the bridge contract)', () => {
  it('PRESERVES a valid <corevo-module type="booking" pos="reservation"> (type+pos intact)', () => {
    const out = sanitizeHtml('<corevo-module type="booking" pos="reservation"></corevo-module>')
    expect(out).toContain('<corevo-module')
    expect(out).toContain('type="booking"')
    expect(out).toContain('pos="reservation"')
  })

  it('preserves every KNOWN module type', () => {
    for (const t of KNOWN_MODULE_TYPES) {
      const out = sanitizeHtml(`<corevo-module type="${t}" pos="p"></corevo-module>`)
      expect(out).toContain(`type="${t}"`)
    }
  })

  it('REJECTS an unknown module type (whole marker dropped)', () => {
    const out = sanitizeHtml('<corevo-module type="evilmod" pos="x"></corevo-module>')
    expect(out).not.toContain('corevo-module')
    expect(out).not.toContain('evilmod')
  })

  it('REJECTS a module carrying an event handler / extra attribute', () => {
    const out = sanitizeHtml('<corevo-module type="booking" pos="r" onclick="x()"></corevo-module>')
    expect(out).not.toContain('corevo-module')
    expect(out).not.toContain('onclick')
  })

  it('REJECTS a nested <corevo-module> inside a <corevo-module>', () => {
    const out = sanitizeHtml(
      '<corevo-module type="booking" pos="r"><corevo-module type="shop" pos="q"></corevo-module></corevo-module>',
    )
    // outer may survive but must NOT contain a nested module marker
    const moduleCount = (out.match(/<corevo-module/g) ?? []).length
    expect(moduleCount).toBeLessThanOrEqual(1)
    expect(out).not.toContain('type="shop"')
  })

  it('a module marker with a dangerous pos value is rejected (pos must be slug-safe)', () => {
    const out = sanitizeHtml('<corevo-module type="booking" pos="\"><script>alert(1)</script>"></corevo-module>')
    expect(out.toLowerCase()).not.toContain('<script')
    expect(out).not.toContain('alert(1)')
  })
})

describe('sanitizeHtml — keeps benign rich text (TipTap minimal)', () => {
  it('keeps p/strong/em/a(safe)/ul/li and their text', () => {
    const out = sanitizeHtml(
      '<p>Hej <strong>fet</strong> <em>kursiv</em> <a href="https://corevo.se">länk</a></p><ul><li>ett</li></ul>',
    )
    expect(out).toContain('<strong>fet</strong>')
    expect(out).toContain('<em>kursiv</em>')
    expect(out).toContain('href="https://corevo.se"')
    expect(out).toContain('<li>ett</li>')
  })

  it('relative + mailto + tel hrefs are safe', () => {
    expect(isSafeUrl('/boka')).toBe(true)
    expect(isSafeUrl('#kontakt')).toBe(true)
    expect(isSafeUrl('https://corevo.se')).toBe(true)
    expect(isSafeUrl('mailto:hej@corevo.se')).toBe(true)
    expect(isSafeUrl('tel:+46700000000')).toBe(true)
  })
})

describe('sanitizeColor / sanitizeFontFamily — CSS-injection-safe scalar tokens', () => {
  it('accepts hex / rgb / hsl / named', () => {
    expect(sanitizeColor('#5E7361')).toBe('#5E7361')
    expect(sanitizeColor('#fff')).toBe('#fff')
    expect(sanitizeColor('rgb(94, 115, 97)')).toBe('rgb(94, 115, 97)')
    expect(sanitizeColor('hsl(120, 20%, 41%)')).toBe('hsl(120, 20%, 41%)')
    expect(sanitizeColor('rebeccapurple')).toBe('rebeccapurple')
  })

  it('rejects color values that smuggle CSS/markup', () => {
    expect(sanitizeColor('red;}body{display:none')).toBeNull()
    expect(sanitizeColor('url(javascript:alert(1))')).toBeNull()
    expect(sanitizeColor('#fff" onload="x')).toBeNull()
    expect(sanitizeColor('expression(alert(1))')).toBeNull()
  })

  it('accepts the salvia default font stack, rejects CSS-breakers', () => {
    expect(sanitizeFontFamily("'Jost', 'Inter', sans-serif")).toBe("'Jost', 'Inter', sans-serif")
    expect(sanitizeFontFamily('Arial')).toBe('Arial')
    expect(sanitizeFontFamily('x; } body { display:none')).toBeNull()
    expect(sanitizeFontFamily('url(evil)')).toBeNull()
    expect(sanitizeFontFamily('Arial</style><script>')).toBeNull()
  })
})

describe('edge-safety — sanitizer source imports NO jsdom/DOMPurify', () => {
  it('sanitize.ts does not IMPORT jsdom or DOMPurify (would crash on Workers)', () => {
    const src = readFileSync(join(__dirname, 'sanitize.ts'), 'utf8')
    // Only inspect import/require statements — a prose comment that NAMES the
    // forbidden libs (to explain why they are not used) is allowed.
    const importLines = src
      .split('\n')
      .filter((l) => /^\s*import\b/.test(l) || /\brequire\s*\(/.test(l))
      .join('\n')
    expect(importLines).not.toMatch(/jsdom/i)
    expect(importLines).not.toMatch(/dompurify/i)
  })
})
