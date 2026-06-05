import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { listCustomersAllTenants } from '@/lib/platform/people'
import { listTenants } from '@/lib/platform/tenants'
import { hasServiceRole } from '@/lib/platform/service'
import { KunderView } from '@/components/platform/kunder/KunderView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Kunder' }

/**
 * §2.1B "Supabase med mitt UI" — cross-tenant kundsök (law: SuperData.jsx →
 * SuperCustomers). Search any customer across EVERY salon (the foundation read
 * OMITS the tenant filter; RLS returns all rows for the platform_admin JWT). The
 * page self-gates with requirePlatformAdmin in addition to the (platform) layout —
 * defence in depth, never the only fence.
 *
 * The server resolves the live data + honest aggregates; the client KunderView
 * owns the mock's exact chrome (PageHead actions, stat grid, filter row, table,
 * drawers) so the "Exportera" / "Lägg till kund" actions can be wired client-side.
 *
 * HONESTY (NEVER FAKE): stat cards bind LIVE aggregates derived from the actual
 * list (total / med konto / gäster / salonger), NOT the mock's hardcoded
 * "3 087 · 412 · 9". The mock's "Reset (7 dgr)" pill is dropped — no telemetry
 * backs a 7-day reset count, and a fake live number is worse than an honest swap.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tenant?: string }>
}) {
  await requirePlatformAdmin()

  const sp = await searchParams
  const q = sp.q ?? ''
  const tenant = sp.tenant ?? 'all'

  // The salong dropdown binds the real tenant list (id + name + slug). It also
  // resolves a customer's slug → tenant id when wiring the password-reset action,
  // since the foundation read exposes only the slug (not the id).
  const [customers, tenants] = await Promise.all([
    listCustomersAllTenants({ q, tenant }),
    listTenants(),
  ])

  return (
    <section className="portal-section">
      <KunderView
        customers={customers}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug, status: t.status }))}
        q={q}
        tenant={tenant}
        serviceRoleAvailable={hasServiceRole()}
      />
    </section>
  )
}
