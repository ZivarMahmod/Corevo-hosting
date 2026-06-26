'use client'

// Onboarding-studio (goal-48 W2) — STRUCTURAL module-section mocks for the live
// storefront preview. The REAL *Section components (ShopSection/OffertSection/…) are
// async SERVER components that DB-query by { tenantId, slug } — an unsaved StudioCfg
// has neither, so they cannot run here. These are honest STRUCTURAL stand-ins ported
// from the design's moduleBody renderers (preview.jsx:127–390), but translated to read
// the SHARED storefront CSS custom props (var(--color-*)/var(--font-*)) so they
// re-theme together with the real <Layout/> under the one data-world="storefront"
// wrapper (StorefrontPreview §3). They show the SHAPE + per-bransch form structure,
// NEVER the operator's data: no fake services, no fake balances, no fake success —
// every live mock carries a visible "byggs vid lansering" tag (mockup ≠ funktion).
//
// ACCENT vs THEME (advisor): surfaces the design tinted with t.primary (= the accent,
// preview.jsx:453) map to var(--color-accent) so a live accent change re-tints them;
// theme STRUCTURE (headings/borders/body text) maps to var(--color-primary)/-fg/-line.
//
// Composition order is the REAL order (app/(public)/page.tsx:74–102): shop → offert →
// blogg → lojalitet → presentkort, then roadmap modules; konto-position modules split
// into a separate forward-looking "Mitt konto" panel.

import type { CSSProperties, ReactNode } from 'react'
import { resolveModuleState } from '@/lib/platform/onboarding-studio/model'
import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { makeTerm } from '@/lib/platform/verticals-shared'
import { BUILT_MAIN, ROADMAP_MAIN, KONTO_KEYS, ALL_PREVIEW_MODULES } from '@/lib/platform/onboarding-studio/module-keys'

/** The visible, honest "this is a preview, not the built feature" marker on each mock. */
export const MODULE_LABEL = 'Förhandsvisning · byggs vid lansering'

// resolveModuleState only consults the preset table to fill defaults for modules the
// operator hasn't touched. Once a bransch is picked, applyBranch (model.ts:61-63) has
// ALREADY seeded cfg.moduleStates for every module, so that fallback is never reached
// and an EMPTY table yields identical results; a fresh (no-bransch) cfg correctly
// resolves every module to 'off'. So the preview is faithful from cfg alone — no need
// to thread the (server-fetched) presets into the client preview. See the proof test.
const NO_PRESETS: VerticalPresetData = { verticals: [], modules: [], templatesByVertical: {} }

/** Effective module state for the preview, from cfg alone (see NO_PRESETS note). */
export function moduleState(cfg: StudioCfg, key: string) {
  return resolveModuleState(cfg, key, NO_PRESETS)
}

/** A module is shown in the preview when it is live (rendered) or paused (read-only). */
export function isActive(state: ReturnType<typeof moduleState>): boolean {
  return state === 'live' || state === 'paused'
}

// Module-key lists live in a plain (server-safe) module so the look preview ROUTE (a
// server component) can import them; re-exported here for existing client importers.
export { BUILT_MAIN, ROADMAP_MAIN, KONTO_KEYS, ALL_PREVIEW_MODULES }

/** The module keys ACTIVE for this cfg — what flows into the render-bron look preview
 *  (goal-36: "välj modul → vävs in i den valda mallen, syns i previewen"). The studio
 *  threads these to the look iframe; the route rebuilds a cfg from them. */
export function activeModuleKeys(cfg: StudioCfg): string[] {
  return ALL_PREVIEW_MODULES.filter((k) => isActive(moduleState(cfg, k)))
}

// Storefront section titles + the konto/roadmap ones (preview.jsx:421-426).
const SECTION_TITLES: Record<string, string> = {
  shop: 'Webshop',
  offert: 'Begär offert',
  blogg: 'Journal',
  lojalitet: 'Stammis',
  presentkort: 'Presentkort',
  portfolio: 'Portfolio',
  meny: 'Meny',
  recurring: 'Återkommande',
  deposit: 'Deposit',
  inlamning: 'Lämna in',
  husdjur: 'Husdjursprofil',
  fordon: 'Ditt fordon',
  intag: 'Hälsoformulär',
  orderstatus: 'Orderstatus',
}

