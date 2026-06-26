'use client'

// Onboarding-studio (goal-48) — the middle 420px column of the studio row.
//
// Ports the design's PanelColumn + FooterNav (studio.jsx:412–418): the active panel
// (resolved via PANEL_BY_STEP[step]) over a global Föregående/Nästa footer. The
// StepRail (left) + PreviewPane (right) + the stage machine live in their own files
// (parallel agents) — this column only renders the panel for the current step and the
// nav. Föregående/Nästa are driven by FLAT_STEP_ORDER, but the actual setStep lives in
// the parent (OnboardingStudio), which passes onPrev/onNext; here we only derive
// whether we're at the first/last step to disable/hide the buttons (exact design
// behavior). onLaunch is threaded down to the `live` panel's Lansera button.
import type { Dispatch } from 'react'
import { Button } from '@/components/portal/ui'
import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'
import type { StudioAction } from '@/lib/platform/onboarding-studio/state'
import { type StepId, FLAT_STEP_ORDER } from '@/lib/platform/onboarding-studio/phases'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import type { LookMeta } from '@/lib/sajtbyggare/look-registry'
import { PANEL_BY_STEP } from './StudioPanels'

export type PanelHostProps = {
  cfg: StudioCfg
  step: StepId
  dispatch: Dispatch<StudioAction>
  presets: VerticalPresetData
  /** goal-50: the box (client-safe meta) → PanelTema's look-gallery. */
  looks?: LookMeta[]
  /** Go to the previous step (FooterNav «Föregående»). */
  onPrev: () => void
  /** Go to the next step (FooterNav «Nästa» + granska's "Gå till lansering"). */
  onNext: () => void
  /** Fire the single createTenant submit (the `live` panel's gold Lansera button). */
  onLaunch: () => void
}

/** Global step nav (port studio.jsx:414–417). At the first step «Föregående» is
 *  disabled; at the last step «Nästa» is hidden (the live panel owns Lansera). */
function FooterNav({ isFirst, isLast, onPrev, onNext }: { isFirst: boolean; isLast: boolean; onPrev: () => void; onNext: () => void }) {
  return (
    <div
      style={{
        flex: 'none',
        padding: '12px 24px',
        borderTop: '1px solid var(--c-line)',
        background: 'var(--c-paper)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Button
        variant="ghost"
        icon="arrowLeft"
        size="sm"
        disabled={isFirst}
        onClick={onPrev}
        style={{ opacity: isFirst ? 0.4 : 1 }}
      >
        Föregående
      </Button>
      {!isLast ? (
        <Button variant="primary" icon="arrowRight" size="sm" onClick={onNext}>
          Nästa
        </Button>
      ) : (
        <span />
      )}
    </div>
  )
}

export function PanelHost({ cfg, step, dispatch, presets, looks, onPrev, onNext, onLaunch }: PanelHostProps) {
  const ActivePanel = PANEL_BY_STEP[step]
  const idx = FLAT_STEP_ORDER.indexOf(step)
  const isFirst = idx === 0
  const isLast = idx === FLAT_STEP_ORDER.length - 1
  return (
    <div
      style={{
        width: 420,
        flex: 'none',
        borderRight: '1px solid var(--c-line)',
        background: 'var(--c-cream)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <ActivePanel cfg={cfg} dispatch={dispatch} presets={presets} looks={looks} onNext={onNext} onLaunch={onLaunch} />
      </div>
      <FooterNav isFirst={isFirst} isLast={isLast} onPrev={onPrev} onNext={onNext} />
    </div>
  )
}
