import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listCustomers } from '@/lib/admin/data'
import { relativeVisitSv, isInactiveSince } from '@/lib/admin/format'
import { KunderBoard } from '@/components/admin/KunderBoard'
import {
  CustomerWorkbenchList,
  type WorkbenchRow,
} from '@/components/admin/CustomerWorkbenchList'

export const dynamic = 'force-dynamic'

/** "yyyy-MM" i tenantens tidszon — för NY-taggen (kund som dök upp denna månad). */
function ymInTz(iso: string, timeZone: string): string {
  const d = new Date(iso)
  const y = new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone }).format(d)
  const m = new Intl.DateTimeFormat('en-CA', { month: '2-digit', timeZone }).format(d)
  return `${y}-${m}`
}

/** Kunder v2-skalet: master–detalj. Listan lever HÄR i layouten (hämtas en gång,
 *  ingen PII) så mjuk nav till /kunder/<id> aldrig laddar om den — bara kortet byts.
 *  Kortet (eller tomma läget) = {children}. */
export default async function KunderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminArea('kunder')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <>{children}</>

  const tz = tenant.timeZone
  const now = new Date()
  const nowYm = ymInTz(now.toISOString(), tz)
  const monthLabel = new Intl.DateTimeFormat('sv-SE', { month: 'long', timeZone: tz })
    .format(now)
    .toLowerCase()

  const everyone = await listCustomers(tenant.id)
  const rows: WorkbenchRow[] = everyone.map((c) => {
    const isNew = ymInTz(c.firstSeenAt, tz) === nowYm
    const tag: WorkbenchRow['tag'] = c.hidden ? 'DOLD' : isNew ? 'NY' : c.isReturning ? 'STAM' : null
    return {
      id: c.id,
      initial: (c.shownName.trim()[0] ?? '?').toUpperCase(),
      name: c.shownName,
      tag,
      last: relativeVisitSv(c.lastVisitTs, now),
      visits: c.visits,
      hidden: c.hidden,
      isNew,
      isReturning: c.isReturning,
      isInactive: isInactiveSince(c.lastVisitTs, 90, now),
    }
  })

  return (
    <KunderBoard list={<CustomerWorkbenchList rows={rows} monthLabel={monthLabel} />}>
      {children}
    </KunderBoard>
  )
}
