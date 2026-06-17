// Edge-kompatibel XSS-sanerare (Sajtbyggare S2) — körs vid SPAR, aldrig per render.
//
// Bygger på html-react-parser's `htmlToDOM` (= html-dom-parser → htmlparser2), den
// RENA-JS-parser render-bron redan kör på Cloudflare Workers (S0, bevisad edge-säker).
// INGEN jsdom / DOMPurify / isomorphic-dompurify (de kräver jsdom → kraschar på Workers).
// Under vitest (environment 'node', inget `window`) väljs samma server-parser → testet
// bevisar den FAKTISKA edge-vägen, inte en jsdom-approximation.
//
// Modell: STRIKT allowlist. Endast ett litet set formaterings-taggar (TipTap-minimal:
// fet/kursiv/länk/listor) passerar, alla attribut utom en handfull säkra dropas, och
// `<corevo-module>` släpps ENBART med känt `type` + slug-säkert `pos` och inga andra
// attribut (annars dödar saneraren render-bron). Allt annat dropas. Att vitlista en tagg
// betyder att dess attribut-vektorer (srcset/style/on*) försvinner med taggen.

import { htmlToDOM, Element, Text, type DOMNode } from 'html-react-parser'
import type { RegionType } from './manifest/types'

/** Modul-typer render-bron känner (KNOWN_MODULES). Endast dessa överlever saneringen —
 *  "tillåt alla `<corevo-module>`" ÄR läckan (goal-37 §2). */
export const KNOWN_MODULE_TYPES = ['booking', 'shop', 'offert', 'lojalitet', 'presentkort', 'blogg'] as const
const MODULE_TYPE_SET: ReadonlySet<string> = new Set(KNOWN_MODULE_TYPES)

/** `pos` måste vara en slug (a–z0–9 + bindestreck) — aldrig HTML/citattecken. */
const POS_RE = /^[a-z0-9][a-z0-9-]{0,40}$/i

/** Formaterings-taggar TipTap-minimal kan producera. Alla emitteras UTAN attribut
 *  (utom `a[href]`, saneras separat). */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'span',
])
const VOID_TAGS: ReadonlySet<string> = new Set(['br'])

/** Taggar vars HELA subträd dropas (texten får ej läcka: CSS/JS-payloads). */
const DROP_SUBTREE: ReadonlySet<string> = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
  'template', 'noscript', 'svg', 'math', 'form', 'input', 'textarea', 'select', 'button', 'title',
])

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * En URL är säker om den saknar schema (relativ/anchor/query) eller har ett av
 * {http,https,mailto,tel}. ASCII-kontrolltecken + whitespace (0x00–0x20) strippas
 * FÖRST så `java\tscript:` / `&#106;avascript:` (parsern avkodar entiteter) inte
 * slinker förbi. Protokoll-relativa `//host` avvisas (kan ärva ett osäkert schema).
 */
export function isSafeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const v = Array.from(value).filter((c) => c.charCodeAt(0) > 0x20).join("").toLowerCase()
  if (v === '') return false
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(v)
  if (scheme) return ['http', 'https', 'mailto', 'tel'].includes(scheme[1])
  if (v.startsWith('//')) return false
  return true
}

/** En CSS-färg: hex / rgb(a) / hsl(a) / namngiven — inget som kan bryta ut ur ett
 *  `style`-värde (`;`, `{`, `url(`, `expression(`, citattecken …). Annars null. */
export function sanitizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(v)) return v
  if (/^[a-zA-Z]{1,30}$/.test(v)) return v
  return null
}

/** En font-family-sträng: bokstäver/siffror/blank/komma/citattecken/bindestreck.
 *  Allt som kan bryta ut ur CSS (`;{}()<>:/`) → null. */
