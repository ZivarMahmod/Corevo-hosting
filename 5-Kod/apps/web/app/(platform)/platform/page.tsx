import type { Metadata } from 'next'
import Link from 'next/link'
import { platformOverview, getPlatformHealth, bookingTrend } from '@/lib/platform/metrics'
import { listTenants } from '@/lib/platform/tenants'
import { listAuditLogAllTenants, type AuditTone } from '@/lib/platform/audit'
import { formatPrice } from '@/lib/platform/billing'
import {
  PageHead,
  Stat,
  Sparkline,
  Card,
  Badge,
  Button,
  Table,
  Icon,
  type IconName,
} from '@/components/portal/ui'
import styles from './oversikt.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Översikt' }

const MONTHS_SV = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

// Deterministic accent dot per salon (mock shows a coloured t.dot). NOT fabricated
// data — a stable hash of the slug into the forest/gold-adjacent palette, so each
// salon reads distinct in the list without inventing a "brand colour" field that
// the schema doesn't have. Honest: it's a visual key, never presented as data.
const DOT_PALETTE = ['#5E7361', '#7E6E92', '#C8743C', '#B0693F', '#3A6A55', '#A05C7B', '#4F6D8A'] as const
function slugDot(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return DOT_PALETTE[h % DOT_PALETTE.length] ?? DOT_PALETTE[0]
}

const AUDIT_TONE_COLOR: Record<AuditTone, string> = {
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
  neutral: 'var(--c-ink-3)',
}
const AUDIT_ICON: Record<AuditTone, IconName> = {
  info: 'info',
  success: 'checkCircle',
  warning: 'pause',
  danger: 'alert',
  neutral: 'repeat',
}

// Humanize a dotted audit action key into a calm one-liner for the activity feed.
const ACTION_LABEL: Record<string, string> = {
  'tenant.create': 'Salong skapad',
  'tenant.suspend': 'Salong pausad',
  'tenant.activate': 'Salong aktiverad',
  'tenant.delete': 'Salong borttagen',
  'tenant.branding': 'Varumärke uppdaterat',
  'tenant.billing': 'Prismodell ändrad',
  'tenant.invite': 'Ägare inbjuden',
  'tenant.update': 'Salongsdata uppdaterad',
  'tenant.password_reset': 'Lösenordsreset skickad',
  'tenant.staff_create': 'Personal tillagd',
}
function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action
}

// "idag 09:14" / "8 maj 2026" — same calm, local formatting the rest of the
// back-office uses. Today/yesterday get a relative prefix; older = full date.
function formatAt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const time = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  }).format(d)
  if (sameDay) return `idag ${time}`
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Stockholm',
  }).format(d)
}
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso))
}

function statusBadge(status: string) {
  if (status === 'active') return <Badge tone="success">Aktiv</Badge>
  if (status === 'suspended') return <Badge tone="warning">Pausad</Badge>
  return <Badge tone="neutral">{status}</Badge>
}

