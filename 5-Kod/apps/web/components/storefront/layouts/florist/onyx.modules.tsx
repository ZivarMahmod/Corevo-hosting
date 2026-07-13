import { AddToCart } from '../../shop/AddToCart'
import { JoinClubForm } from '../../lojalitet/JoinClubForm'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import { formatPlanPrice, loyaltyIntervalLabel } from '@/lib/storefront/lojalitet/types'
import type {
  ThemeShopViewProps,
  ThemeBloggViewProps,
  ThemeGalleriViewProps,
  ThemeLojalitetViewProps,
} from './types'
import styles from './onyx.module.css'

/**
 * ONYX — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   BUTIKEN (`showButik`) — "DROP 27 — VECKA 28" över "Butiken", tre kolumner i
 *   hårlinje-rastret (1px gap på #2E2E2E), kvadratiska bilder, "+ LÄGG I KASSE" som
 *   mässings-outline. Inga kort, inga skuggor, inga rundade hörn.
 *   ETIKETTEN i bildens övre vänstra hörn (filens `{{ p.tag }}`: "DROP 27", "FÅ KVAR",
 *   "NY SORT") stod tidigare som "mockdata utan fält" — FEL numera: shop_products.badge finns
 *   sedan migration 0057. Den renderas nu, och bara när produkten faktiskt bär den.
 *
 *   JOURNAL (`showBlogg`) — "Från studion": rader med datum + etikett i en 180px-spalt
 *   till vänster och rubrik + ingress till höger, hårlinje mellan raderna.
 *
 * PAUSAD BUTIK är HELIGT: katalogen förblir läsbar, men NOLL köpknappar renderas.
 * SYNKRONA server-komponenter — ingen async, ingen 'use client'.
 */

/* ═════════════════════════════════ BUTIKEN ════════════════════════════════ */

