import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './calytrix.module.css'

/**
 * CALYTRIX — MODUL-VYER (goal-59, Zivars vektor-regel).
 *
 *   "mallens vektor är apex för modulens vektor, men komponenten och modulens
 *    funktion är densamma"
 *
 * Butiken är Calytrix HJÄLTE — hemmets sektion 3 är redan en produkt-karusell med
 * "Populär"-pill. Modulens EGNA sida är därför inte en ny värld utan samma värld i
 * full skala: samma mörka plommonband, samma 4:5-bild, samma pill, samma raka hörn,
 * samma typskala (96/50/28/21/16/12). Enda skillnaden mot hemmet är att korten här
 * bär köp-rälsen (<AddToCart>), som hemmets teaser aldrig gör.
 *
 * FUNKTIONEN ägs av modulen och tappas ALDRIG:
 *   · <AddToCart> per produkt — utom vid `paused`, då köp-CTA:erna INTE renderas.
 *   · `paused` → tydlig stängt-notis (role="status").
 *   · Priser via formatShopPrice, leveranslöfte via fulfilmentPromise + labeln.
 *   · Produktlänk /shop/{id} · blogglänk /blogg/{slug} (utan slug → olänkad).
 *   · limit → teaser-läge (karusell + "Visa hela butiken"), tom + limit → null.
 *
 * SYNKRONA server-komponenter: all I/O är redan gjord (ingen async, ingen 'use client').
 */

/** Svenskt datum ("3 juni 2026"). Pure; null när datum saknas → raden utelämnas. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Media-läget (goal-60). Mallen äger kortets FORM — men bara bilden vet om den är
 * frilagd. En transparent PNG/WebP kan svävA på plattan med en skugga som följer
 * motivets silhuett; ett vanligt JPG-foto måste fylla plattan, annars blir skuggan
 * en fyrkant och illusionen dör.
 *
 * Vi kan inte läsa alfakanalen i renderingen (det vore I/O i en synkron komponent),
 * så vi går på filändelsen — den är den enda ärliga signalen vi har vid render.
 * När frilägning görs vid uppladdning (egen goal) skrivs resultatet som .png/.webp
 * och kortet byter läge av sig självt. Tills dess: kundens foton beter sig som förr.
 */
function mediaClass(imageUrl: string | null): string {
  const base = styles.calCardImg ?? ''
  if (!imageUrl) return base
  const cutout = /\.(png|webp|avif)(\?|$)/i.test(imageUrl)
  return cutout ? `${base} ${styles.calCardImgFloat ?? ''}`.trim() : base
}

/** Inlägg utan slug renderas OLÄNKADE (legacy-rader) — annars länk till /blogg/{slug}. */
function PostShell({ post, children }: { post: BloggPost; children: React.ReactNode }) {
  if (!post.slug) return <div className={styles.calCard}>{children}</div>
  return (
    <Link href={`/blogg/${post.slug}`} className={styles.calCard}>
      {children}
    </Link>
  )
}

/* ═══════════════════════════ BUTIKEN ═══════════════════════════ */

