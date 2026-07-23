import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { InstallPromptCard } from '@/components/customer-portal/InstallPromptCard'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { getPortalSessionSnapshot } from '@/lib/customer-portal/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata(): Promise<Metadata> {
  const session = await getPortalSessionSnapshot()
  return {
    title: session.outcome === 'ok'
      ? `Installera – ${session.snapshot.tenantName}`
      : 'Installera – Corevo',
    robots: { index: false, follow: false },
  }
}

export default async function CustomerPortalInstallPage() {
  const session = await getPortalSessionSnapshot()
  if (session.outcome === 'expired' && session.recoveryTenantSlug) {
    redirect(`/aterhamta/${session.recoveryTenantSlug}?session=expired`)
  }
  if (session.outcome !== 'ok') {
    return (
      <PortalShell active="profile">
        <section className="cp-card cp-error"><h1>Installationen kunde inte visas</h1></section>
      </PortalShell>
    )
  }

  return (
    <PortalShell
      active="profile"
      customerName={session.snapshot.customerName}
      tenantName={session.snapshot.tenantName}
      tenantSlug={session.snapshot.tenantSlug}
    >
      <section className="cp-screen cp-install-page">
        <p className="cp-page-kicker">COREVO PÅ HEMSKÄRMEN</p>
        <h1>Installera på hemskärmen</h1>
        <InstallPromptCard placement="page" />
      </section>
    </PortalShell>
  )
}
