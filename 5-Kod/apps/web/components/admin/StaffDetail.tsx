'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { statusLabel } from '@/lib/admin/format'
import { Badge, Callout, Card, Icon, type BadgeTone } from '@/components/portal/ui'
import type { MemberPermissions as PermissionValue } from '@/lib/admin/member-permissions'
import {
  RenameSection,
  PhotoSection,
  ServicesSection,
  LocationSection,
  EgetKontoSection,
  DangerSection,
  type StaffCard,
  type ServiceOption,
  type LocationOption,
} from './StaffRoster'
import { StaffRolePicker } from './StaffRolePicker'

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
  canManageRoles,
}: {
  member: StaffCard
  services: ServiceOption[]
  locations: LocationOption[]
  tz: string
  staffNoun: string
  permissions: PermissionValue
  canManageRoles: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()
  // Efter borttagning finns denna [id] inte längre — refresh skulle notFound:a.
  const backToList = () => router.push('/admin/personal')

  return (
    <section className="portal-section" style={{ maxWidth: '640px' }}>
      <Link
        href="/admin/personal"
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
        <Icon name="arrowLeft" size={15} /> Tillbaka till {staffNoun.toLowerCase()}
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
        <Card>
          <RenameSection member={member} onSaved={refresh} />
        </Card>

        {canManageRoles && (
          <Card>
            <StaffRolePicker
              staffId={member.id}
              hasAccount={member.hasAccount}
              permissions={permissions}
            />
          </Card>
        )}

        <Card>
          <PhotoSection member={member} onSaved={refresh} />
        </Card>

        <Card>
          <ServicesSection member={member} services={services} onSaved={refresh} />
        </Card>

        {/* Tider — bor på Schema-sidan (en sanning). Djuplänken öppnar den
            direkt på DEN HÄR medarbetaren så hoppandet försvinner. */}
        <Card>
          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Tider &amp; schema
            </div>
            <p style={{ fontSize: 13, color: 'var(--c-ink-3)', margin: '0 0 10px', lineHeight: 1.55 }}>
              Vilka tider {member.displayName} kan bokas ställs i schemat — veckoschema, arbetstider
              och frånvaro på ett ställe.
            </p>
            <Link
              href={`/admin/scheman?staff=${member.id}${member.locationId ? `&plats=${member.locationId}` : ''}#mallar`}
              style={{ color: 'var(--c-forest)', fontWeight: 600, fontSize: 13.5 }}
            >
              Öppna {member.displayName}s tider →
            </Link>
          </section>
        </Card>

        {/* Multi-place selector, also shown as a repair path for legacy staff with
            no place. With one already-selected place there is nothing to choose. */}
        {locations.length > 0 && (locations.length > 1 || !member.locationId) && (
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

        <Card>
          <EgetKontoSection member={member} onInvited={refresh} />
        </Card>

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

        <Card>
          <DangerSection member={member} onDeleted={backToList} />
        </Card>
      </div>
    </section>
  )
}
