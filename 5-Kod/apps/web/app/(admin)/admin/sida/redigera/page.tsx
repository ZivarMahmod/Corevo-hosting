import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { createClient } from '@/lib/supabase/server'
import { getTenantDetail } from '@/lib/platform/tenants'
import { SidaStudio } from '@/components/platform/SidaStudio'
import { getVerticalCopy } from '@/components/storefront/vertical-copy'
import { tenantStorefrontUrl, tenantStorefrontHost } from '@/lib/storefront-url'
import { STOREFRONT_THEMES, DEFAULT_STOREFRONT_THEME } from '@/lib/tenant-data'
import { readPickerMode, readStaffAvatarMode } from '@/lib/platform/booking-variant'
import { getAdminModuleStates, isModuleActivated } from '@/lib/admin/modules'
import { PageHead } from '@/components/portal/ui'
import type { TenantBranding } from '@corevo/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Redigera sidan · Adminpanel' }

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

/**
 * Kundens EGEN Sida-studio — exakt samma redigeringsyta som super-adminens
 * kundkort (Sida-fliken i /salonger/[id]), monterad på booking-hosten med
 * tenant BUNDEN TILL SESSIONEN. Zivar: "det jag ändrar ändras hos honom med" —
 * båda ytorna delar komponenter, actions (sidaCtx-dubbelguard) och preview-rutt,
 * så de kan aldrig glida isär. Salongsägaren redigerar färger, typsnitt,
 * texter, bilder, team, kontakt och öppettider med live-preview bredvid.
 * Mall-byte är dock plattformens beslut: canChangeTemplate=false döljer
 * sektionen här, och setTenantTheme nekar salon_admin server-side.
 */
export default async function AdminSidaPage() {
  const user = await requireAdminArea('sida')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Redigera sidan</h1>
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  // Samma detalj-läsning som kundkortet, men med ÄGARENS egen cookie-klient:
  // RLS (private.tenant_id()) staketar varje query till den egna salongen.
  const supabase = await createClient()
  const detail = await getTenantDetail(tenant.id, supabase)
  if (!detail) {
    return (
      <section className="portal-section">
        <h1>Redigera sidan</h1>
        <p className="prose">Kunde inte läsa företagets data. Försök igen.</p>
      </section>
    )
  }

  const { tenant: row, settings, branding, operative, copy } = detail
  // Modulflikarna (Butik/Kurser/Blogg/Offert/Presentkort) visas bara för moduler som
  // är PÅ — samma gate som kund-adminens nav.
  const adminModuleStates = await getAdminModuleStates(row.id)
  const b = branding as TenantBranding
  const rawTheme = (settings?.settings as { theme?: unknown } | null)?.theme
  const activeTemplateKey =
    typeof rawTheme === 'string' && (STOREFRONT_THEMES as readonly string[]).includes(rawTheme)
      ? rawTheme
      : DEFAULT_STOREFRONT_THEME
  const rawSettings = (settings?.settings ?? {}) as Record<string, unknown>
  const contactObj = (rawSettings.contact ?? {}) as { email?: unknown; phone?: unknown }
  const contactEmail =
    typeof contactObj.email === 'string' && contactObj.email.trim() ? contactObj.email.trim() : null
  const contactPhone =
    typeof contactObj.phone === 'string' && contactObj.phone.trim() ? contactObj.phone.trim() : null
  const storefrontUrl = tenantStorefrontUrl(row.slug, detail.primaryDomain) ?? `https://${row.slug}.${ROOT}`
  const storefrontHost = tenantStorefrontHost(row.slug, detail.primaryDomain) ?? `${row.slug}.${ROOT}`

  return (
    <>
      <PageHead
        title="Redigera sidan"
        lede="Allt som syns på din hemsida — färger, texter, bilder och kontakt — med förhandsvisning bredvid."
      />
      <SidaStudio
        tenantId={row.id}
        previewPath={`/salong-preview/${row.slug}`}
        storefrontUrl={storefrontUrl}
        storefrontHost={storefrontHost}
        templateKey={activeTemplateKey}
        isActive={row.status === 'active'}
        branding={b}
        copy={copy}
        heroImages={b.hero_images ?? []}
        galleryImages={b.gallery_images ?? []}
        name={row.name}
        social={detail.social}
        openingHours={detail.openingHours}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        address={detail.primaryAddress}
        bookingVariant={operative.bookingVariant}
        pickerMode={readPickerMode(rawSettings)}
        staffAvatars={readStaffAvatarMode(rawSettings)}
        hasStaffPhoto={detail.staffList.some((s) => s.active && s.avatar_url)}
        staffTeam={detail.staffList.map((s) => ({
          id: s.id,
          title: s.title,
          active: s.active,
          avatarUrl: s.avatar_url,
          showOnSite: s.show_on_site,
        }))}
        canChangeTemplate={false}
        verticalCopy={await getVerticalCopy(
          (row as { vertical_id?: string | null }).vertical_id ?? null,
        )}
        liveModules={['shop', 'kurser', 'blogg', 'offert', 'presentkort', 'lojalitet', 'galleri'].filter((k) =>
          isModuleActivated(adminModuleStates, k),
        )}
      />
    </>
  )
}
