import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadBlogPostBySlug } from '@/lib/storefront/blogg/load-blogg-post'
import s from './post.module.css'

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
      <div className={`section-inner ${s.inner}`}>
        <p className={s.back}>
          <Link href="/blogg" className={s.backLink}>
            ← Alla inlägg
          </Link>
        </p>

        {post.coverImageUrl ? (
          <div className={s.cover}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              className={s.coverImg}
            />
          </div>
        ) : null}

        {date ? <p className={s.date}>{date}</p> : null}

        {/* Titelns toppmarginal skiljer sig inte längre beroende på datum — .date äger
            avståndet nedåt via .title's margin-top, som är samma i båda fallen. */}
        <h1 className={s.title}>{post.title}</h1>

        <div className={s.body}>
          {paragraphs.map((text, i) => (
            // Första stycket = ingress (.para:first-child i CSS), ingen villkorad margin i JSX.
            <p key={i} className={s.para}>
              {text}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
