// Callers render this section only for a live blogg module.

import { SectionHeader, SubpageHero } from './sections'
import s from './blogg-section.module.css'
import {
  bloggLayoutLabel,
  formatBloggLongDate,
  type BloggData,
  type BloggPost,
} from '@/lib/storefront/blogg/types'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import { BloggPagination } from './blogg/BloggPagination'

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
  const date = formatBloggLongDate(post.publishedAt)
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
  const date = formatBloggLongDate(post.publishedAt)
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
  const date = formatBloggLongDate(post.publishedAt)
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

/** Resolve + render the blogg section for one live tenant module. */
export async function BloggSection({
  tenantId,
  slug,
  limit,
  moreHref,
  pageHero = false,
  page = 1,
  data,
}: {
  tenantId: string
  slug: string
  /** Teaser-läge (startsidan): visa max så här många inlägg. */
  limit?: number
  /** Länk till bloggens EGEN sida ("Läs hela bloggen →"). */
  moreHref?: string
  /** Modulens EGEN sida: hero-bandet i stället för SectionHeader (goal-57). */
  pageHero?: boolean
  /** Publik listsida. Teasers använder alltid sida 1. */
  page?: number
  /** Redan laddad data när routen också behöver totalen. */
  data?: BloggData | null
}) {
  const resolvedData = data === undefined ? await loadBloggData(tenantId, slug, page) : data
  if (!resolvedData) return null

  const { config, posts: allPosts, pagination } = resolvedData
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
          {typeof limit !== 'number' ? (
            <BloggPagination page={pagination.page} totalPages={pagination.totalPages} />
          ) : null}
        </div>
      </section>
    </>
  )
}
