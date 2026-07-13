'use client'

import { useEffect } from 'react'

// Runs INSIDE the /salong-preview iframe. Listens for live brand-token patches posted
// by the parent Sida editor (same-origin only) and applies them as CSS vars on the
// storefront root — so dragging a colour picker recolours the preview instantly, before
// the form is saved. Purely additive: on reload the server-rendered inline tokens win
// again (these JS overrides live only for the current, unsaved edit).
const MSG_SOURCE = 'corevo-sida'
const FIELD_ATTR = 'data-corevo-editor-field'
const TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,span,em,i,a,button,li,div,blockquote,figcaption,small'
// The full set of tokens the brand form can drive. We reset ALL of them each message:
// a key PRESENT in the patch → setProperty; a key ABSENT (e.g. font_body blanked, so
// injectTenantTokens omits --font-body) → removeProperty, so the SSR value takes over
// again instead of the old override lingering until reload.
const TOKEN_KEYS = ['--color-primary', '--color-bg', '--color-fg', '--color-accent', '--color-accent-fg', '--font-body', '--font-display']

// Publika undersidor som HAR en preview-tvilling under /salong-preview/<slug>/…
// goal-61 preview-parity: modulsidorna (shop/kurser/blogg/offert/presentkort) fick
// tvillingar — Zivar redigerade tidigare en butik han inte kunde se, och ett nav-klick
// på "Butik" i previewen gjorde ingenting. Allt annat (t.ex. /boka, externa länkar,
// enskilda produkt-/inläggssidor) blockeras — previewen lämnar aldrig preview-världen.
const PREVIEW_PATHS = new Set([
  '',
  'tjanster',
  'om',
  'kontakt',
  'shop',
  'kurser',
  'blogg',
  'offert',
  'presentkort',
  'klubb',
  'galleri',
  'team',
])

export function SidaPreviewBridge() {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const data = e.data as {
        source?: string
        type?: string
        tokens?: Record<string, string>
        text?: string
        field?: string
        value?: string
        currentUrl?: string
        url?: string
        requestId?: number
        fields?: { name: string; value: string }[]
      }
      if (data?.source !== MSG_SOURCE) return
      if (data.type === 'brand-preview' && data.tokens) {
        const root = document.querySelector<HTMLElement>('[data-tenant]')
        if (!root) return
        for (const k of TOKEN_KEYS) {
          const v = data.tokens[k]
          if (v != null) root.style.setProperty(k, v)
          else root.style.removeProperty(k)
        }
        return
      }
      if (data.type === 'editor-scan' && Array.isArray(data.fields)) {
        scanEditableFields(data.fields, data.requestId)
        return
      }
      if (data.type === 'copy-preview' && typeof data.field === 'string' && typeof data.value === 'string') {
        patchField(data.field, data.value)
        return
      }
      if (data.type === 'copy-flash-field' && typeof data.field === 'string') {
        flashField(data.field)
        return
      }
      if (
        data.type === 'image-preview' &&
        typeof data.currentUrl === 'string' &&
        typeof data.url === 'string'
      ) {
        patchImage(data.currentUrl, data.url)
        return
      }
      // "Visa var" för TEXT (Zivar: "sidfot… var är den? kan den markeras?"):
      // hitta elementen som visar exakt den texten, scrolla dit och pulsa en ram —
      // generiskt via text-matchning, så inga per-mall-DOM-taggar behövs.
      if (data.type === 'copy-flash' && typeof data.text === 'string') flashText(data.text)
      // "Visa var" för BILDER: matcha på bild-URL (både <img src> och CSS
      // background-image), scrolla dit och pulsa samma ram.
      if (data.type === 'img-flash' && typeof data.text === 'string') flashImage(data.text)
    }
    window.addEventListener('message', onMessage)

    // Länk-styrning: storefrontens nav-länkar är relativa (/, /tjanster …) och
    // previewen ligger på PLATTFORM-hosten — obehandlade hade ett klick laddat
    // super-admin INUTI iframen. Sidor som har en preview-tvilling SKRIVS OM till
    // /salong-preview/<slug>/<sida> (med ?theme= bevarad) så operatören kan klicka
    // runt precis som på den skarpa sidan (Zivar: "flikarna ska kunna öppnas");
    // allt annat (t.ex. /boka, externa länkar) blockeras. Capture-fasen, så inga
    // andra handlers hinner före; knappar (boknings-drawern) påverkas inte.
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      // Ankarlänkar stannar redan på samma preview-sida. Floristmallarnas
      // "Så funkar leveransen" blockerades tidigare innan browsern hann scrolla.
      if (href.startsWith('#')) return
      e.preventDefault()
      e.stopPropagation()
      if (!href.startsWith('/')) return // extern/hash → blockerad
      const m = /^\/salong-preview\/([a-z0-9-]+)/.exec(window.location.pathname)
      const slug = m?.[1]
      if (!slug) return
      const target = href.split(/[?#]/)[0]?.replace(/^\/+|\/+$/g, '') ?? ''
      if (!PREVIEW_PATHS.has(target)) return // ingen preview-tvilling → blockerad
      const dest = `/salong-preview/${slug}${target ? `/${target}` : ''}${window.location.search}`
      window.location.assign(dest)
    }
    document.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('message', onMessage)
      document.removeEventListener('click', onClick, true)
    }
  }, [])
  return null
}

