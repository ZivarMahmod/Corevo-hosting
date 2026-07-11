import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './isalara.module.css'

/**
 * ISALARA — djupblå/marin + varm sand, elegant kvällskänsla (florist-sviten,
 * goal-58). EGEN sektionsordning (ingen annan mall i sviten har den): (1) hero
 * med en HANDSKRIVEN skript-rubrik centrerad över bild + liten pill-CTA, (2)
 * fyra ikon-genvägar i en ljus rad direkt under heron, (3) mörkblått band med
 * en enda rad, (4) TVÅ stora bilder sida vid sida utan mellanrum (portfölj-
 * känsla), (5) shop-teasers, (6) tjänster, (7) om, (8) blogg, (9) presentkort
 * (smal rad), (10) plats, (11) closing. Webshop/blogg/presentkort/offert vävs
 * in via `modules`-propen (S10) — samma modulkontrakt som övriga florist-mallar.
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md): identitet och sektionsordning är orörda —
 * det är utförandet som skärpts. All typografi/rytm/radie/hover ligger i mallens
 * tokens i isalara.module.css (.islRoot): typskala 108/52/26/16/12 (inget grannpar
 * under ×1.3), rytm 12/20/24/32/48/96, EN bildratio (4:5), EN icke-noll-radie
 * (pill), 5px-lyft på 400ms. Därför bär layouten inga egna px-värden i inline-styles
 * (bara bakgrundsbilder och centrering) — hittar du ett hårdkodat mått här är det en
 * regression.
 *
 * NIVÅ-KLASSER: de delade sf*-klasserna (sfRowName, sfStatValue, sfHoursRow …) bor i
 * en ANNAN CSS-modul och har sin egen typskala (24/25.6/16.8/15.2/13.6px). Den kan
 * inte selekteras från isalara.module.css (hashade klassnamn), så varje delat
 * textelement taggas här med mallens nivå — styles.islLvlSub / islLvlBody /
 * islLvlMicro. Tar du bort en sådan tagg glider elementet tillbaka till den delade
 * skalan och mallen renderar grötigt igen, oavsett hur skarpa tokens är.
 */

/** Minimal linje-ikon för ikon-genvägarna — ren dekor, inga externa assets. */
function ShortcutIcon({ name }: { name: 'bestsellers' | 'plants' | 'pick' | 'pin' }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'bestsellers') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 3.5l2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.6 5-.7L12 3.5Z" />
      </svg>
    )
  }
  if (name === 'plants') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 21V10" />
        <path d="M12 10c0-4 3-6 6-6 0 4-2 6-6 6Z" />
        <path d="M12 13c0-3.2-2.4-5-5.5-5C6.5 11.2 8.8 13 12 13Z" />
      </svg>
    )
  }
  if (name === 'pick') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
      </svg>
    )
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 21s-6.5-5.2-6.5-10.2A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.8C18.5 15.8 12 21 12 21Z" />
      <circle cx="12" cy="10.6" r="2.1" />
    </svg>
  )
}

/** En ikon-genväg: länk när `href` är satt (intern route → Link, ankare/extern →
 *  vanlig <a>), annars en icke-klickbar kort — samma "gated länk"-mönster som
 *  övriga sviten (S9). Reveal tar bara `as`/`delay`/`className`/`style` (inga
 *  extra props som `href`) — därför nästlas länken/diven INUTI Reveal, som
 *  Flora/Calytrix redan gör för sina pelare/kort. */
function Shortcut({
  icon,
  label,
  sub,
  href,
  anchor,
  delay = 0,
}: {
  icon: 'bestsellers' | 'plants' | 'pick' | 'pin'
  label: string
  sub: string
  /** Sätts bara när målet går att nå (modul-gating, S9). */
  href?: string
  /** Sidankare (#isl-plats) → vanlig <a>, annars intern route → Link. */
  anchor?: boolean
  delay?: number
}) {
  const inner = (
    <>
      <span className={styles.islShortcutIconWrap}><ShortcutIcon name={icon} /></span>
      <span className={styles.islShortcutLabel}>{label}</span>
      <span className={styles.islShortcutSub}>{sub}</span>
    </>
  )
  return (
    <Reveal delay={delay}>
      {href ? (
        anchor ? (
          <a href={href} className={styles.islShortcut}>{inner}</a>
        ) : (
          <Link href={href} className={styles.islShortcut}>{inner}</Link>
        )
      ) : (
        <div className={styles.islShortcut}>{inner}</div>
      )}
    </Reveal>
  )
}

