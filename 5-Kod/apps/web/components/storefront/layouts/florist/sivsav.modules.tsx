import { AddToCart } from '../../shop/AddToCart'
import { JoinClubForm } from '../../lojalitet/JoinClubForm'
import { formatProductPrice, shopCategoryChips } from '@/lib/storefront/shop/types'
import { formatPlanPrice, loyaltyIntervalLabel } from '@/lib/storefront/lojalitet/types'
import type {
  ThemeShopViewProps,
  ThemeBloggViewProps,
  ThemeGalleriViewProps,
  ThemeLojalitetViewProps,
} from './types'
import styles from './sivsav.module.css'

/**
 * SIV & SÄV — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   BUKETTERNA (butik) — filens `showButik`: eyebrow "Sortiment" + H1 "Buketterna", tre
 *   spalter, 4:5-foton med 24px-hörn, namn/pris på en rad, beskrivning, konturad pill
 *   "Lägg i korg". Inga skuggor.
 *
 *   JOURNALEN (blogg) — filens `showBlogg`: 900px-spalt, inläggen som vita 24px-kort med
 *   260px-bild till vänster och text till höger. Datum + tagg i spärrad salvia-versal.
 *
 * PAUSAD BUTIK: katalogen förblir läsbar men NOLL köpknappar renderas — en kund ska aldrig
 * kunna handla i en stängd butik.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ════════════════════════════════ BUKETTERNA ══════════════════════════════ */

