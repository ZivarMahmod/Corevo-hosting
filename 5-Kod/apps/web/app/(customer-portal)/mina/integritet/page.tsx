import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { getPortalSessionSnapshot } from '@/lib/customer-portal/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata(): Promise<Metadata> {
  const session = await getPortalSessionSnapshot()
  return {
    title: session.outcome === 'ok'
      ? `Integritet – ${session.snapshot.tenantName}`
      : 'Integritet – Corevo',
    robots: { index: false, follow: false },
  }
}

export default async function CustomerPortalPrivacyPage() {
  const session = await getPortalSessionSnapshot()
  if (session.outcome === 'expired' && session.recoveryTenantSlug) {
    redirect(`/aterhamta/${session.recoveryTenantSlug}?session=expired`)
  }
  if (session.outcome !== 'ok') {
    return (
      <PortalShell active="profile">
        <section className="cp-card cp-error"><h1>Integriteten kunde inte visas</h1></section>
      </PortalShell>
    )
  }

  const { customerName, tenantName, tenantSlug } = session.snapshot
  return (
    <PortalShell
      active="profile"
      customerName={customerName}
      tenantName={tenantName}
      tenantSlug={tenantSlug}
    >
      <section className="cp-screen cp-privacy-screen">
        <h1>Integritet</h1>
        <div className="cp-card">
          <p>Vi sparar ditt namn, din verifierade kontaktuppgift och dina bokningar hos {tenantName}.</p>
          <p>Uppgifterna används bara för att hantera dina bokningar och skicka bekräftelser och påminnelser. De säljs aldrig vidare.</p>
          <p>Du använder inget lösenord. Din verifierade mobil eller e-post och dina enhetssessioner skyddar bokningarna.</p>
          <p>Vill du rätta eller radera dina uppgifter? Kontakta {tenantName} så hjälper de dig.</p>
        </div>
      </section>
    </PortalShell>
  )
}
