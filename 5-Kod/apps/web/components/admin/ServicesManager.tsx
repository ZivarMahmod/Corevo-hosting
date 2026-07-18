'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ServiceRow } from '@/lib/admin/data'
import {
  createService,
  updateService,
  toggleServiceActive,
  deleteService,
  type ActionState,
} from '@/lib/admin/actions'
import { centsToKronorInput, formatPrice } from '@/lib/admin/format'
import {
  Badge,
  Button,
  Callout,
  Card,
  Drawer,
  Icon,
  PageHead,
  PillToggle,
  Table,
  useToast,
} from '@/components/portal/ui'

/**
 * Tjänster §4.4 — exact-copy composition of the SalonServices mock.
 *   PageHead (eyebrow → Playfair-28 → sub → "Ny tjänst" CTA) · gold live-koppling
 *   Callout · asymmetric 1.7fr/1fr worktop (align-start): left = the service Table
 *   (Tjänst · Tid · Pris · Storefront · Online · edit), right = the live storefront
 *   placement map. Inline edit is preserved by converting the old per-row form into
 *   a detail Drawer that still carries EVERY field (namn/kategori/min/pris) + delete,
 *   plus a create Drawer behind the header CTA. Online is a real wired toggle.
 *
 * ⛔ DATA-GATED (goal-17 truth report):
 *  - "Populär" gold badge → NO backing column (getServicePopularityTag === false).
 *    We render no badge, never a fake one.
 *  - Mock's per-row Storefront <select> (Dam/Herr/Färg/Styling) is a PLACEHOLDER:
 *    `services` has no `section` column, and the live storefront (homepage +
 *    /tjanster) renders a FLAT price-ordered list — category drives NO placement
 *    there. Building that enum would fake a field, its allowed-values, AND a
 *    behaviour. The real, writable field the storefront map already groups by is
 *    free-text `category`; we surface THAT in the Storefront column (label, edited
 *    in the drawer) without claiming it reorders the public page. See sharedClass/
 *    notes — section model FLAGGED, not faked.
 */
