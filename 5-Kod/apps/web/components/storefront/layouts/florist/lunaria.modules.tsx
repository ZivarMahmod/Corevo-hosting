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
import styles from './lunaria.module.css'

/**
 * LUNARIA — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   BLOMSTERBODEN (butik) — filens `showButik`: centrerad eyebrow ("Kollektion VII") + 52px
 *   Poiret One-rubrik, sedan TRE kolumner med inramade kort (silverram som guldnar vid
 *   hover), 4:5-bild, namn i display, beskrivning i tunn grotesk, pris i guld och den
 *   INRAMADE guldknappen. Inga skuggor, inga rundade hörn.
 *
 *   KRÖNIKAN (blogg) — filens `showBlogg`: en 900px-spalt med inlägg under varandra,
 *   240px-bild i 4:3 till vänster och texten till höger, allt i en silverram som guldnar.
 *
 * PAUSAD BUTIK: katalogen är läsbar, men NOLL köpknappar (annars kan en kund handla i en
 * stängd butik). SYNKRONA server-komponenter — ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ════════════════════════════════ BLOMSTERBODEN ════════════════════════════════ */

export function LunariaShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  // Filens ord för det ofiltrerade urvalet är "Allt". Teasern har ingen filterrad i filen.
  const chips = teaser ? [] : shopCategoryChips(data, 'Allt')

  return (
    <section className={styles.lnShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.lnPageEyebrow}>{content.shopEyebrow ?? 'Kollektion VII'}</p>
      <h1 className={styles.lnPageTitle}>{content.shopTitle ?? 'Blomsterboden'}</h1>

      {/* KATEGORI-CHIPS (goal-64, migration 0057) — filens rad 149-152: centrerad rad,
          rätvinkliga chips med GULDKANT alltid (även ovald), 11.5px versal med 0.16em spärr.
          Vald = guldplatta med nattblå text. Kunden saknar kategorier → ingen rad. */}
      {chips.length > 0 ? (
        <div className={styles.lnFilters}>
          {chips.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={styles.lnFilter}
              data-active={c.active ? 'true' : undefined}
              aria-current={c.active ? 'page' : undefined}
            >
              {c.label}
            </a>
          ))}
        </div>
      ) : null}

      {paused ? (
        <p role="status" className={styles.lnNotice}>
          Butiken tar för närvarande inte emot nya beställningar. Vi öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.lnEmpty}>
          {data.activeCategory
            ? `Inget i ${data.activeCategory} just nu.`
            : 'Blomsterboden är tom just nu.'}
        </p>
      ) : (
        <ul className={styles.lnGrid3}>
          {products.map((p) => (
            <li key={p.id}>
              <div className={styles.lnCard}>
                <a
                  href={`/shop/${p.id}`}
                  className={styles.lnCardImg}
                  aria-label={`${p.name} — visa verket`}
                  style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                >
                  <span className={styles.lnSrOnly}>{p.imageAlt ?? p.name}</span>
                </a>
                <div className={styles.lnCardBody}>
                  <h3 className={styles.lnCardName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  {p.description ? <p className={styles.lnCardDesc}>{p.description}</p> : null}
                  {/* formatProductPrice → "fr. X kr" när produkten bär price_from. */}
                  <p className={styles.lnCardPrice}>{formatProductPrice(p)}</p>
                  {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} compact />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.lnMore}>
          <a href={moreHref} className={styles.lnUnderline}>
            {content.shopCta ?? 'Hela samlingen →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ════════════════════════════════ KRÖNIKAN ════════════════════════════════ */

export function LunariaBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.lnBlogg} data-module="blogg">
      <h1 className={styles.lnPageTitle}>{content.blogTitle ?? 'Krönikan'}</h1>

      {posts.length === 0 ? (
        <p className={styles.lnEmpty}>Inga krönikor är publicerade ännu.</p>
      ) : (
        <ul className={styles.lnPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a className={styles.lnPost} href={p.slug ? `/blogg/${p.slug}` : '/blogg'}>
                  <span
                    className={styles.lnPostImg}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  >
                    <span className={styles.lnSrOnly}>{p.coverImageAlt ?? p.title}</span>
                  </span>
                  <span className={styles.lnPostBody}>
                    {/* Filen: "{{ b.tag }} · {{ b.date }}" i guld versal. Taggen = blog_posts.tag. */}
                    {p.tag || date ? (
                      <span className={styles.lnPostMeta}>
                        {[p.tag, date].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                    <span className={styles.lnPostTitle}>{p.title}</span>
                    {p.excerpt ? <span className={styles.lnPostExcerpt}>{p.excerpt}</span> : null}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.lnMore}>
          <a href={moreHref} className={styles.lnUnderline}>
            {content.blogCta ?? 'Hela krönikan →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ GALLERIET ══════════════════════════════ */

/**
 * Filens `showGalleri`: tre spalter, och varje bild sitter i en GULDRAM med 8px luft —
 * deco-passepartouten. Rubriken är centrerad Poiret One 52px med 0.08em spärr.
 */
export function LunariaGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.lnGalleri} data-module="galleri">
      <h1 className={styles.lnGalTitle}>{content.galleryTitle ?? 'Galleriet'}</h1>

      {items.length === 0 ? (
        <p className={styles.lnGalEmpty}>Inga bilder är publicerade ännu.</p>
      ) : (
        <div className={styles.lnGalGrid}>
          {items.map((g) =>
            g.imageUrl ? (
              <div key={g.id} className={styles.lnGalFrame}>
                <div
                  className={styles.lnGalImg}
                  role="img"
                  aria-label={g.imageAlt ?? g.caption ?? ''}
                  style={{
                    backgroundImage: `url(${g.imageUrl})`,
                    aspectRatio: g.aspectRatio ?? '4/5',
                  }}
                />
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

/* ══════════════════════════════════ CIRKELN ═══════════════════════════════ */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const

/**
 * Filens `showKlubb`: medlemskortet i guldram (kort-i-kort), förmånerna numrerade med
 * ROMERSKA siffror i tre rutor, och anmälan i en enkel ram. Deco hela vägen.
 *
 * AVVIKELSE (medveten): designens kort trycker "MEDLEM № 0212". Vi har inget medlemsnummer
 * för en besökare som ännu inte gått med — så raden utelämnas hellre än fylls med ett
 * påhittat nummer. "ERT NAMN" står kvar: det ÄR designens tomma fält, inte en påhittad person.
 * Förmånerna kommer ur klubbens config; inga förmåner → inga rutor.
 */
export function LunariaLojalitet({
  config,
  plans,
  content,
  tenantName,
}: ThemeLojalitetViewProps) {
  const perks = config.perks ?? []

  return (
    <section className={styles.lnClub} data-module="lojalitet" data-variant={config.variant}>
      <h1 className={styles.lnGalTitle}>{content.clubTitle ?? 'Cirkeln'}</h1>
      <p className={styles.lnClubLede}>
        {content.clubLede ??
          'Lunarias inre krets. Kostnadsfritt medlemskap med förtur, förmåner och butikens privata kvällar.'}
      </p>

      <div className={styles.lnCardOuter}>
        <div className={styles.lnCardInner}>
          <div className={styles.lnCardTop}>
            <p className={styles.lnCardWordmark}>{tenantName}</p>
          </div>
          <p className={styles.lnCardLabel}>Innehavare</p>
          <p className={styles.lnCardName}>ERT NAMN</p>
        </div>
      </div>

      {perks.length > 0 ? (
        <div className={styles.lnPerks}>
          {perks.map((perk, i) => (
            <div key={perk} className={styles.lnPerk}>
              <p className={styles.lnPerkNo}>{ROMAN[i] ?? String(i + 1)}</p>
              <p className={styles.lnPerkText}>{perk}</p>
            </div>
          ))}
        </div>
      ) : null}

      {plans.length > 0 ? (
        <div className={styles.lnPerks}>
          {plans.map((p) => (
            <div key={p.id} className={styles.lnPerk} data-featured={p.featured ? 'true' : undefined}>
              <p className={styles.lnPerkNo}>{p.name}</p>
              <p className={styles.lnPerkText}>
                {formatPlanPrice(p.priceCents)} {loyaltyIntervalLabel(p.interval)}
                {p.perks.length > 0 ? ` · ${p.perks.join(' · ')}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.lnClubJoin}>
        <JoinClubForm cta={content.clubCta ?? 'Ansök om medlemskap'} />
      </div>
    </section>
  )
}
