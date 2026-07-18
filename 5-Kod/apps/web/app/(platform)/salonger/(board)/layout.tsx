import { listTenantsWithStats } from '@/lib/platform/tenants'
import { SalongerBoard, type SalongCardVM } from '@/components/platform/SalongerBoard'

export const dynamic = 'force-dynamic'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

function tenantPublicUrl(slug: string): string {
  const local = ROOT.includes('localhost') || ROOT.includes('127.0.0.1')
  return `${local ? 'http' : 'https'}://${slug}.${ROOT}`
}

/** Formateras en gång på servern så masterraden inte får hydrationsdrift. */
function relativeTenantActivity(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return '—'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'nyss'
  if (minutes < 60) return `för ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `för ${hours} tim`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'för 1 dag' : `för ${days} dagar`
}

/** Masterlistan ägs av layouten och lever kvar när bara detalj-childen byts. */
export default async function SalongerLayout({ children }: { children: React.ReactNode }) {
  const tenants = await listTenantsWithStats()
  const rows: SalongCardVM[] = tenants.map((tenant) => ({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    markColor: tenant.markColor,
    owner: tenant.ownerName ?? tenant.owner,
    themeLabel: tenant.themeLabel,
    variantLabel: tenant.variantLabel,
    level: tenant.level,
    bookings: tenant.bookings,
    completed: tenant.completed,
    staff: tenant.staff,
    displayStatus: tenant.displayStatus,
    lastLabel: relativeTenantActivity(tenant.lastActivityAt),
    storefrontUrl: tenantPublicUrl(tenant.slug),
  }))

  return <SalongerBoard tenants={rows}>{children}</SalongerBoard>
}
