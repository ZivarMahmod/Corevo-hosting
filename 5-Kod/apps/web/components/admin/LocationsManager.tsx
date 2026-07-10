'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { LocationRow } from '@/lib/admin/data'
import {
  createLocation,
  updateLocation,
  setPrimaryLocation,
  toggleLocationActive,
  type ActionState,
} from '@/lib/admin/actions'
import {
  Badge,
  Button,
  Callout,
  Card,
  Drawer,
  Icon,
  PageHead,
  Table,
  useToast,
} from '@/components/portal/ui'

// Samma IANA-lista som SettingsForm — fritext-tidszon var den gamla ytans största
// felkälla (en stavfelad zon avvisas först server-side). En select kan inte stavas fel.
const TIMEZONES = [
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/London',
  'UTC',
]

const inputStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  width: '100%',
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

/**
 * Platser — samma Card/Drawer/toast-grammatik som ServicesManager (tidigare den
 * äldsta ytan i admin: råa inline-formulär per rad + hover-only-förklaringar).
 * Lista som tabell, penna → redigerings-Drawer, skapa-Drawer bakom header-CTA:n.
 *
 * Reglerna är OFÖRÄNDRADE (samma server actions):
 *   • primär plats kan inte inaktiveras (bokningar kräver den)
 *   • en inaktiv plats kan inte bli primär (aktivera först)
 *   • ingen delete — en plats bär bokningshistorik/scheman, inaktivering är enda vägen
 * Skillnaden är att skälen nu står som SYNLIG text i Drawern i stället för att
 * gömmas i title-attribut.
 */
export function LocationsManager({
  locations,
  tenantName,
}: {
  locations: LocationRow[]
  tenantName: string
}) {
  const [editing, setEditing] = useState<LocationRow | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHead
        eyebrow={tenantName}
        title="Platser"
        lede="Salongens platser (filialer). Den primära platsen är den bokningar och den publika sajten utgår från — varje salong har exakt en."
      >
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Ny plats
        </Button>
      </PageHead>

      <Callout tone="info" icon="mapPin">
        En plats tas aldrig bort helt — den bär bokningshistorik och scheman. Inaktivera den i
        stället, så döljs den för nya scheman. Personalens scheman kopplas till en plats under
        Scheman.
      </Callout>

      <div style={{ marginTop: 16 }}>
        <Card pad={0}>
          {locations.length === 0 ? (
            <div style={{ padding: 22 }}>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                Inga platser ännu
              </p>
              <p className="body" style={{ margin: 0, maxWidth: 460, color: 'var(--c-ink-2)' }}>
                Lägg till din första plats med <strong>Ny plats</strong>. Den första du gör till
                primär blir den som bokningar och den publika sajten utgår från.
              </p>
            </div>
          ) : (
            <Table
              cols={['Plats', 'Tidszon', 'Status', '']}
              rows={locations.map((l) => [
                <div key="plats">
                  <b style={{ fontWeight: 600 }}>{l.name}</b>
                  <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2 }}>
                    {l.address?.trim() || 'Ingen adress angiven'}
                  </div>
                </div>,
                <span key="tz" style={{ fontSize: 12.5, color: 'var(--c-ink-2)' }}>
                  {l.timezone}
                </span>,
                <span key="status" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                  {l.is_primary ? (
                    <Badge tone="gold">Primär plats</Badge>
                  ) : (
                    <Badge tone={l.active ? 'success' : 'neutral'}>
                      {l.active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  )}
                </span>,
                <button
                  key="edit"
                  type="button"
                  onClick={() => setEditing(l)}
                  aria-label={`Redigera ${l.name}`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--c-ink-3)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'inline-grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="edit" size={17} />
                </button>,
              ])}
            />
          )}
        </Card>
      </div>

      {creating && (
        <CreateLocationDrawer
          onClose={() => setCreating(false)}
          primaryName={locations.find((l) => l.is_primary)?.name ?? null}
        />
      )}
      {editing && (
        <EditLocationDrawer key={editing.id} location={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

/** Tidszon-select — visar den sparade zonen även om den inte finns i standardlistan
 *  (samma fallback som SettingsForm), så en ovanlig zon aldrig tyst byts vid spar. */
function TimezoneSelect({
  formId,
  defaultValue,
}: {
  formId?: string
  defaultValue: string
}) {
  const options = TIMEZONES.includes(defaultValue) ? TIMEZONES : [defaultValue, ...TIMEZONES]
  return (
    <select form={formId} name="timezone" defaultValue={defaultValue} style={inputStyle}>
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz}
        </option>
      ))}
    </select>
  )
}