export function ServicesManager({
  services,
  tenantName,
}: {
  services: ServiceRow[]
  tenantName: string
}) {
  const [editing, setEditing] = useState<ServiceRow | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHead
        eyebrow={tenantName}
        title="Tjänster"
        lede="När du lägger till eller redigerar en tjänst ser du direkt var på hemsidan den hamnar."
      >
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Ny tjänst
        </Button>
      </PageHead>

      <Callout tone="gold" icon="link">
        Aktiva tjänster syns i tjänstemenyn på startsidan och på /tjanster (ordnade efter pris).
        En tjänst blir bokningsbar först när den är kopplad till aktiv personal med plats och
        arbetstider. Inaktiverade tjänster döljs men behåller sin bokningshistorik.
      </Callout>

      {/* Kolumn-ratio i CSS (inte inline) så .bo-2col:s ≤920px-kollaps till 1fr vinner
          på mobil — inline-style skulle annars slå media-queryn (RolesMatrix-fällan). */}
      <style>{`
        .services-2col { grid-template-columns: 1.7fr 1fr; }
        @media (max-width: 920px) { .services-2col { grid-template-columns: 1fr; } }
      `}</style>
      <div className="bo-2col services-2col" style={{ alignItems: 'start', marginTop: 16 }}>
        <Card pad={0}>
          {services.length === 0 ? (
            <div style={{ padding: 22 }}>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                Inga tjänster ännu
              </p>
              <p className="body" style={{ margin: 0, maxWidth: 460, color: 'var(--c-ink-2)' }}>
                Lägg till din första tjänst med <strong>Ny tjänst</strong> — namn, varaktighet och
                pris. Koppla tjänsten till aktiv personal med arbetstider innan den kan bokas.
              </p>
            </div>
          ) : (
            <Table
              cols={['Tjänst', 'Tid', 'Pris', 'Storefront', 'Online', '']}
              rows={services.map((s) => [
                <ServiceCell key="namn" service={s} />,
                <span key="tid" className="num">
                  {s.duration_min} min
                </span>,
                <span key="pris" className="num" style={{ fontWeight: 600 }}>
                  {formatPrice(s.price_cents)}
                </span>,
                <StorefrontCell key="sf" service={s} />,
                <OnlineToggle key="online" service={s} />,
                <button
                  key="edit"
                  type="button"
                  onClick={() => setEditing(s)}
                  aria-label={`Redigera ${s.name}`}
                  style={{
                    // goal-62 G1: mätte 25×25 — redigera-knappen på varje tjänsterad låg
                    // under touch-golvet. 44×44, kvittad marginal → radhöjden oförändrad.
                    width: 44,
                    height: 44,
                    margin: -6,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--c-ink-3)',
                    cursor: 'pointer',
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

        <StorefrontSiteMap services={services} tenantName={tenantName} />
      </div>

      {creating && <CreateDrawer onClose={() => setCreating(false)} />}
      {editing && (
        <EditDrawer key={editing.id} service={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

/** First table cell — bold name + free-text category sub. NO "Populär" badge:
 *  the badge has no backing column (data-gated), so we render nothing, never a
 *  fake. (The Badge import stays available for when the feature is modeled.) */
function ServiceCell({ service }: { service: ServiceRow }) {
  return (
    <div>
      <b style={{ fontWeight: 600 }}>{service.name}</b>
      <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2 }}>
        {service.category?.trim() || 'Ingen kategori'}
      </div>
    </div>
  )
}

/** Storefront placement column. The mock's Dam/Herr/Färg/Styling <select> maps to
 *  no real field — we show the honest, writable `category` (edited in the drawer)
 *  for ONLINE services, and the written "— dold —" empty-state for inactive ones,
 *  exactly as the mock does for hidden rows. No enum, no fabricated placement. */
function StorefrontCell({ service }: { service: ServiceRow }) {
  if (!service.active) {
    return <span style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>— dold —</span>
  }
  const cat = service.category?.trim()
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12.5,
        color: 'var(--c-ink-2)',
      }}
    >
      <Icon name="external" size={13} style={{ color: 'var(--c-gold-600)' }} />
      {cat || 'Tjänstemenyn'}
    </span>
  )
}

/** Online-växeln över toggleServiceActive — kopplad, med konsekvens-toast (aldrig en
 *  död toggle, §6).
 *
 *  goal-62 G3: här bodde en handbyggd 42×24-switch. Butik har EXAKT samma semantik
 *  (boolean `active`, verben Dölj/Visa, samma konsekvens-toast, samma server-action-form)
 *  men renderade en PillToggle. Två uttryck för en betydelse — skillnaden var historisk,
 *  inte betydelsebärande. Switchen är riven; alla fyra ytorna (Tjänster · Butik · Blogg ·
 *  Kurser) delar nu PillToggle-primitiven, som också bär 44px-golvet och fokusringen som
 *  inline-switchen aldrig kunde få. Endast växeln byttes — toggleServiceActive är orörd. */
function OnlineToggle({ service }: { service: ServiceRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    toggleServiceActive,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify(
        service.active
          ? `${service.name} dold på sajten — historiken finns kvar`
          : `${service.name} aktiverad i tjänstelistan — kontrollera Personal och Schema för bokning`,
        'success',
      )
      router.refresh()
    }
    // fire once per successful toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <form action={formAction} style={{ display: 'inline-flex' }}>
        <input type="hidden" name="id" value={service.id} />
        <input type="hidden" name="active" value={String(!service.active)} />
        <PillToggle
          type="submit"
          active={service.active}
          disabled={pending}
          ariaLabel={service.active ? `Dölj ${service.name}` : `Visa ${service.name}`}
        >
          {pending ? '…' : service.active ? 'Dölj' : 'Visa'}
        </PillToggle>
      </form>
      {/* Boolean aktiv-flagga (ingen status-sträng) — statusTone gäller ej här. */}
      <Badge tone={service.active ? 'success' : 'neutral'}>
        {service.active ? 'Aktiv' : 'Av'}
      </Badge>
    </div>
  )
}

/**
 * Live storefront site-map (§4.4) — "Var det syns på hemsidan". Mirrors where each
 * service lands on the public site, grouped by free-text category. Active = a chip
 * under its section; inactive = listed as hidden. Read-only reflection of the same
 * `services` prop — a toggle/edit revalidates the page and the map updates with no
 * extra code or deploy. KEPT from the shipped page; restyled to the mock Card
 * grammar (external/info icons, paper-2 section tiles, written empty-states).
 */
function StorefrontSiteMap({
  services,
  tenantName,
}: {
  services: ServiceRow[]
  tenantName: string
}) {
  const active = services.filter((s) => s.active)
  const hidden = services.filter((s) => !s.active)

  const sections = new Map<string, ServiceRow[]>()
  for (const s of active) {
    const key = s.category?.trim() || 'Övrigt'
    const arr = sections.get(key)
    if (arr) arr.push(s)
    else sections.set(key, [s])
  }
  const sectionList = [...sections.entries()]

  return (
    <Card style={{ position: 'sticky', top: 84 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="external" size={15} style={{ color: 'var(--c-gold-600)' }} />
        <h2 className="h2" style={{ margin: 0 }}>
          Var det syns på hemsidan
        </h2>
      </div>
      <p className="small" style={{ margin: '0 0 14px', color: 'var(--c-ink-3)' }}>
        {tenantName} · publika sajten → Tjänster
      </p>

      {sectionList.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--c-ink-2)', margin: 0 }}>
          Inga aktiva tjänster — ingenting visas i tjänstemenyn ännu.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sectionList.map(([name, items]) => (
            <div
              key={name}
              style={{
                border: '1px solid var(--c-line)',
                borderRadius: 12,
                padding: '12px 14px',
                background: 'var(--c-paper-2)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  color: 'var(--c-forest)',
                  marginBottom: 8,
                }}
              >
                {name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      fontSize: 12.5,
                      background: 'var(--c-paper)',
                      border: '1px solid var(--c-line)',
                      borderRadius: 999,
                      padding: '4px 10px',
                      color: 'var(--c-ink)',
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--c-ink-3)',
              marginBottom: 8,
            }}
          >
            Dold på sajten
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hidden.map((s) => (
              <span
                key={s.id}
                style={{
                  fontSize: 12.5,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px dashed var(--c-line-strong)',
                  color: 'var(--c-ink-3)',
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--c-ink-3)',
        }}
      >
        <Icon name="info" size={14} /> Ändringar slår igenom utan kod eller deploy.
      </div>
    </Card>
  )
}

/** Shared field markup for the create + edit drawers — eyebrow label over each
 *  input, mock control radius/borders. Keeps inline-edit parity: namn, kategori,
 *  varaktighet, pris are ALL editable here (RC: don't lose inline edit). */
function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

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

function CreateDrawer({ onClose }: { onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createService, {})

  useEffect(() => {
    if (state.success) {
      notify('Tjänst skapad. Koppla den till personal och schema för bokning.', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <Drawer
      title="Ny tjänst"
      sub="Namn, varaktighet och pris sparas här. Personal och schema avgör bokningsbarheten."
      onClose={onClose}
      ariaLabel="Ny tjänst"
      footer={
        <form
          action={formAction}
          id="create-service"
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Lägg till tjänst'}
          </Button>
        </form>
      }
    >
      {/* The footer form owns the fields via form="create-service" so the sticky
          footer button submits them. */}
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Namn">
          <input form="create-service" name="name" required style={inputStyle} />
        </Field>
        <Field label="Kategori">
          <input
            form="create-service"
            name="category"
            placeholder="t.ex. Populärt"
            style={inputStyle}
          />
        </Field>
        <Field label="Varaktighet (min)">
          <input
            form="create-service"
            name="duration_min"
            type="number"
            min="1"
            step="1"
            defaultValue="30"
            required
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Pris (kr)">
          <input
            form="create-service"
            name="price"
            type="text"
            inputMode="decimal"
            required
            placeholder="t.ex. 450"
            className="num"
            style={inputStyle}
          />
        </Field>
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}

function EditDrawer({ service, onClose }: { service: ServiceRow; onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [save, saveAction, saving] = useActionState<ActionState, FormData>(updateService, {})
  const [del, delAction, deleting] = useActionState<ActionState, FormData>(deleteService, {})
  // Tvåstegsbekräftelse: "Ta bort" raderade tidigare på ETT klick. Klick 1 armerar
  // (knappen blir "Säker? Ta bort permanent" i varningston + en Ångra), klick 2
  // skickar delete-formuläret. Drawern remountas per tjänst (key=service.id) så
  // armeringen kan aldrig läcka mellan tjänster.
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (save.success) {
      notify('Tjänst uppdaterad', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.success])

  useEffect(() => {
    if (del.success) {
      notify('Tjänst borttagen', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [del.success])

  const formId = `edit-service-${service.id}`

  return (
    <Drawer
      title={service.name}
      sub={service.active ? 'Aktiv i tjänstelistan' : 'Dold på sajten'}
      accent={
        <Badge tone={service.active ? 'success' : 'neutral'}>
          {service.active ? 'Aktiv' : 'Av'}
        </Badge>
      }
      onClose={onClose}
      ariaLabel={`Redigera ${service.name}`}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
          <form action={delAction} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input type="hidden" name="id" value={service.id} />
            {confirmDelete ? (
              <>
                <Button
                  variant="ghost"
                  type="submit"
                  icon="trash"
                  disabled={deleting}
                  style={{ color: 'var(--c-danger)' }}
                >
                  {deleting ? '…' : 'Säker? Ta bort permanent'}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setConfirmDelete(false)}>
                  Ångra
                </Button>
              </>
            ) : (
              <Button variant="ghost" type="button" icon="trash" onClick={() => setConfirmDelete(true)}>
                Ta bort
              </Button>
            )}
          </form>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          {/* Native <button> so the HTML form= association can submit the body
              form from the sticky footer (the Button primitive forwards no `form`
              attr). Carries the same .pbtn classes for identical styling. */}
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
      {/* Inline edit preserved in full: every field the old per-row form carried. */}
      <form action={saveAction} id={formId} style={{ display: 'grid', gap: 14 }}>
        <input type="hidden" name="id" value={service.id} />
        <Field label="Namn">
          <input name="name" defaultValue={service.name} required style={inputStyle} />
        </Field>
        <Field label="Kategori">
          <input
            name="category"
            defaultValue={service.category ?? ''}
            placeholder="t.ex. Populärt"
            style={inputStyle}
          />
        </Field>
        <Field label="Varaktighet (min)">
          <input
            name="duration_min"
            type="number"
            min="1"
            step="1"
            defaultValue={service.duration_min}
            required
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Pris (kr)">
          <input
            name="price"
            type="text"
            inputMode="decimal"
            defaultValue={centsToKronorInput(service.price_cents)}
            className="num"
            style={inputStyle}
          />
        </Field>
      </form>

      {(save.error || del.error) && (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {save.error || del.error}
        </p>
      )}
    </Drawer>
  )
}
