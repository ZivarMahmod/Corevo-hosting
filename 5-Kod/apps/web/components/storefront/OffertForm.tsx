'use client'

// Offert storefront FORM — the interactive 'use client' island that replaces the
// inert shell in OffertSection. It posts an ANONYMOUS offert request via the
// submitOffertRequest server action (which resolves tenant + variant server-side).
//
// CLIENT/SERVER FENCE (cost 18h before): this file's OWN import graph must reach NO
// 'server-only' module. It imports ONLY: react; the PURE twin lib/storefront/offert/
// types (no I/O, no 'server-only'); and the server action — the action reference is
// the single thing that crosses to the server, and 'use server' makes that an RPC
// boundary, not an import of server code into the bundle. Do NOT add load-offert,
// @/lib/supabase/*, or any other server util here.
//
// Styling is token-driven and identical to the section's shell (FIELD_STYLE /
// LABEL_STYLE copied verbatim) so the live form is a byte-faithful continuation of
// the inert one — only now it's enabled and wired.

import { useActionState, type CSSProperties } from 'react'
import { useFormStatus } from 'react-dom'
import {
  offertCtaLabel,
  OFFERT_SUBMIT_INITIAL,
  type OffertMode,
  type OffertSubmitState,
} from '@/lib/storefront/offert/types'
import { submitOffertRequest } from '@/lib/storefront/offert/intake'

// Copied VERBATIM from OffertSection's inert shell so the enabled form matches the
// parked one exactly (var(--color-*) / var(--font-*) / var(--radius)).
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

/** Submit button. Nested so useFormStatus reads THIS form's pending state. Enabled
 *  (unlike the parked shell) — disabled only while the action is in flight. */
function SubmitButton({ mode }: { mode: OffertMode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={offertCtaLabel(mode)}
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
      {pending ? 'Skickar…' : offertCtaLabel(mode)}
    </button>
  )
}

/** Variant-correct, wired offert form. Mirrors the section's field logic:
 *  name + email + phone always; subject ONLY for estimate_form; message textarea
 *  for every variant except callback. */
export function OffertForm({ mode, responseDays }: { mode: OffertMode; responseDays: number }) {
  const [state, formAction] = useActionState<OffertSubmitState, FormData>(
    submitOffertRequest,
    OFFERT_SUBMIT_INITIAL,
  )

  const showSubject = mode === 'estimate_form'
  const showMessage = mode !== 'callback'

  if (state.phase === 'done') {
    return (
      <p
        role="status"
        style={{
          marginTop: 28,
          maxWidth: 560,
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
        Tack! Vi återkommer inom {responseDays} {responseDays === 1 ? 'dag' : 'dagar'}.
      </p>
    )
  }

  return (
    <form
      action={formAction}
      style={{
        marginTop: 28,
        display: 'grid',
        gap: 18,
        maxWidth: 560,
      }}
    >
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <label style={LABEL_STYLE} htmlFor="offert-name">Namn</label>
          <input id="offert-name" name="name" type="text" autoComplete="name" required maxLength={120} style={FIELD_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor="offert-email">E-post</label>
          <input id="offert-email" name="email" type="email" autoComplete="email" maxLength={160} style={FIELD_STYLE} />
        </div>
      </div>

      <div>
        <label style={LABEL_STYLE} htmlFor="offert-phone">Telefon</label>
        <input id="offert-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} style={FIELD_STYLE} />
      </div>

      {showSubject ? (
        <div>
          <label style={LABEL_STYLE} htmlFor="offert-subject">Vad gäller det?</label>
          <input id="offert-subject" name="subject" type="text" required maxLength={200} style={FIELD_STYLE} />
        </div>
      ) : null}

      {showMessage ? (
        <div>
          <label style={LABEL_STYLE} htmlFor="offert-message">
            {showSubject ? 'Beskriv omfattning' : 'Beskriv ditt behov'}
          </label>
          <textarea
            id="offert-message"
            name="message"
            rows={4}
            required
            maxLength={4000}
            style={{ ...FIELD_STYLE, resize: 'vertical' }}
          />
        </div>
      ) : null}

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
        <SubmitButton mode={mode} />
      </div>
    </form>
  )
}
