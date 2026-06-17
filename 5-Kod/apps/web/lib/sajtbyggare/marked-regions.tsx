// S1 marked render (F3) — renders a tenant's resolved editable regions with their
// data-editable markers so S2's click-overlay can attach later. The S1 companion
// to the S0 render-bridge (both live in lib/sajtbyggare = the render-bro family):
// render-bridge weaves LIVE modules into an HTML template; MarkedRegions stamps
// editable markers onto the cascade-resolved content of the React themes.
//
// DISPLAY ONLY — no onClick / no contentEditable / no editor chrome. S1 marks;
// S2 owns interaction. Currently surfaced only on the flag-gated spike route.

import type { ResolvedRegion } from './resolve'
import { regionMarkerAttrs } from './marker'

/** One resolved region rendered with its data-editable markers (display only). */
function MarkedRegion({ region }: { region: ResolvedRegion }) {
  const attrs = regionMarkerAttrs(region)
  const value = region.value ?? ''

  if (region.type === 'image' || region.type === 'logo') {
    // Plain <img> only — the remote-image config is frozen (never next/image).
    return value ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...attrs} src={value} alt="" />
    ) : (
      <div {...attrs} data-empty="true" />
    )
  }

  if (region.type === 'color') {
    return (
      <div {...attrs}>
        <span data-swatch="" style={{ background: value }} />
        <code>{value}</code>
      </div>
    )
  }

  // text + font: render the value as text; font additionally previews the family.
  return (
    <div {...attrs} style={region.type === 'font' ? { fontFamily: value } : undefined}>
      {value}
    </div>
  )
}

/** All of a tenant's resolved editable regions, each marked for the S2 editor. */
export function MarkedRegions({ regions }: { regions: ResolvedRegion[] }) {
  return (
    <div data-sajtbyggare="marked-regions">
      {regions.map((region) => (
        <MarkedRegion key={region.key} region={region} />
      ))}
    </div>
  )
}
