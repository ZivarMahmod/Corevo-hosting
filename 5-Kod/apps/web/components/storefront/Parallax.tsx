'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './storefront.module.css'

/**
 * The ONE parallax moment on the page — the closing full-bleed CTA photo.
 * Shifts the background image's translateY at ~0.3x scroll. Everything else uses
 * tasteful fade-ups only (no parallax-everywhere kitsch).
 *
 * SSR-safe: renders identical markup server + client; the transform is applied
 * via a rAF-throttled scroll listener after mount. Disabled under
 * prefers-reduced-motion.
 */
export function Parallax({
  src,
  alt,
  editorField,
  children,
}: {
  src: string
  alt: string
  editorField?: string
  children: ReactNode
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const update = () => {
      raf = 0
      const frame = frameRef.current
      const img = imgRef.current
      if (!frame || !img) return
      const rect = frame.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // progress: -1 (just below viewport) → 1 (just above)
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh
      const shift = Math.max(-1, Math.min(1, progress)) * -28 // px
      img.style.transform = `translate3d(0, ${shift}px, 0) scale(1.12)`
    }
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={frameRef} className={styles.parallaxFrame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={alt} className={styles.parallaxImg} loading="lazy"
        data-corevo-editor-field={editorField}
        data-corevo-editor-stable-field={editorField} />
      <span className={styles.parallaxOverlay} aria-hidden="true" />
      <div className={styles.parallaxContent}>{children}</div>
    </div>
  )
}
