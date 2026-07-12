'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OffertRequestRow } from '@/lib/admin/offert/types'
import {
  OFFERT_STATUSES,
  OFFERT_STATUS_LABELS,
  OFFERT_MODE_LABELS,
  formatCents,
  offertDeletable,
  offertTransitionAllowed,
} from '@/lib/admin/offert/types'
import {
  updateOffertRequest,
  sendOffertReply,
  deleteOffertRequest,
} from '@/lib/admin/offert/actions'
import { TenantScope, TenantField } from './TenantScope'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Field,
  Icon,
  PageHead,
  RowEditButton,
  Table,
  inputStyle,
  statusTone,
  useToast,
} from '@/components/portal/ui'

// Local alias — matches ActionState from @/lib/admin/actions without crossing
// the 'use server' boundary in a client import (type-only, erased at build time).
type ActionState = { error?: string; success?: string }

function statusLabel(status: string): string {
  return (OFFERT_STATUS_LABELS as Record<string, string>)[status] ?? status
}

function modeLabel(mode: string): string {
  return OFFERT_MODE_LABELS[mode] ?? mode
}

// ── Date formatter ───────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// ── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({
  request,
  onClose,
}: {
  request: OffertRequestRow
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateOffertRequest,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  useEffect(() => {
    if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.error])

  const formId = `offert-detail-${request.id}`
  const estimateKronor =
    request.estimate_cents != null ? (request.estimate_cents / 100).toString() : ''

  return (
    <Drawer
      title={request.customer_name ?? 'Okänd kund'}
      sub={modeLabel(request.mode)}
      accent={
        <Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge>
      }
      onClose={onClose}
      ariaLabel={`Förfrågan från ${request.customer_name ?? 'okänd kund'}`}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
          <DeleteForm request={request} onDeleted={onClose} />
          <div style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Spara'}
          </Button>
        </div>
      }
    >
      {/* Contact info (read-only) */}
      <div
        style={{
          display: 'grid',
          gap: 6,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--c-paper-2)',
          border: '1px solid var(--c-line)',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--c-ink-2)',
        }}
      >
        {request.customer_email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="mail" size={13} />
            <span>{request.customer_email}</span>
          </div>
        )}
        {request.customer_phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="phone" size={13} />
            <span>{request.customer_phone}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="clock" size={13} />
          <span>{formatDate(request.created_at)}</span>
        </div>
      </div>

      {/* Message (read-only) */}
      {request.message && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--c-line)',
            background: 'var(--c-paper)',
            fontSize: 14,
            color: 'var(--c-ink)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.55,
          }}
        >
          {request.message}
        </div>
      )}

      {/* Subject (read-only) */}
      {request.subject && (
        <div
          style={{
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--c-ink-2)',
          }}
        >
          <span className="eyebrow" style={{ marginRight: 6 }}>
            Ämne:
          </span>
          {request.subject}
        </div>
      )}

      {/* Editable fields */}
      <form action={formAction} id={formId} style={{ display: 'grid', gap: 14 }}>
        <TenantField />
        <input type="hidden" name="id" value={request.id} />

        <Field label="Status">
          {/* FSM: bara tillåtna övergångar visas (nuvarande status alltid valbar). */}
          <select name="status" defaultValue={request.status} style={inputStyle}>
            {OFFERT_STATUSES.filter((s) => offertTransitionAllowed(request.status, s)).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Intern anteckning">
          <textarea
            name="note"
            defaultValue={request.note ?? ''}
            rows={3}
            placeholder="Anteckning som bara du ser…"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
          />
        </Field>

        <Field label="Prisuppskattning (kr)">
          <input
            name="estimate"
            type="text"
            inputMode="decimal"
            defaultValue={estimateKronor}
            placeholder="Lämna tomt om ej tillämpligt"
            className="num"
            style={inputStyle}
          />
        </Field>
      </form>

      {state.error && (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {state.error}
        </p>
      )}

      {/* SVARA KUNDEN (goal-54 körning 3, A4): svaret mejlas via mejl-rälsen och
          status flyttas till Offererad — "Offererad" betyder nu att kunden faktiskt
          fått något. Eget formulär (egen action) så Spara ovan förblir intern. */}
      <ReplySection request={request} onDone={onClose} />
    </Drawer>
  )
}

/**
 * Radera förfrågan — så spam går att rensa. Tvåstegs-"arm" (EXAKT samma mönster
 * som ServicesManager/StaffRoster): klick 1 armar, klick 2 raderar. Egen <form>
 * med egen action, så Spara-formuläret i kroppen förblir orört.
 *
 * En offert som blivit en affär visar ingen knapp alls — och server-actionen
 * nekar ändå (offertDeletable läses där ur DB:n, inte ur formuläret).
 */
