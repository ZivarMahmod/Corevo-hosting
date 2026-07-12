'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import styles from './zentum.module.css'

/**
 * Zentum-mallens klient-beteenden (portade ur den statiska kopians app.js):
 * hero-lagerintro vid load, split-line rubrik-reveal, referens-slider (autoplay
 * 4000ms) och logo-carousel (4 synliga). Layouten själv förblir SYNKRON — den
 * renderar bara dessa som barn, så onboarding-studions preview kan rendera den.
 *
 * SSR-säkert: server och första klient-render ger SAMMA markup; klasserna flippas
 * först i en effekt.
 */

/** Hero-skalet: lägger på .isLoaded när bakgrunden laddat → lagren tonar in i sekvens. */
export function ZentumHeroShell({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60)
    return () => clearTimeout(t)
  }, [])
  return (
    <section className={`${styles.hero} ${loaded ? styles.isLoaded : ''}`}>{children}</section>
  )
}

/** Fade-up vid inscroll. */
export function ZentumReveal({
  children,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode
  as?: ElementType
  className?: string
}) {
  const [shown, setShown] = useState(false)
  const setNode = (node: HTMLElement | null) => {
    if (!node || shown) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.15 },
    )
    io.observe(node)
  }
  return (
    <Tag
      ref={setNode}
      className={`${styles.revealFade} ${shown ? styles.isInview : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

/** Split-line-rubrik: varje rad (\n) glider upp ur sin egen mask. */
export function ZentumHeading({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const [shown, setShown] = useState(false)
  const setNode = (node: HTMLElement | null) => {
    if (!node || shown) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.15 },
    )
    io.observe(node)
  }
  return (
    <h2
      ref={setNode}
      className={`${styles.sectionTitle} ${styles.revealLines} ${shown ? styles.isInview : ''} ${className}`}
    >
      {text.split('\n').map((line, i) => (
        <span key={i} className={styles.line}>
          <span>{line}</span>
        </span>
      ))}
    </h2>
  )
}

export type Testimonial = { quote: string; name: string; company: string; initials: string }

/** Referens-slider: 1 synlig, autoplay 4000ms (rå-tempo), prickar. */
export function ZentumTestimonials({ items }: { items: Testimonial[] }) {
  const [idx, setIdx] = useState(0)
  const count = items.length
  useEffect(() => {
    if (count < 2) return
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 4000)
    return () => clearInterval(t)
  }, [count])

  return (
    <div className={styles.testiMain}>
      <div className={styles.testiViewport}>
        <div className={styles.testiTrack} style={{ transform: `translateX(-${idx * 100}%)` }}>
          {items.map((t) => (
            <div key={t.name} className={styles.testiSlide}>
              <p className={styles.testiQuote}>{t.quote}</p>
              <div className={styles.testiAuthor}>
                <div className={styles.testiLogo} aria-hidden="true">{t.initials}</div>
                <div>
                  <h3 className={styles.testiName}>{t.name}</h3>
                  <p className={styles.testiCompany}>{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className={styles.testiDots}>
          {items.map((t, i) => (
            <button
              key={t.name}
              type="button"
              aria-label={`Referens ${i + 1}`}
              className={`${styles.testiDot} ${i === idx ? styles.testiDotActive : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Partner-logotyper: 4 synliga, stegar var 3:e sekund. */
export function ZentumLogos({ items }: { items: string[] }) {
  const [pos, setPos] = useState(0)
  const visible = 4
  const max = Math.max(0, items.length - visible)
  const ref = useRef(0)
  useEffect(() => {
    if (max === 0) return
    const t = setInterval(() => {
      ref.current = ref.current >= max ? 0 : ref.current + 1
      setPos(ref.current)
    }, 3000)
    return () => clearInterval(t)
  }, [max])

  return (
    <div className={styles.logosViewport}>
      <div
        className={styles.logosTrack}
        style={{ transform: `translateX(-${pos * (100 / visible)}%)` }}
      >
        {items.map((name) => (
          <div key={name} className={styles.logoItem}>
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
