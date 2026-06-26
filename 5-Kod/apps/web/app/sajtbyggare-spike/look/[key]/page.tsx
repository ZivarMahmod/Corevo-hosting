// goal-50 — look-preview route. A tenant-LESS, flag-gated standalone render of a
// registered look (väg A render-bron HTML + its vendor CSS), used as the <iframe>
// target by the onboarding studio's live preview. The iframe boundary gives the
// look full CSS isolation from the backoffice document (de-risk R5) and the route
// renders server-side, so NO vendor HTML ever ships into the studio's client bundle
// (R6) — it scales to goal-36's growing box for free (the route reads the registry).
//
// Display-only: the booking module is a static placeholder (no BookingProvider,
// no tenant) — the real module mounts on the public storefront (app/(public)). Gated
// by SAJTBYGGARE_ENABLED (call-time): OFF in prod → notFound() → zero new surface.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { getLook } from '@/lib/sajtbyggare/look-registry'
import { renderTemplate } from '@/lib/sajtbyggare/render-bridge'

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

export default async function LookPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>
  searchParams: Promise<{ accent?: string }>
}) {
  if (!sajtbyggareEnabled()) notFound() // off in prod → zero new surface
  const { key } = await params
  const look = getLook(key)
  if (!look) notFound() // not a registered look (e.g. a React theme) → no preview surface

  const { accent } = await searchParams
  // ponytail: accent is injected as a wrapper CSS var only; per-look accent re-mapping
  // onto vendor classes is a refinement — the look already shows its own DISTINCT
  // palette, which is the point of the preview. Sanitised to a hex to stay inert.
  const accentVar = accent && /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : undefined

  return (
    <>
      {look.cssHrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      <div
        data-world="sajtbyggare-look-preview"
        data-look={look.key}
        className="corevo-tpl-scope"
        style={accentVar ? ({ ['--corevo-accent' as string]: accentVar } as React.CSSProperties) : undefined}
      >
        {renderTemplate(look.html, { booking: <BookingPlaceholder /> })}
      </div>
    </>
  )
}
