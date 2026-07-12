// Blogg storefront SECTION (multi-bransch spår 5, §15 skelett vs skin).
//
// SERVER component. The SECTION reads module data (published posts + resolved
// config via loadBloggData); the TEMPLATE/skin gives the look. Per §15: "funktioner
// bor i MODULEN, inte i mallen" — this section IS the blogg module's storefront
// surface, injected at the module's default_section_position ('main', per 0034). It
// styles itself with the storefront design tokens (var(--color-*) / var(--font-*)),
// the SAME token-driven approach as ShopSection / OffertSection — no new palette, so
// it blends into whichever skin the tenant runs.
//
// GATING (caller contract): render this ONLY when the tenant's blogg module is
// LIVE. The call site (storefront page) resolves tenant_modules.state via
// getTenantModuleStates() + isModuleLive(states,'blogg') and renders <BloggSection>
// only then — EXACTLY the booking + shop + offert gate shape. draft/off never reach
// here; a PAUSED blogg renders the section read-only (an archive notice over the
// posts) — same contract as the booking paused banner / paused shop / paused offert.
//
// PRESENTATION VARIANTS (config-first, beslut 14.5): the section behaves per the
// resolved variant via the pure helpers in lib/storefront/blogg/types.ts:
//   list     → stapel av inlägg (rubrik + ingress).
//   grid     → kort i rutnät (samma rytm som shop-katalogen).
//   featured → första inlägget stort + resten som lista.
// No `if (bransch)` anywhere — only the variant drives the difference.
//
// NO PAYMENT (unlike shop/offert): a blog publishes content and never touches money,
// so there is no CTA, no pay step, no order — nothing money-bearing in this surface.

import { SectionHeader, SubpageHero } from './sections'
import s from './blogg-section.module.css'
import { bloggLayoutLabel, type BloggData, type BloggPost } from '@/lib/storefront/blogg/types'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'

/** Format an ISO timestamp as a Swedish post date ("3 juni 2026"). Pure, locale-
 *  aware; returns null when there is no date so the caller can omit the line. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Wrap a post rendering in a link to its detail page (/blogg/[slug]). Posts without
 *  a slug (legacy rows) render UNLINKED — a /blogg/null href would be a 404-trap —
 *  but keep the exact same shape, so the list rhythm never breaks. Hover/fokus bor i
 *  CSS-modulen (`.link`), aldrig inline: inline kan inte bära pseudoklasser. */
function PostLink({
  post,
  className,
  children,
}: {
  post: BloggPost
  className?: string
  children: React.ReactNode
}) {
  const cls = className ? `${s.link} ${className}` : s.link
  if (!post.slug) return <div className={cls}>{children}</div>
  return (
    <a href={`/blogg/${post.slug}`} className={cls}>
      {children}
    </a>
  )
}

/** A single post rendered as a card (used by the grid layout). Same card anatomy as
 *  the shop product card — de delar --sf-card-*-tokens, så en mall stämmer bägge i ett
 *  block. */
function PostCard({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <li className={s.card}>
      <PostLink post={post} className={s.cardLink}>
        <div className={s.media}>
          {post.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              loading="lazy"
              className={s.img}
            />
          ) : null}
        </div>
        <div className={s.cardBody}>
          {date ? <p className={s.date}>{date}</p> : null}
          <h3 className={`${s.title} ${s.titleCard}`}>{post.title}</h3>
          {post.excerpt ? <p className={`${s.excerpt} ${s.excerptCard}`}>{post.excerpt}</p> : null}
        </div>
      </PostLink>
    </li>
  )
}

/** A single post rendered as a stacked row (used by the list layout + the featured
 *  tail). Lighter than a card — rubrik + ingress, optional thumbnail. */
