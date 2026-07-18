'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  inviteStaff,
  createStaff,
  updateStaff,
  toggleStaffActive,
  deleteStaff,
  setStaffServices,
  type ActionState,
} from '@/lib/admin/actions'
import { statusLabel } from '@/lib/admin/format'
import { STAFF_PALETTE, staffColor } from '@/lib/admin/staff-colors'
import { matchingBookableServices, type StaffReadiness } from '@/lib/admin/staff-readiness'
import {
  Badge,
  Button,
  Callout,
  Card,
  Drawer,
  Icon,
  useToast,
  type BadgeTone,
} from '@/components/portal/ui'

/** One booking row in a staff member's "Verklig dag · idag" list. Shaped by the
 *  server page from getStaffScheduleWithNotes — real data, never PII. */
export type StaffDayRow = {
  id: string
  startTs: string
  status: string
  serviceName: string | null
  customerLabel: string
}

/** The set of tjänster the salon offers, for the per-staff service-coupling form
 *  inside the Drawer (setStaffServices). Mirrors ServiceRow's used fields. */
export type ServiceOption = {
  id: string
  name: string
  active: boolean
  locationId: string | null
}

/** ACTIVE locations, for the Drawer's plats-select (updateStaff → staff.location_id).
 *  The select renders for several places and as a repair path when a legacy member
 *  has no place even though the tenant has one. */
export type LocationOption = { id: string; name: string }

/** Per-staff display bundle the server page hands down. `locationName` is resolved
 *  from the locations table (location_id → name); null when the staff row has no
 *  pinned location. `hasAccount` = staff.profile_id != null (eget konto). `today`
 *  is that staff member's real bookings for today (cancelled already excluded).
 *  `serviceNames` are the names of the services this member performs (staff_services
 *  → services.name) — these are the mock's specialty chips, bound to live data.
 *  `serviceIds` backs the Drawer's coupling checkboxes (which are pre-checked). */
export type StaffCard = {
  id: string
  displayName: string
  title: string | null
  active: boolean
  bookingCount: number
  serviceCount: number
  serviceIds: string[]
  serviceNames: string[]
  hasAccount: boolean
  locationName: string | null
  /** Raw staff.location_id — backs the Drawer's plats-select default. Optional so
   *  callers without multi-plats wiring keep compiling; null = ingen plats satt. */
  locationId?: string | null
  readiness: StaffReadiness
  /** Foto på publika sajten (staff.avatar_url, 0049) — null = initial-avatar här
   *  och standard-silhuett på sidan. Optional så äldre callers kompilerar. */
  avatarUrl?: string | null
  /** Syns i publika team-sektionen (staff.show_on_site, 0049) — styr ENDAST
   *  "Våra barberare" på sidan; bokningsbarheten är `active` som förut. */
  showOnSite?: boolean
  /** goal-67: vald kalenderfärg (staff.color, hex) — null = ingen vald, kalendern
   *  härleder då en färg ur id:t. Optional så äldre callers kompilerar. */
  color?: string | null
  today: StaffDayRow[]
}

const initialOf = (name: string): string => name.trim()[0]?.toUpperCase() ?? '?'

// Status → portal Badge tone. The primitive's bg tokens are muted tints with the
// tone carried in the dot (§6: status muted on *-bg, dark ink, tone in the dot —
// never saturated red/green panel fill).
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

// How many specialty chips a card shows before collapsing the rest into "+N fler"
// (FreshCut staff can carry 7 services — the mock cards show ~3 dense chips).
const CHIP_CAP = 3

