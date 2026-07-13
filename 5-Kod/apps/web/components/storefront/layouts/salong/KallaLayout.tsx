import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { StorefrontLayoutProps } from '../types'
import styles from './kalla.module.css'

/**
 * KÄLLA — HÅRSPA & FRISÖR (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Källa - Hårspa.dc.html", sektion för
 * sektion, i filens ordning:
 *
 *   (1) HERO         — centrerad: eyebrow, "Ett andrum / för ditt hår.", lede, två CTA:er
 *   (2) BANDBILDEN   — 21:9-foto med spärrad bildtext under
 *   (3) RITUALEN     — 01 Rening · 02 Behandling · 03 Finish (cirklade siffror)
 *   (4) SIGNATURER   — "Tre ritualer": tre kort med tid/namn/text/pris/Boka
 *   (5) OM KÄLLA     — tonad platta (accent-soft) med text till vänster, 5:4-foto till höger
 *   (6) VÅRA HÄNDER  — teamet i runda porträtt (OWNER-ONLY, se nedan)
 *   (7) ANTECKNINGAR — rad-listan med "Alla →"
 *
 * Filen har varken butiks-, presentkorts- eller klubb-band på hemmet — och då har inte
 * mallen det heller. De modulerna nås via nav och sidfot, precis som i filen. Att lägga
 * till en sektion "för att grannmallen har en" ÄR att improvisera bort mallen
 * (CLAUDE.md § DESIGN-TROHET).
 *
 * TEAMET är OWNER-ONLY: `content.team` är tom tills ägaren laddat upp riktiga personer, och
 * då ritas sektionen INTE alls. Mallen visar aldrig filens Ester/Nour/Vilgot som om de vore
 * salongens personal.
 *
 * TJÄNSTERNA kommer ur `services` (riktig moduldata) — aldrig filens hårdkodade priser.
 * Modul-gatingen är plattformens och HELIG: anteckningarna ritas bara när bloggen har
 * inlägg. SYNKRON komponent (ingen async, ingen 'use client') — studions preview renderar
 * samma komponent.
 */
