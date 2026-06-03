import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { listStaffAllTenants } from '@/lib/platform/people'
import { listTenants } from '@/lib/platform/tenants'
import { PersonalClient } from '@/components/platform/PersonalClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Personal' }

/**
 * Personal (cross-tenant) — SuperData.jsx:SuperStaff (M6 §3.4 / M7 §2.4).
 * "Onboarda frisörer åt salonger som vill ha hjälp." The platform_admin sees
 * EVERY salon's staff (RLS bypass via listStaffAllTenants — the read OMITS the
 * tenant_id filter; a normal salon_admin running it only ever sees its own).
 *
 * Self-gates with requirePlatformAdmin() even though the (platform) layout does —
 * the task mandates per-page gating, and this route also needs the orchestrator to
 * add /personal-plattform to PROTECTED_PREFIXES + BACKOFFICE_PREFIXES (both frozen;
 * flagged in the manifest). Data is fetched unfiltered here and filtered in the
 * client island (search + status pills) — mirrors BookingsClient, and the volume
 * is tiny (only seeded salons have staff; sparse is honest, not a bug).
 *
 * PageHead lives in the island (not here) so the mock's "Bjud in personal" button
 * can sit in the header (SuperStaff line 121) where it carries its onClick — an
 * exact-copy of the law source, not the control row.
 */
export default async function PersonalPlatformPage() {
  await requirePlatformAdmin()
  // listTenants() feeds the invite-drawer salong dropdown (any salon can be the
  // invite target). Both reads are cross-tenant via the platform_admin JWT.
  const [staff, tenants] = await Promise.all([listStaffAllTenants(), listTenants()])

  return (
    <section className="portal-section">
      <PersonalClient staff={staff} tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} />
    </section>
  )
}
