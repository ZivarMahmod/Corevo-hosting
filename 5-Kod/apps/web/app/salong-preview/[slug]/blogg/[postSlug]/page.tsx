import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BloggPostView } from '@/components/storefront/blogg/BloggPostView'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadBlogPostBySlug } from '@/lib/storefront/blogg/load-blogg-post'
import {
  loadPreviewBundle,
  PreviewModuleOff,
  PreviewShell,
  resolvePreviewCopyMode,
  resolvePreviewTheme,
} from '../../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Förhandsvisning · Blogginlägg',
  robots: { index: false },
}

export default async function PreviewBloggPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; postSlug: string }>
  searchParams: Promise<{ theme?: string; copy?: string }>
}) {
  const { slug, postSlug } = await params
  const { theme: themeParam, copy: copyParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const copyMode = resolvePreviewCopyMode(copyParam)
  const states = await getTenantModuleStates(bundle.tenant.id, bundle.tenant.slug)
  const paused = isModulePaused(states, 'blogg')
  const off = !isModuleLive(states, 'blogg') && !paused

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Blogg" />
  } else {
    const post = await loadBlogPostBySlug(bundle.tenant.id, bundle.tenant.slug, postSlug)
    if (!post) notFound()
    body = <BloggPostView post={post} />
  }

  return (
    <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>
      {body}
    </PreviewShell>
  )
}
