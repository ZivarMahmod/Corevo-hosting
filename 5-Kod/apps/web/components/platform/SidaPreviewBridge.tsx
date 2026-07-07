'use client'

import { useEffect } from 'react'

// Runs INSIDE the /salong-preview iframe. Listens for live brand-token patches posted
// by the parent Sida editor (same-origin only) and applies them as CSS vars on the
// storefront root — so dragging a colour picker recolours the preview instantly, before
// the form is saved. Purely additive: on reload the server-rendered inline tokens win
// again (these JS overrides live only for the current, unsaved edit).
const MSG_SOURCE = 'corevo-sida'

export function SidaPreviewBridge() {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const data = e.data as { source?: string; type?: string; tokens?: Record<string, string> }
      if (data?.source !== MSG_SOURCE || data.type !== 'brand-preview' || !data.tokens) return
      const root = document.querySelector<HTMLElement>('[data-tenant]')
      if (!root) return
      for (const [k, v] of Object.entries(data.tokens)) root.style.setProperty(k, v)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  return null
}
