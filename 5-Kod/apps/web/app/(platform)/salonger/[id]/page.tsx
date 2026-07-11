import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getTenantDetail, getTenantAudit, deriveCustomizationLevel } from '@/lib/platform/tenants'
import { getTenantCustomers } from '@/lib/platform/tenant-customers'
import { TenantCustomers } from '@/components/platform/TenantCustomers'
import { classifyAuditTone } from '@/lib/platform/audit'
import type { AuditRow } from '@/lib/platform/audit'
import { BILLING_MODEL_LABELS, formatPrice, type BillingModel } from '@/lib/platform/billing'
import { OnboardingChecklist } from '@/components/platform/OnboardingChecklist'
import { BillingForm } from '@/components/platform/BillingForm'
import { StatusControl } from '@/components/platform/StatusControl'
import { DomainPanel } from '@/components/platform/DomainPanel'
import { OperativeControls } from '@/components/platform/OperativeControls'
import { ServicesCard } from '@/components/platform/ServicesCard'
import { PersonalCard } from '@/components/platform/PersonalCard'
import { ModulesCard } from '@/components/platform/ModulesCard'
import { listTenantModules } from '@/lib/platform/tenant-modules-admin'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig } from '@/lib/admin/modules'
import { listShopProducts, listShopOrders } from '@/lib/admin/shop/data'
import { listBlogPosts } from '@/lib/admin/blogg/data'
import { listMediaAssets, getStorageUsage } from '@/lib/admin/media/data'
import { listOffertRequests } from '@/lib/admin/offert/data'
import { ShopAdmin } from '@/components/admin/ShopAdmin'
import { BloggAdmin } from '@/components/admin/BloggAdmin'
import { MediaLibrary } from '@/components/admin/MediaLibrary'
import { OffertInbox } from '@/components/admin/OffertInbox'
import { SidaStudio } from '@/components/platform/SidaStudio'
import { readPickerMode, readStaffAvatarMode } from '@/lib/platform/booking-variant'
import { createClient } from '@/lib/supabase/server'
import { SajtbyggareControl } from '@/components/platform/SajtbyggareControl'
import { tenantStorefrontUrl, tenantStorefrontHost } from '@/lib/storefront-url'
import { STOREFRONT_THEMES, DEFAULT_STOREFRONT_THEME, tenantSiteEditorEnabled } from '@/lib/tenant-data'
import {
  TenantDetailTabs,
  type TenantTabKey,
} from '@/components/platform/TenantDetailTabs'
import {
  TenantHeaderActions,
  TenantDangerCard,
} from '@/components/platform/TenantDetailActions'
import { hasServiceRole } from '@/lib/platform/service'
import { Badge, Button, Card, Icon, type BadgeTone, type IconName } from '@/components/portal/ui'
import type { TenantBranding } from '@corevo/ui'
import styles from '@/components/platform/tenant-detail.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Kund' }

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'
function publicUrl(slug: string): string {
  const isLocal = ROOT.includes('localhost') || ROOT.includes('127.0.0.1')
  return `${isLocal ? 'http' : 'https'}://${slug}.${ROOT}`
}

/**
 * Kund-detalj (KUNDKORTET) — full operativ kontroll för EN vald kund, oavsett
 * bransch. Header (mark + namn + status + meta + actions) över SubTabs:
 * kärnflikarna Översikt/Tjänster/Kunder/Personal/Sida/Integrationer/Drift plus
 * MODUL-flikar (Webshop/Blogg/Offerter/Bildbibliotek, goal-54 §1) som visas endast
 * när kundens modul är på — samma verktyg som kundens egen admin.
 *
 * Server component: every read is server-only (RLS-bypass via platformCtx). Each
 * tab's content — including the existing `'use client'` forms — is rendered here and
 * handed to the client <TenantDetailTabs> as ReactNode props; that component only
 * toggles which is visible (children-as-props, not a client page).
 *
 * KEEP existing detail content: nothing is dropped. The previous flat page's
 * sections are distributed across the tabs — OperativeControls→Data, branding→
 * Branding, status/audit→Drift, onboarding→Översikt — and the two sections the mock
 * has no tab for are parked sensibly: billing→Översikt (it's read-only insyn there),
 * domän→Integrationer (it IS an integration row's home).
 *
 * NEVER FAKE DATA: the mock's t.stripe/t.sms/t.owner/t.ownerPhone are demo
 * placeholders. We bind only real signals (stripe_charges_enabled, review-link set,
 * salonAdmin.email) and render honest static/empty labels everywhere a metric has no
 * backing source (SMS toggle, custom domain, owner name/phone).
 */