// ── Per-bransch meta (ported from cfg-data.js BRANCHES) ─────────────────────────
// Only the fields the preview needs: display name (nav/footer fallback), the uppercase
// section eyebrow, and the staff/service terminology words. cfg-only → no real
// terminology overlay is available, so we derive it from this canonical design table.
export type BranschMeta = { name: string; eyebrow: string; staffWord: string; serviceWord: string }

const GENERELL: BranschMeta = {
  name: 'Din verksamhet',
  eyebrow: 'Boka online',
  staffWord: 'Personal',
  serviceWord: 'Tjänst',
}

const BRANSCH_META: Record<string, BranschMeta> = {
  generell: GENERELL,
  frisor: { name: 'Frisörsalong', eyebrow: 'Frisörsalong', staffWord: 'Frisör', serviceWord: 'Behandling' },
  florist: { name: 'Florist', eyebrow: 'Blomsterhandel', staffWord: 'Florist', serviceWord: 'Arrangemang' },
  klinik: { name: 'Privatklinik', eyebrow: 'Naprapat · Kiropraktor', staffWord: 'Behandlare', serviceWord: 'Behandling' },
  bilverkstad: { name: 'Bilverkstad', eyebrow: 'Bilverkstad', staffWord: 'Mekaniker', serviceWord: 'Servicetyp' },
  cykel: { name: 'Cykelbutik', eyebrow: 'Cykel & service', staffWord: 'Mekaniker', serviceWord: 'Servicetyp' },
  hund: { name: 'Hundsalong', eyebrow: 'Hundsalong', staffWord: 'Groomer', serviceWord: 'Behandling' },
  nagel: { name: 'Nagelsalong', eyebrow: 'Nagelsalong', staffWord: 'Nagelterapeut', serviceWord: 'Behandling' },
  tatuering: { name: 'Tatueringsstudio', eyebrow: 'Tattoo studio', staffWord: 'Artist', serviceWord: 'Stil' },
  optiker: { name: 'Optiker', eyebrow: 'Optiker', staffWord: 'Optiker', serviceWord: 'Undersökning' },
  cafe: { name: 'Café', eyebrow: 'Café & konditori', staffWord: 'Personal', serviceWord: 'Produkt' },
  skraddare: { name: 'Skräddare', eyebrow: 'Skrädderi', staffWord: 'Skräddare', serviceWord: 'Tjänst' },
  lassmed: { name: 'Låssmed', eyebrow: 'Låssmed', staffWord: 'Låssmed', serviceWord: 'Tjänst' },
  fotograf: { name: 'Fotostudio', eyebrow: 'Fotostudio', staffWord: 'Fotograf', serviceWord: 'Shoot-typ' },
  secondhand: { name: 'Second hand', eyebrow: 'Second hand', staffWord: 'Personal', serviceWord: 'Vara' },
  stad: { name: 'Städföretag', eyebrow: 'Städtjänster', staffWord: 'Städare', serviceWord: 'Städtyp' },
  restaurang: { name: 'Restaurang', eyebrow: 'Restaurang', staffWord: 'Personal', serviceWord: 'Bord' },
}

/** Bransch meta with the design's `BRANCHES[branch] || {…}` fallback (preview.jsx:454):
 *  branch=null (the studio's FIRST render, before a bransch is picked) and unknown keys
 *  fall back to the neutral generell meta so the always-rendered chrome never crashes. */
export function branschMeta(branch: string | null): BranschMeta {
  if (!branch) return GENERELL
  return BRANSCH_META[branch] ?? GENERELL
}

