import type { Metadata } from 'next'
import { platformMetrics } from '@/lib/platform/metrics'
import { listTenants } from '@/lib/platform/tenants'
import { PageHead, Stat, Card, Badge, Button, Table, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Översikt' }

export default async function PlatformOverviewPage() {
  // platform_admin → RLS grants cross-tenant read (private.is_platform_admin()).
  // Seeing MORE than one tenant here is the proof that "platform når tvärs".
  const [metrics, recent] = await Promise.all([platformMetrics(), listTenants()])

  return (
    <section className="portal-section">
      <PageHead eyebrow="Plattform" title="Översikt">
        <Button href="/salonger/ny" variant="primary" icon="plus">
          Onboarda salong
        </Button>
      </PageHead>

      {/* Cross-tenant proof band (§4.7): platform_admin RLS bypass means dessa
          siffror räknar ÖVER alla salonger — ser du mer än en salong är det
          beviset att plattformen når tvärs. Server-safe, inga påhittade tal. */}
      <Callout tone="info" icon="building">
        Plattformsvyn räknar tvärs över alla salonger via platform_admin — varje
        siffra och rad nedan är aggregerad över hela plattformen, inte en enskild
        salong.
      </Callout>

      <div className="bo-stat-grid" style={{ marginTop: 22 }}>
        <Stat label="Salonger totalt" value={metrics.tenantsTotal} icon="building" />
        <Stat label="Aktiva salonger" value={metrics.tenantsActive} icon="checkCircle" />
        <Stat
          label="Pausade"
          value={metrics.tenantsSuspended}
          deltaTone="muted"
          icon="pause"
        />
        <Stat label="Bokningar totalt" value={metrics.bookingsTotal} icon="calendar" />
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
          <h2 className="h2">Senaste salonger</h2>
          <Button href="/salonger" variant="subtle" size="sm">
            Alla salonger
          </Button>
        </div>

        {recent.length === 0 ? (
          <div style={{ padding: '0 22px 22px' }}>
            <div
              style={{
                border: '1px dashed var(--c-line-strong)',
                background: 'var(--c-paper-2)',
                borderRadius: 12,
                padding: '26px 18px',
                textAlign: 'center',
              }}
            >
              <p
                className="h2"
                style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', color: 'var(--c-forest)' }}
              >
                Inga salonger ännu
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--c-ink-2)' }}>
                Onboarda din första kund — skapa salong, välj temamall och färger, så är den live på
                en egen subdomän direkt.
              </p>
              <Button href="/salonger/ny" variant="primary" icon="plus">
                Skapa den första salongen
              </Button>
            </div>
          </div>
        ) : (
          <Table
            cols={['Subdomän', 'Namn', 'Status']}
            rows={recent.slice(0, 8).map((t) => [
              <a key={`${t.id}-slug`} href={`/salonger/${t.id}`} style={{ color: 'var(--c-forest)', fontWeight: 600 }}>
                {t.slug}
              </a>,
              t.name,
              <Badge key={`${t.id}-status`} tone={t.status === 'active' ? 'success' : 'warning'}>
                {t.status === 'active' ? 'Aktiv' : 'Pausad'}
              </Badge>,
            ])}
          />
        )}
      </Card>
    </section>
  )
}