export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Self-gate (task): the (platform) layout already gates, and every read re-checks
  // the role in platformCtx — this is belt-and-suspenders parity with the brief.
  await requirePlatformAdmin()

  const { id } = await params
  const detail = await getTenantDetail(id)
  if (!detail) notFound()
  const { tenant, settings, branding, counts, services, staffList, salonAdmin, onboarding, operative, copy } = detail
  const customizationLevel = deriveCustomizationLevel(
    (settings?.settings ?? null) as Record<string, unknown> | null,
    branding as unknown as Record<string, unknown>,
  )

  // Cross-tenant reads, scoped to THIS salon. listCustomersAllTenants takes a tenant
  // id filter; listStaffAllTenants has no tenant filter (foundation), so we filter
  // by the salon's slug in-page (volume is tiny).
  const [audit, customerData, modules] = await Promise.all([
    getTenantAudit(id),
    getTenantCustomers(id),
    listTenantModules(id),
  ])

  // MODUL-KONTROLLRUMMET (goal-54 §1): för varje modul som är PÅ (activated =
  // live/paused, samma gate som kund-adminens nav) får kundkortet en flik med
  // SAMMA verktyg som kundens egen admin. Platform-adminens cookie-klient läser
  // cross-tenant via platform_admin-claimet; skrivvägen går via moduleCtx-dual-
  // guarden (hidden tenantId i varje formulär via TenantScope). Data laddas
  // ENDAST för moduler som är på — av- och draft-moduler kostar inga reads.
  const moduleStates = await getAdminModuleStates(id)
  const shopOn = isModuleActivated(moduleStates, 'shop')
  const bloggOn = isModuleActivated(moduleStates, 'blogg')
  const offertOn = isModuleActivated(moduleStates, 'offert')
  const mediaOn = isModuleActivated(moduleStates, 'media_library')
  const needAssets = shopOn || bloggOn || mediaOn
  const mediaQuotaCfg = moduleAdminConfig(moduleStates, 'media_library')
  const mediaQuota =
    typeof mediaQuotaCfg.quota_bytes === 'number' ? mediaQuotaCfg.quota_bytes : 500 * 1024 * 1024
  const [shopProducts, shopOrders, blogPosts, offertRequests, mediaAssets, mediaUsage] =
    await Promise.all([
      shopOn ? listShopProducts(id) : Promise.resolve([]),
      shopOn ? listShopOrders(id) : Promise.resolve([]),
      bloggOn ? listBlogPosts(id) : Promise.resolve([]),
      offertOn ? listOffertRequests(id) : Promise.resolve([]),
      needAssets ? listMediaAssets(id) : Promise.resolve([]),
      mediaOn ? getStorageUsage(id, mediaQuota) : Promise.resolve(null),
    ])
  const shopFulfilmentCfg = moduleAdminConfig(moduleStates, 'shop')
  const shopFulfilment =
    typeof shopFulfilmentCfg.fulfilment === 'string' ? shopFulfilmentCfg.fulfilment : 'ship'
  const bloggLayoutCfg = moduleAdminConfig(moduleStates, 'blogg')
  const bloggLayout = typeof bloggLayoutCfg.layout === 'string' ? bloggLayoutCfg.layout : null

  // Foto-läget i Bokningsflöde-ytan (Sida-fliken) kräver minst en AKTIV medarbetare
  // med profilbild (staff.avatar_url, migr 0049) — annars visas valet avstängt med
  // hint. Platform-adminens cookie-klient läser cross-tenant via platform_admin-claimet.
  const supabaseForStaffPhoto = await createClient()
  const { data: staffPhotoRows } = await supabaseForStaffPhoto
    .from('staff')
    .select('id')
    .eq('tenant_id', id)
    .eq('active', true)
    .not('avatar_url', 'is', null)
    .limit(1)
  const hasStaffPhoto = (staffPhotoRows?.length ?? 0) > 0

  const url = publicUrl(tenant.slug)
  const serviceRoleAvailable = hasServiceRole()
  const b = branding as TenantBranding
  const markColor = b.color_primary || 'var(--c-forest)'
  const isActive = tenant.status === 'active'
  const isDeleted = tenant.status === 'deleted'
  const statusLabel = isActive ? 'Aktiv' : isDeleted ? 'Borttagen' : tenant.status === 'suspended' ? 'Pausad' : tenant.status
  const statusTone: BadgeTone = isActive ? 'success' : isDeleted ? 'danger' : 'warning'

  // Visual hub (spår 4): the tenant's active template = settings.theme (the five named
  // layouts), fenced to the catalog keys that 1:1 match the `templates` table. The
  // preview iframe points at the REAL public storefront (slug/custom-domain origin).
  const rawTheme = (settings?.settings as { theme?: unknown } | null)?.theme
  const activeTemplateKey =
    typeof rawTheme === 'string' && (STOREFRONT_THEMES as readonly string[]).includes(rawTheme)
      ? rawTheme
      : DEFAULT_STOREFRONT_THEME
  // Per-tenant edit-toggle (Task 3): is the site editor (sajtbyggaren) enabled for THIS
  // salon? Default OFF — the platform turns it on per customer in the Sida-tab (SidaStudio).
  const siteEditorEnabled = tenantSiteEditorEnabled(settings?.settings)
  const storefrontUrl = tenantStorefrontUrl(tenant.slug) ?? url
  const storefrontHost = tenantStorefrontHost(tenant.slug) ?? `${tenant.slug}.${ROOT}`

  // Kund-överblick (Översikt): everything the operator needs to know at a glance,
  // derived from already-loaded data (no extra query). Launch-readiness mirrors the
  // list-view launchReady (staff + services + hours) so the badge here agrees with
  // the Aktiv/Onboarding pill on the card grid. Bransch/kontakt read the raw settings
  // jsonb (same seam as theme/booking above).
  const rawSettings = (settings?.settings ?? {}) as Record<string, unknown>
  // Bransch läses ur SANNINGSKÄLLAN tenants.vertical_id (styr admin-terminologin,
  // 0026) — inte settings.vertical-jsonben som kunde glida isär (rapport 02 §1.7).
  const verticalId = (tenant as { vertical_id?: string | null }).vertical_id ?? null
  const vertical =
    verticalId ??
    (typeof rawSettings.vertical === 'string' && rawSettings.vertical.trim()
      ? rawSettings.vertical.trim()
      : null)
  const contactObj = (rawSettings.contact ?? {}) as { email?: unknown; phone?: unknown }
  const contactEmail =
    typeof contactObj.email === 'string' && contactObj.email.trim() ? contactObj.email.trim() : null
  const contactPhone =
    typeof contactObj.phone === 'string' && contactObj.phone.trim() ? contactObj.phone.trim() : null
  const modulesLive = modules.filter((m) => m.state === 'live').length
  const launchBlockers = [
    counts.activeServices > 0 ? null : 'Tjänster',
    counts.activeStaff > 0 ? null : 'Personal',
    counts.workingHours > 0 ? null : 'Öppettider',
  ].filter(Boolean) as string[]
  const launchReady = launchBlockers.length === 0
  const ownerInvited = !!salonAdmin?.email

  const tabs: Partial<Record<TenantTabKey, React.ReactNode>> = {
    Översikt: (
      <>
        {/* Launch-banner: den enda status-signalen operatören behöver överst — redo att
            ta emot bokningar, eller vad som saknas. Härlett, inga nya reads. */}
        <div className={styles.launchBanner} data-ready={launchReady && isActive ? 'true' : 'false'}>
          <div className={styles.launchRing}>
            <Icon name={launchReady && isActive ? 'checkCircle' : 'alert'} size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className={styles.launchTitle}>
              {launchReady && isActive
                ? 'Redo att ta emot bokningar'
                : launchReady
                  ? 'Allt ifyllt — ej lanserad'
                  : `Saknas för att gå live: ${launchBlockers.join(', ')}`}
            </div>
            <p className={styles.launchSub}>
              {launchReady && isActive
                ? `Tjänster, personal och öppettider på plats. Storefronten är live på ${tenant.slug}.${ROOT}.`
                : launchReady
                  ? 'Aktivera salongen i Drift för att gå publik.'
                  : 'Fyll i det som saknas i respektive flik, aktivera sedan i Drift.'}
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={styles.launchAction}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', borderRadius: 6, border: '1px solid var(--c-line-strong)', background: 'var(--c-paper)', color: 'var(--c-ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          >
            Visa live ↗
          </a>
        </div>

        {/* Premium stat-kort — RIKTIGA siffror. Genomförda visar completed/bokningar-%
            (härlett, inte påhittat); inga fejk-trendgrafer. */}
        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={styles.statLabel}>Bokningar</span>
              <Icon name="calendar" size={15} style={{ color: 'var(--c-ink-3)', flex: 'none' }} />
            </div>
            <div className={styles.statVal}>{counts.bookings}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={styles.statLabel}>Genomförda</span>
              <Icon name="checkCircle" size={15} style={{ color: 'var(--c-ink-3)', flex: 'none' }} />
            </div>
            <div className={styles.statVal}>
              {counts.completed}
              {counts.bookings > 0 ? <small>{Math.round((counts.completed / counts.bookings) * 100)}%</small> : null}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={styles.statLabel}>Kunder</span>
              <Icon name="users" size={15} style={{ color: 'var(--c-ink-3)', flex: 'none' }} />
            </div>
            <div className={styles.statVal}>{customerData.summary.total}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={styles.statLabel}>Personal</span>
              <Icon name="scissors" size={15} style={{ color: 'var(--c-ink-3)', flex: 'none' }} />
            </div>
            <div className={styles.statVal}>{staffList.length}</div>
          </div>
        </div>

      <div className={styles.twoCol}>
        <div className={styles.col}>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Onboarding-stege
            </div>
            <OnboardingChecklist steps={onboarding} />
          </Card>
          {/* Snabbfakta — den rika nyckelinfon (tema/bransch/kontakt/moduler), kompakt. */}
          <Card>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Snabbfakta
            </div>
            <div className={styles.kvList}>
              <KV label="Bransch" value={vertical ?? '—'} />
              <KV label="Tema" value={activeTemplateKey} />
              <KV label="Bokningsvariant" value={operative.bookingVariant} />
              <KV label="Moduler live" value={`${modulesLive} av ${modules.length}`} />
              <KV label="Kontakt" value={contactEmail || contactPhone ? [contactEmail, contactPhone].filter(Boolean).join(' · ') : '—'} />
              <KV
                label="Live-URL"
                value={
                  <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--c-forest)' }}>
                    {tenant.slug}.{ROOT}
                  </a>
                }
              />
            </div>
          </Card>
          <Card>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Prismodell (fakturering)</h2>
              <span className={styles.chip}>FLÖDE 2</span>
            </div>
            <p className={styles.noteText} style={{ marginBottom: 14 }}>
              Nuvarande:{' '}
              <b>{BILLING_MODEL_LABELS[(settings?.billing_model ?? 'per_booking') as BillingModel]}</b> ·
              startavgift {formatPrice(settings?.setup_fee_cents ?? 0)}. Underlaget syns i Fakturering.
            </p>
            <BillingForm
              tenantId={tenant.id}
              billingModel={settings?.billing_model ?? 'per_booking'}
              setupFeeCents={settings?.setup_fee_cents ?? 0}
              perBookingFeeCents={settings?.per_booking_fee_cents ?? 0}
              flatMonthlyFeeCents={settings?.flat_monthly_fee_cents ?? 0}
            />
          </Card>
        </div>
        <div className={styles.col}>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Ägare
            </div>
            {salonAdmin?.email ? (
              <>
                <div className={styles.ownerHead}>
                  <div className={styles.ownerAvatar} style={{ background: 'var(--c-forest)' }} aria-hidden="true">
                    {(salonAdmin.fullName || salonAdmin.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {/* #10 — owner name from users.full_name; honest "Salongsägare"
                        label when no name was captured (never a fabricated name). */}
                    <div className={styles.ownerName}>{salonAdmin.fullName || 'Salongsägare'}</div>
                    <div className={styles.ownerRole}>{salonAdmin.status === 'active' ? 'Aktivt konto' : 'Inbjuden'}</div>
                  </div>
                </div>
                <div className={styles.kvList}>
                  {/* #11 — the owner's role is always salon_admin; show it whenever an
                      owner exists (not gated on a captured name). */}
                  <KV label="Roll" value="Salongsadmin (ägare)" />
                  <KV label="E-post" value={salonAdmin.email} />
                </div>
              </>
            ) : (
              <p className={styles.noteText}>
                Ingen salongsadmin inbjuden ännu. Bjud in en ägare via Onboarda salong, eller skapa
                personal i Personal-fliken.
              </p>
            )}
          </Card>
          <Card style={{ background: 'var(--c-paper-2)' }}>
            <div className={styles.noteHead}>
              <Icon name="info" size={15} style={{ color: 'var(--c-gold-600)' }} />
              <span>Anpassningsnivå {customizationLevel}</span>
            </div>
            <p className={styles.noteText}>
              {customizationLevel === 1
                ? 'Bas — färgtokens (no-code). Välj temamall + logo/font i Sida-fliken för nivå 2.'
                : 'Token-branding (no-code: temamall + färg/font/logo) aktiv och slår igenom utan deploy. Premium nivå-3 scoped CSS-overrides görs med kod i säker miljö — aldrig via no-code-UI.'}
            </p>
          </Card>
        </div>
      </div>
      </>
    ),

    Tjänster: (
      <div className={styles.maxCol}>
        <Card>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Tjänster · {services.length}</h2>
            <span className={styles.chip}>services · pris/längd</span>
          </div>
          <p className={styles.noteText} style={{ marginBottom: 14 }}>
            Hantera salongens tjänster direkt härifrån — lägg till, redigera pris/längd,
            aktivera/inaktivera eller ta bort. Ändringen slår igenom på bokningen direkt.
          </p>
          <ServicesCard tenantId={tenant.id} services={services} staff={staffList} storefrontUrl={storefrontUrl} />
        </Card>
      </div>
    ),

    Kunder: (
      <div className={styles.maxCol}>
        <TenantCustomers data={customerData} />
      </div>
    ),

    Personal: (
      <div className={styles.maxCol}>
        <Card>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Personal · {staffList.length}</h2>
            <span className={styles.chip}>staff · schema</span>
          </div>
          <p className={styles.noteText} style={{ marginBottom: 14 }}>
            Hantera salongens personal direkt härifrån — redigera namn/titel, aktivera/inaktivera,
            och sätt varje medarbetares veckoschema. Öppettiderna på storefronten härleds från
            schemat. Ändringar slår igenom på bokningen direkt.
          </p>
          <PersonalCard
            tenantId={tenant.id}
            staff={staffList}
            services={services.map((s) => ({ id: s.id, name: s.name }))}
            serviceRoleAvailable={serviceRoleAvailable}
          />
        </Card>
        <p className={styles.noteText} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="info" size={14} style={{ color: 'var(--c-info)', flex: 'none' }} />
          Lägg till, redigera, schemalägg och ge inlogg åt personalen — allt härifrån. Öppettiderna
          på storefronten härleds ur veckoschemana.
        </p>
      </div>
    ),

    // MODUL-FLIKAR (goal-54 §1): samma verktyg som kundens egen admin, mountade med
    // tenantId (→ TenantScope lägger hidden tenantId i varje formulär → moduleCtx
    // dual-guard). Visas ENDAST när modulen är på. Bransch-neutral copy — detta är
    // kundens yta oavsett om kunden är florist, salong eller mekaniker.
    ...(shopOn && {
      Webshop: (
        <div className={styles.maxCol}>
          <p className={styles.noteText}>
            Kundens webshop — samma verktyg som i kundens egen admin. Allt du ändrar här
            slår igenom direkt på kundens publika sida.
          </p>
          <ShopAdmin
            tenantId={tenant.id}
            products={shopProducts}
            orders={shopOrders}
            fulfilment={shopFulfilment}
            tenantName={tenant.name}
            assets={mediaAssets}
          />
        </div>
      ),
    }),
    ...(bloggOn && {
      Blogg: (
        <div className={styles.maxCol}>
          <p className={styles.noteText}>
            Kundens blogg — skriv, publicera och avpublicera inlägg åt kunden.
          </p>
          <BloggAdmin
            tenantId={tenant.id}
            posts={blogPosts}
            tenantName={tenant.name}
            layoutVariant={bloggLayout}
            assets={mediaAssets}
          />
        </div>
      ),
    }),
    ...(offertOn && {
      Offerter: (
        <div className={styles.maxCol}>
          <p className={styles.noteText}>
            Kundens inkomna offertförfrågningar — status, anteckning och prisuppskattning.
          </p>
          <OffertInbox tenantId={tenant.id} requests={offertRequests} />
        </div>
      ),
    }),
    ...(mediaOn && mediaUsage
      ? {
          Bildbibliotek: (
            <div className={styles.maxCol}>
              <p className={styles.noteText}>
                Kundens bildbibliotek — ladda upp bilder åt kunden. Webshop och blogg
                hämtar sina bilder härifrån.
              </p>
              <MediaLibrary
                tenantId={tenant.id}
                assets={mediaAssets}
                usage={mediaUsage}
                tenantName={tenant.name}
              />
            </div>
          ),
        }
      : {}),

    // Sida = ALLT som rör salongens publika webbsida på ett ställe (Zivar: "samla allt
    // som har med sidan att göra"): förhandsvisning + utseende + text/bilder + kund-
    // editor-reglaget. Drift hålls fri från sido-grejer (ren drift).
    Sida: (
      <>
        <SidaStudio
          tenantId={tenant.id}
          previewPath={`/salong-preview/${tenant.slug}`}
          storefrontUrl={storefrontUrl}
          storefrontHost={storefrontHost}
          templateKey={activeTemplateKey}
          isActive={isActive}
          branding={branding}
          copy={copy}
          heroImages={branding.hero_images ?? []}
          galleryImages={branding.gallery_images ?? []}
          name={tenant.name}
          social={detail.social}
          openingHours={detail.openingHours}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
          address={detail.primaryAddress}
          bookingVariant={operative.bookingVariant}
          pickerMode={readPickerMode(rawSettings)}
          staffAvatars={readStaffAvatarMode(rawSettings)}
          hasStaffPhoto={hasStaffPhoto}
          staffTeam={staffList.map((s) => ({
            id: s.id,
            title: s.title,
            active: s.active,
            avatarUrl: s.avatar_url,
            showOnSite: s.show_on_site,
          }))}
        />
      </>
    ),

    Integrationer: (
      <div className={styles.cardGrid}>
        {integrationRows(tenant.stripe_charges_enabled, operative.googleReviewUrl).map((it) => (
          <Card key={it.name}>
            <div className={styles.intRow}>
              <div className={styles.intAvatar} style={{ background: it.color }} aria-hidden="true">
                {it.letter}
              </div>
              <div className={styles.intBody}>
                <div className={styles.intName}>{it.name}</div>
                <div className={styles.intDesc}>{it.desc}</div>
              </div>
              <Badge tone={it.tone}>{it.status}</Badge>
            </div>
          </Card>
        ))}
        {/* Domän = its own real surface (the existing DomainPanel — kept, not dropped). */}
        <Card>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Domän</h2>
            <span className={styles.chip}>tenant_domains</span>
          </div>
          <DomainPanel slug={tenant.slug} tenantId={tenant.id} />
        </Card>
      </div>
    ),

    Drift: (
      <div className={styles.maxCol}>
        {/* Grunddata/inställningar (§2.1B) — salongsnamn, bokningsvariant, Google-
            recensionslänk. Flyttat hit från gamla "Data"-hinken (egna wired forms). */}
        <OperativeControls
          tenantId={tenant.id}
          name={tenant.name}
          googleReviewUrl={operative.googleReviewUrl}
          salonAdminEmail={salonAdmin?.email ?? null}
          serviceRoleAvailable={serviceRoleAvailable}
        />
        <Card>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {isActive ? 'Salongen är aktiv' : isDeleted ? 'Salongen är borttagen' : 'Salongen är pausad'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-ink-3)', marginTop: 3 }}>
              {isActive
                ? 'Pausa → publik storefront blockeras direkt (RLS + cache-bust). Data rörs aldrig.'
                : isDeleted
                  ? 'Mjukt borttagen (status=deleted). Data är orörd; går att återaktivera vid behov.'
                  : 'Publik storefront är blockerad. Data är orörd och går att återaktivera.'}
            </div>
          </div>
          <StatusControl tenantId={tenant.id} status={tenant.status} />
        </Card>

        <Card>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Moduler</h2>
            <span className={styles.chip}>tenant_modules</span>
          </div>
          <p className={styles.noteText} style={{ marginBottom: 4 }}>
            Per-modul livscykel: av → utkast → live → pausad. Aktivering (av→utkast) är
            super-admin-spärrad i DB. Live slår igenom på storefronten direkt (cache-bust).
          </p>
          <ModulesCard tenantId={tenant.id} modules={modules} />
        </Card>

        {/* Kund-editor-reglaget (Zivar: "sajtbyggaren för kunden borde inte vara i
            Sida — den ska ligga i Drift"): styr bara om KUNDEN får redigera själv,
            aldrig den publika sidan. */}
        <Card>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Kunden redigerar själv</h2>
            <span className={styles.chip}>sajtbyggare</span>
          </div>
          <p className={styles.noteText} style={{ marginBottom: 8 }}>
            Slår på/av den kund-egna sid-editorn i salongens admin. Påverkar bara kundens
            editor — aldrig den publika sidan.
          </p>
          <SajtbyggareControl tenantId={tenant.id} enabled={siteEditorEnabled} />
        </Card>

        <Card pad={0}>
          <div className={styles.sectionHead} style={{ padding: '16px 20px', marginBottom: 0 }}>
            <h2 className={styles.h2}>Audit-logg</h2>
            <span className={styles.chip}>audit_log</span>
          </div>
          {audit.length === 0 ? (
            <p className={styles.empty}>Inga loggade händelser ännu för den här salongen.</p>
          ) : (
            <div className={styles.auditList}>
              {audit.map((a) => (
                <AuditRowView key={a.id} row={a} />
              ))}
            </div>
          )}
        </Card>

        <Card className={styles.danger}>
          <div className={styles.dangerHead}>
            <Icon name="shield" size={16} />
            <span>Riskzon · skyddad av audit-guard</span>
          </div>
          <p className={styles.dangerText}>
            Ta bort = mjuk borttagning: publik sajt + admin blockeras, men alla rader &amp; historik
            sparas (build-once-never-delete — hård radering är permanent spärrad). Vill du bara dölja
            tillfälligt? Suspendera ovan i stället.
          </p>
          <TenantDangerCard tenantId={tenant.id} tenantName={tenant.name} />
        </Card>
      </div>
    ),
  }

  return (
    <section className="portal-section">
      <div className={styles.crumb}>
        <Button href="/salonger" variant="ghost" icon="arrowLeft" size="sm">
          Kunder
        </Button>
        <span>/ {tenant.slug}.{ROOT}</span>
      </div>

      <div className={styles.head}>
        <div className={styles.ident}>
          <div className={styles.mark} style={{ background: markColor }} aria-hidden="true">
            {tenant.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className={styles.titleRow}>
              <h1 className="h1" style={{ margin: 0 }}>
                {tenant.name}
              </h1>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <div className={styles.meta}>
              <span>
                <Icon name="link" size={13} />
                <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--c-forest)' }}>
                  {tenant.slug}.{ROOT}
                </a>
              </span>
              <span>
                <Icon name="clock" size={13} />
                skapad{' '}
                {new Intl.DateTimeFormat('sv-SE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Europe/Stockholm',
                }).format(new Date(tenant.created_at))}
              </span>
            </div>
          </div>
        </div>
        <TenantHeaderActions
          tenantId={tenant.id}
          tenantName={tenant.name}
          storefrontUrl={url}
          salonAdminEmail={salonAdmin?.email ?? null}
          serviceRoleAvailable={serviceRoleAvailable}
        />
      </div>

      <TenantDetailTabs tabs={tabs} />
    </section>
  )
}

