import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './mina.module.css'

/**
 * MINA — klarrosa & vitt, minimal och ung florist-e-handel (florist-sviten,
 * goal-58). EGEN sektionsordning (ingen annan mall i sviten har den):
 *   1. HERO — ingen bild. En färgplatta bär enorm sans-typografi; texten är
 *      hjälten, bilden kommer först i nästa sektion.
 *   2. BILD-BANNER — fullbredd foto direkt under heron, andrummet efter
 *      typografin. Ingen text ovanpå.
 *   3. SHOP-TEASERS — ett tätt fyr-kolumners grid, de minsta korten i hela
 *      sviten (versal mikro-typografi).
 *   4. TJÄNSTER — täta, ONUMRERADE rader (versalt namn + hårfin linje) —
 *      ingen serif-numrerad radlista som resten av sviten.
 *   5. OM — en smal, centrerad textspalt utan sidobild (alla andra mallar i
 *      sviten kör två-kolumners om+foto; Mina håller det rent typografiskt).
 *   6. PRESENTKORT — en smal rad, aldrig en egen sektion.
 *   7. BLOGG — samma täta grid-språk som butiken.
 *   8. PLATS & ÖPPETTIDER.
 *   9. CLOSING — en färgplatta som speglar heron (bookend).
 * Sans-only typografi (Jost display + Inter body) — enda mallen i sviten utan
 * serif-rubriker. Webshop/blogg/presentkort vävs in via `modules`-propen
 * (S10) — samma modulkontrakt som övriga florist-mallar.
 *
 * SKÄRPE-PASS 2026-07-11 (design-skarpa-zentum.md) — identiteten orörd, det är
 * utförandet som skärpts. Två saker att INTE återinföra här:
 *   • INGA inline-styles för typografi/rytm. De gamla (marginTop: 6/10/12,
 *     fontSize: 16, color: '#fff') vann över varje CSS-nivå och var precis det
 *     som gjorde trappan grötig. Allt sådant bor i mina.module.css nu.
 *   • Delade .sf*-primitiv (sfMoreLink/sfHours/sfClosingLead/sf-h1) får inte
 *     ändras — de ägs av alla mallar. Där sam-applicerar vi en mi*-klass som
 *     vinner på specificitet. Tappa inte bort de PAREN.
 * Hela mallen ligger i .miRoot — där bor typskalan, rytmen och radie-tokens.
 */