export function KallaLayout({ content, services, modules }: StorefrontLayoutProps) {
  // Filen visar TRE signatur-ritualer på hemmet (homeServices).
  const signatures = services.slice(0, 3)
  const posts = (modules?.bloggTeasers ?? []).slice(0, 3)

  const bandPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''

  // Filens ritualSteps — VERBATIM. Ägaren kan skriva om dem via pillar-fälten.
  const steps = [
    {
      no: '01',
      name: content.pillar1Title ?? 'Rening',
      desc: content.pillar1Body ?? 'Hårbottenanalys, peeling och massage. Grunden i varje besök.',
    },
    {
      no: '02',
      name: content.pillar2Title ?? 'Behandling',
      desc: content.pillar2Body ?? 'Fukt eller protein — håret får det håret saknar, aldrig mer.',
    },
    {
      no: '03',
      name: content.pillar3Title ?? 'Finish',
      desc: content.pillar3Body ?? 'Klipp, fön eller bara luft. Du väljer tempot ut.',
    },
  ]

  return (
    <div className={styles.kaRoot}>
      {/* (1) HERO */}
      <section className={styles.kaHero}>
        <Reveal>
          <p className={styles.kaEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.kaHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.kaHeroLede}>{content.heroLede}</p>
          <div className={styles.kaHeroCtas}>
            {/* "Boka en ritual" — boknings-drawern/-sidan, plattformens funktion. */}
            <BookCta className={styles.kaSolid} label="Boka en ritual" />
            <Link href="/tjanster" className={styles.kaGhost}>
              Behandlingar
            </Link>
          </div>
        </Reveal>
      </section>

      {/* (2) BANDBILDEN */}
      <section className={styles.kaBand}>
        <Reveal delay={100}>
          <div
            className={styles.kaBandPhoto}
            style={bandPhoto ? { backgroundImage: `url(${bandPhoto})` } : undefined}
          />
          <p className={styles.kaBandCaption}>{content.galleryEyebrow ?? 'Behandlingsrummet'}</p>
        </Reveal>
      </section>

      {/* (3) RITUALEN 01 · 02 · 03 */}
      <section className={styles.kaRitual}>
        {steps.map((s, i) => (
          <Reveal key={s.no} delay={i * 90} className={styles.kaStep}>
            <span className={styles.kaStepNo}>{s.no}</span>
            <h3 className={styles.kaStepName}>{s.name}</h3>
            <p className={styles.kaStepDesc}>{s.desc}</p>
          </Reveal>
        ))}
      </section>

      {/* (4) SIGNATURER — tre ritualer ur riktiga tjänster */}
      {signatures.length > 0 ? (
        <section className={styles.kaSection}>
          <Reveal className={styles.kaSecHead}>
            <p className={styles.kaSecEyebrow}>{content.servicesEyebrow}</p>
            <h2 className={styles.kaSecTitle}>{content.servicesTitle}</h2>
          </Reveal>
          <ul className={styles.kaCardGrid}>
            {signatures.map((s, i) => (
              <li key={s.id}>
                <Reveal delay={i * 90} className={styles.kaCard}>
                  <p className={styles.kaCardTid}>{formatDuration(s)}</p>
                  <h3 className={styles.kaCardName}>{s.name}</h3>
                  <p className={styles.kaCardDesc}>{serviceDesc(s)}</p>
                  <p className={styles.kaCardPrice}>{formatPrice(s)}</p>
                  {/* Filens `s.book` förifyller bokningen → plattformens <Bookable>. */}
                  <Bookable
                    as="span"
                    className={styles.kaCardBook}
                    label={`Boka — ${s.name}`}
                  >
                    Boka
                  </Bookable>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (5) OM KÄLLA */}
      <section className={styles.kaSection}>
        <Reveal className={styles.kaAbout}>
          <div>
            <p className={styles.kaSecEyebrow}>{content.teamEyebrow}</p>
            <h2 className={styles.kaAboutTitle}>{content.aboutTitle}</h2>
            <p className={styles.kaAboutBody}>{content.aboutCopyHome}</p>
            <Link href="/om" className={styles.kaTextLink}>
              Läs mer →
            </Link>
          </div>
          <div
            className={styles.kaAboutPhoto}
            style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
          />
        </Reveal>
      </section>

      {/* (6) VÅRA HÄNDER — OWNER-ONLY: tom lista → ingen sektion alls. */}
      {content.team.length > 0 ? (
        <section className={styles.kaSectionNarrow}>
          <Reveal className={styles.kaSecHead}>
            <h2 className={styles.kaSecTitle}>{content.teamTitle}</h2>
          </Reveal>
          <ul className={styles.kaTeamGrid}>
            {content.team.map((m, i) => (
              <li key={`${m.name}-${i}`}>
                <Reveal delay={i * 90} className={styles.kaTeamMember}>
                  <div
                    className={styles.kaTeamPhoto}
                    style={m.img ? { backgroundImage: `url(${m.img})` } : undefined}
                  />
                  <h3 className={styles.kaTeamName}>{m.name}</h3>
                  <p className={styles.kaTeamRoll}>{m.role}</p>
                  <Bookable as="span" className={styles.kaTextLink} label={`Boka ${m.name}`}>
                    Boka {m.name} →
                  </Bookable>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (7) ANTECKNINGAR — modul-gatad: inga inlägg → ingen sektion, ingen länk. */}
      {posts.length > 0 ? (
        <section className={styles.kaNotes}>
          <Reveal className={styles.kaNotesHead}>
            <h2 className={styles.kaNotesTitle}>{content.blogTitle ?? 'Anteckningar'}</h2>
            <Link href="/blogg" className={styles.kaTextLink}>
              {content.blogCta ?? 'Alla →'}
            </Link>
          </Reveal>
          <ul className={styles.kaNoteList}>
            {posts.map((p, i) => (
              <li key={p.id}>
                <Reveal delay={i * 70}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.kaNoteRow}>
                    <h3 className={styles.kaNoteRowTitle}>{p.title}</h3>
                    <span className={styles.kaNoteRowDate}>{formatNoteDate(p.publishedAt)}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/** Filens korta datumform ("8 juli") — inget år, inget klockslag. */
function formatNoteDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}
