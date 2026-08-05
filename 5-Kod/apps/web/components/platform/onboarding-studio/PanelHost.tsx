'use client'

// Onboarding-studio (goal-48) — the focused work column in the studio row.
//
// Ports the design's PanelColumn + FooterNav (studio.jsx:412–418): the active panel
// (resolved via PANEL_BY_STEP[step]) over a global Föregående/Nästa footer. The
// StepRail (left) + PreviewPane (right) + the stage machine live in their own files
// (parallel agents) — this column only renders the panel for the current step and the
// nav. Föregående/Nästa are driven by the parent's visible stepOrder, but the actual setStep lives in
// the parent (OnboardingStudio), which passes onPrev/onNext; here we only derive
// whether we're at the first/last step to disable/hide the buttons (exact design
// behavior). onLaunch is threaded down to the `live` panel's Lansera button.
import type { Dispatch } from 'react'
import { Button } from '@/components/portal/ui'
import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'
import type { StudioAction } from '@/lib/platform/onboarding-studio/state'
import { type StepId } from '@/lib/platform/onboarding-studio/phases'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { PANEL_BY_STEP } from './StudioPanels'
import { PreviewPane, type PreviewDevice } from './PreviewPane'
import styles from './OnboardingStudio.module.css'

export type PanelHostProps = {
  cfg: StudioCfg
  step: StepId
  stepOrder: StepId[]
  dispatch: Dispatch<StudioAction>
  presets: VerticalPresetData
  device?: PreviewDevice
  onDevice?: (device: PreviewDevice) => void
  branchName?: string | null
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

export function PanelHost({
  cfg,
  step,
  stepOrder,
  dispatch,
  presets,
  device = 'desktop',
  onDevice = () => {},
  branchName = null,
  onPrev,
  onNext,
  onLaunch,
}: PanelHostProps) {
  const ActivePanel = PANEL_BY_STEP[step]
  const idx = stepOrder.indexOf(step)
  const isFirst = idx === 0
  const isLast = idx === stepOrder.length - 1
  const withPreview = step === 'site' || step === 'review'
  return (
    <div
      className={styles.panelHost}
      data-onboarding-panel
      style={{
        width: 'min(1180px, 100%)',
        boxSizing: 'border-box',
        flex: '0 1 1180px',
        border: '1px solid var(--c-line)',
        borderRadius: 26,
        background: 'linear-gradient(180deg, var(--c-cream) 0%, var(--c-paper) 100%)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        boxShadow: '0 24px 70px rgba(0,0,0,.18)',
      }}
    >
      {/* Desktop scroll lives here so FooterNav stays pinned. Mobile uses document scroll. */}
      <div className={styles.panelScroll} data-onboarding-panel-scroll style={{ flex: 1, minHeight: 0 }}>
        <ActivePanel cfg={cfg} dispatch={dispatch} presets={presets} onLaunch={onLaunch} />
        {withPreview ? (
          <div style={{ padding: '0 clamp(18px, 4vw, 42px) clamp(22px, 4vw, 42px)' }}>
            <PreviewPane cfg={cfg} device={device} onDevice={onDevice} branchName={branchName} />
          </div>
        ) : null}
      </div>
      <FooterNav isFirst={isFirst} isLast={isLast} onPrev={onPrev} onNext={onNext} />
    </div>
  )
}
