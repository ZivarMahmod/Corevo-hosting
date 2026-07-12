'use client'

// Varukorgs-knapp i naven — sedan goal-57 körning 11 en ren LÄNK till /varukorg
// (egen sida). Drawern är borttagen: den renderades inne i navens fixed-lager och
// fick fel stacking-context (sidinnehåll kunde rendera ovanpå korgen). ALLTID
// synlig när shop-modulen är på (count 0 = ikon utan badge). Två varianter:
// 'nav' (ikon + antal-badge i desktop-klustret) och 'overlay' (textrad
// "Varukorg (N)" i mobil-overlayn).
//
// goal-60: formen bor i cart-chrome.module.css (var 3 inline style={{}}). Knappen
// sitter i NAVET — den yta varje mall och varje bransch renderar på varje sida — så den
// måste bära mallens --sf-navicon-radius (en rund cirkel i en rakskuren mall är dekor
// utan mening) och ha 44px klickyta. Badgen bär mörk ink på accenten: vit ink mätte
// 2.4:1 mot default-guldet, mörk mäter 6.4:1.
//
// className från mallens chrome (t.ex. shell.navAccount) läggs till, ersätts aldrig —
// nav-shell äger fortfarande ram/bakgrund/hover, den här filen bara position + badge.

import Link from 'next/link'
import { useCart } from './CartProvider'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import styles from './cart-chrome.module.css'

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
        className={[styles.overlayLink, className].filter(Boolean).join(' ')}
        tabIndex={tabIndex}
        onClick={onOpen}
        aria-label={`Varukorg (${count} varor)`}
      >
        Varukorg{count > 0 ? ` (${count})` : ''}
      </Link>
    )
  }

  return (
    <Link
      href="/varukorg"
      className={[styles.navBtn, className].filter(Boolean).join(' ')}
      tabIndex={tabIndex}
      onClick={onOpen}
      aria-label={`Varukorg (${count} varor)`}
    >
      <StorefrontIcon name="bag" size={18} />
      {/* aria-hidden: antalet står redan i aria-label, skärmläsaren ska höra det EN gång. */}
      {count > 0 ? (
        <span aria-hidden="true" className={styles.badge}>
          {count}
        </span>
      ) : null}
    </Link>
  )
}
