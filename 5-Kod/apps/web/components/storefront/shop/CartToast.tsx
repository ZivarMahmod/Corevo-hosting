'use client'

// goal-61 — KVITTOT efter "lägg i varukorgen".
//
// Ersätter den tunna textremsan under köpknappen. Anatomin (ikon · titel + stäng ·
// varunamn · pris · väg vidare) är lånad ur uiverse-kortet i
// 4-Dokument-Underlag/uiverse-komponentbibliotek.md — formen kommer från mallens
// --sf-*-tokens, inte från uiverse-CSS:en.
//
// Portal till <body>: produktkort lyfter sig med transform på hover, och en transform
// skapar ett nytt containing block — ett fixed-kvitto inuti kortet hade klippts.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import s from './cart-toast.module.css'

export function CartToast({
  productName,
  variantName,
  priceLabel,
  onClose,
}: {
  productName: string
  variantName: string | null
  priceLabel: string
  onClose: () => void
}) {
  // Portalen får bara finnas efter mount (document saknas under SSR).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Esc stänger — kvittot är en avisering, inte en fälla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  // Portalens värd är storefront-ROTEN, inte <body>: [data-theme] sitter på skalet, så
  // ett kvitto i body hade fallit ur temat och renderats i plattformens default-guld
  // bredvid mallens gröna köpknapp. (Verifierat i flora: ikonen blev guld, knappen grön.)
  const host =
    document.querySelector('[data-world="storefront"]') ??
    document.querySelector('[data-theme]') ??
    document.body

  return createPortal(
    <div role="status" aria-live="polite" className={s.toast}>
      <span className={s.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h2l2.2 11a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 7H6" />
          <circle cx="10" cy="20" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </span>

      <div>
        <div className={s.head}>
          <span className={s.title}>Tillagd i varukorgen</span>
          <button type="button" className={s.close} onClick={onClose} aria-label="Stäng">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        <div className={s.name}>
          {productName}
          {variantName ? ` — ${variantName}` : ''}
        </div>
        <div className={s.price}>{priceLabel}</div>
        <a href="/varukorg" className={s.link}>
          Till varukorgen
        </a>
      </div>
    </div>,
    host,
  )
}
