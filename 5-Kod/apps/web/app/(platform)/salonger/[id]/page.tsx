import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getTenantDetail, getTenantAudit, deriveCustomizationLevel } from '@/lib/platform/tenants'
import { listStaffAllTenants } from '@/lib/platform/people'
import { getTenantCustomers } from '@/lib/platform/tenant-customers'
import { TenantCustomers } from '@/components/platform/TenantCustomers'
import { classifyAuditTone } from '@/lib/platform/audit'
import type { AuditRow } from '@/lib/platform/audit'
import { BILLING_MODEL_LABELS, formatPrice, type BillingModel } from '@/lib/platform/billing'
import { OnboardingChecklist } from '@/components/platform/OnboardingChecklist'
import { PlatformBrandingForm } from '@/components/platform/PlatformBrandingForm'
import { BillingForm } from '@/components/platform/BillingForm'
import { StatusControl } from '@/components/platform/StatusControl'
import { DomainPanel } from '@/components/platform/DomainPanel'
import { OperativeControls } from '@/components/platform/OperativeControls'
import { ServicesCard } from '@/components/platform/ServicesCard'
import { PersonalCard } from '@/components/platform/PersonalCard'
import { StorefrontContentCard } from '@/components/platform/StorefrontContentCard'
import { ModulesCard } from '@/components/platform/ModulesCard'
import { listTenantModules } from '@/lib/platform/tenant-modules-admin'
import { SidaPreview } from '@/components/platform/SidaPreview'
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
import { Badge, Button, Card, Icon, Stat, type BadgeTone, type IconName } from '@/components/portal/ui'
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
 * Salong-detalj — full operativ kontroll för EN vald salong (law: SuperTenant.jsx,
 * "Supabase med mitt UI"). EXACT copy of the mock's composition: a header (mark +
 * name + status + meta + actions) over six SubTabs (Översikt/Data/Personal/Branding/
 * Integrationer/Drift).
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
  const [audit, customerData, allStaff, modules] = await Promise.all([
    getTenantAudit(id),
    getTenantCustomers(id),
    listStaffAllTenants(),
    listTenantModules(id),
  ])
  const staff = allStaff.filter((s) => s.slug === tenant.slug)

  const url = publicUrl(tenant.slug)
  const serviceRoleAvailable = hasServiceRole()
  const b = branding as TenantBranding
  const markColor = b.color_primary || 'var(--c-forest)'
  const isActive = tenant.status === 'active'
  const statusLabel = isActive ? 'Aktiv' : tenant.status === 'suspended' ? 'Pausad' : tenant.status
  const statusTone: BadgeTone = isActive ? 'success' : 'warning'

  // Visual hub (spår 4): the tenant's active template = settings.theme (the five named
  // layouts), fenced to the catalog keys that 1:1 match the `templates` table. The
  // preview iframe points at the REAL public storefront (slug/custom-domain origin).
  const rawTheme = (settings?.settings as { theme?: unknown } | null)?.theme
  const activeTemplateKey =
    typeof rawTheme === 'string' && (STOREFRONT_THEMES as readonly string[]).includes(rawTheme)
      ? rawTheme
      : DEFAULT_STOREFRONT_THEME
  // Per-tenant edit-toggle (Task 3): is the site editor (sajtbyggaren) enabled for THIS
  // salon? Default OFF — the platform turns it on per customer in the Drift-tab below.
  const siteEditorEnabled = tenantSiteEditorEnabled(settings?.settings)
  const storefrontUrl = tenantStorefrontUrl(tenant.slug) ?? url
  const storefrontHost = tenantStorefrontHost(tenant.slug) ?? `${tenant.slug}.${ROOT}`

  // Kund-överblick (Översikt): everything the operator needs to know at a glance,
  // derived from already-loaded data (no extra query). Launch-readiness mirrors the
  // list-view launchReady (staff + services + hours) so the badge here agrees with
  // the Aktiv/Onboarding pill on the card grid. Bransch/kontakt read the raw settings
  // jsonb (same seam as theme/booking above).
  const rawSettings = (settings?.settings ?? {}) as Record<string, unknown>
  const vertical =
    typeof rawSettings.vertical === 'string' && rawSettings.vertical.trim() ? rawSettings.vertical.trim() : null
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

  const tabs: Record<TenantTabKey, React.ReactNode> = {
    Översikt: (
      <div className={styles.twoCol}>
        <div className={styles.col}>
          {/* Kund-överblick — status + nyckelfakta på en blick (allt operatören
              behöver veta innan hen dyker in i flikarna). Härlett, inga nya reads. */}
          <Card>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Kund-överblick</h2>
              <span className={styles.chip}>allt du behöver veta</span>
            </div>
            <div style={{ marginBottom: 14 }}>
              {launchReady && isActive ? (
                <Badge tone="success">Aktiv &amp; publik — redo</Badge>
              ) : launchReady ? (
                <Badge tone="warning">Allt ifyllt — ej lanserad (aktivera i Drift)</Badge>
              ) : (
                <Badge tone="warning">Saknas för att gå live: {launchBlockers.join(', ')}</Badge>
              )}
            </div>
            <div className={styles.kvList}>
              <KV label="Tjänster" value={<ReadyVal ok={counts.activeServices > 0} text={`${counts.activeServices} aktiva`} />} />
              <KV label="Personal" value={<ReadyVal ok={counts.activeStaff > 0} text={`${counts.activeStaff} aktiva`} />} />
              <KV
                label="Öppettider"
                value={<ReadyVal ok={counts.workingHours > 0} text={counts.workingHours > 0 ? `${counts.workingHours} rader` : 'saknas'} />}
              />
              <KV
                label="Ägar-konto"
                value={<ReadyVal ok={ownerInvited} text={ownerInvited ? (salonAdmin?.status === 'active' ? 'aktivt' : 'inbjuden') : 'ej inbjuden'} />}
              />
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
          {/* Bokningar/Completade/Kunder/Personal — alla riktiga (aktiva bokningar,
              completade, customers.length, staff.length). Inget påhittat. */}
          <div className="bo-stat-grid">
            <Stat label="Bokningar" value={counts.bookings} icon="calendar" />
            <Stat label="Completade" value={counts.completed} icon="checkCircle" />
            <Stat label="Kunder" value={customerData.summary.total} icon="users" />
            <Stat label="Personal" value={staff.length} icon="scissors" />
          </div>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Onboarding-stege
            </div>
            <OnboardingChecklist steps={onboarding} />
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
                ? 'Bas — färgtokens (no-code). Välj temamall + logo/font i Branding-fliken för nivå 2.'
                : customizationLevel === 2
                  ? 'Token-branding (no-code: temamall + färg/font/logo) aktiv och slår igenom utan deploy. Premium nivå-3 scoped CSS-overrides görs med kod i säker miljö — aldrig via no-code-UI.'
                  : 'Nivå 3 — scoped CSS-overrides (premium-design) aktiva, görs med kod i säker miljö. No-code-token-lagret nedan ligger kvar.'}
            </p>
          </Card>
        </div>
      </div>
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

    // Sida = ALLT som rör salongens publika webbsida på ett ställe (Zivar: "samla allt
    // som har med sidan att göra"): förhandsvisning + utseende + text/bilder + kund-
    // editor-reglaget. Drift hålls fri från sido-grejer (ren drift).
    Sida: (
      <div className={styles.maxCol}>
        {/* Live-förhandsvisning av den SKARPA sidan (same-origin preview-rutt) överst —
            allt nedanför redigerar den; "Ladda om" visar ändringen. */}
        <Card>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Förhandsvisning</h2>
          </div>
          <SidaPreview
            previewPath={`/salong-preview/${tenant.slug}`}
            storefrontUrl={storefrontUrl}
            storefrontHost={storefrontHost}
            templateKey={activeTemplateKey}
            isActive={isActive}
          />
        </Card>

        <div className={styles.twoCol}>
          <Card>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Varumärke</h2>
            </div>
            <PlatformBrandingForm tenantId={tenant.id} branding={branding} />
          </Card>

          <Card>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Kunden redigerar själv</h2>
            </div>
            <p className={styles.noteText} style={{ marginBottom: 12 }}>
              Slår på/av den kund-egna sid-editorn. Påverkar bara kundens editor, aldrig den publika
              sidan.
            </p>
            <SajtbyggareControl tenantId={tenant.id} enabled={siteEditorEnabled} />
          </Card>
        </div>

        <Card>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Text &amp; bilder</h2>
          </div>
          <StorefrontContentCard
            tenantId={tenant.id}
            copy={copy}
            heroImages={branding.hero_images ?? []}
            galleryImages={branding.gallery_images ?? []}
          />
        </Card>
      </div>
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
          bookingVariant={operative.bookingVariant}
          salonAdminEmail={salonAdmin?.email ?? null}
          serviceRoleAvailable={serviceRoleAvailable}
        />
        <Card>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {isActive ? 'Salongen är aktiv' : 'Salongen är pausad'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-ink-3)', marginTop: 3 }}>
              {isActive
                ? 'Pausa → publik storefront blockeras direkt (RLS + cache-bust). Data rörs aldrig.'
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

/** ✓/✗ readiness value for the Kund-överblick KV-list (green när klart, amber när kvar). */
function ReadyVal({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: ok ? 'var(--c-success)' : 'var(--c-warning)' }}
    >
      <Icon name={ok ? 'checkCircle' : 'alert'} size={14} />
      {text}
    </span>
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
