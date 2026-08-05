import Link from 'next/link'
import { Reveal } from '../Reveal'
import { Gallery } from '../Gallery'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../service-format'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'
import fl from './flora.module.css'

/**
 * FLORA — bohemisk blomsterbutik (florist-branschens tema; modulärt, aldrig låst).
 * EGET formspråk (v2 efter Zivars "kändes som frisörens"): centrerad italisk
 * Playfair-hero över TRE valv-bilder i olika höjd, ornament-avdelare (stjälk-SVG),
 * verksamhets-ben (Beställ/Bröllop & avsked/Kurser), numrerade prisrader utan
 * duration, valv-porträtt i om-sektionen, galleri, plats och closing. Webshop/
 * blogg/presentkort vävs in i layouten via `modules`-propen (S10).
 *
 * goal-60: all inline-styling (32 st) flyttad till flora.module.css — inline kan inte
 * bära :hover/:focus/:active, så varje inline-stylad yta var dömd till plattformens
 * neutrala form. Kvar inline: BARA backgroundImage (bild-URL = dynamisk data).
 * Mallens knapp-/fält-/etikett-varsen bor i tokens.css under [data-theme="flora"], så
 * de även når nav, sidfot och modulernas EGNA sidor (som inte laddar den här modulen).
 */

/** Stiliserad blomstjälk — ornamentet som skiljer sektionerna åt. */
function Ornament() {
  return (
    <div className={styles.flOrnament} aria-hidden="true">
      <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
        <path d="M22 6v40" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M22 18c-6-2-10-7-10-13 6 0 11 4 10 13Z" fill="currentColor" opacity=".55" />
        <path d="M22 18c6-2 10-7 10-13-6 0-11 4-10 13Z" fill="currentColor" opacity=".35" />
        <path d="M22 32c-5-1.5-8.5-5.5-8.5-11 5 0 9.5 3.5 8.5 11Z" fill="currentColor" opacity=".35" />
        <path d="M22 32c5-1.5 8.5-5.5 8.5-11-5 0-9.5 3.5-8.5 11Z" fill="currentColor" opacity=".55" />
        <circle cx="22" cy="5" r="3" fill="currentColor" />
      </svg>
    </div>
  )
}

