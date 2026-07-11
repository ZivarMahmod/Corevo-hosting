import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadBlogPostBySlug } from '@/lib/storefront/blogg/load-blogg-post'

export const dynamic = 'force-dynamic'

/** Format an ISO timestamp as a Swedish post date ("3 juni 2026"). Same helper
 *  shape as BloggSection's — pure, returns null when there is no date. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const bundle = await currentTenant()
  if (!bundle) return {}
  const { tenant } = bundle
  const post = await loadBlogPostBySlug(tenant.id, tenant.slug, slug)
  if (!post) return {}
  return { title: tenant.name ? `${post.title} — ${tenant.name}` : post.title }
}

/** Ett enskilt blogginlägg — /blogg/[slug]. Samma modul-gate som /blogg. */
export default async function BloggPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'blogg')
  if (!isModuleLive(states, 'blogg') && !paused) notFound()

  const post = await loadBlogPostBySlug(tenant.id, tenant.slug, slug)
  if (!post) notFound()

  const date = formatPostDate(post.publishedAt)
  // body är PLAIN TEXT — stycken separeras med dubbla radbrytningar.
  const paragraphs = (post.body ?? '')
    .split(/\r?\n\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <section className="section" data-module="blogg" data-view="post">
      <div className="section-inner" style={{ maxWidth: 720 }}>
        <p style={{ margin: '0 0 24px' }}>
          <Link
            href="/blogg"
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
            ← Alla inlägg
          </Link>
        </p>

        {post.coverImageUrl ? (
          <div
            style={{
              aspectRatio: '16 / 9',
              borderRadius: 'calc(var(--radius, 4px) * 2)',
              overflow: 'hidden',
              background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
              marginBottom: 28,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : null}

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

        <h1
          style={{
            margin: date ? '10px 0 0' : 0,
            fontFamily: 'var(--font-display, var(--font-body))',
            fontSize: 36,
            lineHeight: 1.15,
            color: 'var(--color-fg, #232520)',
          }}
        >
          {post.title}
        </h1>

        <div style={{ marginTop: 24 }}>
          {paragraphs.map((text, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : '16px 0 0',
                fontFamily: 'var(--font-body)',
                fontSize: 16,
                lineHeight: 1.7,
                color: 'color-mix(in srgb, var(--color-fg, #232520) 82%, transparent)',
              }}
            >
              {text}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
