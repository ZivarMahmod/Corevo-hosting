// SERVER component — no 'use client', no hooks. Read-only loyalty dashboard: it VIEWS
// the program (config + earned points) and never edits anything (config is super-admin
// locked; loyalty_ledger is appended only by the booking flow). Presentational: takes
// fully-resolved props, imports only react types + server-safe UI primitives + the pure
// loyalty types. No data/action imports → no client/server boundary risk.

import type { ReactNode } from 'react'
import { PageHead, Card, Stat, Table, Badge, Callout, type BadgeTone } from '@/components/portal/ui'
import type {
  LoyaltyConfig,
  LoyaltyMemberRow,
  LoyaltyActivityRow,
} from '@/lib/admin/lojalitet/types'
import { reasonLabel, pointsToStamps } from '@/lib/admin/lojalitet/types'

// ── Formatters ───────────────────────────────────────────────────────────────
const NUM = new Intl.NumberFormat('sv-SE')

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function variantLabel(v: LoyaltyConfig['variant']): string {
  return v === 'stamp_card' ? 'Stämpelkort' : 'Poäng'
}

// ── Small read-only config field ─────────────────────────────────────────────
function ConfigField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="eyebrow">{label}</span>
      <span style={{ fontSize: 14, color: 'var(--c-ink)', lineHeight: 1.45 }}>{value}</span>
    </div>
  )
}

export function LojalitetAdmin({
  config,
  members,
  activity,
  tenantName,
}: {
  config: LoyaltyConfig
  members: LoyaltyMemberRow[]
  activity: LoyaltyActivityRow[]
  tenantName: string
}) {
  const isStamp = config.variant === 'stamp_card'
  const memberCount = members.length
  // Total points handed out = sum of positive earn deltas across the balances we can
  // see. Balances are signed (earn − redeem); for an honest "utdelade poäng" headline
  // we only count the net positive balances (never a negative number).
  const pointsOut = members.reduce((s, m) => s + Math.max(0, m.pointsBalance), 0)

  return (
    <>
      <PageHead eyebrow={tenantName} title="Lojalitet" />

      {/* Overview KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Stat label="Program" value={variantLabel(config.variant)} icon={isStamp ? 'gift' : 'star'} />
        <Stat label="Medlemmar" value={NUM.format(memberCount)} icon="users" />
        <Stat label="Utestående poäng" value={NUM.format(pointsOut)} icon="trendUp" />
      </div>

      {/* Program config (read-only) */}
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 18,
            marginBottom: 16,
          }}
        >
          <ConfigField label="Rubrik" value={config.headline || '—'} />
          <ConfigField label="Förmån" value={config.perkText.trim() ? config.perkText : '—'} />
          {isStamp ? (
            <ConfigField label="Stämplar till förmån" value={NUM.format(config.stampGoal)} />
          ) : (
            <ConfigField label="Poäng per besök" value={NUM.format(config.pointsPerVisit)} />
          )}
        </div>
        <Callout tone="info" icon="info">
          Programmet ställs in av plattformsadmin. Poäng tjänas automatiskt vid avslutade
          bokningar.
        </Callout>
      </Card>

      {/* Members */}
      <Card pad={0} style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 18px 0' }}>
          <span className="eyebrow">Medlemmar</span>
        </div>
        {memberCount === 0 ? (
          <div style={{ padding: '20px 18px', color: 'var(--c-ink-2)', fontSize: 14 }}>
            Inga medlemmar har tjänat poäng än.
          </div>
        ) : (
          <Table
            cols={
              isStamp
                ? ['Kund', 'Poäng', 'Stämplar', 'Besök', 'Senast aktiv']
                : ['Kund', 'Poäng', 'Besök', 'Senast aktiv']
            }
            rows={members.map((m) => {
              const kund = (
                <b key="kund" style={{ fontWeight: 600 }}>
                  {m.customerName ?? 'Okänd kund'}
                </b>
              )
              const poang = (
                <span key="poang" className="num" style={{ fontWeight: 600, color: 'var(--c-ink)' }}>
                  {NUM.format(m.pointsBalance)}
                </span>
              )
              const besok = (
                <span key="besok" className="num" style={{ color: 'var(--c-ink-2)' }}>
                  {NUM.format(m.visits)}
                </span>
              )
              const senast = (
                <span
                  key="senast"
                  style={{ fontSize: 13, color: 'var(--c-ink-3)', whiteSpace: 'nowrap' }}
                >
                  {m.lastActivityAt ? formatDate(m.lastActivityAt) : '—'}
                </span>
              )
              if (isStamp) {
                const stamps = (
                  <span key="stamps" className="num" style={{ color: 'var(--c-ink-2)' }}>
                    {NUM.format(pointsToStamps(m.pointsBalance, config.pointsPerVisit))}
                    <span style={{ color: 'var(--c-ink-3)' }}> / {NUM.format(config.stampGoal)}</span>
                  </span>
                )
                return [kund, poang, stamps, besok, senast]
              }
              return [kund, poang, besok, senast]
            })}
          />
        )}
      </Card>

      {/* Recent activity */}
      <Card pad={0}>
        <div style={{ padding: '16px 18px 0' }}>
          <span className="eyebrow">Senaste aktivitet</span>
        </div>
        {activity.length === 0 ? (
          <div style={{ padding: '20px 18px', color: 'var(--c-ink-2)', fontSize: 14 }}>
            Ingen aktivitet än.
          </div>
        ) : (
          <Table
            cols={['Kund', 'Poäng', 'Typ', 'När']}
            rows={activity.map((a) => {
              const tone: BadgeTone = a.pointsDelta > 0 ? 'success' : 'neutral'
              const sign = a.pointsDelta > 0 ? '+' : ''
              return [
                <b key="kund" style={{ fontWeight: 600 }}>
                  {a.customerName ?? 'Okänd kund'}
                </b>,
                <Badge key="poang" tone={tone}>
                  {sign}
                  {NUM.format(a.pointsDelta)}
                </Badge>,
                <span key="typ" style={{ fontSize: 13, color: 'var(--c-ink-2)' }}>
                  {reasonLabel(a.reason)}
                </span>,
                <span
                  key="nar"
                  style={{ fontSize: 13, color: 'var(--c-ink-3)', whiteSpace: 'nowrap' }}
                >
                  {formatDate(a.createdAt)}
                </span>,
              ]
            })}
          />
        )}
      </Card>
    </>
  )
}