// ── per-tenant integration rows (HONEST: only real signals; static label else) ────
type IntRow = {
  name: string
  desc: string
  status: string
  tone: BadgeTone
  color: string
  letter: string
}
function integrationRows(stripeEnabled: boolean, googleReviewUrl: string | null): IntRow[] {
  return [
    {
      name: 'Stripe Connect',
      desc: stripeEnabled
        ? 'Betalning vid bokning · kontot kan ta betalt'
        : 'Inte aktiverat — kontot kan inte ta betalt ännu',
      status: stripeEnabled ? 'Ansluten' : 'Ej ansluten',
      tone: stripeEnabled ? 'success' : 'warning',
      color: '#635BFF',
      letter: 'S',
    },
    {
      name: 'Google-recensioner',
      desc: googleReviewUrl ?? 'Ingen recensionslänk satt',
      status: googleReviewUrl ? 'Satt' : 'Ej satt',
      tone: googleReviewUrl ? 'success' : 'warning',
      color: '#EA4335',
      letter: 'G',
    },
    {
      // No per-tenant SMS-status column exists (catalog.ts marks it countSource:null) —
      // render an honest plattformsbred label, NEVER a fabricated På/Av.
      name: 'SMS (46elks)',
      desc: 'Bekräftelse + påminnelse 24 h innan · plattformsbred kö',
      status: 'Plattformsbred',
      tone: 'neutral',
      color: '#1F4636',
      letter: 'S',
    },
  ]
}

