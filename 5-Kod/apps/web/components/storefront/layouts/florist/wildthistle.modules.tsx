import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './wildthistle.module.css'

/**
 * WILD THISTLE — mallens EGNA modul-vyer (goal-59, Zivars vektor-regel).
 *
 * Modulen äger FUNKTIONEN (data, livscykel, varukorg, kassa), mallen äger FORMEN.
 * Allt ShopSection/BloggSection gör görs här också — <AddToCart> per produkt (utom
 * pausat), formatShopPrice, fulfilmentPromise + SHOP_FULFILMENT_LABELS, /shop/{id},
 * /blogg/{slug} (slug saknas → olänkat), limit + moreHref, ärliga tom-texter — men
 * i mallens råa språk: radie 0, rakt avskurna 4:5-bilder, tung Playfair mot
 * mikroversal Inter, streckade avdelare.
 *
 *   BUTIKEN  Samma kort-anatomi som hemmets .wtCard-rutnät: bild (4:5, skuren rakt
 *            av) → namn i serif → PRIS i tung serif på egen rad → streckad avdelare
 *            → köp-rälsen. Leveranslöftet står som en fältnotis i sektionshuvudet
 *            (och som mikro-etikett på varje kort) så kunden vet HUR hen får
 *            blommorna innan hen lägger något i korgen.
 *   BLOGGEN  FÄLTDAGBOK — numrerade uppslag (01/02/03…) i EN spalt med streckade
 *            linjer mellan, exakt som /om:s journal; omslaget är en inklistrad
 *            bilaga i marginalen. Inget rutnät, inga kort.
 *
 * SYNKRONA server-komponenter — all I/O är redan gjord. AddToCart är modulens egen
 * klientkomponent och importeras bara.
 */

/** Löpnummer i fältdagbokens/butikens språk: 01, 02, 03 … */
function num(i: number): string {
  return String(i + 1).padStart(2, '0')
}