// Per-bransch offert fields (preview.jsx:148-156) — the FORM TEMPLATE, not operator
// data, so showing the labels is honest and the per-bransch teaching point.
const OFFERT_FIELDS: Record<string, string[]> = {
  florist: ['Tillfälle (bröllop/event)', 'Datum', 'Antal gäster', 'Budget'],
  bilverkstad: ['Servicetyp', 'Regnr', 'Märke & modell', 'Önskat datum'],
  tatuering: ['Storlek (cm)', 'Placering', 'Referensbild', 'Beskrivning'],
  stad: ['Yta (kvm)', 'Frekvens', 'Typ av städning', 'Adress'],
  fotograf: ['Typ av shoot', 'Antal timmar', 'Plats', 'Datum'],
  skraddare: ['Plaggtyp', 'Material', 'Ändring eller nytt', 'Klart senast'],
  cykel: ['Vad gäller det?', 'Märke & modell', 'Beskrivning', 'Önskat datum'],
}
const OFFERT_FIELDS_DEFAULT = ['Vad gäller det?', 'Önskat datum', 'Beskrivning', 'Budget']

// Per-bransch shop note (cfg-data.js shop.variants) — a structural caption, not data.
const SHOP_NOTE: Record<string, string> = {
  florist: 'Leverans eller upphämtning väljs i kassan.',
  cafe: 'Förbeställning med hämtdatum.',
  optiker: 'Bågbeställning med receptkoppling.',
  secondhand: 'Unika varor — lagersaldo 1.',
  cykel: 'Delar och tillbehör.',
}

// ── shared style atoms (token-driven) ─────────────────────────────────────────
const card: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--sf-radius)',
  overflow: 'hidden',
}
const skel = (w: CSSProperties['width'], h: number): CSSProperties => ({
  width: w,
  height: h,
  borderRadius: 6,
  background: 'var(--color-line)',
})
const imgFill: CSSProperties = {
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 30%, var(--color-bg)), color-mix(in srgb, var(--color-primary) 10%, var(--color-bg)))',
}
// ACCENT-bearing pill (the live-tintable surface). var(--color-accent) is theme-primary
// by default and the inline-injected cfg.accent when set → this re-tints on accent change.
const accentPill: CSSProperties = {
  display: 'inline-block',
  background: 'var(--color-accent)',
  color: 'var(--color-accent-fg)',
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 600,
  padding: '8px 16px',
  borderRadius: 'var(--sf-radius)',
}

/** The honest visible marker pill rendered on every live mock section. */
function PreviewTag() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-body)',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.04em',
        color: 'var(--color-fg-2)',
        background: 'var(--color-accent-soft)',
        border: '1px solid var(--color-line)',
        borderRadius: 999,
        padding: '3px 10px',
      }}
    >
      {MODULE_LABEL}
    </span>
  )
}

/** Paused = the module is configured but hidden from the public site (read-only). */
function PausedTag() {
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color: 'var(--color-fg-2)',
        border: '1px dashed var(--color-line)',
        borderRadius: 999,
        padding: '3px 10px',
      }}
    >
      Pausad · visas inte publikt
    </span>
  )
}

function Section({
  title,
  eyebrow,
  paused,
  children,
}: {
  title: string
  eyebrow: string
  paused: boolean
  children: ReactNode
}) {
  return (
    <section style={{ scrollMarginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="sf-h2" style={{ margin: 0 }}>
            {title}
          </h2>
          <PreviewTag />
          {paused ? <PausedTag /> : null}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--color-primary)',
            fontWeight: 600,
          }}
        >
          {eyebrow}
        </span>
      </div>
      {children}
    </section>
  )
}

// ── the structural mocks ───────────────────────────────────────────────────────

function ShopMock({ branch }: { branch: string }) {
  const note = SHOP_NOTE[branch]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={card}>
            <div style={{ ...imgFill, height: 110 }} />
            <div style={{ padding: 13 }}>
              <div style={skel('70%', 12)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <div style={skel(54, 12)} />
                <span style={accentPill}>Köp</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {note ? (
        <p className="sf-body" style={{ fontSize: 13, marginTop: 12 }}>
          {note}
        </p>
      ) : null}
    </div>
  )
}

