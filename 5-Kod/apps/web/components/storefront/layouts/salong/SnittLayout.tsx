import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { BookCta } from '@/components/brand/BookCta'
import { Bookable } from '../../Bookable'
import type { StorefrontLayoutProps } from '../types'
import { groupServices, SnittPriceRow } from './snitt.pages'
import styles from './snitt.module.css'

/**
 * SNITT — SVART STUDIO (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Snitt - Svart Studio.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) HERO       — spärrad kind-rad, "HÅR MED / KANT." i Anton 96px (andra raden lime),
 *                    lede + CTA-paret "Boka nu" (lime) / "Tjänster" (inramad)
 *   (2) TRIPTYKEN  — tre foton: 4:3 brett, 3:4 nedskjutet 32px, 3:4
 *   (3) HANTVERKET — den grupperade prislistan (max fem rader) + "Hela prislistan →"
 *   (4) LIME-BANDET— "Hitta en tid som passar dig." + svart boknings-knapp
 *   (5) OM STUDION — foto 4:5 | text + 5,0★-blocket (caps.homeStats)
 *   (6) STOLARNA   — teamet (OWNER-ONLY: tom lista → sektionen ritas INTE alls)
 *   (7) HITTAR DU HIT? — adress/öppettider/kontakt + filens kart-platta
 *
 * Filen har varken butiks- eller blogg-band på hemmet — och då har inte mallen det
 * heller. Modulerna nås via nav och sidfot, precis som i filen. Att lägga till en
 * sektion "för att de andra mallarna har en" ÄR att improvisera bort mallen
 * (CLAUDE.md § DESIGN-TROHET).
 *
 * SYNKRON komponent (ingen async, ingen 'use client') — onboarding-studions preview
 * renderar samma komponent.
 */