/** Svenskt datum ("3 juni 2026") — samma formatPostDate-mönster som BloggSection. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ─────────────────────────────  BUTIKEN  ───────────────────────────── */
export function WildThistleShop({
  data,
  paused,
  limit,
  moreHref,
  content,
  tenantName,
}: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  // Startsidans teaser för en tom (men live) butik → rendera INGET. Inga
  // "visas snart"-löften till besökare.
  if (typeof limit === 'number' && allProducts.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)
  const label = SHOP_FULFILMENT_LABELS[config.fulfilment]

  return (
    <section
      className={styles.wtCardSection}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      <div className={styles.wtContain}>
        <Reveal className={styles.wtSecHead} as="div">
          <div>
            <p className={styles.wtEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.wtH2}>{content.shopTitle ?? 'Rakt från fältet'}</h2>
          </div>
          {/* LEVERANSLÖFTET — fältnotisen till höger i rubrikraden. Kunden ser HUR
              hen får blommorna innan något läggs i korgen. */}
          <p className={styles.wtShopPromise}>
            <span className={styles.wtShopPromiseLabel}>{label}</span>
            <span className={styles.wtShopPromiseText}>{promise}</span>
          </p>
        </Reveal>

        {paused ? (
          <p role="status" className={styles.wtShopClosed}>
            <span className={styles.wtShopClosedMark} aria-hidden="true">
              Stängt
            </span>
            Butiken hos {tenantName} tar inte emot beställningar just nu — sortimentet står
            kvar att titta på, vi öppnar igen snart.
          </p>
        ) : null}

        {products.length === 0 ? (
          // Modulens EGNA sida med tomt sortiment → ärlig text, aldrig påhittade varor.
          <p className={styles.wtShopEmpty}>
            Sortimentet är tomt just nu — vi binder efter säsong och fyller på så snart
            fältet ger något.
          </p>
        ) : (
          <ul className={styles.wtShopGrid}>
            {products.map((p, i) => (
              <li key={p.id} className={styles.wtShopItem}>
                <Reveal as="div" delay={Math.min(i, 8) * 60}>
                  {/* Bild + namn länkar till produktsidan — INTE hela kortet, så
                      köpknappen nedanför förblir klickbar. */}
                  <a
                    href={`/shop/${p.id}`}
                    className={styles.wtCard}
                    aria-label={`${p.name} — visa produkt`}
                  >
                    <div
                      className={styles.wtCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                      role={p.imageUrl ? 'img' : undefined}
                      aria-label={p.imageUrl ? (p.imageAlt ?? p.name) : undefined}
                    />
                    <p className={styles.wtShopIndex} aria-hidden="true">
                      {num(i)} · {label}
                    </p>
                    <h3 className={styles.wtCardName}>{p.name}</h3>
                  </a>

                  {p.description ? (
                    <p className={styles.wtCardExcerpt}>{p.description}</p>
                  ) : null}

                  {/* PRISET i tung serif — mallens signatur i butiken. */}
                  <p className={styles.wtShopPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>

                  <div className={styles.wtShopRule} aria-hidden="true" />

                  {/* Köp-rälsen: modulens egen klientkomponent, variant-medveten.
                      PAUSAT → ingen CTA alls (en stängd butik går inte att handla i). */}
                  {paused ? (
                    <p className={styles.wtShopItemClosed}>Går inte att beställa just nu</p>
                  ) : (
                    <div className={styles.wtShopBuy}>
                      <AddToCart product={p} fulfilment={config.fulfilment} />
                    </div>
                  )}
                </Reveal>
              </li>
            ))}
          </ul>
        )}

        {moreHref && (clipped || typeof limit === 'number') && allProducts.length > 0 ? (
          <div className={styles.wtMoreWrap}>
            <a href={moreHref} className={styles.wtLinkCta}>
              {content.shopCta ?? 'Handla i butiken'} <span aria-hidden="true">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/* ─────────────────────────────  BLOGGEN  ───────────────────────────── */
export function WildThistleBlogg({
  posts: allPosts,
  limit,
  moreHref,
  content,
}: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts
  if (typeof limit === 'number' && allPosts.length === 0) return null

  return (
    <section className={styles.wtCardSection} data-module="blogg">
      <div className={styles.wtContain}>
        <Reveal className={styles.wtSecHead} as="div">
          <div>
            <p className={styles.wtEyebrow}>{content.blogEyebrow ?? '— Fältanteckningar'}</p>
            <h2 className={styles.wtH2}>
              {content.blogTitle ?? 'Säsong, växtlighet & vildvuxet'}
            </h2>
          </div>
        </Reveal>

        {posts.length === 0 ? (
          <p className={styles.wtShopEmpty}>
            Fältdagboken är tom än så länge — första anteckningen skrivs snart.
          </p>
        ) : (
          <ol className={styles.wtLog}>
            {posts.map((post, i) => (
              <li key={post.id} className={styles.wtLogEntry}>
                <Reveal as="div" delay={Math.min(i, 8) * 60} className={styles.wtLogRow}>
                  <span className={styles.wtEntryNum} aria-hidden="true">
                    {num(i)}
                  </span>
                  <WildThistlePost post={post} />
                </Reveal>
              </li>
            ))}
          </ol>
        )}

        {moreHref && typeof limit === 'number' && allPosts.length > 0 ? (
          <div className={styles.wtMoreWrap}>
            <a href={moreHref} className={styles.wtLinkCta}>
              {content.blogCta ?? 'Läs mer'} <span aria-hidden="true">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** Ett uppslag i fältdagboken. Inlägg UTAN slug renderas OLÄNKADE (legacy-rader). */
function WildThistlePost({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  const body = (
    <>
      <div className={styles.wtLogText}>
        {date ? <p className={styles.wtLogDate}>{date}</p> : null}
        <h3 className={styles.wtLogTitle}>{post.title}</h3>
        {post.excerpt ? <p className={styles.wtLogExcerpt}>{post.excerpt}</p> : null}
      </div>
      {post.coverImageUrl ? (
        <div
          className={styles.wtLogThumb}
          style={{ backgroundImage: `url(${post.coverImageUrl})` }}
          role="img"
          aria-label={post.coverImageAlt ?? post.title}
        />
      ) : null}
    </>
  )

  if (!post.slug) return <div className={styles.wtLogBody}>{body}</div>
  return (
    <a href={`/blogg/${post.slug}`} className={`${styles.wtLogBody} ${styles.wtLogLink}`}>
      {body}
    </a>
  )
}
