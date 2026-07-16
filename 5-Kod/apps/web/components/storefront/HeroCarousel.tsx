'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { unsplashSrcSet } from './img'
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
  // Transient pause (hover / keyboard focus) — auto-resumes when the pointer/focus
  // leaves. Distinct from `userPaused`, the explicit pause/play intent below.
  const [paused, setPaused] = useState(false)
  // WCAG 2.2.2: explicit, persistent pause control. Once the visitor pauses,
  // auto-advance stays off until they press play — hover no longer matters.
  const [userPaused, setUserPaused] = useState(false)

  const go = (i: number) => setActive((i + slides.length) % slides.length)
  const next = () => go(active + 1)
  const prev = () => go(active - 1)

  // Auto-advance (after mount only → hydration-safe). Skipped for a single slide,
  // under reduced-motion, while transiently paused, or when the visitor has
  // explicitly paused.
  useEffect(() => {
    if (slides.length <= 1 || paused || userPaused) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setInterval(() => {
      setActive((a) => (a + 1) % slides.length)
    }, 6000)
    return () => window.clearInterval(id)
  }, [slides.length, paused, userPaused])

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
              // Prestanda B5: responsiv hero — mobilen hämtar 480/800 i stället för 1600.
              srcSet={unsplashSrcSet(img.src)}
              sizes="100vw"
              alt=""
              className={styles.heroImg}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : undefined}
              draggable={false}
              data-corevo-editor-field={`hero_images.${i}`}
              data-corevo-editor-stable-field={`hero_images.${i}`}
              // CDN/offline fallback: hide a broken photo so the tinted slide +
              // dark overlay + server-rendered headline/CTA stay legible (never a
              // blank white box). The slide carries a background-color fallback.
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
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
          {/* role="group" (not tablist): these dots have no associated tabpanels,
              so tab/tablist ARIA would be a lie. aria-current marks the active dot. */}
          <div className={styles.heroDots} role="group" aria-label="Bildval">
            {slides.map((img, i) => (
              <button
                key={img.src}
                type="button"
                aria-current={i === active ? 'true' : undefined}
                aria-label={`Gå till bild ${i + 1}`}
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
          {/* WCAG 2.2.2 — visible pause/play for the auto-advancing carousel. */}
          <button
            type="button"
            className={styles.heroPause}
            onClick={() => setUserPaused((p) => !p)}
            aria-pressed={userPaused}
            aria-label={userPaused ? 'Spela upp bildspelet' : 'Pausa bildspelet'}
          >
            <span aria-hidden="true">{userPaused ? '▶' : '❚❚'}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
