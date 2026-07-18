'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './modal.module.css'

/**
 * Centrerad dialog — back-officeens yta för "gör en sak nu" (Zivar 2026-07-14).
 *
 * Ersätter den högerankrade Drawern i kalendern. Skälet är fysiskt: en sidopanel
 * fungerar på en bred skärm, men på en iPad eller telefon — där salongen faktiskt
 * står — blir den en smal remsa i kanten som konkurrerar med tummen. En dialog som
 * öppnas MITT FRAMFÖR användaren är samma mönster som kundens bokningsflöde, och
 * kräver ingen omlärning.
 *
 * Responsiv av sig själv: centrerat kort på desktop, ett ark som glider upp underifrån
 * på mobil (där tummen är). Ingen separat mobil-komponent.
 *
 * Tillgänglighet: fokus flyttas in vid öppning, Escape stänger, fokus fångas i
 * dialogen så Tab inte vandrar ut i sidan bakom, och bakgrunden låses från scroll.
 */
export function Modal({
  title,
  sub,
  accent,
  footer,
  onClose,
  children,
  ariaLabel,
  /** 'md' (default) för formulär, 'sm' för en kort bekräftelse. */
  size = 'md',
  /** Mobil-arkets kant. 'top' för dialoger med textinmatning — ett bottenark
   *  hamnar bakom tangentbordet (sök i kalendern var osynlig). Desktop opåverkad. */
  anchor = 'center',
}: {
  title: ReactNode
  sub?: ReactNode
  /** Badge/pill ovanför rubriken (t.ex. statusmärke). */
  accent?: ReactNode
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
  size?: 'sm' | 'md'
  anchor?: 'center' | 'top'
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)

  function close() {
    if (closingRef.current) return
    closingRef.current = true
    overlayRef.current?.classList.add(styles.closing!)
    cardRef.current?.classList.add(styles.closing!)
    window.setTimeout(onClose, 180)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      // Fokusfälla: Tab får inte vandra ut ur dialogen och landa i kalendern bakom.
      if (e.key !== 'Tab' || !cardRef.current) return
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (!cardRef.current.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    // Fokus in i dialogen: första fältet om det finns, annars själva kortet.
    const target =
      cardRef.current?.querySelector<HTMLElement>('input, select, textarea, button') ??
      cardRef.current
    target?.focus()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // mount/unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const label = ariaLabel ?? (typeof title === 'string' ? title : 'Dialog')

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      data-anchor={anchor}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={cardRef}
        className={`${styles.card}${size === 'sm' ? ` ${styles.cardSm}` : ''}${footer ? '' : ` ${styles.cardNoFooter}`}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className={styles.head}>
          <div className={styles.headText}>
            {accent && <div className={styles.accent}>{accent}</div>}
            <h2 className={styles.title}>{title}</h2>
            {sub && <p className={styles.sub}>{sub}</p>}
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Stäng">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.foot}>{footer}</div>}
      </div>
    </div>
  )
}