export function MinaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // MINA ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats
  // egna, täta grid-språk istället för den generiska sektions-stapeln —
  // page.tsx hoppar över StorefrontModuleSections för mina och förladdar
  // teasers (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir
  // SYNKRON (onboarding-studions klient-preview renderar samma komponent).
  // Modulernas EGNA sidor är fortfarande hemmet (/shop, /blogg, /presentkort).
  // Ingen fristående /shop- eller /offert-länk finns utanför teaser-
  // sektionerna nedan (de gatas redan av att teasers bara finns när modulen
  // faktiskt är nåbar) — därför behövs shopReachable/offertReachable inte här.
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  const bannerImg = content.heroImages[0] ?? ''

  return (
    <div className={styles.miRoot}>
      {/* 1 — HERO: ingen bild, färgplattan bär den stora typografin.
          Inre rytm: eyebrow →12px→ rubrik →20px→ ingress →32px→ CTA. */}
      <section className={styles.miHero}>
        <div className={styles.miHeroInner}>
          <Reveal>
            {content.heroEyebrow ? <span className={styles.miHeroEyebrow}>{content.heroEyebrow}</span> : null}
            <h1 className={styles.miHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.miHeroLede}>{content.heroLede}</p>
            <div className={styles.miHeroActions}>
              <BookCta className={styles.miHeroCta} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2 — BILD-BANNER: fullbredd, ingen text ovanpå (andrummet efter heron) */}
      <Reveal className={styles.miBanner} style={{ backgroundImage: `url(${bannerImg})` }}>
        <span />
      </Reveal>

      {/* 3 — UR BUTIKEN: webshop-modulen invävd i ett tätt fyr-kolumners grid.
          Bara ett smakprov — hela sortimentet bor på /shop. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.miShopSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.miSecHead}>
              <div>
                <p className="sf-eyebrow">{content.shopEyebrow ?? '— Handla nu'}</p>
                <h2 className="sf-h2">{content.shopTitle ?? 'Beställ något fint'}</h2>
              </div>
              <Link href="/shop" className={`${shared.sfMoreLink} ${styles.miMore}`}>
                {content.shopCta ?? 'Visa hela sortimentet'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
            <div className={styles.miShopGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <Link href={`/shop/${p.id}`} className={styles.miCard}>
                    <div
                      className={styles.miCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <h3 className={styles.miCardName}>{p.name}</h3>
                    <p className={styles.miCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 4 — TJÄNSTER: täta, onumrerade rader. Hela sektionen visas bara när
          det finns aktiva tjänster (ingen tom-text på hemmet). */}
      {rows.length > 0 ? (
        <section className={styles.miServices}>
          <div className={shared.sfNarrow}>
            <Reveal className={styles.miSvcHead}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className="sf-h1">{content.servicesTitle}</h2>
            </Reveal>
            <div className={styles.miSvcList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 55}>
                  <Bookable className={styles.miSvcRow} label={`Boka — ${s.name}`}>
                    <span className={styles.miSvcMain}>
                      <span className={styles.miSvcName}>{s.name}</span>
                      <span className={styles.miSvcDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.miSvcPrice}>{formatPrice(s)}</span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal className={styles.miSvcMore}>
                <a href="/tjanster" className={`${shared.sfMoreLink} ${styles.miMore}`}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 5 — OM: smal centrerad spalt, ingen sidobild */}
      <section className={styles.miAbout}>
        <div className={styles.miAboutInner}>
          <Reveal>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h1">{content.aboutTitle}</h2>
            <p className={`sf-body ${styles.miAboutCopy}`}>{content.aboutCopyHome}</p>
            <ul className={styles.miStatRow}>
              {content.stats.map(([n, l]) => (
                <li key={l} className={styles.miStatItem}>
                  <span className={styles.miStatValue}>{n}</span>
                  <span className={styles.miStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 6 — PRESENTKORT: en smal rad, aldrig en egen sektion */}
      {presentkortLive ? (
        <div className={styles.miGift}>
          <Reveal className={styles.miGiftInner}>
            <p className="sf-eyebrow">{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.miGiftText}>{content.giftLede ?? 'Ge bort blommor, när som helst.'}</p>
            <Link href="/presentkort" className={`${shared.sfMoreLink} ${styles.miMore}`}>
              {content.giftCta ?? 'Köp presentkort'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 7 — FRÅN BLOGGEN: blogg-modulen invävd i samma täta grid-språk som
          butiken (3 senaste), SAMMA bildratio som butikens kort. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.miBlogSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.miSecHead}>
              <div>
                <p className="sf-eyebrow">{content.blogEyebrow ?? '— Inspiration'}</p>
                <h2 className="sf-h2">{content.blogTitle ?? 'Tips, säsong & idéer'}</h2>
              </div>
              <Link href="/blogg" className={`${shared.sfMoreLink} ${styles.miMore}`}>
                {content.blogCta ?? 'Läs mer'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
            <div className={styles.miBlogGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.miCard}>
                    <div
                      className={styles.miBlogImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <h3 className={styles.miBlogName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.miBlogExcerpt}>{p.excerpt}</p> : null}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 8 — PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className="sf-h2">{location?.address ? location.address.split(',')[0] : tenant.name}</h2>
            <p className={`sf-body ${styles.miLocAddress}`}>{location?.address ?? 'Adress visas snart.'}</p>
            {location?.hours ? (
              <div className={`${shared.sfHours} ${styles.miHours}`}>
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

      {/* 9 — CLOSING: färgplatta, speglar heron (bookend). Samma inre rytm som
          heron: rubrik →20px→ ingress →32px→ CTA. */}
      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className={`sf-h1 ${styles.miClosingTitle}`}>{content.closingTitle ?? 'Redo att beställa?'}</h2>
          <p className={`${shared.sfClosingLead} ${styles.miClosingLede}`}>
            {content.closingLede ?? 'Välj din bukett, hämta i butiken eller få den levererad hem.'}
          </p>
          <div className={styles.miClosingActions}>
            <BookCta className={shared.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
