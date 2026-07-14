import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import {
  getSettingsRow,
  listServices,
  listStaff,
  listLocations,
  listDomains,
  staffDay,
} from '@/lib/admin/data'
import { getAdminModuleStates, moduleAdminState } from '@/lib/admin/modules'
import { bookingModeFromState, BOOKING_MODE_COPY } from '@/lib/admin/booking-mode'
import { settingsCategories, type SettingsCategoryId } from '@/lib/admin/settings-map'
import { createClient } from '@/lib/supabase/server'
import { PageHead, Card, Badge, Icon, type BadgeTone } from '@/components/portal/ui'

/** L3 C-01 — Inställningar = KARTAN över de ytor som redan finns. Nio kategorier:
 *  varje kort säger VAD det är, VAD läget är just nu, och tar dig dit i ETT klick.
 *  Ingen sida flyttas hit, ingen designas om. Kategorilistan bor i
 *  lib/admin/settings-map.ts (enda sanningen — även toppnavets subnav läser den). */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Inställningar · Adminpanel' }

type Status = { text: string; tone: BadgeTone }

export default async function SettingsPage() {
  const user = await requireAdminArea('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Inställningar" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const supabase = await createClient()
  const [settings, services, staff, locations, domains, moduleStates, today, { data: tRow }] =
    await Promise.all([
      getSettingsRow(tenant.id),
      listServices(tenant.id),
      listStaff(tenant.id),
      listLocations(tenant.id),
      listDomains(tenant.id),
      getAdminModuleStates(tenant.id),
      staffDay(tenant.id, new Date().getDay()),
      supabase
        .from('tenants')
        .select('status, stripe_charges_enabled')
        .eq('id', tenant.id)
        .maybeSingle(),
    ])

  const sjson = (settings?.settings ?? {}) as {
    contact?: { email?: string | null; phone?: string | null }
  }
  const contactDone = Boolean(sjson.contact?.email?.trim() || sjson.contact?.phone?.trim())
  const activeServices = services.filter((s) => s.active).length
  const activeStaff = staff.filter((s) => s.active).length
  const withHoursToday = today.filter((s) => s.start && s.end).length
  const bookingMode = bookingModeFromState(
    'booking' in moduleStates ? moduleAdminState(moduleStates, 'booking') : undefined,
  )
  const verifiedDomain = domains.some((d) => d.verified)
  const chargesOn = tRow?.stripe_charges_enabled === true
  const published = tRow?.status === 'active'

  // Status = verkligheten, aldrig en gissning. Saknas något visas det som saknas.
  const status: Record<SettingsCategoryId, Status> = {
    foretag: contactDone
      ? { text: 'Ifyllt', tone: 'success' }
      : { text: 'Kontaktuppgifter saknas', tone: 'warning' },
    bokning: {
      text: BOOKING_MODE_COPY[bookingMode].label,
      tone: bookingMode === 'pa' ? 'success' : bookingMode === 'pausad' ? 'warning' : 'neutral',
    },
    tjanster: activeServices
      ? { text: `${activeServices} aktiva`, tone: 'neutral' }
      : { text: 'Inga än', tone: 'warning' },
    personal: activeStaff
      ? { text: `${activeStaff} aktiva`, tone: 'neutral' }
      : { text: 'Ingen än', tone: 'warning' },
    scheman: withHoursToday
      ? { text: `${withHoursToday} arbetar idag`, tone: 'neutral' }
      : { text: 'Ingen arbetstid idag', tone: 'warning' },
    platser: locations.length
      ? {
          text: `${locations.length} ${locations.length === 1 ? 'plats' : 'platser'}`,
          tone: 'neutral',
        }
      : { text: 'Ingen än', tone: 'warning' },
    sida: published
      ? {
          text: verifiedDomain ? 'Publicerad · egen domän' : 'Publicerad',
          tone: 'success',
        }
      : { text: 'Inte publicerad', tone: 'warning' },
    betalning: chargesOn
      ? {
          text: settings?.payments_enabled ? 'Betalning vid bokning' : 'Stripe kopplat',
          tone: 'success',
        }
      : { text: 'Stripe inte kopplat', tone: 'neutral' },
    konto: { text: user.email ?? 'Inloggad', tone: 'neutral' },
  }

  const categories = settingsCategories(tenant.terminology)

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Inställningar"
        lede="Allt som styr ditt företag — ett hem per sak."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <Card
              style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', height: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <Icon name={c.icon} size={18} />
                <h2 className="h3" style={{ margin: 0, flex: 1 }}>
                  {c.label}
                </h2>
                <Icon name="chevronRight" size={16} />
              </div>
              <span>
                <Badge tone={status[c.id].tone}>{status[c.id].text}</Badge>
              </span>
              <p className="body" style={{ margin: 0, color: 'var(--c-ink-2)' }}>
                {c.hint}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
