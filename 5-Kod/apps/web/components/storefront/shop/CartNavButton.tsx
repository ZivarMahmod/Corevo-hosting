'use client'

// Varukorgs-knapp i naven (goal-55 körning 7B — korgen slutar vara en osynlig
// flytande boll). ALLTID synlig när shop-modulen är på (count 0 = ikon utan
// badge); klick öppnar samma delade CartDrawer som look-vägens flytande boll.
// Två varianter: 'nav' (ikon + antal-badge i desktop-klustret) och 'overlay'
// (textrad "Varukorg (N)" i mobil-overlayn). Varje instans äger sitt eget
// drawer-state — cart-innehållet delas via useCart, så de är alltid i synk.

import { useState } from 'react'
import { useCart } from './CartProvider'
import { CartDrawer } from './CartDrawer'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'

export function CartNavButton({
  variant = 'nav',
  className,
  tabIndex,
  onOpen,
}: {
  variant?: 'nav' | 'overlay'
  className?: string
  tabIndex?: number
  /** Körs innan drawern öppnas (mobil-overlayn stänger sig själv här). */
  onOpen?: () => void
}) {
  const { count } = useCart()
  const [open, setOpen] = useState(false)

  const openDrawer = () => {
    onOpen?.()
    setOpen(true)
  }

  return (
    <>
      {variant === 'overlay' ? (
        <button
          type="button"
          className={className}
          tabIndex={tabIndex}
          onClick={openDrawer}
          aria-label={`Öppna varukorg (${count} varor)`}
          style={{
            // Speglar .overlayLinks a (nav-shell.module.css) så korg-raden ser ut
            // som en menylänk, inkl. 44px-tap-target.
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'var(--color-fg)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '2.75rem',
            padding: '0.25rem 1rem',
          }}
        >
          Varukorg{count > 0 ? ` (${count})` : ''}
        </button>
      ) : (
        <button
          type="button"
          className={className}
          tabIndex={tabIndex}
          onClick={openDrawer}
          aria-label={`Öppna varukorg (${count} varor)`}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          <StorefrontIcon name="bag" size={18} />
          {count > 0 ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 17,
                height: 17,
                padding: '0 4px',
                fontFamily: 'var(--font-ui)',
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                color: 'var(--color-bg, #fff)',
                background: 'var(--color-accent, #C8A24A)',
                borderRadius: 999,
              }}
            >
              {count}
            </span>
          ) : null}
        </button>
      )}

      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
