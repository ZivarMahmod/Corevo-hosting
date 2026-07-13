import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice, type ShopProduct } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './calytrix-modules.module.css'

/**
 * CALYTRIX — MODUL-VYER (goal-64, vektor-regeln + exakt kopia ur .dc.html).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad (paused → katalogen läsbar,
 * noll köpknappar), köp-rälsen är fortfarande <AddToCart>. FORMEN är mallens:
 *
 *   BUTIKEN (filens `showButik`) — "Butiken" i 56px serif med produkträkningen baseline-
 *   ställd bredvid, sedan fyra kolumner produktkort: 4:5-foto, badge i hörnet, namn +
 *   plommonpris på samma rad, beskrivning, och "LÄGG I KORG" som inramad versalknapp
 *   längst ner. Inga rundade hörn, ingen skugga förrän man rör kortet.
 *
 *   BLOGGEN (filens `showBlogg`) — tre vita kantade kort: 16:10-bild, versal tagg-rad i
 *   plommon, 23px serif-rubrik, utdrag. Ingen läs-mer-länk: hela kortet ÄR länken.
 *
 * Filens kategori-chips (Alla/Buketter/Rosor/Säsong/Under 500) är INTE byggda —
 * shop_products bär ingen kategori, och fem knappar som inte filtrerar något ljuger.
 * Filens badge-ord ("Bästsäljare", "Säsong" …) är mockdata utan fält i modellen; badgen
 * bär därför bara det vi VET: att varan är slutsåld.
 *
 * SYNKRONA server-komponenter (ingen async, ingen 'use client').
 */

/** Svenskt datum ("4 juli 2026"). Pure; null när datum saknas → raden utelämnas. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Slutsåld = ALLA varianter har available === 0 (samma sanning som AddToCart:s egen
 *  gren — etiketten är bara skyltningen av samma data, aldrig en egen lagerlogik). */
function isSoldOut(p: ShopProduct): boolean {
  return p.variants.length > 0 && p.variants.every((v) => v.available === 0)
}

/* ═══════════════════════════════ BUTIKEN ════════════════════════════════ */

export function CalytrixShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: all } = data
  const products = typeof limit === 'number' ? all.slice(0, limit) : all
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && all.length === 0 && !paused) return null

  const cards = products.map((p, i) => {
    const soldOut = isSoldOut(p)
    return (
      <li key={p.id}>
        <Reveal delay={i * 60}>
          <article className={styles.cxCard}>
            <Link
              href={`/shop/${p.id}`}
              className={styles.cxCardMedia}
              aria-label={`${p.name} — visa produkt`}
            >
              <span
                className={styles.cxCardImg}
                role="img"
                aria-label={p.imageAlt ?? p.name}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              />
              {soldOut ? <span className={styles.cxCardBadge}>Slutsåld</span> : null}
            </Link>
            <div className={styles.cxCardBody}>
              <div className={styles.cxCardHead}>
                <h3 className={styles.cxCardName}>
                  <Link href={`/shop/${p.id}`}>{p.name}</Link>
                </h3>
                <p className={styles.cxCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
              </div>
              {p.description ? <p className={styles.cxCardDesc}>{p.description}</p> : null}
              {/* Pausad butik → INGEN köp-CTA. Stängt är stängt. */}
              {paused ? null : (
                <div className={styles.cxCardBuy}>
                  <AddToCart product={p} fulfilment={config.fulfilment} compact />
                </div>
              )}
            </div>
          </article>
        </Reveal>
      </li>
    )
  })

  // Teaser-läget (om en tenant väver in butiken på hemmet via de delade sektionerna):
  // samma kort, filens sektionsgrammatik.
  if (teaser) {
    return (
      <section className={styles.cxTeaser} data-module="shop" data-fulfilment={config.fulfilment}>
        <div className={styles.cxSecHead}>
          <div>
            <p className={styles.cxSecEyebrow}>{content.shopEyebrow ?? 'Mest sålda'}</p>
            <h2 className={styles.cxSecTitle}>
              {content.shopTitle ?? 'Beställ det alla vill ha'}
            </h2>
          </div>
          {moreHref ? (
            <Link href={moreHref} className={styles.cxSecLink}>
              {content.shopCta ?? 'Visa hela butiken →'}
            </Link>
          ) : null}
        </div>
        {paused ? (
          <p role="status" className={styles.cxNotice}>
            Butiken är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
          </p>
        ) : null}
        {products.length > 0 ? <ul className={styles.cxGrid4}>{cards}</ul> : null}
      </section>
    )
  }

  return (
    <section className={styles.cxShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <div className={styles.cxShopHead}>
        <h1 className={styles.cxShopTitle}>{content.shopTitle ?? 'Butiken'}</h1>
        <p className={styles.cxShopCount}>
          {all.length} {all.length === 1 ? 'produkt' : 'produkter'}
        </p>
      </div>

      {paused ? (
        <p role="status" className={styles.cxNotice}>
          Butiken är tillfälligt stängd för nya beställningar. Du kan se hela sortimentet,
          men det går inte att beställa just nu. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.cxEmpty}>Sortimentet är tomt just nu.</p>
      ) : (
        <ul className={styles.cxShopGrid}>{cards}</ul>
      )}
    </section>
  )
}

/* ═══════════════════════════════ BLOGGEN ═══════════════════════════════ */

export function CalytrixBlogg({ posts: all, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? all.slice(0, limit) : all

  if (teaser && all.length === 0) return null

  const cards = posts.map((p, i) => {
    const date = formatPostDate(p.publishedAt)
    const body = (
      <>
        <span
          className={styles.cxPostImg}
          role="img"
          aria-label={p.coverImageAlt ?? p.title}
          style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
        />
        <span className={styles.cxPostBody}>
          {date ? <span className={styles.cxPostMeta}>{date}</span> : null}
          <h2 className={styles.cxPostTitle}>{p.title}</h2>
          {p.excerpt ? <span className={styles.cxPostExcerpt}>{p.excerpt}</span> : null}
        </span>
      </>
    )
    return (
      <li key={p.id}>
        <Reveal delay={i * 60}>
          {/* Inlägg utan slug renderas OLÄNKADE (legacy-rader) — aldrig en död länk. */}
          {p.slug ? (
            <Link href={`/blogg/${p.slug}`} className={styles.cxPost}>
              {body}
            </Link>
          ) : (
            <div className={styles.cxPost}>{body}</div>
          )}
        </Reveal>
      </li>
    )
  })

  return (
    <section className={teaser ? styles.cxTeaser : styles.cxBlogg} data-module="blogg">
      {teaser ? (
        <div className={styles.cxSecHead}>
          <div>
            <p className={styles.cxSecEyebrow}>{content.blogEyebrow ?? 'Blogg'}</p>
            <h2 className={styles.cxSecTitle}>{content.blogTitle ?? 'Nytt från butiken'}</h2>
          </div>
          {moreHref ? (
            <Link href={moreHref} className={styles.cxSecLink}>
              {content.blogCta ?? 'Läs hela bloggen →'}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <h1 className={styles.cxBloggTitle}>{content.blogTitle ?? 'Blogg'}</h1>
          <p className={styles.cxBloggLede}>
            Skötselråd, säsongsnytt och det som händer i butiken.
          </p>
        </>
      )}

      {posts.length === 0 ? (
        <p className={styles.cxEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.cxPosts}>{cards}</ul>
      )}
    </section>
  )
}
