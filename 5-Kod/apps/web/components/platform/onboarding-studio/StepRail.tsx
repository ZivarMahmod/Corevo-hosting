'use client'

// Onboarding-studio (goal-48) — LEFT RAIL (248px): the 5-phase / 12-step spine.
//
// Ported VERBATIM from the design source (4-Dokument-Underlag/01-acceptans/
// super-admin/studio.jsx StepRail ~:8–53) per W1 build-contract §4 "Rail visuals".
// Inline-styled against the [data-world="backoffice"] --c-* tokens (project
// convention; no *.module.css). DATA comes from phases.ts (PHASES + stepDone) — the
// steps are NOT re-typed here. Phase headers render `{i+1}. {phase.name}`; `phase.sub`
// is data-present but NOT rendered in the rail (faithful to the design). Per-step
// checkmark derives from the REAL StudioCfg via stepDone().
import type { MouseEvent } from 'react'
import { Icon } from '@/components/portal/ui/Icon'
import { PHASES, stepDone, type StepId } from '@/lib/platform/onboarding-studio/phases'
import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'

export function StepRail({
  cfg,
  step,
  onStep,
  presets,
}: {
  cfg: StudioCfg
  step: StepId
  onStep: (stepId: StepId) => void
  presets: VerticalPresetData
}) {
  return (
    <div
      style={{
        width: 248,
        flex: 'none',
        background: 'var(--c-forest)',
        color: 'var(--c-on-forest)',
        height: '100%',
        overflowY: 'auto',
        padding: '20px 14px',
      }}
    >
      {/* brand header */}
      <div style={{ padding: '0 8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 14.5,
                color: '#fff',
                whiteSpace: 'nowrap',
              }}
            >
              Onboarding-studio
            </div>
            <div
              style={{
                fontSize: 9.5,
                color: 'var(--c-on-forest-2)',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              Corevo plattform
            </div>
          </div>
        </div>
      </div>

      {/* phases + steps */}
      {PHASES.map((ph, pi) => (
        <div key={ph.id} style={{ marginBottom: 6 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--c-on-forest-2)',
              opacity: 0.7,
              padding: '14px 10px 7px',
            }}
          >
            {pi + 1}. {ph.name}
          </div>
          {ph.steps.map((s) => {
            const on = step === s.id
            const ok = stepDone(s.id, cfg, presets)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onStep(s.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                  background: on ? 'var(--c-forest-700)' : 'transparent',
                  color: on ? '#fff' : 'var(--c-on-forest-2)',
                  borderLeft: on ? '2px solid var(--c-gold)' : '2px solid transparent',
                  transition: 'all var(--dur-fast)',
                }}
                onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                  if (!on) e.currentTarget.style.background = 'rgba(255,255,255,.05)'
                }}
                onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                  if (!on) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    flex: 'none',
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    background: ok ? 'var(--c-gold)' : on ? 'rgba(255,255,255,.12)' : 'transparent',
                    color: ok ? 'var(--c-forest-700)' : 'inherit',
                    border: ok ? 'none' : `1px solid ${on ? 'rgba(255,255,255,.3)' : 'var(--c-forest-300)'}`,
                  }}
                >
                  {ok ? <Icon name="check" size={13} /> : <Icon name={s.icon} size={13} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: on ? 600 : 500, display: 'block' }}>
                    {s.label}
                    {s.req && <span style={{ color: 'var(--c-gold)', marginLeft: 5 }}>•</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ))}

      {/* required-legend footer */}
      <div
        style={{
          padding: '12px 10px',
          marginTop: 8,
          fontSize: 11,
          color: 'var(--c-on-forest-2)',
          lineHeight: 1.5,
          borderTop: '1px solid var(--c-forest-300)',
        }}
      >
        <span style={{ color: 'var(--c-gold)' }}>•</span> = krävs för att kunna lansera.
      </div>
    </div>
  )
}
