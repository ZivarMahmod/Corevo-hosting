import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadBlogPostBySlug } from '@/lib/storefront/blogg/load-blogg-post'
import { BloggPostView } from '@/components/storefront/blogg/BloggPostView'

export const dynamic = 'force-dynamic'

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
  const canonical = `/blogg/${post.slug}`
  const description = post.excerpt?.trim() || post.body?.replace(/\s+/g, ' ').trim().slice(0, 160)
  const images = post.coverImageUrl
    ? [{ url: post.coverImageUrl, alt: post.coverImageAlt ?? post.title }]
    : undefined
  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${post.title} · ${tenant.name}`,
      description,
      type: 'article',
      url: canonical,
      publishedTime: post.publishedAt ?? undefined,
      images,
    },
  }
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

  return <BloggPostView post={post} />
}