// Normalisera för matchning: kollapsa whitespace (heroTitle kan bära \n).
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

type FieldCandidate = { name: string; value: string }

/**
 * Storefrontens faktiska DOM är facit. Kandidaterna kommer från mallens copy-kontrakt,
 * men ett fält blir synligt i editorn först när just den route som visas verkligen
 * renderar dess nuvarande värde. Det eliminerar gamla mallfält och döda "Visa var".
 */
function scanEditableFields(fields: FieldCandidate[], requestId?: number) {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  root.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`).forEach((el) => el.removeAttribute(FIELD_ATTR))

  const grouped = new Map<string, FieldCandidate[]>()
  for (const field of fields) {
    const value = norm(field.value)
    if (!field.name || !value) continue
    const list = grouped.get(value) ?? []
    if (!list.some((item) => item.name === field.name)) list.push(field)
    grouped.set(value, list)
  }

  const found = new Set<string>()
  const counts: Record<string, number> = {}
  for (const [value, candidates] of grouped) {
    const hits = findTextElements(root, value)
    if (!hits.length) continue

    // Ett fält kan medvetet synas på flera ställen (t.ex. sidfot + band). När flera
    // fält råkar ha samma text fördelas DOM-träffarna i dokumentordning, så två rader
    // med "arkivet" inte pekar på exakt samma element.
    if (candidates.length === 1) {
      for (const hit of hits.slice(0, 12)) markField(hit, candidates[0]!.name)
      found.add(candidates[0]!.name)
      counts[candidates[0]!.name] = Math.min(hits.length, 12)
      continue
    }
    candidates.forEach((candidate, index) => {
      const hit = hits[index]
      if (!hit) return
      markField(hit, candidate.name)
      found.add(candidate.name)
      counts[candidate.name] = 1
    })
  }

  window.parent.postMessage(
    {
      source: MSG_SOURCE,
      type: 'editor-scan-result',
      requestId,
      fields: [...found],
      counts,
    },
    window.location.origin,
  )
}

function findTextElements(root: HTMLElement, wanted: string): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(TEXT_SELECTOR)].filter((el) => {
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  const exact = all.filter((el) => norm(el.textContent ?? '') === wanted)
  const candidates = exact.length
    ? exact
    : all.filter((el) => {
        const value = norm(el.textContent ?? '')
        return value.length <= wanted.length * 3 + 80 && value.includes(wanted)
      })
  return candidates.filter(
    (el) => !candidates.some((child) => child !== el && el.contains(child)),
  )
}

function markField(el: HTMLElement, name: string) {
  el.setAttribute(FIELD_ATTR, name)
}

function fieldElements(name: string): HTMLElement[] {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  return [...root.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`)].filter(
    (el) => el.getAttribute(FIELD_ATTR) === name,
  )
}

function flashField(name: string) {
  pulse(fieldElements(name).slice(0, 4))
}

/** Ändra bara textnoderna, aldrig mallens spans/italic/line-break-markup. */
function patchField(name: string, value: string) {
  for (const el of fieldElements(name)) replaceTextNodes(el, value)
}

