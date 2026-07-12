'use client'

// Flytande kundvagns-knapp (köp-räls, goal-49) — numera BARA look-vägens korg
// ((public)/layout look-grenen). Sedan goal-57 körning 11 en ren LÄNK till
// /varukorg (drawern borttagen). Visas bara när varukorgen har rader.
//
// goal-60: formen bor i cart-chrome.module.css (var 2 inline style={{}}) — knappen kan
// nu bära :hover/:active/:focus-visible och nås av mallen. Etiketten bär mörk ink:
// vit ink på default-guldet mätte 2.4:1, mörk mäter 6.4:1. Räknar-pillret vändes
// (accent-ink på vitt = 2.4:1 → nu fg på bg = 15.5:1).

import Link from 'next/link'
import { useCart } from './CartProvider'
import styles from './cart-chrome.module.css'

export function CartButton() {
  const { count } = useCart()
  if (count === 0) return null

  return (
    <Link href="/varukorg" aria-label={`Varukorg (${count} varor)`} className={styles.float}>
      Varukorg
      <span aria-hidden="true" className={styles.floatCount}>
        {count}
      </span>
    </Link>
  )
}
