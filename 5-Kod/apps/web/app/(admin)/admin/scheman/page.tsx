import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listStaff, listWorkingHours, listWorkingHourSlots, listLocations } from '@/lib/admin/data'
import {
  SlotManager,
  ScheduleActions,
  WorkingHoursEditor,
  type WeekCol,
  type StaffChip,
} from '@/components/admin/SlotManager'
import { PageHead, Card } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Schema · Salongsadmin' }

// Kort svenskt dagnamn per weekday-index (0 = Sön … 6 = Lör) för rutnätsrubriken.
const WEEKDAY_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'] as const

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Schema" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const staff = await listStaff(tenant.id)
  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Schema" />
        <Card>
          <p className="body" style={{ margin: 0 }}>
            <strong>Lägg till personal först.</strong>
          </p>
          <p className="small" style={{ marginTop: 6 }}>
            Schemat sätts per medarbetare — skapa minst en under <em>Personal</em>, så fylls
            veckovyn här.
          </p>
        </Card>
      </section>
    )
  }

  const selected = staff.find((s) => s.id === sp.staff) ?? staff[0]!
  const [rows, slots, allLocations] = await Promise.all([
    listWorkingHours(tenant.id, selected.id),
    listWorkingHourSlots(tenant.id, selected.id),
    listLocations(tenant.id),
  ])

  // Schema-platsväljaren erbjuder bara AKTIVA platser (en inaktiv ska inte ta nya
  // schemalagda timmar). Default = medarbetarens egen plats, annars tenant-primär —
  // matchar serveraction:ens fallback, så formuläret förväljer det som ändå skrivs.
  const locations = allLocations.filter((l) => l.active)
  const defaultLocationId = selected.location_id ?? tenant.locationId ?? locations[0]?.id ?? ''

  // ── 7-dagars veckoankare (Mån–Sön), DST-säkert ───────────────────────────────
  // Dagens datum i salongens tidszon (en-CA → ÅÅÅÅ-MM-DD), låst 12:00 UTC för att
  // undvika midnatts-/sommartidsdrift; varje kolumn räknas relativt den. Härledd
  // realtid (ingen påhittad metrik). Söndag saknar normalt bokbara tider i
  // salongens mönster (mocken) → kolumnen visar tom-hinten, inte en stängd-flagga.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenant.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const anchor = new Date(`${ymd}T12:00:00Z`)
  const todayWd = anchor.getUTCDay()
  // Visa Mån … Sön i ordning (söndag sist). Datumförskjutningen räknas på ISO-
  // veckodag (Sön = 7) så söndagskolumnen pekar på DENNA veckas söndag, inte
  // förra (annars hamnar wd=0 en vecka bakåt när dagens veckodag är mån–lör).
  const isoToday = todayWd === 0 ? 7 : todayWd
  const weekOrder = [1, 2, 3, 4, 5, 6, 0]
  const weekCols: WeekCol[] = weekOrder.map((wd) => {
    const iso = wd === 0 ? 7 : wd
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() + (iso - isoToday))
    return {
      wd,
      name: WEEKDAY_SHORT[wd]!,
      dayOfMonth: d.getUTCDate(),
      isToday: wd === todayWd,
    }
  })

  const staffChips: StaffChip[] = staff.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    active: s.active,
  }))

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={`${tenant.name} · Schema`}
        title="Schema"
        lede="Bokbara starttider — inte fasta arbetstider. Ojämna intervall är ok; tjänstens längd styr passets längd."
      >
        <ScheduleActions staffId={selected.id} />
      </PageHead>

      {/* §4.5 — frisör-chips + röd-tråd-callout + 7-dagars rutnät (in-grid × / + Tid) */}
      <SlotManager
        staffId={selected.id}
        staff={staffChips}
        rows={slots}
        weekCols={weekCols}
        locations={locations}
        defaultLocationId={defaultLocationId}
      />

      {/* Arbetstider (öppet–stängt) — SHIPPAD funktion utan mock-motsvarighet: styr
          salongens publika öppettider + är rastret de bokbara tiderna ovan genereras
          ur. 3-vägstest → BEHÅLL men STYLA OM till grammatiken: visuellt underordnad
          rutnätet (hårfina rader, dämpat bläck, subtil ghost-CTA, toast-bekräftelse).
          All funktion bevaras (formulär + LocationSelect + rad-listan + borttagning). */}
      <WorkingHoursEditor
        staffId={selected.id}
        staffName={selected.displayName}
        rows={rows}
        locations={locations}
        defaultLocationId={defaultLocationId}
      />
    </section>
  )
}
