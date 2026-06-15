'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { GiftCardRow } from '@/lib/admin/presentkort/types'
import {
  formatGiftAmount,
  giftStatusTone,
  giftStatusLabel,
} from '@/lib/admin/presentkort/types'
import { issueGiftCard, voidGiftCard } from '@/lib/admin/presentkort/actions'
import type { ActionState } from '@/lib/admin/actions'
import {
  Badge,
  Button,
  Card,
  Callout,
  Drawer,
  Icon,
  PageHead,
  Table,
  useToast,
} from '@/components/portal/ui'

// ── Shared input style (mirrors ShopAdmin) ──────────────────────────────────
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

// useActionState wants a (prevState, formData) reducer, but the server actions are
// single-arg administrative writes (issueGiftCard/voidGiftCard take only FormData).
// These thin adapters bridge the two without changing the action exports.
const issueAction = (_prev: ActionState, fd: FormData) => issueGiftCard(fd)
const voidAction = (_prev: ActionState, fd: FormData) => voidGiftCard(fd)

// ── Root component ──────────────────────────────────────────────────────────
export function PresentkortAdmin({
  cards,
  currency,
  fulfilment,
  tenantName,
}: {
  cards: GiftCardRow[]
  currency: string
  fulfilment: string
  tenantName: string
}) {
  const [creating, setCreating] = useState(false)
  // fulfilment is part of the module config contract (mirrors ShopAdmin's prop set);
  // gift cards are digital so it isn't surfaced in the UI, but it's kept on the
  // signature so the page→component contract matches the shop pattern.
  void fulfilment

  return (
    <div>
      <PageHead eyebrow={tenantName} title="Presentkort">
        <Button variant="primary" icon="gift" onClick={() => setCreating(true)}>
          Registrera presentkort
        </Button>
      </PageHead>

      <Callout tone="info" icon="info">
        Registrera presentkort du sålt eller gett ut. Online-köp och inlösen aktiveras när
        betalning slås på.
      </Callout>

      {/* ── Presentkort ── */}
      <div style={{ marginTop: 24 }}>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Utfärdade presentkort
        </h2>
        <Card pad={0}>
          {cards.length === 0 ? (
            <div style={{ padding: 22 }}>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                Inga presentkort än
              </p>
              <p className="body" style={{ margin: 0, maxWidth: 460, color: 'var(--c-ink-2)' }}>
                Registrera ditt första presentkort med{' '}
                <strong>Registrera presentkort</strong> — belopp och valfri mottagare.
              </p>
            </div>
          ) : (
            <Table
              cols={['Kod', 'Belopp', 'Saldo', 'Status', 'Mottagare', 'Skapat', '']}
              rows={cards.map((card) => [
                <span
                  key="kod"
                  className="num"
                  style={{ fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
                >
                  {card.code}
                </span>,
                <span key="belopp" className="num" style={{ fontWeight: 600 }}>
                  {formatGiftAmount(card.initialAmountCents, card.currency || currency)}
                </span>,
                <span key="saldo" className="num">
                  {formatGiftAmount(card.balanceCents, card.currency || currency)}
                </span>,
                <Badge key="status" tone={giftStatusTone(card.status)}>
                  {giftStatusLabel(card.status)}
                </Badge>,
                <RecipientCell key="mottagare" card={card} />,
                <span
                  key="skapat"
                  style={{ fontSize: 12, color: 'var(--c-ink-3)', whiteSpace: 'nowrap' }}
                >
                  {new Date(card.createdAt).toLocaleDateString('sv-SE')}
                </span>,
                <VoidCell key="void" card={card} />,
              ])}
            />
          )}
        </Card>
      </div>

      {creating && <CreateDrawer onClose={() => setCreating(false)} />}
    </div>
  )
}

// ── Table cells ─────────────────────────────────────────────────────────────

function RecipientCell({ card }: { card: GiftCardRow }) {
  if (!card.recipientName && !card.recipientEmail) {
    return <span style={{ fontSize: 13, color: 'var(--c-ink-3)' }}>—</span>
  }
  return (
    <div>
      {card.recipientName && <b style={{ fontWeight: 600 }}>{card.recipientName}</b>}
      {card.recipientEmail && (
        <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: card.recipientName ? 2 : 0 }}>
          {card.recipientEmail}
        </div>
      )}
    </div>
  )
}

function VoidCell({ card }: { card: GiftCardRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(voidAction, {})

  useEffect(() => {
    if (state.success) {
      notify('Presentkort makulerat.', 'success')
      router.refresh()
    }
    if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  // Only active cards can be voided.
  if (card.status !== 'active') {
    return <span aria-hidden="true" />
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Makulera presentkortet ${card.code}? Det kan inte ångras.`)) {
          e.preventDefault()
        }
      }}
      style={{ display: 'inline-flex', justifyContent: 'flex-end' }}
    >
      <input type="hidden" name="id" value={card.id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Makulera presentkort ${card.code}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid var(--c-line)',
          background: 'transparent',
          color: 'var(--c-ink-2)',
          cursor: pending ? 'default' : 'pointer',
          borderRadius: 8,
          padding: '5px 10px',
          fontSize: 12.5,
          fontFamily: 'var(--font-ui)',
          opacity: pending ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        <Icon name="trash" size={14} />
        {pending ? '…' : 'Makulera'}
      </button>
    </form>
  )
}

// ── Create Drawer ───────────────────────────────────────────────────────────

function CreateDrawer({ onClose }: { onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(issueAction, {})

  useEffect(() => {
    if (state.success) {
      notify('Presentkort skapat.', 'success')
      router.refresh()
      onClose()
    }
    if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  const formId = 'create-gift-card'

  return (
    <Drawer
      title="Registrera presentkort"
      sub="Belopp och valfri mottagare. Saldo sätts till beloppet."
      onClose={onClose}
      ariaLabel="Registrera presentkort"
      footer={
        <form
          action={formAction}
          id={formId}
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Skapa presentkort'}
          </Button>
        </form>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Belopp (kr)">
          <input
            form={formId}
            name="amountKr"
            type="number"
            min="1"
            step="1"
            required
            placeholder="0"
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Mottagarnamn">
          <input
            form={formId}
            name="recipientName"
            placeholder="Valfritt"
            style={inputStyle}
          />
        </Field>
        <Field label="Mottagarmejl">
          <input
            form={formId}
            name="recipientEmail"
            type="email"
            placeholder="Valfritt"
            style={inputStyle}
          />
        </Field>
        <Field label="Meddelande">
          <textarea
            form={formId}
            name="message"
            rows={3}
            placeholder="Valfri hälsning"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>
        <Field label="Giltigt t.o.m.">
          <input form={formId} name="expiresAt" type="date" style={inputStyle} />
        </Field>
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}
