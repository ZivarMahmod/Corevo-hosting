import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow, listServices, listStaff, listLocations, staffDay } from '@/lib/admin/data'
import { getAdminModuleStates, moduleAdminState } from '@/lib/admin/modules'
import { bookingModeFromState, BOOKING_MODE_COPY } from '@/lib/admin/booking-mode'
import { settingsCategories, type SettingsCategoryId } from '@/lib/admin/settings-map'
import { createClient } from '@/lib/supabase/server'
import { todayInTz } from '@/lib/admin/dates'
import { weekdayOf } from '@/lib/booking/tz'
import { SettingsV2, type SettingsV2Status } from '@/components/admin/SettingsV2'
import { MemberPermissions } from '@/components/admin/MemberPermissions'
import {
  DEFAULT_MEMBER_PERMISSIONS,
  listTenantMemberPermissions,
} from '@/lib/admin/member-permissions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Inställningar · Adminpanel' }

const VALID_CATEGORIES = new Set<SettingsCategoryId>([
  'tjanster', 'personal', 'scheman', 'platser', 'bokningsregler', 'bokningsflode',
  'betalning', 'paminnelser', 'integrationer', 'roller', 'konto', 'sekretess',
])

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>
}) {
  const user = await requireAdminArea('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <p className="prose">Inget företag är kopplat till ditt konto.</p>

  const supabase = await createClient()
  const [settings, services, staff, locations, moduleStates, today, tenantResult, memberPermissions] = await Promise.all([
    getSettingsRow(tenant.id),
    listServices(tenant.id),
    listStaff(tenant.id),
    listLocations(tenant.id),
    getAdminModuleStates(tenant.id),
    staffDay(tenant.id, weekdayOf(todayInTz(tenant.timeZone))),
    supabase.from('tenants').select('status, stripe_charges_enabled').eq('id', tenant.id).maybeSingle(),
    listTenantMemberPermissions(tenant.id),
  ])

  const settingsJson = (settings?.settings ?? {}) as {
    notifications?: { confirmation?: boolean; reminder?: boolean; review?: boolean }
    google_review_url?: string | null
  }
  const activeServices = services.filter((service) => service.active).length
  const activeStaff = staff.filter((member) => member.active).length
  const activeAccounts = staff.filter((member) => member.active && member.profile_id).length
  const withHoursToday = today.filter((member) => member.start && member.end).length
  const bookingMode = bookingModeFromState(
    'booking' in moduleStates ? moduleAdminState(moduleStates, 'booking') : undefined,
  )
  const chargesOn = tenantResult.data?.stripe_charges_enabled === true
  const published = tenantResult.data?.status === 'active'
  const remindersOn = settingsJson.notifications?.reminder !== false

  const statuses: Record<SettingsCategoryId, SettingsV2Status> = {
    tjanster: activeServices
      ? { label: `${activeServices} aktiva`, tone: 'neutral' }
      : { label: 'Inga aktiva', tone: 'warning' },
    personal: activeStaff
      ? { label: `${activeStaff} aktiva`, tone: 'neutral' }
      : { label: 'Ingen aktiv', tone: 'warning' },
    scheman: withHoursToday
      ? { label: `${withHoursToday} arbetar idag`, tone: 'neutral' }
      : { label: 'Ingen arbetstid idag', tone: 'warning' },
    platser: locations.length
      ? { label: `${locations.length} ${locations.length === 1 ? 'plats' : 'platser'}`, tone: 'neutral' }
      : { label: 'Ingen plats', tone: 'warning' },
    bokningsregler: {
      label: BOOKING_MODE_COPY[bookingMode].label,
      tone: bookingMode === 'pa' ? 'success' : bookingMode === 'pausad' ? 'warning' : 'neutral',
    },
    bokningsflode: published
      ? { label: 'Publicerat', tone: 'success' }
      : { label: 'Inte publicerat', tone: 'warning' },
    betalning: chargesOn
      ? { label: settings?.payments_enabled ? 'PÅ' : 'AKTIVT', tone: 'success' }
      : { label: 'Inte kopplat', tone: 'neutral' },
    paminnelser: remindersOn
      ? { label: 'PÅ', tone: 'success' }
      : { label: 'Kontrollera', tone: 'warning' },
    integrationer: settingsJson.google_review_url?.trim()
      ? { label: 'KOPPLAD', tone: 'success' }
      : { label: 'Inte kopplad', tone: 'neutral' },
    roller: { label: `${activeAccounts} personliga konton`, tone: 'neutral' },
    konto: { label: user.email ?? 'Inloggad', tone: 'neutral' },
    sekretess: { label: 'AKTIVT', tone: 'success' },
  }

  const params = await searchParams
  const requested = params.kategori as SettingsCategoryId | undefined
  const initialCategory = requested && VALID_CATEGORIES.has(requested) ? requested : 'roller'

  return (
    <SettingsV2
      categories={settingsCategories(tenant.terminology)}
      statuses={statuses}
      initialCategory={initialCategory}
      rolesContent={
        <MemberPermissions
          ownerEmail={user.email ?? 'Ägare'}
          members={staff.filter((member) => member.active).map((member) => ({
            id: member.id,
            name: member.displayName,
            subtitle: member.location_id ? 'Kopplad till plats' : 'Alla platser',
            hasAccount: Boolean(member.profile_id),
            permissions: memberPermissions.get(member.id) ?? DEFAULT_MEMBER_PERMISSIONS,
          }))}
        />
      }
    />
  )
}
