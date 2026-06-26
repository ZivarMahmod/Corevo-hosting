// ⛔ PARKED (2026-06-26): render-bron is the canonical renderer (01-INRIKTNING-LAST).
// This slice-1 SKELETON is NOT wired into any route — (public)/page.tsx renders via
// the theme layouts / render-bridge, never this. The DB data layer it consumes
// (lib/storefront/skin + content_slots/template_slots, migration 0026) is KEPT; only
// THIS bare renderer is parked. The marriage slice (defs→templates, edits→content_slots)
// replaces it with a RICH renderer before anything re-wires the public path here.
//
// Template-skin renderer (goal-47, slice 1) — SERVER component, SYNCHRONOUS (data
// is already resolved by load-skin.ts and handed in as a prop, so this renders with
// no I/O and is unit-testable via renderToStaticMarkup).
//
// Renders a resolved skin's sections → slots. Slice-1 scope is the READ path for a
// tenant that has authored content_slots:
//   - text  → the coerced copy string (render-on-present; null text renders nothing)
//   - asset → <img> only when the asset resolved to a url
//   - module / empty → nothing yet (slice 1; modules stay on page.tsx's own blocks)
// Template tokens are applied as `--sf-*` inline CSS vars on the wrapper (the seam
// that composes ON TOP of injectTenantTokens' tenant branding — see tokens.ts).
//
// This component is NEVER reached for today's tenants (they have 0 content_slots →
// the page's shouldRenderDbSkin gate is false → hardcoded layout). It only renders
// for a tenant with real authored content (slice 2 / a seeded tenant).
import type { CSSProperties } from 'react'
import type { ResolvedSkin } from '@/lib/storefront/skin/types'
import { cssVarsToStyle } from '@/lib/storefront/skin/tokens'

export function SkinRenderer({ skin }: { skin: ResolvedSkin }) {
  return (
    <div
      data-skin-template={skin.templateKey}
      style={cssVarsToStyle(skin.cssVars) as CSSProperties}
    >
      {skin.sections.map((section) => (
        <section key={section.sectionKey} data-section={section.sectionKey}>
          {section.slots.map((slot) => {
            if (slot.kind === 'text') {
              return slot.text ? <p key={slot.slotKey}>{slot.text}</p> : null
            }
            if (slot.kind === 'asset') {
              // eslint-disable-next-line @next/next/no-img-element -- skin assets are
              // arbitrary tenant R2 urls; next/image needs configured remote patterns.
              return slot.url ? (
                <img
                  key={slot.slotKey}
                  src={slot.url}
                  alt={slot.alt ?? ''}
                  width={slot.width ?? undefined}
                  height={slot.height ?? undefined}
                />
              ) : null
            }
            // module / empty → not rendered in slice 1.
            return null
          })}
        </section>
      ))}
    </div>
  )
}
