import type { Metadata } from 'next'
import { listTenantsWithStats } from '@/lib/platform/tenants'
import { SalongerClient, type SalongCardVM } from '@/components/platform/SalongerClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Salonger' }

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'
function publicUrl(slug: string): string {
  const isLocal = ROOT.includes('localhost') || ROOT.includes('127.0.0.1')
  return `${isLocal ? 'http' : 'https'}://${slug}.${ROOT}`
}

/** Relative "senast aktiv" label, formatted once on the server at request time so
 *  the client never recomputes (no hydration drift). Derived from the salon's most
 *  recent booking; "—" when the salon has no activity yet. */
function relTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return '—'
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'nyss'
  if (min < 60) return `för ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `för ${hr} tim`
  const d = Math.floor(hr / 24)
  return d === 1 ? 'för 1 dag' : `för ${d} dagar`
}

export default async function TenantsPage() {
  const tenants = await listTenantsWithStats()
  const vms: SalongCardVM[] = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    markColor: t.markColor,
    owner: t.owner,
    themeLabel: t.themeLabel,
    variantLabel: t.variantLabel,
    level: t.level,
    bookings: t.bookings,
    completed: t.completed,
    staff: t.staff,
    displayStatus: t.displayStatus,
    lastLabel: relTime(t.lastActivityAt),
    storefrontUrl: publicUrl(t.slug),
  }))
  return <SalongerClient tenants={vms} />
}
