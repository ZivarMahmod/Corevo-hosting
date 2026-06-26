'use client'

// Onboarding-studio (goal-48 W1) — the ROOT shell that assembles the leaves into the
// honest linear journey Kunder → Onboarding-studio → Live. Ports the design's App
// stage-machine (app.jsx:19–168), but driven by the REAL StudioCfg reducer (state.ts)
// and the proven createTenant FormData contract (state.ts/buildCreateTenantFormData).
//
// HONESTY (build-contract §9): the single real write is createTenant, fired ONLY by
// the live panel's Lansera button. There is NO 6-task fake DB-launch theatre (the
// design's LaunchSequence is W3) — a simple pending overlay covers the in-flight
// request, then the REAL ActionState.success/error is surfaced (success → the result
// banner with the real slug + message; error → an honest inline error strip). The
// design's result-stage CustomerAdmin mock + Storefront render are W-later, not W1.
//
// Inline-styled against the [data-world="backoffice"] --c-* tokens (project
// convention; no *.module.css). Flag-OFF (CreateTenantForm) is never touched.
import {
  useActionState,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { Button, Icon } from '@/components/portal/ui'
import { createTenant } from '@/lib/platform/actions'
import type { TenantCardItem } from '@/lib/platform/tenants'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { initStudioCfg } from '@/lib/platform/onboarding-studio/model'
import {
  buildCreateTenantFormData,
  makeStudioReducer,
  type StudioStage,
} from '@/lib/platform/onboarding-studio/state'
import { FLAT_STEP_ORDER, type StepId } from '@/lib/platform/onboarding-studio/phases'
import { JourneyBar } from './JourneyBar'
import { SuperEntry } from './SuperEntry'
import { StepRail } from './StepRail'
import { PanelHost } from './PanelHost'
import { PreviewPane, type PreviewDevice } from './PreviewPane'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

export type OnboardingStudioProps = {
  presets: VerticalPresetData
  /** The real cross-tenant card feed (listTenantsWithStats) → SuperEntry (§8). */
  tenants: TenantCardItem[]
  /** Reserved for the W2 in-preview sajtbyggare editor (same axis CreateTenantForm
   *  uses). Accepted for page-parity + forward wiring; W1's preview is a placeholder,
   *  so it is intentionally not consumed yet. */
  editorEnabled: boolean
}

/**
 * Thin remount host. The frozen reducer has no `reset` action (state.ts is frozen),
 * so "Onboarda nästa kund" gets a TRUE clean slate by bumping `runId` → the whole
 * machine (cfg / stage / step / action-state) remounts fresh. This prevents the real
 * footgun of re-prefilling the previous customer's name/slug/modules and re-submitting
 * a duplicate slug. Keep this wrapper minimal — only the remount key lives here.
 */
export function OnboardingStudio({ presets, tenants }: OnboardingStudioProps) {
  const [runId, setRunId] = useState(0)
  return (
    <StudioMachine
      key={runId}
      presets={presets}
      tenants={tenants}
      onRestart={() => setRunId((n) => n + 1)}
    />
  )
}

function StudioMachine({
  presets,
  tenants,
  onRestart,
}: {
  presets: VerticalPresetData
  tenants: TenantCardItem[]
  onRestart: () => void
}) {
  // PURE reducer bound to the loaded presets (applyBranch needs them). Memoised so the
  // identity is stable across renders; the cfg itself defaults to the design's "Salvia".
  const reducer = useMemo(() => makeStudioReducer(presets), [presets])
  const [cfg, dispatch] = useReducer(reducer, undefined, () => initStudioCfg('salvia'))

  const [stage, setStage] = useState<StudioStage>('super')
  const [step, setStep] = useState<StepId>('branch')
  const [device, setDevice] = useState<PreviewDevice>('desktop')

  // The single real write. useActionState surfaces { success } / { error } + isPending.
  const [result, formAction, isPending] = useActionState(createTenant, {})

  // On a real success, advance to the result stage (port app.jsx finishLaunch, but
  // driven by the REAL ActionState rather than a faked LaunchSequence onDone).
  useEffect(() => {
    if (result.success) setStage('result')
  }, [result.success])

  // Which journey pills the operator may jump to (port app.jsx:77 verbatim):
  // super always; studio once a bransch is picked; result once launched.
  const reachable: Record<StudioStage, boolean> = {
    super: true,
    studio: !!cfg.branch,
    result: stage === 'result',
  }

  // FooterNav prev/next over the flat step order (noUncheckedIndexedAccess-safe).
  const onPrev = () => {
    const prev = FLAT_STEP_ORDER[FLAT_STEP_ORDER.indexOf(step) - 1]
    if (prev) setStep(prev)
  }
  const onNext = () => {
    const next = FLAT_STEP_ORDER[FLAT_STEP_ORDER.indexOf(step) + 1]
    if (next) setStep(next)
  }

  // Lansera → build the FormData and fire the proven createTenant action. The success
  // effect above flips us to the result stage; an error lands in result.error (below).
  const onLaunch = () => {
    formAction(buildCreateTenantFormData(cfg))
  }

  const url = `${cfg.slug || 'dinsalong'}.${ROOT}`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        // A definite height so the studio columns (height:100%) don't collapse. Embedded
        // adaptation of the design's full-screen height:100vh — it sits below the portal
        // topbar inside portal-main's 30px padding. Exact px is cosmetic (Zivar render).
        height: 'calc(100vh - 116px)',
        minHeight: 520,
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid var(--c-line)',
        background: 'var(--c-paper-2)',
      }}
    >
      <JourneyBar stage={stage} reachable={reachable} onNav={setStage} />

      {stage === 'super' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <SuperEntry
            tenants={tenants}
            onStart={() => {
              setStep('branch')
              setStage('studio')
            }}
          />
        </div>
      )}

      {stage === 'studio' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
          <StepRail cfg={cfg} step={step} onStep={setStep} presets={presets} />
          <PanelHost
            cfg={cfg}
            step={step}
            dispatch={dispatch}
            presets={presets}
            onPrev={onPrev}
            onNext={onNext}
            onLaunch={onLaunch}
          />
          {/* right — live preview (W1 = honest placeholder skeleton; real render = W2) */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-paper-2)', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, padding: '18px' }}>
              <PreviewPane cfg={cfg} device={device} onDevice={setDevice} />
            </div>
          </div>

          {/* honest error strip (§9.2) — the REAL createTenant error, no fake success */}
          {result.error && !isPending ? <ErrorStrip message={result.error} /> : null}
          {/* honest pending overlay (§9.2) — a plain "Lanserar…", NOT the 6-task theatre */}
          {isPending ? <LaunchingOverlay name={cfg.name} /> : null}
        </div>
      )}

      {stage === 'result' && (
        <ResultBanner
          name={cfg.name}
          url={url}
          message={result.success ?? ''}
          onRestart={onRestart}
        />
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────── */

/** REAL success banner (port app.jsx:133–145, success half only). Shows the actual
 *  createTenant message + slug. The design's site/admin tabs + CustomerAdmin mock are
 *  W-later (§9.3) → here we surface only the honest "what happened + what's next". */
function ResultBanner({
  name,
  url,
  message,
  onRestart,
}: {
  name: string
  url: string
  message: string
  onRestart: () => void
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-cream)', overflowY: 'auto' }}>
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 24px',
          background: 'var(--c-forest)',
          color: '#fff',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 999, background: 'var(--c-success)', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={20} />
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19 }}>
              {name || 'Kunden'} är live
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-on-forest-2)', display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
              <Icon name="globe" size={13} style={{ color: 'var(--c-gold)' }} />
              {url}
            </div>
          </div>
        </div>
        <Button variant="gold" icon="plus" onClick={onRestart}>
          Onboarda nästa kund
        </Button>
      </div>

      {/* the REAL action message + an honest "next waves" note (no mock admin/site) */}
      <div style={{ padding: '28px 24px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {message ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--c-success)',
              background: 'var(--c-success-bg)',
              color: 'var(--c-forest)',
              fontSize: 13.5,
              lineHeight: 1.5,
            }}
          >
            <span style={{ flex: 'none', marginTop: 1, color: 'var(--c-success)' }}>
              <Icon name="checkCircle" size={16} />
            </span>
            {message}
          </div>
        ) : null}

        <div style={{ marginTop: 18, fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.6 }}>
          Kunden ligger nu i kundlistan. Den skarpa förhandsvisningen av storefronten och kundens egen
          admin-vy byggs i senare vågor.
        </div>
      </div>
    </div>
  )
}

