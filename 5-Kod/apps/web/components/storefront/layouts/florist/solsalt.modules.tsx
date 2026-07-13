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
import styles from './solsalt.module.css'

/**
 * SOL & SALT — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart> och priset formateras alltid av formatProductPrice. Formen är mallens, exakt som
 * .dc.html ritar den:
 *
 *   BODEN (butik) — filens `showButik`: eyebrow "Sortiment" + H1 "Boden", sedan TRE kolumner
 *   med papperskort (24px radie, 2px solid "skugga" i #EADDBB), 1:1-bild, namn i DM Serif mot
 *   terrakotta-pris, och en kobolt fullbredds-pill som blir terrakotta vid hover.
 *   Filens kategori-pills (Allt/Buketter/Krukväxter/Enkla) ÄR nu byggda (goal-64, migration
 *   0057): shop_products.category finns, pillren är <Link>-taggar mot /shop?kategori=… och
 *   filtreringen sker server-side. Orden är KUNDENS kategorier, inte filens mockade — har
 *   kunden inga renderas ingen rad (hellre ingen rad än döda knappar, samma regel som förr).
 *
 *   FRÅN BODEN (blogg) — filens `showBlogg`: en 900px-spalt, inläggen som liggande papperskort
 *   med 250px-foto i 4:3 till vänster och "TAGG · DATUM" i terrakotta över rubriken.
 *
 * `paused` respekteras: katalogen förblir läsbar, men NOLL köpknappar ritas.
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ═════════════════════════════════ BODEN ══════════════════════════════════ */

