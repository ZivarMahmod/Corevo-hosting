import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listServices, listStaff, type StaffWithServices } from '@/lib/admin/data'
import { StaffManager } from '@/components/admin/StaffManager'
import { PageHead, Stat, Card, Badge, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Personal · Salongsadmin' }

/** Bokningsbar = aktiv OCH minst en kopplad tjänst (samma regel som den publika
 *  sajten tillämpar). Härlett ur riktig data — serviceIds kommer från staff_services. */
function isBookable(s: StaffWithServices): boolean {
  return s.active && s.serviceIds.length > 0
}

/** Initial för forest-avataren — första bokstaven i visningsnamnet. */
function initialOf(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?'
}

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

  const [staff, services] = await Promise.all([listStaff(tenant.id), listServices(tenant.id)])

  const activeCount = staff.filter((s) => s.active).length
  const bookableCount = staff.filter(isBookable).length

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Personal"
        lede="Lägg till medarbetare och koppla vilka tjänster de utför. Endast aktiv personal med minst en kopplad tjänst går att boka på den publika webbplatsen."
      />

      {/* Riktiga nyckeltal — räknade ur staff/staff_services, aldrig fejkat. */}
      <div className="bo-stat-grid">
        <Stat label="Medarbetare totalt" value={<span className="num">{staff.length}</span>} icon="users" />
        <Stat
          label="Aktiva"
          value={<span className="num">{activeCount}</span>}
          icon="user"
          hint="Synliga internt"
        />
        <Stat
          label="Bokningsbara"
          value={<span className="num">{bookableCount}</span>}
          icon="scissors"
          hint="Aktiv + minst en tjänst"
        />
      </div>

      {/* Personalöversikt — kort per medarbetare. Inga specialitets-/skill-fält finns
          i schemat, så vi visar bara verklig data (namn, titel, status, antal kopplade
          tjänster) — aldrig påhittade specialiteter. */}
      {staff.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '14px 8px', color: 'var(--c-ink-2)' }}>
            <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 4 }}>
              Ingen personal ännu.
            </strong>
            Lägg till din första medarbetare i panelen nedan och koppla sedan vilka tjänster hen
            utför — då blir hen bokningsbar på din publika sajt.
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
            margin: '0 0 22px',
          }}
        >
          {staff.map((s) => {
            const bookable = isBookable(s)
            const count = s.serviceIds.length
            return (
              // TODO(goal-17 island): wire per-staff "Verklig dag · idag" detail
              // <Drawer> as a 'use client' child triggered from this card — server
              // shell renders the static roster, the island fetches today's bookings.
              <Card key={s.id} style={s.active ? undefined : { opacity: 0.62 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: 'var(--c-forest)',
                      color: 'var(--c-on-forest)',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: 18,
                      fontWeight: 700,
                      flex: 'none',
                    }}
                  >
                    {initialOf(s.displayName)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 17,
                        fontWeight: 700,
                        color: 'var(--c-forest)',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.displayName}
                    </div>
                    <div className="small" style={{ marginTop: 2 }}>
                      {s.title?.trim() ? 'Medarbetare' : 'Titel saknas'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <Badge tone={bookable ? 'success' : s.active ? 'warning' : 'neutral'}>
                    {bookable ? 'Bokningsbar' : s.active ? 'Saknar tjänst' : 'Inaktiv'}
                  </Badge>
                  <span className="small">
                    <span className="num">{count}</span> {count === 1 ? 'tjänst' : 'tjänster'}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Callout tone="info" icon="info">
        Endast aktiv personal med minst en kopplad tjänst går att boka på den publika sajten. Koppla
        tjänster och sätt schema per medarbetare i panelen nedan.
      </Callout>

      {/* Hanteringspanel (skapa/bjud in/koppla tjänster) — befintlig klient-ö, oförändrad. */}
      <StaffManager staff={staff} services={services} />
    </section>
  )
}
