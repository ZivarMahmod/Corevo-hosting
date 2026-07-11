import Link from 'next/link'
import { HeroCarousel } from '../HeroCarousel'
import { Reveal } from '../Reveal'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice } from '../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * LEANDER — centered, symmetric, romantic (handoff Leander.jsx). Distinct shape:
 *  a centered hero carousel, a centered 2-column dotted price list, an italic
 *  quote band + centered stats, then a MiniFooter (chrome). NO team / gallery —
 *  the restraint is what makes it read as a different site.
 *
 * The hero sits in normal flow BELOW a solid centered nav (no `.hero` sentinel,
 * so the nav stays solid), inside the reserved --nav-h.
 */
export function LeanderLayout({ content, services, modules }: StorefrontLayoutProps) {
  // LEANDER ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats
  // centrerade, återhållsamma grammatik (punktade prisrader, quote-band) istället
  // för den generiska sektions-stapeln — page.tsx hoppar över
  // StorefrontModuleSections för leander och förladdar teasers
  // (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir synkron
  // (studions klient-preview renderar samma komponent). Modulernas EGNA sidor är
  // hemmet för hela innehållet (/shop, /blogg, /presentkort).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  return (
    <>
      {/* centered hero carousel */}
      <section className={styles.sfHeroCentered} aria-label="Välkommen">
        <HeroCarousel
          images={content.heroImages.map((src) => ({ src, alt: '' }))}
          align="center"
        >
          <p className={styles.heroEyebrow} style={{ letterSpacing: '0.28em' }}>
            {content.heroEyebrow}
          </p>
          <h1 className={styles.heroTitle} style={{ whiteSpace: 'pre-line', maxWidth: '52rem' }}>
            {content.heroTitle}
          </h1>
          <p className={styles.heroLead} style={{ maxWidth: '34rem' }}>
            {content.heroLede}
          </p>
          <div className={styles.heroActions}>
            <BookCta className={styles.heroCta} />
          </div>
        </HeroCarousel>
      </section>

      {/* centered 2-col dotted price list */}
      <section className={styles.sfPriceBand}>
        <Reveal style={{ textAlign: 'center' }}>
          <p className="sf-eyebrow">— Behandlingar</p>
          <h2 className="sf-h1" style={{ margin: '12px 0 44px' }}>
            Prislista
          </h2>
        </Reveal>
        {services.length > 0 ? (
          <div className={styles.sfPriceGrid}>
            {services.map((s) => (
              <Bookable key={s.id} className={styles.sfPriceRow} label={`Boka — ${s.name}`}>
                <span className={styles.sfPriceName}>{s.name}</span>
                <span className={styles.sfPriceDots} aria-hidden="true" />
                <span className={styles.sfPriceVal}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
        ) : (
          <p className="sf-body" style={{ textAlign: 'center' }}>
            Prislistan publiceras inom kort.
          </p>
        )}
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i leanders grammatik: samma centrerade
          punktade rader som prislistan (inga bilder — återhållsamheten ÄR temat).
          Bara ett smakprov; hela sortimentet bor på /shop. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.sfPriceBand} style={{ paddingTop: 0 }}>
          <Reveal style={{ textAlign: 'center' }}>
            <p className="sf-eyebrow">— Ur butiken</p>
            <h2 className="sf-h1" style={{ margin: '12px 0 44px' }}>
              Att ta med hem
            </h2>
          </Reveal>
          <div className={styles.sfPriceGrid}>
            {shopTeasers.map((p) => (
              <Link key={p.id} href={`/shop/${p.id}`} className={styles.sfPriceRow}>
                <span className={styles.sfPriceName}>{p.name}</span>
                <span className={styles.sfPriceDots} aria-hidden="true" />
                <span className={styles.sfPriceVal}>{formatShopPrice(p.priceCents, p.currency)}</span>
              </Link>
            ))}
          </div>
          <Reveal style={{ textAlign: 'center' }}>
            <Link href="/shop" className={styles.sfMoreLink}>
              Visa hela butiken <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* italic quote + centered stats */}
      <section className={styles.sfQuoteBand}>
        <Reveal>
          <p className={`sf-italic ${styles.sfQuote}`}>&ldquo;{content.italic}&rdquo;</p>
          <ul className={styles.sfStatRowCenter}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.sfStatValueLg}>{n}</span>
                <span className={styles.sfStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* FRÅN BLOGGEN — blogg-modulen invävd: centrerade titelrader i temats
          återhållsamma ton (inga kort, inga bilder). Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.sfPriceBand}>
          <Reveal style={{ textAlign: 'center' }}>
            <p className="sf-eyebrow">— Från bloggen</p>
            <h2 className="sf-h1" style={{ margin: '12px 0 32px' }}>
              Senaste inläggen
            </h2>
          </Reveal>
          <div style={{ maxWidth: '38rem', margin: '0 auto' }}>
            {bloggTeasers.map((p) => (
              <Reveal key={p.id}>
                <Link
                  href={p.slug ? `/blogg/${p.slug}` : '/blogg'}
                  style={{ display: 'block', padding: '18px 0', borderBottom: '1px solid var(--color-line)' }}
                >
                  <span className={styles.sfPriceName}>{p.title}</span>
                  {p.excerpt ? (
                    <span className="sf-body" style={{ display: 'block', fontSize: 14, marginTop: 6 }}>
                      {p.excerpt}
                    </span>
                  ) : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ textAlign: 'center' }}>
            <Link href="/blogg" className={styles.sfMoreLink}>
              Läs hela bloggen <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PRESENTKORT — smal band-rad i quote-bandets accent-soft-yta. */}
      {presentkortLive ? (
        <section className={styles.sfQuoteBand} style={{ padding: 'clamp(40px, 6vw, 64px) 24px' }}>
          <Reveal>
            <p className="sf-eyebrow">— Presentkort</p>
            <p className={`sf-italic ${styles.sfQuote}`} style={{ fontSize: 'clamp(20px, 2.4vw, 28px)', marginTop: 12 }}>
              Ge bort en stund av omtanke.
            </p>
            <Link href="/presentkort" className={styles.sfMoreLink}>
              Till presentkorten <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}
    </>
  )
}
