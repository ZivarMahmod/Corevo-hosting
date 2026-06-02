import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow, brandingOf } from '@/lib/admin/data'
import { BrandingForm } from '@/components/admin/BrandingForm'
import { StorefrontMediaForm } from '@/components/admin/StorefrontMediaForm'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Varumärke · Salongsadmin' }

export default async function BrandingPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Varumärke</h1>
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const settings = await getSettingsRow(tenant.id)
  const branding = brandingOf(settings)
  // brandingOf does NOT normalize the storefront-media keys (that lives in the
  // public parseSettings), so each can be undefined here → default to safe empties.
  const media = {
    heroImages: branding.hero_images ?? [],
    galleryImages: branding.gallery_images ?? [],
    aboutImage: branding.about_image ?? null,
    closingImage: branding.closing_image ?? null,
    team: branding.team ?? [],
    stats: branding.stats ?? [],
  }

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Varumärke" />
      <p className="prose">
        Logotyp, färger och typsnitt för din publika webbplats. Förhandsvisningen till höger
        uppdateras direkt — och när du sparar slår ändringarna igenom på den publika sajten.
      </p>
      <BrandingForm branding={branding} />

      <h2 style={{ marginTop: '2.5rem' }}>Bilder & innehåll</h2>
      <p className="prose">
        Ladda upp egna bilder för startsidan (hero, galleri, om oss, avslut) samt ditt team och
        nyckeltal. Lämnar du något tomt visar vi en snygg standardbild tills du laddar upp egen.
      </p>
      <StorefrontMediaForm {...media} />
    </section>
  )
}