// ── small server bits ─────────────────────────────────────────────────────────────
function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={mono ? styles.kvValueMono : styles.kvValue}>{value}</span>
    </div>
  )
}

const AUDIT_TONE_COLOR: Record<string, string> = {
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
  neutral: 'var(--c-ink-3)',
}
function auditIcon(action: string): IconName {
  if (action.includes('suspend') || action.includes('pause')) return 'pause'
  if (action.includes('delete')) return 'shield'
  if (action.includes('password')) return 'mail'
  if (action.includes('invite') || action.includes('staff')) return 'user'
  if (action.includes('branding')) return 'palette'
  if (action.includes('billing')) return 'dollar'
  if (action.includes('create')) return 'plus'
  if (action.includes('activate')) return 'check'
  return 'info'
}
function AuditRowView({ row }: { row: AuditRow }) {
  const tone = classifyAuditTone(row.action)
  const color = AUDIT_TONE_COLOR[tone] ?? AUDIT_TONE_COLOR.neutral
  const when = new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(row.created_at))
  return (
    <div className={styles.auditRow}>
      <span className={styles.auditIcon} style={{ color }}>
        <Icon name={auditIcon(row.action)} size={15} />
      </span>
      <div className={styles.auditBody}>
        <div className={styles.auditAction}>{row.action}</div>
        <div className={styles.auditMeta}>{row.meta ? JSON.stringify(row.meta) : '—'}</div>
      </div>
      <span className={styles.auditAt}>{when}</span>
    </div>
  )
}
