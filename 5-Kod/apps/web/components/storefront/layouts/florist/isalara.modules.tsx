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
import styles from './isalara.module.css'

/**
 * ISALARA — mallens EGNA modul-vyer (goal-59, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN (data, livscykel, varukorg, kassa) — vyerna nedan är
 * synkrona presentationskomponenter som bara byter FORM. Allt ShopSection gör gör
 * IsalaraShop också: AddToCart per produkt (utom pausad), pausad-notis (role=status),
 * formatShopPrice, leveranslöftet, /shop/{id}-länk, limit+moreHref, tom-text, och
 * bild-fallback (sandfärgad platta) när imageUrl saknas.
 *
 *   BUTIK  HÖGA ELEGANTA KORT — mallens 4/5-ratio, radie 0, namn i Cormorant och
 *          priset i display-serif föregånget av mallens GULD-PRICK (samma prick som
 *          prislistans tvåspalt på hemmet). Köp-rälsen ligger i kortets fot.
 *   BLOGG  TVÅ STORA INLÄGG FÖRST (4/5-cover + script-fri serif-rubrik), resten som
 *          en LISTA med guld-prick + datum — exakt hemmets prisrad, fast för texter.
 *
 * Modulens egen sida öppnar i samma MARINBLÅ platta (islPageHead) med SKRIPT-rubrik
 * som /om, /tjanster, /kontakt — besökaren lämnar aldrig mallens vektor.
 */

