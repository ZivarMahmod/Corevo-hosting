'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { statusLabel } from '@/lib/admin/format'
import type { LocationRow, SlotRow, WorkingHourRow } from '@/lib/admin/data'
import { Badge, Callout, Card, Icon, type BadgeTone } from '@/components/portal/ui'
import type { MemberPermissions as PermissionValue } from '@/lib/admin/member-permissions'
import {
  RenameSection,
  PhotoSection,
  LocationSection,
  EgetKontoSection,
  DangerSection,
  type StaffCard,
  type ServiceOption,
  type LocationOption,
} from './StaffRoster'
import { StaffRolePicker } from './StaffRolePicker'
import { StaffBookability } from './StaffBookability'
import {
  ScheduleActions,
  SlotManager,
  WorkingHoursEditor,
  type WeekCol,
} from './SlotManager'
import { ScheduleLock } from './ScheduleLock'
import { TimeOffManager, type TimeOffItem } from './TimeOffManager'

// Booking-status → portal Badge tone (lyft ur StaffDrawer — samma dämpade toner).
const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  confirmed: 'info',
  completed: 'success',
  no_show: 'danger',
}
const statusTone = (status: string): BadgeTone => STATUS_TONE[status] ?? 'neutral'
const timeLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
    new Date(ts),
  )

/**
 * Personal-detaljsida — centrerad enkolumn i inställnings-skalet (SettingsWorkspace,
 * currentCategory="personal"), som Bokningsregler. Ersätter höger-drawern: samma
 * fristående form-sektioner (oförändrade server-actions), var och en i ett portal-Card,
 * plus den nya roll-väljaren högt upp. onSaved → router.refresh() (ingen drawer att stänga).
 */