function PostRow({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <li className={s.row}>
      <PostLink
        post={post}
        className={post.coverImageUrl ? `${s.rowLink} ${s.rowLinkMedia}` : s.rowLink}
      >
        <div>
          {date ? <p className={s.date}>{date}</p> : null}
          <h3 className={`${s.title} ${s.titleRow}`}>{post.title}</h3>
          {post.excerpt ? <p className={s.excerpt}>{post.excerpt}</p> : null}
        </div>
        {post.coverImageUrl ? (
          <div className={`${s.media} ${s.mediaRounded}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              loading="lazy"
              className={s.img}
            />
          </div>
        ) : null}
      </PostLink>
    </li>
  )
}

/** The featured layout's lead: the first post rendered large (cover + rubrik +
 *  ingress), with the remaining posts stacked underneath as rows. */
function FeaturedLead({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <article className={s.featured}>
      <PostLink post={post} className={s.featuredLink}>
        <div className={`${s.media} ${s.mediaLead} ${s.mediaRounded}`}>
          {post.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              loading="lazy"
              className={s.img}
            />
          ) : null}
        </div>
        <div>
          {date ? <p className={s.date}>{date}</p> : null}
          <h3 className={`${s.title} ${s.titleLead}`}>{post.title}</h3>
          {post.excerpt ? <p className={`${s.excerpt} ${s.excerptLead}`}>{post.excerpt}</p> : null}
        </div>
      </PostLink>
    </article>
  )
}

/** Resolve + render the blogg section for one tenant. Returns null when there is
 *  nothing to show (no blogg module row) so the caller can compose unconditionally.
 *  `paused` renders the posts read-only with an archive notice. */
export async function BloggSection({
  tenantId,
  slug,
  paused = false,
  limit,
  moreHref,
  pageHero = false,
}: {
  tenantId: string
  slug: string
  /** true when tenant_modules.state='blogg' is 'paused' → posts visible, archive. */
  paused?: boolean
  /** Teaser-läge (startsidan): visa max så här många inlägg. */
  limit?: number
  /** Länk till bloggens EGEN sida ("Läs hela bloggen →"). */
  moreHref?: string
  /** Modulens EGEN sida: hero-bandet i stället för SectionHeader (goal-57). */
  pageHero?: boolean
}) {
  const data: BloggData | null = await loadBloggData(tenantId, slug)
  if (!data) return null

  const { config, posts: allPosts } = data
  const posts = typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts
  // Teaser på startsidan + noll publicerade inlägg → rendera inget (S12).
  if (typeof limit === 'number' && allPosts.length === 0) return null

  return (
    <>
      {pageHero ? (
        <SubpageHero
          eyebrow={`— Blogg · ${bloggLayoutLabel(config.layout)}`}
          title="Från bloggen"
          lede="Nyheter, tips och inspiration från oss."
        />
      ) : null}
    <section className="section" data-module="blogg" data-layout={config.layout}>
      <div className="section-inner">
        {!pageHero ? (
          <SectionHeader
            eyebrow={`— Blogg · ${bloggLayoutLabel(config.layout)}`}
            title="Från bloggen"
            lead="Nyheter, tips och inspiration från oss."
          />
        ) : null}

        {paused ? (
          <p role="status" className={s.notice}>
            Bloggen är pausad just nu — äldre inlägg visas, men inga nya publiceras för tillfället.
          </p>
        ) : null}

        {posts.length === 0 ? (
          <p className={s.empty}>Inlägg visas snart.</p>
        ) : config.layout === 'list' ? (
          <ul className={s.list}>
            {posts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </ul>
        ) : config.layout === 'featured' ? (
          <>
            {posts[0] ? <FeaturedLead post={posts[0]} /> : null}
            {posts.length > 1 ? (
              <ul className={`${s.list} ${s.featuredTail}`}>
                {posts.slice(1).map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <ul className={s.grid}>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </ul>
        )}

        {moreHref && typeof limit === 'number' && allPosts.length > 0 ? (
          <p className={s.moreWrap}>
            <a href={moreHref} className={s.more}>
              Läs hela bloggen →
            </a>
          </p>
        ) : null}
      </div>
    </section>
    </>
  )
}
