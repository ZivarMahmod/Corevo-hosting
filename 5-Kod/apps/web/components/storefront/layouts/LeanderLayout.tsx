import Link from 'next/link'
import { HeroCarousel } from '../HeroCarousel'
import { Reveal } from '../Reveal'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice } from '../service-format'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'
import ld from './leander.module.css'

/**
 * LEANDER — centered, symmetric, romantic (handoff Leander.jsx). Distinct shape:
 *  a centered hero carousel, a centered 2-column dotted price list, an italic
 *  quote band + centered stats, then a MiniFooter (chrome). NO team / gallery —
 *  the restraint is what makes it read as a different site.
 *
 * The hero sits in normal flow BELOW a solid centered nav (no `.hero` sentinel,
 * so the nav stays solid), inside the reserved --nav-h.
 *
 * goal-60 — VIRUSET BOTAT: mallen bar 18 inline `style={{}}`. En inline-yta kan inte
 * bära :hover/:focus/:active, så blogg-teaserns länk var en klickyta utan ett enda
 * tillstånd. All styling bor nu i leander.module.css; Leanders röst-tokens (knapp,
 * fält, chip, fokus, danger) i packages/ui/tokens.css under [data-theme="leander"] —
 * den enda rot som når nav, sidfot, undersidor OCH modul-rötter.
 */
export function LeanderLayout({ content, services, modules }: StorefrontLayoutProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  // LEANDER ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats
  // centrerade, återhållsamma grammatik (punktade prisrader, quote-band) istället
  // för den generiska sektions-stapeln — page.tsx hoppar över
  // StorefrontModuleSections för leander och förladdar teasers
  // (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir synkron
  // (studions klient-preview renderar samma komponent). Modulernas EGNA sidor är
  // hemmet för hela innehållet (/shop, /blogg, /presentkort).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortReachable = modules?.presentkortReachable ?? false

  return (
    <>
      {/* centered hero carousel */}
      <section className={styles.sfHeroCentered} aria-label="Välkommen">
        <HeroCarousel
          images={content.heroImages.map((src) => ({ src, alt: '' }))}
          align="center"
        >
          <p className={`${styles.heroEyebrow} ${ld.heroEyebrowWide}`}>{content.heroEyebrow}</p>
          <h1 className={`${styles.heroTitle} ${ld.heroTitleCentered}`}>{content.heroTitle}</h1>
          <p className={`${styles.heroLead} ${ld.heroLeadNarrow}`}>{content.heroLede}</p>
          <div className={styles.heroActions}>
            <BookCta enabled={bookingReachable} className={styles.heroCta} />
          </div>
        </HeroCarousel>
      </section>

      {/* centered 2-col dotted price list */}
      <section className={styles.sfPriceBand}>
        <Reveal className={ld.centered}>
          <p className="sf-eyebrow">— Behandlingar</p>
          <h2 className={`sf-h1 ${ld.secTitle}`}>Prislista</h2>
        </Reveal>
        {services.length > 0 ? (
          <div className={styles.sfPriceGrid}>
            {services.map((s) => (
              <Bookable enabled={bookingReachable} key={s.id} className={styles.sfPriceRow} label={`Boka — ${s.name}`}>
                <span className={styles.sfPriceName}>{s.name}</span>
                <span className={styles.sfPriceDots} aria-hidden="true" />
                <span className={styles.sfPriceVal}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
        ) : (
          <p className={`sf-body ${ld.emptyCentered}`}>Prislistan publiceras inom kort.</p>
        )}
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i leanders grammatik: samma centrerade
          punktade rader som prislistan (inga bilder — återhållsamheten ÄR temat).
          Bara ett smakprov; hela sortimentet bor på /shop. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={`${styles.sfPriceBand} ${ld.bandFlush}`}>
          <Reveal className={ld.centered}>
            <p className="sf-eyebrow">— Ur butiken</p>
            <h2 className={`sf-h1 ${ld.secTitle}`}>Att ta med hem</h2>
          </Reveal>
          <div className={styles.sfPriceGrid}>
            {shopTeasers.map((p) => (
              <Link key={p.id} href={`/shop/${p.id}`} className={styles.sfPriceRow}>
                <span className={styles.sfPriceName}>{p.name}</span>
                <span className={styles.sfPriceDots} aria-hidden="true" />
                <span className={styles.sfPriceVal}>{formatProductPrice(p)}</span>
              </Link>
            ))}
          </div>
          <Reveal className={ld.centered}>
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
          <Reveal className={ld.centered}>
            <p className="sf-eyebrow">— Från bloggen</p>
            <h2 className={`sf-h1 ${ld.secTitleTight}`}>Senaste inläggen</h2>
          </Reveal>
          <div className={ld.postList}>
            {bloggTeasers.map((p) => (
              <Reveal key={p.id}>
                {/* Var en inline-stylad block-länk utan ett enda tillstånd. .postLink
                    bär nu hover, focus-visible, active och 44px klickyta. */}
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={ld.postLink}>
                  <span className={`${styles.sfPriceName} ${ld.postTitle}`}>{p.title}</span>
                  {p.excerpt ? (
                    <span className={`sf-body ${ld.postExcerpt}`}>{p.excerpt}</span>
                  ) : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={ld.centered}>
            <Link href="/blogg" className={styles.sfMoreLink}>
              Läs hela bloggen <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PRESENTKORT — smal band-rad i quote-bandets accent-soft-yta. */}
      {presentkortReachable ? (
        <section className={`${styles.sfQuoteBand} ${ld.giftBand}`}>
          <Reveal>
            <p className="sf-eyebrow">— Presentkort</p>
            <p className={`sf-italic ${styles.sfQuote} ${ld.giftQuote}`}>
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
