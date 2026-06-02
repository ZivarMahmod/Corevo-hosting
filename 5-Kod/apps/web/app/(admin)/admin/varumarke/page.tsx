import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant, storefrontUrl } from '@/lib/admin/tenant'
import { getSettingsRow, brandingOf, copyOf, type CopyFields } from '@/lib/admin/data'
import { BrandingForm } from '@/components/admin/BrandingForm'
import { StorefrontMediaForm } from '@/components/admin/StorefrontMediaForm'
import { StorefrontCopyForm } from '@/components/admin/StorefrontCopyForm'
import { OpenSiteLink } from '@/components/admin/OpenSiteLink'
import { PageHead } from '@/components/portal/ui'
import { STOREFRONT_THEMES, DEFAULT_STOREFRONT_THEME, type StorefrontTheme } from '@/lib/tenant-data'
import { THEME_CONTENT } from '@/components/storefront/theme-content'

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
  const copy = copyOf(settings)
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

  // Theme + its default copy → placeholders so the owner sees what renders when a
  // field is left blank (the per-field undo path). Defensive read of settings.theme.
  const rawTheme = (settings?.settings as { theme?: unknown } | null)?.theme
  const theme: StorefrontTheme = STOREFRONT_THEMES.includes(rawTheme as StorefrontTheme)
    ? (rawTheme as StorefrontTheme)
    : DEFAULT_STOREFRONT_THEME
  const tc = THEME_CONTENT[theme]
  const themeDefaults: CopyFields = {
    heroEyebrow: tc.heroEyebrow,
    heroTitle: tc.heroTitle,
    heroLede: tc.heroLede,
    aboutCopy: tc.aboutCopy,
    tagline: tc.tagline,
    italic: tc.italic,
  }

  const siteUrl = storefrontUrl(tenant.slug)

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Varumärke">
        <OpenSiteLink href={siteUrl}>Se din sida</OpenSiteLink>
      </PageHead>
      <p className="prose">
        Logotyp, färger och typsnitt för din publika webbplats. Förhandsvisningen till höger
        uppdateras direkt — och när du sparar slår ändringarna igenom på den publika sajten.
        Klicka <strong>Se din sida</strong> för att öppna din publika sajt i en ny flik.
      </p>
      <BrandingForm branding={branding} />

      <h2 style={{ marginTop: '2.5rem' }}>Texter</h2>
      <p className="prose">
        Skriv din egen text för startsidans hero, taglinen och om-stycket. Lämnar du ett fält tomt
        visar vi temats standardtext (placeholdern visar vad som då syns).
      </p>
      <StorefrontCopyForm copy={copy} themeDefaults={themeDefaults} />

      <h2 style={{ marginTop: '2.5rem' }}>Bilder & innehåll</h2>
      <p className="prose">
        Ladda upp egna bilder för startsidan (hero, galleri, om oss, avslut) samt ditt team och
        nyckeltal. Lämnar du något tomt visar vi en snygg standardbild tills du laddar upp egen.
      </p>
      <StorefrontMediaForm {...media} />
    </section>
  )
}