/** Svensk postdatum-sträng ("3 juni 2026"). Samma mönster som BloggSection. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═══════════════════════════════  BUTIK  ═══════════════════════════════ */
export function IsalaraShop({
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
  const teaser = typeof limit === 'number'

  // Startsidans teaser + LIVE men tom butik → rendera inget (inga "visas snart"-löften).
  if (teaser && allProducts.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)
  const label = SHOP_FULFILMENT_LABELS[config.fulfilment]

  const grid =
    products.length > 0 ? (
      <div className={styles.islCardGrid}>
        {products.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i, 6) * 90}>
            <article className={styles.islShopCard}>
              {/* Bild + namn länkar till produktsidan — INTE hela kortet, så köp-
                  knappen nedanför förblir klickbar. */}
              <Link
                href={`/shop/${p.id}`}
                className={styles.islCard}
                aria-label={`${p.name} — visa produkt`}
              >
                <div className={styles.islCardImgWrap}>
                  {/* imageUrl saknas → sandfärgad platta (--color-accent-soft), aldrig krasch. */}
                  <div
                    className={styles.islCardImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    role={p.imageUrl ? 'img' : undefined}
                    aria-label={p.imageUrl ? (p.imageAlt ?? p.name) : undefined}
                  />
                </div>
                <h3 className={styles.islCardName}>{p.name}</h3>
              </Link>
              <div className={styles.islShopBody}>
                {p.description ? <p className={styles.islCardMeta}>{p.description}</p> : null}
                <p className={styles.islShopPrice}>
                  <span className={styles.islPriceDot} aria-hidden="true" />
                  <span className={styles.islPriceValue}>
                    {formatShopPrice(p.priceCents, p.currency)}
                  </span>
                </p>
                {/* Pausad butik → INGEN köp-CTA. Katalogen läses, men handlas inte. */}
                {paused ? null : (
                  <div className={styles.islShopCart}>
                    <AddToCart product={p} fulfilment={config.fulfilment} />
                  </div>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    ) : null

  const notice = paused ? (
    <p role="status" className={styles.islNotice}>
      Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
    </p>
  ) : null

  /* Teaser-läge (startsidan): mallens sektionsrytm — rubrikrad + kort + länk. */
  if (teaser) {
    return (
      <section className={styles.islSection} data-module="shop" data-fulfilment={config.fulfilment}>
        <Reveal as="div" className={styles.islSecHead}>
          <div>
            <p className={styles.islEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.islTitle}>{content.shopTitle ?? 'Beställ något vackert'}</h2>
            {/* Leveranslöftet står direkt under rubriken — kunden vet HUR hen får blommorna. */}
            <p className={styles.islBody}>
              {label} — {promise}
            </p>
          </div>
          {moreHref && allProducts.length > 0 ? (
            <Link href={moreHref} className={styles.islLink}>
              {content.shopCta ?? 'Visa hela butiken'}
            </Link>
          ) : null}
        </Reveal>
        {notice ? <div className={styles.islNoticeWrap}>{notice}</div> : null}
        {grid}
        {moreHref && clipped && allProducts.length > 0 ? (
          <p className={styles.islModMore}>
            <Link href={moreHref} className={styles.islLink}>
              {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
            </Link>
          </p>
        ) : null}
      </section>
    )
  }

  /* Modulens EGEN sida: marinblå platta + skript-rubrik, precis som /om & /tjanster. */
  return (
    <div className={styles.islPage} data-module="shop" data-fulfilment={config.fulfilment}>
      <header className={styles.islPageHead}>
        <p className={styles.islPageEyebrow}>
          {content.shopEyebrow ?? '— Ur butiken'} · {label}
        </p>
        <h1 className={styles.islPageTitle}>{content.shopTitle ?? 'Beställ något vackert'}</h1>
        <p className={styles.islPageLede}>{promise}</p>
      </header>

      <section className={styles.islSection}>
        {notice ? <div className={styles.islNoticeWrap}>{notice}</div> : null}
        {products.length === 0 ? (
          // ÄRLIG tom-text — aldrig påhittade produkter.
          <Reveal className={styles.islEmpty}>
            <p className={styles.islBody}>
              Sortimentet fylls på. Hör av dig till {tenantName} så binder vi något efter din
              önskan.
            </p>
            <div className={styles.islEmptyCta}>
              <Link href="/kontakt" className={styles.islBtn}>
                Kontakta oss
              </Link>
            </div>
          </Reveal>
        ) : (
          grid
        )}
      </section>
    </div>
  )
}

/* ═══════════════════════════════  BLOGG  ═══════════════════════════════ */

/** Inlägg utan slug renderas OLÄNKADE (legacy-rader), aldrig som trasig länk. */
function PostLink({
  post,
  className,
  children,
}: {
  post: BloggPost
  className?: string
  children: React.ReactNode
}) {
  if (!post.slug) return <div className={className}>{children}</div>
  return (
    <Link href={`/blogg/${post.slug}`} className={className}>
      {children}
    </Link>
  )
}

/** De två stora: 4/5-cover + datum + rubrik + ingress. */
function IsalaraLead({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <article className={styles.islShopCard}>
      <PostLink post={post} className={styles.islCard}>
        <div className={styles.islCardImgWrap}>
          <div
            className={styles.islLeadImg}
            style={post.coverImageUrl ? { backgroundImage: `url(${post.coverImageUrl})` } : undefined}
            role={post.coverImageUrl ? 'img' : undefined}
            aria-label={post.coverImageUrl ? (post.coverImageAlt ?? post.title) : undefined}
          />
        </div>
        {date ? <p className={styles.islPostDate}>{date}</p> : null}
        <h3 className={styles.islLeadTitle}>{post.title}</h3>
        {post.excerpt ? <p className={styles.islCardMeta}>{post.excerpt}</p> : null}
      </PostLink>
    </article>
  )
}

/** Resten: mallens prisrad, fast för texter — guld-prick, rubrik, datum till höger. */
function IsalaraRow({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <li>
      <PostLink post={post} className={styles.islPostRow}>
        <span className={styles.islPriceDot} aria-hidden="true" />
        <span className={styles.islPriceMain}>
          <span className={styles.islPriceName}>{post.title}</span>
          {post.excerpt ? <span className={styles.islPriceDesc}>{post.excerpt}</span> : null}
        </span>
        {date ? <span className={styles.islPostRowDate}>{date}</span> : null}
      </PostLink>
    </li>
  )
}

export function IsalaraBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts
  if (teaser && allPosts.length === 0) return null

  const leads = posts.slice(0, 2)
  const rest = posts.slice(2)

  const body =
    posts.length > 0 ? (
      <>
        {leads.length > 0 ? (
          <div className={styles.islLeadGrid}>
            {leads.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <IsalaraLead post={p} />
              </Reveal>
            ))}
          </div>
        ) : null}
        {rest.length > 0 ? (
          <ul className={styles.islPostList}>
            {rest.map((p) => (
              <IsalaraRow key={p.id} post={p} />
            ))}
          </ul>
        ) : null}
      </>
    ) : null

  if (teaser) {
    return (
      <section className={`${styles.islSection} ${styles.islSectionSoft}`} data-module="blogg">
        <Reveal as="div" className={styles.islSecHead}>
          <div>
            <p className={styles.islEyebrow}>{content.blogEyebrow ?? '— Från floristen'}</p>
            <h2 className={styles.islTitle}>
              {content.blogTitle ?? 'Säsong, tips & inspiration'}
            </h2>
          </div>
          {moreHref ? (
            <Link href={moreHref} className={styles.islLink}>
              {content.blogCta ?? 'Läs hela bloggen'}
            </Link>
          ) : null}
        </Reveal>
        {body}
        {moreHref && posts.length < allPosts.length ? (
          <p className={styles.islModMore}>
            <Link href={moreHref} className={styles.islLink}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <div className={styles.islPage} data-module="blogg">
      <header className={styles.islPageHead}>
        <p className={styles.islPageEyebrow}>{content.blogEyebrow ?? '— Från floristen'}</p>
        <h1 className={styles.islPageTitle}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h1>
        <p className={styles.islPageLede}>Nyheter, tips och inspiration från oss.</p>
      </header>

      <section className={styles.islSection}>
        {posts.length === 0 ? (
          // ÄRLIG tom-text — aldrig påhittade inlägg.
          <Reveal className={styles.islEmpty}>
            <p className={styles.islBody}>
              Här skriver vi om säsong, binderi och blommornas liv. Första inlägget är på väg.
            </p>
            <div className={styles.islEmptyCta}>
              <Link href="/kontakt" className={styles.islBtn}>
                Kontakta oss
              </Link>
            </div>
          </Reveal>
        ) : (
          body
        )}
      </section>
    </div>
  )
}
