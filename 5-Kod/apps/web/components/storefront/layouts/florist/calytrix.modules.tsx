import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatProductPrice,
  shopCategoryChips,
  type ShopProduct,
} from '@/lib/storefront/shop/types'
import { JoinClubForm } from '../../lojalitet/JoinClubForm'
import { formatPlanPrice, loyaltyIntervalLabel } from '@/lib/storefront/lojalitet/types'
import type {
  ThemeShopViewProps,
  ThemeBloggViewProps,
  ThemeGalleriViewProps,
  ThemeLojalitetViewProps,
} from './types'
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
 * goal-64 (migration 0057) — DET SOM SAKNADES ÄR NU VERKLIGT:
 *   • KATEGORI-CHIPSEN (filens `cats`/`filters`) byggdes inte tidigare, för shop_products bar
 *     ingen kategori. Nu gör den det. Chipsen är <Link>-taggar mot `/shop?kategori=…` och
 *     filtreringen sker server-side — de fungerar utan JS och kan indexeras. Kunden har INGA
 *     kategorier → data.categories är tom → raden renderas inte alls (aldrig en påhittad chip).
 *   • BADGEN ("Bästsäljare", "Säsong" …) var mockdata utan fält. Nu är den shop_products.badge.
 *     Slutsåld VINNER ändå över badgen: att varan inte går att köpa är viktigare för besökaren
 *     än att den är populär, och två märken i samma hörn ritar designen inte.
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
              {/* Ett märke, aldrig två (filen ritar EN span i hörnet). Slutsåld går före badgen:
                  "kan inte köpas" är viktigare för besökaren än "populär". Ingen av delarna →
                  inget märke alls. */}
              {soldOut ? (
                <span className={styles.cxCardBadge}>Slutsåld</span>
              ) : p.badge ? (
                <span className={styles.cxCardBadge}>{p.badge}</span>
              ) : null}
            </Link>
            <div className={styles.cxCardBody}>
              <div className={styles.cxCardHead}>
                <h3 className={styles.cxCardName}>
                  <Link href={`/shop/${p.id}`}>{p.name}</Link>
                </h3>
                {/* formatProductPrice, aldrig egen formatering: bär produkten price_from
                    skrivs priset "fr. 349 kr" i ALLA mallar, inte bara i den som råkar minnas. */}
                <p className={styles.cxCardPrice}>{formatProductPrice(p)}</p>
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

  // Filens `filters` — mallens ord för det ofiltrerade urvalet är "Alla".
  const chips = shopCategoryChips(data, 'Alla')

  return (
    <section className={styles.cxShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <div className={styles.cxShopHead}>
        <h1 className={styles.cxShopTitle}>{content.shopTitle ?? 'Butiken'}</h1>
        {/* Filens `filterInfo`: "8 produkter · Alla" — räknaren gäller det SYNLIGA urvalet. */}
        <p className={styles.cxShopCount}>
          {all.length} {all.length === 1 ? 'produkt' : 'produkter'}
          {data.activeCategory ? ` · ${data.activeCategory}` : chips.length > 0 ? ' · Alla' : ''}
        </p>
      </div>

      {/* KATEGORI-CHIPSEN — segmenterad rektangel i plommon (filen: inline-flex, 1px #241019).
          Inga kategorier hos kunden → chips är tom → raden renderas inte. */}
      {chips.length > 0 ? (
        <div className={styles.cxFilterRow}>
          <div className={styles.cxFilters}>
            {chips.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={styles.cxFilter}
                data-active={c.active ? 'true' : undefined}
                aria-current={c.active ? 'page' : undefined}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {paused ? (
        <p role="status" className={styles.cxNotice}>
          Butiken är tillfälligt stängd för nya beställningar. Du kan se hela sortimentet,
          men det går inte att beställa just nu. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        // Ärlig tomhet: en okänd/tom kategori säger så, den påstår inte att butiken är tom.
        <p className={styles.cxEmpty}>
          {data.activeCategory
            ? `Inga produkter i ${data.activeCategory} just nu.`
            : 'Sortimentet är tomt just nu.'}
        </p>
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
          {/* Filens metarad är "{{ b.tag }} · {{ b.date }}" — taggen är blog_posts.tag (0057).
              Saknas taggen står bara datumet där; saknas båda renderas ingen rad alls. */}
          {p.tag || date ? (
            <span className={styles.cxPostMeta}>
              {[p.tag, date].filter(Boolean).join(' · ')}
            </span>
          ) : null}
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

/* ══════════════════════════════════ GALLERI ═══════════════════════════════ */

/**
 * Filens `showGalleri`: e-handelns galleri är ett RUTNÄT, inget museum — fyra spalter
 * kvadrater med 1px vinröd ram (--color-line) och 14px mellanrum. Rubriken i Instrument
 * Serif 56px, en rad underrubrik, sedan bara varor på rad.
 */
export function CalytrixGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.cxGalleri} data-module="galleri">
      <h1 className={styles.cxGalTitle}>{content.galleryTitle ?? 'Galleri'}</h1>
      <p className={styles.cxGalLede}>
        {content.galleryLede ?? 'Senaste leveranserna ur butiken — uppdateras varje vecka.'}
      </p>

      {items.length === 0 ? (
        <p className={styles.cxGalEmpty}>Inga bilder är publicerade ännu.</p>
      ) : (
        <div className={styles.cxGalGrid}>
          {items.map((g) =>
            g.imageUrl ? (
              <div
                key={g.id}
                className={styles.cxGalTile}
                role="img"
                aria-label={g.imageAlt ?? g.caption ?? ''}
                style={{ backgroundImage: `url(${g.imageUrl})` }}
              />
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

/* ════════════════════════════════ CALYTRIX CLUB ═══════════════════════════ */

/**
 * Filens `showClub`: tre NIVÅKORT i rad (den mittersta mörk och utan ram — "Nivå 2" är
 * den man ska välja), och under dem anmälan i en vit ruta med 2px svart fältram.
 *
 * AVVIKELSE (medveten, och den ÄRLIGA vägen): designens kort visar POÄNGINTERVALL
 * ("0–2 000 poäng"). Klubbens datamodell (loyalty_plans, 0057) bär ett PRIS och ett
 * intervall, inte poängtrappor — vi kan alltså inte visa "6 000+ poäng" utan att hitta på
 * en trappa kunden aldrig satt upp. Kortet visar därför nivåns riktiga namn, dess riktiga
 * pris och dess riktiga förmåner; formen (tre kort, mittersta mörk = `featured`) är filens.
 * Inga nivåer i klubben → inga kort, aldrig tre tomma platshållare.
 */
export function CalytrixLojalitet({ config, plans, content }: ThemeLojalitetViewProps) {
  return (
    <section className={styles.cxClub} data-module="lojalitet" data-variant={config.variant}>
      <h1 className={styles.cxGalTitle}>{content.clubTitle ?? 'Calytrix Club'}</h1>
      <p className={styles.cxClubLede}>{content.clubLede ?? config.perkText}</p>

      {plans.length > 0 ? (
        <div className={styles.cxTiers}>
          {plans.map((p, i) => (
            <div
              key={p.id}
              className={styles.cxTier}
              data-featured={p.featured ? 'true' : undefined}
            >
              <p className={styles.cxTierNo}>Nivå {i + 1}</p>
              <p className={styles.cxTierName}>{p.name}</p>
              <p className={styles.cxTierPrice}>
                {formatPlanPrice(p.priceCents)} {loyaltyIntervalLabel(p.interval)}
              </p>
              {p.perks.length > 0 ? (
                <p className={styles.cxTierPerks}>{p.perks.join(' · ')}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {plans.length === 0 && config.perks && config.perks.length > 0 ? (
        <div className={styles.cxTiers}>
          {config.perks.map((perk) => (
            <div key={perk} className={styles.cxTier}>
              <p className={styles.cxTierPerks}>{perk}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.cxClubJoin}>
        <JoinClubForm cta={content.clubCta ?? 'GÅ MED GRATIS'} />
      </div>
    </section>
  )
}
