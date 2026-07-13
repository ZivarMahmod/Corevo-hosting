import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { StorefrontLayoutProps } from '../types'
import styles from './siluett.module.css'

/**
 * SILUETT — MODEMAGASIN (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Siluett - Modemagasin.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) HERO          — två spalter (1.05fr/1fr): eyebrow + "Håret är din *siluett.*" +
 *                       två CTA:er till vänster, ett 4:5-foto med bildtext (N°01 · SS26)
 *                       till höger, adressraden under texten.
 *   (2) REMSAN        — Klipp · Färg · Balayage · Uppsättning · Vård, mellan två 2px-linjer.
 *   (3) TRE SIGNATURER— "Ur prislistan": tre numrerade kort ur SALONGENS EGNA tjänster
 *                       (aldrig filens mockdata), varje kort en <Bookable>.
 *   (4) SALONGEN      — foto | text, "Ett magasin du kliver in i."
 *   (5) VID STOLARNA  — teamet. OWNER-ONLY: tom lista → sektionen ritas INTE. Mallen
 *                       visar aldrig stock-ansikten som om de vore salongens personal.
 *   (6) JOURNAL       — tre bloggrader (modul-gatade).
 *
 * Filen har varken butiks-band eller presentkortsrad på hemmet — och då har inte mallen
 * det heller. Butiken, klubben, presentkortet och eventförfrågan nås via nav och sidfot,
 * precis som i .dc-filen. Att lägga till en sektion "för att de andra mallarna har en" ÄR
 * att improvisera bort mallen (CLAUDE.md § DESIGN-TROHET).
 *
 * SYNKRON komponent (ingen async, ingen 'use client') — onboarding-studions preview
 * renderar samma komponent.
 */