/** Honest in-flight overlay (§9.2). A plain "Lanserar…" with a self-contained SVG
 *  spinner — NO fake task list, NO simulated DB-steps. The real write is running. */
function LaunchingOverlay({ name }: { name: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(23,53,41,.34)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          padding: '28px 36px',
          borderRadius: 16,
          background: 'var(--c-paper)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}
      >
        <Spinner />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--c-forest)' }}>
          Lanserar {name || 'kunden'}…
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--c-ink-3)', maxWidth: 240, lineHeight: 1.5 }}>
          Skapar tenant, moduler, ägar-konto och subdomän. Det tar ett ögonblick.
        </div>
      </div>
    </div>
  )
}

/** Self-contained loading spinner (inline SVG + SMIL animateTransform — no global CSS
 *  keyframes, no *.module.css). Honest indicator: it spins while the request is live. */
function Spinner() {
  return (
    <svg width={34} height={34} viewBox="0 0 50 50" aria-hidden role="presentation">
      <circle cx="25" cy="25" r="20" fill="none" stroke="var(--c-line)" strokeWidth="5" />
      <circle cx="25" cy="25" r="20" fill="none" stroke="var(--c-gold)" strokeWidth="5" strokeLinecap="round" strokeDasharray="80 46">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/** Honest error strip (§9.2). Surfaces the REAL createTenant error; floats over the
 *  studio columns so it never reflows the layout or fakes a success. */
function ErrorStrip({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 18,
        transform: 'translateX(-50%)',
        zIndex: 25,
        maxWidth: 560,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid var(--c-danger)',
        background: 'var(--c-danger-bg)',
        color: 'var(--c-danger)',
        boxShadow: 'var(--shadow-md)',
        fontSize: 13,
        lineHeight: 1.45,
      }}
      role="alert"
    >
      <span style={{ flex: 'none', marginTop: 1 }}>
        <Icon name="alert" size={15} />
      </span>
      {message}
    </div>
  )
}
