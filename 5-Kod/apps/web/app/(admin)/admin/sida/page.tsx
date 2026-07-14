import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listDomains } from '@/lib/admin/data'
import { createClient } from '@/lib/supabase/server'
import { getAdminModuleStates, moduleAdminState } from '@/lib/admin/modules'
import { bookingModeFromState, BOOKING_MODE_COPY } from '@/lib/admin/booking-mode'
import { PageHead, Card, Badge, Button } from '@/components/portal/ui'

/** L3 C-02 — "Redigera sidan" som INGÅNG: så här ser sidan ut just nu + vad som
 *  gäller (publicerad? bokning? egen domän?) + EN knapp in i redigeraren.
 *  Redigeraren själv (SidaStudio) är ORÖRD — den flyttade bara till
 *  /admin/sida/redigera. Ingen global "publicera"-knapp som blandar drift och sida. */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Din sida · Adminpanel' }

export default async function SidaEntryPage() {
  const user = await requireAdminArea('sida')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Din sida" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const supabase = await createClient()
  const [{ data: row }, domains, moduleStates] = await Promise.all([
    supabase.from('tenants').select('status').eq('id', tenant.id).maybeSingle(),
    listDomains(tenant.id),
    getAdminModuleStates(tenant.id),
  ])

  const published = row?.status === 'active'
  const primaryDomain =
    domains.find((d) => d.is_primary && d.verified) ?? domains.find((d) => d.verified)
  const bookingMode = bookingModeFromState(
    'booking' in moduleStates ? moduleAdminState(moduleStates, 'booking') : undefined,
  )

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Din sida"
        lede="Så här ser sidan ut för dina kunder just nu."
      />

      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Förhandskortet: samma preview-rutt som redigeraren använder, nedskalad
            och inert (pointer-events: none) — det är en bild av sidan, inte en yta
            att klicka i. Knappen nedan är vägen in. */}
        <div
          style={{
            position: 'relative',
            height: 280,
            overflow: 'hidden',
            borderRadius: 12,
            border: '1px solid var(--c-line)',
            background: 'var(--c-paper-2)',
          }}
        >
          <iframe
            src={`/salong-preview/${tenant.slug}`}
            title="Förhandsvisning av din sida"
            tabIndex={-1}
            aria-hidden="true"
            style={{
              width: '1280px',
              height: '900px',
              border: 0,
              transform: 'scale(0.42)',
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Badge tone={published ? 'success' : 'warning'}>
            {published ? 'Publicerad' : 'Inte publicerad'}
          </Badge>
          <Badge
            tone={
              bookingMode === 'pa' ? 'success' : bookingMode === 'pausad' ? 'warning' : 'neutral'
            }
          >
            Bokning: {BOOKING_MODE_COPY[bookingMode].label.toLowerCase()}
          </Badge>
          <Badge tone={primaryDomain ? 'success' : 'neutral'}>
            {primaryDomain ? primaryDomain.domain : 'Ingen egen domän'}
          </Badge>
        </div>

        <div>
          <Button href="/admin/sida/redigera" icon="edit">
            Öppna redigeraren
          </Button>
        </div>
      </Card>
    </section>
  )
}
