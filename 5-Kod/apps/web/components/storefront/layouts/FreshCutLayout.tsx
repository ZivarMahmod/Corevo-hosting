import { HeroCarousel } from '../HeroCarousel'
import { Reveal } from '../Reveal'
import { Gallery } from '../Gallery'
import { BookCta } from '@/components/brand/BookCta'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'
import fc from './freshcut.module.css'

/**
 * FRESHCUT — an EXACT copy of freshcut.se (barbershop, Linköping), rebuilt on the live
 * theme path so it wires to the real booking module (the source site's "BOKA TID" went
 * to wavy.nu; here every CTA opens the in-page Corevo booking drawer via <BookCta>).
 *
 * Shape (mirrors the source home): full-bleed dark hero with the wordmark bottom-left →
 * "Mer än bara en frisörsalong" text + 4-photo gallery → "Varför Oss?" text + closing
 * CTA. The chrome (nav + the 3-col footer with real contact/address) is the public
 * layout's FooterFull. Swappable content — hero/gallery photos, colours, phone/address —
 * comes from tenant_settings (content fields + location); sektionstexterna nedan är källsajtens
 * fasta prosa som DEFAULT — ägaren kan skriva över dem via settings.copy
 * (homeSecondTitle/whyTitle/whySub/whyBody, redigeras i Sida-flikens Hem).
 *
 * goal-60 — VIRUSET BOTAT, FORMEN ORÖRD. ⚠️ RIKTIG KUND, LIVE. De 8 inline `style={{}}`
 * är flyttade till freshcut.module.css med ORDAGRANT samma värden — samma px, samma hex,
 * samma clamp. Inget har "förbättrats" på vägen. Mallens röst-tokens (knapp, fält, chip,
 * fokus, danger) bor i packages/ui/tokens.css under [data-theme="freshcut"]: de ger form
 * åt de ytor som saknade den helt (köpknapp, formulärfält) och rör ingen befintlig yta.
 * Det som SER ut som en bugg är rapporterat, inte fixat — se rapporten.
 */
const SEC1_TITLE = 'Mer än bara en frisörsalong.'
const SEC2_TITLE = 'Varför Oss?'
const SEC2_SUB = 'Välj den bästa. Såklart.'
const SEC2_BODY =
  'Fresh Cut är en utmärkt val för herrklippning av flera anledningar. För det första är våra frisörer mycket erfarna och kunniga när det gäller att klippa herrhår, vilket garanterar en hög kvalitet på klippningen. För det andra använder Fresh Cut endast de bästa produkterna för att se till att varje klippning resulterar i ett snyggt och välvårdat hår. Slutligen har Fresh Cut en avslappnad och trevlig atmosfär, vilket gör det till en bekväm och avkopplande plats att besöka för en klippning.'

export function FreshCutLayout({ content }: StorefrontLayoutProps) {
  return (
    <>
      {/* HERO — full-bleed dark photo, wordmark + tagline bottom-left. No hero CTA:
          the source keeps "BOKA TID" in the nav (that CTA is the shared Nav's BookCta). */}
      <section className={`hero ${styles.heroSection}`} aria-label="Välkommen">
        <HeroCarousel images={content.heroImages.map((src) => ({ src, alt: '' }))} align="left">
          <h1 className={styles.heroTitle}>{content.heroTitle}</h1>
          <p className={styles.heroLead}>{content.heroLede}</p>
        </HeroCarousel>
      </section>

      {/* "Mer än bara en frisörsalong." — centered editorial + 4-photo gallery */}
      <section className={styles.sfServices}>
        <div className={`${styles.sfNarrow} ${fc.introWrap}`}>
          <Reveal>
            <h2 className="sf-h1">{content.homeSecondTitle ?? SEC1_TITLE}</h2>
            <p className={`sf-eyebrow ${fc.introEyebrow}`}>{content.aboutTitle}</p>
            <p className={`sf-body ${fc.introBody}`}>{content.aboutCopyHome}</p>
          </Reveal>
        </div>
        <div className={`${styles.sfWide} ${fc.galleryWrap}`}>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* "Varför Oss?" — text + closing booking CTA */}
      <section className={styles.sfClosing}>
        <Reveal>
          <h2 className={`sf-h1 ${fc.closingTitle}`}>{content.whyTitle ?? SEC2_TITLE}</h2>
          <p className={`${styles.sfClosingLead} ${fc.closingLeadStrong}`}>
            {content.whySub ?? SEC2_SUB}
          </p>
          <p className={`${styles.sfClosingLead} ${fc.closingBody}`}>
            {content.whyBody ?? SEC2_BODY}
          </p>
          <div className={fc.closingActions}>
            <BookCta className={styles.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