export function SiluettLayout({ content, services, modules }: StorefrontLayoutProps) {
  // Filen visar TRE signaturer på hemmet. Datan är salongens egen prislista.
  const signatures = services.slice(0, 3)
  // modules === undefined (studions statiska preview) → visa allt.
  const posts = modules ? modules.bloggTeasers.slice(0, 3) : []
  const bloggReachable = modules ? modules.bloggTeasers.length > 0 : true
  // Team = ägarens uppladdade (content.team). Tom → ingen sektion.
  const team = content.team.slice(0, 4)

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const aboutPhoto = content.aboutImage ?? content.heroImages[1] ?? ''

  // Filens remsa. Ägaren får skriva om orden; separatorn är designens (elviolett punkt).
  const ticker = (content.pillar3Title ?? 'Klipp · Färg · Balayage · Uppsättning · Vård')
    .split('·')
    .map((w) => w.trim())
    .filter(Boolean)

  return (
    <div className={styles.siRoot}>
      {/* (1) HERO */}
      <section className={styles.siHero}>
        <Reveal>
          <p className={styles.siHeroEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.siHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.siHeroLede}>{content.heroLede}</p>
          <div className={styles.siHeroCtas}>
            <BookCta className={styles.siSolid} label="Boka en stol" />
            <Link href="/tjanster" className={styles.siUnderline}>
              Hela prislistan
            </Link>
          </div>
          <p className={styles.siHeroMeta}>
            {content.pillar2Title ?? 'Drottninggatan 4 · Stockholm · Tis–Lör'}
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div
            className={styles.siHeroPhoto}
            style={heroPhoto ? { backgroundImage: `url(${heroPhoto})` } : undefined}
          />
          <div className={styles.siHeroCap}>
            <p className={styles.siHeroCapLabel}>
              {content.pillar1Title ?? 'N°01 — Klippning & form'}
            </p>
            <p className={styles.siHeroCapSeason}>{content.pillar1Body ?? 'SS26'}</p>
          </div>
        </Reveal>
      </section>

      {/* (2) REMSAN */}
      <section className={styles.siTicker}>
        <div className={styles.siTickerRow}>
          {ticker.map((word, i) => (
            <span key={word}>
              {word}
              {i < ticker.length - 1 ? <span className={styles.siTickerDot}> ·</span> : null}
            </span>
          ))}
        </div>
      </section>

      {/* (3) TRE SIGNATURER — salongens egna tjänster, numrerade N°01–N°03 */}
      {signatures.length > 0 ? (
        <section className={styles.siSection}>
          <Reveal className={styles.siSecHead}>
            <div>
              <p className={styles.siEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.siSecTitle}>{content.servicesTitle}</h2>
            </div>
            <Link href="/tjanster" className={styles.siUnderline}>
              Prislistan →
            </Link>
          </Reveal>
          <ul className={styles.siSigGrid}>
            {signatures.map((s, i) => (
              <li key={s.id}>
                <Reveal delay={i * 90}>
                  <Bookable className={styles.siSigCard} label={`Boka — ${s.name}`}>
                    <p className={styles.siSigNo}>N°{String(i + 1).padStart(2, '0')}</p>
                    <h3 className={styles.siSigName}>{s.name}</h3>
                    <p className={styles.siSigDesc}>{serviceDesc(s)}</p>
                    <div className={styles.siSigFoot}>
                      <span className={styles.siSigPrice}>{formatPrice(s)}</span>
                      <span className={styles.siSigTid}>{formatDuration(s)}</span>
                    </div>
                    <span className={styles.siSigBook}>Boka →</span>
                  </Bookable>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (4) SALONGEN */}
      <section className={styles.siSectionWide}>
        <div className={styles.siAbout}>
          <Reveal>
            <div
              className={styles.siAboutPhoto}
              style={aboutPhoto ? { backgroundImage: `url(${aboutPhoto})` } : undefined}
            />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.siAboutEyebrow}>{content.homeGalleryEyebrow ?? 'Salongen'}</p>
            <h2 className={styles.siAboutTitle}>{content.aboutTitle}</h2>
            <p className={styles.siAboutBodyTight}>{content.aboutCopyHome}</p>
            <p className={styles.siAboutBody}>{content.italic}</p>
            <Link href="/om" className={styles.siUnderline}>
              Om oss →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* (5) VID STOLARNA — bara när ägaren lagt in sitt team */}
      {team.length > 0 ? (
        <section className={styles.siSectionWide}>
          <Reveal className={styles.siSecHead}>
            <h2 className={styles.siSecTitle}>{content.teamTitle}</h2>
            <Link href="/om" className={styles.siUnderline}>
              Hela teamet →
            </Link>
          </Reveal>
          <ul className={styles.siTeamGrid}>
            {team.map((m, i) => (
              <li key={m.name}>
                <Reveal delay={i * 90}>
                  <Bookable label={`Boka ${m.name}`}>
                    <div
                      className={styles.siTeamPhoto}
                      style={m.img ? { backgroundImage: `url(${m.img})` } : undefined}
                    />
                    <h3 className={styles.siTeamName}>{m.name}</h3>
                    <p className={styles.siTeamRole}>{m.role}</p>
                    <span className={styles.siSigBook}>Boka {m.name.split(' ')[0]} →</span>
                  </Bookable>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (6) JOURNAL — modul-gatad: ingen blogg → ingen rubrik, ingen länk */}
      {bloggReachable && posts.length > 0 ? (
        <section className={styles.siJournal}>
          <div className={styles.siJournalHead}>
            <h2 className={styles.siSecTitle}>{content.blogTitle ?? 'Journal'}</h2>
            <Link href="/blogg" className={styles.siUnderline}>
              {content.blogCta ?? 'Alla texter →'}
            </Link>
          </div>
          {posts.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <Link href={`/blogg/${p.slug}`} className={styles.siJournalRow}>
                <p className={styles.siJournalMeta}>{formatPostDate(p.publishedAt)}</p>
                <h3 className={styles.siJournalTitle}>{p.title}</h3>
                <span className={styles.siJournalArrow}>→</span>
              </Link>
            </Reveal>
          ))}
        </section>
      ) : null}
    </div>
  )
}

/** Filens "Guide · 2 juli"-rad. Utan datum står bara rubriken — vi hittar inte på ett. */
function formatPostDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}
