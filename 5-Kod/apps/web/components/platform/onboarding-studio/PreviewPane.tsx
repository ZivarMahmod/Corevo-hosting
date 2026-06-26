'use client'

// Onboarding-studio (goal-48 W1) — preview pane.
// Ports the design's BrowserFrame OUTER CHROME ONLY (preview.jsx:545–576): frame,
// 3 traffic-light dots, URL pill, conditional LIVE badge, desktop/mobile device toggle.
// Values lifted verbatim from the design (radius 16, --shadow-lg, exact dot hex, etc.).
//
// HONESTY (build-contract §9 #1): the frame's CHILDREN are an explicit, unmistakably-inert
// PLACEHOLDER skeleton ("Förhandsvisning kommer (W2)") — NOT a fake rendered storefront.
// The real <Storefront/> render arrives in W2. The tenant does not exist yet during
// onboarding, so the site is never live → `live` is a fixed false (no fake LIVE badge,
// lock icon). The conditional chrome structure is preserved for W2 when `live` becomes real.

import type { CSSProperties } from 'react'
import { Icon, type IconName } from '@/components/portal/ui/Icon'
import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'

export type PreviewDevice = 'desktop' | 'mobile'

type PreviewPaneProps = {
  /** Only consumed for the URL pill slug — no content render in W1. */
  cfg: StudioCfg
  device?: PreviewDevice
  /** Omit to hide the device toggle (matches design's `{onDevice && …}`). */
  onDevice?: (device: PreviewDevice) => void
}

// design maps phone→creditCard for the rectangular "device" glyph (preview.jsx:563–564)
const DEVICES: { id: PreviewDevice; icon: IconName }[] = [
  { id: 'desktop', icon: 'grid' },
  { id: 'mobile', icon: 'creditCard' },
]

export function PreviewPane({ cfg, device = 'desktop', onDevice }: PreviewPaneProps) {
  const url = `${cfg.slug || 'dinsalong'}.corevo.se`
  // W1: pre-launch — the tenant does not exist yet, so the preview is never live.
  // Kept as a typed flag so the conditional chrome stays faithful + W2-ready.
  const live: boolean = false

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--c-line)',
        boxShadow: 'var(--shadow-lg)',
        background: '#fff',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* chrome bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: '#EDEAE3',
          borderBottom: '1px solid var(--c-line)',
          flex: 'none',
        }}
      >
        {/* traffic lights */}
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: '#E0726A' }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: '#E6B34D' }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: '#7FB47F' }} />
        </div>

        {/* URL pill */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12.5,
              color: 'var(--c-ink-2)',
              fontFamily: 'var(--font-ui)',
              background: '#fff',
              padding: '5px 14px',
              borderRadius: 999,
              border: '1px solid var(--c-line)',
            }}
          >
            <Icon
              name={live ? 'globe' : 'lock'}
              size={12}
              style={{ color: live ? 'var(--c-success)' : 'var(--c-ink-3)' }}
            />
            {url}
            {live && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--c-success)',
                  background: 'var(--c-success-bg)',
                  padding: '1px 6px',
                  borderRadius: 999,
                }}
              >
                LIVE
              </span>
            )}
          </div>
        </div>

        {/* device toggle */}
        {onDevice && (
          <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,.06)', padding: 2, borderRadius: 8 }}>
            {DEVICES.map(({ id, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onDevice(id)}
                aria-label={id === 'desktop' ? 'Desktop' : 'Mobil'}
                aria-pressed={device === id}
                style={{
                  width: 28,
                  height: 24,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: device === id ? '#fff' : 'transparent',
                  color: device === id ? 'var(--c-forest)' : 'var(--c-ink-3)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={icon} size={13} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* body — viewport (port preview.jsx:569–573) wrapping the W1 placeholder skeleton */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          background: device === 'mobile' ? '#3A3733' : 'transparent',
        }}
      >
        <div
          style={{
            width: device === 'mobile' ? 390 : '100%',
            flex: 'none',
            minHeight: '100%',
            boxShadow: device === 'mobile' ? '0 0 40px rgba(0,0,0,.3)' : 'none',
          }}
        >
          <PreviewPlaceholder />
        </div>
      </div>
    </div>
  )
}

/**
 * HONEST placeholder skeleton (build-contract §9 #1). Deliberately reads as inert,
 * neutral grey scaffolding — NOT the customer's real storefront. The real render
 * (theme + content) is W2. Over-realistic preview = the "fake rendered site" trap.
 */
function PreviewPlaceholder() {
  return (
    <div
      style={{
        minHeight: '100%',
        background: 'var(--c-cream)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 0 40px',
      }}
    >
      {/* inert nav scaffold */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 24px',
          borderBottom: '1px solid var(--c-line)',
          background: 'var(--c-paper)',
        }}
      >
        <SkelBlock w={108} h={20} radius={6} />
        <div style={{ flex: 1 }} />
        <SkelBlock w={52} h={12} />
        <SkelBlock w={52} h={12} />
        <SkelBlock w={52} h={12} />
      </div>

      {/* inert hero scaffold */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          padding: '48px 24px',
          background: 'var(--c-paper-2)',
        }}
      >
        <SkelBlock w={220} h={26} />
        <SkelBlock w={300} h={12} />
        <SkelBlock w={260} h={12} />
        <SkelBlock w={132} h={40} radius={10} />
      </div>

      {/* honest message — the load-bearing "this is not the real site yet" marker */}
      <div
        style={{
          margin: '36px 0',
          maxWidth: 360,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '0 24px',
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--c-paper)',
            border: '1px dashed var(--c-line-strong)',
            color: 'var(--c-ink-3)',
          }}
        >
          <Icon name="eye" size={20} />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--c-forest)',
          }}
        >
          Förhandsvisning kommer (W2)
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.6, color: 'var(--c-ink-2)' }}>
          Här renderas kundens riktiga sida med valt tema och innehåll. I det här steget visas
          bara ett skelett — den skarpa förhandsvisningen byggs i nästa våg.
        </div>
      </div>

      {/* inert content-row scaffolds */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14, padding: '0 24px' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--c-line)',
              background: 'var(--c-paper)',
            }}
          >
            <SkelBlock w={56} h={56} radius={10} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkelBlock w={140} h={13} />
              <SkelBlock w={220} h={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A single neutral placeholder block — purely scaffolding, never real content. */
function SkelBlock({ w, h, radius = 999 }: { w: CSSProperties['width']; h: number; radius?: number }) {
  return <div style={{ width: w, height: h, borderRadius: radius, background: 'var(--c-line)', flex: 'none' }} />
}
