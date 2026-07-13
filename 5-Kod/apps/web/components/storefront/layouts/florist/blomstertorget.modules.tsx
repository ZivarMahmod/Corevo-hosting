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
import styles from './blomstertorget.module.css'

/**
 * BLOMSTERTORGET — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   TORGPRISER (butik) — filens `showButik`: en NOTERINGSLISTA, inte ett kortrutnät.
 *   96px-miniatyr · namn (versal) + kursiv beskrivning · pris i Archivo 900 · "Lägg i korg".
 *   3px-linje över listan, 1px mellan raderna, och finstilten om bunt/utkörning under.
 *
 *   NOTISER (blogg) — filens `showBlogg`: tvåspaltig notissättning (column-count: 2),
 *   prickad linje under varje notis, etikett + datum i rött. Ingen bild — notisen ÄR text.
 *
 * PAUSAD BUTIK: katalogen är läsbar, noll köpknappar (annars kan en kund handla i ett
 * stängt stånd). SYNKRONA server-komponenter — ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ═════════════════════════════════ TORGPRISER ═════════════════════════════ */

export function BlomstertorgetShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.btShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <h1 className={styles.btPageTitle}>{content.shopTitle ?? 'Torgpriser'}</h1>
      <p className={styles.btLede}>
        Satta 06:45 i morse. Beställ här eller kom till ståndet — samma pris, ingen skillnad.
      </p>

      {paused ? (
        <p role="status" className={styles.btNotice}>
          Ståndet är stängt för beställningar just nu — priserna står kvar, korgen är låst.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.btEmpty}>Inga varor är noterade i dagens tidning.</p>
      ) : (
        <ul className={styles.btPriceList}>
          {products.map((p) => (
            <li key={p.id} className={styles.btPriceRow}>
              <a
                href={`/shop/${p.id}`}
                className={styles.btPriceImg}
                aria-label={`${p.name} — visa varan`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.btSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div>
                <p className={styles.btPriceName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                  {/* Filens `{{ p.tag }}` — den röda inramade etiketten EFTER namnet
                      ("Nyss inkommet", "Säsong"). = shop_products.badge (0057). Null → inget. */}
                  {p.badge ? <span className={styles.btPriceTag}>{p.badge}</span> : null}
                </p>
                {p.description ? <p className={styles.btPriceDesc}>{p.description}</p> : null}
              </div>
              {/* formatProductPrice → "fr. X kr" när varan bär price_from. */}
              <p className={styles.btPriceTal}>{formatProductPrice(p)}</p>
              {paused ? <span /> : <AddToCart product={p} fulfilment={config.fulfilment} />}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={styles.btMoreLink}>
          {content.shopCta ?? 'Till torgpriserna →'}
        </a>
      ) : (
        <p className={styles.btShopNote}>
          Bunt = torgets standardmått · Utkörning inom tullarna 49 kr · Beställ före 14:00
        </p>
      )}
    </section>
  )
}

/* ═══════════════════════════════════ NOTISER ══════════════════════════════ */

export function BlomstertorgetBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.btBlogg} data-module="blogg">
      <h1 className={styles.btPageTitle}>{content.blogTitle ?? 'Notiser'}</h1>
      <p className={styles.btLede}>Smått och gott från torget, i kronologisk oordning.</p>

      {posts.length === 0 ? (
        <p className={styles.btEmpty}>Inga notiser är införda ännu.</p>
      ) : (
        <ul className={styles.btBloggList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id} className={styles.btPost}>
                <article>
                  {/* Filens "{{ b.tag }} · {{ b.date }}": taggen är INLÄGGETS egen (blog_posts.tag,
                      0057), inte en gemensam rubrik. Saknar inlägget tagg faller vi tillbaka på
                      ägarens egen sektionsetikett — hans text, aldrig en påhittad. */}
                  <p className={styles.btPostTag}>
                    {p.tag ?? content.blogEyebrow ?? 'Notis'}
                    {date ? ` · ${date}` : ''}
                  </p>
                  <h2 className={styles.btPostTitle}>{p.title}</h2>
                  {p.excerpt ? <p className={styles.btPostExcerpt}>{p.excerpt}</p> : null}
                  {p.slug ? (
                    <a href={`/blogg/${p.slug}`} className={styles.btItalicLink}>
                      {content.blogCta ?? 'läs mer →'}
                    </a>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={styles.btMoreLink}>
          {content.blogCta ?? 'läs mer →'}
        </a>
      ) : null}
    </section>
  )
}

/* ════════════════════════════════ BILDSIDAN ═══════════════════════════════ */

/**
 * Filens `showGalleri`: tidningens BILDSIDA — fyra spalter kvadrater under en 3px svart
 * linjal, med bildtexten i spärrad Archivo-versal, som en riktig tidningsbildtext.
 * Ingen radie, ingen skugga: torget trycker på papper.
 */
export function BlomstertorgetGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.btGalleri} data-module="galleri">
      <h1 className={styles.btPageTitle}>{content.galleryTitle ?? 'Bildsidan'}</h1>
      <p className={styles.btPageLede}>
        {content.galleryLede ??
          'Veckans bilder från torget — insända av kunder och tagna av ståndets egna.'}
      </p>

      {items.length === 0 ? (
        <p className={styles.btEmpty}>Inga bilder är insända ännu.</p>
      ) : (
        <div className={styles.btGalGrid}>
          {items.map((g) => (
            <figure key={g.id} className={styles.btGalFig}>
              {g.imageUrl ? (
                <div
                  className={styles.btGalImg}
                  role="img"
                  aria-label={g.imageAlt ?? g.caption ?? ''}
                  style={{ backgroundImage: `url(${g.imageUrl})` }}
                />
              ) : null}
              {g.caption ? (
                <figcaption className={styles.btGalCap}>{g.caption}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}

/* ════════════════════════════════ STAMKUND ════════════════════════════════ */

/**
 * Filens `showStamkund`: kupongen. Röd streckad ram, "✂ Klipp ut och spara", och
 * förmånerna som PARAGRAFER (§1 … §N) med prickad linje emellan — torgets ordningsstadga.
 *
 * Paragraferna kommer ur klubbens config (`perks`). Har ägaren inte skrivit några finns
 * ingen stadga att klippa ut — då ritar vi ingen kupong alls hellre än fyra påhittade
 * löften i kundens namn.
 */
export function BlomstertorgetLojalitet({ config, plans, content }: ThemeLojalitetViewProps) {
  const perks = config.perks ?? []

  return (
    <section className={styles.btClub} data-module="lojalitet" data-variant={config.variant}>
      <h1 className={styles.btPageTitle}>{content.clubTitle ?? 'Stamkund'}</h1>
      <p className={styles.btPageLede}>
        {content.clubLede ??
          'Torgets trognaste förtjänar torgets bästa. Registreringen är gratis och gäller för alltid.'}
      </p>

      {perks.length > 0 ? (
        <div className={styles.btCoupon}>
          <p className={styles.btCouponHead}>
            {content.clubEyebrow ?? '✂ Klipp ut och spara — stamkundens förmåner'}
          </p>
          <div className={styles.btCouponList}>
            {perks.map((perk, i) => (
              <div key={perk} className={styles.btCouponRow}>
                <span className={styles.btParagraf}>§{i + 1}</span>
                <p>{perk}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {plans.length > 0 ? (
        <div className={styles.btCoupon}>
          <p className={styles.btCouponHead}>Stamkundens nivåer</p>
          <div className={styles.btCouponList}>
            {plans.map((p) => (
              <div
                key={p.id}
                className={styles.btCouponRow}
                data-featured={p.featured ? 'true' : undefined}
              >
                <span className={styles.btParagraf}>
                  {formatPlanPrice(p.priceCents)}
                </span>
                <p>
                  <strong>{p.name}</strong> — {loyaltyIntervalLabel(p.interval)}
                  {p.perks.length > 0 ? ` · ${p.perks.join(' · ')}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.btClubJoin}>
        <JoinClubForm cta={content.clubCta ?? 'Registrera mig'} />
      </div>
    </section>
  )
}
