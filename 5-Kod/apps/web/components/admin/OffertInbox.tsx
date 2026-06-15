'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { OffertRequestRow } from '@/lib/admin/offert/types'
import {
  OFFERT_STATUSES,
  OFFERT_STATUS_LABELS,
  OFFERT_MODE_LABELS,
  formatCents,
} from '@/lib/admin/offert/types'
import { updateOffertRequest } from '@/lib/admin/offert/actions'
import {
  Badge,
  Button,
  Card,
  Drawer,
  Icon,
  Table,
  useToast,
  type BadgeTone,
} from '@/components/portal/ui'

// Local alias — matches ActionState from @/lib/admin/actions without crossing
// the 'use server' boundary in a client import (type-only, erased at build time).
type ActionState = { error?: string; success?: string }

// ── Status → Badge tone map ──────────────────────────────────────────────────
function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'new':
      return 'info'
    case 'reviewing':
      return 'warning'
    case 'quoted':
      return 'gold'
    case 'accepted':
      return 'success'
    case 'declined':
    case 'closed':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function statusLabel(status: string): string {
  return (OFFERT_STATUS_LABELS as Record<string, string>)[status] ?? status
}

function modeLabel(mode: string): string {
  return OFFERT_MODE_LABELS[mode] ?? mode
}

// ── Shared field wrapper ─────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  width: '100%',
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
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <button
            type="submit"
            form={formId}
            disabled={pending}
            className="pbtn pbtn--primary pbtn--md"
          >
            <Icon name="check" size={17} />
            {pending ? 'Sparar…' : 'Spara'}
          </button>
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
        <input type="hidden" name="id" value={request.id} />

        <Field label="Status">
          <select name="status" defaultValue={request.status} style={inputStyle}>
            {OFFERT_STATUSES.map((s) => (
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
    </Drawer>
  )
}

// ── Main inbox component ─────────────────────────────────────────────────────
export function OffertInbox({ requests }: { requests: OffertRequestRow[] }) {
  const [selected, setSelected] = useState<OffertRequestRow | null>(null)

  if (requests.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--c-ink-2)' }}>
          <Icon name="message" size={32} style={{ color: 'var(--c-ink-3)', marginBottom: 10 }} />
          <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 6 }}>
            Inga förfrågningar än.
          </strong>
          De dyker upp här när kunder skickar in via din publika sida.
        </div>
      </Card>
    )
  }

  return (
    <div>
      <Card pad={0}>
        <div style={{ overflowX: 'auto' }}>
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
              <button
                key="edit"
                type="button"
                onClick={() => setSelected(r)}
                aria-label={`Öppna förfrågan från ${r.customer_name ?? 'okänd kund'}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--c-ink-3)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'inline-grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="edit" size={17} />
              </button>,
            ])}
          />
        </div>
      </Card>

      {selected && (
        <DetailDrawer
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
