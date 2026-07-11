import Link from 'next/link'
import { HeroCarousel } from '../HeroCarousel'
import { Reveal } from '../Reveal'
import { Gallery } from '../Gallery'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * SALVIA — the full editorial base (handoff Home.jsx). Distinct shape:
 *  full-bleed hero carousel with copy anchored bottom-left, numbered service rows
 *  (01–05), About split + stat-trio, Team 3-up, Gallery masonry, Location + map,
 *  then the 3-col footer (rendered by the public layout chrome).
 *
 * This is the ONLY layout that uses the transparent-over-hero fixed nav: its hero
 * carries the global `.hero` sentinel (NavShell goes transparent) and the hashed
 * `.heroSection` (whose negative margin cancels the reserved --nav-h so the photo
 * meets the viewport top under the nav).
 */
export function SalviaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 5)
  const hasMore = services.length > 5

  // SALVIA ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats
  // editoriala grammatik (3-up-foton som teamet, accent-soft-band) istället för
  // den generiska sektions-stapeln — page.tsx hoppar över StorefrontModuleSections
  // för salvia och förladdar teasers (loadLayoutModuleTeasers) som `modules`-prop
  // så layouten förblir synkron (studions klient-preview renderar samma komponent).
  // Modulernas EGNA sidor är fortfarande hemmet för hela innehållet.
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  return (
    <>
      {/* HERO — full-bleed carousel, copy bottom-left */}
      <section className={`hero ${styles.heroSection}`} aria-label="Välkommen">
        <HeroCarousel
          images={content.heroImages.map((src) => ({ src, alt: '' }))}
          align="left"
        >
          <p className={styles.heroEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.heroTitle} style={{ whiteSpace: 'pre-line' }}>
            {content.heroTitle}
          </h1>
          <p className={styles.heroLead}>{content.heroLede}</p>
          <div className={styles.heroActions}>
            <BookCta className={styles.heroCta} />
          </div>
        </HeroCarousel>
      </section>

      {/* TJÄNSTER — numbered editorial rows 01–05 */}
      <section className={styles.sfServices}>
        <div className={styles.sfNarrow}>
          <Reveal>
            <p className="sf-eyebrow">{content.servicesEyebrow}</p>
            <h2 className="sf-h1" style={{ marginTop: 12, maxWidth: '38rem' }}>
              {content.servicesTitle}
            </h2>
          </Reveal>
          {rows.length > 0 ? (
            <div className={styles.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.sfRow} label={`Boka — ${s.name}`}>
                    <span className={styles.sfRowNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.sfRowMain}>
                      <span className={styles.sfRowName}>{s.name}</span>
                      <span className={styles.sfRowDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.sfRowMeta}>
                      <span className={styles.sfRowPrice}>{formatPrice(s)}</span>
                      <span className={styles.sfRowTime}>{formatDuration(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="sf-body" style={{ marginTop: 32 }}>
              Tjänster läggs upp inom kort. Du är ändå varmt välkommen att boka eller höra av dig.
            </p>
          )}
          {hasMore ? (
            <Reveal>
              <a href="/tjanster" className={styles.sfMoreLink}>
                Se alla tjänster <span aria-hidden="true">→</span>
              </a>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i salvias editoriala grammatik:
          samma 3-up-fotokort som teamet, centrerad rubrik, sfMoreLink-CTA.
          Bara ett smakprov; hela sortimentet bor på /shop. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.sfTeam}>
          <div className={styles.sfWide}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">— Ur butiken</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>
                Ta med dig salongen hem
              </h2>
            </Reveal>
            <ul className={styles.sfTeamGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal as="li" key={p.id} delay={i * 90} className={styles.sfTeamCard}>
                  <Link href={`/shop/${p.id}`} style={{ display: 'block' }}>
                    <div
                      className={styles.sfTeamPhoto}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <h3 className={styles.sfTeamName}>{p.name}</h3>
                    <p className="sf-body" style={{ fontSize: 14 }}>
                      {formatShopPrice(p.priceCents, p.currency)}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </ul>
            <Reveal style={{ textAlign: 'center' }}>
              <Link href="/shop" className={styles.sfMoreLink}>
                Visa hela butiken <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* OM — split photo + copy + stat-trio */}
      <section className={styles.sfAboutBand}>
        <div className={`${styles.sfWide} ${styles.sfAboutGrid}`}>
          <Reveal>
            <div
              className={styles.sfAboutPhoto}
              style={{ backgroundImage: `url(${content.aboutImage})` }}
            />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <p className={`sf-italic ${styles.sfAboutItalic}`}>{content.italic}</p>
            <p className="sf-body" style={{ fontSize: 17 }}>
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

      {/* TEAM — 3-up. Owner-only: rendered solely when the salon has uploaded real
          team members (theme stock faces are never shown as the salon's staff).
          Hidden entirely otherwise — no empty shell, no placeholder portraits. */}
      {content.team.length > 0 ? (
        <section className={styles.sfTeam}>
          <div className={styles.sfWide}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.teamEyebrow}</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>
                {content.teamTitle}
              </h2>
            </Reveal>
            <ul className={styles.sfTeamGrid}>
              {content.team.map((m, i) => (
                <Reveal as="li" key={m.name + i} delay={i * 90} className={styles.sfTeamCard}>
                  {/* Foto valfritt (staff.avatar_url kan vara tomt) — utan bild visas en
                      standard-silhuett som inline-SVG i temats ton (accent-soft-ytan är
                      .sfTeamPhoto:s befintliga bakgrund; aldrig en tom/trasig url()). */}
                  {m.img ? (
                    <div className={styles.sfTeamPhoto} style={{ backgroundImage: `url(${m.img})` }} />
                  ) : (
                    <div
                      className={styles.sfTeamPhoto}
                      aria-hidden="true"
                      style={{ display: 'grid', placeItems: 'center' }}
                    >
                      <svg viewBox="0 0 96 96" width="46%" role="presentation" focusable="false">
                        <g fill="var(--color-primary)" opacity="0.32">
                          <circle cx="48" cy="34" r="16" />
                          <path d="M16 86c2.5-18 15.5-28 32-28s29.5 10 32 28z" />
                        </g>
                      </svg>
                    </div>
                  )}
                  <h3 className={styles.sfTeamName}>{m.name}</h3>
                  <p className="sf-body" style={{ fontSize: 14 }}>
                    {m.role}
                  </p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* GALLERI — masonry grid + lightbox */}
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

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste i samma 3-up-form → /blogg).
          Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.sfTeam} style={{ paddingTop: 0 }}>
          <div className={styles.sfWide}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">— Från bloggen</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>
                Senaste från oss
              </h2>
            </Reveal>
            <ul className={styles.sfTeamGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal as="li" key={p.id} delay={i * 90} className={styles.sfTeamCard}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} style={{ display: 'block' }}>
                    <div
                      className={styles.sfTeamPhoto}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <h3 className={styles.sfTeamName}>{p.title}</h3>
                    {p.excerpt ? (
                      <p className="sf-body" style={{ fontSize: 14 }}>
                        {p.excerpt}
                      </p>
                    ) : null}
                  </Link>
                </Reveal>
              ))}
            </ul>
            <Reveal style={{ textAlign: 'center' }}>
              <Link href="/blogg" className={styles.sfMoreLink}>
                Läs hela bloggen <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* PRESENTKORT — smal band-rad i accent-soft-ytan (samma yta som Om-bandet),
          inte en hel stapel-sektion. */}
      {presentkortLive ? (
        <section className={styles.sfAboutBand} style={{ padding: 'clamp(40px, 6vw, 64px) 24px', textAlign: 'center' }}>
          <Reveal>
            <p className="sf-eyebrow">— Presentkort</p>
            <p className={`sf-italic ${styles.sfAboutItalic}`} style={{ maxWidth: '32rem', margin: '12px auto 0' }}>
              Ge bort en stund att se fram emot.
            </p>
            <Link href="/presentkort" className={styles.sfMoreLink}>
              Till presentkorten <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PLATS & ÖPPETTIDER + closing CTA */}
      <section className={styles.sfLocBand}>
        <div className={`${styles.sfWide} ${styles.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">— Hitta hit</p>
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
            {/* Honest map affordance: we don't geocode, so rather than embed a
                misleading default-bbox map we link to a real OSM search for the
                saved address (matches the LocationHours pattern). */}
            <div className={styles.sfMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(
                    location.address,
                  )}`}
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
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto' }}>
            Redo för en ny stil?
          </h2>
          <p className={styles.sfClosingLead}>Boka din tid på under en minut.</p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={styles.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
