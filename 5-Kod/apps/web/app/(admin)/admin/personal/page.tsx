import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm, termPlural } from '@/lib/platform/verticals-shared'
import { listServices, listStaff, listLocations } from '@/lib/admin/data'
import { getStaffScheduleWithNotes, dayRangeUtc } from '@/lib/personal/calendar'
import { todayInTz } from '@/lib/personal/format'
import {
  StaffRoster,
  AddStaffButton,
  type StaffCard,
  type StaffDayRow,
  type ServiceOption,
} from '@/components/admin/StaffRoster'
import { PageHead, Card } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Personal · Salongsadmin' }

export default async function StaffPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Personal" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const [staff, services, locations] = await Promise.all([
    listStaff(tenant.id),
    listServices(tenant.id),
    listLocations(tenant.id),
  ])

  // Each staff member's REAL day — one batched read for the whole roster, then
  // grouped by staff_id. getStaffScheduleWithNotes is RLS-tenant-fenced; cancelled
  // bookings are excluded (mock SalonStaff dayOf = status !== "avbokad"). The
  // prefs/note enrichment goes unused on this minimal admin list (harmless).
  const today = todayInTz(tenant.timeZone)
  const { fromUtc, toUtc } = dayRangeUtc(today, tenant.timeZone)
  const staffIds = staff.map((s) => s.id)
  const todaysSchedule = await getStaffScheduleWithNotes(staffIds, fromUtc, toUtc)
  const dayByStaff = new Map<string, StaffDayRow[]>()
  for (const b of todaysSchedule) {
    if (b.status === 'cancelled') continue
    const row: StaffDayRow = {
      id: b.id,
      startTs: b.startTs,
      status: b.status,
      serviceName: b.serviceName,
      customerLabel: b.customerLabel,
    }
    const list = dayByStaff.get(b.staffId)
    if (list) list.push(row)
    else dayByStaff.set(b.staffId, [row])
  }

  // Resolve location_id → name for the roster cards (multi-location is real —
  // location_id is an FK; KEEP it). Missing pin → null (written empty-state).
  const locationName = new Map<string, string>(locations.map((l) => [l.id, l.name]))

  // service_id → name, so each card's chips show the REAL coupled service names
  // (the mock's specialty chips bound to staff_services). The full {id,name} set
  // also feeds the Drawer's tjänst-coupling checkboxes (setStaffServices).
  const serviceName = new Map<string, string>(services.map((sv) => [sv.id, sv.name]))
  const serviceOptions: ServiceOption[] = services.map((sv) => ({ id: sv.id, name: sv.name }))

  const cards: StaffCard[] = staff.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    title: s.title,
    active: s.active,
    serviceCount: s.serviceIds.length,
    serviceIds: s.serviceIds,
    serviceNames: s.serviceIds
      .map((id) => serviceName.get(id))
      .filter((n): n is string => Boolean(n)),
    // Eget konto = staff har en kopplad inloggning (profile_id != null). Härlett,
    // aldrig fejkat — magic-link-inbjudan sätter profile_id (se inviteStaff).
    hasAccount: Boolean(s.profile_id),
    locationName: (s.location_id && locationName.get(s.location_id)) || null,
    today: (
      dayByStaff.get(s.id) ?? []
    ).sort((a, b) => (a.startTs < b.startTs ? -1 : 1)),
  }))

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title={termPlural(tenant.terminology, 'staff', 'Personal')}
        lede="Varje medarbetares riktiga dag — speglad live. Ge dem ett eget konto med egen vy, eller hantera dem härifrån. Endast aktiv personal med minst en kopplad tjänst går att boka."
      >
        <AddStaffButton />
      </PageHead>

      {/* Personalöversikt — RICH kort per medarbetare (forest-avatar, namn, roll-rad,
          bio-tomtillstånd, tjänst-chips ur staff_services, muted Aktiv-pill, plats ·
          idag-antal). Klick öppnar Drawer med Om (tomtillstånd), namn/titel-redigering,
          tjänst-koppling, eget-konto + magic-link, multi-location, verklig dag och
          borttagning — all redigering som tidigare låg i StaffManager, nu samlad här.
          Inga påhittade fält. */}
      {staff.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '14px 8px', color: 'var(--c-ink-2)' }}>
            <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 4 }}>
              Ingen personal ännu.
            </strong>
            Tryck på “Lägg till” ovan för att skapa din första medarbetare och koppla sedan vilka
            tjänster hen utför — då blir hen bokningsbar på din publika sajt.
          </div>
        </Card>
      ) : (
        <StaffRoster
          staff={cards}
          services={serviceOptions}
          tz={tenant.timeZone}
          staffNoun={resolveTerm(tenant.terminology, 'staff', 'Medarbetare')}
        />
      )}
    </section>
  )
}