export function CalytrixShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
  const { config, products: all } = data
  const products = typeof limit === 'number' ? all.slice(0, limit) : all
  const teaser = typeof limit === 'number'

  // Startsidans teaser för en tom (men live) butik → rendera ingenting alls.
  // Inga "visas snart"-löften till besökare (S12).
  if (teaser && all.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)
  const label = SHOP_FULFILMENT_LABELS[config.fulfilment]

  const cards = products.map((p, i) => (
    <div key={p.id} className={teaser ? styles.calCardSlot : undefined}>
      <article className={styles.calShopCard}>
        {/* Bild + namn länkar till produktsidan — INTE hela kortet, så köpknappen
            nedanför förblir klickbar. */}
        <Link
          href={`/shop/${p.id}`}
          className={styles.calShopMedia}
          aria-label={`${p.name} — visa produkt`}
        >
          <div className={styles.calCardImgWrap}>
            {i < 3 ? <span className={styles.calBadge}>Populär</span> : null}
            {/* imageUrl kan vara null → färgplattan (--color-accent-soft) bär kortet. */}
            <div
              className={mediaClass(p.imageUrl)}
              style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              role="img"
              aria-label={p.imageAlt ?? p.name}
            />
          </div>
        </Link>
        <div className={styles.calShopBody}>
          <h3 className={styles.calCardName}>
            <Link href={`/shop/${p.id}`} className={styles.calShopNameLink}>
              {p.name}
            </Link>
          </h3>
          {p.description ? <p className={styles.calCardMeta}>{p.description}</p> : null}
          <p className={styles.calCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
          {/* Köp-rälsen: pausad butik renderar INGEN CTA (stängt är stängt). */}
          {paused ? null : (
            <div className={styles.calShopBuy}>
              <AddToCart product={p} fulfilment={config.fulfilment} />
            </div>
          )}
        </div>
      </article>
    </div>
  ))

  return (
    <section className={styles.calShopRoot} data-module="shop" data-fulfilment={config.fulfilment}>
      {teaser ? (
        <div className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className={styles.calEyebrow}>{content.shopEyebrow ?? `— Webshop · ${label}`}</p>
              <h2 className={styles.calSecTitle}>{content.shopTitle ?? 'Beställ det alla vill ha'}</h2>
              {/* Leveranslöftet står direkt under rubriken, även i teaser-läget. */}
              <p className={styles.calShopPromise}>{promise}</p>
            </div>
            {moreHref ? (
              <Link href={moreHref} className={styles.calSecCta}>
                {content.shopCta ?? 'Visa hela butiken'}
              </Link>
            ) : null}
          </Reveal>

          {paused ? (
            <div className={styles.calShopNoticeWrap}>
              <p role="status" className={styles.calShopClosed}>
                Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
              </p>
            </div>
          ) : null}

          {products.length > 0 ? <div className={styles.calScrollRow}>{cards}</div> : null}
        </div>
      ) : (
        <>
          {/* Modulens EGEN sida: mallens fullbredds-plommonband som sidhuvud —
              samma mörka platta som hemmets marknadsband och closing. */}
          <header className={styles.calShopHero}>
            <p className={styles.calShopHeroEyebrow}>— Webshop · {label}</p>
            <h1 className={styles.calShopHeroTitle}>
              {content.shopTitle ?? `Handla hos ${tenantName}`}
            </h1>
            {/* Leveranslöftet: sidhuvudets lede — det första besökaren läser. */}
            <p className={styles.calShopHeroLede}>{promise}</p>
          </header>

          <div className={styles.calSection}>
            {paused ? (
              <div className={styles.calShopNoticeWrap}>
                <p role="status" className={styles.calShopClosed}>
                  Webshoppen är tillfälligt stängd för nya beställningar. Du kan se hela
                  sortimentet, men det går inte att beställa just nu. Vi öppnar igen snart.
                </p>
              </div>
            ) : null}

            {products.length === 0 ? (
              <div className={styles.calShopNoticeWrap}>
                <p className={styles.calEmpty}>
                  Sortimentet är tomt just nu. Hör gärna av dig — vi binder gärna något på
                  beställning.
                </p>
              </div>
            ) : (
              <div className={styles.calShopGrid}>{cards}</div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/* ═══════════════════════════ BLOGGEN ═══════════════════════════ */

export function CalytrixBlogg({ posts: all, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? all.slice(0, limit) : all
  const teaser = typeof limit === 'number'

  if (teaser && all.length === 0) return null

  const cards = posts.map((p) => {
    const date = formatPostDate(p.publishedAt)
    return (
      <div key={p.id} className={teaser ? styles.calCardSlot : undefined}>
        <PostShell post={p}>
          <div className={styles.calCardImgWrap}>
            <div
              className={styles.calCardImg}
              style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
              role="img"
              aria-label={p.coverImageAlt ?? p.title}
            />
          </div>
          {date ? <p className={styles.calPostDate}>{date}</p> : null}
          <h3 className={styles.calCardName}>{p.title}</h3>
          {p.excerpt ? <p className={styles.calCardMeta}>{p.excerpt}</p> : null}
        </PostShell>
      </div>
    )
  })

  return (
    <section className={styles.calShopRoot} data-module="blogg">
      {teaser ? (
        <div className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className={styles.calEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
              <h2 className={styles.calSecTitle}>{content.blogTitle ?? 'Nytt från floristen'}</h2>
            </div>
            {moreHref ? (
              <Link href={moreHref} className={styles.calSecCta}>
                {content.blogCta ?? 'Läs hela bloggen'}
              </Link>
            ) : null}
          </Reveal>
          {posts.length > 0 ? <div className={styles.calScrollRow}>{cards}</div> : null}
        </div>
      ) : (
        <>
          <header className={styles.calShopHero}>
            <p className={styles.calShopHeroEyebrow}>— Blogg</p>
            <h1 className={styles.calShopHeroTitle}>
              {content.blogTitle ?? `Nytt från ${tenantName}`}
            </h1>
            <p className={styles.calShopHeroLede}>Nyheter, tips och inspiration från butiken.</p>
          </header>

          <div className={styles.calSection}>
            {posts.length === 0 ? (
              <div className={styles.calShopNoticeWrap}>
                <p className={styles.calEmpty}>Inga inlägg är publicerade ännu.</p>
              </div>
            ) : (
              <div className={styles.calShopGrid}>{cards}</div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
