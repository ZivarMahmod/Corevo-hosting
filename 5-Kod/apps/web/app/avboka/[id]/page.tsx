import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { pickNav, pickTemplate } from '@/components/brand/variants'
import { Footer } from '@/components/brand/Footer'
import { createServiceClient } from '@/lib/platform/service'
import { verifyCancelToken } from '@/lib/booking/cancel-token'
import { getCancellationCutoffHours, withinCancellationWindow } from '@/lib/kund/settings'
import { cancelByToken } from '../actions'
import storefront from '@/components/storefront/storefront.module.css'

// Public guest self-service cancel page (NOTIF-GUEST). Authorisation = the HMAC
// capability token in `?t=` (no login). We verify it FIRST; only then do we read
// the booking via service-role (RLS bypass is justified by the unguessable token).
// Exposed data is the same safe summary the confirmation page shows — salong,
// tjänst, tid — no other PII, and never another booking.
//
// Chrome: app/avboka/ has no layout (one isn't in revir to create), so this page
// renders the full salon shell itself — mirroring app/boka/layout.tsx (currentTenant
// + injectTenantTokens + Nav/Footer) so a shared/refreshed link is never stripped.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Avboka tid' }

type DoneCode = 'ok' | 'already' | 'too_late' | 'error'

function Shell({
  children,
  tenant,
  settings,
  customerAccountsEnabled,
}: {
  children: React.ReactNode
  tenant: { id: string; name: string; slug: string }
  settings: NonNullable<Awaited<ReturnType<typeof currentTenant>>>['settings']
  customerAccountsEnabled: boolean
}) {
  const Nav = pickNav(settings.layout.nav_variant)
  const template = pickTemplate(settings.layout.nav_variant)
  const overrideCss = settings.customOverride?.css
  const brandProps = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    branding: settings.branding,
  }
  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme={settings.theme}
      data-tenant={tenant.id}
      data-template={template}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      {overrideCss ? (
        <style dangerouslySetInnerHTML={{ __html: `[data-tenant="${tenant.id}"]{${overrideCss}}` }} />
      ) : null}
      <Nav {...brandProps} customerAccountsEnabled={customerAccountsEnabled} />
      <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
      <Footer tenant={{ name: tenant.name }} />
    </div>
  )
}

/** Neutral message inside the salon shell (or a bare section if no tenant chrome). */
async function Message({ title, body }: { title: string; body: string }) {
  const bundle = await currentTenant()
  const inner = (
    <section className="section">
      <div className="section-inner booking-confirm">
        <h1>{title}</h1>
        <p className="confirm-note">{body}</p>
        <div style={{ marginTop: '1rem' }}>
          <Link href="/" className="btn-primary">
            Till startsidan
          </Link>
        </div>
      </div>
    </section>
  )
  if (!bundle) return inner
  return (
    <Shell
      tenant={{ id: bundle.tenant.id, name: bundle.tenant.name, slug: bundle.tenant.slug }}
      settings={bundle.settings}
      customerAccountsEnabled={bundle.settings.customerAccountsEnabled}
    >
      {inner}
    </Shell>
  )
}

