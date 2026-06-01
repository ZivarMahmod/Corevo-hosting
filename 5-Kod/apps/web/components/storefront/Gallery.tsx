'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const close = useCallback(() => setOpenIdx(null), [])
  const move = useCallback(
    (delta: number) =>
      setOpenIdx((i) => (i === null ? null : (i + delta + photos.length) % photos.length)),
    [photos.length],
  )

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') move(1)
      else if (e.key === 'ArrowLeft') move(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
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
              <img src={p.src} alt={p.alt} loading="lazy" className={styles.galleryImg} />
            </button>
          </li>
        ))}
      </ul>

      {isOpen ? (
        <div
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
