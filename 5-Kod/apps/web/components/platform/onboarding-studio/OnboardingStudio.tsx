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
  type CSSProperties,
} from 'react'
import { Button, Icon } from '@/components/portal/ui'
import { createTenant } from '@/lib/platform/actions'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { initStudioCfg } from '@/lib/platform/onboarding-studio/model'
import {
  buildCreateTenantFormData,
  makeStudioReducer,
  type StudioStage,
} from '@/lib/platform/onboarding-studio/state'
import { FLAT_STEP_ORDER, type StepId } from '@/lib/platform/onboarding-studio/phases'
import { JourneyBar } from './JourneyBar'
import { StepRail } from './StepRail'
import { PanelHost } from './PanelHost'
import { PreviewPane, type PreviewDevice } from './PreviewPane'
import { studioBranchName, studioPlaceholderSlug } from './studio-placeholder'
import { tenantStorefrontHost } from '@/lib/storefront-url'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

export type OnboardingStudioProps = {
  presets: VerticalPresetData
}

/**
 * Thin remount host. The frozen reducer has no `reset` action (state.ts is frozen),
 * so "Onboarda nästa kund" gets a TRUE clean slate by bumping `runId` → the whole
 * machine (cfg / stage / step / action-state) remounts fresh. This prevents the real
 * footgun of re-prefilling the previous customer's name/slug/modules and re-submitting
 * a duplicate slug. Keep this wrapper minimal — only the remount key lives here.
 */
export function OnboardingStudio({ presets }: OnboardingStudioProps) {
  const [runId, setRunId] = useState(0)
  return (
    <StudioMachine
      key={runId}
      presets={presets}
      onRestart={() => setRunId((n) => n + 1)}
    />
  )
}