/**
 * Personal-admin roster island (SalonStaff §3.4) — the client surface over the
 * server-fetched staff. A clean ROSTER: the PageHead's "+ Lägg till" opens a
 * create Drawer; below it a forest-avatar card grid (auto-fill 300) of RICH
 * profile cards — avatar + name + role line + the member's services as chips (real
 * staff_services data) + a muted Aktiv/Inaktiv pill + a location · idag footer.
 *
 * Clicking a card opens a shared Drawer that holds ALL the per-staff editing that
 * previously lived in the StaffManager list (now folded in here, never dropped):
 *   • rename (updateStaff)         • activate/deactivate (toggleStaffActive)
 *   • delete (deleteStaff)         • couple services (setStaffServices)
 *   • eget-konto magic-link invite (inviteStaff) for un-linked staff
 * plus the multi-location reminder and the staff member's real "Verklig dag · idag".
 *
 * No fabricated profile fields: the chips bind to the real coupled services.
 */
export function StaffRoster({
  staff,
  services,
  tz,
  staffNoun = 'Medarbetare',
  locations = [],
}: {
  staff: StaffCard[]
  services: ServiceOption[]
  tz: string
  /** Bransch-resolved SINGULAR staff noun (e.g. 'Stylist' for frisör, 'Barberare'
   *  for barbershop). Resolved server-side from the tenant's vertical terminology;
   *  defaults to 'Medarbetare' so any caller without it keeps today's wording. */
  staffNoun?: string
  /** ACTIVE locations — feeds the Drawer's plats-select. Defaults to [] so the
   *  section (and the multi-plats Callout) simply doesn't render when unwired. */
  locations?: LocationOption[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = staff.find((s) => s.id === selectedId) ?? null

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {staff.map((s) => (
          <StaffGridCard
            key={s.id}
            member={s}
            staffNoun={staffNoun}
            onOpen={() => setSelectedId(s.id)}
          />
        ))}
      </div>

      {selected && (
        <StaffDrawer
          member={selected}
          services={services}
          locations={locations}
          tz={tz}
          staffNoun={staffNoun}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  )
}

/**
 * The "+ Lägg till" head action (mock L19) — a client island the server page drops
 * into the PageHead children slot so it sits top-right beside the H1. It owns the
 * create Drawer (createStaff + invite-with-title), keeping the onClick out of the
 * async server page.
 */
export function AddStaffButton({
  locations,
  defaultLocationId,
}: {
  locations: LocationOption[]
  defaultLocationId: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
        Lägg till
      </Button>
      {open && (
        <AddStaffDrawer
          locations={locations}
          defaultLocationId={defaultLocationId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function StaffGridCard({
  member,
  staffNoun,
  onOpen,
}: {
  member: StaffCard
  staffNoun: string
  onOpen: () => void
}) {
  const todayCount = member.today.length
  const chips = member.serviceNames.slice(0, CHIP_CAP)
  const extra = member.serviceNames.length - chips.length

  return (
    <Card>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Öppna ${member.displayName}`}
        style={{
          all: 'unset',
          display: 'block',
          width: '100%',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        {/* Header — avatar (riktigt foto när staff.avatar_url finns, annars initial) +
            name + role line + eget-konto pill (mock L27-31). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt=""
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                objectFit: 'cover',
                flex: 'none',
              }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: 'var(--c-forest)',
                color: 'var(--c-on-forest)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 600,
                fontSize: 18,
                flex: 'none',
              }}
            >
              {initialOf(member.displayName)}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.displayName}
            </div>
            {/* Mock shows s.role here; the schema has no separate role field (staff
                carries only `title`, which IS the displayName), so a role line would
                duplicate the name — show the bransch role descriptor instead
                (staffNoun: 'Stylist'/'Barberare'/… per vertical, else 'Medarbetare'). */}
            <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>{staffNoun}</div>
          </div>
          <Badge tone={member.hasAccount ? 'success' : 'neutral'} dot={false}>
            {member.hasAccount ? 'Eget konto' : 'Hanteras här'}
          </Badge>
        </div>

        <div style={{ marginTop: 12 }}>
          <Badge tone={member.readiness.bookable ? 'success' : 'warning'}>
            {member.readiness.label}
          </Badge>
        </div>

        {/* Specialty chips = the member's coupled services (real staff_services
            data). Absent → a calm one-liner instead of an empty row. */}
        {chips.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {chips.map((name) => (
              <span
                key={name}
                title={name}
                style={{
                  fontSize: 12,
                  background: 'var(--c-paper-2)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  color: 'var(--c-ink-2)',
                  // Cap long live service names so the inline pill rhythm survives —
                  // ellipsis instead of a chip that wraps the whole row.
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </span>
            ))}
            {extra > 0 && (
              <span
                style={{
                  fontSize: 12,
                  background: 'var(--c-paper-2)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  color: 'var(--c-ink-3)',
                }}
              >
                +{extra} fler
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 12 }}>
            Inga tjänster kopplade ännu.
          </div>
        )}

        {/* Footer hairline — location + idag-count (mock L34-37: exactly one chip
            per card, the top-right account-status pill; NO second footer pill). The
            mock's "v.week" is omitted (no week field). Active/inactive isn't lost:
            the card dims (opacity 0.62) when inactive and the Drawer carries the
            full Aktiv/Inaktiv badge + toggle. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--c-line)',
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: 'var(--c-ink-3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <Icon name="mapPin" size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.locationName ?? 'Plats ej satt'}
            </span>
          </span>
          <span
            className="num"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-forest)', flex: 'none' }}
          >
            {todayCount} idag
          </span>
        </div>
      </button>
    </Card>
  )
}

function StaffDrawer({
  member,
  services,
  locations,
  tz,
  staffNoun,
  onClose,
}: {
  member: StaffCard
  services: ServiceOption[]
  locations: LocationOption[]
  tz: string
  staffNoun: string
  onClose: () => void
}) {
  return (
    <Drawer
      title={member.displayName}
      sub={member.hasAccount ? 'Eget konto · egen vy' : 'Personalinställningar'}
      accent={
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
      }
      onClose={onClose}
      ariaLabel={`${staffNoun} ${member.displayName}`}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        {/* Namn — the real updateStaff edit (was inline in the StaffManager
            list, now folded into the Drawer; same server action). */}
        <RenameSection member={member} onSaved={onClose} />

        {/* Foto + synlighet på publika sidan (staff.avatar_url/show_on_site, 0049) —
            samma updateStaff-partialpatch; speglar Sida-ytans StaffTeamCard så det
            går att sköta från båda ytorna. */}
        <PhotoSection member={member} onSaved={onClose} />

        {/* Tjänster (specialiteter) — the real setStaffServices coupling. These ARE
            the card chips; couple/uncouple drives bookability on the public sajt. */}
        <ServicesSection member={member} services={services} onSaved={onClose} />

        {/* Tider — bor på Schema-sidan (en sanning). Djuplänken öppnar den
            direkt på DEN HÄR medarbetaren så hoppandet försvinner. */}
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

        <EgetKontoSection member={member} onInvited={onClose} />

        {/* Multi-place selector, also shown as a repair path for legacy staff with
            no place. With one already-selected place there is nothing to choose. */}
        {locations.length > 0 && (locations.length > 1 || !member.locationId) && (
          <>
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
            <LocationSection member={member} locations={locations} onSaved={onClose} />
          </>
        )}

        {/* Verklig dag · idag — that staff member's REAL bookings today
            (getStaffScheduleWithNotes, cancelled excluded server-side). */}
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

        {/* Ta bort visas bara för en felaktigt skapad rad utan bokningshistorik.
            Personal med historik bevaras och inaktiveras i stället. */}
        <DangerSection member={member} onDeleted={onClose} />
      </div>
    </Drawer>
  )
}

/** Namn edit + activate/deactivate (updateStaff + toggleStaffActive). Two
 *  real server actions folded out of the old StaffManager list, restyled to the
 *  Drawer grammar. Each fires one Swedish consequence toast + router.refresh(). */
function RenameSection({ member, onSaved }: { member: StaffCard; onSaved: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [nameState, nameAction, namePending] = useActionState<ActionState, FormData>(updateStaff, {})
  const [actState, actAction, actPending] = useActionState<ActionState, FormData>(
    toggleStaffActive,
    {},
  )
  const [name, setName] = useState(member.title ?? '')
  const nameDirty = name.trim() !== (member.title ?? '').trim()

  useEffect(() => {
    if (nameState.success) {
      notify('Sparat', 'success')
      router.refresh()
      onSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameState.success])

  useEffect(() => {
    if (actState.success) {
      notify(member.active ? 'Medarbetaren inaktiverad' : 'Medarbetaren aktiverad', 'info')
      router.refresh()
      onSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actState.success])

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Namn
      </div>
      <form action={nameAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="hidden" name="id" value={member.id} />
        <input
          name="title"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Namn"
          style={fieldStyle}
        />
        <Button
          variant="subtle"
          type="submit"
          icon="check"
          size="sm"
          disabled={namePending || !nameDirty}
        >
          {namePending ? 'Sparar…' : 'Spara'}
        </Button>
      </form>
      {nameState.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {nameState.error}
        </p>
      )}

      <ColorPicker member={member} onSaved={onSaved} />

      <form action={actAction} style={{ marginTop: 10 }}>
        <input type="hidden" name="id" value={member.id} />
        <input type="hidden" name="active" value={String(!member.active)} />
        <Button
          variant="ghost"
          type="submit"
          icon={member.active ? 'pause' : 'check'}
          size="sm"
          disabled={actPending}
        >
          {actPending ? '…' : member.active ? 'Inaktivera' : 'Aktivera'}
        </Button>
      </form>
      <p style={{ fontSize: 12, color: 'var(--c-ink-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
        Inaktiv personal döljs på den publika sajten och går inte att boka.
      </p>
    </section>
  )
}

/** goal-67 — KALENDERFÄRGEN. Tolv rutor, ETT klick = sparat: ingen färgdialog, ingen
 *  "Spara"-knapp, inget mellansteg. Paletten är Okabe–Ito (färgblindsäker); färgen är
 *  aldrig ensam bärare i kalendern (namn står i kortet, status har ikon + text).
 *  Ingen vald färg → kalendern härleder en ur id:t, så rutnätet är färgkodat ändå. */
function ColorPicker({ member, onSaved }: { member: StaffCard; onSaved: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, action, pending] = useActionState<ActionState, FormData>(updateStaff, {})
  const current = staffColor(member.id, member.color)
  const automatic = member.color == null

  useEffect(() => {
    if (state.success) {
      notify('Färgen sparad', 'success')
      router.refresh()
      onSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <section style={{ marginTop: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Färg i kalendern
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          color: 'var(--c-ink-2)',
          fontSize: 12.5,
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 14, height: 14, borderRadius: 4, background: current, flex: 'none' }}
        />
        {automatic ? 'Automatisk' : 'Vald färg'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STAFF_PALETTE.map((c) => {
          const chosen = !automatic && c.toLowerCase() === current.toLowerCase()
          return (
            <form key={c} action={action}>
              <input type="hidden" name="id" value={member.id} />
              <input type="hidden" name="color" value={c} />
              <button
                type="submit"
                disabled={pending || chosen}
                aria-label={`Välj färg ${c}`}
                aria-pressed={chosen}
                title={c}
                style={{
                  width: 44,
                  height: 44,
                  padding: 0,
                  borderRadius: 8,
                  background: c,
                  // Vald färg bärs av en ring + bock, inte av färgen ensam — annars är
                  // "vilken är vald?" osynlig för en färgblind användare.
                  border: chosen ? '2px solid var(--c-ink)' : '1px solid var(--c-line)',
                  boxShadow: chosen ? '0 0 0 2px var(--c-paper) inset' : 'none',
                  cursor: pending ? 'wait' : chosen ? 'default' : 'pointer',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {chosen ? '✓' : ''}
              </button>
            </form>
          )
        })}
      </div>
      {state.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {state.error}
        </p>
      )}
    </section>
  )
}

/** Foto + synlighet på publika sidan (0049). Tre små formulär mot samma
 *  updateStaff-partialpatch: `avatar` (fil → R2 → staff.avatar_url),
 *  `remove_avatar` (→ null = standard-silhuett på sidan) och `show_on_site`
 *  (visa/dölj i "Våra barberare" — rör ALDRIG bokningsbarheten/`active`). */
function PhotoSection({ member, onSaved }: { member: StaffCard; onSaved: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const showOnSite = member.showOnSite ?? true
  const [photoState, photoAction, photoPending] = useActionState<ActionState, FormData>(
    updateStaff,
    {},
  )
  const [visState, visAction, visPending] = useActionState<ActionState, FormData>(updateStaff, {})

  useEffect(() => {
    if (photoState.success) {
      notify(
        member.active && showOnSite
          ? 'Fotoändringen sparades — den synliga teamprofilen uppdateras'
          : 'Fotoändringen sparades — profilen är inte publicerad',
        'success',
      )
      router.refresh()
      onSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoState.success])

  useEffect(() => {
    if (visState.success) {
      notify(
        showOnSite
          ? 'Medarbetaren döljs från sidan (fortfarande bokningsbar)'
          : 'Medarbetaren visas på sidan',
        'info',
      )
      router.refresh()
      onSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visState.success])

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Foto &amp; synlighet på sidan
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl}
            alt={member.displayName}
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              objectFit: 'cover',
              border: '1px solid var(--c-line)',
              flex: 'none',
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              border: '1px solid var(--c-line)',
              background: 'var(--c-paper-2)',
              color: 'var(--c-forest)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 22,
              flex: 'none',
            }}
          >
            {initialOf(member.displayName)}
          </span>
        )}
        <div style={{ flex: '1 1 14rem', display: 'grid', gap: 8 }}>
          <form action={photoAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="hidden" name="id" value={member.id} />
            <input
              type="file"
              name="avatar"
              accept="image/*"
              required
              aria-label="Foto för publika sidan"
              style={{ ...fieldStyle, flex: '1 1 12rem' }}
            />
            <Button variant="subtle" type="submit" icon="check" size="sm" disabled={photoPending}>
              {photoPending ? 'Sparar…' : member.avatarUrl ? 'Byt foto' : 'Spara foto'}
            </Button>
          </form>
          {member.avatarUrl ? (
            <form action={photoAction}>
              <input type="hidden" name="id" value={member.id} />
              <input type="hidden" name="remove_avatar" value="true" />
              <Button variant="ghost" type="submit" icon="trash" size="sm" disabled={photoPending}>
                Ta bort foto
              </Button>
            </form>
          ) : null}
          <form action={visAction}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="show_on_site" value={String(!showOnSite)} />
            <Button
              variant="ghost"
              type="submit"
              icon={showOnSite ? 'pause' : 'check'}
              size="sm"
              disabled={visPending}
            >
              {visPending ? '…' : showOnSite ? 'Dölj från sidan' : 'Visa på sidan'}
            </Button>
          </form>
        </div>
      </div>
      {photoState.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {photoState.error}
        </p>
      )}
      {visState.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {visState.error}
        </p>
      )}
      <p style={{ fontSize: 12, color: 'var(--c-ink-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
        {member.active && showOnSite
          ? 'Profilen visas i team-sektionen. Utan foto visas en standard-silhuett.'
          : 'Fotoändringen är sparad, men profilen visas inte så länge medarbetaren är inaktiv eller dold från sidan.'}
        {' '}{showOnSite ? 'Synlighetsreglaget är på.' : 'Medarbetaren är dold på sidan men kan fortfarande vara bokningsbar.'}
      </p>
    </section>
  )
}

/** Tjänster-coupling (setStaffServices) — the real checkbox set, restyled. These
 *  are the card's chips; the set drives bookability (aktiv + ≥1 tjänst). */
function ServicesSection({
  member,
  services,
  onSaved,
}: {
  member: StaffCard
  services: ServiceOption[]
  onSaved: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setStaffServices, {})
  const availableServices = matchingBookableServices(member.locationId ?? null, services)

  useEffect(() => {
    if (state.success) {
      notify('Tjänster kopplade', 'success')
      router.refresh()
      onSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Tjänster
      </div>
      {availableServices.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--c-ink-3)', margin: 0, lineHeight: 1.55 }}>
          {!member.locationId ? (
            'Välj plats innan du kopplar tjänster.'
          ) : (
            <>
              Inga aktiva tjänster finns för den valda platsen —{' '}
              <Link href="/admin/tjanster" style={{ color: 'var(--c-forest)', fontWeight: 600 }}>
                hantera tjänster
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="staff_id" value={member.id} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {availableServices.map((svc) => (
              <label
                key={svc.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 13,
                  color: 'var(--c-ink)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  name="service_id"
                  value={svc.id}
                  defaultChecked={member.serviceIds.includes(svc.id)}
                  style={{ accentColor: 'var(--c-forest)' }}
                />
                {svc.name}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Button variant="subtle" type="submit" icon="check" size="sm" disabled={pending}>
              {pending ? 'Sparar…' : 'Spara tjänster'}
            </Button>
          </div>
          {state.error && (
            <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  )
}

/** Plats-select (updateStaff → staff.location_id) — renders only when the tenant
 *  has >1 aktiv plats (see the Drawer's multi-location block). Posts ONLY id +
 *  location_id: updateStaff patches per-field, so the namn-form's title is never
 *  blanked. '' = ingen plats (location_id → null). Server-side the plats is
 *  verified to belong to the tenant before the pin is written. */
function LocationSection({
  member,
  locations,
  onSaved,
}: {
  member: StaffCard
  locations: LocationOption[]
  onSaved: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateStaff, {})
  const [locationId, setLocationId] = useState(member.locationId ?? '')
  const locationDirty = locationId !== (member.locationId ?? '')

  useEffect(() => {
    if (state.success) {
      notify('Plats sparad — bokningarna landar rätt', 'success')
      router.refresh()
      onSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Plats
      </div>
      <form action={formAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="hidden" name="id" value={member.id} />
        <select
          name="location_id"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          aria-label="Plats"
          style={{ ...fieldStyle, flex: '1 1 12rem' }}
        >
          <option value="">Ingen plats</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <Button
          variant="subtle"
          type="submit"
          icon="check"
          size="sm"
          disabled={pending || !locationDirty}
        >
          {pending ? 'Sparar…' : 'Spara plats'}
        </Button>
      </form>
      {state.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {state.error}
        </p>
      )}
    </section>
  )
}

/** Delete a staff member only when the DB-backed booking count is zero. Historical
 * identities are immutable from this surface: deactivate preserves reports,
 * customer history and the audit trail. A final FK guard remains server-side. */
function DangerSection({ member, onDeleted }: { member: StaffCard; onDeleted: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteStaff, {})

  useEffect(() => {
    if (state.success) {
      notify('Medarbetaren borttagen', 'info')
      router.refresh()
      onDeleted()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  if (member.bookingCount > 0) {
    return (
      <section style={{ borderTop: '1px solid var(--c-line)', paddingTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Bokningshistorik finns
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--c-ink-3)', margin: 0, lineHeight: 1.55 }}>
          Bokningshistoriken ska bevaras. Inaktivera medarbetaren ovan om personen inte längre ska
          synas eller kunna bokas.
        </p>
      </section>
    )
  }

  return (
    <section style={{ borderTop: '1px solid var(--c-line)', paddingTop: 16 }}>
      <form action={formAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="hidden" name="id" value={member.id} />
        {armed ? (
          <>
            <Button
              variant="ghost"
              type="submit"
              icon="trash"
              size="sm"
              disabled={pending}
              style={{ color: 'var(--c-danger, #b3261e)', borderColor: 'var(--c-danger, #b3261e)' }}
            >
              {pending ? '…' : 'Säker? Ta bort permanent'}
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setArmed(false)}>
              Ångra
            </Button>
          </>
        ) : (
          <Button variant="ghost" type="button" icon="trash" size="sm" onClick={() => setArmed(true)}>
            Ta bort medarbetare
          </Button>
        )}
      </form>
      {state.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {state.error}
        </p>
      )}
    </section>
  )
}

/**
 * Eget-konto block (mock's "Eget konto · egen vy"). Derived status from
 * profile_id (passed as member.hasAccount):
 *  - linked → success callout explaining the frisör logs in themselves. We do NOT
 *    render "Öppna frisörens vy" (no admin route to open another staff member's
 *    personal view) nor "Ny magic-link" (inviteStaff only creates a fresh account;
 *    there's no resend/de-link) — un-wireable controls are omitted, never faked.
 *  - un-linked → a real magic-link invite form: inviteStaff with the hidden
 *    staff_id links THIS staff row's profile_id to a new account. Fires one Swedish
 *    consequence toast + router.refresh() so the status flips without a reload.
 */
function EgetKontoSection({ member, onInvited }: { member: StaffCard; onInvited: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(inviteStaff, {})

  useEffect(() => {
    if (state.success) {
      notify('Inbjudan skickad — medarbetaren får eget konto med egen vy', 'info')
      router.refresh()
      onInvited()
    }
    // fire once when the action reports success
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  if (member.hasAccount) {
    return (
      <section
        style={{
          background: 'var(--c-success-bg)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--c-ink)',
          }}
        >
          <Icon name="calendar" size={15} style={{ color: 'var(--c-success)' }} />
          Eget konto · egen vy
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--c-ink-2)', margin: '6px 0 0', lineHeight: 1.5 }}>
          Medarbetaren loggar in själv och får sin egen snabbvy — en kalender med bara sina tider.
          Dagens tider visas också här nedan.
        </p>
      </section>
    )
  }

  return (
    <section style={{ background: 'var(--c-paper-2)', borderRadius: 12, padding: 16 }}>
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--c-ink)',
        }}
      >
        <Icon name="calendar" size={15} style={{ color: 'var(--c-ink-3)' }} />
        Eget konto · egen vy
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--c-ink-2)', margin: '6px 0 12px', lineHeight: 1.5 }}>
        Hanteras i företagets sida just nu. Bjud in med en engångslänk för att ge ett eget konto med
        egen kalender — medarbetaren sätter lösenord och loggar in själv.
      </p>
      <form
        action={formAction}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}
      >
        <input type="hidden" name="staff_id" value={member.id} />
        <input
          name="email"
          type="email"
          required
          placeholder="medarbetare@exempel.se"
          aria-label="E-post för inbjudan"
          style={{ ...fieldStyle, flex: '1 1 12rem' }}
        />
        <Button variant="primary" type="submit" icon="mail" size="sm" disabled={pending}>
          {pending ? 'Skickar…' : 'Skicka magic-link'}
        </Button>
      </form>
      {state.error && (
        <p className="auth-error" role="alert" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
          {state.error}
        </p>
      )}
    </section>
  )
}

/**
 * Create-staff Drawer opened from the PageHead "+ Lägg till". Holds the two
 * onboarding paths that lived at the top of the old StaffManager:
 *  - createStaff: add a managed staff row (name/titel only — no login).
 *  - inviteStaff (with title): magic-link a new staff member into their own login.
 * Both are real server actions; each fires one consequence toast + refresh.
 */
function AddStaffDrawer({
  locations,
  defaultLocationId,
  onClose,
}: {
  locations: LocationOption[]
  defaultLocationId: string
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState<ActionState, FormData>(
    createStaff,
    {},
  )
  const [invState, invAction, invPending] = useActionState<ActionState, FormData>(inviteStaff, {})

  useEffect(() => {
    if (createState.success) {
      notify('Medarbetare tillagd', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createState.success])

  useEffect(() => {
    if (invState.success) {
      notify('Inbjudan skickad — medarbetaren får eget konto med egen vy', 'info')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invState.success])

  return (
    <Drawer
      title="Lägg till medarbetare"
      sub="Lägg till en rad eller bjud in med eget konto"
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: 24 }}>
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Lägg till i företaget
          </div>
          <p
            style={{ fontSize: 12.5, color: 'var(--c-ink-2)', margin: '0 0 12px', lineHeight: 1.5 }}
          >
            Skapar medarbetaren på vald plats och kopplar platsens aktiva tjänster. Bekräftade
            öppettider blir första arbetsschemat; annars visas nästa åtgärd direkt.
          </p>
          <form action={createAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <NewStaffLocationField locations={locations} defaultLocationId={defaultLocationId} />
            <input
              name="title"
              required
              placeholder="t.ex. Hilal — medarbetare"
              aria-label="Namn / titel"
              style={{ ...fieldStyle, flex: '1 1 14rem' }}
            />
            <Button
              variant="primary"
              type="submit"
              icon="plus"
              size="sm"
              disabled={createPending || locations.length === 0}
            >
              {createPending ? 'Sparar…' : 'Lägg till'}
            </Button>
          </form>
          {createState.error && (
            <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
              {createState.error}
            </p>
          )}
        </section>

        <section style={{ borderTop: '1px solid var(--c-line)', paddingTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Bjud in med eget konto
          </div>
          <p
            style={{ fontSize: 12.5, color: 'var(--c-ink-2)', margin: '0 0 12px', lineHeight: 1.5 }}
          >
            Medarbetaren får en engångslänk, sätter lösenord och får sin egen vy direkt. En
            medarbetarrad på vald plats skapas samtidigt.
          </p>
          <form action={invAction} style={{ display: 'grid', gap: 8 }}>
            <NewStaffLocationField locations={locations} defaultLocationId={defaultLocationId} />
            <input
              name="email"
              type="email"
              required
              placeholder="medarbetare@exempel.se"
              aria-label="E-post för inbjudan"
              style={fieldStyle}
            />
            <input
              name="title"
              placeholder="Namn / titel (valfritt)"
              aria-label="Namn / titel (valfritt)"
              style={fieldStyle}
            />
            <div>
              <Button
                variant="subtle"
                type="submit"
                icon="mail"
                size="sm"
                disabled={invPending || locations.length === 0}
              >
                {invPending ? 'Skickar…' : 'Skicka inbjudan'}
              </Button>
            </div>
          </form>
          {invState.error && (
            <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
              {invState.error}
            </p>
          )}
        </section>
      </div>
    </Drawer>
  )
}

function NewStaffLocationField({
  locations,
  defaultLocationId,
}: {
  locations: LocationOption[]
  defaultLocationId: string
}) {
  if (locations.length === 1) {
    return <input type="hidden" name="location_id" value={locations[0]!.id} />
  }
  if (locations.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--c-danger)', fontSize: 12.5 }} role="alert">
        Skapa och aktivera en plats innan du lägger till personal.
      </p>
    )
  }
  return (
    <label style={{ display: 'grid', gap: 5, flex: '1 1 12rem', fontSize: 12.5 }}>
      Plats
      <select name="location_id" required defaultValue={defaultLocationId} style={fieldStyle}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </label>
  )
}

const fieldStyle = {
  minWidth: 0,
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13.5,
  boxSizing: 'border-box',
} as const
