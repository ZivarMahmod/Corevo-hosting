import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BloggPostView } from '@/components/storefront/blogg/BloggPostView'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadBlogPostBySlug } from '@/lib/storefront/blogg/load-blogg-post'
import { loadPreviewPage, PreviewModuleOff } from '../../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Förhandsvisning · Blogginlägg',
  robots: { index: false },
}

export default async function PreviewBloggPostPage(props: {
  params: Promise<{ slug: string; postSlug: string }>
  searchParams: Promise<{ theme?: string; copy?: string }>
}) {
  const {
    params: { postSlug },
    bundle,
    theme,
    copyMode,
  } = await loadPreviewPage(props)
  const states = await getTenantModuleStates(bundle.tenant.id, bundle.tenant.slug)
  const off = !isModuleLive(states, 'blogg')

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Blogg" />
  } else {
    const post = await loadBlogPostBySlug(bundle.tenant.id, bundle.tenant.slug, postSlug)
    if (!post) notFound()
    body = <BloggPostView post={post} />
  }

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {body}
    </StorefrontShell>
  )
}