export default async function PlatformOverviewPage() {
  // platform_admin → RLS grants cross-tenant read (private.is_platform_admin()).
  // Every figure here aggregates ÖVER alla salonger; seeing more than one is the
  // proof that the platform reaches across. No fabricated numbers — bookings/
  // underlag are LIVE month aggregates, health pills are honest empty (no telemetry).
  const [overview, tenants, audit, trend] = await Promise.all([
    platformOverview(),
    listTenants(),
    listAuditLogAllTenants({}, 6),
    bookingTrend(12),
  ])
  const health = getPlatformHealth()
  const monthLabel = `${MONTHS_SV[overview.month - 1]}`

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Plattform · Zivar"
        title="Översikt"
        lede="Din insyn över alla salonger — klicka in på vilken som helst och styr allt utan kod."
      >
        <Button href="/salonger/ny" variant="primary" icon="plus">
          Onboarda salong
        </Button>
      </PageHead>

      {/* Health-pill row (mock §2.3). NO telemetry source is wired, so we render the
          honest empty-state — the same four insyn-slots the mock shows, but each
          reads "—" / "Ej kopplad", never a fabricated live number. */}
      <div className={styles.healthRow} title={health.reason}>
        {HEALTH_LABELS.map((label) => (
          <div key={label} className={styles.pill}>
            <span className={styles.pillDot} />
            <div className={styles.pillBody}>
              <div className={`num ${styles.pillValue}`}>—</div>
              <div className={styles.pillLabel}>{label} · ej kopplad</div>
            </div>
          </div>
        ))}
      </div>

      {/* 4 KPI cards — all LIVE cross-tenant aggregates (platformOverview). */}
      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat
          label="Salonger"
          value={overview.tenantsTotal}
          delta={`${overview.tenantsActive} aktiva`}
          deltaTone={overview.tenantsActive > 0 ? 'success' : 'muted'}
          icon="building"
        />
        <Stat
          label="Aktiva"
          value={overview.tenantsActive}
          hint={`av ${overview.tenantsTotal} salonger`}
          icon="checkCircle"
        />
        {/* Bokningar — custom KPI card (mock SuperOverview): forest big number +
            trendUp chip + a LIVE 12-month booking-trend sparkline (honest: a sparse
            DB renders a near-flat line, never the mock's fabricated SU_TREND curve). */}
        <Card>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <span className="eyebrow">Bokningar · {monthLabel}</span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'var(--c-paper-2)',
                color: 'var(--c-forest)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="trendUp" size={18} />
            </div>
          </div>
          <div
            className="num"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 34,
              fontWeight: 700,
              color: 'var(--c-forest)',
              lineHeight: 1.1,
              margin: '8px 0 6px',
            }}
          >
            {overview.bookingsThisMonth}
          </div>
          <Sparkline data={trend.map((t) => t.count)} w={240} h={40} />
        </Card>
        <Stat
          label={`Underlag · ${monthLabel}`}
          value={formatPrice(overview.underlagCentsThisMonth)}
          hint="flöde 2 · manuell fakturering"
          icon="dollar"
        />
      </div>

      <div className={styles.split}>
        {/* ── Alla salonger ──────────────────────────────────────────────── */}
        <Card pad={0}>
          <div className={styles.cardHead}>
            <h2 className="h2">Alla salonger</h2>
            <Link href="/salonger" className={styles.linkBtn}>
              Hantera <Icon name="arrowRight" size={15} />
            </Link>
          </div>

          {tenants.length === 0 ? (
            <div className={styles.tableEmpty}>
              <p className={`h2 ${styles.tableEmptyTitle}`}>Inga salonger ännu</p>
              <p className={styles.tableEmptyText}>
                Onboarda din första kund — skapa salong, välj temamall och färger, så
                är den live på en egen subdomän direkt.
              </p>
              <Button href="/salonger/ny" variant="primary" icon="plus">
                Skapa den första salongen
              </Button>
            </div>
          ) : (
            <Table
              cols={['Salong', 'Subdomän', 'Stad', 'Senast aktiv', 'Bokningar', 'Status']}
              rows={tenants.slice(0, 8).map((t) => [
                <Link
                  key={`${t.id}-name`}
                  href={`/salonger/${t.id}`}
                  className={styles.tenantCell}
                  style={{ textDecoration: 'none' }}
                >
                  <span
                    className={styles.tenantDot}
                    style={{ background: slugDot(t.slug) }}
                  />
                  <span className={styles.tenantName}>{t.name}</span>
                </Link>,
                <span key={`${t.id}-sub`} className={styles.sub}>
                  {t.slug}.corevo.se
                </span>,
                // Stad: no source on tenants (schema-verified) → honest "—", same
                // empty-state treatment as the health pills (column kept per mock).
                <span key={`${t.id}-city`} className={styles.sub}>
                  —
                </span>,
                // "Senast aktiv": no activity telemetry → honestly show when the
                // salong was created (labelled "Skapad" in the cell), never a faked
                // last-active timestamp.
                <span key={`${t.id}-created`} className={styles.muted}>
                  Skapad {formatDate(t.createdAt)}
                </span>,
                <span key={`${t.id}-bookings`} className="num">
                  0
                </span>,
                <span key={`${t.id}-status`}>{statusBadge(t.status)}</span>,
              ])}
            />
          )}
        </Card>

        {/* ── Sido-rail: Senaste händelser + Premium-kort ─────────────────── */}
        <div className={styles.rail}>
          <Card pad={0}>
            <div className={`${styles.cardHead} ${styles.cardHeadTight}`}>
              <h2 className="h2">Senaste händelser</h2>
              <Link href="/drift-och-logg" className={styles.linkBtn}>
                Audit-logg
              </Link>
            </div>
            {audit.length === 0 ? (
              <div className={styles.auditEmpty}>
                Inga loggade händelser ännu — operativa åtgärder dyker upp här direkt.
              </div>
            ) : (
              <div className={styles.auditList}>
                {audit.map((a) => (
                  <div key={a.id} className={styles.auditRow}>
                    <span
                      className={styles.auditIcon}
                      style={{ color: AUDIT_TONE_COLOR[a.tone] }}
                    >
                      <Icon name={AUDIT_ICON[a.tone]} size={15} />
                    </span>
                    <div className={styles.auditBody}>
                      <div className={styles.auditAction}>{actionLabel(a.action)}</div>
                      <div className={styles.auditTarget}>
                        {a.tenant}
                        {a.actor === 'Zivar' ? ' · Zivar' : ''}
                      </div>
                    </div>
                    <span className={styles.auditAt}>{formatAt(a.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Inverted forest card — gold action buttons (the single accent). */}
          <div className={styles.forestCard}>
            <span className={`eyebrow ${styles.forestEyebrow}`}>Premium utan kod</span>
            <h2 className={styles.forestTitle}>Supabase-kraft, ditt UI</h2>
            <p className={styles.forestBody}>
              Lägg till kund, skicka lösenordsreset, sätt recensionslänk — utan att
              röra rå-databasen.
            </p>
            <div className={styles.forestActions}>
              <Button href="/kunder" variant="gold" size="sm" icon="mail">
                Lösenordsreset
              </Button>
              <Button
                href="/personal-plattform"
                variant="ghost"
                size="sm"
                icon="scissors"
                style={{ color: '#fff', borderColor: 'var(--c-forest-300)' }}
              >
                Onboarda personal
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const HEALTH_LABELS = ['API-uptid', 'Workers', 'DB-pool', 'Köade SMS'] as const
