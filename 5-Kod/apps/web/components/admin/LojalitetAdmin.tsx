'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHead,
  Card,
  Stat,
  Table,
  Badge,
  Button,
  Callout,
  useToast,
  type BadgeTone,
} from '@/components/portal/ui'
import type { ActionState } from '@/lib/admin/actions'
import {
  reverseLoyaltySpend,
  spendLoyaltyPoints,
} from '@/lib/admin/lojalitet/actions'
import type {
  LoyaltyConfig,
  LoyaltyMemberRow,
  LoyaltyActivityRow,
} from '@/lib/admin/lojalitet/types'
import { reasonLabel, pointsToStamps } from '@/lib/admin/lojalitet/types'

// ── Formatters ───────────────────────────────────────────────────────────────
const NUM = new Intl.NumberFormat('sv-SE')
const inputStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
}

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
          Poäng tjänas automatiskt vid avslutade bokningar. Inlösen och återställning
          bokförs som nya ledgerposter; historik skrivs aldrig över.
        </Callout>
      </Card>

      <LoyaltySpendCard members={members} />

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
            cols={['Kund', 'Poäng', 'Typ', 'När', '']}
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
                a.reason === 'redeem' ? (
                  <ReverseSpendCell key="reverse" activity={a} />
                ) : (
                  <span key="reverse" aria-hidden="true" />
                ),
              ]
            })}
          />
        )}
      </Card>
    </>
  )
}

function LoyaltySpendCard({ members }: { members: LoyaltyMemberRow[] }) {
  const { notify } = useToast()
  const router = useRouter()
  const [requestId, setRequestId] = useState('')
  const [state, action, pending] = useActionState<ActionState, FormData>(
    spendLoyaltyPoints,
    {},
  )
  const eligible = members.filter((member) => member.pointsBalance > 0)

  useEffect(() => setRequestId(crypto.randomUUID()), [])
  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      setRequestId(crypto.randomUUID())
      router.refresh()
    }
    if (state.error) notify(state.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  return (
    <Card style={{ marginBottom: 16 }}>
      <span className="eyebrow">Använd poäng</span>
      {eligible.length === 0 ? (
        <p style={{ margin: '10px 0 0', color: 'var(--c-ink-2)', fontSize: 14 }}>
          Ingen kund har ett positivt poängsaldo.
        </p>
      ) : (
        <form
          action={action}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            gap: 10,
            alignItems: 'end',
            marginTop: 12,
          }}
        >
          <input type="hidden" name="requestId" value={requestId} />
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="eyebrow">Kund</span>
            <select name="customerId" required defaultValue="" style={inputStyle}>
              <option value="" disabled>
                Välj kund
              </option>
              {eligible.map((member) => (
                <option key={member.customerId} value={member.customerId}>
                  {member.customerName ?? 'Okänd kund'} · {NUM.format(member.pointsBalance)} p
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="eyebrow">Poäng</span>
            <input name="points" type="number" min="1" step="1" required style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="eyebrow">Notering</span>
            <input name="note" maxLength={500} placeholder="Valfritt" style={inputStyle} />
          </label>
          <Button variant="primary" type="submit" disabled={pending || !requestId}>
            {pending ? 'Sparar…' : 'Använd'}
          </Button>
        </form>
      )}
    </Card>
  )
}

function ReverseSpendCell({ activity }: { activity: LoyaltyActivityRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [requestId, setRequestId] = useState('')
  const [armed, setArmed] = useState(false)
  const [state, action, pending] = useActionState<ActionState, FormData>(
    reverseLoyaltySpend,
    {},
  )

  useEffect(() => setRequestId(crypto.randomUUID()), [])
  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
    }
    if (state.error) notify(state.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  if (!armed) {
    return (
      <Button variant="ghost" size="sm" type="button" onClick={() => setArmed(true)}>
        Återställ
      </Button>
    )
  }

  return (
    <form action={action} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="entryId" value={activity.id} />
      <input type="hidden" name="requestId" value={requestId} />
      <input
        name="reason"
        required
        maxLength={500}
        placeholder="Orsak"
        style={{ ...inputStyle, width: 150 }}
      />
      <Button variant="ghost" size="sm" type="submit" disabled={pending || !requestId}>
        {pending ? '…' : 'Bekräfta'}
      </Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => setArmed(false)}>
        Ångra
      </Button>
    </form>
  )
}