export function sanitizeFontFamily(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (v.length === 0 || v.length > 120) return null
  if (!/^[\w\s,'"-]+$/.test(v)) return null
  return v
}

function serializeChildren(nodes: DOMNode[], insideModule: boolean): string {
  let out = ''
  for (const node of nodes) out += serializeNode(node, insideModule)
  return out
}

function serializeNode(node: DOMNode, insideModule: boolean): string {
  if (node instanceof Text) return escapeText(node.data)
  if (!(node instanceof Element)) return '' // comment / directive / PI → drop
  const name = node.name.toLowerCase()
  const attribs: Record<string, string> = node.attribs ?? {}

  // <corevo-module> — render-bro-markören. Endast type∈KNOWN + slug-säker pos,
  // inga andra attribut, aldrig nästlad. Emitteras självsluten (barn dropas).
  if (name === 'corevo-module') {
    if (insideModule) return ''
    const keys = Object.keys(attribs).map((k) => k.toLowerCase())
    if (keys.some((k) => k !== 'type' && k !== 'pos')) return ''
    const type = (attribs.type ?? '').trim()
    const pos = (attribs.pos ?? '').trim()
    if (!MODULE_TYPE_SET.has(type)) return ''
    if (pos !== '' && !POS_RE.test(pos)) return ''
    const posAttr = pos !== '' ? ` pos="${escapeAttr(pos)}"` : ''
    return `<corevo-module type="${escapeAttr(type)}"${posAttr}></corevo-module>`
  }

  // Farlig tagg → droppa tagg + hela subträdet (ingen text-läcka).
  if (DROP_SUBTREE.has(name)) return ''

  // Vitlistad formaterings-tagg.
  if (ALLOWED_TAGS.has(name)) {
    if (VOID_TAGS.has(name)) return `<${name}>`
    const inner = serializeChildren((node.children ?? []) as DOMNode[], insideModule)
    if (name === 'a') {
      const href = attribs.href
      const hrefAttr = isSafeUrl(href) ? ` href="${escapeAttr(href.trim())}"` : ''
      return `<a${hrefAttr}>${inner}</a>`
    }
    return `<${name}>${inner}</${name}>`
  }

  // Okänd/övrig tagg (div/img/table/video …) → UNWRAP: droppa taggen, behåll
  // sanerade barn. En void-vektor som <img srcset=…> har inga barn → försvinner helt.
  return serializeChildren((node.children ?? []) as DOMNode[], insideModule)
}

/** Sanera en HTML-sträng (rich-text-region-värde eller mall-fragment) mot allowlisten. */
export function sanitizeHtml(input: unknown): string {
  if (typeof input !== 'string' || input === '') return ''
  const dom = htmlToDOM(input) as DOMNode[]
  return serializeChildren(dom, false)
}

/** Resultatet av att sanera ETT region-värde mot sin typ. Fail-closed: `ok:false`
 *  → spar-vägen skriver INGET för regionen (goal-37 Steg 6). */
export type SanitizeResult = { ok: true; value: string } | { ok: false; reason: string }

/**
 * Sanera ett region-värde enligt regionens typ (dispatch åt save-site-content):
 *  - text       → allowlist-HTML (sanitizeHtml)
 *  - image/logo → URL-validering (isSafeUrl)
 *  - color      → CSS-färg (sanitizeColor)
 *  - font       → font-family (sanitizeFontFamily)
 * Tom text är giltig (= rensa override → faller tillbaka via resolveSiteContent).
 */
export function sanitizeRegionValue(type: RegionType, value: unknown): SanitizeResult {
  if (type === 'text') {
    return { ok: true, value: sanitizeHtml(value) }
  }
  if (typeof value !== 'string') return { ok: false, reason: 'not-a-string' }
  const trimmed = value.trim()
  if (type === 'image' || type === 'logo') {
    return isSafeUrl(trimmed) ? { ok: true, value: trimmed } : { ok: false, reason: 'unsafe-url' }
  }
  if (type === 'color') {
    const c = sanitizeColor(trimmed)
    return c !== null ? { ok: true, value: c } : { ok: false, reason: 'invalid-color' }
  }
  // font
  const f = sanitizeFontFamily(trimmed)
  return f !== null ? { ok: true, value: f } : { ok: false, reason: 'invalid-font' }
}
