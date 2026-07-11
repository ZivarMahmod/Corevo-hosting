import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './isalara.module.css'

/**
 * ISALARA — KVÄLLSBLÅ ELEGANS (florist-sviten, tema-paket goal-59).
 *
 * Mallen äger nu HELA sajten (nav + footer + undersidor i isalara.chrome.tsx /
 * isalara.pages.tsx). Den här filen är hemmet — och den bär NOLL delade
 * .sf*-klasser. Det var där sviten rann ihop: heron var unik, resten av sidan var
 * grannens. Varje sektion nedan är mallens egen.
 *
 * SEKTIONSORDNING (mallens svar, inget syskon delar den):
 *   1  hero — bild + HANDSKRIVEN script-rubrik centrerad + pill-CTA
 *   2  fyra ikon-genvägar i en ljus rad direkt under heron (modul-gatade)
 *   3  marinblått band, en enda rad
 *   4  TVÅ stora portföljbilder sida vid sida, utan mellanrum
 *   5  butiken — HÖGA eleganta 4/5-kort (webshop-modulen)
 *   6  priser — TVÅ KOLUMNER med guld-prick, varje rad en <Bookable>
 *   7  om — split (porträtt + text + statistik)
 *   8  bloggen — samma höga kort på sandton
 *   9  presentkort — smal rad, aldrig en hel sektion
 *  10  plats & öppettider — ankarmål för "Leveransorter"-genvägen
 *  11  closing — marinblå platta
 *
 * Modul-gatingen är HELIG och oförändrad: shopReachable/offertReachable gatar
 * länkarna, teasers-sektionerna renderas bara när teasers finns, presentkortet är
 * en smal rad. Layouten är SYNKRON (ingen async, ingen 'use client').
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md): all typografi/rytm/radie/hover bor i
 * mallens tokens i isalara.module.css — hittar du ett hårdkodat px-mått här är det
 * en regression (inline-styles bär bara bakgrundsbilder).
 */

