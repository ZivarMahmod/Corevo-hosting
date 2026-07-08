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
const TOKEN_KEYS = ['--color-primary', '--color-bg', '--color-fg', '--color-accent', '--color-accent-fg', '--font-body']

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

    // Previewen är en TITTYTA, aldrig en surfyta. Storefrontens nav-länkar är
    // relativa (/, /tjanster, /boka …) och previewen ligger på PLATTFORM-hosten —
    // ett klick hade navigerat iframen rakt in i super-admin (Zivar: "varför leder
    // knappar i previewen till super admin?"). Blockera all länk-navigering i
    // capture-fasen; knappar (boknings-drawern m.m.) påverkas inte.
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]')
      if (a) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('message', onMessage)
      document.removeEventListener('click', onClick, true)
    }
  }, [])
  return null
}