function CreateLocationDrawer({
  onClose,
  primaryName,
}: {
  onClose: () => void
  /** Primära platsens namn — null när ingen primär finns (då göms kopiera-valet). */
  primaryName: string | null
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLocation, {})

  useEffect(() => {
    if (state.success) {
      notify('Plats skapad — gör den till primär när den ska ta över', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  const formId = 'create-location'

  return (
    <Drawer
      title="Ny plats"
      sub="En ny plats blir aktiv direkt men tar aldrig över som primär av sig själv."
      onClose={onClose}
      ariaLabel="Ny plats"
      footer={
        <form
          action={formAction}
          id={formId}
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Lägg till plats'}
          </Button>
        </form>
      }
    >
      {/* Footer-formuläret äger fälten via form={formId} — samma mönster som
          ServicesManagers CreateDrawer, så sticky-footerns knapp skickar in dem. */}
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Namn">
          <input
            form={formId}
            name="name"
            required
            placeholder="t.ex. Salongen Söder"
            style={inputStyle}
          />
        </Field>
        <Field label="Adress">
          <input
            form={formId}
            name="address"
            placeholder="Gata 1, 111 22 Stad"
            style={inputStyle}
          />
        </Field>
        <Field label="Tidszon">
          <TimezoneSelect formId={formId} defaultValue="Europe/Stockholm" />
        </Field>
        {primaryName ? (
          <Field label="Schema för nya platsen">
            {/* Zivars två vägar: exakt kopia av primären (tweaka sen) eller från noll.
                Kopian klonar grundtider + bokningsbara starttider till nya platsen —
                dubbelbokning över platser är alltid spärrad i databasen. */}
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input form={formId} type="radio" name="schema_mode" value="blank" defaultChecked />
                <span>
                  <b style={{ fontWeight: 600 }}>Börja från noll</b>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--c-ink-3)' }}>
                    Platsen har inga bokningsbara tider förrän du lägger dem under Scheman.
                  </span>
                </span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input form={formId} type="radio" name="schema_mode" value="copy" />
                <span>
                  <b style={{ fontWeight: 600 }}>Kopiera schemat från {primaryName}</b>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--c-ink-3)' }}>
                    Personalens grundtider och bokningsbara starttider kopieras hit — justera
                    sedan det som ska skilja. Samma medarbetare blir bokningsbar på båda
                    platserna tills du ändrar; dubbelbokning är alltid spärrad.
                  </span>
                </span>
              </label>
            </div>
          </Field>
        ) : null}
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}

function EditLocationDrawer({
  location,
  onClose,
}: {
  location: LocationRow
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [save, saveAction, saving] = useActionState<ActionState, FormData>(updateLocation, {})

  useEffect(() => {
    if (save.success) {
      notify('Plats uppdaterad — speglas i bokning och scheman', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.success])

  const formId = `edit-location-${location.id}`

  return (
    <Drawer
      title={location.name}
      sub={location.address?.trim() || 'Ingen adress angiven'}
      accent={
        location.is_primary ? (
          <Badge tone="gold">Primär plats</Badge>
        ) : (
          <Badge tone={location.active ? 'success' : 'neutral'}>
            {location.active ? 'Aktiv' : 'Inaktiv'}
          </Badge>
        )
      }
      onClose={onClose}
      ariaLabel={`Redigera ${location.name}`}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          {/* Nativ <button> så form=-associationen kan skicka body-formuläret från
              sticky-footern (Button-primitiven vidarebefordrar ingen form-attr). */}
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="pbtn pbtn--primary pbtn--md"
          >
            <Icon name="check" size={17} />
            {saving ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <form action={saveAction} id={formId} style={{ display: 'grid', gap: 14 }}>
          <input type="hidden" name="id" value={location.id} />
          <Field label="Namn">
            <input name="name" defaultValue={location.name} required style={inputStyle} />
          </Field>
          <Field label="Adress">
            <input
              name="address"
              defaultValue={location.address ?? ''}
              placeholder="Gata 1, 111 22 Stad"
              style={inputStyle}
            />
          </Field>
          <Field label="Tidszon">
            <TimezoneSelect defaultValue={location.timezone} />
          </Field>
        </form>
        {save.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {save.error}
          </p>
        )}

        <PrimarySection location={location} onDone={onClose} />
        <ActiveSection location={location} onDone={onClose} />
      </div>
    </Drawer>
  )
}

/** Gör till primär — samma regler som förr, men skälet till en inaktiverad knapp
 *  står nu som synlig text (inte bara i ett hover-title). */
function PrimarySection({ location, onDone }: { location: LocationRow; onDone: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setPrimaryLocation, {})

  useEffect(() => {
    if (state.success) {
      notify('Primär plats uppdaterad — bokningar och sajten utgår nu härifrån', 'success')
      router.refresh()
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <section style={{ borderTop: '1px solid var(--c-line)', paddingTop: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Primär plats
      </div>
      {location.is_primary ? (
        <p style={{ fontSize: 13, color: 'var(--c-ink-2)', margin: 0, lineHeight: 1.55 }}>
          Detta är salongens primära plats — bokningar och den publika sajten utgår härifrån. Vill
          du byta: gör en annan plats till primär, så flyttas rollen dit.
        </p>
      ) : (
        <>
          <form action={formAction}>
            <input type="hidden" name="id" value={location.id} />
            <Button
              variant="subtle"
              type="submit"
              icon="star"
              size="sm"
              disabled={pending || !location.active}
            >
              {pending ? '…' : 'Gör till primär'}
            </Button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--c-ink-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
            {location.active
              ? 'Bokningar och den publika sajten utgår från den primära platsen.'
              : 'Platsen är inaktiv och kan inte bli primär — aktivera den nedan först.'}
          </p>
        </>
      )}
      {state.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {state.error}
        </p>
      )}
    </section>
  )
}

/** Aktivera/inaktivera — primär plats får aldrig inaktiveras (bärande för
 *  bokningar); skälet visas som text i stället för hover-title. Ingen delete. */
function ActiveSection({ location, onDone }: { location: LocationRow; onDone: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    toggleLocationActive,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify(
        location.active
          ? 'Plats inaktiverad — dold för nya scheman, historiken finns kvar'
          : 'Plats aktiverad — kan kopplas till scheman igen',
        'info',
      )
      router.refresh()
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  const blocked = location.active && location.is_primary

  return (
    <section style={{ borderTop: '1px solid var(--c-line)', paddingTop: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Status
      </div>
      <form action={formAction}>
        <input type="hidden" name="id" value={location.id} />
        <input type="hidden" name="active" value={String(!location.active)} />
        <Button
          variant="ghost"
          type="submit"
          icon={location.active ? 'pause' : 'check'}
          size="sm"
          disabled={pending || blocked}
        >
          {pending ? '…' : location.active ? 'Inaktivera plats' : 'Aktivera plats'}
        </Button>
      </form>
      <p style={{ fontSize: 12, color: 'var(--c-ink-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
        {blocked
          ? 'Den primära platsen kan inte inaktiveras — bokningar kräver den. Gör en annan plats till primär först.'
          : location.active
            ? 'Inaktivering döljer platsen för nya scheman. Bokningshistoriken finns kvar — en plats tas aldrig bort helt.'
            : 'Platsen är inaktiv och dold för nya scheman. Aktivera för att använda den igen.'}
      </p>
      {state.error && (
        <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {state.error}
        </p>
      )}
    </section>
  )
}
