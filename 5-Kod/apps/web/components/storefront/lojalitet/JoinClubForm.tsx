'use client'

import { useActionState } from 'react'
import { joinLoyaltyClub } from '@/lib/storefront/lojalitet/intake'
import type { JoinClubState } from '@/lib/storefront/lojalitet/types'
import s from './klubb.module.css'

/**
 * "GÅ MED" — designens joinClub() som riktig handling (goal-64).
 *
 * Mallarnas mock byter bara en ruta (`clubJoined: true`). Här skickas e-posten till
 * joinLoyaltyClub (server action) som skriver medlemsraden. Efter svar visar vi SAMMA
 * tack-läge som designen — men nu för att något faktiskt hände.
 *
 * KLIENTEN BÄR INGEN TENANT: server-actionen läser tenanten ur middleware-headern. Ett
 * dolt tenant-fält här hade varit en inbjudan att skriva i någon annans kundregister.
 *
 * planId är valfritt: klubbsidans nivå-CTA:er skickar sin nivå med, den fristående
 * "gå med"-rutan skickar ingen (klubb utan nivåer).
 */
export function JoinClubForm({
  planId,
  cta = 'Gå med',
  compact = false,
}: {
  planId?: string
  cta?: string
  compact?: boolean
}) {
  const [state, action, pending] = useActionState<JoinClubState, FormData>(joinLoyaltyClub, {
    phase: 'idle',
  })

  // Tack-läget ERSÄTTER formuläret (designens clubJoined) — inget kvarstående fält som
  // inbjuder till en andra, onödig anmälan.
  if (state.phase === 'done') {
    return (
      <p role="status" className={s.joined}>
        Välkommen in. Vi hör av oss till din e-post.
      </p>
    )
  }

  return (
    <form action={action} className={compact ? `${s.joinForm} ${s.joinCompact}` : s.joinForm}>
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      <label className={s.srOnly} htmlFor={`club-email-${planId ?? 'x'}`}>
        E-post
      </label>
      <input
        id={`club-email-${planId ?? 'x'}`}
        className={s.joinInput}
        type="email"
        name="email"
        required
        maxLength={160}
        autoComplete="email"
        placeholder="din@epost.se"
      />
      <button type="submit" className={s.joinBtn} disabled={pending}>
        {pending ? 'Skickar…' : cta}
      </button>
      {state.phase === 'error' && state.message ? (
        <p role="alert" className={s.joinError}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
