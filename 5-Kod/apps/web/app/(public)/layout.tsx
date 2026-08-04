import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { currentTenant } from '@/lib/tenant-data'
import { requestOrigin } from '@/lib/url'

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await currentTenant()
  if (!bundle) return { title: 'Corevo' }
  const { tenant } = bundle
  const description = `${tenant.name} — hitta öppettider, utbud och kontakt, och boka eller handla online.`
  const origin = await requestOrigin()
  let metadataBase: URL | undefined
  try {
    metadataBase = new URL(origin)
  } catch {
    metadataBase = undefined
  }
  return {
    metadataBase,
    title: { default: tenant.name, template: `%s · ${tenant.name}` },
    description,
    alternates: { canonical: '/' },
    openGraph: { title: tenant.name, description, type: 'website', url: '/', siteName: tenant.name },
  }
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const bundle = await currentTenant()
  if (!bundle) notFound()

  return (
    <StorefrontShell bundle={bundle} surface="public">
      {children}
    </StorefrontShell>
  )
}
