'use client'

// Onboardingens fyra paneler och PANEL_BY_STEP-registret.
//
// Ported from the design source (4-Dokument-Underlag/01-acceptans/super-admin/
// studio.jsx PanelBranch…PanelLive) per W1 build-contract §5, but driven by the REAL
// presets + the pure StudioAction dispatch (state.ts) and the shared Field/
// ModuleStatePills (controls.tsx). Designpaketet styr skalet; panelerna använder
// verkliga val och `live` skickar det enda Lansera-anropet via onLaunch.
//
// The registry is keyed by StepId and internal to this file + PanelHost (nothing else
// imports it), so it carries the two extra callbacks the special panels need.
import type { FC, ReactNode, CSSProperties } from 'react'
import { Badge, Button, Card, Icon } from '@/components/portal/ui'
import { Field, ModuleStatePills } from './controls'
import type { PanelProps } from '@/lib/platform/onboarding-studio/state'
import { type StepId } from '@/lib/platform/onboarding-studio/phases'
import { resolveModuleState } from '@/lib/platform/onboarding-studio/model'
import { isReservedSlug } from '@/lib/platform/slug'
import { isSlugTaken } from '@/lib/platform/actions/tenants'
import { useEffect, useState } from 'react'
import {
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_TAGS,
  BOOKING_VARIANT_DESCRIPTIONS,
  RECOMMENDED_BOOKING_VARIANT,
} from '@/lib/platform/booking-variant'
import { normalizeBookingExternalUrl } from '@/lib/platform/booking-external-url'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
import { studioBranchName, studioPlaceholderSlug } from './studio-placeholder'
import { tenantHostSuffix, tenantStorefrontHost } from '@/lib/storefront-url'
import type { IconName } from '@/lib/ui-icons'
import { modulesForVertical } from '@/lib/platform/verticals-shared'
import { SELECTABLE_THEMES } from '@/lib/platform/theme-palettes'

/**
 * The prop bag every panel in the registry receives. Extends PanelProps
 * (cfg/dispatch/presets) with the callback the live panel needs:
 *   • onLaunch — the gold Lansera button → the single createTenant submit.
 * Simple panels ignore both (they're typed `FC<PanelProps>` and slot in fine under
 * parameter contravariance).
 */
export type StudioPanelProps = PanelProps & {
  onLaunch: () => void
}

// ── Shared inline tokens (lifted verbatim from the design / controls.tsx) ─────────
const labelStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
}
/** Svenska hint per modul-läge. */
const MODULE_STATE_HINTS: Record<ModuleState, string> = {
  off: 'Av och dold för kunden.',
  live: 'På och synlig för kunden.',
}


/* ════════════════════════════ panel scaffold ════════════════════════════ */

/** Column scaffold (port studio.jsx:56–67) — header (display h2 fs21 forest + sub)
 *  over a scrollable body. No `foot`: the global FooterNav lives in PanelHost. */
function Panel({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '26px 28px 18px', borderBottom: '1px solid var(--c-line)', flex: 'none', background: 'var(--c-paper)' }}>
        <div style={{ fontSize: 10, fontWeight: 750, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--c-gold-600)', marginBottom: 8 }}>
          Aktivt steg
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, lineHeight: 1.02, color: 'var(--c-forest)', margin: 0 }}>
          {title}
        </h2>
        {sub ? <p style={{ fontSize: 14, color: 'var(--c-ink-2)', margin: '10px 0 0', lineHeight: 1.55, maxWidth: 410 }}>{sub}</p> : null}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>{children}</div>
    </div>
  )
}

function InfoCard({ title, text, icon = 'checkCircle' }: { title: string; text: string; icon?: IconName }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: 16, border: '1px solid var(--c-line)', borderRadius: 14, background: 'var(--c-paper)' }}>
      <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--c-paper-2)', color: 'var(--c-forest)' }}>
        <Icon name={icon} size={17} />
      </span>
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', color: 'var(--c-ink)', fontSize: 14 }}>{title}</strong>
        <span style={{ display: 'block', marginTop: 4, color: 'var(--c-ink-3)', fontSize: 12.5, lineHeight: 1.5 }}>{text}</span>
      </span>
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 12, padding: 18, border: '1px solid var(--c-line)', borderRadius: 18, background: 'var(--c-paper)' }}>
      <div>
        <h3 style={{ margin: 0, color: 'var(--c-ink)', fontSize: 17, fontWeight: 750 }}>{title}</h3>
        {sub ? <p style={{ margin: '6px 0 0', color: 'var(--c-ink-3)', fontSize: 12.5, lineHeight: 1.5 }}>{sub}</p> : null}
      </div>
      {children}
    </section>
  )
}

