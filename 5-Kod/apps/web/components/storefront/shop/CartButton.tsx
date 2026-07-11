'use client'

// Flytande kundvagns-knapp (köp-räls, goal-49) — numera BARA look-vägens korg
// ((public)/layout look-grenen). Temade sajter använder navens CartNavButton
// (goal-55 körning 7B). Visas bara när varukorgen har rader; öppnar den delade
// CartDrawer:n.

import { useState } from 'react'
import { useCart } from './CartProvider'
import { CartDrawer } from './CartDrawer'

export function CartButton() {
  const { count } = useCart()
  const [open, setOpen] = useState(false)
  if (count === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Öppna varukorg (${count} varor)`}
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
          cursor: 'pointer',
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
      </button>

      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
