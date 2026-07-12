import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { tenantStorefrontUrl, tenantStorefrontHost } from '@/lib/storefront-url'
import { dashboardData } from '@/lib/admin/data'
import { todayInTz, dayRangeUtc, weekRangeUtc } from '@/lib/admin/dates'
import { formatTime, statusLabel } from '@/lib/admin/format'
import { resolveCustomerName } from '@/lib/personal/customer'
import { createClient } from '@/lib/supabase/server'
import { OpenSiteLink } from '@/components/admin/OpenSiteLink'
import { PageHead, Stat, Card, Badge, Button, Icon } from '@/components/portal/ui'
import type { BadgeTone } from '@/components/portal/ui'
import { QuickActions, QuickAction } from './QuickActions'
import styles from './dashboard.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Adminpanel' }

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'gold',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'danger',
}

// Tjänste-mix segment palette (forest → gold → ink) — same five-stop ramp the
// prototype's MixBar uses, lifted to back-office --c-* tokens (no hardcoded hex).
const MIX_COLORS = [
  'var(--c-forest)',
  'var(--c-forest-300)',
  'var(--c-gold)',
  'var(--c-gold-600)',
  'var(--c-ink-3)',
]

export default async function AdminPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Adminpanel</h1>
        <p className="prose">Inget företag är kopplat till ditt konto. Kontakta Corevo.</p>
      </section>
    )
  }

  const today = todayInTz(tenant.timeZone)
  const dayRange = dayRangeUtc(today, tenant.timeZone)
  const weekRange = weekRangeUtc(today, tenant.timeZone)
  const data = await dashboardData(tenant.id, dayRange, weekRange, tenant.timeZone)

  const supabase = await createClient()

  // Kund-namn för dagens rader — REAL read (bookings.customer_id → customers). The
  // dashboard read does not pre-join the customer, so we resolve it here over the
  // same authed client (customers_rls lets admin read its tenant's rows). Masking
  // goes through the shared resolveCustomerName (display_name → initial when
  // name_hidden → full_name → "Kund"), so a hidden full name never leaks.
  const todayIds = data.upcomingToday.map((b) => b.id)
  const todayNames = new Map<string, string>()
  if (todayIds.length > 0) {
    const { data: rows } = await supabase
      .from('bookings')
      .select('id, customers(display_name, full_name, name_hidden)')
      .eq('tenant_id', tenant.id)
      .in('id', todayIds)
    type NameRow = {
      id: string
      customers: { display_name: string | null; full_name: string | null; name_hidden: boolean } | null
    }
    for (const r of (rows ?? []) as NameRow[]) {
      todayNames.set(r.id, r.customers ? resolveCustomerName(r.customers) : 'Gäst')
    }
  }

  // Nya lojalitetskunder denna vecka — REAL read. A customer counts as "new this
  // week" when their FIRST-EVER loyalty_ledger entry falls inside the local week
  // window. loyalty_ledger is append-only + admin-readable tenant-wide (migr 0011),
  // so we derive min(created_at) per customer and count those whose first entry is
  // in [weekStart, weekEnd). Empty ledger → 0 (honest, never fabricated).
  const { data: ledgerRows } = await supabase
    .from('loyalty_ledger')
    .select('customer_id, created_at')
    .eq('tenant_id', tenant.id)
  const firstEntry = new Map<string, string>()
  for (const r of (ledgerRows ?? []) as { customer_id: string | null; created_at: string }[]) {
    if (!r.customer_id) continue
    const prev = firstEntry.get(r.customer_id)
    if (prev == null || r.created_at < prev) firstEntry.set(r.customer_id, r.created_at)
  }
  // Compare as instants (numbers), not ISO strings — timestamptz from Postgres
  // (…+00:00, micros) and JS toISOString (…Z, millis) are different text formats.
  const weekFromMs = Date.parse(weekRange.fromUtc)
  const weekToMs = Date.parse(weekRange.toUtc)
  let newLoyaltyThisWeek = 0
  for (const ts of firstEntry.values()) {
    const t = Date.parse(ts)
    if (t >= weekFromMs && t < weekToMs) newLoyaltyThisWeek += 1
  }

  // Stripe-koppling — REAL read of the tenant's mirrored Connect capabilities
  // (tenants.stripe_*; payments_rls/tenants_rls fence it to the admin's own tenant
  // via the authed client). No row / no charges = the HONEST "ej ansluten" state;
  // we never paint a fake "Ansluten" badge.
  const { data: stripeRow } = await supabase
    .from('tenants')
    .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted')
    .eq('id', tenant.id)
    .maybeSingle()
  const stripeConnected = Boolean(stripeRow?.stripe_charges_enabled)
  const stripeStarted = Boolean(stripeRow?.stripe_account_id)

  // Calm, time-aware greeting (back-office "du" voice). No staff name exists on the
  // user record, so we lead with the salon + date instead of a personal name.
  const now = new Date()
  const hour = Number(
    new Intl.DateTimeFormat('sv-SE', {
      hour: 'numeric',
      hour12: false,
      timeZone: tenant.timeZone,
    }).format(now),
  )
  const greeting = hour < 10 ? 'God morgon' : hour < 18 ? 'God eftermiddag' : 'God kväll'
  const dateLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: tenant.timeZone,
  }).format(now)

  // ALWAYS the real public host (https://<slug>.corevo.se), computed from the slug
  // — never NEXT_PUBLIC_SITE_URL / the dev host, which leaked "localhost:3000" into
  // the "Se din sida" subtext + the "Din sida, live" gold CTA (goal-17 verify P1).
  // tenant.slug is a guaranteed non-empty string (AdminTenant), so the host resolves.
  const siteUrl = tenantStorefrontUrl(tenant.slug)!
  const siteHost = tenantStorefrontHost(tenant.slug)!

  // Dagens-rader: hur många är klara vs kvar (härlett ur de riktiga statusarna).
  // "Kommande idag" visar BARA ännu-ej-genomförda tider (pending/confirmed) — klara
  // tider lever vidare i "X klara"-hinten + Alla bokningar, precis som i mocken.
  const todayDone = data.upcomingToday.filter((b) => b.status === 'completed').length
  const todayUpcoming = data.upcomingToday.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed',
  )
  const todayLeft = todayUpcoming.length

  // Service-mix → pct per segment (top 5, share of the week's active bookings).
  const mixTotal = data.serviceMix.reduce((sum, s) => sum + s.count, 0)
  const peakMax = data.peakHours.length ? Math.max(...data.peakHours.map((h) => h.count)) : 0

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={`${tenant.name} · ${dateLabel}`}
        title={greeting}
        lede="Ditt kontrollcenter — följ dagen utan att behöva pyssla. Allt speglar verkligheten live."
      >
        <OpenSiteLink href={siteUrl}>Se din sida</OpenSiteLink>
        {/* "Ny bokning" pekade på /admin/bokningar som INTE kan skapa bokningar —
            tills admin-bokning är byggd är den ärliga vägen boka-flödet på sajten. */}
        <Button href={siteUrl} variant="primary" icon="plus" target="_blank" rel="noreferrer">
          Boka åt kund på din sida
        </Button>
      </PageHead>

      {/* snabbåtgärder — det man gör oftast, alltid en knapptryckning bort (§4.7) */}
      <QuickActions>
        <QuickAction
          icon="calendar"
          title="Dagens bokningar"
          sub={`${data.todayCount} idag · ${todayLeft} kvar`}
          href="/admin/bokningar"
          tone="gold"
        />
        <QuickAction icon="clock" title="Schema" sub="Veckan & frånvaro" href="/admin/scheman" />
        <QuickAction icon="users" title="Dina kunder" sub="Återkommande & nya" href="/admin/kunder" />
        <QuickAction icon="external" title="Se din sida" sub={siteHost} href={siteUrl} external />
      </QuickActions>

      {/* 4 KPI — mock composition, every value bound to LIVE data. The mock's
          "Beläggning" needs slot-capacity math the data-layer doesn't expose yet
          (flagged), so slot 3 keeps the shipped real "Aktiva tjänster" KPI. */}
      <div className="bo-stat-grid">
        <Stat
          label="Idag"
          value={data.todayCount}
          icon="calendar"
          hint={`${todayDone} klara · ${todayLeft} kvar`}
        />
        <Stat label="Denna vecka" value={data.weekCount} icon="trendUp" hint="Bokningar mån–sön" />
        <Stat
          label="Aktiva tjänster"
          value={data.servicesActive}
          icon="scissors"
          hint={`${data.staffActive} medarbetare i tjänst`}
        />
        <Stat
          label="Nya lojalitetskunder"
          value={newLoyaltyThisWeek}
          icon="gift"
          hint="Med första poäng denna vecka"
        />
      </div>

      {/* asymmetriskt arbetsbord — vänster 1.5fr dominerar, höger 1fr stödinfo */}
      <div className="bo-2col">
        {/* vänster: Kommande idag + Topptimmar */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card pad={0}>
            <div
              style={{
                padding: '18px 22px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 className="h2">Kommande idag</h2>
              <Link
                href="/admin/bokningar"
                style={{
                  color: 'var(--c-forest)',
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Alla bokningar <Icon name="arrowRight" size={15} />
              </Link>
            </div>
            <div style={{ padding: '0 10px 10px' }}>
              {todayUpcoming.length === 0 ? (
                <div style={{ padding: '0 12px 12px' }}>
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
                      {data.todayCount === 0 ? 'Inga bokningar idag.' : 'Inga fler tider kvar idag.'}
                    </strong>
                    {data.todayCount === 0
                      ? 'Nya bokningar från din publika sajt dyker upp här automatiskt.'
                      : `Alla dagens tider är genomförda — ${todayDone} klara.`}
                  </div>
                </div>
              ) : (
                todayUpcoming.map((b) => (
                  <Link key={b.id} href="/admin/bokningar" className={styles.bookingRow}>
                    <div
                      className="num"
                      style={{ width: 48, fontWeight: 700, color: 'var(--c-forest)', fontSize: 15 }}
                    >
                      {formatTime(b.startTs, tenant.timeZone)}
                    </div>
                    <div
                      style={{ width: 3, height: 34, borderRadius: 999, background: 'var(--c-gold)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: 'var(--c-ink)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        {todayNames.get(b.id) ?? 'Gäst'}
                        {b.note && b.note.trim() !== '' && (
                          <Icon name="message" size={14} style={{ color: 'var(--c-gold-600)' }} />
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>
                        {b.serviceName} · {b.staffTitle}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{statusLabel(b.status)}</Badge>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 className="h2" style={{ marginTop: 0 }}>
                Topptimmar
              </h2>
              <span className="small">När flest kunder bokar denna vecka ({tenant.timeZone})</span>
            </div>
            {data.peakHours.length === 0 ? (
              <p style={{ color: 'var(--c-ink-2)', fontSize: 14, margin: 0 }}>
                Inga bokningar denna vecka ännu.
              </p>
            ) : (
              <div className={styles.peakChart}>
                {[...data.peakHours]
                  .sort((a, b) => a.hour - b.hour)
                  .map((h) => (
                    <div key={h.hour} className={styles.peakCol}>
                      <div
                        className={`${styles.peakBar}${h.count === peakMax ? ` ${styles.peakBarMax}` : ''}`}
                        style={{ height: `${(h.count / peakMax) * 100}%` }}
                        title={`${h.count} bokningar`}
                      />
                      <span className="num" style={{ fontSize: 11, color: 'var(--c-ink-3)' }}>
                        {String(h.hour).padStart(2, '0')}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        {/* höger: Tjänste-mix + Röd tråd + Stripe */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <h2 className="h2" style={{ marginTop: 0, marginBottom: 16 }}>
              Tjänste-mix
            </h2>
            {data.serviceMix.length === 0 ? (
              <p style={{ color: 'var(--c-ink-2)', fontSize: 14, margin: 0 }}>
                Inga bokningar denna vecka ännu.
              </p>
            ) : (
              <div>
                <div
                  style={{
                    display: 'flex',
                    height: 14,
                    borderRadius: 999,
                    overflow: 'hidden',
                    boxShadow: 'inset 0 0 0 1px var(--c-line)',
                  }}
                >
                  {data.serviceMix.map((s, i) => (
                    <div
                      key={s.name}
                      title={`${s.name} · ${Math.round((s.count / mixTotal) * 100)}%`}
                      style={{
                        width: `${(s.count / mixTotal) * 100}%`,
                        background: MIX_COLORS[i % MIX_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px 18px',
                    marginTop: 16,
                  }}
                >
                  {data.serviceMix.map((s, i) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          flex: 'none',
                          background: MIX_COLORS[i % MIX_COLORS.length],
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--c-ink-2)',
                          flex: 1,
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.name}
                      </span>
                      <span
                        className="num"
                        style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-ink)' }}
                      >
                        {Math.round((s.count / mixTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Röd tråd — den inverterade skogs-banden + gold storefront-CTA (§4.7) */}
          <Card style={{ background: 'var(--c-forest)', color: 'var(--c-on-forest)', border: 'none' }}>
            <span className="eyebrow" style={{ color: 'var(--c-gold)' }}>
              Röd tråd
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 21,
                fontWeight: 700,
                color: '#fff',
                margin: '8px 0 6px',
              }}
            >
              Din sida, live
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--c-on-forest-2)', margin: 0 }}>
              Avboka en tid och den blir bokningsbar igen på storefronten direkt — ingen extra knapp,
              ingen deploy.
            </p>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pbtn pbtn--gold pbtn--md"
              style={{ marginTop: 16 }}
            >
              <Icon name="external" size={17} />
              Öppna {siteHost}
            </a>
          </Card>

          {/* Stripe — REAL koppling. Ansluten / påbörjad / ej ansluten (empty-state). */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              {/* Stripe-brand glyph — the branded purple tile + white "S" (mock
                  line 133). #635BFF is Stripe's own brand color, deliberately NOT a
                  --c-* token (the no-hardcoded-hex rule is for our own palette). */}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#635BFF',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                }}
              >
                S
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>Stripe</div>
                <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>
                  {stripeConnected
                    ? 'Kortbetalning aktiv'
                    : stripeStarted
                      ? 'Onboarding påbörjad'
                      : 'Koppla för kortbetalning'}
                </div>
              </div>
              {stripeConnected ? (
                <Badge tone="success">Ansluten</Badge>
              ) : stripeStarted ? (
                <Badge tone="gold">Påbörjad</Badge>
              ) : (
                <Badge tone="neutral">Ej ansluten</Badge>
              )}
            </div>
            {!stripeConnected && (
              <div style={{ marginTop: 14 }}>
                <Button href="/admin/installningar" variant="subtle" size="sm" icon="settings">
                  {stripeStarted ? 'Slutför i Inställningar' : 'Anslut i Inställningar'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}
