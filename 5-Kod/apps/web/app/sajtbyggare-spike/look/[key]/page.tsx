// goal-50 / goal-36 — look-preview route. A tenant-LESS, flag-gated standalone render
// of a registered look (väg A render-bron HTML + its vendor CSS), used as the <iframe>
// target by the onboarding studio's live preview. The iframe boundary gives the look
// full CSS isolation from the backoffice document (de-risk R5) and the route renders
// server-side, so NO vendor HTML ever ships into the studio's client bundle (R6) — it
// scales to goal-36's growing box for free (the route reads the registry).
//
// goal-36 ("välj modul → vävs in i den valda mallen, syns i previewen"): the studio
// threads the SELECTED module keys (+ bransch) via ?modules=…&branch=…. We rebuild a
// minimal StudioCfg from them and render the SAME module-section mocks the React-theme
// preview uses — but in THIS look's own palette/typography (its manifest tokens), so a
// chosen module appears, styled for the specific template. "Löst i förväg" at the token
// level (per-template bespoke module layouts = a later refinement).
//
// Display-only: the booking module is a static placeholder, the module sections are
// structural mocks (no tenant). The REAL modules mount on the public storefront
// (app/(public)). Gated by SAJTBYGGARE_ENABLED (call-time): OFF in prod → notFound().
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { getLook } from '@/lib/sajtbyggare/look-registry'
import { renderTemplate } from '@/lib/sajtbyggare/render-bridge'
import type { RegionManifest } from '@/lib/sajtbyggare/manifest/types'
import { initStudioCfg } from '@/lib/platform/onboarding-studio/model'
import type { ModuleState } from '@/lib/tenant-modules'
import { ModuleSections, KontoPanel, ALL_PREVIEW_MODULES } from '@/components/platform/onboarding-studio/preview-modules'
import storefront from '@/components/storefront/storefront.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sajtbyggare — mall-förhandsvisning', robots: { index: false } }

/** Static, inert stand-in for the live booking module (preview has no tenant). */
function BookingPlaceholder() {
  return (
    <div
      data-corevo-module="booking"
      style={{
        margin: '24px auto',
        maxWidth: 520,
        padding: '20px 24px',
        borderRadius: 12,
        border: '1px dashed #94a3b8',
        background: '#f8fafc',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#334155',
      }}
    >
      <strong style={{ display: 'block', fontSize: 15 }}>Bokningsmodul</strong>
      <span style={{ fontSize: 13, color: '#64748b' }}>Vävs in här på den publika sidan — boka tid, välj tjänst &amp; tid.</span>
    </div>
  )
}

/** Map a look's manifest color/font tokens → storefront CSS vars, so the module
 *  sections adopt THIS look's palette + typography (the per-template "löst i förväg"). */
function lookTokenVars(manifest: RegionManifest): CSSProperties {
  const tok = (key: string) => manifest.regions.find((r) => r.key === key)?.default || undefined
  const set: Record<string, string> = {}
  const primary = tok('color.primary')
  const bg = tok('color.bg')
  const fg = tok('color.fg')
  const accent = tok('color.accent') || primary
  const font = tok('font.body')
  if (primary) set['--color-primary'] = primary
  if (bg) set['--color-bg'] = bg
  if (fg) set['--color-fg'] = fg
  if (accent) set['--color-accent'] = accent
  if (font) set['--font-body'] = font
  return set as CSSProperties
}

export default async function LookPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>
  searchParams: Promise<{ accent?: string; modules?: string; branch?: string }>
}) {
  if (!sajtbyggareEnabled()) notFound() // off in prod → zero new surface
  const { key } = await params
  const look = getLook(key)
  if (!look) notFound() // not a registered look (e.g. a React theme) → no preview surface

  const { accent, modules, branch } = await searchParams
  // accent is injected as a wrapper CSS var only; sanitised to a hex to stay inert.
  const accentVar = accent && /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : undefined

  // Selected modules → a minimal cfg the existing preview mocks consume. Only keys the
  // preview actually knows are honoured (defensive against a stale/garbage query).
  const activeKeys = (modules ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((k) => ALL_PREVIEW_MODULES.includes(k))
  const moduleStates: Record<string, ModuleState> = {}
  for (const k of activeKeys) moduleStates[k] = 'live'
  const cfg = { ...initStudioCfg(look.key), branch: branch ?? null, moduleStates }

  return (
    <>
      {look.cssHrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      <div
        data-world="sajtbyggare-look-preview"
        data-look={look.key}
        className="corevo-tpl-scope"
        style={accentVar ? ({ ['--corevo-accent' as string]: accentVar } as CSSProperties) : undefined}
      >
        {renderTemplate(look.html, { booking: <BookingPlaceholder /> })}
      </div>

      {/* goal-36: the SELECTED modules woven below the look, in the look's own palette/
          typography. A separate storefront-scoped wrapper (not inside corevo-tpl-scope)
          so the vendor CSS cascade can't mangle the mocks; data-theme supplies the base
          structural tokens, the look's tokens override palette/font. booking is NOT here
          (it weaves into the look HTML above). Empty selection → nothing extra. */}
      {activeKeys.length > 0 ? (
        <div
          data-world="storefront"
          data-theme="leander"
          data-look-modules={look.key}
          className={storefront.tplRoot}
          style={{ ...lookTokenVars(look.manifest), background: 'var(--color-bg)', color: 'var(--color-fg)', pointerEvents: 'none' } as CSSProperties}
        >
          <div style={{ display: 'grid', gap: 44, padding: '44px 40px' }}>
            <ModuleSections cfg={cfg} />
            <KontoPanel cfg={cfg} />
          </div>
        </div>
      ) : null}
    </>
  )
}