/* ════════════════════════════ step panels ════════════════════════════ */

/** Ikon per bransch-nyckel (fallback 'building'). Korten kommer från DB
 *  (presets.verticals) — en ny rad i verticals-tabellen dyker upp här av sig själv. */
const BRANSCH_ICONS: Record<string, IconName> = {
  generell: 'layers',
  'frisör': 'scissors',
  frisor: 'scissors',
  barbershop: 'scissors',
  nagelstudio: 'building',
  restaurang: 'coffee',
  florist: 'sun',
  klinik: 'shield',
}

/** branch — kort per RIKTIG bransch (DB verticals, inga roadmap-stubbar). Valet
 *  FÖRFYLLER mall + moduler + ord från bransch-förvalen (/branscher äger dem);
 *  allt går att ändra i stegen efter. */
function BranchSection({ cfg, dispatch, presets }: PanelProps) {
  return (
    <Section title="Bransch" sub="Kategorisering och förval. Du kan ändra mall och moduler direkt efter valet.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {presets.verticals.map((b) => {
          const on = cfg.branch === b.key
          const staffWord = b.terminology?.staff ?? 'Personal'
          return (
            <button
              key={b.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => dispatch({ type: 'applyBranch', key: b.key })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 14px',
                borderRadius: 12,
                border: `2px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                background: on ? 'var(--c-paper-2)' : 'var(--c-paper)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--dur-fast)',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  flex: 'none',
                  borderRadius: 10,
                  background: on ? 'var(--c-forest-fill, var(--c-forest))' : 'var(--c-paper-2)',
                  color: on ? 'var(--c-on-forest, #fff)' : 'var(--c-forest)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={BRANSCH_ICONS[b.key] ?? 'building'} size={19} />
              </span>
              <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 13.5, color: 'var(--c-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--c-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {staffWord}
                </span>
              </span>
              {on ? (
                <span style={{ color: 'var(--c-forest)', display: 'inline-flex' }}>
                  <Icon name="check" size={16} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </Section>
  )
}

/** namn — W1-REAL. Företagsnamn → setName (auto-syncs slug until touched); subdomän
 *  → setSlug (sets slugTouched, §10-risk-1); reserved-slug warning vs the REAL list. */
function PanelStart({ cfg, dispatch }: PanelProps) {
  return (
    <Panel
      title="Starta kunden"
      sub="Välj arbetssätt och fyll i de viktigaste uppgifterna först. Resten kan du göra själv eller låta kunden komplettera senare."
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <div role="radiogroup" aria-label="Onboardingsätt" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {([
            ['corevo', 'Corevo-moduler', 'Kunden startas med Corevos egna moduler och kan kompletteras i admin.'],
            ['external', 'Extern bokningsmotor', 'Webbplatsen och modulerna finns i Corevo, men Boka-knappar går till extern tjänst.'],
          ] as const).map(([mode, title, text]) => {
            const selected = cfg.onboardingMode === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => dispatch({ type: 'setOnboardingMode', mode })}
                style={{
                  minHeight: 128,
                  padding: 18,
                  borderRadius: 18,
                  border: `2px solid ${selected ? 'var(--c-forest)' : 'var(--c-line)'}`,
                  background: selected ? 'var(--c-paper-2)' : 'var(--c-paper)',
                  color: 'var(--c-ink)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 18 }}>{title}</strong>
                <span style={{ color: 'var(--c-ink-3)', fontSize: 13, lineHeight: 1.5 }}>{text}</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Field label="Företagsnamn" ph="t.ex. Freshcut" value={cfg.name} onChange={(v) => dispatch({ type: 'setName', value: v })} />
          <Field label="Stad" ph="t.ex. Linköping" value={cfg.city} onChange={(v) => dispatch({ type: 'setCity', value: v })} />
          <Field label="Kontaktperson" ph="Förnamn Efternamn" value={cfg.ownerName} onChange={(v) => dispatch({ type: 'setOwnerName', value: v })} />
          <Field label="E-post" type="email" required ph="kund@foretag.se" value={cfg.ownerEmail} onChange={(v) => dispatch({ type: 'setOwnerEmail', value: v })} />
        </div>

        <InfoCard
          icon="mail"
          title="Skicka insamling till kund — förberett, inte aktivt än"
          text="Här ska kunden senare kunna få en säker länk, fylla i sina uppgifter och skicka tillbaka. Backend för token, mail och returstatus är inte byggd ännu, så vi låtsas inte att knappen fungerar."
        />
      </div>
    </Panel>
  )
}

function PanelDomain({ cfg, dispatch }: PanelProps) {
  const reserved = cfg.slug ? isReservedSlug(cfg.slug) : false
  // Inline upptagen-koll (Dunder-fix): debounce → isSlugTaken-servern. Tidigare
  // small en dubblettslug först vid Lansera. Kollen är rådgivande — createTenant
  // äger fortfarande den auktoritativa unikhets-spärren.
  const [taken, setTaken] = useState(false)
  useEffect(() => {
    setTaken(false)
    if (!cfg.slug || reserved) return
    const t = setTimeout(() => {
      isSlugTaken(cfg.slug).then(setTaken).catch(() => {})
    }, 450)
    return () => clearTimeout(t)
  }, [cfg.slug, reserved])
  return (
    <Panel
      title="Subdomän & Cloudflare"
      sub="Välj kundens Corevo-adress och bocka av det manuella som måste vara sant innan kunden kan bli publik."
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <label style={labelStyle}>Subdomän</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 6,
              border: '1px solid var(--c-line)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--c-paper)',
            }}
          >
            <input
              value={cfg.slug}
              onChange={(e) =>
                dispatch({ type: 'setSlug', value: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
              }
              placeholder="klippoteket"
              autoCapitalize="none"
              spellCheck={false}
              style={{
                flex: 1,
                padding: '11px 13px',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-ui)',
                fontSize: 14,
                background: 'transparent',
                color: 'var(--c-ink)',
              }}
            />
            <span
              style={{
                padding: '0 14px',
                color: 'var(--c-ink-3)',
                fontSize: 14,
                fontFamily: 'var(--font-ui)',
                borderLeft: '1px solid var(--c-line)',
                alignSelf: 'stretch',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              .{tenantHostSuffix()}
            </span>
          </div>
          {reserved ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 12.5,
                color: 'var(--c-danger)',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <Icon name="alert" size={14} /> &quot;{cfg.slug}&quot; är reserverad — kan inte bli en subdomän.
            </div>
          ) : taken ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 12.5,
                color: 'var(--c-danger)',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <Icon name="alert" size={14} /> &quot;{cfg.slug}&quot; är redan tagen av en annan kund — välj en annan.
            </div>
          ) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <InfoCard title="Wrangler-skydd" text="Subdomänen ska finnas i deploy-konfigen innan framtida deploy, så aktiva kunder inte tappas av misstag." icon="shield" />
          <InfoCard title="Cloudflare DNS" text="Om kundens riktiga domän ska peka hit görs DNS manuellt hos kundens provider. Ingen wildcard-kostnad krävs för detta flöde." icon="globe" />
          <InfoCard title="Publicering" text="Kunden skapas under konfiguration. Den blir aktiv när sista kontrollen och DNS är klar." icon="checkCircle" />
        </div>
      </div>
    </Panel>
  )
}

function PanelSetup(props: PanelProps) {
  const { cfg, dispatch, presets } = props
  const branchTemplates = cfg.branch ? presets.templatesByVertical[cfg.branch] ?? [] : []
  const templates = (branchTemplates.length ? branchTemplates : SELECTABLE_THEMES).slice(0, 8)

  return (
    <Panel
      title="Bransch, mall & moduler"
      sub="Branschen är kategorisering och förval. Mallen och modulerna är kundens faktiska startpunkt."
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <BranchSection {...props} />

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={labelStyle}>Temamall</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {templates.map((template) => {
              const selected = cfg.theme === template.key
              return (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => dispatch({ type: 'setTheme', value: template.key })}
                  style={{
                    minHeight: 132,
                    padding: 14,
                    borderRadius: 16,
                    border: `2px solid ${selected ? 'var(--c-forest)' : 'var(--c-line)'}`,
                    background: 'var(--c-paper)',
                    color: 'var(--c-ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'grid',
                    alignContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span style={{ display: 'flex', gap: 6 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--c-forest)' }} />
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--c-gold)' }} />
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--c-paper-2)', border: '1px solid var(--c-line)' }} />
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 15 }}>{template.name}</strong>
                    <span style={{ color: 'var(--c-ink-3)', fontSize: 12 }}>{template.key}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <ModulesSection {...props} />
        <BookingSection {...props} />
      </div>
    </Panel>
  )
}

function PanelContent({ cfg, dispatch, presets }: PanelProps) {
  const booking = resolveModuleState(cfg, 'booking', presets) === 'live'
  const media = ['media_library', 'galleri'].some(
    (key) => resolveModuleState(cfg, key, presets) === 'live',
  )
  const products = resolveModuleState(cfg, 'shop', presets) === 'live'
  const courses = resolveModuleState(cfg, 'kurser', presets) === 'live'
  const setService = (index: number, patch: Partial<{ name: string; price: string }>) => {
    const services = cfg.services.length ? [...cfg.services] : [{ name: '', price: '' }]
    services[index] = { ...(services[index] ?? { name: '', price: '' }), ...patch }
    dispatch({ type: 'setServices', services })
  }
  const addService = () => dispatch({ type: 'setServices', services: [...cfg.services, { name: '', price: '' }] })
  const services = cfg.services.length ? cfg.services : [{ name: '', price: '' }]

  return (
    <Panel title="Förbered innehåll" sub="Allt här är valfritt. Skippa det som kunden eller du vill fylla i senare.">
      <div style={{ display: 'grid', gap: 18 }}>
        {booking ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={labelStyle}>Starttjänster</div>
            {services.map((service, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(120px, .6fr)', gap: 10 }}>
                <input value={service.name} onChange={(e) => setService(index, { name: e.target.value })} placeholder="Tjänst" style={{ minWidth: 0, padding: 12, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-paper)', color: 'var(--c-ink)' }} />
                <input value={service.price} onChange={(e) => setService(index, { price: e.target.value })} placeholder="Pris" style={{ minWidth: 0, padding: 12, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-paper)', color: 'var(--c-ink)' }} />
              </div>
            ))}
            <Button variant="ghost" size="sm" icon="plus" onClick={addService}>Lägg till tjänst</Button>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {booking ? <InfoCard title="Personal" text="Kan fyllas i senare från kundkortet/admin. Inget krav i onboarding." icon="users" /> : null}
          {booking ? <InfoCard title="Arbetstider" text="Bokningsbara tider styrs av personal, tjänster och öppettider efter skapandet." icon="calendar" /> : null}
          {media ? <InfoCard title="Bildbibliotek" text="Bilder läggs säkrast in i sidredigeraren efter att kunden skapats." icon="upload" /> : null}
          {products ? <InfoCard title="Produkter" text="Produkter kan läggas in senare i kundens admin. Onboarding blockerar inte skapandet." icon="layers" /> : null}
          {courses ? <InfoCard title="Kurser" text="Kurser kan läggas in senare i kundens admin. Onboarding blockerar inte skapandet." icon="calendar" /> : null}
          {!booking && !media && !products && !courses ? (
            <InfoCard title="Inget moduldata behövs" text="De valda modulerna kräver inget förarbete i det här steget. Du kan gå vidare direkt." icon="checkCircle" />
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

function PanelSite(props: PanelProps) {
  return <PanelAppearance {...props} />
}

function ModulesSection({ cfg, dispatch, presets }: PanelProps) {
  const modules = modulesForVertical(presets, cfg.branch)

  return (
    <Section title="Moduler" sub="Alla moduler är vanliga På/Av-val. Inget är låst som måste.">
      {!cfg.branch ? (
        <div style={{ padding: 14, border: '1px solid var(--c-line)', borderRadius: 10, background: 'var(--c-paper)' }}>
          <strong style={{ display: 'block', color: 'var(--c-ink)' }}>Välj bransch först</strong>
          <span style={{ display: 'block', marginTop: 5, color: 'var(--c-ink-3)', fontSize: 12.5 }}>
            Modulerna hämtas från branschens förval.
          </span>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {modules.map((module) => {
            const state = resolveModuleState(cfg, module.key, presets)
            return (
              <div
                key={module.key}
                style={{
                  padding: 14,
                  border: '1px solid var(--c-line)',
                  borderRadius: 12,
                  background: 'var(--c-paper)',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--c-ink)', fontSize: 14 }}>{module.name}</strong>
                    <span style={{ display: 'block', color: 'var(--c-ink-3)', fontSize: 12 }}>
                      Förval: {module.defaultState === 'live' ? 'På' : 'Av'}
                    </span>
                  </div>
                  <ModuleStatePills
                    label={`${module.name} På eller Av`}
                    value={state}
                    choices={[...MODULE_STATES]}
                    onChange={(next) => dispatch({ type: 'setModule', key: module.key, state: next })}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--c-ink-3)', lineHeight: 1.5, margin: 0 }}>
                  {MODULE_STATE_HINTS[state]}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function BookingSection({ cfg, dispatch, presets }: PanelProps) {
  const state = resolveModuleState(cfg, 'booking', presets)
  const live = state === 'live'
  const externalValid = normalizeBookingExternalUrl(cfg.bookingExternalUrl) !== null

  return (
    <Section title="Bokning" sub="Corevo eller extern motor styr bara Boka-knapparna. Andra moduler kan fortfarande vara på.">
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Bokningsmodul</div>
          <ModuleStatePills
            label="Bokningsmodul På eller Av"
            value={state}
            choices={[...MODULE_STATES]}
            onChange={(next) => dispatch({ type: 'setModule', key: 'booking', state: next })}
          />
          <p style={{ fontSize: 12, color: 'var(--c-ink-3)', lineHeight: 1.5, margin: '8px 0 0' }}>
            {MODULE_STATE_HINTS[state]}
          </p>
        </div>

        {live ? <>
          <div role="radiogroup" aria-label="Bokningsleverantör" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              ['corevo', 'Corevo-bokning', 'Kunden bokar direkt på sin Corevo-sida.'],
              ['external', 'Extern bokning', 'Boka-knapparna öppnar exempelvis Bokadirekt.'],
            ] as const).map(([provider, label, description]) => {
              const selected = cfg.bookingProvider === provider
              return (
                <button
                  key={provider}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => dispatch({ type: 'setBookingProvider', provider })}
                  style={{
                    textAlign: 'left',
                    padding: 14,
                    border: `2px solid ${selected ? 'var(--c-forest)' : 'var(--c-line)'}`,
                    borderRadius: 10,
                    background: selected ? 'var(--c-paper-2)' : 'var(--c-paper)',
                    color: 'var(--c-ink)',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 14 }}>{label}</strong>
                  <span style={{ display: 'block', marginTop: 5, color: 'var(--c-ink-3)', fontSize: 12, lineHeight: 1.45 }}>
                    {description}
                  </span>
                </button>
              )
            })}
          </div>

          {cfg.bookingProvider === 'external' ? (
            <Field
              label="Extern bokningslänk"
              type="url"
              required
              ph="https://www.bokadirekt.se/..."
              value={cfg.bookingExternalUrl}
              onChange={(value) => dispatch({ type: 'setBookingExternalUrl', value })}
              hint={cfg.bookingExternalUrl ? undefined : 'Alla Boka-knappar använder den här länken från start.'}
              error={cfg.bookingExternalUrl && !externalValid ? 'Ange en fullständig https-länk.' : undefined}
            />
          ) : (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Bokningssätt</div>
              <div role="radiogroup" aria-label="Bokningssätt" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {BOOKING_VARIANTS.map((variant) => {
                  const selected = cfg.variant === variant
                  return (
                    <button
                      key={variant}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => dispatch({ type: 'setVariant', variant })}
                      style={{
                        textAlign: 'left',
                        padding: 12,
                        border: `2px solid ${selected ? 'var(--c-forest)' : 'var(--c-line)'}`,
                        borderRadius: 10,
                        background: selected ? 'var(--c-paper-2)' : 'var(--c-paper)',
                        color: 'var(--c-ink)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{BOOKING_VARIANT_LABELS[variant]}</strong>
                        {variant === RECOMMENDED_BOOKING_VARIANT ? <Badge tone="gold" dot={false}>Rek.</Badge> : (
                          <small>{BOOKING_VARIANT_TAGS[variant]}</small>
                        )}
                      </span>
                      <span style={{ display: 'block', marginTop: 5, color: 'var(--c-ink-3)', fontSize: 12, lineHeight: 1.45 }}>
                        {BOOKING_VARIANT_DESCRIPTIONS[variant]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </> : (
          <div style={{ padding: 14, border: '1px solid var(--c-line)', borderRadius: 10, background: 'var(--c-paper)' }}>
            <strong style={{ display: 'block', color: 'var(--c-ink)' }}>Inga bokningsknappar visas</strong>
            <span style={{ display: 'block', marginTop: 5, color: 'var(--c-ink-3)', fontSize: 12.5 }}>
              Leverantören kan väljas senare när modulen slås på.
            </span>
          </div>
        )}
      </div>
    </Section>
  )
}

function PanelAppearance({ cfg, dispatch }: PanelProps) {
  return (
    <Panel
      title="Utseende"
      sub="Små startvärden. Kundens fulla sida finjusteras i redigeringsvyn efter skapandet."
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <Field
          label="Tagline"
          ph="Kort rad under varumärket"
          value={cfg.tagline}
          onChange={(value) => dispatch({ type: 'setTagline', value })}
        />
        <Field
          label="Hero-rubrik"
          ph="Lämna tomt för mallens rubrik"
          value={cfg.heroTitle}
          onChange={(value) => dispatch({ type: 'setHeroTitle', value })}
        />
        <Field
          label="Hero-ingress"
          ph="Lämna tomt för mallens ingress"
          value={cfg.heroLede}
          onChange={(value) => dispatch({ type: 'setHeroLede', value })}
        />
        <Field
          label="Accentfärg"
          ph="#173529"
          value={cfg.accent}
          onChange={(hex) => dispatch({ type: 'setAccent', hex })}
          hint={`Tema: ${cfg.theme}. Tomt betyder att temat styr färgen.`}
        />
      </div>
    </Panel>
  )
}

/** live — «Granska & lansera» (granska+live ihopslagna 2026-07-11, UX-order): kompakt
 *  checklista härledd ur REAL cfg + «vad kunden får»-kortet + den enda createTenant-
 *  triggern. Gold Lansera (disabled tills klart) → onLaunch; ActionState ytas av parent. */
function PanelReview({ cfg, dispatch, presets, onLaunch }: StudioPanelProps) {
  const activeModules = presets.modules.filter((m) => resolveModuleState(cfg, m.key, presets) !== 'off')
  const activeCount = activeModules.length
  const namedServices = cfg.services.filter((s) => s.name.trim() !== '')
  const bookingLive = resolveModuleState(cfg, 'booking', presets) === 'live'
  const bookingReady = !bookingLive
    || cfg.bookingProvider === 'corevo'
    || normalizeBookingExternalUrl(cfg.bookingExternalUrl) !== null
  const checks: { label: string; done: boolean; optional?: boolean }[] = [
    { label: 'Bransch vald', done: !!cfg.branch },
    { label: 'Namn & subdomän', done: !!cfg.name.trim() && !!cfg.slug },
    { label: 'Mall förvald av branschen', done: !!cfg.theme },
    {
      label: bookingLive
        ? cfg.bookingProvider === 'external' ? 'Extern bokningslänk' : 'Corevo-bokning'
        : 'Bokning är Av',
      done: bookingReady,
    },
    { label: `Tjänster (${namedServices.length} tillagda — läggs i adminen)`, done: namedServices.length > 0, optional: true },
    { label: 'Ägare inbjuds via e-post', done: !!cfg.ownerEmail.trim() },
  ]
  // Mirror createTenant's owner/name/slug requirements + a theme so the gold button
  // never fires a guaranteed-fail submit. Unset booking
  // floors to live in buildTenantOnboardingFormData, so we don't depend on the catalog read
  // (which fail-softs to [] and would otherwise permanently disable Lansera).
  // Tjänststeget togs bort 2026-07-11 (onboardingen ska vara superlätt att komma
  // igång — tjänster läggs i kundens admin EFTER lansering). Grinden krävde ändå
  // en namngiven tjänst men inget steg fanns att lägga den i → Lansera var
  // permanent disabled. Kravet är nu rådgivande (checklistan visar antalet), och
  // createTenants riktiga hard-blockers (namn + giltig slug + tema + ägare) gatar knappen.
  const ready =
    !!cfg.name.trim()
    && !!cfg.slug
    && !isReservedSlug(cfg.slug)
    && !!cfg.theme
    && !!cfg.ownerEmail.trim()
    && bookingReady
  return (
    <Panel title="Förhandsgranska & skapa" sub="Sista kontrollen innan kunden skapas. Skippade delar syns som valfria luckor, inte som stopp.">
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <Field
            label="Ägarens namn"
            ph="Förnamn Efternamn"
            value={cfg.ownerName}
            onChange={(value) => dispatch({ type: 'setOwnerName', value })}
          />
          <Field
            label="Ägarens e-post"
            type="email"
            required
            ph="agare@foretag.se"
            value={cfg.ownerEmail}
            onChange={(value) => dispatch({ type: 'setOwnerEmail', value })}
            hint="Får en engångs magic-link-invite när kunden skapas."
          />
        </div>
        {/* Kompakt checklista (ersätter det egna granska-steget) */}
        <div style={{ display: 'grid', gap: 6 }}>
          {checks.map((c) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--c-ink)' }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  flex: 'none',
                  borderRadius: 999,
                  background: c.done ? 'var(--c-success)' : c.optional ? 'var(--c-warning-bg)' : 'var(--c-paper-2)',
                  color: c.done ? '#fff' : c.optional ? 'var(--c-warning)' : 'var(--c-ink-3)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={c.done ? 'check' : c.optional ? 'minus' : 'clock'} size={12} />
              </span>
              <span style={{ fontWeight: c.done ? 500 : 600 }}>
                {c.label}
                {c.optional && !c.done ? <span style={{ color: 'var(--c-ink-3)', fontWeight: 400 }}> · valfritt</span> : null}
              </span>
            </div>
          ))}
        </div>

        {/* Vad kunden får */}
        <Card pad={18} style={{ background: 'var(--c-forest-fill, var(--c-forest))', color: 'var(--c-on-forest, #fff)', border: 'none' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--c-gold)' }}>
            Kunden får
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, margin: '8px 0 4px' }}>
            {tenantStorefrontHost(
              cfg.slug || studioPlaceholderSlug(studioBranchName(presets.verticals, cfg.branch)),
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-on-forest-2)', lineHeight: 1.6 }}>
            Tema <b style={{ color: 'var(--c-on-forest, #fff)' }}>{cfg.theme}</b> · {activeCount}{' '}
            {activeCount === 1 ? 'modul' : 'moduler'}:{' '}
            {activeModules.map((m) => m.name).join(', ') || '—'}
            <br />
            Bokning: {bookingLive ? cfg.bookingProvider === 'external' ? 'extern länk' : 'Corevo' : 'Av'}
            <br />
            {namedServices.length} {namedServices.length === 1 ? 'tjänst' : 'tjänster'} redo att bokas
            {cfg.ownerEmail.trim() ? <> · ägar-inbjudan till {cfg.ownerEmail.trim()}</> : null}
          </div>
        </Card>

        {!ready ? (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--c-warning)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: '12px 14px',
              background: 'var(--c-warning-bg)',
              borderRadius: 10,
            }}
          >
            <span style={{ flex: 'none', marginTop: 1 }}>
              <Icon name="alert" size={14} />
            </span>
            Kräver: företagsnamn, en giltig subdomän, ett tema, ägarens e-post
            {bookingLive && cfg.bookingProvider === 'external' ? ' och en giltig extern bokningslänk' : ''}.
            Komplettera i stegen ovan.
          </div>
        ) : null}

        <div style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.6 }}>
          Nu skapas tenant, inställningar, moduler och ägarkonto i status
          <b> Under konfiguration</b>. Den isolerade standardadressen är reserverad,
          men öppnas först när kundkortets DB-kontroll är grön och du publicerar.
        </div>

        <Button variant="gold" size="lg" icon="rocket" disabled={!ready} onClick={onLaunch} style={{ justifyContent: 'center', width: '100%' }}>
          Skapa {cfg.name || 'kunden'}
        </Button>
      </div>
    </Panel>
  )
}

/* ════════════════════════════ registry ════════════════════════════ */

/**
 * step id → panel component. Internal to this file + PanelHost (nothing else imports
 * it). Simple panels are typed `FC<PanelProps>` and slot in under parameter
 * contravariance; live takes the extra onLaunch callback via StudioPanelProps.
 */
export const PANEL_BY_STEP: Record<StepId, FC<StudioPanelProps>> = {
  start: PanelStart,
  setup: PanelSetup,
  content: PanelContent,
  site: PanelSite,
  domain: PanelDomain,
  review: PanelReview,
}
