import { BookCta } from './BookCta'
import type { BrandProps } from './types'
import styles from './brand.module.css'

/** Hero variant 1 — centered, large headline. */
export function Hero1({ tenant }: BrandProps) {
  return (
    <section className="hero hero-1">
      <div className="hero-inner">
        <h1>{tenant.name}</h1>
        <p className="hero-sub">
          Välkommen till {tenant.name}. Boka din tid online — enkelt, snabbt och när det passar dig.
        </p>
        <BookCta className="hero-cta" />
      </div>
    </section>
  )
}

/** Hero variant 2 — left-aligned with eyebrow label. */
export function Hero2({ tenant }: BrandProps) {
  return (
    <section className="hero hero-2">
      <div className="hero-inner">
        <p className="hero-eyebrow">Salong</p>
        <h1>{tenant.name}</h1>
        <p className="hero-sub">
          Hos {tenant.name} möts hantverk och omtanke. Välj en tid som passar dig.
        </p>
        <BookCta className="hero-cta" />
      </div>
    </section>
  )
}

/** Hero variant 3 — split editorial: headline + copy left, a decorative brand
 *  colour panel (built purely from --color-primary + --color-accent, no imagery)
 *  with an oversized monogram watermark on the right. Structurally distinct from
 *  the centered (1) and left-eyebrow (2) heroes. */
export function Hero3({ tenant }: BrandProps) {
  const monogram = tenant.name.trim().charAt(0).toUpperCase() || '·'
  return (
    <section className={`hero ${styles.hero3}`}>
      <div className={styles.hero3Grid}>
        <div className={styles.hero3Copy}>
          <p className={styles.hero3Eyebrow}>Boka online · när det passar dig</p>
          <h1 className={styles.hero3Title}>{tenant.name}</h1>
          <p className={styles.hero3Sub}>
            Hantverk, omsorg och en upplevelse som sitter. Hitta en ledig tid och boka
            direkt — utan telefonköer.
          </p>
          <BookCta className={styles.hero3Cta} />
        </div>
        <div className={styles.hero3Panel} data-monogram={monogram} aria-hidden="true">
          <span className={styles.hero3Mark}>
            <span className={styles.hero3Dot} />
            {tenant.name}
          </span>
        </div>
      </div>
    </section>
  )
}
