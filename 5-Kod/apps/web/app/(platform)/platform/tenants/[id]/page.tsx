import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTenantDetail, getTenantAudit } from '@/lib/platform/tenants'
import { BILLING_MODEL_LABELS, formatPrice, type BillingModel } from '@/lib/platform/billing'
import { OnboardingChecklist } from '@/components/platform/OnboardingChecklist'
import { PlatformBrandingForm } from '@/components/platform/PlatformBrandingForm'
import { BillingForm } from '@/components/platform/BillingForm'
import { StatusControl } from '@/components/platform/StatusControl'
import { DomainPanel } from '@/components/platform/DomainPanel'
import styles from '@/components/platform/platform.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Salong' }

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'
function publicUrl(slug: string): string {
  const isLocal = ROOT.includes('localhost') || ROOT.includes('127.0.0.1')
  return `${isLocal ? 'http' : 'https'}://${slug}.${ROOT}`
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getTenantDetail(id)
  if (!detail) notFound()
  const { tenant, settings, branding, counts, salonAdmin, onboarding } = detail
  const audit = await getTenantAudit(id)
  const url = publicUrl(tenant.slug)

  return (
    <section className="portal-section">
      <div className={styles.sectionHead}>
        <h1 style={{ margin: 0 }}>{tenant.name}</h1>
        <Link href="/platform/tenants" className={styles.navLink}>
          ← Salonger
        </Link>
      </div>
      <p className={styles.muted}>
        <code className={styles.code}>{tenant.slug}</code> ·{' '}
        <span className={`${styles.badge} ${tenant.status === 'active' ? styles.badgeActive : styles.badgeSuspended}`}>
          {tenant.status}
        </span>{' '}
        ·{' '}
        <a href={url} target="_blank" rel="noreferrer">
          {url} ↗
        </a>
      </p>

      {/* Read-only insyn */}
      <div className={styles.cardGrid}>
        <InsightCard title="Aktiva tjänster" value={counts.activeServices} />
        <InsightCard title="Aktiva medarbetare" value={counts.activeStaff} />
        <InsightCard title="Arbetstidsrader" value={counts.workingHours} />
        <InsightCard title="Aktiva bokningar" value={counts.bookings} />
      </div>
      <p className={styles.muted}>
        Salongsadmin:{' '}
        {salonAdmin?.email ? (
          <strong>{salonAdmin.email}</strong>
        ) : (
          <em>ingen inbjuden ännu</em>
        )}
      </p>

      {/* Step 6 — launch / suspend */}
      <h2 style={{ marginTop: '2rem' }}>Status &amp; lansering</h2>
      <p className={styles.muted}>
        Pausa → publika sajten blockeras (RLS + cache busts direkt). Aktivera → öppen igen.
      </p>
      <StatusControl tenantId={tenant.id} status={tenant.status} />

      {/* Onboarding ladder (steg 1–6) */}
      <h2 style={{ marginTop: '2rem' }}>Onboarding</h2>
      <OnboardingChecklist steps={onboarding} />

      {/* Step 2 — branding */}
      <h2 style={{ marginTop: '2rem' }}>Varumärke</h2>
      <PlatformBrandingForm tenantId={tenant.id} branding={branding} />

      {/* FLÖDE 2 — billing */}
      <h2 style={{ marginTop: '2rem' }}>Prismodell (fakturering)</h2>
      <p className={styles.muted}>
        Nuvarande: {BILLING_MODEL_LABELS[(settings?.billing_model ?? 'per_booking') as BillingModel]} ·
        startavgift {formatPrice(settings?.setup_fee_cents ?? 0)}
      </p>
      <BillingForm
        tenantId={tenant.id}
        billingModel={settings?.billing_model ?? 'per_booking'}
        setupFeeCents={settings?.setup_fee_cents ?? 0}
        perBookingFeeCents={settings?.per_booking_fee_cents ?? 0}
        flatMonthlyFeeCents={settings?.flat_monthly_fee_cents ?? 0}
      />

      {/* Step 5 — egen domän (SPÄRRAD) */}
      <h2 style={{ marginTop: '2rem' }}>Egen domän</h2>
      <DomainPanel slug={tenant.slug} />

      {/* Audit log (read-only insyn) */}
      <h2 style={{ marginTop: '2rem' }}>Händelselogg</h2>
      {audit.length === 0 ? (
        <p className={styles.muted}>Inga loggade händelser ännu.</p>
      ) : (
        <table className="portal-table">
          <thead>
            <tr>
              <th>Tid</th>
              <th>Åtgärd</th>
              <th>Detalj</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id}>
                <td className={styles.muted}>
                  {new Intl.DateTimeFormat('sv-SE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Europe/Stockholm',
                  }).format(new Date(a.created_at))}
                </td>
                <td>
                  <code className={styles.code}>{a.action}</code>
                </td>
                <td className={styles.muted}>{JSON.stringify(a.meta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function InsightCard({ title, value }: { title: string; value: number }) {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{title}</p>
      <p className="portal-stat-value" style={{ margin: 0 }}>
        {value}
      </p>
    </div>
  )
}
