'use client'

// Onboarding-studio (goal-48 W1) — the top journey bar. Ported VERBATIM from the
// design source app.jsx:65–95 (build-contract §2/§3): the linear three-stage arc
// Kunder → Onboarding-studio → Live, rendered as one honest pill group, not a
// role-switch. Pure presentational + client-safe: it owns NO state, derives nothing
// from cfg — the parent (OnboardingStudio) computes which stages are reachable and
// passes the navigate handler in. Shell chrome only; inline styles keyed to the
// existing [data-world="backoffice"] tokens (no *.module.css — CreateTenantForm
// convention). The design's right-hand "Spec-läge" toggle is intentionally OMITTED:
// it toggles spec-annotations that W1 defers (no `spec` field exists in the studio
// architecture), so rendering it would be a fake control (status-honesty §9). A
// zero-width spacer keeps the verbatim 3-child space-between balance.
import { Fragment } from 'react'
import { Icon } from '@/components/portal/ui'
import type { StudioStage } from '@/lib/platform/onboarding-studio/state'

/** The journey arc, in order. Labels are design-verbatim (app.jsx:63). */
// 'super'-entrén borttagen (Dunder-fix 2026-07-11) — kundlistan bor på /salonger.
const STAGES: ReadonlyArray<{ id: StudioStage; label: string }> = [
  { id: 'studio', label: 'Onboarding-studio' },
  { id: 'result', label: 'Live' },
]

export type JourneyBarProps = {
  /** The stage currently shown — drives the active gold (ink-on-gold) pill. */
  stage: StudioStage
  /** Which stages the operator may jump to. The parent owns the rule (e.g. studio
   *  needs a chosen bransch, result needs a launched tenant); this bar stays pure. */
  reachable: Record<StudioStage, boolean>
  /** Navigate to a stage. Only ever fired for a reachable stage. */
  onNav: (stage: StudioStage) => void
}

export function JourneyBar({ stage, reachable, onNav }: JourneyBarProps) {
  return (
    <div
      style={{
        flex: 'none',
        height: 54,
        background: 'var(--c-forest-700)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        color: '#fff',
        gap: 16,
      }}
    >
      {/* left — platform brand (app.jsx:67–73) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 30,
            height: 30,
            flex: 'none',
            borderRadius: 8,
            background: 'var(--c-gold)',
            color: 'var(--c-forest-700)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 17,
          }}
        >
          C
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              fontSize: 12.5,
              letterSpacing: '.02em',
              lineHeight: 1,
            }}
          >
            COREVO PLATTFORM
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-on-forest-2)', marginTop: 2 }}>
            superbooking@corevo.se
          </div>
        </div>
      </div>

      {/* center — the three-stage journey pill group (app.jsx:74–88) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(0,0,0,.2)',
          padding: 4,
          borderRadius: 11,
        }}
      >
        {STAGES.map((s, i) => {
          const on = stage === s.id
          const ok = reachable[s.id]
          return (
            <Fragment key={s.id}>
              {i > 0 && (
                <Icon
                  name="chevronRight"
                  size={14}
                  style={{ color: 'var(--c-on-forest-2)', opacity: 0.6 }}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (ok) onNav(s.id)
                }}
                disabled={!ok}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: ok ? 'pointer' : 'default',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: on ? 'var(--c-gold)' : 'transparent',
                  color: on ? '#3A2A06' : ok ? '#fff' : 'var(--c-on-forest-2)',
                  opacity: ok ? 1 : 0.5,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: on ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.12)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {i + 1}
                </span>
                {s.label}
              </button>
            </Fragment>
          )
        })}
      </div>

      {/* right — design's "Spec-läge" toggle omitted (fake control in W1, §9).
          Zero-width spacer preserves the verbatim 3-child space-between balance. */}
      <div aria-hidden style={{ flex: 'none' }} />
    </div>
  )
}
