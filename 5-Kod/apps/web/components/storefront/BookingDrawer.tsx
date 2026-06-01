'use client'

import { useEffect, useRef } from 'react'
import { BookingWizard, type WizardService } from '@/components/booking/BookingWizard'
import styles from './storefront.module.css'

/**
 * Slide-over booking drawer (desktop/tablet) → full-screen overlay (mobile).
 * Rendered inside the storefront's own React tree (same providers, same tenant
 * theme tokens), NOT an iframe or a route. The dimmed storefront sits behind it
 * so the page always feels like the salon's own.
 *
 * A11y (Voady-class): role="dialog" + aria-modal, Escape to close, focus moves
 * in on open and returns to the trigger on close, simple focus trap, body scroll
 * locked while open. Honors prefers-reduced-motion via the stylesheet.
 *
 * In-page confirmation (⭐ Zivar's core requirement): the whole flow — steps 1–4
 * AND the confirmation (step 5) — happens inside this drawer; the customer never
 * leaves the storefront. The shareable `/boka/bekraftelse/[id]` route still exists
 * as a deep-link/receipt. Online payment (OFF by default) is the only case that
 * leaves: it redirects to Stripe Checkout, which returns to that same route.
 */
export function BookingDrawer({
  open,
  onClose,
  services,
  tenantName,
}: {
  open: boolean
  onClose: () => void
  services: WizardService[]
  tenantName: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // Lock body scroll while open; remember the trigger to restore focus to.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog after it paints.
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  // Escape closes; Tab is trapped inside the panel.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  return (
    <div
      className={`${styles.drawerRoot} ${open ? styles.drawerOpen : ''}`}
      aria-hidden={!open}
    >
      {/* Scrim — dims the storefront, which stays visible behind. */}
      <button
        type="button"
        className={styles.scrim}
        aria-label="Stäng bokning"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={styles.drawerPanel}
        role="dialog"
        aria-modal="true"
        aria-label={`Boka tid hos ${tenantName}`}
      >
        {/* Thin branded step-header: salon wordmark stays present the whole flow. */}
        <header className={styles.drawerHeader}>
          <span className={styles.drawerBrand}>{tenantName}</span>
          <span className={styles.drawerTitle}>Boka tid</span>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.drawerClose}
            onClick={onClose}
            aria-label="Stäng"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className={styles.drawerBody}>
          {/* onClose → wizardens steg 5 (in-page bekräftelse) kan stänga drawern.
              open → wizarden nollställer sig vid en återöppning EFTER en klar
              bokning, oavsett hur drawern stängdes (Klar/X/Esc/scrim). */}
          <BookingWizard services={services} open={open} onClose={onClose} />
        </div>
      </div>
    </div>
  )
}
