import Link from 'next/link'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * ZIGGE — dark barber + frisör (handoff Zigge.jsx). Distinct shape:
 *  a split-screen hero (a surface color-panel with UPPERCASE display + a photo
 *  half), full-width horizontal service bands, a horizontal stat strip, square
 *  (radius-2) buttons. Solid split nav + MiniFooter (chrome).
 *
 * No `.hero` sentinel: the nav stays solid; the split hero sits below --nav-h.
 * The dark surface comes entirely from the zigge theme tokens (near-black warm).
 */
export function ZiggeLayout({ content, services, modules }: StorefrontLayoutProps) {
  // ZIGGE ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats
  // band-grammatik (fullbredds-rader med nummer, uppercase band-etiketter)
  // istället för den generiska sektions-stapeln — page.tsx hoppar över
  // StorefrontModuleSections för zigge och förladdar teasers
  // (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir synkron
  // (studions klient-preview renderar samma komponent). Modulernas EGNA sidor är
  // hemmet för hela innehållet (/shop, /blogg, /presentkort).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  return (
    <>
      {/* split hero: color panel + photo */}
      <section className={styles.sfSplitHero}>
        <div className={styles.sfSplitPanel}>
          <p className="sf-eyebrow" style={{ color: 'var(--color-primary)' }}>
            {content.heroEyebrow}
          </p>
          <h1 className={styles.sfSplitTitle} style={{ whiteSpace: 'pre-line' }}>
            {content.heroTitle}
          </h1>
          <p className="sf-lede" style={{ maxWidth: '26rem', marginTop: 22 }}>
            {content.heroLede}
          </p>
          <div className={styles.sfSplitActions}>
            <BookCta className={styles.sfSquareCta} />
            <span className={styles.sfSplitNote}>eller drop in</span>
          </div>
        </div>
        <div
          className={styles.sfSplitPhoto}
          style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
        />
      </section>

      {/* horizontal service bands */}
      <section>
        <div className={styles.sfBandLabel}>Tjänster</div>
        {services.length > 0 ? (
          services.map((s, i) => (
            <Bookable key={s.id} className={styles.sfBand} label={`Boka — ${s.name}`}>
              <span className={styles.sfBandNum} aria-hidden="true">
                {serviceNum(i)}
              </span>
              <span className={styles.sfBandMain}>
                <span className={styles.sfBandName}>{s.name}</span>
                <span className={styles.sfBandDesc}>{serviceDesc(s)}</span>
              </span>
              <span className={styles.sfBandMeta}>
                <span className={styles.sfBandPrice}>{formatPrice(s)}</span>
                <span className={styles.sfBandTime}>{formatDuration(s)}</span>
              </span>
            </Bookable>
          ))
        ) : (
          <div className={styles.sfBand}>
            <span className="sf-body">Tjänster läggs upp inom kort.</span>
          </div>
        )}
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i zigges band-grammatik: samma
          fullbredds-rader med nummer som tjänsterna, uppercase band-etikett.
          Bara ett smakprov; hela sortimentet bor på /shop. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section>
          <div className={styles.sfBandLabel}>Butiken</div>
          {shopTeasers.map((p, i) => (
            <Link key={p.id} href={`/shop/${p.id}`} className={styles.sfBand}>
              <span className={styles.sfBandNum} aria-hidden="true">
                {serviceNum(i)}
              </span>
              <span className={styles.sfBandMain}>
                <span className={styles.sfBandName}>{p.name}</span>
              </span>
              <span className={styles.sfBandMeta}>
                <span className={styles.sfBandPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
              </span>
            </Link>
          ))}
          <div className={styles.sfBandLabel} style={{ borderTop: 'none' }}>
            <Link href="/shop" className={styles.sfMoreLink} style={{ marginTop: 0 }}>
              Visa hela butiken <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      {/* stat strip */}
      <section className={styles.sfStatStrip}>
        {content.stats.map(([n, l]) => (
          <div key={l} className={styles.sfStatStripCell}>
            <span className={styles.sfStatValueLg}>{n}</span>
            <span className={styles.sfStatStripLabel}>{l}</span>
          </div>
        ))}
      </section>

      {/* FRÅN BLOGGEN — blogg-modulen invävd i samma band-rader (titel + utdrag → /blogg).
          Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section>
          <div className={styles.sfBandLabel} style={{ borderTop: 'none' }}>Bloggen</div>
          {bloggTeasers.map((p, i) => (
            <Link key={p.id} href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.sfBand}>
              <span className={styles.sfBandNum} aria-hidden="true">
                {serviceNum(i)}
              </span>
              <span className={styles.sfBandMain}>
                <span className={styles.sfBandName}>{p.title}</span>
                {p.excerpt ? <span className={styles.sfBandDesc}>{p.excerpt}</span> : null}
              </span>
              <span className={styles.sfBandMeta} aria-hidden="true">
                <span className={styles.sfBandPrice}>→</span>
              </span>
            </Link>
          ))}
          <div className={styles.sfBandLabel} style={{ borderTop: 'none' }}>
            <Link href="/blogg" className={styles.sfMoreLink} style={{ marginTop: 0 }}>
              Läs hela bloggen <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      {/* PRESENTKORT — smal band-rad i temats grammatik: en enda sfBand-rad → /presentkort. */}
      {presentkortLive ? (
        <section>
          <div className={styles.sfBandLabel} style={{ borderTop: 'none' }}>Presentkort</div>
          <Link href="/presentkort" className={styles.sfBand}>
            <span className={styles.sfBandNum} aria-hidden="true">
              —
            </span>
            <span className={styles.sfBandMain}>
              <span className={styles.sfBandName}>Ge bort en tid hos oss</span>
              <span className={styles.sfBandDesc}>Presentkort för valfri behandling — ett säkert kort.</span>
            </span>
            <span className={styles.sfBandMeta} aria-hidden="true">
              <span className={styles.sfBandPrice}>→</span>
            </span>
          </Link>
        </section>
      ) : null}
    </>
  )
}