export function FloraLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // FLORA ÄGER SINA MODULER (Zivar: "klisterlapp utan funktion"-fixen): hemmet
  // väver in butik/blogg/presentkort i temats eget formspråk (valv-kort, ornament)
  // istället för den generiska sektions-stapeln — page.tsx hoppar över
  // StorefrontModuleSections för flora och förladdar teasers
  // (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir SYNKRON
  // (onboarding-studions klient-preview renderar samma komponent). Modulernas
  // EGNA sidor är fortfarande hemmet (/shop, /blogg, /presentkort, /offert).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortReachable = modules?.presentkortReachable ?? false
  // Pelarna länkar bara till live moduler. Utan
  // modules-prop (studions statiska preview) VISAS pelarna — previewn ska se en
  // hel sida, och dess länkar är ändå inte klickbara på riktigt.
  const shopReachable = modules?.shopReachable ?? false
  const offertReachable = modules?.offertReachable ?? false
  const kurserReachable = modules?.kurserReachable ?? false
  const [arch1, arch2, arch3] = [
    content.heroImages[0] ?? '',
    content.heroImages[1] ?? content.heroImages[0] ?? '',
    content.heroImages[2] ?? content.heroImages[0] ?? '',
  ]

  return (
    <>
      {/* HERO — centrerad italisk serif över valv-trion */}
      <section className={styles.flHero}>
        <div className={styles.flHeroInner}>
          <span className={styles.sfPillEyebrow} data-corevo-editor-field="heroEyebrow" data-corevo-editor-stable-field="heroEyebrow">{content.heroEyebrow}</span>
          <h1 className={styles.flHeroTitle} data-corevo-editor-field="heroTitle" data-corevo-editor-stable-field="heroTitle">{content.heroTitle}</h1>
          <p className={`sf-lede ${fl.heroLede}`} data-corevo-editor-field="heroLede" data-corevo-editor-stable-field="heroLede">{content.heroLede}</p>
          <div className={fl.heroCtaRow}>
            <BookCta enabled={bookingReachable} className={styles.heroCta} />
          </div>
        </div>
        <div className={styles.flArches}>
          {/* backgroundImage = enda kvarvarande inline: bild-URL:en är dynamisk data. */}
          <Reveal className={styles.flArch} style={{ backgroundImage: `url(${arch2})` }} data-corevo-editor-field="hero_images.1" data-corevo-editor-stable-field="hero_images.1">
            <span />
          </Reveal>
          <Reveal delay={100} className={styles.flArch} style={{ backgroundImage: `url(${arch1})` }} data-corevo-editor-field="hero_images.0" data-corevo-editor-stable-field="hero_images.0">
            <span />
          </Reveal>
          <Reveal delay={200} className={styles.flArch} style={{ backgroundImage: `url(${arch3})` }} data-corevo-editor-field="hero_images.2" data-corevo-editor-stable-field="hero_images.2">
            <span />
          </Reveal>
        </div>
      </section>

      <Ornament />

      {/* VERKSAMHETS-BEN — det floristen faktiskt gör, tre vägar in */}
      <section className={fl.section}>
        <div className={styles.flPillars}>
          {shopReachable ? (
            <Reveal>
              <Link href="/shop" className={`${styles.flPillar} ${fl.pillar}`}>
                <div
                  className={`${styles.flPillarImg} ${fl.pillarImg}`}
                  style={{ backgroundImage: `url(${content.galleryImages[0] ?? arch1})` }}
                  data-corevo-editor-field="gallery_images.0"
                  data-corevo-editor-stable-field="gallery_images.0"
                />
                <h3 className={styles.flPillarName} data-corevo-editor-field="pillar1Title" data-corevo-editor-stable-field="pillar1Title">{content.pillar1Title ?? 'Beställ blommor'}</h3>
                <p className={styles.flPillarText} data-corevo-editor-field="pillar1Body" data-corevo-editor-stable-field="pillar1Body">{content.pillar1Body ?? 'Buketter i säsong — floristen väljer det finaste. Hämta i butik eller skicka bud.'}</p>
                <span className={styles.flPillarLink} data-corevo-editor-field="pillar1Link" data-corevo-editor-stable-field="pillar1Link">{content.pillar1Link ?? 'Till butiken'}</span>
              </Link>
            </Reveal>
          ) : null}
          {offertReachable ? (
            <Reveal delay={100}>
              <a href="/offert" className={`${styles.flPillar} ${fl.pillar}`}>
                <div
                  className={`${styles.flPillarImg} ${fl.pillarImg}`}
                  style={{ backgroundImage: `url(${content.galleryImages[1] ?? arch2})` }}
                  data-corevo-editor-field="gallery_images.1"
                  data-corevo-editor-stable-field="gallery_images.1"
                />
                <h3 className={styles.flPillarName} data-corevo-editor-field="pillar2Title" data-corevo-editor-stable-field="pillar2Title">{content.pillar2Title ?? 'Bröllop & avsked'}</h3>
                <p className={styles.flPillarText} data-corevo-editor-field="pillar2Body" data-corevo-editor-stable-field="pillar2Body">{content.pillar2Body ?? 'Handbundna brudbuketter, corsage och binderier — eller ett personligt, vackert farväl.'}</p>
                <span className={styles.flPillarLink} data-corevo-editor-field="pillar2Link" data-corevo-editor-stable-field="pillar2Link">{content.pillar2Link ?? 'Begär offert'}</span>
              </a>
            </Reveal>
          ) : null}
          <Reveal delay={200}>
            {kurserReachable ? (
              <Link href="/kurser" className={`${styles.flPillar} ${fl.pillar}`}>
                <div
                  className={`${styles.flPillarImg} ${fl.pillarImg}`}
                  style={{ backgroundImage: `url(${content.galleryImages[2] ?? arch3})` }}
                  data-corevo-editor-field="gallery_images.2"
                  data-corevo-editor-stable-field="gallery_images.2"
                />
                <h3 className={styles.flPillarName} data-corevo-editor-field="pillar3Title" data-corevo-editor-stable-field="pillar3Title">{content.pillar3Title ?? 'Kurser & kvällar'}</h3>
                <p className={styles.flPillarText} data-corevo-editor-field="pillar3Body" data-corevo-editor-stable-field="pillar3Body">{content.pillar3Body ?? 'Bukett & bubbel för ert sällskap — en kreativ stund med blommor i säsong.'}</p>
                <span className={styles.flPillarLink} data-corevo-editor-field="pillar3Link" data-corevo-editor-stable-field="pillar3Link">{content.pillar3Link ?? 'Boka kurs'}</span>
              </Link>
            ) : (
              <div className={`${styles.flPillar} ${fl.pillar}`}>
                <div
                  className={`${styles.flPillarImg} ${fl.pillarImg}`}
                  style={{ backgroundImage: `url(${content.galleryImages[2] ?? arch3})` }}
                  data-corevo-editor-field="gallery_images.2"
                  data-corevo-editor-stable-field="gallery_images.2"
                />
                <h3 className={styles.flPillarName} data-corevo-editor-field="pillar3Title" data-corevo-editor-stable-field="pillar3Title">{content.pillar3Title ?? 'Kurser & kvällar'}</h3>
                <p className={styles.flPillarText} data-corevo-editor-field="pillar3Body" data-corevo-editor-stable-field="pillar3Body">{content.pillar3Body ?? 'Bukett & bubbel för ert sällskap — en kreativ stund med blommor i säsong.'}</p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i flora-formspråket (valv-kort).
          Bara ett smakprov; hela sortimentet bor på /shop. */}
      {shopTeasers.length > 0 ? (
        <section className={fl.section}>
          <Reveal className={styles.flSecHead}>
            <p className="sf-eyebrow" data-corevo-editor-field="shopEyebrow" data-corevo-editor-stable-field="shopEyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={`sf-h2 ${fl.secTitle}`} data-corevo-editor-field="shopTitle" data-corevo-editor-stable-field="shopTitle">{content.shopTitle ?? 'Beställ något vackert'}</h2>
          </Reveal>
          <div className={styles.flCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={`${styles.flCard} ${fl.card}`}>
                  <div
                    className={`${styles.flCardImg} ${fl.cardImg}`}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <h3 className={styles.flCardName}>{p.name}</h3>
                  <p className={styles.flCardMeta}>{formatProductPrice(p)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.flSecHead}>
            <Link href="/shop" className={`${styles.flBandCta} ${fl.bandCta}`}>
              <span data-corevo-editor-field="shopCta" data-corevo-editor-stable-field="shopCta">{content.shopCta ?? 'Visa hela butiken'}</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* CITAT — andhämtning i accent-ytan */}
      <section className={fl.quoteBand}>
        <Reveal>
          <p className={`sf-italic ${fl.quote}`} data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">”{content.italic}”</p>
        </Reveal>
      </section>

      {/* PRISER — numrerade rader utan duration (blommor är inte klipptider).
          Hela sektionen visas bara när det finns aktiva tjänster — ingen
          tom-text på hemmet (goal-55 8B). */}
      {rows.length > 0 ? (
        <>
          <section className={styles.sfServices}>
            <div className={styles.sfNarrow}>
              <Reveal className={fl.center}>
                <p className="sf-eyebrow" data-corevo-editor-field="servicesEyebrow" data-corevo-editor-stable-field="servicesEyebrow">{content.servicesEyebrow}</p>
                <h2 className={`sf-h1 ${fl.srvTitle}`} data-corevo-editor-field="servicesTitle" data-corevo-editor-stable-field="servicesTitle">{content.servicesTitle}</h2>
              </Reveal>
              <div className={styles.sfRowList}>
                {rows.map((s, i) => (
                  <Reveal key={s.id} delay={i * 60}>
                    <Bookable slotId={`service:${s.id}`} enabled={bookingReachable} className={styles.sfRow} label={`Beställ — ${s.name}`}>
                      <span className={styles.sfRowNum} aria-hidden="true">
                        {serviceNum(i)}
                      </span>
                      <span className={styles.sfRowMain}>
                        <span className={styles.sfRowName}>{s.name}</span>
                        <span className={styles.sfRowDesc}>{serviceDesc(s)}</span>
                      </span>
                      <span className={styles.sfRowMeta}>
                        <span className={styles.sfRowPrice}>{formatPrice(s)}</span>
                      </span>
                    </Bookable>
                  </Reveal>
                ))}
              </div>
              {hasMore ? (
                <Reveal className={fl.center}>
                  <a href="/tjanster" className={styles.sfMoreLink}>
                    Se allt vi gör <span aria-hidden="true">→</span>
                  </a>
                </Reveal>
              ) : null}
            </div>
          </section>

          <Ornament />
        </>
      ) : null}

      {/* OM — valv-porträtt + berättelsen */}
      <section className={fl.section}>
        <div className={`${styles.sfWide} ${styles.sfAboutGrid}`}>
          <Reveal>
            <div className={styles.flPortrait} style={{ backgroundImage: `url(${content.aboutImage})` }} data-corevo-editor-field="about_image" data-corevo-editor-stable-field="about_image" />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className={`sf-h2 ${fl.secTitle}`} data-corevo-editor-field="aboutTitle" data-corevo-editor-stable-field="aboutTitle">{content.aboutTitle}</h2>
            <p className={`sf-body ${fl.aboutBody}`} data-corevo-editor-field="aboutCopyHome" data-corevo-editor-stable-field="aboutCopyHome">{content.aboutCopyHome}</p>
            <ul className={styles.sfStatTrio}>
              {content.stats.map(([n, l], index) => (
                <li key={l}>
                  <span className={styles.sfStatValue} data-corevo-editor-field={`stats.${index}.value`} data-corevo-editor-stable-field={`stats.${index}.value`}>{n}</span>
                  <span className={styles.sfStatLabel} data-corevo-editor-field={`stats.${index}.label`} data-corevo-editor-stable-field={`stats.${index}.label`}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste som valv-kort → /blogg) */}
      {bloggTeasers.length > 0 ? (
        <>
          <Ornament />
          <section className={fl.section}>
            <Reveal className={styles.flSecHead}>
              <p className="sf-eyebrow" data-corevo-editor-field="blogEyebrow" data-corevo-editor-stable-field="blogEyebrow">{content.blogEyebrow ?? '— Från bloggen'}</p>
              <h2 className={`sf-h2 ${fl.secTitle}`} data-corevo-editor-field="blogTitle" data-corevo-editor-stable-field="blogTitle">{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
            </Reveal>
            <div className={styles.flCardGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 90}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={`${styles.flCard} ${fl.card}`}>
                    <div
                      className={`${styles.flCardImg} ${fl.cardImg}`}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <h3 className={styles.flCardName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.flCardMeta}>{p.excerpt}</p> : null}
                  </Link>
                </Reveal>
              ))}
            </div>
            <Reveal className={styles.flSecHead}>
              <Link href="/blogg" className={`${styles.flBandCta} ${fl.bandCta}`}>
                <span data-corevo-editor-field="blogCta" data-corevo-editor-stable-field="blogCta">{content.blogCta ?? 'Läs hela bloggen'}</span>
              </Link>
            </Reveal>
          </section>
        </>
      ) : null}

      {/* PRESENTKORT — en rad i temats ton, inte en hel stapel-sektion */}
      {presentkortReachable ? (
        <section className={fl.giftBand}>
          <Reveal className={fl.giftInner}>
            <p className={`sf-eyebrow ${fl.giftEyebrow}`} data-corevo-editor-field="giftEyebrow" data-corevo-editor-stable-field="giftEyebrow">{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={`sf-italic ${fl.giftLede}`} data-corevo-editor-field="giftLede" data-corevo-editor-stable-field="giftLede">
              {content.giftLede ?? 'Ge bort en blomstrande stund.'}
            </p>
            <a href="/presentkort" className={`${styles.flBandCta} ${fl.bandCta} ${fl.giftCta}`}>
              <span data-corevo-editor-field="giftCta" data-corevo-editor-stable-field="giftCta">{content.giftCta ?? 'Till presentkorten'}</span>
            </a>
          </Reveal>
        </section>
      ) : null}

      {/* GALLERI — masonry + lightbox */}
      <section className={styles.sfGalleryBand}>
        <div className={styles.sfWide}>
          <Reveal>
            <p className="sf-eyebrow" data-corevo-editor-field="galleryEyebrow" data-corevo-editor-stable-field="galleryEyebrow">{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* PLATS & ÖPPETTIDER */}
      <section className={styles.sfLocBand}>
        <div className={`${styles.sfWide} ${styles.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow" data-corevo-editor-field="findEyebrow" data-corevo-editor-stable-field="findEyebrow">{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={`sf-h2 ${fl.locTitle}`}>
              <span data-corevo-editor-field={location?.address ? 'location.address' : 'tenant.name'} data-corevo-editor-stable-field={location?.address ? 'location.address' : 'tenant.name'}>{location?.address ? location.address.split(',')[0] : tenant.name}</span>
            </h2>
            {location?.address ? (
              <p className={`sf-body ${fl.locBody}`} data-corevo-editor-field="location.address" data-corevo-editor-stable-field="location.address">{location.address}</p>
            ) : (
              <p className={`sf-body ${fl.locBody}`}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={styles.sfHours}>
                {location.hours.map((h, index) => (
                  <div key={h.day} className={styles.sfHoursRow}>
                    <span>{h.day}</span>
                    <span data-corevo-editor-field={`opening_hours.${index}.time`} data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <div className={styles.sfMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.sfMapLink}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={styles.sfMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.sfClosing}>
        <Reveal>
          <h2 className={`sf-h1 ${fl.closingTitle}`} data-corevo-editor-field="closingTitle" data-corevo-editor-stable-field="closingTitle">
            {content.closingTitle ?? 'Blommor för din dag?'}
          </h2>
          <p className={styles.sfClosingLead} data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">{content.closingLede ?? 'Beställ, boka en kurs eller hör av dig — vi hjälper dig gärna.'}</p>
          <div className={fl.closingActions}>
            <BookCta enabled={bookingReachable} className={styles.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
