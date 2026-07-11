import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './paisley.module.css'

/**
 * PAISLEY — tegelröd/rost redaktionell florist (florist-branschens mall,
 * goal-58). Skarp tidningslayout: versaler, spärrad tracking, fyrkantiga ytor.
 * EGEN sektionsordning (ingen annan mall i sviten har den): (1) topprad med
 * leveransområde + Kontakt/Om/Leveransorter, (2) tegelröd annonsrad, (3)
 * centrerat skript-wordmark med spärrade versal-nav-länkar under, (4) fullbredds
 * foto-hero med enorm versal-serif-rubrik i bilden + fyrkantig CTA, (5) mörkt
 * tegelband "beställ före 15:00" med statisk DEKOR-nedräkning, (6) "Fira med
 * blommor" — brett två-kolumns text+bildkollage, (7) shop-teasers, (8) tjänster
 * (numrerade rader), (9) om, (10) blogg, (11) plats, (12) closing i eget
 * fullbredds-foto. Presentkort vävs in som en smal rad mellan plats och closing
 * (aldrig en egen sektion). Webshop/blogg/presentkort/offert vävs in via
 * `modules`-propen (S10) — samma modulkontrakt som övriga florist-mallar.
 */
export function PaisleyLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Utan modules-prop (studions statiska preview) visas allt — pekarna är ändå
  // inte klickbara på riktigt där, och previewn ska se en hel, riktig sida.
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true

  const heroImg = content.heroImages[0] ?? ''
  const celebrateMain = content.heroImages[1] ?? content.heroImages[0] ?? ''
  const celebrateInset = content.heroImages[2] ?? content.heroImages[0] ?? ''

  return (
    <div className={styles.paRoot}>
      {/* 1 — TOPPRAD: leveransområde (vänster) + Kontakt/Om/Leveransorter (höger).
          "Leveransorter" är ren information, inte en länk — det finns ingen egen
          sida för den (en död länk vore en 404-fälla). */}
      <div className={styles.paTop}>
        <div className={`${shared.sfWide} ${styles.paTopInner}`}>
          <p className={styles.paTopZone}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 22s7-7.4 7-12.6A7 7 0 0 0 5 9.4C5 14.6 12 22 12 22Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="12" cy="9.4" r="2.4" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            Lokal leverans & hämtning i butik
          </p>
          <ul className={styles.paTopLinks}>
            <li>
              <Link href="/kontakt" className={styles.paTopLink}>
                Kontakt
              </Link>
            </li>
            <li>
              <Link href="/om" className={styles.paTopLink}>
                Om
              </Link>
            </li>
            <li>
              <span className={styles.paTopLink}>Leveransorter</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 2 — ANNONSRAD: tegelröd kampanjrad */}
      <div className={styles.paAd}>
        <div className={`${shared.sfWide} ${styles.paAdInner}`}>
          <p className={styles.paAdText}>{content.tagline}</p>
        </div>
      </div>

      {/* 3 — MASTHEAD: centrerat skript-wordmark, nav-länkar under (spärrade
          versaler). "Boka tid" är en Bookable (öppnar drawern) stylad som
          samma plana textlänk — ingen knapp-yta i masthead. */}
      <div className={styles.paMasthead}>
        <p className={styles.paWordmark}>{tenant.name}</p>
        <p className={styles.paMastTag}>{content.utility}</p>
        <ul className={styles.paMastNav}>
          <li>
            <Link href="/" className={styles.paMastLink}>
              Hem
            </Link>
          </li>
          {services.length > 0 ? (
            <li>
              <Link href="/tjanster" className={styles.paMastLink}>
                Tjänster
              </Link>
            </li>
          ) : null}
          <li>
            <Link href="/om" className={styles.paMastLink}>
              Om
            </Link>
          </li>
          <li>
            <Link href="/kontakt" className={styles.paMastLink}>
              Kontakt
            </Link>
          </li>
          <li>
            <Bookable as="span" className={styles.paMastLink} label="Boka tid — öppna bokning">
              Boka tid
            </Bookable>
          </li>
        </ul>
      </div>

      {/* 4 — HERO: fullbredds foto, enorm versal-serif-rubrik i bilden, fyrkantig CTA */}
      <section className={styles.paHero} style={{ backgroundImage: `url(${heroImg})` }}>
        <div className={styles.paHeroOverlay} aria-hidden="true" />
        <div className={styles.paHeroInner}>
          {content.heroEyebrow ? <span className={styles.paHeroEyebrow}>{content.heroEyebrow}</span> : null}
          <h1 className={styles.paHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.paHeroLede}>{content.heroLede}</p>
          <div className={styles.paHeroActions}>
            <BookCta className={styles.paSquareCta} />
          </div>
        </div>
      </section>

      {/* 5 — SAMMA-DAGS-LEVERANS-BAND: mörkt tegelband. Nedräkningen är REN DEKOR
          — statiska siffror, ingen JS-timer (layouten är och förblir synkron).
          Rutorna är aria-hidden; textraden bär hela det verkliga budskapet. CTA:n
          går till butiken (att beställa blommor ≠ att boka en tjänst) — bara när
          shop är nåbar, annars faller den tillbaka på Boka tid. */}
      <section className={styles.paDelivery}>
        <div className={`${shared.sfWide} ${styles.paDeliveryInner}`}>
          <div className={styles.paDeliveryText}>
            <p className={styles.paDeliveryTag}>Samma dag</p>
            <p className={styles.paDeliveryLine}>Beställ före 15:00 för leverans idag.</p>
          </div>
          <div className={styles.paDeliveryRight}>
            <div className={styles.paTimer} aria-hidden="true">
              <div className={styles.paTimerBox}>
                <span className={styles.paTimerNum}>04</span>
                <span className={styles.paTimerLabel}>Timmar</span>
              </div>
              <div className={styles.paTimerBox}>
                <span className={styles.paTimerNum}>32</span>
                <span className={styles.paTimerLabel}>Minuter</span>
              </div>
              <div className={styles.paTimerBox}>
                <span className={styles.paTimerNum}>18</span>
                <span className={styles.paTimerLabel}>Sekunder</span>
              </div>
            </div>
            {shopReachable ? (
              <Link href="/shop" className={`btn-accent ${styles.paSquareCta}`}>
                Beställ nu
              </Link>
            ) : (
              <BookCta className={styles.paSquareCta} />
            )}
          </div>
        </div>
      </section>

      {/* 6 — FIRA MED BLOMMOR: brett två-kolumns text+bildkollage (stor bild +
          mindre inset-bild). offertReachable ger en diskret rad för bröllop/
          event — utelämnas helt när offert inte är nåbar. */}
      <section className={styles.paCelebrate}>
        <div className={`${shared.sfWide} ${styles.paCelebrateGrid}`}>
          <Reveal className={styles.paCelebrateMedia}>
            <div className={styles.paCelebrateImgMain} style={{ backgroundImage: `url(${celebrateMain})` }} />
            <div className={styles.paCelebrateImgInset} style={{ backgroundImage: `url(${celebrateInset})` }} />
          </Reveal>
          <Reveal delay={120} className={styles.paCelebrateText}>
            <p className="sf-eyebrow">— Fira med blommor</p>
            <h2 className="sf-h1" style={{ marginTop: 10 }}>
              En bukett för varje anledning
            </h2>
            <p className={`sf-body ${styles.paCelebrateBody}`}>
              Födelsedagar, jubileum eller bara en vanlig tisdag som förtjänar något extra — vi väljer
              säsongens finaste snitt och binder det för hand, oavsett anledning.
            </p>
            {shopReachable ? (
              <Link href="/shop" className={styles.paCelebrateCta}>
                Beställ blommor
              </Link>
            ) : null}
            {offertReachable ? (
              <p className={styles.paCelebrateNote}>
                Planerar du bröllop eller ett event? <Link href="/offert">Begär en offert</Link>.
              </p>
            ) : null}
          </Reveal>
        </div>
      </section>

      {/* 7 — UR BUTIKEN: webshop-modulen invävd. Bara ett smakprov — hela
          sortimentet bor på /shop. "Handla i butiken"-länken gatas ändå explicit
          på shopReachable (varje länk till /shop ska vara explicit gated, inte
          bara implicit via teaser-existens). */}
      {shopTeasers.length > 0 ? (
        <section className={styles.paTeaserSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.paTeaserHead}>
              <div>
                <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
                <h2 className="sf-h2" style={{ marginTop: 8 }}>
                  {content.shopTitle ?? 'Beställ något vackert'}
                </h2>
              </div>
              {shopReachable ? (
                <Link href="/shop" className={shared.sfMoreLink}>
                  {content.shopCta ?? 'Handla i butiken'} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </Reveal>
            <div className={styles.paTeaserGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <Link href={`/shop/${p.id}`} className={styles.paTeaserCard}>
                    <div
                      className={styles.paTeaserImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <div className={styles.paTeaserMeta}>
                      <span className={styles.paTeaserNum}>{serviceNum(i)}</span>
                      <h3 className={styles.paTeaserName}>{p.name}</h3>
                    </div>
                    <span className={styles.paTeaserPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 8 — TJÄNSTER: numrerade rader. Hela sektionen visas bara när det finns
          aktiva tjänster (ingen tom-text på hemmet). */}
      {rows.length > 0 ? (
        <section className={shared.sfServices}>
          <div className={shared.sfNarrow}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>
                {content.servicesTitle}
              </h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Boka — ${s.name}`}>
                    <span className={shared.sfRowNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={shared.sfRowMain}>
                      <span className={shared.sfRowName}>{s.name}</span>
                      <span className={shared.sfRowDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={shared.sfRowMeta}>
                      <span className={shared.sfRowPrice}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal style={{ textAlign: 'center' }}>
                <a href="/tjanster" className={shared.sfMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 9 — OM: inramat foto + berättelsen + stats-trio */}
      <section style={{ paddingBottom: 'clamp(48px, 7vw, 90px)' }}>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid}`}>
          <Reveal>
            <div
              className={`${shared.sfAboutPhoto} ${styles.paFrame}`}
              style={{ backgroundImage: `url(${content.aboutImage})` }}
            />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {content.aboutTitle}
            </h2>
            <p className="sf-body" style={{ fontSize: 17, marginTop: 16 }}>
              {content.aboutCopyHome}
            </p>
            <ul className={shared.sfStatTrio}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={shared.sfStatValue}>{n}</span>
                  <span className={shared.sfStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 10 — FRÅN BLOGGEN: blogg-modulen invävd (3 senaste) */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.paTeaserSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.paTeaserHead}>
              <div>
                <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från redaktionen'}</p>
                <h2 className="sf-h2" style={{ marginTop: 8 }}>
                  {content.blogTitle ?? 'Säsong, tips & inspiration'}
                </h2>
              </div>
              <Link href="/blogg" className={shared.sfMoreLink}>
                {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
            <div className={styles.paTeaserGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.paTeaserCard}>
                    <div
                      className={styles.paTeaserImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <div className={styles.paTeaserMeta}>
                      <span className={styles.paTeaserNum}>{serviceNum(i)}</span>
                      <h3 className={styles.paTeaserName}>{p.title}</h3>
                    </div>
                    {p.excerpt ? <p className={styles.paTeaserExcerpt}>{p.excerpt}</p> : null}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* PRESENTKORT — en smal rad, aldrig en egen sektion */}
      {presentkortLive ? (
        <div className={styles.paGift}>
          <div className={`${shared.sfWide} ${styles.paGiftInner}`}>
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className={styles.paGiftText}>{content.giftLede ?? 'Ge bort en bukett, när som helst.'}</p>
            <Link href="/presentkort" className={shared.sfMoreLink}>
              {content.giftCta ?? 'Till presentkorten'} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : null}

      {/* 11 — PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>
                {location.address}
              </p>
            ) : (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>
                Adress visas snart.
              </p>
            )}
            {location?.hours ? (
              <div className={shared.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={shared.sfHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <div className={shared.sfMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={shared.sfMapLink}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={shared.sfMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 12 — CLOSING: eget fullbredds-foto, mörkt tegel-overlay, fyrkantig CTA */}
      <section className={styles.paClosing} style={{ backgroundImage: `url(${content.closingImage})` }}>
        <div className={styles.paClosingOverlay} aria-hidden="true" />
        <div className={styles.paClosingInner}>
          <Reveal>
            <h2 className={styles.paClosingTitle}>{content.closingTitle ?? 'Redo för din beställning?'}</h2>
            <p className={styles.paClosingLead}>
              {content.closingLede ?? 'Beställ ett arrangemang, boka en tid eller kom förbi butiken.'}
            </p>
            <div className={styles.paClosingActions}>
              <BookCta className={styles.paSquareCta} />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
