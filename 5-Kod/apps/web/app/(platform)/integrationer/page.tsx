import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getPlatformIntegrations } from '@/lib/platform/catalog'
import { PageHead } from '@/components/portal/ui'
import { IntegrationsGrid } from '@/components/platform/IntegrationsGrid'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Integrationer' }

/**
 * Integrationer — platform integration-status dashboard (goal-17 PLATFORM).
 * EXACT copy of the design-system law source (components/SuperPlatform.jsx →
 * SuperIntegrations): PageHead (gold eyebrow + Playfair title + sub) over a card
 * grid, one card per external coupling.
 *
 * Self-gates with requirePlatformAdmin (parity with the brief; the (platform)
 * layout also gates, and getPlatformIntegrations → platformCtx re-checks the role
 * before the cross-tenant RLS-bypass read). NEVER FAKE DATA: connected counts come
 * from getPlatformIntegrations, which binds the ONE honest live signal each
 * integration has (Stripe charges-enabled / review-link set / verified custom
 * domain) and returns connected:null where no backing column exists — the grid then
 * shows an honest label instead of the mock's placeholder "21 / 24".
 */
export default async function IntegrationerPage() {
  await requirePlatformAdmin()
  const integrations = await getPlatformIntegrations()

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Plattform"
        title="Integrationer"
        lede="En plats för alla externa kopplingar. Allt sant-kopplat — slår du på något funkar det på riktigt."
      />

      <IntegrationsGrid integrations={integrations} />
    </section>
  )
}
