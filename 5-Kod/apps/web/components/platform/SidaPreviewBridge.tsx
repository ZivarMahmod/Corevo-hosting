'use client'

import { useEffect } from 'react'

// Runs INSIDE the /salong-preview iframe. Listens for live brand-token patches posted
// by the parent Sida editor (same-origin only) and applies them as CSS vars on the
// storefront root — so dragging a colour picker recolours the preview instantly, before
// the form is saved. Purely additive: on reload the server-rendered inline tokens win
// again (these JS overrides live only for the current, unsaved edit).
const MSG_SOURCE = 'corevo-sida'
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
const PREVIEW_PATHS = new Set(['', 'tjanster', 'om', 'kontakt', 'shop', 'kurser', 'blogg', 'offert', 'presentkort'])

export function SidaPreviewBridge() {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const data = e.data as { source?: string; type?: string; tokens?: Record<string, string>; text?: string }
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
      e.preventDefault()
      e.stopPropagation()
      const href = a.getAttribute('href') ?? ''
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
    if (img.src === want || img.src.endsWith(want) || want.endsWith(img.getAttribute('src') ?? ' ')) hits.push(img)
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
