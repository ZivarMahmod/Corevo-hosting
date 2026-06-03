import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listStaff, listWorkingHours, listWorkingHourSlots, listLocations } from '@/lib/admin/data'
import { StaffPicker } from '@/components/admin/StaffPicker'
import { ScheduleManager } from '@/components/admin/ScheduleManager'
import { SlotManager } from '@/components/admin/SlotManager'
import { PageHead, Card, Callout } from '@/components/portal/ui'
import { WEEKDAYS_SV } from '@/lib/admin/format'
import type { SlotRow } from '@/lib/admin/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Scheman · Salongsadmin' }

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
        <PageHead eyebrow="Salong-admin" title="Scheman" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const staff = await listStaff(tenant.id)
  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Scheman" />
        <p className="prose">Lägg till personal först under Personal.</p>
      </section>
    )
  }

  const selected = staff.find((s) => s.id === sp.staff) ?? staff[0]!
  const [rows, slots, allLocations] = await Promise.all([
    listWorkingHours(tenant.id, selected.id),
    listWorkingHourSlots(tenant.id, selected.id),
    listLocations(tenant.id),
  ])

  // The schedule's location <select> only offers ACTIVE locations (an inactive one
  // shouldn't take new scheduled hours). Default = this staff member's own location,
  // else the tenant primary — matches the server action's fallback, so the form
  // pre-selects whatever it would have written anyway.
  const locations = allLocations.filter((l) => l.active)
  const defaultLocationId = selected.location_id ?? tenant.locationId ?? locations[0]?.id ?? ''

  // ── §4.5 read-only veckovy (Mån–Fre) ──────────────────────────────────────
  // Gruppera de redan hämtade bokbara starttiderna per veckodag (0 = Sön … 6 = Lör),
  // exakt som SlotManager. Visar EXPLICITA starttider — aldrig ett öppet–stängt-
  // spann (det intervallet bor kvar i ScheduleManager nedan).
  const slotsByDay = new Map<number, SlotRow[]>()
  for (const s of slots) {
    const arr = slotsByDay.get(s.weekday) ?? []
    arr.push(s)
    slotsByDay.set(s.weekday, arr)
  }

  // DST-säker veckoankare: ta dagens datum i salongens tidszon (en-CA → ÅÅÅÅ-MM-DD),
  // lås kl. 12:00 UTC för att undvika midnatts-/sommartidsdrift, och räkna varje
  // kolumn relativt den. Det är härledd realtid (ingen påhittad metrik).
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenant.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const anchor = new Date(`${ymd}T12:00:00Z`)
  const todayWd = anchor.getUTCDay()
  // Mån–Fre = veckodags-index 1..5 i WEEKDAYS_SV.
  const weekCols = [1, 2, 3, 4, 5].map((wd) => {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() + (wd - todayWd))
    const daySlots = (slotsByDay.get(wd) ?? [])
      .map((s) => s.start_time.slice(0, 5))
      .sort((a, b) => a.localeCompare(b))
    return {
      wd,
      name: WEEKDAYS_SV[wd]!,
      dayOfMonth: d.getUTCDate(),
      isToday: wd === todayWd,
      times: daySlots,
    }
  })
  const hasAnySchedule = slots.length > 0 || rows.length > 0

  return (
    <section className="portal-section">
      <PageHead eyebrow={`${tenant.name} · Scheman & öppettider`} title="Scheman" />
      <p className="prose">
        Du sätter medarbetarens baseline-schema här (tidszon {tenant.timeZone}). Medarbetaren ändrar
        den inte själv — personalvyn speglar bara den.
      </p>
      <StaffPicker staff={staff} selectedId={selected.id} basePath="/admin/scheman" />

      {/* §4.5 veckovy — server-säker, läs-bara bokbara starttider.
          TODO(goal-17 island): lägg/ta bort tid direkt i cellen är klient-interaktion
          och hanteras kvar i <SlotManager> nedan. */}
      <style>{`
        .scheman-week { grid-template-columns: repeat(5, 1fr); }
        @media (max-width: 920px) { .scheman-week { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ marginTop: '1.5rem' }}>
        <Callout tone="info" icon="info">
          Veckovy för {selected.displayName} — visar de exakta tider du gjort bokbara, dag för dag.
          Idag är markerad. Redigera tiderna i fälten längre ned; helgdagar listas där.
        </Callout>
        <Card pad={0} style={{ marginTop: '1rem', overflow: 'hidden' }}>
          {hasAnySchedule ? (
            <div className="scheman-week" style={{ display: 'grid' }}>
              {weekCols.map((col, i) => (
                <div
                  key={col.wd}
                  style={{
                    minHeight: 380,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: i < weekCols.length - 1 ? '1px solid var(--c-line)' : 'none',
                  }}
                >
                  {/* Dag-rubrik — guld fyllning ENBART på dagens kolumn (sidans enda guldfält) */}
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '14px 10px 12px',
                      borderBottom: '1px solid var(--c-line)',
                      background: col.isToday ? 'var(--c-gold-100)' : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--c-ink-3)',
                      }}
                    >
                      {col.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 22,
                        lineHeight: 1.1,
                        color: 'var(--c-forest)',
                        marginTop: 2,
                      }}
                    >
                      {col.dayOfMonth}
                    </div>
                    <div className="num" style={{ fontSize: 11, color: 'var(--c-ink-3)', marginTop: 4 }}>
                      {col.times.length} tider
                    </div>
                  </div>

                  {/* Tidchips, eller bokbar-tom cell (streckad) med svensk hint */}
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                    {col.times.length > 0 ? (
                      col.times.map((t, ti) => (
                        <div
                          key={`${col.wd}-${ti}`}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 8,
                            background: 'var(--c-success-bg)',
                            textAlign: 'center',
                          }}
                        >
                          <span
                            className="num"
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-success)' }}
                          >
                            {t}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 64,
                          display: 'grid',
                          placeItems: 'center',
                          padding: 10,
                          borderRadius: 8,
                          border: '1px dashed var(--c-line-strong)',
                          textAlign: 'center',
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: 'var(--c-ink-3)',
                          fontFamily: 'var(--font-ui)',
                        }}
                      >
                        Inga bokbara tider — lägg till nedan
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 28, textAlign: 'center' }}>
              <p className="prose" style={{ margin: 0 }}>
                <strong>Inget schema ännu för {selected.displayName}.</strong>
              </p>
              <p className="prose" style={{ marginTop: 6, fontSize: 13, color: 'var(--c-ink-3)' }}>
                Sätt arbetstider och bokbara starttider i fälten nedan — veckovyn fylls i så snart
                det finns tider för måndag–fredag.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Arbetstider (öppet–stängt)</h2>
        <p className="prose" style={{ fontSize: 13, marginTop: 0 }}>
          Veckovisa intervall — styr salongens öppettider på den publika sajten och är grunden de
          bokbara tiderna genereras ur.
        </p>
        <ScheduleManager
          staffId={selected.id}
          rows={rows}
          locations={locations}
          defaultLocationId={defaultLocationId}
        />
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Bokbara starttider</h2>
        <p className="prose" style={{ fontSize: 13, marginTop: 0 }}>
          Exakta tider du vill göra bokbara — ojämna intervaller tillåtna. Tjänstens längd styr
          passet. Tiderna sparas nu och börjar styra bokningen när bokningsmotorn slår på explicita
          tider; tills dess erbjuder bokningen tider ur arbetstids-rastret.
        </p>
        <SlotManager
          staffId={selected.id}
          rows={slots}
          locations={locations}
          defaultLocationId={defaultLocationId}
        />
      </div>
    </section>
  )
}
