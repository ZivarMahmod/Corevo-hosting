'use client'

// Onboarding-studio — compact horizontal step navigation. Keeping the rail above the
// work area gives the live preview the width previously occupied by the 248px sidebar.
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
        width: '100%',
        flex: 'none',
        background: 'var(--c-paper)',
        color: 'var(--c-ink)',
        overflowX: 'auto',
        padding: '10px 14px',
        borderBottom: '1px solid var(--c-line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, minWidth: 'max-content' }}>
        {PHASES.map((ph, pi) => (
          <div
            key={ph.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingRight: 14,
              borderRight: pi < PHASES.length - 1 ? '1px solid var(--c-line)' : 'none',
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: 'var(--c-ink-3)',
                whiteSpace: 'nowrap',
              }}
            >
              {pi + 1}. {ph.name}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ph.steps.map((s) => {
                const on = step === s.id
                const ok = stepDone(s.id, cfg, presets)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={on ? 'step' : undefined}
                    onClick={() => onStep(s.id)}
                    style={{
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      borderRadius: 9,
                      border: `1px solid ${on ? 'var(--c-line-strong)' : 'var(--c-line)'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-ui)',
                      background: on ? 'var(--c-paper-3)' : 'var(--c-paper)',
                      color: 'var(--c-ink)',
                      boxShadow: on ? 'inset 0 -2px 0 var(--c-forest-fill)' : 'none',
                      transition: 'background var(--dur-fast), border-color var(--dur-fast)',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                      if (!on) e.currentTarget.style.background = 'var(--c-paper-2)'
                    }}
                    onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                      if (!on) e.currentTarget.style.background = 'var(--c-paper)'
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        flex: 'none',
                        borderRadius: 999,
                        display: 'grid',
                        placeItems: 'center',
                        background: ok ? 'var(--c-forest-fill)' : 'var(--c-paper-2)',
                        color: ok ? 'var(--c-on-forest)' : 'var(--c-ink-3)',
                        border: ok ? 'none' : '1px solid var(--c-line)',
                      }}
                    >
                      {ok ? <Icon name="check" size={12} /> : <Icon name={s.icon} size={12} />}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: on ? 650 : 550 }}>
                      {s.label}
                      {s.req && <span style={{ color: 'var(--c-gold)', marginLeft: 4 }}>•</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 10.5, color: 'var(--c-ink-3)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--c-gold)', marginRight: 4 }}>•</span> krävs för lansering
        </div>
      </div>
    </div>
  )
}
