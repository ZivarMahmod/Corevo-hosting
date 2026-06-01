'use client'

import { useEffect, useState, type ReactNode } from 'react'
import styles from './storefront.module.css'

/**
 * Full-bleed photo hero carousel — THE gap-closer vs the old flat hero.
 *
 * - 3 real photographs behind the content, dark gradient overlay for legibility
 *   over any tenant photo.
 * - Slow Ken-Burns scale (1 → 1.06 over ~12s) on the active slide + 800ms
 *   crossfade between slides.
 * - Auto-advance ~6s, paused on hover/focus; manual prev/next + slide dots
 *   (active dot uses the tenant accent).
 *
 * SSR / #418-safe: initial active index is the constant 0 on both server and the
 * first client render. Auto-advance only starts in an effect after mount. The
 * overlaid content (headline, tagline, CTA) is passed as `children` and is fully
 * server-rendered — only the photo layer + controls are client.
 *
 * Reduced motion: the stylesheet disables Ken-Burns + crossfade transition, and
 * we skip the auto-advance timer when the user prefers reduced motion.
 *
 * Images are plain <img> (remote-image config is frozen) with loading="eager"
 * + fetchPriority on the first (LCP) image.
 */
export function HeroCarousel({
  images,
  align = 'center',
  children,
  controls = 'dots',
}: {
  images: { src: string; alt: string }[]
  align?: 'center' | 'left' | 'split'
  children: ReactNode
  /** 'dots' (default) or 'arrows-dots' (Atelier shows arrows too). */
  controls?: 'dots' | 'arrows-dots'
}) {
  const slides = images.length > 0 ? images : []
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = (i: number) => setActive((i + slides.length) % slides.length)
  const next = () => go(active + 1)
  const prev = () => go(active - 1)

  // Auto-advance (after mount only → hydration-safe). Skipped for single slide
  // and under reduced-motion.
  useEffect(() => {
    if (slides.length <= 1 || paused) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setInterval(() => {
      setActive((a) => (a + 1) % slides.length)
    }, 6000)
    return () => window.clearInterval(id)
  }, [slides.length, paused])

  return (
    <div
      className={`${styles.heroCarousel} ${styles[`heroAlign_${align}`]}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className={styles.heroSlides} aria-hidden="true">
        {slides.map((img, i) => (
          <div
            key={img.src}
            className={`${styles.heroSlide} ${i === active ? styles.heroSlideActive : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt=""
              className={styles.heroImg}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : undefined}
              draggable={false}
            />
          </div>
        ))}
        <span className={styles.heroOverlay} />
      </div>

      <div className={styles.heroContent}>{children}</div>

      {slides.length > 1 ? (
        <div className={styles.heroControls}>
          {controls === 'arrows-dots' ? (
            <button
              type="button"
              className={styles.heroArrow}
              onClick={prev}
              aria-label="Föregående bild"
            >
              <span aria-hidden="true">‹</span>
            </button>
          ) : null}
          <div className={styles.heroDots} role="tablist" aria-label="Bildval">
            {slides.map((img, i) => (
              <button
                key={img.src}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Visa bild ${i + 1}`}
                className={`${styles.heroDot} ${i === active ? styles.heroDotActive : ''}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
          {controls === 'arrows-dots' ? (
            <button
              type="button"
              className={styles.heroArrow}
              onClick={next}
              aria-label="Nästa bild"
            >
              <span aria-hidden="true">›</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
