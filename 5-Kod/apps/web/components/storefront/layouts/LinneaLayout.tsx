import Link from 'next/link'
import { Reveal } from '../Reveal'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '../StorefrontIcon'
import { formatPrice, formatDuration, serviceDesc } from '../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'
import ln from './linnea.module.css'

/**
 * LINNEA — warm Scandinavian natural (handoff Linnea.jsx). Distinct shape:
 *  a side-by-side hero (text beside a rounded image with a soft blob accent),
 *  a 3-column service-card grid each led by a scissors icon, and stat "chips".
 *  Solid left nav + MiniFooter (chrome). Everything rounded + warm clay/sand.
 *
 * goal-54 S10: LINNEA ÄGER SINA MODULER — butik/blogg/presentkort vävs in i
 * temats eget formspråk (rundade sfCard-kort, mjuka band) istället för den
 * generiska sektions-stapeln; page.tsx hoppar över StorefrontModuleSections och
 * förladdar teasers (loadLayoutModuleTeasers) som `modules`-prop så layouten
 * förblir SYNKRON (studions klient-preview renderar samma komponent).
 * Modulernas EGNA sidor är fortfarande hemmet (/shop, /blogg, /presentkort).
 *
 * goal-60: all inline-styling (19 st) flyttad till linnea.module.css — inline kan inte
 * bära :hover/:focus/:active. Kvar inline: BARA backgroundImage (bild-URL = dynamisk
 * data). Mallens knapp-/fält-/etikett-varsen bor i tokens.css under [data-theme="linnea"],
 * så de även når nav, sidfot och undersidorna (som inte laddar den här modulen).
 */
export function LinneaLayout({ tenant, content, services, modules }: StorefrontLayoutProps) {
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  return (
    <>
      {/* side-by-side hero */}
      <section className={styles.sfSideHero}>
        <div className={styles.sfSideText}>
          <span className={styles.sfPillEyebrow}>{content.heroEyebrow}</span>
          <h1 className={`${styles.heroTitle} ${ln.heroTitle}`}>{content.heroTitle}</h1>
          <p className={`sf-lede ${ln.heroLede}`}>{content.heroLede}</p>
          <div className={styles.sfSideActions}>
            <BookCta className={styles.heroCta} />
            <span className={styles.sfSideNote}>eller drop in →</span>
          </div>
        </div>
        <div className={styles.sfSideMedia}>
          <span className={styles.sfBlob} aria-hidden="true" />
          {/* backgroundImage = enda kvarvarande inline: bild-URL:en är dynamisk data. */}
          <div
            className={styles.sfSidePhoto}
            style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
          />
        </div>
      </section>

      {/* 3-col service cards + stat chips */}
      <section className={styles.sfCardBand}>
        <Reveal className={ln.center}>
          <p className="sf-eyebrow">— Behandlingar</p>
          <h2 className={`sf-h1 ${ln.secTitle}`}>Våra behandlingar</h2>
        </Reveal>
        {services.length > 0 ? (
          <div className={styles.sfCardGrid}>
            {services.map((s, i) => (
              <Reveal as="div" key={s.id} delay={i * 60}>
                <Bookable className={`${styles.sfCard} ${ln.card}`} label={`Boka — ${s.name}`}>
                  <span className={styles.sfCardIcon}>
                    <StorefrontIcon name="scissors" size={20} />
                  </span>
                  <h3 className={styles.sfCardName}>{s.name}</h3>
                  <p className={`sf-body ${ln.cardDesc}`}>{serviceDesc(s)}</p>
                  <div className={styles.sfCardMeta}>
                    <span className={styles.sfCardPrice}>{formatPrice(s)}</span>
                    <span className={styles.sfCardTime}>{formatDuration(s)}</span>
                  </div>
                </Bookable>
              </Reveal>
            ))}
          </div>
        ) : (
          <p className={`sf-body ${ln.emptyNote}`}>Behandlingar läggs upp inom kort.</p>
        )}

        <ul className={styles.sfChips}>
          {content.stats.map(([n, l]) => (
            <li key={l} className={styles.sfChip}>
              <span className={styles.sfChipValue}>{n}</span>
              <span className={styles.sfStatLabel}>{l}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i linnea-formspråket (rundade kort
          med mjuk fotoyta). Bara ett smakprov; hela sortimentet bor på /shop. */}
      {shopTeasers.length > 0 ? (
        <section className={`${styles.sfCardBand} ${ln.sectionTight}`}>
          <Reveal className={ln.center}>
            <p className="sf-eyebrow">— Ur butiken</p>
            <h2 className={`sf-h1 ${ln.secTitle}`}>Ta med något hem</h2>
          </Reveal>
          <div className={styles.sfCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal as="div" key={p.id} delay={i * 60}>
                <Link href={`/shop/${p.id}`} className={`${styles.sfCard} ${ln.card}`}>
                  <div
                    className={`${styles.sfLnCardPhoto} ${ln.cardPhoto}`}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <h3 className={styles.sfCardName}>{p.name}</h3>
                  <div className={styles.sfCardMeta}>
                    <span className={styles.sfCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={ln.center}>
            <Link href="/shop" className={`${styles.sfMoreLink} ${ln.moreLink}`}>
              Visa hela butiken <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste som rundade kort) */}
      {bloggTeasers.length > 0 ? (
        <section className={`${styles.sfCardBand} ${ln.sectionTight}`}>
          <Reveal className={ln.center}>
            <p className="sf-eyebrow">— Från bloggen</p>
            <h2 className={`sf-h1 ${ln.secTitle}`}>Tips & inspiration</h2>
          </Reveal>
          <div className={styles.sfCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal as="div" key={p.id} delay={i * 60}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={`${styles.sfCard} ${ln.card}`}>
                  <div
                    className={`${styles.sfLnCardPhoto} ${ln.cardPhoto}`}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={styles.sfCardName}>{p.title}</h3>
                  {p.excerpt ? <p className={`sf-body ${ln.cardDesc}`}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={ln.center}>
            <Link href="/blogg" className={`${styles.sfMoreLink} ${ln.moreLink}`}>
              Läs hela bloggen <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PRESENTKORT — ett mjukt band i temats ton, inte en hel stapel-sektion */}
      {presentkortLive ? (
        <section className={ln.giftBand}>
          <Reveal>
            <p className="sf-eyebrow">— Presentkort</p>
            <h2 className={`sf-h2 ${ln.secTitle}`}>Ge bort en stund att längta till</h2>
            <div className={ln.giftActions}>
              <Link href="/presentkort" className={`btn-accent ${styles.heroCta}`}>
                Till presentkorten
              </Link>
            </div>
          </Reveal>
        </section>
      ) : null}
    </>
  )
}