export function IsalaraLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Ikon-genvägarna länkar bara dit en sida faktiskt finns (live/paused renderar;
  // av/draft → notFound). En genväg mot avstängd modul vore en 404-fälla (S9).
  // Utan modules-prop (studions statiska preview) VISAS länkarna — previewn ska
  // se en hel sida, och dess länkar är ändå inte klickbara på riktigt.
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true

  const duoImages = [content.galleryImages[0] ?? '', content.galleryImages[1] ?? content.galleryImages[0] ?? '']

  return (
    <div className={styles.islRoot}>
      {/* 1 — HERO: HANDSKRIVEN skript-rubrik centrerad över bild + liten CTA */}
      <section className={styles.islHero} style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}>
        <div className={styles.islHeroScrim} aria-hidden="true" />
        <div className={styles.islHeroInner}>
          <Reveal>
            <span className={styles.islHeroEyebrow}>{content.heroEyebrow}</span>
            <h1 className={styles.islHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.islHeroLede}>{content.heroLede}</p>
            <div className={styles.islHeroCtaRow}>
              <BookCta className={styles.islBtn} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2 — FYRA IKON-GENVÄGAR — ljus rad direkt under heron */}
      <section className={styles.islShortcuts}>
        <div className={styles.islShortcutGrid}>
          <Shortcut
            icon="bestsellers"
            label="Mest sålda"
            sub="Våra populäraste val"
            href={shopReachable ? '/shop' : undefined}
          />
          <Shortcut
            icon="plants"
            label="Växter"
            sub="Krukväxter & gröna vänner"
            href={shopReachable ? '/shop' : undefined}
            delay={70}
          />
          <Shortcut
            icon="pick"
            label="Floristens val"
            sub="Låt oss välja åt dig"
            href={offertReachable ? '/offert' : undefined}
            delay={140}
          />
          <Shortcut
            icon="pin"
            label="Leveransorter"
            sub="Se var vi levererar"
            href="#isl-plats"
            anchor
            delay={210}
          />
        </div>
      </section>

      {/* 3 — MÖRKBLÅTT BAND — en rad */}
      <section className={styles.islBand}>
        <Reveal>
          <p className={styles.islBandText}>{content.tagline}</p>
        </Reveal>
      </section>

      {/* 4 — TVÅ STORA BILDER SIDA VID SIDA — portföljkänsla, inget mellanrum */}
      <section className={styles.islDuo}>
        <Reveal className={styles.islDuoImg} style={{ backgroundImage: `url(${duoImages[0]})` }}>
          <span />
        </Reveal>
        <Reveal delay={100} className={styles.islDuoImg} style={{ backgroundImage: `url(${duoImages[1]})` }}>
          <span />
        </Reveal>
      </section>

      {/* 5 — UR BUTIKEN — webshop-modulen invävd. Bara ett smakprov; hela
          sortimentet bor på /shop. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.islSection}>
          <Reveal as="div" className={styles.islSecHead}>
            <div>
              <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
              <h2 className={`sf-h2 ${styles.islStepEyebrow}`}>{content.shopTitle ?? 'Beställ något vackert'}</h2>
            </div>
            {shopReachable ? (
              <Link href="/shop" className={styles.islSecCta}>{content.shopCta ?? 'Visa hela butiken'}</Link>
            ) : null}
          </Reveal>
          <div className={styles.islCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.islCard}>
                  <div className={styles.islCardImgWrap}>
                    <div
                      className={styles.islCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                  </div>
                  <h3 className={styles.islCardName}>{p.name}</h3>
                  <p className={styles.islCardMeta}>{formatShopPrice(p.priceCents, p.currency)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6 — TJÄNSTER & PRISER — numrerade rader, bara när det finns aktiva
          tjänster (ingen tom-text på hemmet, goal-55 8B). */}
      {rows.length > 0 ? (
        <section className={`${shared.sfServices} ${styles.islServices}`}>
          <div className={shared.sfNarrow}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className={`sf-h1 ${styles.islStepEyebrow}`}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Boka — ${s.name}`}>
                    <span className={`${shared.sfRowNum} ${styles.islLvlSub}`} aria-hidden="true">{serviceNum(i)}</span>
                    <span className={shared.sfRowMain}>
                      <span className={`${shared.sfRowName} ${styles.islLvlSub}`}>{s.name}</span>
                      <span className={`${shared.sfRowDesc} ${styles.islLvlBody}`}>{serviceDesc(s)}</span>
                    </span>
                    <span className={shared.sfRowMeta}>
                      <span className={`${shared.sfRowPrice} ${styles.islLvlBody}`}>{formatPrice(s)}</span>
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

      {/* 7 — OM */}
      <section>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid} ${styles.islAboutGrid}`}>
          <Reveal>
            <div className={shared.sfAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className={`sf-h2 ${styles.islStepEyebrow}`}>{content.aboutTitle}</h2>
            <p className={`sf-body ${styles.islStepHead}`}>{content.aboutCopyHome}</p>
            <ul className={shared.sfStatTrio}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={`${shared.sfStatValue} ${styles.islLvlSub}`}>{n}</span>
                  <span className={`${shared.sfStatLabel} ${styles.islLvlMicro}`}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 8 — FRÅN FLORISTEN — blogg-modulen invävd (3 senaste → /blogg). Tom
          modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={`${styles.islSection} ${styles.islSectionSoft}`}>
          <Reveal as="div" className={styles.islSecHead}>
            <div>
              <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från floristen'}</p>
              <h2 className={`sf-h2 ${styles.islStepEyebrow}`}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
            </div>
            <Link href="/blogg" className={styles.islSecCta}>{content.blogCta ?? 'Läs hela bloggen'}</Link>
          </Reveal>
          <div className={styles.islCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.islCard}>
                  <div className={styles.islCardImgWrap}>
                    <div
                      className={styles.islCardImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                  </div>
                  <h3 className={styles.islCardName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.islCardMeta}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* 9 — PRESENTKORT — smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <div className={styles.islGiftRow}>
          <Reveal as="div" className={styles.islGiftInner}>
            <p className="sf-eyebrow" style={{ margin: 0 }}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className="sf-body" style={{ margin: 0 }}>{content.giftLede ?? 'Ge bort något som blommar.'}</p>
            <Link href="/presentkort" className={styles.islGiftCta}>{content.giftCta ?? 'Till presentkorten'}</Link>
          </Reveal>
        </div>
      ) : null}

      {/* 10 — PLATS & ÖPPETTIDER — ankarmål för "Leveransorter"-genvägen */}
      <section id="isl-plats" className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid} ${styles.islLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={`sf-h2 ${styles.islStepEyebrow}`}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={`sf-body ${styles.islStepHead}`}>{location.address}</p>
            ) : (
              <p className={`sf-body ${styles.islStepHead}`}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={shared.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={`${shared.sfHoursRow} ${styles.islLvlBody}`}>
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
                <span className={`${shared.sfMapHint} ${styles.islLvlBody}`}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 11 — CLOSING */}
      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className="sf-h1" style={{ maxWidth: '40rem', margin: '0 auto' }}>
            {content.closingTitle ?? 'Redo att beställa något vackert?'}
          </h2>
          <p className={`${shared.sfClosingLead} ${styles.islLvlBody}`}>
            {content.closingLede ?? 'Handla i butiken, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.islStepCta}>
            <BookCta className={`${shared.sfClosingCta} ${styles.islBtn}`} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
