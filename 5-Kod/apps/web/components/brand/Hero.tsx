import { BookCta } from './BookCta'
import type { BrandProps } from './types'
import { HeroCarousel } from '@/components/storefront/HeroCarousel'
import { HERO_PHOTOS } from '@/components/storefront/images'
import styles from '@/components/storefront/storefront.module.css'

/* The three heroes are now ALL photo-first (full-bleed carousel + dark overlay),
   but compose differently per template so two tenants read as unrelated sites:
   - Hero1 (Template A 'Salong'): CENTERED — headline + short welcome + pill CTA,
     all centred. Soft, airy, feminine.
   - Hero2 (Template B 'Atelier'): LEFT-ALIGNED EDITORIAL — eyebrow label, giant
     uppercase headline, italic tagline, square CTA, carousel arrows + dots.
   - Hero3 (Template C 'Studio'): SPLIT — content offset/structured, modern.
   Headlines use the display serif (var(--font-display)); the CTA is the gold
   accent pill. All copy sits in cream/white over the photo. */

/** Hero variant 1 — Salong: centered, photo carousel, pill CTA. */
export function Hero1({ tenant }: BrandProps) {
  return (
    <section className={`hero ${styles.heroSection}`} aria-label="Välkommen">
      <HeroCarousel images={HERO_PHOTOS} align="center">
        <p className={styles.heroEyebrow}>Välkommen till {tenant.name}</p>
        <h1 className={styles.heroTitle}>{tenant.name}</h1>
        <p className={styles.heroLead}>
          En stund för dig. Boka din tid online — enkelt, snabbt och när det passar dig.
        </p>
        <div className={styles.heroActions}>
          <BookCta className={styles.heroCta} />
        </div>
      </HeroCarousel>
    </section>
  )
}

/** Hero variant 2 — Atelier: left-aligned editorial, uppercase, arrows + dots. */
export function Hero2({ tenant }: BrandProps) {
  return (
    <section className={`hero ${styles.heroSection}`} aria-label="Välkommen">
      <HeroCarousel images={HERO_PHOTOS} align="left" controls="arrows-dots">
        <p className={styles.heroEyebrow}>{tenant.name} · Frisörsalong</p>
        <h1 className={styles.heroTitle}>{tenant.name}</h1>
        <p className={styles.heroTagline}>Skarpt klippt. Skönt mottagen.</p>
        <div className={styles.heroActions}>
          <BookCta className={styles.heroCta} />
        </div>
      </HeroCarousel>
    </section>
  )
}

/** Hero variant 3 — Studio: split-offset content over the photo, modern grid. */
export function Hero3({ tenant }: BrandProps) {
  return (
    <section className={`hero ${styles.heroSection}`} aria-label="Välkommen">
      <HeroCarousel images={HERO_PHOTOS} align="split">
        <p className={styles.heroEyebrow}>Boka online · när det passar dig</p>
        <h1 className={styles.heroTitle}>{tenant.name}</h1>
        <p className={styles.heroLead}>
          Hantverk, omsorg och en upplevelse som sitter. Hitta en ledig tid och boka direkt —
          utan telefonköer.
        </p>
        <div className={styles.heroActions}>
          <BookCta className={styles.heroCta} />
        </div>
      </HeroCarousel>
    </section>
  )
}
