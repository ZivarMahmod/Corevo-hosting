'use client'

// Varukorgs-knapp i naven — sedan goal-57 körning 11 en ren LÄNK till /varukorg
// (egen sida). Drawern är borttagen: den renderades inne i navens fixed-lager och
// fick fel stacking-context (sidinnehåll kunde rendera ovanpå korgen). ALLTID
// synlig när shop-modulen är på (count 0 = ikon utan badge). Två varianter:
// 'nav' (ikon + antal-badge i desktop-klustret) och 'overlay' (textrad
// "Varukorg (N)" i mobil-overlayn).

import Link from 'next/link'
import { useCart } from './CartProvider'
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
  /** Körs vid klick (mobil-overlayn stänger sig själv här). */
  onOpen?: () => void
}) {
  const { count } = useCart()

  if (variant === 'overlay') {
    return (
      <Link
        href="/varukorg"
        className={className}
        tabIndex={tabIndex}
        onClick={onOpen}
        aria-label={`Varukorg (${count} varor)`}
        style={{
          // Speglar .overlayLinks a (nav-shell.module.css) så korg-raden ser ut
          // som en menylänk, inkl. 44px-tap-target.
          fontFamily: 'inherit',
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'var(--color-fg)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '2.75rem',
          padding: '0.25rem 1rem',
          textDecoration: 'none',
        }}
      >
        Varukorg{count > 0 ? ` (${count})` : ''}
      </Link>
    )
  }

  return (
    <Link
      href="/varukorg"
      className={className}
      tabIndex={tabIndex}
      onClick={onOpen}
      aria-label={`Varukorg (${count} varor)`}
      style={{ position: 'relative', cursor: 'pointer', display: 'inline-flex', color: 'inherit' }}
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
    </Link>
  )
}