function StudioMachine({
  presets,
  onRestart,
}: {
  presets: VerticalPresetData
  onRestart: () => void
}) {
  // PURE reducer bound to the loaded presets. Memoised so the identity is stable across
  // renders. Branch no longer seeds theme/modules.
  const reducer = useMemo(() => makeStudioReducer(presets), [presets])
  const [cfg, dispatch] = useReducer(reducer, undefined, () => initStudioCfg('salvia'))

  // Dunder-fix 2026-07-11: starta DIREKT i studion. Gamla 'super'-entrén var en
  // dubblett av /kunder-listan (med två döda stat-kort) som man tvingades
  // klicka sig förbi — "Onboarda kund" i menyn ska öppna wizarden, punkt.
  const [stage, setStage] = useState<StudioStage>('studio')
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
    super: false, // entré-stadiet borttaget — studion ÄR startskärmen
    studio: true,
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

  // Bransch-NAMNET (cfg bär bara nyckeln) → preview/resultat-attrappernas placeholder-
  // ord följer den valda branschen i stället för hårdkodat "salong" (studio-placeholder).
  const branchName = studioBranchName(presets.verticals, cfg.branch)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        // FULL-BLEED (Zivar feedback): the studio is a full-screen app, not a boxed card.
        // It fills `.onboarding-host` (flex column, portal-main padding cancelled) so it
        // spans the whole content area below the topbar — no border, no rounded card.
        // flex grows it to fill; the minHeight is a floor for browsers without :has().
        flex: '1 1 auto',
        minHeight: 'calc(100vh - 160px)',
        overflow: 'hidden',
        background: 'var(--c-paper-2)',
      }}
    >
      <JourneyBar stage={stage} reachable={reachable} onNav={setStage} />

      {stage === 'studio' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <StepRail cfg={cfg} step={step} onStep={setStep} presets={presets} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <PanelHost
              cfg={cfg}
              step={step}
              dispatch={dispatch}
              presets={presets}
              onPrev={onPrev}
              onNext={onNext}
              onLaunch={onLaunch}
            />
            {/* right — live preview (riktig StorefrontPreview-render) */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-paper-2)', minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, padding: '18px' }}>
                <PreviewPane cfg={cfg} device={device} onDevice={setDevice} branchName={branchName} />
              </div>
            </div>
          </div>

          {/* honest error strip (§9.2) — the REAL createTenant error, no fake success */}
          {result.error && !isPending ? <ErrorStrip message={result.error} /> : null}
          {/* honest pending overlay (§9.2) — a plain "Skapar…", NOT the 6-task theatre */}
          {isPending ? <LaunchingOverlay name={cfg.name} /> : null}
        </div>
      )}

      {stage === 'result' && (
        <ResultView
          name={cfg.name}
          slug={cfg.slug}
          tenant={result.tenant}
          message={result.success ?? ''}
          onRestart={onRestart}
          branchName={branchName}
        />
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────── */

/**
 * Honest result-vy (Goal 76). The isolated wildcard owns the canonical address,
 * while public RLS keeps status=provisioning closed. The result links to the real
 * customer card where readiness is completed and published; it never claims live.
 */
export function ResultView({
  name,
  slug,
  tenant,
  message,
  onRestart,
  branchName,
}: {
  name: string
  slug: string
  tenant?: { id: string; slug: string }
  message: string
  onRestart: () => void
  /** Vald bransch (visningsnamn) → placeholder-slugen följer branschen, aldrig "salong". */
  branchName?: string | null
}) {
  const address = tenantStorefrontHost(slug || studioPlaceholderSlug(branchName))
  const manageHref = tenant?.id ? `/kunder/${tenant.id}` : '/kunder'

  const cardStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    border: '1px solid var(--c-line)',
    borderRadius: 12,
    background: 'var(--c-paper)',
    textDecoration: 'none',
    color: 'inherit',
  }
  const iconWrap: CSSProperties = {
    width: 36,
    height: 36,
    flex: 'none',
    borderRadius: 9,
    background: 'var(--c-paper-2)',
    color: 'var(--c-forest)',
    display: 'grid',
    placeItems: 'center',
  }
  const cardTitle: CSSProperties = { fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }
  const cardSub: CSSProperties = { fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 2, lineHeight: 1.45 }

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
          background: 'var(--c-forest-fill, var(--c-forest))',
          color: 'var(--c-on-forest, #fff)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 999, background: 'var(--c-success)', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={20} />
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19 }}>
              {name || 'Kunden'} är skapad
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-on-forest-2)', marginTop: 2 }}>
              Kunden är provisionerad och väntar på publiceringskontrollen.
            </div>
          </div>
        </div>
        <Button variant="gold" icon="plus" onClick={onRestart}>
          Onboarda nästa kund
        </Button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 720, margin: '0 auto', width: '100%', display: 'grid', gap: 14 }}>
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

        {/* PRIMARY — genuinely works (platform route). Manage + the salon's data. */}
        <a href={manageHref} style={cardStyle}>
          <span style={iconWrap}>
            <Icon name="sliders" size={18} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...cardTitle, display: 'block' }}>Öppna &amp; hantera kunden</span>
            <span style={{ ...cardSub, display: 'block' }}>Bokningar, tjänster, personal och branding i plattformen.</span>
          </span>
          <Icon name="arrowRight" size={16} />
        </a>

        {/* Wildcard-adressen är reserverad, men public RLS är fortsatt stängd. */}
        <div style={{ ...cardStyle, cursor: 'default', alignItems: 'flex-start' }}>
          <span style={iconWrap}>
            <Icon name="globe" size={18} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...cardTitle, display: 'block' }}>Kundens publika adress</span>
            <span style={{ ...cardSub, display: 'block' }}>
               <b style={{ color: 'var(--c-ink-2)' }}>{address}</b> — reserverad och stängd tills
               kundkortets publiceringskontroll är grön.
            </span>
          </span>
        </div>

        {/* Owner admin — the real login host. Invite status rides the message above. */}
        <div style={{ ...cardStyle, cursor: 'default', alignItems: 'flex-start' }}>
          <span style={iconWrap}>
            <Icon name="user" size={18} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...cardTitle, display: 'block' }}>Ägarens admin</span>
            <span style={{ ...cardSub, display: 'block' }}>
              Ägaren loggar in på <b style={{ color: 'var(--c-ink-2)' }}>booking.{ROOT}</b> via magic-link-inbjudan (se
              status ovan) och styr bara sin egen verksamhet.
            </span>
          </span>
        </div>

        {/* Honest next-step guidance (port of the design's result "Nästa steg" list). */}
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--c-paper-2)', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="checkCircle" size={15} style={{ color: 'var(--c-gold-600)' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>Nästa steg</span>
          </div>
          <div style={{ display: 'grid', gap: 7 }}>
            {['Slutför punkterna i kundkortets publiceringskontroll', 'Publicera kunden när kontrollen är grön', 'Koppla Stripe när betalningar släpps på'].map((s) => (
              <div key={s} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13, color: 'var(--c-ink-2)' }}>
                <Icon name="arrowRight" size={14} style={{ color: 'var(--c-gold-600)' }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Honest in-flight overlay (§9.2). A plain "Skapar…" with a self-contained SVG
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
          Skapar {name || 'kunden'}…
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
