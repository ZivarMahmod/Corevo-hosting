import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import { formatBloggMonthYear } from '@/lib/storefront/blogg/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './eloria.module.css'

/**
 * ELORIA — KLASSISKT MAGASIN (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Eloria - Klassiskt Magasin.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) TEXTLÖST UPPSLAG  — två foton i förskjuten rytm (1.5fr/1fr, höger 80px nedskjutet).
 *                           Ingen rubrik, ingen lede: mallen öppnar UTAN ord, med avsikt.
 *   (2) CITAT-BLOCKET     — husets devis mellan två 64px-linjer, versal garamond.
 *   (3) TRE BILDBRICKOR   — Katalogen · Bröllop · Journalen, i passepartout-ram.
 *   (4) DEN MÖRKGRÖNA PLATTAN — guldram, bröllops-inbjudan, guld kontur-CTA → offerten.
 *   (5) KATALOG-UTDRAGET  — galleri med bildtexter (kvadratiska foton), INTE kort.
 *   (6) JOURNAL-UTDRAGET  — innehållsförteckning: datum · titel · "Läs →".
 *
 * Filen har varken galleri-band, presentkortsrad eller stat-band på hemmet — och då har
 * inte mallen det heller. Att lägga till en sektion "för att syskonen har en" ÄR att
 * improvisera bort mallen (se AGENTS.md:s UI-acceptansregel).
 *
 * Modul-gatingen är plattformens och HELIG: katalog-brickan och katalog-bandet ritas bara
 * när shopen går att nå, bröllops-plattan bara när offerten gör det, journal-bandet bara
 * när bloggen har publicerat. SYNKRON komponent (ingen async, ingen 'use client') —
 * onboarding-studions preview renderar samma komponent.
 */
