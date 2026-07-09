import type { CSSProperties } from 'react'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'

/**
 * Premium-login (Zivar 2026-07-09: "den ska kännas premium, något som rör sig"):
 * split-scen — vänster en mörk skogsgrön ljuspanel med långsamt drivande
 * guld-glöd, roterande guldring och serif-tagline; höger formulärkortet på
 * paper. Har salongen en egen hero-bild (branding.hero_images) tonas den in i
 * panelen med långsam Ken Burns-zoom — Corevo-dörrarna får den rena ljusscenen.
 * All rörelse är ren CSS och stängs av under prefers-reduced-motion.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const bundle = await currentTenant()
  const branding = bundle?.settings.branding ?? {}
  const tenantName = bundle?.tenant.name ?? 'Corevo'
  const heroImage = Array.isArray(branding.hero_images) ? (branding.hero_images[0] ?? null) : null

  return (
    <div
      className="tenant-root auth-root"
      data-tenant={bundle?.tenant.id}
      style={injectTenantTokens(branding) as CSSProperties}
    >
      <main className="auth-split">
        {/* Dekorativ scen — allt innehåll för skärmläsare bor i kortet. */}
        <aside className="auth-visual" aria-hidden="true">
          {heroImage ? (
            <div className="auth-visual-photo" style={{ backgroundImage: `url(${heroImage})` }} />
          ) : null}
          <div className="auth-glow auth-glow-1" />
          <div className="auth-glow auth-glow-2" />
          <div className="auth-glow auth-glow-3" />
          <div className="auth-ring" />
          <div className="auth-visual-inner">
            <p className="auth-visual-brand">{tenantName}</p>
            <div>
              <p className="auth-visual-tagline">
                Din dag.
                <br />
                Samlad.
              </p>
              <p className="auth-visual-sub">Bokningar, kunder och din sida — på ett ställe.</p>
            </div>
          </div>
        </aside>

        <section className="auth-side">
          <div className="auth-card">
            <p className="auth-brand">{tenantName}</p>
            {children}
            <p className="auth-foot">Drivs av Corevo</p>
          </div>
        </section>
      </main>
    </div>
  )
}
