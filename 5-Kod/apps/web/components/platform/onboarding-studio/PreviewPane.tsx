'use client'

// Onboarding-studio (goal-48 W2) — preview pane.
// Ports the design's BrowserFrame OUTER CHROME ONLY (preview.jsx:545–576): frame,
// 3 traffic-light dots, URL pill, conditional LIVE badge, desktop/mobile device toggle.
// Values lifted verbatim from the design (radius 16, --shadow-lg, exact dot hex, etc.).
//
// W2: the frame's child is the REAL live storefront render (<StorefrontPreview/>) of the
// unsaved StudioCfg — the W1 placeholder skeleton is retired. The tenant does not exist
// yet during onboarding, so the site is never live → `live` stays a fixed false (no fake
// LIVE badge, lock icon kept). The conditional chrome stays faithful for when it goes live.

import { Icon, type IconName } from '@/components/portal/ui/Icon'
import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'
import { StorefrontPreview } from './StorefrontPreview'
import { studioPlaceholderSlug } from './studio-placeholder'

export type PreviewDevice = 'desktop' | 'mobile'

type PreviewPaneProps = {
  /** Only consumed for the URL pill slug — no content render in W1. */
  cfg: StudioCfg
  device?: PreviewDevice
  /** Omit to hide the device toggle (matches design's `{onDevice && …}`). */
  onDevice?: (device: PreviewDevice) => void
  /** Vald bransch (visningsnamn) → URL-pillens/previewns placeholder följer branschen. */
  branchName?: string | null
}

// design maps phone→creditCard for the rectangular "device" glyph (preview.jsx:563–564)
const DEVICES: { id: PreviewDevice; icon: IconName }[] = [
  { id: 'desktop', icon: 'grid' },
  { id: 'mobile', icon: 'creditCard' },
]

export function PreviewPane({ cfg, device = 'desktop', onDevice, branchName }: PreviewPaneProps) {
  const url = `${cfg.slug || studioPlaceholderSlug(branchName)}.corevo.se`
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
          <StorefrontPreview cfg={cfg} branchName={branchName} />
        </div>
      </div>
    </div>
  )
}
