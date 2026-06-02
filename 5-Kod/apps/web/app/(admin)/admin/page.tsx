import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant, storefrontUrl } from '@/lib/admin/tenant'
import { dashboardData } from '@/lib/admin/data'
import { todayInTz, dayRangeUtc, weekRangeUtc } from '@/lib/admin/dates'
import { formatTime, statusLabel } from '@/lib/admin/format'
import { OpenSiteLink } from '@/components/admin/OpenSiteLink'
import { PageHead, Stat, Card, Badge, Button } from '@/components/portal/ui'
import type { BadgeTone } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Salongsadmin' }

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'gold',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'danger',
}

export default async function AdminPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Salongsadmin</h1>
        <p className="prose">Ingen salong är kopplad till ditt konto. Kontakta Corevo.</p>
      </section>
    )
  }

  const today = todayInTz(tenant.timeZone)
  const data = await dashboardData(
    tenant.id,
    dayRangeUtc(today, tenant.timeZone),
    weekRangeUtc(today, tenant.timeZone),
    tenant.timeZone,
  )

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Översikt">
        <OpenSiteLink href={storefrontUrl(tenant.slug)}>Se din sida</OpenSiteLink>
        <Button href="/admin/kunder" variant="ghost" icon="users">
          Kunder
        </Button>
        <Button href="/admin/bokningar" variant="ghost" icon="calendar">
          Alla bokningar
        </Button>
        <Button href="/admin/tjanster" variant="primary" icon="plus">
          Ny tjänst
        </Button>
      </PageHead>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <Stat label="Bokningar idag" value={data.todayCount} icon="calendar" />
        <Stat label="Denna vecka" value={data.weekCount} icon="trendUp" />
        <Stat label="Aktiva tjänster" value={data.servicesActive} icon="scissors" />
        <Stat label="Aktiv personal" value={data.staffActive} icon="users" />
      </div>

      <Card pad={0}>
        <div
          style={{
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 className="h2">Dagens bokningar</h2>
          <Button href="/admin/bokningar" variant="subtle" size="sm">
            Visa alla
          </Button>
        </div>

        {data.upcomingToday.length === 0 ? (
          <div style={{ padding: '0 22px 22px' }}>
            <div
              style={{
                border: '1px dashed var(--c-line-strong)',
                background: 'var(--c-paper-2)',
                borderRadius: 12,
                padding: '22px 18px',
                textAlign: 'center',
                color: 'var(--c-ink-2)',
                fontSize: 14,
              }}
            >
              <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 4 }}>
                Inga bokningar idag.
              </strong>
              Nya bokningar från din publika sajt dyker upp här automatiskt.
            </div>
          </div>
        ) : (
          <div style={{ padding: '0 10px 10px' }}>
            {data.upcomingToday.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                }}
              >
                <div
                  className="num"
                  style={{
                    width: 56,
                    fontWeight: 700,
                    color: 'var(--c-forest)',
                    fontSize: 15,
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {formatTime(b.startTs, tenant.timeZone)}
                </div>
                <div
                  style={{ width: 3, height: 34, borderRadius: 999, background: 'var(--c-gold)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>
                    {b.serviceName}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>{b.staffTitle}</div>
                </div>
                <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{statusLabel(b.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Insikter denna vecka — tjänste-mix + topptimmar (M6 §3.8). Ingen analytics. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginTop: 22,
        }}
      >
        <Card>
          <h2 className="h2" style={{ marginTop: 0 }}>
            Tjänste-mix
          </h2>
          <p className="small" style={{ color: 'var(--c-ink-3)', marginTop: 2 }}>
            Mest bokade tjänster denna vecka
          </p>
          {data.serviceMix.length === 0 ? (
            <p style={{ color: 'var(--c-ink-2)', fontSize: 14, marginTop: 12 }}>
              Inga bokningar denna vecka ännu.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {data.serviceMix.map((s) => {
                const max = data.serviceMix[0]!.count
                return (
                  <div key={s.name}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13.5,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: 'var(--c-ink)' }}>{s.name}</span>
                      <span className="num" style={{ color: 'var(--c-ink-2)' }}>
                        {s.count}
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: 'var(--c-paper-2)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(6, (s.count / max) * 100)}%`,
                          borderRadius: 999,
                          background: 'var(--c-forest)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="h2" style={{ marginTop: 0 }}>
            Topptimmar
          </h2>
          <p className="small" style={{ color: 'var(--c-ink-3)', marginTop: 2 }}>
            När flest kunder bokar denna vecka ({tenant.timeZone})
          </p>
          {data.peakHours.length === 0 ? (
            <p style={{ color: 'var(--c-ink-2)', fontSize: 14, marginTop: 12 }}>
              Inga bokningar denna vecka ännu.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {data.peakHours.map((h) => {
                const max = data.peakHours[0]!.count
                return (
                  <div key={h.hour}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13.5,
                        marginBottom: 4,
                      }}
                    >
                      <span className="num" style={{ color: 'var(--c-ink)' }}>
                        {String(h.hour).padStart(2, '0')}:00–{String(h.hour).padStart(2, '0')}:59
                      </span>
                      <span className="num" style={{ color: 'var(--c-ink-2)' }}>
                        {h.count}
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: 'var(--c-paper-2)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(6, (h.count / max) * 100)}%`,
                          borderRadius: 999,
                          background: 'var(--c-gold)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}
