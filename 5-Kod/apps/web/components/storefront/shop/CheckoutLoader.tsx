'use client'

// goal-61 — kassans väntan. Visas medan confirmOrder är i luften (submitting):
// en overlay med uiverse-anatomin "varor faller ner i vagnen" + orden som säger
// exakt vad som händer. Blockerar formuläret medvetet — den skickade versionen
// av uppgifterna är låst, och det finns inget att avbryta som inte redan är sänt.
//
// Portal till storefront-ROTEN (inte body): temat sitter på skalet, och en overlay
// i body faller ur mallens --sf-*-tokens (samma läxa som kvitto-toasten).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { storefrontPortalHost } from './portal-host'
import s from './checkout-loader.module.css'

export function CheckoutLoader() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className={s.scrim}>
      <div role="status" aria-live="polite" className={s.card}>
        <div className={s.scene} aria-hidden="true">
          <span className={s.item} />
          <span className={s.item} />
          <span className={s.item} />
          <span className={s.cartIcon}>
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 3h2l2.2 11a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 7H6" />
              <circle cx="10" cy="20" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </span>
        </div>
        <p className={s.title}>Bekräftar din beställning…</p>
        <p className={s.hint}>Lämna inte sidan — det tar bara ett ögonblick.</p>
      </div>
    </div>,
    storefrontPortalHost(),
  )
}