export default async function AvbokaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string; done?: string }>
}) {
  const { id } = await params
  const { t, done } = await searchParams

  // 1. Capability check FIRST. Invalid/missing token → neutral message, no DB read.
  if (!t || !(await verifyCancelToken(id, t))) {
    return <Message title="Ogiltig länk" body="Ogiltig eller utgången länk." />
  }

  // Post-action outcomes (the inline cancel action redirects back here with ?done=).
  if (done) {
    const code = done as DoneCode
    if (code === 'ok') {
      return <Message title="Din tid är avbokad" body="Tiden har avbokats. Varmt välkommen åter när det passar dig!" />
    }
    if (code === 'already') {
      return <Message title="Redan avbokad" body="Den här tiden är redan avbokad." />
    }
    if (code === 'too_late') {
      return (
        <Message
          title="För sent att avboka"
          body="Det är för sent att avboka online — kontakta salongen så hjälper vi dig."
        />
      )
    }
    return <Message title="Något gick fel" body="Vi kunde inte avboka just nu. Försök igen eller kontakta salongen." />
  }

  // 2. Token valid → read the booking via service-role (token is the capability).
  const admin = createServiceClient()
  if (!admin) {
    return <Message title="Avbokning otillgänglig" body="Avbokning är inte tillgänglig just nu. Kontakta salongen." />
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, tenant_id, status, start_ts, services(name), staff(title), tenants(name), locations(name, timezone)')
    .eq('id', id)
    .maybeSingle()
  if (!booking) {
    return <Message title="Bokningen hittades inte" body="Vi kunde inte hitta bokningen." />
  }

  const serviceName = (booking.services as { name?: string } | null)?.name ?? 'Behandling'
  const staffTitle = (booking.staff as { title?: string } | null)?.title ?? null
  const tenantName = (booking.tenants as { name?: string } | null)?.name ?? 'Salongen'
  const loc = booking.locations as { name?: string; timezone?: string } | null
  const tz = loc?.timezone ?? 'Europe/Stockholm'
  const when = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'full', timeStyle: 'short', timeZone: tz }).format(
    new Date(booking.start_ts),
  )

  const alreadyCancelled = booking.status === 'cancelled'
  const cutoff = await getCancellationCutoffHours(admin, booking.tenant_id)
  const canCancel = !alreadyCancelled && withinCancellationWindow(booking.start_ts, cutoff)

  // Inline server action: re-verifies + re-checks window inside cancelByToken, then
  // redirects back here with the outcome (PRG — refresh-safe, no double-submit).
  async function submitCancel() {
    'use server'
    const res = await cancelByToken(id, t!)
    const code: DoneCode = res.ok
      ? 'ok'
      : res.reason === 'already_cancelled'
        ? 'already'
        : res.reason === 'too_late'
          ? 'too_late'
          : res.reason === 'invalid_token'
            ? 'error'
            : 'error'
    redirect(`/avboka/${id}?t=${encodeURIComponent(t!)}&done=${code}`)
  }

  const bundle = await currentTenant()
  const body = (
    <section className="section">
      <div className="section-inner booking-confirm">
        <h1>Avboka din tid</h1>
        <ul className="confirm-summary">
          <li>
            <span>Salong</span>
            <strong>{tenantName}</strong>
          </li>
          <li>
            <span>Tjänst</span>
            <strong>{serviceName}</strong>
          </li>
          <li>
            <span>Tid</span>
            <strong>{when}</strong>
          </li>
          {staffTitle ? (
            <li>
              <span>Hos</span>
              <strong>{staffTitle}</strong>
            </li>
          ) : null}
        </ul>

        {alreadyCancelled ? (
          <p className="confirm-note">Den här tiden är redan avbokad.</p>
        ) : canCancel ? (
          <>
            <p className="confirm-note">
              Vill du avboka? {cutoff > 0 ? `Du kan avboka senast ${cutoff} timmar innan besöket.` : null}
            </p>
            <form action={submitCancel} style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn-primary">
                Avboka tid
              </button>
            </form>
          </>
        ) : (
          <p className="confirm-note">Det är för sent att avboka online — kontakta salongen så hjälper vi dig.</p>
        )}

        <div style={{ marginTop: '1.25rem' }}>
          <Link href="/" style={{ textDecoration: 'underline' }}>
            Till startsidan
          </Link>
        </div>
      </div>
    </section>
  )

  if (!bundle) return body
  return (
    <Shell
      tenant={{ id: bundle.tenant.id, name: bundle.tenant.name, slug: bundle.tenant.slug }}
      settings={bundle.settings}
      customerAccountsEnabled={bundle.settings.customerAccountsEnabled}
    >
      {body}
    </Shell>
  )
}
