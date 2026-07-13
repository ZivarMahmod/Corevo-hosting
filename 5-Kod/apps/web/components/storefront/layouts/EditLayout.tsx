import Link from 'next/link'
import { Reveal } from '../Reveal'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../service-format'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'
import ed from './edit.module.css'

/**
 * EDIT — editorial minimal (handoff Edit.jsx). Distinct shape:
 *  an asymmetric hero (a big image with an overlapping text card pulled up over
 *  it), a numbered 2-column service grid, an about split with inline stats, and
 *  square (radius-2) buttons. Solid left nav + MiniFooter (chrome). Charcoal on
 *  ivory, lots of hairlines — magazine, not salon-soft.
 *
 * goal-54 S10: EDIT ÄGER SINA MODULER — butik/blogg/presentkort vävs in i
 * temats editorial-grammatik (hairline-band, inline-etiketter, gråskala-foton,
 * numrerade rader) istället för den generiska sektions-stapeln; page.tsx hoppar
 * över StorefrontModuleSections och förladdar teasers (loadLayoutModuleTeasers)
 * som `modules`-prop så layouten förblir SYNKRON (studions klient-preview
 * renderar samma komponent). Modulernas EGNA sidor är fortfarande hemmet
 * (/shop, /blogg, /presentkort).
 *
 * goal-60 — VIRUSET BOTAT: mallen bar 13 inline `style={{}}`. Journalens rader var
 * <Link>-kort vars enda styling var `textDecoration: 'none'` — de kunde inte bära
 * :hover/:focus/:active fastän grannklassen (tjänsterna) hade alla tre. All styling
 * bor nu i edit.module.css; Edits röst-tokens (knapp, fält, chip, fokus, danger) i
 * packages/ui/tokens.css under [data-theme="edit"] — den enda rot som når nav,
 * sidfot, undersidor OCH modul-rötter. Kvar: 3 bild-URL:er (genuint dynamiska).
 */
export function EditLayout({ tenant, content, services, modules }: StorefrontLayoutProps) {
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  return (
    <>
      {/* asymmetric hero: big image + overlapping card */}
      <section className={styles.sfEditHero}>
        {/* Genuint dynamisk: bild-URL:en kommer ur tenantens innehåll och kan inte bo
            i en statisk CSS-fil. Formen (höjd, cover, gråskala) ägs av .sfEditHeroImg. */}
        <div
          className={styles.sfEditHeroImg}
          style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
        />
        <div className={styles.sfEditCard}>
          <p className="sf-eyebrow">{content.heroEyebrow}</p>
          <h1 className={`${styles.heroTitle} ${ed.heroTitle}`}>{content.heroTitle}</h1>
          <p className={`sf-lede ${ed.heroLede}`}>{content.heroLede}</p>
          <div className={ed.heroActions}>
            <BookCta className={styles.sfSquareCta} />
          </div>
        </div>
      </section>

      {/* numbered 2-col service grid */}
      <section className={styles.sfEditServices}>
        <div className={styles.sfWide}>
          <div className={styles.sfBandLabelInline}>Tjänster</div>
          {services.length > 0 ? (
            <div className={styles.sfEditGrid}>
              {services.map((s, i) => (
                <Bookable key={s.id} className={styles.sfEditRow} label={`Boka — ${s.name}`}>
                  <span className={styles.sfEditNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.sfEditRowMain}>
                    <span className={styles.sfEditRowHead}>
                      <span className={styles.sfEditRowName}>{s.name}</span>
                      <span className={styles.sfEditRowPrice}>{formatPrice(s)}</span>
                    </span>
                    <span className={styles.sfEditRowDesc}>
                      {serviceDesc(s)} · {formatDuration(s)}
                    </span>
                  </span>
                </Bookable>
              ))}
            </div>
          ) : (
            <p className="sf-body">Tjänster läggs upp inom kort.</p>
          )}
        </div>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i edit-grammatiken (hairline-band,
          gråskala-foton, namn/pris-huvud). Smakprov; hela sortimentet bor på /shop. */}
      {shopTeasers.length > 0 ? (
        <section className={`${styles.sfEditServices} ${ed.sectionTight}`}>
          <div className={styles.sfWide}>
            <div className={styles.sfBandLabelInline}>Ur butiken</div>
            <div className={styles.sfEdTeaserGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal as="div" key={p.id} delay={i * 60}>
                  <Link href={`/shop/${p.id}`} className={styles.sfEdTeaserCard}>
                    {/* Genuint dynamisk bild-URL (villkorad: utan foto ska plattan
                        behålla sin accent-soft-yta, inte få `url(undefined)`). */}
                    <div
                      className={styles.sfEdTeaserImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <span className={styles.sfEditRowHead}>
                      <span className={styles.sfEditRowName}>{p.name}</span>
                      <span className={styles.sfEditRowPrice}>{formatProductPrice(p)}</span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
            <Link href="/shop" className={styles.sfMoreLink}>
              Visa hela butiken <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      {/* about split + inline stats */}
      <section className={`${styles.sfEditAbout} ${ed.foldedCorner}`}>
        <div className={`${styles.sfWide} ${styles.sfEditAboutGrid}`}>
          <Reveal>
            {/* Genuint dynamisk bild-URL; formen (ratio, cover) ägs av .sfEditAboutPhoto. */}
            <div
              className={styles.sfEditAboutPhoto}
              style={{ backgroundImage: `url(${content.aboutImage})` }}
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <p className={`sf-italic ${styles.sfEditQuote}`}>&ldquo;{content.italic}&rdquo;</p>
            <p className={`sf-body ${ed.aboutBody}`}>{content.aboutCopyHome}</p>
            <ul className={styles.sfStatInline}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.sfStatValue}>{n}</span>
                  <span className={styles.sfStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* JOURNALEN — blogg-modulen invävd som numrerade editorial-rader (3 senaste) */}
      {bloggTeasers.length > 0 ? (
        <section className={`${styles.sfEditServices} ${ed.sectionTight}`}>
          <div className={styles.sfWide}>
            <div className={styles.sfBandLabelInline}>Journalen</div>
            <div className={styles.sfEditGrid}>
              {bloggTeasers.map((p, i) => (
                // Var: `style={{ textDecoration: 'none' }}` — en klickyta som inte
                // kunde bära ett tillstånd. .rowLink bär nu hover, focus-visible
                // och active, ovanpå .sfEditRow:s delade bakgrundsskifte.
                <Link
                  key={p.id}
                  href={p.slug ? `/blogg/${p.slug}` : '/blogg'}
                  className={`${styles.sfEditRow} ${ed.rowLink}`}
                >
                  <span className={styles.sfEditNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.sfEditRowMain}>
                    <span className={styles.sfEditRowHead}>
                      <span className={`${styles.sfEditRowName} ${ed.rowName}`}>{p.title}</span>
                    </span>
                    {p.excerpt ? <span className={styles.sfEditRowDesc}>{p.excerpt}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/blogg" className={styles.sfMoreLink}>
              Läs hela journalen <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      {/* PRESENTKORT — en hairline-rad i temats ton, inte en hel stapel-sektion */}
      {presentkortLive ? (
        <section className={`${styles.sfEditServices} ${ed.sectionTight}`}>
          <div className={styles.sfWide}>
            <div className={styles.sfBandLabelInline}>Presentkort</div>
            <p className={`sf-italic ${styles.sfEditQuote} ${ed.quoteFlush}`}>
              Ge bort ett besök värt att minnas.
            </p>
            <div className={ed.giftActions}>
              <Link href="/presentkort" className={`btn-accent ${styles.sfSquareCta}`}>
                Till presentkorten
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
