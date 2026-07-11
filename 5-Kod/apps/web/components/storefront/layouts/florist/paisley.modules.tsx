import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import { serviceNum } from '../../service-format'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './paisley.module.css'

/**
 * PAISLEYS EGNA MODUL-VYER (goal-59, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN (data, livscykel, varukorg, kassa) — den kommer redan
 * laddad hit. Mallen äger FORMEN: här renderas butiken som ett TIDNINGSUPPSLAG
 * (plansch + bildtext + pris i spalt) och bloggen som en ARTIKELLISTA med ingress
 * i spalt — exakt samma typskala, 4:5-ratio, 0px-radie och sektionsrytm som
 * Paisleys hem. Ingen `shared.sf*`, inga nya hexar.
 *
 * SYNKRONA server-komponenter. AddToCart är den enda klientdelen (importeras).
 */

/** Samma datumformat som modulens delade vy (sv-SE, "3 juni 2026"). */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═══════════════════════════ BUTIKEN — tidningsuppslag ═══════════════════════ */
export function PaisleyShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  // Startsidans teaser + tom (ej pausad) butik → rendera INGET (inga "visas snart"-
  // löften till besökare). Modulens egen sida behåller sin ärliga tom-text.
  if (typeof limit === 'number' && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.paMod} data-module="shop" data-fulfilment={config.fulfilment}>
      <div className={styles.paWrap}>
        <Reveal className={styles.paSecHead}>
          <div>
            <p className={styles.paKicker}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.paSecTitle}>{content.shopTitle ?? 'Beställ något vackert'}</h2>
          </div>
          {moreHref && (clipped || typeof limit === 'number') && allProducts.length > 0 ? (
            <Link href={moreHref} className={styles.paTextCta}>
              {content.shopCta ?? 'Handla i butiken'} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </Reveal>

        {/* LEVERANSBANDET — tegelbandet från hemmet, här som butikens löfte.
            Står FÖRE sortimentet: kunden ska veta hur hen får blommorna. */}
        <Reveal delay={80} className={styles.paModBand}>
          <p className={styles.paModBandTag}>— {SHOP_FULFILMENT_LABELS[config.fulfilment]}</p>
          <p className={styles.paModBandLine}>{fulfilmentPromise(config)}</p>
        </Reveal>

        {paused ? (
          <p role="status" className={styles.paModClosed}>
            Butiken är stängd för nya beställningar — sortimentet visas som arkiv tills vi
            öppnar igen.
          </p>
        ) : null}

        {products.length === 0 ? (
          <p className={styles.paEmpty}>
            Sortimentet sätts just nu. Hör av dig så binder vi något efter din önskan —{' '}
            <Link href="/kontakt">kontakta {tenantName}</Link>.
          </p>
        ) : (
          <ul className={styles.paSpreadList}>
            {products.map((p, i) => (
              <li key={p.id} className={styles.paSpreadItem}>
                <Reveal delay={(i % 2) * 80} className={styles.paSpreadItemInner}>
                  {/* Planschen — 4:5, mallens enda bildratio. imageUrl kan vara null
                      → färgplatta i accent-soft (background-color under bilden). */}
                  <Link
                    href={`/shop/${p.id}`}
                    aria-label={`${p.name} — visa produkt`}
                    className={styles.paSpreadPlate}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <div className={styles.paSpreadCol}>
                    {/* BILDTEXTEN — nummer · namn · pris över en 2px-linjal. */}
                    <p className={styles.paPlateCaption}>
                      <span className={styles.paPlateNum} aria-hidden="true">
                        {serviceNum(i)}
                      </span>
                      <span className={styles.paPlateName}>
                        <Link href={`/shop/${p.id}`} className={styles.paSpreadTitleLink}>
                          {p.name}
                        </Link>
                      </span>
                      <span className={styles.paPlatePrice}>
                        {formatShopPrice(p.priceCents, p.currency)}
                      </span>
                    </p>
                    {p.description ? (
                      <p className={styles.paSpreadBody}>{p.description}</p>
                    ) : null}
                    {/* Köp-rälsen: pausad butik renderar INGA köp-CTA:er. */}
                    {paused ? null : (
                      <div className={styles.paBuy}>
                        <AddToCart product={p} fulfilment={config.fulfilment} />
                      </div>
                    )}
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/* ═══════════════════════════ BLOGGEN — artikellista ══════════════════════════ */

/** Ett inlägg utan slug har ingen egen sida → renderas OLÄNKAT (aldrig en död länk). */
function PostTitle({ post }: { post: BloggPost }) {
  if (!post.slug) return <span className={styles.paArtTitle}>{post.title}</span>
  return (
    <Link href={`/blogg/${post.slug}`} className={styles.paArtTitle}>
      {post.title}
    </Link>
  )
}

export function PaisleyBlogg({ posts: allPosts, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts
  if (typeof limit === 'number' && allPosts.length === 0) return null

  return (
    <section className={styles.paMod} data-module="blogg">
      <div className={styles.paWrap}>
        <Reveal className={styles.paSecHead}>
          <div>
            <p className={styles.paKicker}>{content.blogEyebrow ?? '— Från redaktionen'}</p>
            <h2 className={styles.paSecTitle}>
              {content.blogTitle ?? 'Säsong, tips & inspiration'}
            </h2>
          </div>
          {moreHref && typeof limit === 'number' && allPosts.length > 0 ? (
            <Link href={moreHref} className={styles.paTextCta}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </Reveal>

        {posts.length === 0 ? (
          <p className={styles.paEmpty}>
            Redaktionen skriver. Under tiden berättar vi gärna i butiken —{' '}
            <Link href="/kontakt">hör av dig till {tenantName}</Link>.
          </p>
        ) : (
          <ol className={styles.paArtList}>
            {posts.map((post, i) => {
              const date = formatPostDate(post.publishedAt)
              return (
                <li key={post.id} className={styles.paArtRow}>
                  <Reveal delay={(i % 3) * 60} className={styles.paArtInner}>
                    <div className={styles.paArtText}>
                      <p className={styles.paArtMeta}>
                        <span className={styles.paPlateNum} aria-hidden="true">
                          {serviceNum(i)}
                        </span>
                        {date ? <span>{date}</span> : null}
                      </p>
                      <h3 className={styles.paArtHead}>
                        <PostTitle post={post} />
                      </h3>
                      {post.excerpt ? <p className={styles.paArtIngress}>{post.excerpt}</p> : null}
                      {post.slug ? (
                        <Link href={`/blogg/${post.slug}`} className={styles.paArtRead}>
                          Läs artikeln <span aria-hidden="true">→</span>
                        </Link>
                      ) : null}
                    </div>
                    {post.coverImageUrl ? (
                      <div
                        className={styles.paArtPlate}
                        style={{ backgroundImage: `url(${post.coverImageUrl})` }}
                        role="img"
                        aria-label={post.coverImageAlt ?? post.title}
                      />
                    ) : null}
                  </Reveal>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
