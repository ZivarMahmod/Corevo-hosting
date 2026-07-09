import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { termPlural } from '@/lib/platform/verticals-shared'
import { listStaff, listLocations } from '@/lib/admin/data'
import { buildWeekBoard } from '@/lib/admin/schedule-board'
import { addDays } from '@/lib/personal/format'
import { ScheduleWeekBoard } from '@/components/admin/ScheduleWeekBoard'
import { KioskAutoRefresh } from '@/components/admin/KioskAutoRefresh'
import { Icon } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Schemavy · Salongsadmin' }

/**
 * SCHEMAVY — helskärms-kiosken (Zivar 2026-07-10: "en knapp som är schema-vy och
 * den ska endast visa schemat och en bläddra-knapp — öppna på en iPad och hålla
 * sig där under dagen"). Bara vecko-brädan + bläddring: admin-chromet (sidomeny,
 * topbar, mobilbar) göms via .portal-shell:has(.schedule-kiosk) i portal-global.css
 * (samma mönster som onboarding-host). Datat delas med /admin/scheman via
 * buildWeekBoard och hämtas om varannan minut (KioskAutoRefresh) så bokningsantal
 * och frånvaro aldrig står gamla. Läs-läge: raderna länkar inte till mallarna.
 */
export default async function ScheduleKioskPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; plats?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Schemavy</h1>
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const staff = await listStaff(tenant.id)
  const allLocations = await listLocations(tenant.id)
  const locations = allLocations.filter((l) => l.active).map((l) => ({ id: l.id, name: l.name }))

  const board = await buildWeekBoard({
    tenantId: tenant.id,
    timeZone: tenant.timeZone,
    staff,
    locations,
    week: sp.week,
    plats: sp.plats,
  })

  return (
    <section className="schedule-kiosk">
      <KioskAutoRefresh seconds={120} />

      {/* Kiosk-huvud: salong + diskret väg tillbaka till admin */}
      <div className="schedule-kiosk-head">
        <span className="schedule-kiosk-brand">{tenant.name}</span>
        <Link href="/admin/scheman" className="schedule-kiosk-back">
          <Icon name="chevronLeft" size={14} />
          Till admin
        </Link>
      </div>

      <ScheduleWeekBoard
        weekLabel={board.weekLabel}
        isCurrentWeek={board.isCurrentWeek}
        days={board.days}
        rows={board.rows}
        prevWeek={addDays(board.weekMonday, -7)}
        nextWeek={addDays(board.weekMonday, 7)}
        todayWeek={board.currentMonday}
        selectedStaffId=""
        plats={board.plats}
        locations={board.multiLoc ? locations : []}
        staffNoun={termPlural(tenant.terminology, 'staff', 'Personal')}
        basePath="/admin/scheman/vy"
        readOnly
      />
    </section>
  )
}