export function OnyxShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.onShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.onEyebrow}>{content.shopEyebrow ?? 'DROP 27 — VECKA 28'}</p>
      <h1 className={styles.onPageTitleTight}>{content.shopTitle ?? 'Butiken'}</h1>
      <p className={styles.onPageLede}>
        Begränsade antal per vecka. När droppet är slut är det slut — nästa måndag kommer nya
        sorter.
      </p>

      {paused ? (
        <p role="status" className={styles.onNotice}>
          [ STÄNGT ] BUTIKEN TAR EMOT INGA NYA BESTÄLLNINGAR JUST NU.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.onEmpty}>[ TOMT ] DROPPET ÄR SLUT.</p>
      ) : (
        <ul className={styles.onGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.onCard}>
              <div className={styles.onCardMedia}>
                <a
                  href={`/shop/${p.id}`}
                  className={styles.onCardImg}
                  aria-label={`${p.name} — visa produkten`}
                  style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                >
                  <span className={styles.onSrOnly}>{p.imageAlt ?? p.name}</span>
                </a>
                {/* Filens etikett i bildhörnet — render-on-present: ingen badge → ingen ruta. */}
                {p.badge ? <span className={styles.onCardTag}>{p.badge}</span> : null}
              </div>
              <div className={styles.onCardRow}>
                <h3 className={styles.onCardName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </h3>
                {/* formatProductPrice → "fr. X kr" när produkten bär price_from. */}
                <span className={styles.onCardPrice}>{formatProductPrice(p)}</span>
              </div>
              {p.description ? <p className={styles.onCardDesc}>{p.description}</p> : null}
              {/* Pausad butik → NOLL köpknappar. Katalogen är fortfarande läsbar. */}
              {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} compact />}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.onMoreRow}>
          <a href={moreHref} className={styles.onLink}>
            {content.shopCta ?? 'SE ALLT →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ JOURNAL ════════════════════════════════ */

export function OnyxBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.onBlogg} data-module="blogg">
      <p className={styles.onEyebrow}>{content.blogEyebrow ?? 'JOURNAL'}</p>
      <h1 className={styles.onPageTitle}>{content.blogTitle ?? 'Från studion'}</h1>

      {posts.length === 0 ? (
        <p className={styles.onEmpty}>[ TOMT ] INGA INLÄGG ÄR PUBLICERADE ÄNNU.</p>
      ) : (
        <ul className={styles.onPostList}>
          {posts.map((p) => (
            <li key={p.id} className={styles.onPost}>
              <div>
                {p.publishedAt ? (
                  <p className={styles.onPostDate}>{p.publishedAt.slice(0, 10)}</p>
                ) : null}
                {/* Filens rad 369: etiketten UNDER datumet i 180px-spalten, dämpad mono-versal.
                    Taggen = blog_posts.tag (0057). Ingen tagg → ingen rad. */}
                {p.tag ? <p className={styles.onPostTag}>{p.tag}</p> : null}
              </div>
              <div>
                <h2 className={styles.onPostTitle}>
                  {p.slug ? <a href={`/blogg/${p.slug}`}>{p.title}</a> : p.title}
                </h2>
                {p.excerpt ? <p className={styles.onPostExcerpt}>{p.excerpt}</p> : null}
                {p.slug ? (
                  <a href={`/blogg/${p.slug}`} className={styles.onLink}>
                    LÄS →
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.onMoreRow}>
          <a href={moreHref} className={styles.onLink}>
            {content.blogCta ?? 'ALLA INLÄGG →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ══════════════════════════════════ ARKIV ═════════════════════════════════ */

/**
 * Filens `showGalleri`: kontaktkarta. Tre spalter med 1px SPRINGA (rutnätets bakgrund ÄR
 * linjefärgen), 4:5-bilder, och figurnumret som en mono-etikett nedtill till vänster på
 * bilden — "FIG. 01 — MAGNOLIA NOIR". Etiketten ligger i `tag` (galleri-kontraktet).
 */
export function OnyxGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.onGalleri} data-module="galleri">
      <p className={styles.onGalEyebrow}>{content.galleryEyebrow ?? 'ARKIV'}</p>
      <h1 className={styles.onGalTitle}>{content.galleryTitle ?? 'Galleri'}</h1>

      {items.length === 0 ? (
        <p className={styles.onGalEmpty}>Inga bilder är publicerade ännu.</p>
      ) : (
        <div className={styles.onGalGrid}>
          {items.map((g) => (
            <div key={g.id} className={styles.onGalCell}>
              {g.imageUrl ? (
                <div
                  className={styles.onGalImg}
                  role="img"
                  aria-label={g.imageAlt ?? g.caption ?? ''}
                  style={{ backgroundImage: `url(${g.imageUrl})` }}
                />
              ) : null}
              {g.tag ? <span className={styles.onGalFig}>{g.tag}</span> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ═════════════════════════════════ KRETSEN ════════════════════════════════ */

/**
 * Filens `showKrets`: medlemskortet i guldram på #1C1C1C, förmånerna i ett tre-rutors
 * rutnät med samma 1px-springa som arkivet, och anmälan som en rad: fält + guldknapp.
 *
 * AVVIKELSE (medveten): designens kort trycker "NO. 0847". Vi har inget medlemsnummer för
 * en besökare som inte gått med — raden utelämnas hellre än fylls med ett påhittat nummer.
 * "DITT NAMN HÄR" är designens tomma fält och står kvar.
 */
export function OnyxLojalitet({ config, plans, content, tenantName }: ThemeLojalitetViewProps) {
  const perks = config.perks ?? []
  const title = content.clubTitle ?? 'Kretsen'

  return (
    <section className={styles.onClub} data-module="lojalitet" data-variant={config.variant}>
      <p className={styles.onGalEyebrow}>{content.clubEyebrow ?? 'MEDLEMSKAP'}</p>
      <h1 className={styles.onGalTitle}>{title}</h1>
      <p className={styles.onClubLede}>{content.clubLede ?? config.perkText}</p>

      <div className={styles.onCard}>
        <div className={styles.onCardTop}>
          <p className={styles.onCardWordmark}>
            {tenantName}
            <span className={styles.onDot}>.</span> {title.toUpperCase()}
          </p>
        </div>
        <p className={styles.onCardLabel}>MEDLEM</p>
        <p className={styles.onCardName}>DITT NAMN HÄR</p>
      </div>

      {perks.length > 0 ? (
        <div className={styles.onPerks}>
          {perks.map((perk, i) => (
            <div key={perk} className={styles.onPerk}>
              <p className={styles.onPerkNo}>{String(i + 1).padStart(2, '0')}</p>
              <p className={styles.onPerkText}>{perk}</p>
            </div>
          ))}
        </div>
      ) : null}

      {plans.length > 0 ? (
        <div className={styles.onPerks}>
          {plans.map((p) => (
            <div key={p.id} className={styles.onPerk} data-featured={p.featured ? 'true' : undefined}>
              <p className={styles.onPerkNo}>{formatPlanPrice(p.priceCents)}</p>
              <p className={styles.onPerkText}>
                <strong className={styles.onPlanName}>{p.name}</strong>{' '}
                {loyaltyIntervalLabel(p.interval)}
                {p.perks.length > 0 ? ` · ${p.perks.join(' · ')}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.onClubJoin}>
        <JoinClubForm cta={content.clubCta ?? 'GÅ MED'} />
      </div>
    </section>
  )
}
