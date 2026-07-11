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
import styles from './onyx.module.css'

/**
 * ONYX — mallens EGNA modul-vyer (goal-59, Zivars vektor-regel).
 *
 * Modulen äger FUNKTIONEN (data, livscykel, varianter, varukorg, kassa) — den är
 * oförändrad: <AddToCart> är samma klientkomponent som den delade sektionen använder,
 * priserna går genom formatShopPrice, leveranslöftet genom fulfilmentPromise, och en
 * PAUSAD butik renderar INGA köp-CTA:er (en stängd butik får inte gå att handla i).
 *
 * Mallen äger FORMEN: samma svarta band-rytm, samma DM Serif-rubriker, samma 4/5-ratio,
 * samma raka hörn och samma korall-mikrosignal som hemmet. Kortet är hemmets .onxCard
 * med en köp-fot: bild (4/5) → namn (display/26) → beskrivning (brödtext) → pris (korall,
 * 12/600/versaler) → köp-knapp. Köpblocket bär --color-accent = korallen så AddToCarts
 * inline-tokens ärver mallens kulör i stället för plattformens guld.
 *
 * SYNKRONA server-komponenter — ingen async, ingen 'use client'.
 */

/* ─────────────────────────────  BUTIK  ───────────────────────────── */
export function OnyxShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: all } = data
  const teaser = typeof limit === 'number'
  const products = teaser ? all.slice(0, limit) : all
  const clipped = products.length < all.length

  // Startsidans teaser + LIVE men tom butik → rendera inget alls (inga "visas snart"-
  // löften till besökare). Pausad butik behåller sin notis även i teaser-läge.
  if (teaser && all.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)
  const label = SHOP_FULFILMENT_LABELS[config.fulfilment]

  return (
    <section
      className={styles.onxCardSection}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      <Reveal className={styles.onxSecHead}>
        <p className={styles.onxEyebrow}>
          {teaser ? (content.shopEyebrow ?? '— Ur butiken') : `— Webshop · ${label}`}
        </p>
        <h2 className={styles.onxTitle}>
          {teaser ? (content.shopTitle ?? 'Beställ något dramatiskt') : 'Handla hos oss'}
        </h2>
        {/* LEVERANSLÖFTET — direkt under rubriken, före första kortet: besökaren vet
            hur hen får blommorna innan hen väljer en. */}
        <p className={styles.onxModuleLede}>{promise}</p>
      </Reveal>

      {paused ? (
        <p role="status" className={styles.onxNotice}>
          Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.onxModuleEmpty}>
          Sortimentet är tomt just nu. Hör av dig så binder vi något efter ditt önskemål.
        </p>
      ) : (
        <ul className={styles.onxCardGrid}>
          {products.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 8) * 90} as="li">
              <article className={styles.onxShopCard}>
                {/* Bild + namn länkar till produktsidan — INTE hela kortet, så köp-
                    knappen nedanför förblir klickbar. */}
                <Link
                  href={`/shop/${p.id}`}
                  className={styles.onxCardMedia}
                  aria-label={`${p.name} — visa produkt`}
                >
                  <span
                    className={styles.onxCardImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    role={p.imageUrl ? 'img' : undefined}
                    aria-label={p.imageUrl ? (p.imageAlt ?? p.name) : undefined}
                  />
                </Link>
                <div className={styles.onxCardBody}>
                  <h3 className={styles.onxCardName}>
                    <Link href={`/shop/${p.id}`} className={styles.onxCardTitleLink}>
                      {p.name}
                    </Link>
                  </h3>
                  {p.description ? (
                    <p className={styles.onxCardExcerpt}>{p.description}</p>
                  ) : null}
                  <p className={styles.onxCardMeta}>
                    {formatShopPrice(p.priceCents, p.currency)}
                    <span className={styles.onxCardFulfil}> · {label}</span>
                  </p>
                  {/* Köp-rälsen — plattformens klientkomponent, oförändrad. Pausad
                      butik: ingen CTA alls. */}
                  {paused ? null : (
                    <div className={styles.onxBuy}>
                      <AddToCart product={p} fulfilment={config.fulfilment} />
                    </div>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && all.length > 0 ? (
        <Reveal className={styles.onxSecFoot}>
          <Link href={moreHref} className={styles.onxMoreLink}>
            {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
      ) : null}
    </section>
  )
}

/* ─────────────────────────────  BLOGG  ───────────────────────────── */

/** ISO → "3 juni 2026". Null när datum saknas → raden ritas inte. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Inlägg UTAN slug har ingen detaljsida → renderas OLÄNKADE (aldrig en död länk). */
function OnyxPostCard({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  const inner = (
    <>
      <span
        className={styles.onxCardImg}
        style={post.coverImageUrl ? { backgroundImage: `url(${post.coverImageUrl})` } : undefined}
        role={post.coverImageUrl ? 'img' : undefined}
        aria-label={post.coverImageUrl ? (post.coverImageAlt ?? post.title) : undefined}
      />
      <span className={styles.onxCardBody}>
        {date ? <span className={styles.onxPostDate}>{date}</span> : null}
        <span className={styles.onxCardName}>{post.title}</span>
        {post.excerpt ? <span className={styles.onxCardExcerpt}>{post.excerpt}</span> : null}
      </span>
    </>
  )
  return (
    <article className={styles.onxShopCard}>
      {post.slug ? (
        <Link href={`/blogg/${post.slug}`} className={styles.onxPostLink}>
          {inner}
        </Link>
      ) : (
        <div className={styles.onxPostLink}>{inner}</div>
      )}
    </article>
  )
}

export function OnyxBlogg({ posts: all, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? all.slice(0, limit) : all
  if (teaser && all.length === 0) return null

  return (
    <section className={styles.onxCardSection} data-module="blogg">
      <Reveal className={styles.onxSecHead}>
        <p className={styles.onxEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
        <h2 className={styles.onxTitle}>
          {content.blogTitle ?? (teaser ? 'Säsong, tips & inspiration' : 'Från bloggen')}
        </h2>
        <p className={styles.onxModuleLede}>Nyheter, tips och inspiration från oss.</p>
      </Reveal>

      {posts.length === 0 ? (
        <p className={styles.onxModuleEmpty}>
          Inga inlägg är publicerade ännu — de dyker upp här så fort vi skrivit dem.
        </p>
      ) : (
        <ul className={styles.onxCardGrid}>
          {posts.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 8) * 90} as="li">
              <OnyxPostCard post={p} />
            </Reveal>
          ))}
        </ul>
      )}

      {moreHref && teaser && all.length > 0 ? (
        <Reveal className={styles.onxSecFoot}>
          <Link href={moreHref} className={styles.onxMoreLink}>
            {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
      ) : null}
    </section>
  )
}
