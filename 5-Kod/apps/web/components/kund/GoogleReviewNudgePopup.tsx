'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './google-review-nudge.module.css'

// Client popup for the booking-confirmation Google-review nudge. Ignorable:
//   · close (✕), backdrop click, or Esc dismisses it;
//   · dismissal is remembered per booking (sessionStorage) so a refresh of the
//     same confirmation doesn't re-nag;
//   · clicking the CTA opens the salon's review page in a new tab and closes.
// It never blocks the confirmation content — it's an overlay the user can skip.
// Appears after a short beat so the "Tack, din tid är bokad!" message lands first.

export function GoogleReviewNudgePopup({
  reviewUrl,
  tenantName,
  bookingId,
}: {
  reviewUrl: string
  tenantName: string
  bookingId: string
}) {
  const storageKey = `corevo:review-nudge:${bookingId}`
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Respect a prior dismissal for this booking.
    try {
      if (sessionStorage.getItem(storageKey) === '1') return
    } catch {
      /* storage blocked (private mode) → just show it once this view */
    }
    const t = setTimeout(() => {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      setOpen(true)
    }, 900)
    return () => clearTimeout(t)
  }, [storageKey])

  function dismiss() {
    setOpen(false)
    try {
      sessionStorage.setItem(storageKey, '1')
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        try {
          sessionStorage.setItem(storageKey, '1')
        } catch {
          /* ignore */
        }
        return
      }
      if (e.key !== 'Tab') return
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href]',
      ) ?? [])]
      if (controls.length === 0) return
      const first = controls[0]!
      const last = controls[controls.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocusRef.current?.focus()
    }
  }, [open, storageKey])

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      className={styles.backdrop}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-nudge-title"
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={dismiss}
          aria-label="Stäng"
        >
          ✕
        </button>
        <div className={styles.icon} aria-hidden>
          ★
        </div>
        <h2 id="review-nudge-title" className={styles.title}>
          Trivdes du hos {tenantName}?
        </h2>
        <p className={styles.body}>
          Om du blev nöjd skulle vi bli jätteglada om du lämnade ett omdöme på Google. Det tar bara
          en minut och hjälper {tenantName} enormt.
        </p>
        <a
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.cta}
          onClick={dismiss}
        >
          Lämna ett omdöme
        </a>
        <button type="button" className={styles.skip} onClick={dismiss}>
          Inte nu
        </button>
      </div>
    </div>
  )
}
