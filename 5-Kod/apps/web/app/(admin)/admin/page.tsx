import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { dashboardData } from '@/lib/admin/data'
import { todayInTz, dayRangeUtc, weekRangeUtc } from '@/lib/admin/dates'
import { formatTime, statusLabel } from '@/lib/admin/format'
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
  )

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Översikt">
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
    </section>
  )
}