function replaceTextNodes(el: HTMLElement, value: string) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    const textNode = current as Text
    const parent = textNode.parentElement
    if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) && textNode.data.trim()) {
      nodes.push(textNode)
    }
    current = walker.nextNode()
  }
  if (!nodes.length) {
    el.textContent = value
    return
  }
  if (nodes.length === 1) {
    const raw = nodes[0]!.data
    const leading = raw.match(/^\s*/)?.[0] ?? ''
    const trailing = raw.match(/\s*$/)?.[0] ?? ''
    nodes[0]!.data = `${leading}${value}${trailing}`
    return
  }

  const weights = nodes.map((node) => Math.max(1, node.data.trim().length))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let consumed = 0
  nodes.forEach((node, index) => {
    const leading = node.data.match(/^\s*/)?.[0] ?? ''
    const trailing = node.data.match(/\s*$/)?.[0] ?? ''
    const start = Math.round((consumed / total) * value.length)
    consumed += weights[index]!
    const end = index === nodes.length - 1 ? value.length : Math.round((consumed / total) * value.length)
    node.data = `${leading}${value.slice(start, end)}${trailing}`
  })
}

/** Förhandsvisa vald lokal fil utan upload. Save-actionen är fortsatt enda live-skrivning. */
function patchImage(currentUrl: string, previewUrl: string) {
  const want = currentUrl.trim()
  if (!want || !previewUrl) return
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const hits: HTMLElement[] = []
  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    const original = img.dataset.corevoPreviewOriginalSrc
    if (
      original === want ||
      img.src === want ||
      img.src.endsWith(want) ||
      want.endsWith(img.getAttribute('src') ?? ' ')
    ) {
      if (!original) img.dataset.corevoPreviewOriginalSrc = want
      img.src = previewUrl
      hits.push(img)
    }
  }
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const original = el.dataset.corevoPreviewOriginalBg
    const background = getComputedStyle(el).backgroundImage
    if (original === want || (background && background !== 'none' && background.includes(want))) {
      if (!original) el.dataset.corevoPreviewOriginalBg = want
      el.style.backgroundImage = `url("${previewUrl}")`
      hits.push(el)
    }
  }
  pulse(hits.slice(0, 4))
}

/** Markera elementen som innehåller `target`-texten: scrolla till det första och
 *  pulsa en tydlig ram/glow ~1.6 s. Matchar per ELEMENT vars egen text innehåller
 *  målet (närmast-omslutande vinner via sist-i-dokumentordning-fördjupning). */
function flashText(target: string) {
  const wanted = norm(target)
  if (!wanted) return
  const short = wanted.length > 60 ? wanted.slice(0, 60) : wanted
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const all = root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,span,em,i,a,li,div,blockquote,figcaption,small')
  const hits: HTMLElement[] = []
  for (const el of all) {
    const t = norm(el.textContent ?? '')
    if (!t || t.length > wanted.length * 3 + 80) continue // för stor container → inte "själva" texten
    if (t.includes(short)) {
      // föredra det INNERSTA träffande elementet: släng föräldrar som redan ligger i hits
      while (hits.length && hits[hits.length - 1]!.contains(el)) hits.pop()
      hits.push(el)
    }
  }
  pulse(hits.slice(0, 4))
}

/** Markera var en uppladdad BILD syns: matcha <img src> och CSS background-image
 *  mot URL:en, scrolla dit och pulsa. */
function flashImage(url: string) {
  const want = url.trim()
  if (!want) return
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const hits: HTMLElement[] = []
  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    if (
      img.dataset.corevoPreviewOriginalSrc === want ||
      img.src === want ||
      img.src.endsWith(want) ||
      want.endsWith(img.getAttribute('src') ?? ' ')
    ) hits.push(img)
  }
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (hits.length >= 6) break
    const bg = getComputedStyle(el).backgroundImage
    if (bg && bg !== 'none' && bg.includes(want)) hits.push(el)
  }
  pulse(hits.slice(0, 4))
}

function pulse(marks: HTMLElement[]) {
  if (!marks.length) return
  marks[0]!.scrollIntoView({ behavior: 'smooth', block: 'center' })
  for (const el of marks) {
    const prev = el.style.cssText
    el.style.outline = '3px solid #FF2FD6'
    el.style.outlineOffset = '4px'
    el.style.borderRadius = '4px'
    el.style.boxShadow = '0 0 0 6px rgba(255,47,214,.18)'
    el.style.transition = 'outline-color .2s'
    window.setTimeout(() => {
      el.style.cssText = prev
    }, 1700)
  }
}
