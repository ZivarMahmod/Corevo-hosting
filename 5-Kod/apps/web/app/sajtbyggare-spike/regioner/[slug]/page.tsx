// S1 marked-render spike (F3) — a flag-gated surface that renders a tenant's
// cascade-resolved editable regions with their data-editable markers (the S1 data
// layer made visible for verification — NOT the editor, which is S2). Mirrors the
// S0 spike route: explicit slug param (works on *.workers.dev without a tenant
// subdomain) + SAJTBYGGARE_ENABLED gate (OFF in prod → notFound → zero public
// surface). The 5 React themes + FreshCut are untouched; this is a separate route.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { loadSiteContent } from '@/lib/sajtbyggare/load-site-content'
import { MarkedRegions } from '@/lib/sajtbyggare/marked-regions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sajtbyggare S1 — markerade regioner' }

export default async function SajtbyggareRegionerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  if (!sajtbyggareEnabled()) notFound() // off in prod → zero public surface
  const { slug } = await params
  const content = await loadSiteContent(slug)
  if (!content) notFound()

  return (
    <main
      data-world="sajtbyggare-spike"
      data-surface="marked-regions"
      data-template={content.templateKey}
      data-vertical={content.verticalId ?? ''}
    >
      <MarkedRegions regions={content.regions} />
    </main>
  )
}
