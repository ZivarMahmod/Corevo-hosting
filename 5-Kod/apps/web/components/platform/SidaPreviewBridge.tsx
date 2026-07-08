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
// (nav-länkarna Hem/Tjänster/Om oss/Kontakt). Allt annat (t.ex. /boka, externa
// länkar) blockeras — previewen lämnar aldrig preview-världen.
const PREVIEW_PATHS = new Set(['', 'tjanster', 'om', 'kontakt'])

export function SidaPreviewBridge() {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const data = e.data as { source?: string; type?: string; tokens?: Record<string, string> }
      if (data?.source !== MSG_SOURCE || data.type !== 'brand-preview' || !data.tokens) return
      const root = document.querySelector<HTMLElement>('[data-tenant]')
      if (!root) return
      for (const k of TOKEN_KEYS) {
        const v = data.tokens[k]
        if (v != null) root.style.setProperty(k, v)
        else root.style.removeProperty(k)
      }
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
