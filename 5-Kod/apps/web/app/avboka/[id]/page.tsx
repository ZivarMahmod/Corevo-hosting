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
import '../../ticket.css'

// Public guest self-service cancel page (NOTIF-GUEST). Authorisation = the HMAC
// capability token in `?t=` (no login). We verify it FIRST; only then do we read
// the booking via service-role (RLS bypass is justified by the unguessable token).
// Exposed data is the same safe summary the confirmation page shows — salong,
// tjänst, tid — no other PII, and never another booking.
//
// Chrome: app/avboka/ has no layout (one isn't in revir to create), so this page
// renders the full salon shell itself — mirroring app/boka/layout.tsx (currentTenant
// + injectTenantTokens + Nav/Footer) so a shared/refreshed link is never stripped.
//
// Look: biljett/stub-systemet ur design-paketet (README §Avboka) — mono-eyebrow,
// display-H1, stub med dashed rader, utfallstexter. Stilar i app/ticket.css.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Avboka tid' }

type DoneCode = 'ok' | 'already' | 'too_late' | 'error'
type Outcome = 'ready' | 'done' | 'already' | 'too_late' | 'error'

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
    <section className="tkt-scope tkt-section">
      <div className="tkt-eyebrow">Din bokning</div>
      <h1 className="tkt-h1">{title}</h1>
      <p className="tkt-state">{body}</p>
      <div className="tkt-home">
        <Link href="/" className="tkt-homelink">
          Till startsidan
        </Link>
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

  // 2. Token valid → read the booking via service-role (token is the capability).
  //    Läses även för post-action-utfallen (?done=) så stubben (Salong/Tjänst/Tid/Hos)
  //    kan visas i ALLA utfall per designen — samma token-gatade läsning som ready.
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
  const start = new Date(booking.start_ts)
  const longDate = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'full', timeZone: tz }).format(start)
  const time = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(start)

  // Utfall (samma serverbeteenden som innan — bara mappade till designens states):
  //   ?done=ok → done · ?done=already → already · ?done=too_late → too-late ·
  //   ?done=<annat> → error · annars: redan avbokad → already · inom fönstret →
  //   ready · utanför fönstret → too-late.
  const alreadyCancelled = booking.status === 'cancelled'
  let outcome: Outcome
  let cutoff = 0
  if (done) {
    const code = done as DoneCode
    outcome = code === 'ok' ? 'done' : code === 'already' ? 'already' : code === 'too_late' ? 'too_late' : 'error'
  } else if (alreadyCancelled) {
    outcome = 'already'
  } else {
    cutoff = await getCancellationCutoffHours(admin, booking.tenant_id)
    outcome = withinCancellationWindow(booking.start_ts, cutoff) ? 'ready' : 'too_late'
  }

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
    <section className="tkt-scope tkt-section">
      <div className="tkt-eyebrow">Din bokning</div>
      <h1 className="tkt-h1">Avboka din tid</h1>

      {/* Stubben: Salong / Tjänst / Tid / Hos med 1px dashed dividers */}
      <div className="tkt-stub">
        <div className="tkt-row">
          <span className="tkt-row-label">Salong</span>
          <span className="tkt-row-value">{tenantName}</span>
        </div>
        <div className="tkt-row">
          <span className="tkt-row-label">Tjänst</span>
          <span className="tkt-row-value">{serviceName}</span>
        </div>
        <div className="tkt-row">
          <span className="tkt-row-label">Tid</span>
          <span className="tkt-row-value">
            {longDate} · kl. {time}
          </span>
        </div>
        {staffTitle ? (
          <div className="tkt-row">
            <span className="tkt-row-label">Hos</span>
            <span className="tkt-row-value">{staffTitle}</span>
          </div>
        ) : null}
      </div>

      {outcome === 'ready' ? (
        <>
          <p className="tkt-note">
            Vill du avboka?{cutoff > 0 ? ` Du kan avboka senast ${cutoff} timmar innan besöket.` : null}
          </p>
          <form action={submitCancel}>
            <button type="submit" className="tkt-btn-accent">
              Avboka tid
            </button>
          </form>
        </>
      ) : outcome === 'done' ? (
        <div className="tkt-done" role="status">
          <div className="tkt-done-mark">✓ AVBOKAD</div>
          <p className="tkt-state">Din tid är avbokad. Varmt välkommen åter när det passar dig!</p>
        </div>
      ) : outcome === 'already' ? (
        <p className="tkt-state">Den här tiden är redan avbokad.</p>
      ) : outcome === 'too_late' ? (
        <p className="tkt-state">Det är för sent att avboka online — ring oss så hjälper vi dig.</p>
      ) : (
        <p className="tkt-state" role="alert">
          Vi kunde inte avboka just nu. Försök igen eller kontakta salongen.
        </p>
      )}

      <div className="tkt-home">
        <Link href="/" className="tkt-homelink">
          Till startsidan
        </Link>
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