export function SivSavShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  // Filens ord för det ofiltrerade urvalet är "Allt". Teasern har ingen filterrad i filen.
  const chips = teaser ? [] : shopCategoryChips(data, 'Allt')

  return (
    <section className={styles.ssShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.ssEyebrow}>{content.shopEyebrow ?? 'Sortiment'}</p>
      <h1 className={styles.ssPageTitle}>{content.shopTitle ?? 'Buketterna'}</h1>

      {/* KATEGORI-PILLS (goal-64, migration 0057) — filens rad 145-148: helrunda pills med
          1px kant, 14px/600. Vald = mörk platta. Kunden saknar kategorier → ingen rad. */}
      {chips.length > 0 ? (
        <div className={styles.ssFilters}>
          {chips.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={styles.ssFilter}
              data-active={c.active ? 'true' : undefined}
              aria-current={c.active ? 'page' : undefined}
            >
              {c.label}
            </a>
          ))}
        </div>
      ) : null}

      {paused ? (
        <p role="status" className={styles.ssNotice}>
          Butiken är tillfälligt stängd för nya beställningar. Sortimentet står kvar — vi
          öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.ssEmpty}>
          {data.activeCategory
            ? `Inget i ${data.activeCategory} just nu.`
            : 'Sortimentet visas snart.'}
        </p>
      ) : (
        <ul className={styles.ssShopGrid}>
          {products.map((p) => (
            <li key={p.id}>
              <a
                href={`/shop/${p.id}`}
                className={styles.ssProductImg}
                aria-label={`${p.name} — visa buketten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.ssSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.ssProductRow}>
                <h3 className={styles.ssShopName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </h3>
                {/* formatProductPrice → "fr. X kr" när produkten bär price_from. */}
                <span className={styles.ssProductPrice}>{formatProductPrice(p)}</span>
              </div>
              {p.description ? <p className={styles.ssShopDesc}>{p.description}</p> : null}
              {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} compact />}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.ssMore}>
          <a href={moreHref} className={styles.ssUnderline}>
            {content.shopCta ?? 'Hela sortimentet →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ JOURNALEN ══════════════════════════════ */

export function SivSavBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.ssBlogg} data-module="blogg">
      <p className={styles.ssEyebrow}>{content.blogEyebrow ?? 'Journalen'}</p>
      <h1 className={styles.ssPageTitle}>{content.blogTitle ?? 'Ord om blomster'}</h1>

      {posts.length === 0 ? (
        <p className={styles.ssEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.ssPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            const href = p.slug ? `/blogg/${p.slug}` : null
            return (
              <li key={p.id}>
                <article
                  className={p.coverImageUrl ? styles.ssPostCard : styles.ssPostCardText}
                >
                  {p.coverImageUrl ? (
                    <div
                      className={styles.ssPostImg}
                      style={{ backgroundImage: `url(${p.coverImageUrl})` }}
                      role="img"
                      aria-label={p.coverImageAlt ?? p.title}
                    />
                  ) : null}
                  <div className={styles.ssPostBody}>
                    {/* Filen: "{{ b.tag }} · {{ b.date }}" i spärrad salvia-versal. Taggen = blog_posts.tag. */}
                    {p.tag || date ? (
                      <p className={styles.ssPostMeta}>{[p.tag, date].filter(Boolean).join(' · ')}</p>
                    ) : null}
                    <h2 className={styles.ssPostTitle}>
                      {href ? <a href={href}>{p.title}</a> : p.title}
                    </h2>
                    {p.excerpt ? <p className={styles.ssPostExcerpt}>{p.excerpt}</p> : null}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.ssMore}>
          <a href={moreHref} className={styles.ssUnderline}>
            {content.blogCta ?? 'Alla inlägg →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ══════════════════════════════════ GALLERI ═══════════════════════════════ */

/**
 * Filens `showGalleri`: "Portfolio / Galleri" — två breda spalter, 4:3, och 24px radie
 * på varje bild. Skandinaviskt: inga ramar, inga bildtexter, bara bilderna.
 */
export function SivSavGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.ssGalleri} data-module="galleri">
      <p className={styles.ssGalEyebrow}>{content.galleryEyebrow ?? 'Portfolio'}</p>
      <h1 className={styles.ssGalTitle}>{content.galleryTitle ?? 'Galleri'}</h1>

      {items.length === 0 ? (
        <p className={styles.ssGalEmpty}>Inga bilder är publicerade ännu.</p>
      ) : (
        <div className={styles.ssGalGrid}>
          {items.map((g) =>
            g.imageUrl ? (
              <div
                key={g.id}
                className={styles.ssGalImg}
                role="img"
                aria-label={g.imageAlt ?? g.caption ?? ''}
                style={{
                  backgroundImage: `url(${g.imageUrl})`,
                  aspectRatio: g.aspectRatio ?? '4/3',
                }}
              />
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

/* ═══════════════════════════════ SÖNDAGSKLUBBEN ═══════════════════════════ */

/**
 * Filens `showKlubb`: Söndagsklubben är en PRENUMERATION — tre nivåkort (Litet · Mellan ·
 * Stort), pris i Fraunces 30px, intervallet under, och nivåns text i botten. Den vanligaste
 * nivån (`featured`) ligger på den gröna ytan. Anmälan i ett grönt fält med pillerknapp.
 *
 * Nivåerna kommer ur loyalty_plans (0057) — inte ur mallen. Har kunden inga nivåer ritar vi
 * INGA kort: en påhittad prisnivå är ett påhittat pris.
 *
 * Priset visas, det dras inte: CTA:n anmäler intresse (joinLoyaltyClub), betal-rälsen för
 * abonnemang byggs separat.
 */
export function SivSavLojalitet({ config, plans, content }: ThemeLojalitetViewProps) {
  return (
    <section className={styles.ssClub} data-module="lojalitet" data-variant={config.variant}>
      <p className={styles.ssGalEyebrow}>{content.clubEyebrow ?? 'Medlemskap'}</p>
      <h1 className={styles.ssGalTitle}>{content.clubTitle ?? 'Söndagsklubben'}</h1>
      <p className={styles.ssClubLede}>
        {content.clubLede ??
          'Färska blommor hem varje eller varannan vecka. Pausa när du vill, avsluta när du vill.'}
      </p>

      {plans.length > 0 ? (
        <div className={styles.ssPlans}>
          {plans.map((p) => (
            <div
              key={p.id}
              className={styles.ssPlan}
              data-featured={p.featured ? 'true' : undefined}
            >
              <p className={styles.ssPlanTag}>{p.name}</p>
              <p className={styles.ssPlanPrice}>{formatPlanPrice(p.priceCents)}</p>
              <p className={styles.ssPlanPer}>{loyaltyIntervalLabel(p.interval)}</p>
              {p.perks.length > 0 ? (
                <p className={styles.ssPlanDesc}>{p.perks.join(' · ')}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {plans.length === 0 && config.perks && config.perks.length > 0 ? (
        <div className={styles.ssPlans}>
          {config.perks.map((perk) => (
            <div key={perk} className={styles.ssPlan}>
              <p className={styles.ssPlanDesc}>{perk}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.ssClubJoin}>
        <JoinClubForm cta={content.clubCta ?? 'Starta prenumeration'} />
      </div>
    </section>
  )
}