/** Minimal linje-ikon för ikon-genvägarna — ren dekor, inga externa assets. */
function ShortcutIcon({ name }: { name: 'bestsellers' | 'plants' | 'pick' | 'pin' }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
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

/** En ikon-genväg: länk när `href` är satt (intern route → Link, ankare → <a>),
 *  annars ett icke-klickbart kort — samma "gated länk"-mönster som resten av
 *  sviten (S9): en genväg mot en avstängd modul vore en 404-fälla. */
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
  href?: string
  anchor?: boolean
  delay?: number
}) {
  const inner = (
    <>
      <span className={styles.islShortcutIconWrap}>
        <ShortcutIcon name={icon} />
      </span>
      <span className={styles.islShortcutLabel}>{label}</span>
      <span className={styles.islShortcutSub}>{sub}</span>
    </>
  )
  return (
    <Reveal delay={delay}>
      {href ? (
        anchor ? (
          <a href={href} className={styles.islShortcut}>
            {inner}
          </a>
        ) : (
          <Link href={href} className={styles.islShortcut}>
            {inner}
          </Link>
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
  // Utan modules-prop (studions statiska preview) VISAS länkarna — previewn ska se
  // en hel sida, och dess länkar är ändå inte klickbara på riktigt.
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true

  const duoImages = [
    content.galleryImages[0] ?? '',
    content.galleryImages[1] ?? content.galleryImages[0] ?? '',
  ]

  return (
    <div className={styles.islRoot}>
      {/* 1 — HERO */}
      <section
        className={styles.islHero}
        style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
      >
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

      {/* 2 — FYRA IKON-GENVÄGAR */}
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

      {/* 3 — MARINBLÅTT BAND */}
      <section className={styles.islBand}>
        <Reveal>
          <p className={styles.islBandText}>{content.tagline}</p>
        </Reveal>
      </section>

      {/* 4 — TVÅ STORA PORTFÖLJBILDER */}
      <section className={styles.islDuo}>
        <Reveal
          className={styles.islDuoImg}
          style={{ backgroundImage: `url(${duoImages[0]})` }}
        >
          <span />
        </Reveal>
        <Reveal
          delay={100}
          className={styles.islDuoImg}
          style={{ backgroundImage: `url(${duoImages[1]})` }}
        >
          <span />
        </Reveal>
      </section>

      {/* 5 — UR BUTIKEN (webshop-modulen). Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.islSection}>
          <Reveal as="div" className={styles.islSecHead}>
            <div>
              <p className={styles.islEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
              <h2 className={styles.islTitle}>{content.shopTitle ?? 'Beställ något vackert'}</h2>
            </div>
            {shopReachable ? (
              <Link href="/shop" className={styles.islLink}>
                {content.shopCta ?? 'Visa hela butiken'}
              </Link>
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

      {/* 6 — PRISER I TVÅ KOLUMNER MED GULD-PRICK. Bara när det finns aktiva
          tjänster (ingen tom-text på hemmet, goal-55 8B). */}
      {rows.length > 0 ? (
        <section className={styles.islSection}>
          <Reveal as="div" className={styles.islSecHead}>
            <div>
              <p className={styles.islEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.islTitle}>{content.servicesTitle}</h2>
            </div>
          </Reveal>
          <div className={styles.islPriceWrap}>
            <div className={styles.islPriceCols}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.islPriceRow} label={`Boka — ${s.name}`}>
                    <span className={styles.islPriceDot} aria-hidden="true" />
                    <span className={styles.islPriceMain}>
                      <span className={styles.islPriceName}>{s.name}</span>
                      <span className={styles.islPriceDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.islPriceValue}>{formatPrice(s)}</span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal className={styles.islPriceMore}>
                <Link href="/tjanster" className={styles.islLink}>
                  Se allt vi gör
                </Link>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 7 — OM */}
      <section className={styles.islAbout}>
        <Reveal>
          <div
            className={styles.islAboutPhoto}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
          />
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.islEyebrow}>— Om {tenant.name}</p>
          <h2 className={styles.islTitle}>{content.aboutTitle}</h2>
          <p className={styles.islBody}>{content.aboutCopyHome ?? content.aboutCopy}</p>
          <ul className={styles.islStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.islStatValue}>{n}</span>
                <span className={styles.islStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* 8 — FRÅN FLORISTEN (blogg-modulen). Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={`${styles.islSection} ${styles.islSectionSoft}`}>
          <Reveal as="div" className={styles.islSecHead}>
            <div>
              <p className={styles.islEyebrow}>{content.blogEyebrow ?? '— Från floristen'}</p>
              <h2 className={styles.islTitle}>
                {content.blogTitle ?? 'Säsong, tips & inspiration'}
              </h2>
            </div>
            <Link href="/blogg" className={styles.islLink}>
              {content.blogCta ?? 'Läs hela bloggen'}
            </Link>
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

      {/* 9 — PRESENTKORT — smal rad */}
      {presentkortLive ? (
        <div className={styles.islGiftRow}>
          <Reveal as="div" className={styles.islGiftInner}>
            <p className={styles.islEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.islBody}>{content.giftLede ?? 'Ge bort något som blommar.'}</p>
            <Link href="/presentkort" className={styles.islLink}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 10 — PLATS & ÖPPETTIDER — ankarmål för "Leveransorter"-genvägen */}
      <section id="isl-plats" className={styles.islLoc}>
        <div className={styles.islLocGrid}>
          <Reveal>
            <p className={styles.islEyebrow}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.islTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {/* Render-on-present: aldrig en påhittad adress. */}
            {location?.address ? (
              <p className={styles.islBody}>{location.address}</p>
            ) : (
              <p className={styles.islBody}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={styles.islHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.islHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <div className={styles.islMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.islLink}
                >
                  Visa på karta
                </a>
              ) : (
                <p className={styles.islMapHint}>Karta visas när adressen är ifylld.</p>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 11 — CLOSING */}
      <section className={styles.islClosing}>
        <Reveal className={styles.islClosingInner}>
          <h2 className={styles.islClosingTitle}>
            {content.closingTitle ?? 'Redo att beställa något vackert?'}
          </h2>
          <p className={styles.islClosingLede}>
            {content.closingLede ??
              'Handla i butiken, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.islClosingCta}>
            <BookCta className={`${styles.islBtn} ${styles.islBtnLight}`} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
