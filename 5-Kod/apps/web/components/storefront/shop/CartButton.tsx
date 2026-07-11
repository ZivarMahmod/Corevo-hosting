'use client'

// Flytande kundvagns-knapp (köp-räls, goal-49) — numera BARA look-vägens korg
// ((public)/layout look-grenen). Sedan goal-57 körning 11 en ren LÄNK till
// /varukorg (drawern borttagen). Visas bara när varukorgen har rader.

import Link from 'next/link'
import { useCart } from './CartProvider'

export function CartButton() {
  const { count } = useCart()
  if (count === 0) return null

  return (
    <Link
      href="/varukorg"
      aria-label={`Varukorg (${count} varor)`}
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 18px',
        fontFamily: 'var(--font-ui)',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-bg, #fff)',
        background: 'var(--color-accent, #C8A24A)',
        border: 'none',
        borderRadius: 999,
        boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        textDecoration: 'none',
      }}
    >
      Varukorg
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 22,
          height: 22,
          padding: '0 6px',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-accent, #C8A24A)',
          background: 'var(--color-bg, #fff)',
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    </Link>
  )
}