export function SnittLayout({ content, services, location }: StorefrontLayoutProps) {
  // Filen visar 2 + 2 + 1 rader på hemmet och HELA listan på prislistan. Vi klipper på
  // fem rader och behåller grupperingen — grupperna är tjänsternas egen kategori.
  const homeGroups = groupServices(services.slice(0, 5))
  const clipped = services.length > 5

  const [heroWide, heroDrop, heroTall] = content.heroImages
  const hours = location?.hours ?? null

  // Heroens H1 bryts på \n; sista raden bär limen (filens <span>kant.</span>).
  const heroLines = content.heroTitle.split('\n')
  const heroHead = heroLines.slice(0, -1)
  const heroTail = heroLines[heroLines.length - 1] ?? ''

  return (
    <div className={styles.snRoot}>
      <div className={styles.snWrap}>
        {/* (1) HERO */}
        <section className={styles.snHero}>
          <Reveal>
            <p className={styles.snHeroEyebrow}>{content.heroEyebrow}</p>
            <h1 className={styles.snHeroTitle}>
              {heroHead.map((line) => (
                <span key={line} data-corevo-editor-line>
                  {line}
                  <br />
                </span>
              ))}
              <span className={styles.snHeroAccent} data-corevo-editor-line
                data-corevo-editor-line-tail>{heroTail}</span>
            </h1>
            <div className={styles.snHeroFoot}>
              <p className={styles.snHeroLede}>{content.heroLede}</p>
              <div className={styles.snHeroCtas}>
                <BookCta className={styles.snBtn} label="Boka nu" />
                <Link href="/tjanster" className={styles.snBtnGhost}>
                  Tjänster
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* (2) TRIPTYKEN */}
        {heroWide ? (
          <Reveal delay={120}>
            <section className={styles.snTriptych}>
              <div className={styles.snPhotoWide} data-corevo-editor-field="hero_images.0"
                data-corevo-editor-stable-field="hero_images.0"
                style={{ backgroundImage: `url(${heroWide})` }} />
              <div className={`${styles.snPhotoTall} ${styles.snPhotoDrop}`}
                data-corevo-editor-field="hero_images.1" data-corevo-editor-stable-field="hero_images.1"
                hidden={!heroDrop}
                style={heroDrop ? { backgroundImage: `url(${heroDrop})` } : undefined} />
              <div className={styles.snPhotoTall} data-corevo-editor-field="hero_images.2"
                data-corevo-editor-stable-field="hero_images.2"
                hidden={!heroTall} style={heroTall ? { backgroundImage: `url(${heroTall})` } : undefined} />
            </section>
          </Reveal>
        ) : null}

        {/* (3) HANTVERKET, PRESENTERAT — den grupperade prislistan */}
        {services.length > 0 ? (
          <section className={styles.snSectionNarrow}>
            <Reveal>
              <p className={styles.snEyebrow}>
                <span className={styles.snDash}>—</span> {content.servicesEyebrow}
              </p>
              <h2 className={styles.snSecTitle}>{content.pillar1Title ?? 'Hantverket, presenterat.'}</h2>
              <p className={styles.snSecLede}>
                {content.pillar1Body ??
                  'Varje behandling anpassas efter din stil, hårtyp och ansiktsform. Priserna gäller oavsett längd — vi tar betalt för tid, inte centimeter.'}
              </p>
            </Reveal>
            {homeGroups.map((g, i) => (
              <div key={g.name ?? `grupp-${i}`} className={styles.snGroup}>
                {g.name ? <p className={styles.snGroupName}>{g.name}</p> : null}
                {g.items.map((s) => (
                  <SnittPriceRow key={s.id} service={s} />
                ))}
              </div>
            ))}
            {clipped ? (
              <p className={styles.snListMore}>
                <Link href="/tjanster" className={styles.snLink}>
                  Hela prislistan →
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}

        {/* (4) LIME-BANDET — svart knapp på lime, lime text i knappen */}
        <section className={styles.snSection}>
          <Reveal>
            <div className={styles.snBand}>
              <h2 className={styles.snBandTitle}>
                {content.pillar2Title ?? 'Hitta en tid som passar dig.'}
              </h2>
              <BookCta className={styles.snBandCta} label="Boka nu" />
            </div>
          </Reveal>
        </section>

        {/* (5) OM STUDION + 5,0★-blocket */}
        <section className={styles.snSection}>
          <div className={styles.snAbout}>
            <Reveal>
              <div
                className={styles.snAboutPhoto}
                data-corevo-editor-field="about_image"
                data-corevo-editor-stable-field="about_image"
                style={
                  content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined
                }
              />
            </Reveal>
            <Reveal delay={120}>
              <p className={styles.snEyebrow}>
                <span className={styles.snDash}>—</span> Om studion
              </p>
              <h2 className={styles.snAboutTitle}>{content.aboutTitle}</h2>
              <p className={styles.snAboutBody}>{content.aboutCopyHome}</p>
              <p className={styles.snAboutItalic}>{content.italic}</p>
              {content.stats.length > 0 ? (
                <div className={styles.snStats}>
                  {content.stats.map(([value, label], i) => (
                    <div key={`${value}-${label}`}>
                      <p className={`${styles.snStatValue} ${i === 0 ? styles.snStatFirst : ''}`}>
                        {value}
                      </p>
                      <p className={styles.snStatLabel}>{label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Reveal>
          </div>
        </section>

        {/* (6) STOLARNA — OWNER-ONLY. Tom lista → ingen sektion, inga stock-ansikten
            presenterade som salongens personal. */}
        {content.team.length > 0 ? (
          <section className={styles.snSection}>
            <Reveal>
              <p className={styles.snEyebrow}>
                <span className={styles.snDash}>—</span> {content.teamEyebrow}
              </p>
              <h2 className={styles.snSecTitleAlt}>{content.teamTitle}</h2>
            </Reveal>
            <ul className={styles.snCards3}>
              {content.team.map((m, i) => (
                <li key={m.name} className={styles.snCard}>
                  <Reveal delay={i * 90}>
                    <div
                      className={styles.snCardPhoto}
                      style={m.img ? { backgroundImage: `url(${m.img})` } : undefined}
                    />
                    <div className={styles.snCardBody}>
                      <h3 className={styles.snCardName}>{m.name}</h3>
                      <p className={styles.snCardRole}>{m.role}</p>
                      {/* Filens "Boka Malik →" — plattformens <Bookable>, aldrig egen logik. */}
                      <Bookable
                        as="span"
                        className={styles.snCardBook}
                        label={`Boka ${m.name}`}
                      >
                        Boka {m.name} →
                      </Bookable>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* (7) HITTAR DU HIT? — bara det salongen FAKTISKT har fyllt i. */}
        {location?.address || hours ? (
          <section className={styles.snSection}>
            <Reveal>
              <p className={styles.snEyebrow}>
                <span className={styles.snDash}>—</span> {content.findEyebrow ?? 'Plats & öppettider'}
              </p>
              <h2 className={styles.snSecTitleAlt}>{content.pillar3Title ?? 'Hittar du hit?'}</h2>
            </Reveal>
            <div className={styles.snFacts}>
              {location?.address ? (
                <div className={styles.snFact}>
                  <p className={styles.snFactLabel}>Adress</p>
                  <p className={styles.snFactValue} data-corevo-editor-field="location.address"
                    data-corevo-editor-stable-field="location.address">{location.address}</p>
                </div>
              ) : null}
              {hours && hours.length > 0 ? (
                <div className={styles.snFact}>
                  <p className={styles.snFactLabel}>Öppettider</p>
                  <p className={styles.snFactValue}>
                    {hours.map((h, index) => (
                      <span key={h.day}>
                        {h.day}{' '}
                        <span data-corevo-editor-field={`opening_hours.${index}.time`}
                          data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</span>
                        <br />
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
              <div className={styles.snFact}>
                <p className={styles.snFactLabel}>Kontakt</p>
                <p className={styles.snFactValue}>
                  <Link href="/kontakt" className={styles.snLink}>
                    Skriv till oss →
                  </Link>
                </p>
              </div>
            </div>
            {location?.address ? (
              <div className={styles.snMap}>
                <p className={styles.snMapText}>[ karta —{' '}
                  <span data-corevo-editor-field="location.address"
                    data-corevo-editor-stable-field="location.address">{location.address}</span> ]
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
