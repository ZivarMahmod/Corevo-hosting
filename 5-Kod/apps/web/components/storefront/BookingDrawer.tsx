'use client'

import { useEffect, useRef } from 'react'
import { BookingWizard, type WizardService, type WizardLocation } from '@/components/booking/BookingWizard'
import type { PickerMode, StaffAvatarMode } from '@/lib/platform/booking-variant'
import type { BookingMode } from './BookingProvider'
import styles from './storefront.module.css'

/**
 * Overlay-panelen för bokningsflödet (design-paketet "Frisörbokningsformulär
 * redesign", README §The four presentations):
 *  - presentation='modal'  → centrerad modal ~470px (desktop) / near-fullscreen
 *    kort med 14px-inset (mobil) — variant `wizard`.
 *  - presentation='drawer' → höger slide-over 440px (desktop) / bottom-sheet
 *    ≤92% med rundade toppkanter 20px (mobil) — varianterna `drawer`/`compact`.
 * Scrim: rgba(23,17,11,.5) + blur(2px). Geometri/animation ägs av de booking-
 * globala .bk-*-klasserna (booking-global.css) lagrade ovanpå modulens
 * .drawerRoot/.drawerPanel (som behåller open/close-mekaniken).
 *
 * Rendered inside the storefront's own React tree (same providers, same tenant
 * theme tokens), NOT an iframe or a route. The dimmed storefront sits behind it
 * so the page always feels like the salon's own.
 *
 * A11y (Voady-class): role="dialog" + aria-modal, Escape to close, focus moves
 * in on open and returns to the trigger on close, simple focus trap, body scroll
 * locked while open. Honors prefers-reduced-motion via the stylesheet.
 *
 * In-page confirmation (⭐ Zivar's core requirement): the whole flow — steps 1–4
 * AND the confirmation ticket (step 5) — happens inside this panel; the customer
 * never leaves the storefront. The shareable `/boka/bekraftelse/[id]` route still
 * exists as a deep-link/receipt. Online payment (OFF by default) is the only case
 * that leaves: it redirects to Stripe Checkout, which returns to that same route.
 */
export function BookingDrawer({
  open,
  onClose,
  services,
  locations = [],
  tenantName,
  staffNoun = 'Personal',
  bokaCta = 'Boka tid',
  mode = 'wizard',
  presentation = 'drawer',
  pickerMode = 'calendar',
  staffAvatarMode = 'initialer',
}: {
  open: boolean
  onClose: () => void
  services: WizardService[]
  locations?: WizardLocation[]
  tenantName: string
  /** Branschens boknings-verb (bransch-copy.ts → branschBokning().cta): "Boka
   *  bord" hos en restaurang, "Boka konsultation" hos en florist. Bär dialogens
   *  aria-label + panelens mono-etikett, som förr hårdkodade "Boka tid". */
  bokaCta?: string
  /** Bransch-resolved staff noun (singular) for the embedded wizard. OPTIONAL —
   *  defaults to 'Frisör' so any caller that omits it is byte-identical to today. */
  staffNoun?: string
  /** Variant 3 wizard (default) or Variant 4 kompakt snabbboka. */
  mode?: BookingMode
  /** 'drawer' = slide-over från sidan (bottom-sheet på mobil); 'modal' =
   *  centrerad ruta (wizard-varianten; near-fullscreen-kort på mobil). */
  presentation?: 'modal' | 'drawer'
  /** Tid-väljaren (settings.booking.pickerMode) — vidarebefordras till wizarden. */
  pickerMode?: PickerMode
  /** Barberarbild-läget (settings.booking.staffAvatars) — vidarebefordras. */
  staffAvatarMode?: StaffAvatarMode
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
      // NB: querySelectorAll does NOT skip display:none or tabindex=-1 nodes, so
      // we filter them out — otherwise the booking-owned bottom-sheet grabber
      // (display:none on desktop) and the hidden step-4 form submit (tabindex=-1)
      // would become the trap's first/last boundary and let focus escape.
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null && el.tabIndex !== -1)
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

  const isModal = presentation === 'modal'

  return (
    <div
      className={`${styles.drawerRoot} ${open ? `${styles.drawerOpen} bk-open` : ''}`}
      aria-hidden={!open}
    >
      {/* Scrim — dims the storefront (rgba(23,17,11,.5) + blur), which stays
          visible behind. */}
      <button
        type="button"
        className={`${styles.scrim} bk-scrim`}
        aria-label="Stäng bokning"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      {/* Panelen: modulens .drawerPanel äger open/close-transformen; de booking-
          ägda globala klasserna (booking-global.css) lägger redesignens geometri,
          ram, skugga och animationskurva ovanpå — .bk-panel--center (modal /
          near-fullscreen-kort) eller .bk-panel--right (slide-over / bottom-sheet
          via .bk-sheet). fc-scope aktiverar redesign-tokens i hela panelen. */}
      <div
        ref={panelRef}
        className={`${styles.drawerPanel} fc-scope bk-panel ${isModal ? 'bk-panel--center' : 'bk-panel--right bk-sheet'}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${bokaCta} hos ${tenantName}`}
      >
        {/* Mobile-only drag grabber (bara bottom-sheeten): signals "swipe down /
            tap scrim to close". Hidden on desktop + modal via booking-global.css. */}
        <button type="button" className="bk-grabber" aria-label="Stäng bokning" onClick={onClose}>
          <span className="bk-grabber-bar" aria-hidden="true" />
        </button>

        {/* Panel-toppen (spec §Booking panel — header): wordmark (display 19px) +
            mono BOKA TID + ✕ (32px, 1.5px line-2). */}
        <header className="fc-panel-head">
          <span className="fc-panel-brand">
            <span className="fc-panel-brand-name">{tenantName}</span>
            <span className="fc-panel-brand-label">{bokaCta.toUpperCase()}</span>
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="fc-panel-close"
            onClick={onClose}
            aria-label="Stäng"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className={`${styles.drawerBody} bk-body`}>
          {/* onClose → wizardens steg 5 (in-page biljett) kan stänga panelen.
              open → wizarden nollställer sig vid en återöppning EFTER en klar
              bokning, oavsett hur panelen stängdes (X/Esc/scrim).
              mode → Variant 3 (wizard, default) eller Variant 4 (compact). */}
          <BookingWizard
            services={services}
            locations={locations}
            open={open}
            onClose={onClose}
            mode={mode}
            staffNoun={staffNoun}
            bokaCta={bokaCta}
            pickerMode={pickerMode}
            staffAvatarMode={staffAvatarMode}
            brandName={tenantName}
          />
        </div>
      </div>
    </div>
  )
}