export function StaffDetail({
  member,
  services,
  locations,
  tz,
  staffNoun,
  permissions,
  canManagePersonal,
  canManageStaff,
  canManageRoles,
  canManageSchedule,
  canLinkCurrentUser,
  openingHoursConfirmed,
  workingHours,
  slots,
  weekCols,
  editorLocations,
  timeOffItems,
}: {
  member: StaffCard
  services: ServiceOption[]
  locations: LocationOption[]
  tz: string
  staffNoun: string
  permissions: PermissionValue
  canManagePersonal: boolean
  canManageStaff: boolean
  canManageRoles: boolean
  canManageSchedule: boolean
  canLinkCurrentUser: boolean
  openingHoursConfirmed: boolean
  workingHours: WorkingHourRow[]
  slots: SlotRow[]
  weekCols: WeekCol[]
  editorLocations: LocationRow[]
  timeOffItems: TimeOffItem[]
}) {
  const router = useRouter()
  const refresh = () => router.refresh()
  // Efter borttagning finns denna [id] inte längre — refresh skulle notFound:a.
  const backToList = () => router.push('/admin/personal')
  const backHref = canManagePersonal
    ? '/admin/personal'
    : member.locationId
      ? `/admin/scheman?staff=${member.id}&plats=${member.locationId}`
      : '/admin/scheman'

  return (
    <section className="portal-section" style={{ maxWidth: '640px' }}>
      <Link
        href={backHref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--c-ink-2)',
          fontSize: 13,
          textDecoration: 'none',
          marginBottom: 14,
        }}
      >
        <Icon name="arrowLeft" size={15} /> Tillbaka till{' '}
        {canManagePersonal ? staffNoun.toLowerCase() : 'schemat'}
      </Link>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, letterSpacing: '-.01em' }}>
          {member.displayName}
        </h1>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <Badge tone={member.active ? 'success' : 'neutral'}>
            {member.active ? 'Aktiv' : 'Inaktiv'}
          </Badge>
          <Badge tone={member.readiness.bookable ? 'success' : 'warning'}>
            {member.readiness.label}
          </Badge>
          <Badge tone="gold" dot={false}>
            {member.serviceCount} {member.serviceCount === 1 ? 'tjänst' : 'tjänster'}
          </Badge>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Multi-place selector, also shown as a repair path for legacy staff with
            no place. With one already-selected place there is nothing to choose. */}
        {canManageRoles && locations.length > 0 && (locations.length > 1 || !member.locationId) && (
          <Card>
            <Callout tone="info" icon="mapPin">
              {member.locationName ? (
                <>
                  Den här veckan på <b>{member.locationName}</b>. Att dela en medarbetare mellan två
                  platser per vecka kommer — bokningarna får aldrig krocka.
                </>
              ) : (
                <>
                  Ingen plats är satt för den här medarbetaren. Välj en plats nedan så landar
                  bokningarna rätt.
                </>
              )}
            </Callout>
            <div style={{ marginTop: 12 }}>
              <LocationSection member={member} locations={locations} onSaved={refresh} />
            </div>
          </Card>
        )}

        {canManageStaff ? (
          <StaffBookability
            staffId={member.id}
            staffName={member.displayName}
            active={member.active}
            serviceIds={member.serviceIds}
            services={services}
            workingDays={new Set(workingHours.map((row) => row.weekday)).size}
            locationId={member.locationId ?? null}
            openingHoursConfirmed={openingHoursConfirmed}
          />
        ) : (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Bokningsbarhet
            </div>
            <Badge tone={member.readiness.bookable ? 'success' : 'warning'}>
              {member.readiness.label}
            </Badge>
            <p className="small" style={{ margin: '10px 0 0', color: 'var(--c-ink-3)' }}>
              Tjänster och aktiv status ändras av organisationsägaren.
            </p>
          </Card>
        )}

        {!canManageSchedule ? (
          <Callout tone="info" icon="lock">
            Ditt konto kan se personkortet men saknar behörighet att ändra schema och frånvaro.
          </Callout>
        ) : member.locationId && editorLocations.length === 1 ? (
          <Card>
            <section id="arbetstider" style={{ scrollMarginTop: 90 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Individuellt schema
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--c-ink-3)',
                  margin: '0 0 14px',
                  lineHeight: 1.55,
                }}
              >
                Först väljer du när {member.displayName} arbetar. Därefter kan du begränsa vilka
                exakta starttider kunder får boka. Platsens öppettider är alltid den yttre ramen.
              </p>
              <ScheduleLock hasBackup={false}>
                <WorkingHoursEditor
                  staffId={member.id}
                  staffName={member.displayName}
                  rows={workingHours}
                  locations={editorLocations}
                  defaultLocationId={member.locationId}
                />

                <div style={{ margin: '28px 0 14px' }}>
                  <span className="eyebrow" style={{ color: 'var(--c-gold-600)' }}>
                    Bokbara starttider
                  </span>
                  <h2 className="h2" style={{ margin: '6px 0 4px' }}>
                    Bokbara starttider
                  </h2>
                  <p className="small" style={{ margin: 0, color: 'var(--c-ink-3)' }}>
                    Lämna tomt för alla lediga starter inom arbetstiden, eller välj exakta tider.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <ScheduleActions staffId={member.id} />
                </div>
                <SlotManager
                  staffId={member.id}
                  staff={[{ id: member.id, displayName: member.displayName, active: member.active }]}
                  rows={slots}
                  weekCols={weekCols}
                  locations={editorLocations}
                  defaultLocationId={member.locationId}
                  showStaffSelector={false}
                />
              </ScheduleLock>
              <p style={{ margin: '14px 0 0', fontSize: 12.5 }}>
                <Link
                  href={`/admin/scheman?staff=${member.id}&plats=${member.locationId}`}
                  style={{ color: 'var(--c-forest)', fontWeight: 600 }}
                >
                  Visa hela teamets schema →
                </Link>
              </p>
            </section>
          </Card>
        ) : (
          <Callout tone="warning" icon="mapPin">
            Välj en aktiv plats innan individuella arbetstider kan redigeras.
          </Callout>
        )}

        {canManageSchedule ? (
          <section>
            <div style={{ marginBottom: 10 }}>
              <span className="eyebrow" style={{ color: 'var(--c-gold-600)' }}>
                Avvikelser
              </span>
              <h2 className="h2" style={{ margin: '6px 0 4px' }}>
                Frånvaro för {member.displayName}
              </h2>
              <p className="small" style={{ margin: 0, color: 'var(--c-ink-3)' }}>
                Semester, sjukdom och annan ledighet stänger personens tider i bokningen.
              </p>
            </div>
            <TimeOffManager
              items={timeOffItems}
              staffOptions={[{ id: member.id, name: member.displayName }]}
              staffNoun={staffNoun}
              defaultStaffId={member.id}
            />
          </section>
        ) : null}

        <Card>
          <section>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Verklig dag · idag
            </div>
            {member.today.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--c-ink-3)', margin: 0 }}>Inga bokningar idag.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {member.today.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--c-paper)',
                      border: '1px solid var(--c-line)',
                    }}
                  >
                    <span
                      className="num"
                      style={{
                        width: 48,
                        fontWeight: 700,
                        color: 'var(--c-forest)',
                        fontSize: 14,
                        flex: 'none',
                      }}
                    >
                      {timeLabel(b.startTs, tz)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.customerLabel}</div>
                      <div style={{ fontSize: 12, color: 'var(--c-ink-3)' }}>
                        {b.serviceName ?? 'Okänd tjänst'}
                      </div>
                    </div>
                    <Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Card>

        {canManageRoles ? (
          <>
            <Card>
              <RenameSection member={member} onSaved={refresh} />
            </Card>

            <Card>
              <PhotoSection member={member} onSaved={refresh} />
            </Card>

            <Card>
              <StaffRolePicker
                staffId={member.id}
                hasAccount={member.hasAccount}
                permissions={permissions}
              />
            </Card>

            <Card>
              <EgetKontoSection
                member={member}
                onInvited={refresh}
                canLinkCurrentUser={canLinkCurrentUser}
              />
            </Card>

            <Card>
              <DangerSection member={member} onDeleted={backToList} />
            </Card>
          </>
        ) : null}
      </div>
    </section>
  )
}