function OffertMock({ branch, serviceWord }: { branch: string; serviceWord: string }) {
  const fields = OFFERT_FIELDS[branch] ?? OFFERT_FIELDS_DEFAULT
  return (
    <div style={{ ...card, padding: 20 }}>
      <p className="sf-body" style={{ fontSize: 13, margin: '0 0 14px' }}>
        Beskriv din {serviceWord.toLowerCase()} så återkommer vi.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {fields.map((f) => (
          <div key={f}>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-fg-2)',
                marginBottom: 5,
              }}
            >
              {f}
            </div>
            <div style={{ height: 38, borderRadius: 'var(--sf-radius)', border: '1px solid var(--color-line)', background: 'var(--color-bg)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-fg-2)' }}>Förfrågningar landar hos er</span>
        <span style={accentPill}>Skicka förfrågan</span>
      </div>
    </div>
  )
}

function BloggMock() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={card}>
          <div style={{ ...imgFill, height: 90 }} />
          <div style={{ padding: 13 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--color-primary)' }}>Artikel</div>
            <div style={{ ...skel('80%', 14), marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function LojalitetMock({ branch }: { branch: string }) {
  const points = branch === 'cafe' || branch === 'restaurang'
  return (
    <div
      style={{
        background: 'var(--color-accent)',
        color: 'var(--color-accent-fg)',
        borderRadius: 'var(--sf-radius)',
        padding: 22,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22 }}>Bli stammis</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, opacity: 0.9, marginTop: 4 }}>
          {points
            ? 'Samla poäng på varje köp — lös in mot förmåner.'
            : 'Stämpelkort — samla stämplar mot en förmån.'}
        </div>
      </div>
      {points ? (
        <div
          style={{
            width: 150,
            height: 8,
            borderRadius: 999,
            background: 'color-mix(in srgb, var(--color-accent-fg) 28%, transparent)',
          }}
        />
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                border: '1.5px solid color-mix(in srgb, var(--color-accent-fg) 55%, transparent)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PresentkortMock() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {[200, 500, 1000].map((v) => (
        <div
          key={v}
          style={{
            flex: '1 1 130px',
            minWidth: 130,
            background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 62%, #000))',
            color: 'var(--color-accent-fg)',
            borderRadius: 'var(--sf-radius)',
            padding: 20,
          }}
        >
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.85 }}>
            Presentkort
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, margin: '6px 0 10px' }}>{v} kr</div>
          <span
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 'var(--sf-radius)',
              border: '1px solid color-mix(in srgb, var(--color-accent-fg) 55%, transparent)',
            }}
          >
            Köp digitalt
          </span>
        </div>
      ))}
    </div>
  )
}

/** The design's honest dashed "Roadmap" stub (preview.jsx:410-417) for not-yet-built
 *  modules. The title comes from SECTION_TITLES; the card text is the honest stub copy. */
function RoadmapCard({ moduleKey }: { moduleKey: string }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--sf-radius)',
        border: '1px dashed var(--color-line)',
        padding: 22,
        fontFamily: 'var(--font-body)',
        fontSize: 13.5,
        color: 'var(--color-fg-2)',
      }}
    >
      <b style={{ color: 'var(--color-fg)' }}>{SECTION_TITLES[moduleKey] ?? moduleKey}</b> — roadmap-modul. Aktiveras och
      byggs ut vid lansering.
    </div>
  )
}

function renderBody(key: string, branch: string, serviceWord: string): ReactNode {
  switch (key) {
    case 'shop':
      return <ShopMock branch={branch} />
    case 'offert':
      return <OffertMock branch={branch} serviceWord={serviceWord} />
    case 'blogg':
      return <BloggMock />
    case 'lojalitet':
      return <LojalitetMock branch={branch} />
    case 'presentkort':
      return <PresentkortMock />
    default:
      return <RoadmapCard moduleKey={key} />
  }
}

/** All active PUBLIC main sections: the 5 BUILT mocks + roadmap dashed cards, in the
 *  real composition order, each gated by resolveModuleState (live → render, paused →
 *  read-only notice, off/draft → absent). Returns null when none are active → the
 *  preview is the bare <Layout/> (its services rows already cover booking). */
