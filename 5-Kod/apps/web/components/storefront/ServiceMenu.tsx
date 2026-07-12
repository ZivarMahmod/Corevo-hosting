import type { Service } from '@/lib/tenant-data'
import { BookCta } from '@/components/brand/BookCta'
import { Reveal } from './Reveal'
import styles from './storefront.module.css'

const kr = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

/**
 * Numbered editorial service menu (01–05) — the biggest "craft" signal.
 * number / SERVICE NAME (serif) / italic one-line description / price — KR,
 * separated by hairline dividers. NOT boxes. Real tenant services wire in here.
 *
 * States: empty → friendly Swedish copy + the Boka CTA (which itself degrades to
 * the /boka route when there's nothing to book). Each row fades up, staggered.
 */
export function ServiceMenu({
  services,
  limit,
}: {
  services: Service[]
  limit?: number
}) {
  const rows = typeof limit === 'number' ? services.slice(0, limit) : services

  if (rows.length === 0) {
    return (
      <div className={styles.menuEmpty}>
        <p className={styles.menuEmptyTitle}>Tjänster läggs upp inom kort</p>
        <p className={styles.menuEmptyText}>
          Tjänsterna läggs upp inom kort — titta in igen snart.
        </p>
        <div className={styles.menuEmptyCta}>
          <BookCta />
        </div>
      </div>
    )
  }

  return (
    <ol className={styles.menu}>
      {rows.map((s, i) => (
        <Reveal as="li" key={s.id} delay={i * 70} className={styles.menuRow}>
          <span className={styles.menuNum} aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className={styles.menuMain}>
            <span className={styles.menuName}>
              {s.name}
              {s.badge ? <span className={styles.menuBadge}>{s.badge}</span> : null}
            </span>
            <span className={styles.menuDesc}>
              {s.description || `${s.duration_min} min behandling`}
            </span>
          </span>
          <span className={styles.menuMeta}>
            <span className={styles.menuDuration}>{s.duration_min} min</span>
            <span className={styles.menuPrice}>
              {s.sale_price_cents != null && s.sale_price_cents < s.price_cents ? (
                <>
                  <span className={styles.menuOldPrice}>{kr.format(s.price_cents / 100)}</span>
                  {kr.format(s.sale_price_cents / 100)}
                </>
              ) : (
                kr.format(s.price_cents / 100)
              )}
            </span>
          </span>
        </Reveal>
      ))}
    </ol>
  )
}
