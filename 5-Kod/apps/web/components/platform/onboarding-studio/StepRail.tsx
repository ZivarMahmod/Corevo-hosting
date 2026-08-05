'use client'

// Onboarding-studio — the guided customer-start rail. It owns progress and step
// navigation above the work area so the live preview keeps the full right-side width.
import type { MouseEvent } from 'react'
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

  return (
    <div
      style={{
        width: '100%',
        flex: 'none',
        background: 'linear-gradient(135deg, var(--c-forest-fill, var(--c-forest)) 0%, #10261d 100%)',
        color: 'var(--c-on-forest, #fff)',
        padding: '16px 18px',
        borderBottom: '1px solid rgba(255,255,255,.12)',
        boxShadow: '0 18px 40px rgba(0,0,0,.18)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 18,
          alignItems: 'stretch',
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
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 750, lineHeight: 1.05 }}>
            {current?.label ?? 'Onboarding'}
          </div>
          <div style={{ color: 'var(--c-on-forest-2, rgba(255,255,255,.72))', fontSize: 12.5, lineHeight: 1.45 }}>
            {doneCount} av {steps.length} delar klara. Bara relevanta steg visas.
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,.16)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'var(--c-gold)' }} />
          </div>
        </div>

        <div style={{ flex: '3 1 520px', minWidth: 0, overflowX: 'auto', paddingBottom: 2 }}>
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {phases.map((ph, pi) => (
              <div
                key={ph.id}
                style={{
                  display: 'grid',
                  gap: 8,
                  minWidth: 240,
                  padding: 10,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,.075)',
                  border: '1px solid rgba(255,255,255,.12)',
                }}
              >
                <div style={{ display: 'grid', gap: 3 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,.62)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{pi + 1}. {ph.name}</span>
                    <span>{ph.steps.filter((s) => stepDone(s.id, cfg, presets)).length}/{ph.steps.length}</span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,.48)', fontSize: 11.5, lineHeight: 1.35 }}>
                    {ph.sub}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
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
                          minHeight: 60,
                          display: 'grid',
                          gridTemplateColumns: '24px minmax(0,1fr) auto',
                          alignItems: 'center',
                          gap: 9,
                          padding: '8px 10px',
                          borderRadius: 12,
                          border: `1px solid ${on ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.13)'}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'var(--font-ui)',
                          background: on ? 'var(--c-paper)' : 'rgba(0,0,0,.13)',
                          color: on ? 'var(--c-ink)' : 'var(--c-on-forest, #fff)',
                          boxShadow: on ? '0 10px 30px rgba(0,0,0,.22)' : 'none',
                          transition: 'background var(--dur-fast), border-color var(--dur-fast), transform var(--dur-fast)',
                        }}
                        onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                          if (!on) {
                            e.currentTarget.style.background = 'rgba(255,255,255,.10)'
                            e.currentTarget.style.transform = 'translateY(-1px)'
                          }
                        }}
                        onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                          if (!on) {
                            e.currentTarget.style.background = 'rgba(0,0,0,.13)'
                            e.currentTarget.style.transform = 'translateY(0)'
                          }
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            flex: 'none',
                            borderRadius: 999,
                            display: 'grid',
                            placeItems: 'center',
                            background: ok ? 'var(--c-forest-fill)' : on ? 'var(--c-paper-2)' : 'rgba(255,255,255,.12)',
                            color: ok ? 'var(--c-on-forest)' : on ? 'var(--c-ink-3)' : 'rgba(255,255,255,.74)',
                            border: ok ? 'none' : `1px solid ${on ? 'var(--c-line)' : 'rgba(255,255,255,.16)'}`,
                          }}
                        >
                          {ok ? <Icon name="check" size={12} /> : <Icon name={s.icon} size={12} />}
                        </span>
                        <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: on ? 700 : 560 }}>
                            {s.label}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: on ? 'var(--c-ink-3)' : 'rgba(255,255,255,.54)' }}>
                            {s.hint}
                          </span>
                        </span>
                        {s.req ? <span style={{ color: 'var(--c-gold)', fontSize: 16, lineHeight: 1 }}>•</span> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