function DeleteForm({
  request,
  onDeleted,
}: {
  request: OffertRequestRow
  onDeleted: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteOffertRequest,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify('Förfrågan raderad.', 'info')
      router.refresh()
      onDeleted()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  useEffect(() => {
    if (state.error) {
      notify(state.error, 'warning')
      setArmed(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.error])

  // En accepterad/betald förfrågan är en affär — den raderas inte bort ur historiken.
  if (!offertDeletable(request.status, request.payment_status)) return null

  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <TenantField />
      <input type="hidden" name="id" value={request.id} />
      {armed ? (
        <>
          <Button
            variant="ghost"
            type="submit"
            icon="trash"
            disabled={pending}
            style={{ color: 'var(--c-danger)' }}
          >
            {pending ? '…' : 'Säker? Ta bort permanent'}
          </Button>
          <Button variant="ghost" type="button" onClick={() => setArmed(false)}>
            Ångra
          </Button>
        </>
      ) : (
        <Button variant="ghost" type="button" icon="trash" onClick={() => setArmed(true)}>
          Ta bort
        </Button>
      )}
    </form>
  )
}

function ReplySection({ request, onDone }: { request: OffertRequestRow; onDone: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendOffertReply, {})

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])
  useEffect(() => {
    if (state.error) notify(state.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.error])

  const noEmail = !request.customer_email

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--c-line)', paddingTop: 16 }}>
      <span className="eyebrow">Svara kunden</span>
      {request.replied_at ? (
        <div
          style={{
            margin: '10px 0 12px',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--c-line)',
            background: 'var(--c-paper-2)',
            fontSize: 13,
            color: 'var(--c-ink-2)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4, color: 'var(--c-ink)' }}>
            Svar skickat {formatDate(request.replied_at)}
          </strong>
          {request.reply_message}
        </div>
      ) : null}
      {noEmail ? (
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--c-ink-3)' }}>
          Förfrågan saknar e-postadress — kontakta kunden per telefon.
        </p>
      ) : (
        <form action={formAction} style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <TenantField />
          <input type="hidden" name="id" value={request.id} />
          <textarea
            name="reply"
            rows={4}
            required
            placeholder={
              request.replied_at
                ? 'Skicka ett nytt svar till kunden…'
                : `Skriv ditt svar — mejlas till ${request.customer_email}. Sparad prisuppskattning följer med.`
            }
            style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" type="submit" icon="mail" disabled={pending}>
              {pending ? 'Skickar…' : 'Skicka svar till kunden'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Main inbox component ─────────────────────────────────────────────────────
export function OffertInbox({
  requests,
  tenantName,
  /** Set ONLY by the super-admin kundkort (/salonger/[id]) — scopes every form's hidden tenantId for the dual-guard. */
  tenantId,
}: {
  requests: OffertRequestRow[]
  tenantName: string
  tenantId?: string
}) {
  const [selected, setSelected] = useState<OffertRequestRow | null>(null)

  return (
    <TenantScope tenantId={tenantId}>
    <div>
      <PageHead
        eyebrow={tenantName}
        title="Offerter"
        lede="Kundens inkomna offertförfrågningar — status, anteckning, prisuppskattning och svar."
      />

      {requests.length === 0 ? (
        <EmptyState
          icon="message"
          title="Inga förfrågningar än."
          text="De dyker upp här när kunder skickar in via din publika sida."
        />
      ) : (
      <Card pad={0}>
          <Table
            cols={['Kund', 'Typ', 'Meddelande', 'Status', 'Datum', '']}
            rows={requests.map((r) => [
              /* Kund */
              <div key="kund">
                <b style={{ fontWeight: 600 }}>{r.customer_name ?? '—'}</b>
                {r.customer_email && (
                  <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2 }}>
                    {r.customer_email}
                  </div>
                )}
                {r.customer_phone && !r.customer_email && (
                  <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2 }}>
                    {r.customer_phone}
                  </div>
                )}
              </div>,

              /* Typ */
              <span key="typ" style={{ fontSize: 13, color: 'var(--c-ink-2)' }}>
                {modeLabel(r.mode)}
              </span>,

              /* Meddelande preview */
              <span
                key="msg"
                style={{
                  fontSize: 13,
                  color: 'var(--c-ink-2)',
                  maxWidth: 260,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={r.message ?? undefined}
              >
                {r.subject
                  ? r.subject
                  : r.message
                    ? r.message.slice(0, 80) + (r.message.length > 80 ? '…' : '')
                    : '—'}
              </span>,

              /* Status */
              <div key="status" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                {r.estimate_cents != null && (
                  <span
                    style={{ fontSize: 12, color: 'var(--c-gold-600)', fontWeight: 600 }}
                  >
                    {formatCents(r.estimate_cents, r.currency)}
                  </span>
                )}
              </div>,

              /* Datum */
              <span
                key="datum"
                style={{ fontSize: 13, color: 'var(--c-ink-3)', whiteSpace: 'nowrap' }}
              >
                {formatDate(r.created_at)}
              </span>,

              /* Redigera */
              <RowEditButton
                key="edit"
                onClick={() => setSelected(r)}
                ariaLabel={`Öppna förfrågan från ${r.customer_name ?? 'okänd kund'}`}
              />,
            ])}
          />
      </Card>
      )}

      {selected && (
        <DetailDrawer
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
    </TenantScope>
  )
}