export function SolSaltShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  // Filens ord för det ofiltrerade urvalet är "Allt". Teasern har ingen filterrad i filen.
  const chips = teaser ? [] : shopCategoryChips(data, 'Allt')

  return (
    <section className={styles.slShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.slEyebrow}>{content.shopEyebrow ?? 'Sortiment'}</p>
      <h1 className={styles.slPageTitle}>{content.shopTitle ?? 'Boden'}</h1>

      {/* KATEGORI-PILLREN — filens rad 147-150: helrunda (999px) pills, 14px/600, ingen kant.
          Vald = kobolt platta med sandvit text. */}
      {chips.length > 0 ? (
        <div className={styles.slFilters}>
          {chips.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={styles.slFilter}
              data-active={c.active ? 'true' : undefined}
              aria-current={c.active ? 'page' : undefined}
            >
              {c.label}
            </a>
          ))}
        </div>
      ) : null}

      {paused ? (
        <p role="status" className={styles.slNotice}>
          Boden är tillfälligt stängd för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.slEmpty}>
          {data.activeCategory
            ? `Inget i ${data.activeCategory} just nu.`
            : 'Boden är tom just nu.'}
        </p>
      ) : (
        <ul className={styles.slGrid3}>
          {products.map((p) => (
            <li key={p.id} className={styles.slCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.slCardImg}
                aria-label={`${p.name} — visa varan`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.slSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.slCardBody}>
                <div className={styles.slCardHead}>
                  <h3 className={styles.slCardName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  {/* formatProductPrice → "fr. X kr" när produkten bär price_from. */}
                  <span className={styles.slCardPrice}>{formatProductPrice(p)}</span>
                </div>
                {p.description ? <p className={styles.slCardDesc}>{p.description}</p> : null}
                {/* Pausad butik → katalogen läsbar, NOLL köpknappar. */}
                {paused ? null : (
                  <div className={styles.slCardBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} compact />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={`${styles.slLink} ${styles.slMore}`}>
          {content.shopCta ?? 'Hela sortimentet →'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════ FRÅN BODEN ═══════════════════════════════ */

export function SolSaltBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.slBlogg} data-module="blogg">
      <h1 className={styles.slPageTitle}>{content.blogTitle ?? 'Från boden'}</h1>

      {posts.length === 0 ? (
        <p className={styles.slEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.slPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            const href = p.slug ? `/blogg/${p.slug}` : null
            return (
              <li key={p.id}>
                <article className={styles.slPostRow}>
                  <div
                    className={styles.slPostImg}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                    role={p.coverImageUrl ? 'img' : undefined}
                    aria-label={p.coverImageUrl ? (p.coverImageAlt ?? p.title) : undefined}
                  />
                  <div className={styles.slPostBody}>
                    {/* Filen: "TAGG · DATUM" i terrakotta över rubriken. Taggen = blog_posts.tag. */}
                    {p.tag || date ? (
                      <p className={styles.slPostMeta}>{[p.tag, date].filter(Boolean).join(' · ')}</p>
                    ) : null}
                    <h2 className={styles.slPostTitle}>
                      {href ? <a href={href}>{p.title}</a> : p.title}
                    </h2>
                    {p.excerpt ? <p className={styles.slPostExcerpt}>{p.excerpt}</p> : null}
                    {href ? (
                      <a href={href} className={styles.slLink}>
                        Läs vidare →
                      </a>
                    ) : null}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={`${styles.slLink} ${styles.slMore}`}>
          {content.blogCta ?? 'Läs allt från boden →'}
        </a>
      ) : null}
    </section>
  )
}

/* ══════════════════════════════════ GALLERI ═══════════════════════════════ */

/**
 * Filens `showGalleri`: tre spalter, 20px radie, kvadrater. Medelhavet behöver ingen ram.
 */
export function SolSaltGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.slGalleri} data-module="galleri">
      <h1 className={styles.slGalTitle}>{content.galleryTitle ?? 'Galleri'}</h1>

      {items.length === 0 ? (
        <p className={styles.slGalEmpty}>Inga bilder är publicerade ännu.</p>
      ) : (
        <div className={styles.slGalGrid}>
          {items.map((g) =>
            g.imageUrl ? (
              <div
                key={g.id}
                className={styles.slGalImg}
                role="img"
                aria-label={g.imageAlt ?? g.caption ?? ''}
                style={{
                  backgroundImage: `url(${g.imageUrl})`,
                  aspectRatio: g.aspectRatio ?? '1/1',
                }}
              />
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

/* ════════════════════════════════ SOLKLUBBEN ══════════════════════════════ */

/**
 * Filens `showKlubb`: SOLKORTET — en blå platta med 28px radie, solgula stämplar (☀) och
 * en rad under. Anmälan i den varmvita rutan.
 *
 * ÄRLIGHET FÖRE MOCK: designens kort visar "5 / 10" ifyllda solar. Vi vet inte vem som
 * tittar (ingen inloggad medlem i publika vyn), så vi ritar kortets TOMMA rutor —
 * config.stampGoal stycken — och påstår ingen progress. Solgult (#F2C349) och den
 * genomskinliga tomrutan är filens egna hex, de finns inte i palettens åtta nycklar.
 */
export function SolSaltLojalitet({ config, plans, content }: ThemeLojalitetViewProps) {
  const stamps = config.variant === 'stamp_card' ? Array.from({ length: config.stampGoal }) : []

  return (
    <section className={styles.slClub} data-module="lojalitet" data-variant={config.variant}>
      <h1 className={styles.slGalTitle}>{content.clubTitle ?? 'Solklubben'}</h1>
      <p className={styles.slClubLede}>{content.clubLede ?? config.perkText}</p>

      {stamps.length > 0 ? (
        <div className={styles.slSunCard}>
          <div className={styles.slSunTop}>
            <p className={styles.slSunTitle}>Ditt solkort</p>
          </div>
          <div className={styles.slSunRow}>
            {stamps.map((_, i) => (
              <span key={i} className={styles.slStamp}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {config.perks && config.perks.length > 0 ? (
        <ul className={styles.slPerks}>
          {config.perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
      ) : null}

      {plans.length > 0 ? (
        <ul className={styles.slPerks}>
          {plans.map((p) => (
            <li key={p.id} data-featured={p.featured ? 'true' : undefined}>
              <strong>{p.name}</strong> — {formatPlanPrice(p.priceCents)}{' '}
              {loyaltyIntervalLabel(p.interval)}
              {p.perks.length > 0 ? ` · ${p.perks.join(' · ')}` : ''}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.slClubJoin}>
        <JoinClubForm cta={content.clubCta ?? 'Gå med gratis'} />
      </div>
    </section>
  )
}
