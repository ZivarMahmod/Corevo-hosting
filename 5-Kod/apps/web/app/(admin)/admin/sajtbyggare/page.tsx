import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow } from '@/lib/admin/data'
import { listMediaAssets } from '@/lib/admin/media/data'
import { tenantSiteEditorEnabled } from '@/lib/tenant-data'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { loadSiteContent } from '@/lib/sajtbyggare/load-site-content'
import {
  SiteEditor,
  type SiteEditorRegion,
  type SiteEditorMediaAsset,
} from '@/components/admin/SiteEditor'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sajtbyggare · Salongsadmin' }

/**
 * Svenska etiketter per region-nyckel (manifest/salvia → 15 regioner). Etiketten
 * är vad redaktören visar i listan; nyckeln är teknisk. Saknad nyckel faller
 * tillbaka på själva nyckeln så en framtida region aldrig blir osynlig.
 */
const REGION_LABELS: Record<string, string> = {
  'hero.eyebrow': 'Etikett ovanför rubrik',
  'hero.title': 'Rubrik (hero)',
  'hero.lede': 'Ingress (hero)',
  'about.copy': 'Om oss — text',
  'footer.tagline': 'Slogan (sidfot)',
  'about.italic': 'Om oss — kursiv fras',
  'hero.image': 'Hero-bild',
  'about.image': 'Om oss — bild',
  'closing.image': 'Avslutningsbild',
  'color.primary': 'Primärfärg',
  'color.bg': 'Bakgrundsfärg',
  'color.fg': 'Textfärg',
  'color.accent': 'Accentfärg',
  'font.body': 'Brödtypsnitt',
  logo: 'Logotyp',
}

/**
 * Sajtbyggare — den flagg- och auth-gatade admin-rutten som monterar S2-redaktören.
 *
 * Ordning (mirror av media/page.tsx + S2-kontraktet):
 *   1. Flaggan FÖRST — av i prod (SAJTBYGGARE_ENABLED ≠ "true") → notFound(), ingen
 *      ny publik yta. Läses i rutt-kroppen (aldrig modulscope, se flag.ts).
 *   2. Auth + tenant — requirePortal('admin') + getAdminTenant; ingen salong → fallback.
 *   3. Resolverade regioner — loadSiteContent(slug); null ⇒ mallen är inte salvia (S2
 *      stödjer bara salvia-manifestet) → Callout, retur.
 *   4. Bildbibliotek + region-mappning → <SiteEditor /> med det låsta prop-kontraktet.
 */
export default async function SajtbyggarePage() {
  // 1) Flaggan först — av i prod ⇒ rutten finns inte alls.
  if (!sajtbyggareEnabled()) notFound()

  // 2) Auth + tenant.
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salongsadmin" title="Sajtbyggare" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  // 2b) Per-tenant gate (default OFF): editorn aktiveras per kund av plattformen
  //     (tenant_settings.settings.sajtbyggare_enabled). Av ⇒ rutten finns inte för
  //     den här salongen — samma notFound() som den deploy-wide flaggan ovan, så
  //     ingen kund ser editorn förrän Zivar slår på den i salong-detaljen.
  const settingsRow = await getSettingsRow(tenant.id)
  if (!tenantSiteEditorEnabled(settingsRow?.settings)) notFound()

  // 3) Resolvera tenantens redigerbara regioner genom Universal→Bransch→Kund-kaskaden.
  //    null ⇒ tenantens mall saknar manifest (S2 = salvia only).
  const content = await loadSiteContent(tenant.slug)
  if (!content) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Sajtbyggare" />
        <Callout tone="info" icon="info">
          Sajtbyggaren stödjer just nu mallen ”salvia”. Den här salongen använder en annan mall.
        </Callout>
      </section>
    )
  }

  // 4) Bildbibliotek (för bild-/logoregionerna) + mappning till redaktörens prop-form.
  const assets = await listMediaAssets(tenant.id)
  const mediaAssets: SiteEditorMediaAsset[] = assets.map((a) => ({
    id: a.id,
    url: a.url,
    alt: a.alt,
  }))

  const regions: SiteEditorRegion[] = content.regions.map((r) => ({
    key: r.key,
    type: r.type,
    value: r.value,
    provenance: r.provenance,
    label: REGION_LABELS[r.key] ?? r.key,
  }))

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Sajtbyggare"
        lede="Redigera din storefront direkt — klicka på en del, ändra texten, bilden eller färgen och publicera."
      />
      <SiteEditor
        slug={tenant.slug}
        templateKey={content.templateKey}
        regions={regions}
        mediaAssets={mediaAssets}
      />
    </section>
  )
}