export function ModuleSections({ cfg }: { cfg: StudioCfg }) {
  const branch = cfg.branch ?? 'generell'
  const meta = branschMeta(cfg.branch)
  const term = makeTerm({ staff: meta.staffWord, service: meta.serviceWord })
  const ordered = [...BUILT_MAIN, ...ROADMAP_MAIN]
  const sections = ordered
    .map((key) => ({ key, state: moduleState(cfg, key) }))
    .filter(({ state }) => isActive(state))
  if (sections.length === 0) return null
  return (
    <>
      {sections.map(({ key, state }) => (
        <Section key={key} title={SECTION_TITLES[key] ?? key} eyebrow={meta.eyebrow} paused={state === 'paused'}>
          {renderBody(key, branch, term('service', meta.serviceWord))}
        </Section>
      ))}
    </>
  )
}

/** The "Mitt konto" customer-portal panel — modules with defaultPos:"konto"
 *  (husdjur/fordon/intag/orderstatus). No real konto storefront surface exists yet, so
 *  the whole panel is marked as a forward-looking structural preview (honest). */
export function KontoPanel({ cfg }: { cfg: StudioCfg }) {
  const active = KONTO_KEYS.filter((k) => isActive(moduleState(cfg, k)))
  if (active.length === 0) return null
  return (
    <section>
      <div
        style={{
          background: 'color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--sf-radius)',
          padding: '26px 28px 30px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16, flexWrap: 'wrap' }}>
          <span
            style={{
              width: 36,
              height: 36,
              flex: 'none',
              borderRadius: 999,
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
            }}
          >
             K
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: 'var(--color-fg)' }}>Mitt konto</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-fg-2)' }}>
              Inloggad kundportal · byggs vid lansering
            </div>
          </div>
          <PreviewTag />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          {active.map((k) => (
            <div key={k}>
              <h3 className="sf-h2" style={{ margin: '0 0 10px', fontSize: 17 }}>
                {SECTION_TITLES[k] ?? k}
              </h3>
              <RoadmapCard moduleKey={k} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── storefront chrome (preview-only nav + footer) ──────────────────────────────
// The real Nav/FooterFull are server + currentTenant-bound ((public)/layout.tsx); the
// preview uses these ported structural stand-ins. The nav is NORMAL-FLOW and exactly
// --nav-h tall so Salvia's hero `margin-top: calc(-1*--nav-h)` tucks under it instead
// of clipping (StorefrontPreview risk #1).

export function PreviewNav({ cfg }: { cfg: StudioCfg }) {
  const meta = branschMeta(cfg.branch)
  const navKeys = BUILT_MAIN.filter((k) => isActive(moduleState(cfg, k))).slice(0, 4)
  const hasKonto = KONTO_KEYS.some((k) => isActive(moduleState(cfg, k)))
  const bookingActive = isActive(moduleState(cfg, 'booking'))
  return (
    <div
      style={{
        height: 'var(--nav-h)',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        padding: '0 32px',
        borderBottom: '1px solid var(--color-line)',
        background: 'var(--color-bg)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--color-fg)' }}>
        {cfg.name || meta.name}
      </span>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {navKeys.map((k) => (
          <span key={k} style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-fg-2)' }}>
            {SECTION_TITLES[k] ?? k}
          </span>
        ))}
        {hasKonto ? (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-fg-2)' }}>Mitt konto</span>
        ) : null}
        {bookingActive ? <span style={accentPill}>Boka tid</span> : null}
      </nav>
    </div>
  )
}

export function PreviewFooter({ cfg }: { cfg: StudioCfg }) {
  const meta = branschMeta(cfg.branch)
  const slug = cfg.slug || 'dinsalong'
  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-line)',
        background: 'var(--color-accent-soft)',
        padding: '32px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
      }}
    >
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-fg)' }}>{cfg.name || meta.name}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-fg-2)', marginTop: 6 }}>{slug}.corevo.se</div>
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-fg-2)', lineHeight: 1.8, textAlign: 'right' }}>
        <div>Kontakt &amp; öppettider</div>
        <div>visas när de fyllts i</div>
      </div>
    </footer>
  )
}
