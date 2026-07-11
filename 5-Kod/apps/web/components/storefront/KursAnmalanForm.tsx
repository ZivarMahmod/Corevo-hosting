'use client'

// Kurs-ANMÄLNINGSFORMULÄR — the interactive 'use client' island per kurstillfälle
// on /kurser. Posts an ANONYMOUS registration via the submitEventRegistration
// server action (which resolves tenant + capacity server-side).
//
// CLIENT/SERVER FENCE (same as OffertForm): this file's OWN import graph must
// reach NO 'server-only' module. It imports ONLY: react; the PURE twin
// lib/storefront/kurser/types; and the server action (RPC boundary). Do NOT add
// load-kurser, @/lib/supabase/*, or any other server util here.
//
// FIELD_STYLE / LABEL_STYLE copied verbatim from OffertForm so kurs-formuläret
// is token-faithful to the rest of the storefront forms.

import { useActionState, type CSSProperties } from 'react'
import { useFormStatus } from 'react-dom'
import { KURS_SUBMIT_INITIAL, type KursSubmitState } from '@/lib/storefront/kurser/types'
import { submitEventRegistration } from '@/app/(public)/kurser/actions'

const FIELD_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--color-fg, #232520)',
  background: 'var(--color-bg, #fff)',
  border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 18%, transparent)',
  borderRadius: 'var(--radius, 4px)',
}

const LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  fontWeight: 600,
  color: 'color-mix(in srgb, var(--color-fg, #232520) 80%, transparent)',
}

/** Submit button. Nested so useFormStatus reads THIS form's pending state. */
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        padding: '12px 16px',
        fontFamily: 'var(--font-ui)',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.01em',
        cursor: pending ? 'default' : 'pointer',
        color: 'var(--color-bg, #fff)',
        background: 'var(--color-accent, #C8A24A)',
        border: '1px solid var(--color-accent, #C8A24A)',
        borderRadius: 'var(--radius, 4px)',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'Skickar…' : 'Anmäl'}
    </button>
  )
}

/** Anmälningsformulär för ETT kurstillfälle. maxParty <= 8, capped av "kvar". */
export function KursAnmalanForm({ eventId, maxParty }: { eventId: string; maxParty: number }) {
  const [state, formAction] = useActionState<KursSubmitState, FormData>(
    submitEventRegistration,
    KURS_SUBMIT_INITIAL,
  )

  if (state.phase === 'done') {
    return (
      <p
        role="status"
        style={{
          marginTop: 18,
          fontFamily: 'var(--font-ui)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-fg, #232520)',
          background: 'color-mix(in srgb, var(--color-accent, #C8A24A) 14%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-accent, #C8A24A) 30%, transparent)',
          borderRadius: 'var(--radius, 4px)',
          padding: '14px 16px',
        }}
      >
        Tack! Du är anmäld — en bekräftelse skickas till din e-post.
      </p>
    )
  }

  const seats = Array.from({ length: Math.max(1, Math.min(8, maxParty)) }, (_, i) => i + 1)

  return (
    <form action={formAction} style={{ marginTop: 18, display: 'grid', gap: 16, maxWidth: 560 }}>
      <input type="hidden" name="event_id" value={eventId} />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <label style={LABEL_STYLE} htmlFor={`kurs-name-${eventId}`}>Namn</label>
          <input id={`kurs-name-${eventId}`} name="name" type="text" autoComplete="name" required maxLength={120} style={FIELD_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor={`kurs-email-${eventId}`}>E-post</label>
          <input id={`kurs-email-${eventId}`} name="email" type="email" autoComplete="email" required maxLength={160} style={FIELD_STYLE} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <label style={LABEL_STYLE} htmlFor={`kurs-phone-${eventId}`}>Telefon (valfritt)</label>
          <input id={`kurs-phone-${eventId}`} name="phone" type="tel" autoComplete="tel" maxLength={40} style={FIELD_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor={`kurs-party-${eventId}`}>Antal platser</label>
          <select id={`kurs-party-${eventId}`} name="party_size" defaultValue="1" style={FIELD_STYLE}>
            {seats.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={LABEL_STYLE} htmlFor={`kurs-message-${eventId}`}>Meddelande (valfritt)</label>
        <textarea
          id={`kurs-message-${eventId}`}
          name="message"
          rows={3}
          maxLength={2000}
          style={{ ...FIELD_STYLE, resize: 'vertical' }}
        />
      </div>

      <div>
        {state.phase === 'error' ? (
          <p
            role="alert"
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-ui)',
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--color-fg, #232520)',
              background: 'color-mix(in srgb, #b00020 10%, transparent)',
              border: '1px solid color-mix(in srgb, #b00020 28%, transparent)',
              borderRadius: 'var(--radius, 4px)',
              padding: '10px 14px',
            }}
          >
            {state.message}
          </p>
        ) : null}
        <SubmitButton />
      </div>
    </form>
  )
}
