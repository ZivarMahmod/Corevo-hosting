import Link from 'next/link'
import { Reveal } from '../Reveal'
import { Gallery } from '../Gallery'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * FLORA — bohemisk blomsterbutik (florist-branschens tema; modulärt, aldrig låst).
 * EGET formspråk (v2 efter Zivars "kändes som frisörens"): centrerad italisk
 * Playfair-hero över TRE valv-bilder i olika höjd, ornament-avdelare (stjälk-SVG),
 * verksamhets-ben (Beställ/Bröllop & avsked/Kurser), numrerade prisrader utan
 * duration, valv-porträtt i om-sektionen, galleri, plats och closing. Webshop/
 * blogg/presentkort vävs in i layouten via `modules`-propen (S10).
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
  const presentkortLive = modules?.presentkortLive ?? false
  // Pelarna länkar bara dit en sida faktiskt finns (live/paused renderar; av/draft
  // → notFound). En pelare mot avstängd modul vore en 404-fälla (S9). Utan
  // modules-prop (studions statiska preview) VISAS pelarna — previewn ska se en
  // hel sida, och dess länkar är ändå inte klickbara på riktigt.
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true
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
          <span className={styles.sfPillEyebrow}>{content.heroEyebrow}</span>
          <h1 className={styles.flHeroTitle}>{content.heroTitle}</h1>
          <p className="sf-lede" style={{ maxWidth: '30rem', margin: '22px auto 0' }}>
            {content.heroLede}
          </p>
          <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center', gap: 14 }}>
            <BookCta className={styles.heroCta} />
          </div>
        </div>
        <div className={styles.flArches}>
          <Reveal className={styles.flArch} style={{ backgroundImage: `url(${arch2})` }}>
            <span />
          </Reveal>
          <Reveal delay={100} className={styles.flArch} style={{ backgroundImage: `url(${arch1})` }}>
            <span />
          </Reveal>
          <Reveal delay={200} className={styles.flArch} style={{ backgroundImage: `url(${arch3})` }}>
            <span />
          </Reveal>
        </div>
      </section>

      <Ornament />

      {/* VERKSAMHETS-BEN — det floristen faktiskt gör, tre vägar in */}
      <section style={{ paddingBottom: 'clamp(40px, 6vw, 80px)' }}>
        <div className={styles.flPillars}>
          {shopReachable ? (
            <Reveal>
              <Link href="/shop" className={styles.flPillar}>
                <div className={styles.flPillarImg} style={{ backgroundImage: `url(${content.galleryImages[0] ?? arch1})` }} />
                <h3 className={styles.flPillarName}>Beställ blommor</h3>
                <p className={styles.flPillarText}>Buketter i säsong — floristen väljer det finaste. Hämta i butik eller skicka bud.</p>
                <span className={styles.flPillarLink}>Till butiken</span>
              </Link>
            </Reveal>
          ) : null}
          {offertReachable ? (
            <Reveal delay={100}>
              <a href="/offert" className={styles.flPillar}>
                <div className={styles.flPillarImg} style={{ backgroundImage: `url(${content.galleryImages[1] ?? arch2})` }} />
                <h3 className={styles.flPillarName}>Bröllop & avsked</h3>
                <p className={styles.flPillarText}>Handbundna brudbuketter, corsage och binderier — eller ett personligt, vackert farväl.</p>
                <span className={styles.flPillarLink}>Begär offert</span>
              </a>
            </Reveal>
          ) : null}
          <Reveal delay={200}>
            <Link href="/kurser" className={styles.flPillar}>
              <div className={styles.flPillarImg} style={{ backgroundImage: `url(${content.galleryImages[2] ?? arch3})` }} />
              <h3 className={styles.flPillarName}>Kurser & kvällar</h3>
              <p className={styles.flPillarText}>Bukett & bubbel för ert sällskap — en kreativ stund med blommor i säsong.</p>
              <span className={styles.flPillarLink}>Boka kurs</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i flora-formspråket (valv-kort).
          Bara ett smakprov; hela sortimentet bor på /shop. */}
      {shopTeasers.length > 0 ? (
        <section style={{ paddingBottom: 'clamp(40px, 6vw, 80px)' }}>
          <Reveal className={styles.flSecHead}>
            <p className="sf-eyebrow">— Ur butiken</p>
            <h2 className="sf-h2" style={{ marginTop: 10, fontStyle: 'italic' }}>Beställ något vackert</h2>
          </Reveal>
          <div className={styles.flCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.flCard}>
                  <div
                    className={styles.flCardImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <h3 className={styles.flCardName}>{p.name}</h3>
                  <p className={styles.flCardMeta}>{formatShopPrice(p.priceCents, p.currency)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.flSecHead}>
            <Link href="/shop" className={styles.flBandCta}>Visa hela butiken</Link>
          </Reveal>
        </section>
      ) : null}

      {/* CITAT — andhämtning i accent-ytan */}
      <section style={{ padding: 'clamp(48px, 7vw, 84px) 24px', textAlign: 'center', background: 'var(--color-accent-soft)' }}>
        <Reveal>
          <p className="sf-italic" style={{ fontSize: 'clamp(24px, 3vw, 38px)', maxWidth: '38rem', margin: '0 auto', color: 'var(--color-primary)', lineHeight: 1.3 }}>
            ”{content.italic}”
          </p>
        </Reveal>
      </section>

      {/* PRISER — numrerade rader utan duration (blommor är inte klipptider) */}
      <section className={styles.sfServices}>
        <div className={styles.sfNarrow}>
          <Reveal style={{ textAlign: 'center' }}>
            <p className="sf-eyebrow">{content.servicesEyebrow}</p>
            <h2 className="sf-h1" style={{ marginTop: 12 }}>
              {content.servicesTitle}
            </h2>
          </Reveal>
          {rows.length > 0 ? (
            <div className={styles.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.sfRow} label={`Beställ — ${s.name}`}>
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
          ) : (
            <p className="sf-body" style={{ marginTop: 32, textAlign: 'center' }}>
              Buketter och binderier läggs upp inom kort. Ring oss gärna så länge.
            </p>
          )}
          {hasMore ? (
            <Reveal style={{ textAlign: 'center' }}>
              <a href="/tjanster" className={styles.sfMoreLink}>
                Se allt vi gör <span aria-hidden="true">→</span>
              </a>
            </Reveal>
          ) : null}
        </div>
      </section>

      <Ornament />

      {/* OM — valv-porträtt + berättelsen */}
      <section style={{ paddingBottom: 'clamp(48px, 7vw, 90px)' }}>
        <div className={`${styles.sfWide} ${styles.sfAboutGrid}`}>
          <Reveal>
            <div className={styles.flPortrait} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h2" style={{ marginTop: 12, fontStyle: 'italic' }}>{content.aboutTitle}</h2>
            <p className="sf-body" style={{ fontSize: 17, marginTop: 16 }}>
              {content.aboutCopyHome}
            </p>
            <ul className={styles.sfStatTrio}>
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

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste som valv-kort → /blogg) */}
      {bloggTeasers.length > 0 ? (
        <>
          <Ornament />
          <section style={{ paddingBottom: 'clamp(40px, 6vw, 80px)' }}>
            <Reveal className={styles.flSecHead}>
              <p className="sf-eyebrow">— Från bloggen</p>
              <h2 className="sf-h2" style={{ marginTop: 10, fontStyle: 'italic' }}>Säsong, tips & inspiration</h2>
            </Reveal>
            <div className={styles.flCardGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 90}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.flCard}>
                    <div
                      className={styles.flCardImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <h3 className={styles.flCardName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.flCardMeta}>{p.excerpt}</p> : null}
                  </Link>
                </Reveal>
              ))}
            </div>
            <Reveal className={styles.flSecHead}>
              <Link href="/blogg" className={styles.flBandCta}>Läs hela bloggen</Link>
            </Reveal>
          </section>
        </>
      ) : null}

      {/* PRESENTKORT — en rad i temats ton, inte en hel stapel-sektion */}
      {presentkortLive ? (
        <section style={{ padding: 'clamp(40px, 6vw, 72px) 24px', textAlign: 'center', background: 'var(--color-accent-soft)' }}>
          <Reveal>
            <p className="sf-eyebrow">— Presentkort</p>
            <p className="sf-italic" style={{ fontSize: 'clamp(20px, 2.4vw, 28px)', maxWidth: '32rem', margin: '12px auto 0', color: 'var(--color-primary)' }}>
              Ge bort en blomstrande stund.
            </p>
            <a href="/presentkort" className={styles.flBandCta}>Till presentkorten</a>
          </Reveal>
        </section>
      ) : null}

      {/* GALLERI — masonry + lightbox */}
      <section className={styles.sfGalleryBand}>
        <div className={styles.sfWide}>
          <Reveal>
            <p className="sf-eyebrow">— Galleri</p>
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
            <p className="sf-eyebrow">— Hitta till butiken</p>
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
              <div className={styles.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.sfHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
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
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto', fontStyle: 'italic' }}>
            Blommor för din dag?
          </h2>
          <p className={styles.sfClosingLead}>Beställ, boka en kurs eller hör av dig — vi hjälper dig gärna.</p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={styles.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
