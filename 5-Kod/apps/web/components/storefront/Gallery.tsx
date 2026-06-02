'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StorePhoto } from './images'
import styles from './storefront.module.css'

/**
 * Portfolio / gallery grid with a lightbox. The second big photo moment of the
 * page. Click a tile → full-screen lightbox; Escape / scrim / × closes; arrows
 * (keyboard + on-screen) move between images.
 *
 * SSR / #418-safe: lightbox starts CLOSED (index null) on server and first
 * client render; it only opens on a user click. Tiles hover-scale inside an
 * overflow-hidden frame (CSS).
 */
export function Gallery({ photos }: { photos: StorePhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const isOpen = openIdx !== null

  // Mirrors the BookingDrawer a11y pattern: trap Tab inside the dialog, return
  // focus to the tile that opened it on close, lock body scroll while open.
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => setOpenIdx(null), [])
  const move = useCallback(
    (delta: number) =>
      setOpenIdx((i) => (i === null ? null : (i + delta + photos.length) % photos.length)),
    [photos.length],
  )

  // Body-scroll lock + focus restore. Remember the trigger when opening, move
  // focus into the dialog after paint, and restore focus to the trigger on close.
  useEffect(() => {
    if (!isOpen) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      restoreFocusRef.current?.focus?.()
    }
  }, [isOpen])

  // Esc closes, arrows navigate, Tab/Shift+Tab cycle within the dialog.
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (e.key === 'ArrowRight') {
        move(1)
        return
      }
      if (e.key === 'ArrowLeft') {
        move(-1)
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = dialog.querySelectorAll<HTMLElement>(
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
  }, [isOpen, close, move])

  if (photos.length === 0) return null

  return (
    <>
      <ul className={styles.gallery}>
        {photos.map((p, i) => (
          <li key={p.src + i} className={styles.galleryItem}>
            <button
              type="button"
              className={styles.galleryBtn}
              onClick={() => setOpenIdx(i)}
              aria-label={`Öppna bild: ${p.alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.alt}
                loading="lazy"
                className={styles.galleryImg}
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            </button>
          </li>
        ))}
      </ul>

      {isOpen ? (
        <div
          ref={dialogRef}
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Bildvisning"
        >
          <button
            type="button"
            className={styles.lightboxScrim}
            aria-label="Stäng bildvisning"
            onClick={close}
          />
          <button
            type="button"
            className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
            onClick={() => move(-1)}
            aria-label="Föregående bild"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <figure className={styles.lightboxFig}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[openIdx!]!.src}
              alt={photos[openIdx!]!.alt}
              className={styles.lightboxImg}
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
            <figcaption className={styles.lightboxCaption}>{photos[openIdx!]!.alt}</figcaption>
          </figure>
          <button
            type="button"
            className={`${styles.lightboxNav} ${styles.lightboxNext}`}
            onClick={() => move(1)}
            aria-label="Nästa bild"
          >
            <span aria-hidden="true">›</span>
          </button>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.lightboxClose}
            onClick={close}
            aria-label="Stäng"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ) : null}
    </>
  )
}
