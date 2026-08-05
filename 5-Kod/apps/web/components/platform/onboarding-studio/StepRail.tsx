'use client'

// Onboarding-studio — the guided customer-start rail. It owns progress and step
// navigation above the work area so the live preview keeps the full right-side width.
import { Icon } from '@/components/portal/ui/Icon'
import { stepDone, type StepId, visiblePhases } from '@/lib/platform/onboarding-studio/phases'
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
  const phases = visiblePhases(cfg, presets)
  const steps = phases.flatMap((phase) => phase.steps)
  const currentIndex = Math.max(0, steps.findIndex((candidate) => candidate.id === step))
  const doneCount = steps.filter((candidate) => stepDone(candidate.id, cfg, presets)).length
  const progress = steps.length > 0 ? ((currentIndex + 1) / steps.length) * 100 : 0
  const current = steps[currentIndex]
  const visibleSteps = steps.slice(0, currentIndex + 1)

  return (
    <div
      style={{
        width: '100%',
        flex: 'none',
        color: 'var(--c-ink)',
        padding: '14px clamp(14px, 2vw, 28px) 0',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          alignItems: 'center',
          padding: '12px 14px',
          border: '1px solid var(--c-line)',
          borderRadius: 18,
          background: 'rgba(255,255,255,.72)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 10,
            alignContent: 'center',
            flex: '1 1 230px',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--c-gold)' }}>
            Kundstart
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 750, lineHeight: 1.05, color: 'var(--c-forest)' }}>
            {current?.label ?? 'Onboarding'}
          </div>
          <div style={{ color: 'var(--c-ink-3)', fontSize: 12.5, lineHeight: 1.45 }}>
            {doneCount} av {steps.length} delar klara. Bara relevanta steg visas.
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--c-paper-2)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'var(--c-gold)' }} />
          </div>
        </div>

        <div style={{ flex: '3 1 520px', minWidth: 0, display: 'grid', alignContent: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {visibleSteps.map((s, i) => {
              const on = step === s.id
              const ok = stepDone(s.id, cfg, presets)
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={on ? 'step' : undefined}
                  onClick={() => onStep(s.id)}
                  style={{
                    minHeight: 48,
                    minWidth: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: `1px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                    background: on ? 'var(--c-forest-fill, var(--c-forest))' : 'var(--c-paper)',
                    color: on ? 'var(--c-on-forest, #fff)' : 'var(--c-ink)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: on ? 750 : 600,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      flex: 'none',
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      background: ok ? 'var(--c-success)' : on ? 'rgba(255,255,255,.18)' : 'var(--c-paper-2)',
                      color: ok ? '#fff' : on ? 'var(--c-on-forest, #fff)' : 'var(--c-ink-2)',
                    }}
                  >
                    {ok ? <Icon name="check" size={13} /> : i + 1}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                    {s.label}
                  </span>
                </button>
              )
            })}
          </div>
          {currentIndex < steps.length - 1 ? (
            <div style={{ color: 'var(--c-ink-3)', fontSize: 12 }}>
              Nästa slide visas när du går vidare. Du kan fortfarande hoppa över valfria delar.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
