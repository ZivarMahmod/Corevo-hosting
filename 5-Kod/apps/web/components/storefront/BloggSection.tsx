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

/** Wrap a post rendering in a link to its detail page (/blogg/[slug]) WITHOUT
 *  changing the visuals: no underline, inherited color, pointer cursor. Posts
 *  without a slug (legacy rows) render unlinked, exactly as before. */
function PostLink({
  post,
  style,
  children,
}: {
  post: BloggPost
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  if (!post.slug) return <div style={style}>{children}</div>
  return (
    <a
      href={`/blogg/${post.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', ...style }}
    >
      {children}
    </a>
  )
}

/** A single post rendered as a card (used by the grid layout + the featured tail
 *  when it falls back to cards). Token-styled, mirrors the shop product card. */
function PostCard({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'color-mix(in srgb, var(--color-fg, #232520) 3%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 10%, transparent)',
        borderRadius: 'calc(var(--radius, 4px) * 2)',
        overflow: 'hidden',
      }}
    >
      <PostLink post={post} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div
        style={{
          aspectRatio: '4 / 3',
          background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
        }}
      >
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? post.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {date ? (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'color-mix(in srgb, var(--color-fg, #232520) 55%, transparent)',
            }}
          >
            {date}
          </p>
        ) : null}
        <h3
          style={{
            margin: date ? '8px 0 0' : 0,
            fontFamily: 'var(--font-display, var(--font-body))',
            fontSize: 17,
            color: 'var(--color-fg, #232520)',
          }}
        >
          {post.title}
        </h3>
        {post.excerpt ? (
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              lineHeight: 1.5,
              color: 'color-mix(in srgb, var(--color-fg, #232520) 72%, transparent)',
            }}
          >
            {post.excerpt}
          </p>
        ) : null}
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
    <li
      style={{
        padding: '20px 0',
        borderTop: '1px solid color-mix(in srgb, var(--color-fg, #232520) 10%, transparent)',
      }}
    >
      <PostLink
        post={post}
        style={{
          display: 'grid',
          gridTemplateColumns: post.coverImageUrl ? 'minmax(0, 1fr) 140px' : '1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
      <div>
        {date ? (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'color-mix(in srgb, var(--color-fg, #232520) 55%, transparent)',
            }}
          >
            {date}
          </p>
        ) : null}
        <h3
          style={{
            margin: date ? '6px 0 0' : 0,
            fontFamily: 'var(--font-display, var(--font-body))',
            fontSize: 20,
            color: 'var(--color-fg, #232520)',
          }}
        >
          {post.title}
        </h3>
        {post.excerpt ? (
          <p
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              lineHeight: 1.6,
              color: 'color-mix(in srgb, var(--color-fg, #232520) 72%, transparent)',
            }}
          >
            {post.excerpt}
          </p>
        ) : null}
      </div>
      {post.coverImageUrl ? (
        <div
          style={{
            aspectRatio: '4 / 3',
            borderRadius: 'calc(var(--radius, 4px) * 2)',
            overflow: 'hidden',
            background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? post.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
    <article style={{ marginTop: 28 }}>
      <PostLink
        post={post}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 28,
          alignItems: 'center',
        }}
      >
      <div
        style={{
          aspectRatio: '16 / 10',
          borderRadius: 'calc(var(--radius, 4px) * 2)',
          overflow: 'hidden',
          background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
        }}
      >
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? post.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </div>
      <div>
        {date ? (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'color-mix(in srgb, var(--color-fg, #232520) 55%, transparent)',
            }}
          >
            {date}
          </p>
        ) : null}
        <h3
          style={{
            margin: date ? '10px 0 0' : 0,
            fontFamily: 'var(--font-display, var(--font-body))',
            fontSize: 28,
            lineHeight: 1.2,
            color: 'var(--color-fg, #232520)',
          }}
        >
          {post.title}
        </h3>
        {post.excerpt ? (
          <p
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              lineHeight: 1.6,
              color: 'color-mix(in srgb, var(--color-fg, #232520) 75%, transparent)',
            }}
          >
            {post.excerpt}
          </p>
        ) : null}
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
          <p
            role="status"
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-fg, #232520)',
              background: 'color-mix(in srgb, var(--color-accent, #C8A24A) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent, #C8A24A) 30%, transparent)',
              borderRadius: 'var(--radius, 4px)',
              padding: '10px 14px',
            }}
          >
            Bloggen är pausad just nu — äldre inlägg visas, men inga nya publiceras för tillfället.
          </p>
        ) : null}

        {posts.length === 0 ? (
          <p
            style={{
              marginTop: 16,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'color-mix(in srgb, var(--color-fg, #232520) 70%, transparent)',
            }}
          >
            Inlägg visas snart.
          </p>
        ) : config.layout === 'list' ? (
          <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0 }}>
            {posts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </ul>
        ) : config.layout === 'featured' ? (
          <>
            {posts[0] ? <FeaturedLead post={posts[0]} /> : null}
            {posts.length > 1 ? (
              <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
                {posts.slice(1).map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: '28px 0 0',
              padding: 0,
              display: 'grid',
              gap: 24,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </ul>
        )}

        {moreHref && typeof limit === 'number' && allPosts.length > 0 ? (
          <p style={{ margin: '24px 0 0' }}>
            <a
              href={moreHref}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--color-primary, #232520)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--color-primary, #232520)',
                paddingBottom: 2,
              }}
            >
              Läs hela bloggen →
            </a>
          </p>
        ) : null}
      </div>
    </section>
    </>
  )
}
