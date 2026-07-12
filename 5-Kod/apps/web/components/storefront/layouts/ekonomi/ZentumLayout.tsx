import type { StorefrontLayoutProps } from '../types'
import styles from './zentum.module.css'
import {
  ZentumHeroShell,
  ZentumReveal,
  ZentumHeading,
  ZentumTestimonials,
  ZentumLogos,
  type Testimonial,
} from './zentum.client'

/**
 * ZENTUM — redovisningsbyrå-hemsidan (ekonomi-sviten). Pixel-portad ur den
 * verifierade statiska kopian (public/mallar/zentum/, fidelity-probe 63/63).
 * Sektionsföljd: hero → intro-statement → 6 tjänstekort → navy-split → referenser
 * → partner-logotyper. SYNKRON render (studions preview kan inte köra async).
 *
 * MODUL-REGELN: zentum väver INGA moduler — ingen /shop, /blogg, /presentkort
 * eller /offert-länk får renderas härifrån (ekonomi-suite.test.tsx bevakar det).
 * Mallens tjänstekort är designens sex fasta ekonomitjänster; tenantens egna
 * `services` visas på undersidan /tjanster (zentum.pages.tsx).
 */

const PILAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
    <line x1="5" y1="19" x2="19" y2="5" />
    <polyline points="9 5 19 5 19 15" />
  </svg>
)

/** Designens sex tjänstekort (generiska facktermer). Bilderna = mallens galleri. */
const TJANSTER = [
  'Bokföring',
  'Bokslut & årsredovisning',
  'Rådgivning & skatteplanering',
  'Deklarationer, INK1, INK2',
  'Interimslösningar',
  'Projekt & punktinsatser',
] as const

const REFERENSER: Testimonial[] = [
  {
    quote:
      'Sedan vi lämnade över ekonomin har vi kunnat lägga all kraft på kärnverksamheten. Snabba svar, ordning och reda och en känsla av att de faktiskt bryr sig om vårt bolag — det är därför vi stannar.',
    name: 'Johan Lindqvist',
    company: 'Nordfält Bygg AB',
    initials: 'NB',
  },
  {
    quote:
      'De sköter hela vår redovisning och förklarar alltid vad som händer och varför, på ett språk man förstår. Professionellt, prestigelöst och alltid nära till hjälp när frågorna dyker upp.',
    name: 'Sara Aydin',
    company: 'Studio Form AB',
    initials: 'SF',
  },
]

const PARTNERS = ['Finova', 'Kontea', 'Ledgo', 'Numra', 'Saldia']

export function ZentumLayout({ tenant, content }: StorefrontLayoutProps) {
  const heroImg = content.heroImages[0] ?? ''
  const splitImg = content.aboutImage || content.heroImages[1] || heroImg
  const kort = content.galleryImages.slice(0, 6)

  return (
    <div className={styles.root}>
      {/* HERO */}
      <ZentumHeroShell>
        <div className={styles.heroBg}>
          {heroImg && <img src={heroImg} alt="" fetchPriority="high" />}
        </div>
        <div className={styles.heroShade} />
        <div className={styles.heroTopShade} />
        <div className={styles.heroContent}>
          <span className={`${styles.heroEyebrow} ${styles.heroLayer}`}>
            {content.heroEyebrow} {tenant.name}
          </span>
          <h1 className={`${styles.heroTitle} ${styles.heroLayer}`}>{content.heroTitle}</h1>
          <p className={`${styles.heroText} ${styles.heroLayer}`}>{content.heroLede}</p>
          <div className={`${styles.heroCta} ${styles.heroLayer}`}>
            <a href="/kontakt" className={styles.btn}>
              Kontakta oss
              <span className={styles.btnArrow} style={{ display: 'inline-block', width: 12, height: 12 }}>
                {PILAR}
              </span>
            </a>
          </div>
        </div>
      </ZentumHeroShell>

      {/* SEKTION 1 — intro-statement (Merriweather 26px) */}
      <section className={styles.secIntro}>
        <ZentumReveal as="p" className={styles.introStatement}>
          {content.italic}
        </ZentumReveal>
      </section>

      {/* SEKTION 2 — Våra tjänster: 6 kort, 3 kolumner */}
      <section className={styles.secServices}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <ZentumHeading text={content.servicesTitle} />
            <ZentumReveal as="p" className={styles.sectionDesc}>
              Från löpande bokföring till bokslut, deklarationer och strategisk rådgivning — vi
              stöttar bolag i alla skeden, oavsett om du söker en långsiktig partner eller hjälp
              med en avgränsad insats.
            </ZentumReveal>
          </div>
          <div className={styles.servicesGrid}>
            {TJANSTER.map((namn, i) => (
              <ZentumReveal key={namn} as="article" className={styles.serviceCard}>
                <div className={styles.serviceMedia}>
                  {kort[i] && <img src={kort[i]} alt={namn} loading="lazy" />}
                  <span className={styles.serviceArrow}>{PILAR}</span>
                </div>
                <h3 className={styles.serviceTitle}>
                  <a href="/tjanster">{namn}</a>
                </h3>
              </ZentumReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SEKTION 3 — full-bleed split på navy */}
      <section className={styles.secSplit}>
        <div
          className={styles.splitMedia}
          style={{ backgroundImage: `url(${splitImg})` }}
          role="img"
          aria-label="Rådgivningsmöte"
        />
        <div className={styles.splitBody}>
          <div className={styles.splitBodyInner}>
            <ZentumHeading text={content.aboutTitle} className={styles.splitTitle} />
            <ZentumReveal as="p" className={styles.splitLead}>
              {content.aboutCopy}
            </ZentumReveal>
            <div className={styles.splitSpacer} />
            <ZentumReveal className={`${styles.ihbox} ${styles.ihboxFirst}`}>
              <span className={styles.ihboxIcon} aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <path d="M8 6h24a4 4 0 0 1 4 4v32H12a4 4 0 0 1-4-4V6zM36 14h4v24a4 4 0 0 1-4 4M14 14h14M14 21h14M14 28h9" />
                </svg>
              </span>
              <div>
                <h3 className={styles.ihboxTitle}>Löpande bokföring</h3>
                <p className={styles.ihboxDesc}>
                  Din redovisning skött i tid, varje månad — med helt digitala flöden.
                </p>
              </div>
            </ZentumReveal>
            <ZentumReveal className={styles.ihbox}>
              <span className={styles.ihboxIcon} aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <path d="M6 40h36M10 34l8-10 7 6 12-16M31 14h6v6" />
                </svg>
              </span>
              <div>
                <h3 className={styles.ihboxTitle}>Rådgivning</h3>
                <p className={styles.ihboxDesc}>
                  Bolla stort som smått med oss — vi finns nära, oavsett vilken fas ditt bolag är i.
                </p>
              </div>
            </ZentumReveal>
          </div>
        </div>
      </section>

      {/* SEKTION 4 — Referenser: rubrik vänster (25 %), slider höger (75 %) */}
      <section className={styles.secTestimonials}>
        <div className={styles.container}>
          <div className={styles.testiRow}>
            <div className={styles.testiHead}>
              <ZentumReveal as="h4" className={styles.eyebrow}>
                Referenser
              </ZentumReveal>
              <ZentumHeading text={content.teamTitle} />
            </div>
            <ZentumTestimonials items={REFERENSER} />
          </div>
        </div>
      </section>

      {/* SEKTION 5 — partner-logotyper */}
      <section className={styles.secLogos}>
        <div className={styles.container}>
          <ZentumLogos items={PARTNERS} />
        </div>
      </section>
    </div>
  )
}
