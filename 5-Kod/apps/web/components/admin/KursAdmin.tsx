'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EventRow, RegistrationRow } from '@/lib/admin/events/types'
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from '@/lib/admin/events/types'
import { formatPrice, centsToKronorInput } from '@/lib/admin/format'
import { TenantScope, TenantField } from './TenantScope'
import {
  createTenantEvent,
  updateTenantEvent,
  setTenantEventStatus,
  deleteTenantEvent,
  setRegistrationStatus,
} from '@/lib/admin/events/actions'
import type { ActionState } from '@/lib/admin/actions'
import {
  Badge,
  Button,
  Callout,
  Card,
  Drawer,
  EmptyState,
  Field,
  PageHead,
  PillToggle,
  RowEditButton,
  Table,
  inputStyle,
  statusTone,
  textareaStyle,
  useToast,
} from '@/components/portal/ui'

// ── Formatted date/time (sv-SE) ───────────────────────────────────────────────
function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

/** ISO → "YYYY-MM-DDTHH:mm" (local) for <input type="datetime-local">. */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Main exported component ───────────────────────────────────────────────────
export function KursAdmin({
  events,
  registrations,
  tenantName,
  tenantId,
}: {
  events: EventRow[]
  registrations: RegistrationRow[]
  tenantName: string
  /** Set ONLY by the super-admin kundkort (/salonger/[id]) — scopes every form's hidden tenantId for the dual-guard. */
  tenantId?: string
}) {
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <TenantScope tenantId={tenantId}>
    <div>
      <PageHead
        eyebrow={tenantName}
        title="Kurser & event"
        lede="Skapa tillfällen med datum, platser och avgift — och hantera anmälningarna."
      >
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Nytt tillfälle
        </Button>
      </PageHead>

      <Callout tone="gold" icon="info">
        Öppna tillfällen kan ta emot anmälningar. Ställ in ett tillfälle i stället för att ta bort
        det när det redan har anmälningar.
      </Callout>

      <Card pad={0} style={{ marginTop: 16 }}>
        {events.length === 0 ? (
          <EmptyState
            title="Inga tillfällen ännu"
            text={
              <>
                Skapa ditt första tillfälle med <strong>Nytt tillfälle</strong> — titel, datum och
                tid, max antal platser och avgift.
              </>
            }
          />
        ) : (
          <Table
            cols={['Datum', 'Titel', 'Platser', 'Avgift', 'Status', '']}
            rows={events.map((e) => [
              <span key="date" className="num" style={{ fontSize: 12.5, color: 'var(--c-ink-2)', whiteSpace: 'nowrap' }}>
                {fmtDateTime(e.starts_at)}
              </span>,
              <b key="title" style={{ fontWeight: 600 }}>
                {e.title}
              </b>,
              <span key="seats" className="num" style={{ fontSize: 12.5, color: 'var(--c-ink-2)' }}>
                {e.taken}/{e.capacity}
              </span>,
              <span key="price" className="num" style={{ fontSize: 12.5, color: 'var(--c-ink-2)' }}>
                {e.price_cents > 0 ? formatPrice(e.price_cents) : 'Gratis'}
              </span>,
              <Badge key="status" tone={statusTone(e.status)}>
                {EVENT_STATUS_LABELS[e.status as keyof typeof EVENT_STATUS_LABELS] ?? e.status}
              </Badge>,
              <RowEditButton key="edit" onClick={() => setEditing(e)} ariaLabel={`Redigera ${e.title}`} />,
            ])}
          />
        )}
      </Card>

      {creating && <CreateDrawer onClose={() => setCreating(false)} />}
      {editing && (
        <EditDrawer
          key={editing.id}
          event={editing}
          registrations={registrations.filter((r) => r.event_id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
    </TenantScope>
  )
}

// ── Shared event form fields (create + edit) ──────────────────────────────────
function EventFields({ formId, event }: { formId?: string; event?: EventRow }) {
  return (
    <>
      <Field label="Titel">
        <input form={formId} name="title" defaultValue={event?.title ?? ''} required style={inputStyle} />
      </Field>
      <Field label="Datum & tid">
        <input
          form={formId}
          name="starts_at"
          type="datetime-local"
          defaultValue={event ? toDatetimeLocal(event.starts_at) : ''}
          required
          style={inputStyle}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Längd (min)">
          <input
            form={formId}
            name="duration_min"
            type="number"
            min={15}
            step={5}
            defaultValue={event?.duration_min ?? 120}
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Max platser">
          <input
            form={formId}
            name="capacity"
            type="number"
            min={1}
            max={500}
            defaultValue={event?.capacity ?? 10}
            required
            className="num"
            style={inputStyle}
          />
        </Field>
      </div>
      <Field label="Avgift (kr)">
        <input
          form={formId}
          name="price"
          inputMode="decimal"
          placeholder="0 = gratis"
          defaultValue={event ? centsToKronorInput(event.price_cents) : ''}
          className="num"
          style={inputStyle}
        />
      </Field>
      <Field label="Beskrivning">
        <textarea form={formId} name="description" defaultValue={event?.description ?? ''} style={textareaStyle} />
      </Field>
    </>
  )
}

// ── Create drawer ─────────────────────────────────────────────────────────────
function CreateDrawer({ onClose }: { onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenantEvent, {})

  useEffect(() => {
    if (state.success) {
      notify('Tillfälle skapat', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <Drawer
      title="Nytt tillfälle"
      sub="Titel, datum & tid och max platser krävs."
      onClose={onClose}
      ariaLabel="Nytt tillfälle"
      footer={
        <form
          action={formAction}
          id="create-tenant-event"
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <TenantField />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Skapa tillfälle'}
          </Button>
        </form>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <EventFields formId="create-tenant-event" />
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}

// ── Registration row (inside edit drawer) ─────────────────────────────────────
function RegistrationItem({ reg }: { reg: RegistrationRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setRegistrationStatus,
    {},
  )
  const cancelled = reg.status === 'cancelled'

  useEffect(() => {
    if (state.success) {
      notify(cancelled ? `${reg.name} återanmäld` : `${reg.name} avbokad`, 'success')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 0',
        borderTop: '1px solid var(--c-line)',
        opacity: cancelled ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 600, fontSize: 13.5 }}>
          {reg.name}
          <span className="num" style={{ fontWeight: 400, color: 'var(--c-ink-3)' }}>
            {' '}· {reg.party_size} {reg.party_size === 1 ? 'plats' : 'platser'}
          </span>
          {cancelled && (
            <span style={{ fontWeight: 400, color: 'var(--c-ink-3)' }}> · avbokad</span>
          )}
        </b>
        <div style={{ fontSize: 12.5, color: 'var(--c-ink-2)', marginTop: 2 }}>
          {[reg.email, reg.phone].filter(Boolean).join(' · ') || '—'}
        </div>
        {reg.message && (
          <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 2 }}>
            ”{reg.message}”
          </div>
        )}
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: '4px 0 0' }}>
            {state.error}
          </p>
        )}
      </div>
      <form action={formAction} style={{ display: 'inline-flex', flex: 'none' }}>
        <TenantField />
        <input type="hidden" name="id" value={reg.id} />
        <input type="hidden" name="status" value={cancelled ? 'confirmed' : 'cancelled'} />
        <PillToggle
          type="submit"
          active={!cancelled}
          disabled={pending}
          ariaLabel={`${cancelled ? 'Återanmäl' : 'Avboka'}: ${reg.name}`}
        >
          {pending ? '…' : cancelled ? 'Återanmäl' : 'Avboka'}
        </PillToggle>
      </form>
    </div>
  )
}

// ── Status buttons (inside edit drawer) ───────────────────────────────────────
function StatusButton({ event, status }: { event: EventRow; status: (typeof EVENT_STATUSES)[number] }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setTenantEventStatus,
    {},
  )
  const active = event.status === status

  useEffect(() => {
    if (state.success) {
      notify(`"${event.title}" satt till ${EVENT_STATUS_LABELS[status].toLowerCase()}`, 'success')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <form action={formAction} style={{ display: 'inline-flex' }}>
      <TenantField />
      <input type="hidden" name="id" value={event.id} />
      <input type="hidden" name="status" value={status} />
      <PillToggle type="submit" active={active} disabled={pending || active}>
        {pending ? '…' : EVENT_STATUS_LABELS[status]}
      </PillToggle>
    </form>
  )
}

// ── Edit drawer ───────────────────────────────────────────────────────────────
function EditDrawer({
  event,
  registrations,
  onClose,
}: {
  event: EventRow
  registrations: RegistrationRow[]
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [save, saveAction, saving] = useActionState<ActionState, FormData>(updateTenantEvent, {})
  const [del, delAction, deleting] = useActionState<ActionState, FormData>(deleteTenantEvent, {})
  // Tvåstegsbekräftelse: "Ta bort" raderade tidigare på ETT klick — granne med
  // "Spara" i samma footer, på ett tillfälle som kan ha anmälda deltagare.
  // Klick 1 armerar (knappen blir "Säker? Ta bort permanent" i varningston + en
  // Ångra), klick 2 skickar delete-formuläret. Drawern remountas per tillfälle
  // (key=event.id) så armeringen kan aldrig läcka mellan tillfällen. Samma
  // mönster som ServicesManager/StaffRoster.
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (save.success) {
      notify('Tillfälle uppdaterat', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.success])

  useEffect(() => {
    if (del.success) {
      notify('Tillfälle borttaget', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [del.success])

  const formId = `edit-tenant-event-${event.id}`
  const confirmed = registrations.filter((r) => r.status === 'confirmed')

  return (
    <Drawer
      title={event.title}
      sub={`${fmtDateTime(event.starts_at)} · ${event.taken}/${event.capacity} platser`}
      accent={
        <Badge tone={statusTone(event.status)}>
          {EVENT_STATUS_LABELS[event.status as keyof typeof EVENT_STATUS_LABELS] ?? event.status}
        </Badge>
      }
      onClose={onClose}
      ariaLabel={`Redigera ${event.title}`}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
          <form action={delAction} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <TenantField />
            <input type="hidden" name="id" value={event.id} />
            {confirmDelete ? (
              <>
                <Button
                  variant="ghost"
                  type="submit"
                  icon="trash"
                  disabled={deleting}
                  style={{ color: 'var(--c-danger)' }}
                >
                  {deleting ? '…' : 'Säker? Ta bort permanent'}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setConfirmDelete(false)}>
                  Ångra
                </Button>
              </>
            ) : (
              <Button variant="ghost" type="button" icon="trash" onClick={() => setConfirmDelete(true)}>
                Ta bort
              </Button>
            )}
          </form>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="check" disabled={saving}>
            {saving ? 'Sparar…' : 'Spara'}
          </Button>
        </div>
      }
    >
      <form action={saveAction} id={formId} style={{ display: 'grid', gap: 14 }}>
        <TenantField />
        <input type="hidden" name="id" value={event.id} />
        <EventFields event={event} />
      </form>

      <div style={{ marginTop: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Status
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EVENT_STATUSES.map((s) => (
            <StatusButton key={s} event={event} status={s} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Anmälningar · {confirmed.length}
        </p>
        {registrations.length === 0 ? (
          <p className="body" style={{ margin: 0, fontSize: 13, color: 'var(--c-ink-2)' }}>
            Inga anmälningar ännu.
          </p>
        ) : (
          <div>
            {registrations.map((r) => (
              <RegistrationItem key={r.id} reg={r} />
            ))}
          </div>
        )}
      </div>

      {(save.error || del.error) && (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {save.error || del.error}
        </p>
      )}
    </Drawer>
  )
}
