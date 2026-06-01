'use client'

import { useRef, useState, type ElementType, type ReactNode } from 'react'
import styles from './storefront.module.css'

/**
 * Scroll-reveal wrapper: fade-up (opacity 0→1, translateY 24px→0) when the
 * element scrolls into view, via IntersectionObserver. Optional stagger delay
 * for list rhythm (service rows 01, 02, 03…).
 *
 * SSR / #418-safe: both server and the first client render output the SAME
 * hidden markup (the `.reveal` class). We flip to revealed only after mount, in
 * an effect — so hydration always matches.
 *
 * Accessibility: under prefers-reduced-motion the stylesheet disables the
 * transform and the content is shown immediately; and if JS never runs / the
 * observer is unsupported, we reveal on mount as a fallback so content is never
 * trapped hidden.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
}: {
  children: ReactNode
  as?: ElementType
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  // Callback ref keeps this polymorphic (`as` can be any element) without
  // fighting ElementType's untyped ref — and lets us observe as soon as the node
  // mounts.
  const setNode = (node: HTMLElement | null) => {
    ref.current = node
    if (!node || shown) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true) // fallback: no observer → just show
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(node)
  }

  return (
    <Tag
      ref={setNode}
      className={`${styles.reveal} ${shown ? styles.revealShown : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