export function EloriaLayout({ content, tenant, modules }: StorefrontLayoutProps) {
  // Filen visar TRE kompositioner på hemmet (`homeCatalog: catalog.slice(0, 3)`).
  const catalog = (modules?.shopTeasers ?? []).slice(0, 3)
  const posts = (modules?.bloggTeasers ?? []).slice(0, 3)
  // Saknad reachability failar stängt; onboarding-previewns modulytor renderas separat.
  const shopReachable = modules?.shopReachable ?? false
  const offertReachable = modules?.offertReachable ?? false
  const bloggReachable = (modules?.bloggTeasers.length ?? 0) > 0

  const spreadA = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const spreadB = content.heroImages[1] ?? content.galleryImages[1] ?? ''

  // Filens `tiles` — tre klickbara bildbrickor. Varje bricka bär sin modul och faller
  // bort med den; en avstängd modul får inte ha EN enda länk kvar.
  const tiles = [
    shopReachable
      ? {
          title: 'Katalogen',
          cta: 'Se kompositionerna',
          img: content.galleryImages[2] ?? spreadA,
          imageField: 'gallery_images.2',
          href: '/shop',
        }
      : null,
    offertReachable
      ? {
          title: 'Bröllop',
          cta: 'Er stora dag',
          img: content.galleryImages[0] ?? spreadA,
          imageField: 'gallery_images.0',
          href: '/offert',
        }
      : null,
    bloggReachable
      ? {
          title: 'Journalen',
          cta: 'Ord om blommor',
          img: content.galleryImages[5] ?? spreadB,
          imageField: 'gallery_images.5',
          href: '/blogg',
        }
      : null,
  ].filter((t): t is { title: string; cta: string; img: string; imageField: string; href: string } => t !== null)

  return (
    <div className={styles.elRoot}>
      {/* (1) TEXTLÖST UPPSLAG */}
      <section className={styles.elSpread}>
        <Reveal>
          <div className={styles.elSpreadA} style={{ backgroundImage: `url(${spreadA})` }} data-corevo-editor-field="hero_images.0" data-corevo-editor-stable-field="hero_images.0" />
        </Reveal>
        <Reveal delay={140}>
          <div className={styles.elSpreadB} style={{ backgroundImage: `url(${spreadB})` }} data-corevo-editor-field="hero_images.1" data-corevo-editor-stable-field="hero_images.1" />
        </Reveal>
      </section>

      {/* (2) CITAT-BLOCKET */}
      <section className={styles.elQuote}>
        <Reveal>
          <div className={styles.elQuoteRule} />
          <p className={styles.elQuoteText} data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">{content.italic}</p>
          <p className={styles.elQuoteBy}>— huset <span data-corevo-editor-field="tenant.name" data-corevo-editor-stable-field="tenant.name">{tenant.name}</span></p>
          <div className={styles.elQuoteRuleEnd} />
        </Reveal>
      </section>

      {/* (3) TRE BILDBRICKOR */}
      {tiles.length > 0 ? (
        <section className={styles.elTiles}>
          {tiles.map((t, i) => (
            <Reveal key={t.href} delay={i * 90}>
              <Link href={t.href} className={styles.elTile}>
                <span className={styles.elTileFrame}>
                  <span
                    className={styles.elTileImg}
                    style={t.img ? { backgroundImage: `url(${t.img})` } : undefined}
                    data-corevo-editor-field={t.imageField}
                    data-corevo-editor-stable-field={t.imageField}
                  />
                </span>
                <span className={styles.elTileTitle}>{t.title}</span>
                <span className={styles.elTileCta}>{t.cta}</span>
              </Link>
            </Reveal>
          ))}
        </section>
      ) : null}

      {/* (4) DEN MÖRKGRÖNA PLATTAN MED GULDRAM — vägen in i offerten */}
      {offertReachable ? (
        <section className={styles.elPlateWrap}>
          <Reveal>
            <div className={styles.elPlate}>
              <div className={styles.elPlateInner}>
                <p className={styles.elPlateEyebrow}>
                  <span data-corevo-editor-field="closingEyebrow" data-corevo-editor-stable-field="closingEyebrow">{content.closingEyebrow ?? 'Livets stora stunder'}</span>
                </p>
                <h2 className={styles.elPlateTitle}>
                  <span data-corevo-editor-field="pillar1Title" data-corevo-editor-stable-field="pillar1Title">{content.pillar1Title ?? 'Blommor för bröllop, fest och avsked'}</span>
                </h2>
                <p className={styles.elPlateLede}>
                  <span data-corevo-editor-field="pillar1Body" data-corevo-editor-stable-field="pillar1Body">{content.pillar1Body ??
                    'Varje arrangemang komponeras personligen, efter samtal med er. Vi tar emot ett begränsat antal uppdrag per helg — förfrågan kostar ingenting.'}</span>
                </p>
                <Link href="/offert" className={styles.elPlateCta}>
                  Läs om bröllop
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      ) : null}

      {/* (5) KATALOG-UTDRAGET — galleri med bildtexter */}
      {catalog.length > 0 ? (
        <section className={styles.elBand}>
          <Reveal>
            <p className={styles.elBandEyebrow} data-corevo-editor-field="shopEyebrow" data-corevo-editor-stable-field="shopEyebrow">{content.shopEyebrow ?? 'Ur katalogen'}</p>
            <h2 className={styles.elBandTitle}>
              <span data-corevo-editor-field="shopTitle" data-corevo-editor-stable-field="shopTitle">{content.shopTitle ?? 'Säsongens kompositioner'}</span>
            </h2>
          </Reveal>
          <ul className={styles.elHomeCatalog}>
            {catalog.map((p, i) => (
              <li key={p.id}>
                <Reveal delay={i * 90}>
                  <Link href={`/shop/${p.id}`} className={styles.elHomeCatalogItem}>
                    <span
                      className={styles.elHomeCatalogImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    >
                      <span className="sr-only">{p.imageAlt ?? p.name}</span>
                    </span>
                    <span className={styles.elHomeCatalogName}>{p.name}</span>
                    <span className={styles.elHair} />
                    <span className={styles.elHomeCatalogPrice}>
                      {formatProductPrice(p)}
                    </span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className={styles.elBandFoot}>
            <Link href="/shop" className={styles.elBtnLine}>
              <span data-corevo-editor-field="shopCta" data-corevo-editor-stable-field="shopCta">{content.shopCta ?? 'Se hela katalogen'}</span>
            </Link>
          </p>
        </section>
      ) : null}

      {/* (6) JOURNAL-UTDRAGET — innehållsförteckningens rader */}
      {posts.length > 0 ? (
        <section className={styles.elJournalBand}>
          <Reveal>
            <p className={styles.elBandEyebrow} data-corevo-editor-field="blogEyebrow" data-corevo-editor-stable-field="blogEyebrow">{content.blogEyebrow ?? 'Journalen'}</p>
            <h2 className={styles.elJournalBandTitle} data-corevo-editor-field="blogTitle" data-corevo-editor-stable-field="blogTitle">{content.blogTitle ?? 'Ord om blommor'}</h2>
          </Reveal>
          <ul className={styles.elJournalList}>
            {posts.map((p, i) => (
              <li key={p.id}>
                <Reveal delay={i * 70}>
                  <Link
                    href={p.slug ? `/blogg/${p.slug}` : '/blogg'}
                    className={styles.elJournalRow}
                  >
                    <span className={styles.elJournalDate}>{formatBloggMonthYear(p.publishedAt)}</span>
                    <span className={styles.elJournalTitle}>{p.title}</span>
                    <span className={styles.elJournalMore}>Läs →</span>
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
