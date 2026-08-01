import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OpenLinkExchange } from '@/components/customer-portal/OpenLinkExchange'

const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

export const metadata: Metadata = {
  title: 'Öppnar din bokning · Corevo',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

export default async function OpenCustomerPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tenantSlug } = await params
  const query = searchParams ? await searchParams : {}
  if (!TENANT_SLUG_PATTERN.test(tenantSlug) || Object.keys(query).length > 0) notFound()

  return (
    <main>
      <OpenLinkExchange tenantSlug={tenantSlug} />
      <noscript>
        <section>
          <h1>JavaScript behövs för att öppna den säkra länken</h1>
          <p>
            Aktivera JavaScript och ladda om sidan, eller be om en ny kod. Inga bokningsuppgifter
            har visats.
          </p>
          <p>
            <Link href={`/aterhamta/${tenantSlug}`}>Be om en ny kod</Link>{' '}
            <Link href="/hjalp">Hjälp</Link>
          </p>
        </section>
      </noscript>
    </main>
  )
}
