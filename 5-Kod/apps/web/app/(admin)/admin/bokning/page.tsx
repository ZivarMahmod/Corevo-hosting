import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { createClient } from '@/lib/supabase/server'
import { getTenantDetail } from '@/lib/platform/tenants'
import { BookingSettings } from '@/components/platform/BookingSettings'
import { tenantStorefrontUrl, tenantStorefrontHost } from '@/lib/storefront-url'
import { STOREFRONT_THEMES, DEFAULT_STOREFRONT_THEME } from '@/lib/tenant-data'
import { readPickerMode, readStaffAvatarMode } from '@/lib/platform/booking-variant'
import { PageHead } from '@/components/portal/ui'
import type { TenantBranding } from '@corevo/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningsflöde · Salongsadmin' }

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

/**
 * Kundens EGEN bokningsflöde-studio (designpaketet "Frisörbokningsformulär redesign"
 * ⭐-kravet: allt salongs-valbart från admin) — exakt samma redigeringsyta som
 * super-adminens kundkort (Bokningsflöde i Sida-fliken på /salonger/[id]), monterad
 * på booking-hosten med tenant BUNDEN TILL SESSIONEN. Båda ytorna delar komponent,
 * action (updateBookingSettings bakom sidaCtx-dubbelguarden) och preview-rutt — de
 * kan aldrig glida isär (samma mönster som /admin/sida ↔ SidaStudio).
 */
export default async function AdminBokningPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Bokningsflöde</h1>
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  // Ägarens egen cookie-klient: RLS (private.tenant_id()) staketar varje query
  // till den egna salongen — samma seam som /admin/sida.
  const supabase = await createClient()
  const detail = await getTenantDetail(tenant.id, supabase)
  if (!detail) {
    return (
      <section className="portal-section">
        <h1>Bokningsflöde</h1>
        <p className="prose">Kunde inte läsa salongens data. Försök igen.</p>
      </section>
    )
  }

  const { tenant: row, settings, branding, operative } = detail
  const b = branding as TenantBranding
  const rawSettings = (settings?.settings ?? {}) as Record<string, unknown>
  const rawTheme = (rawSettings as { theme?: unknown }).theme
  const activeTemplateKey =
    typeof rawTheme === 'string' && (STOREFRONT_THEMES as readonly string[]).includes(rawTheme)
      ? rawTheme
      : DEFAULT_STOREFRONT_THEME

  // Foto-läget kräver minst en AKTIV medarbetare med profilbild (staff.avatar_url,
  // migr 0049) — annars visas valet avstängt med hint.
  const { data: staffPhotoRows } = await supabase
    .from('staff')
    .select('id')
    .eq('tenant_id', row.id)
    .eq('active', true)
    .not('avatar_url', 'is', null)
    .limit(1)
  const hasStaffPhoto = (staffPhotoRows?.length ?? 0) > 0

  const storefrontUrl = tenantStorefrontUrl(row.slug) ?? `https://${row.slug}.${ROOT}`
  const storefrontHost = tenantStorefrontHost(row.slug) ?? `${row.slug}.${ROOT}`

  return (
    <>
      <PageHead
        title="Bokningsflöde"
        lede="Hur kunderna bokar på din sida — bokningssätt, tid-väljare, barberarbilder och färger, med förhandsvisning bredvid."
      />
      <BookingSettings
        tenantId={row.id}
        previewPath={`/salong-preview/${row.slug}`}
        storefrontUrl={storefrontUrl}
        storefrontHost={storefrontHost}
        isActive={row.status === 'active'}
        templateKey={activeTemplateKey}
        branding={b}
        variant={operative.bookingVariant}
        pickerMode={readPickerMode(rawSettings)}
        staffAvatars={readStaffAvatarMode(rawSettings)}
        hasStaffPhoto={hasStaffPhoto}
      />
    </>
  )
}
