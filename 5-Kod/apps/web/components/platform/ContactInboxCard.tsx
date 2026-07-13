'use client'

import { useActionState } from 'react'
import { setContactMessageStatus, type ActionState } from '@/lib/platform/actions'
import { Icon } from '@/components/portal/ui'
import styles from './platform.module.css'

/**
 * KONTAKT-INKORGEN (goal-64). Kontaktformuläret på storefronten skriver rader i
 * contact_messages och mejlar dem till kunden — men mejl drunknar, och en tabell ingen
 * kan öppna är samma sak som ingen tabell. Här läser kunden sina meddelanden och betar
 * av dem: new → läst → arkiverat.
 *
 * Samma kompakta <details>-mönster som ServicesCard: olästa syns direkt, arkiverade
 * ligger hopfällda längst ner. Render-on-present — tom inkorg ritar en tom-text, aldrig
 * en påhittad rad.
 */

export type ContactMessage = {
  id: string
  name: string
  email: string | null
  phone: string | null
  subject: string | null
  message: string
  status: 'new' | 'read' | 'archived'
  created_at: string
}

const dt = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** En statusknapp = ett eget litet formulär (server action + pending-läge). */
function StatusButton({
  tenantId,
  id,
  status,
  label,
}: {
  tenantId: string
  id: string
  status: 'read' | 'archived' | 'new'
  label: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setContactMessageStatus,
    {},
  )
  return (
    <form action={formAction} style={{ display: 'inline' }}>
      {/* tenantId följer med för super-admin; en salongsadmin får sitt ur JWT och
          servern ignorerar fältet — klienten kan alltså inte peka på fel kund. */}
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={styles.btnSubtle} disabled={pending}>
        {pending ? '…' : label}
      </button>
      {state.error ? (
        <span role="alert" className={styles.errorMsg}>
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

function MessageRow({ tenantId, m }: { tenantId: string; m: ContactMessage }) {
  return (
    <details className={styles.svcRow}>
      <summary className={styles.svcSummary}>
        <strong>{m.name}</strong>
        {m.subject ? <span className={styles.muted}> · {m.subject}</span> : null}
        <span className={styles.muted}> · {dt.format(new Date(m.created_at))}</span>
        {m.status === 'new' ? <span className={styles.badge}>Ny</span> : null}
      </summary>

      <div>
        {/* Kontaktvägarna som klickbara — kunden ska kunna svara utan att copy-pasta. */}
        <p className={styles.muted}>
          {m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : null}
          {m.email && m.phone ? ' · ' : null}
          {m.phone ? <a href={`tel:${m.phone.replace(/\s+/g, '')}`}>{m.phone}</a> : null}
        </p>

        {/* Besökarens text — radbrytningar bevaras, ingen HTML tolkas (React escapar). */}
        <p style={{ whiteSpace: 'pre-wrap' }}>{m.message}</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {m.status === 'new' ? (
            <StatusButton tenantId={tenantId} id={m.id} status="read" label="Markera som läst" />
          ) : null}
          {m.status !== 'archived' ? (
            <StatusButton tenantId={tenantId} id={m.id} status="archived" label="Arkivera" />
          ) : (
            <StatusButton tenantId={tenantId} id={m.id} status="read" label="Återställ" />
          )}
        </div>
      </div>
    </details>
  )
}

export function ContactInboxCard({
  tenantId,
  messages,
}: {
  tenantId: string
  messages: ContactMessage[]
}) {
  const open = messages.filter((m) => m.status !== 'archived')
  const archived = messages.filter((m) => m.status === 'archived')
  const unread = open.filter((m) => m.status === 'new').length

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>
        <Icon name="mail" /> Meddelanden
        {unread > 0 ? <span className={styles.badge}>{unread} nya</span> : null}
      </h2>
      <p className={styles.muted}>
        Skickas från kontaktformuläret på sajten. Varje meddelande mejlas också till er
        kontaktadress — arkivera det ni betat av.
      </p>

      {open.length === 0 && archived.length === 0 ? (
        <p className={styles.muted}>Inga meddelanden än.</p>
      ) : null}

      {open.map((m) => (
        <MessageRow key={m.id} tenantId={tenantId} m={m} />
      ))}

      {archived.length > 0 ? (
        <details className={styles.svcRow}>
          <summary className={styles.svcSummary}>Arkiverade ({archived.length})</summary>
          {archived.map((m) => (
            <MessageRow key={m.id} tenantId={tenantId} m={m} />
          ))}
        </details>
      ) : null}
    </section>
  )
}
