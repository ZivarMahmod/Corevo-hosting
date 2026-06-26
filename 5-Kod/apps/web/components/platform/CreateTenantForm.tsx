'use client'

import { useActionState, useMemo, useRef, useState, type ReactNode } from 'react'
import { createTenant, type ActionState } from '@/lib/platform/actions'
import {
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_TAGS,
  BOOKING_VARIANT_DESCRIPTIONS,
  RECOMMENDED_BOOKING_VARIANT,
  DEFAULT_BOOKING_VARIANT,
  type BookingVariant,
} from '@/lib/platform/booking-variant'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
import { modulesForVertical, type VerticalPresetData, type TemplateOption } from '@/lib/platform/verticals-shared'
import { onboardingSteps } from '@/lib/platform/onboarding-steps'
import { PageHead, Card, Button, Badge, Icon } from '@/components/portal/ui'
import { Callout } from '@/components/portal/ui'
// Sajtbyggare S3 (goal-38): den flagg-gatade "Designa sidan"-onboardingeditorn.
// SiteEditor i 'onboarding'-läge (ingen Spara/iframe — tenant finns ej än) lyfter
// draften hit via onDraftChange → dolt <input name="site_content_draft">. Region-
// frö = resolveSiteContent på salvia-manifestet (alla theme-defaults, PURE).
import {
  SiteEditor,
  type SiteEditorRegion,
} from '@/components/admin/SiteEditor'
import { resolveSiteContent } from '@/lib/sajtbyggare/resolve'
import { SALVIA_REGION_MANIFEST } from '@/lib/sajtbyggare/manifest/salvia'
import { type Draft } from '@/lib/sajtbyggare/editor/overlay-model'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

// ── Module-state UI metadata (the "Moduler" step / multi-bransch spår 5) ─────────
// state-toggle per module: a tenant_modules.state. booking is floored to 'live' in
// the UI (the platform baseline + FreshCut-parity), so its only choices are live/
// paused; every other module can also sit at draft/off. The publishable states the
// operator can pick in the wizard (the DB also knows 'off' = simply not selected).
const MODULE_STATE_LABELS: Record<ModuleState, string> = {
  off: 'Av',
  draft: 'Utkast',
  live: 'Live',
  paused: 'Pausad',
}
const MODULE_STATE_HINTS: Record<ModuleState, string> = {
  off: 'Inte aktiverad.',
  draft: 'Aktiverad men dold publikt — syns bara internt.',
  live: 'Publik på storefronten.',
  paused: 'Tillfälligt stängd — visar "stängt" publikt.',
}

// ── The five storefront themes ──────────────────────────────────────────────────
// Palette / fonts MIRROR the live [data-theme] tokens (packages/ui/tokens.css) and
// the per-theme copy mirrors THEME_CONTENT, so the onboarding preview shows the REAL
// look of each template — what the operator picks here is exactly what the storefront
// renders (settings.theme → [data-theme]). hero img = each theme's own default photo
// (THEME_CONTENT.heroImages[0]) so the preview reflects the real storefront, not a
// generic stand-in. Keep these in sync with tokens.css / theme-content.ts.
type ThemeKey = 'salvia' | 'leander' | 'zigge' | 'linnea' | 'edit'
type ThemeDef = {
  name: string
  primary: string
  bg: string
  fg: string
  fg2: string
  line: string
  display: string
  radius: number
  caps: boolean
  vibe: string
  eyebrow: string
  hero: string
  lede: string
  img: string
}
const uns = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`
const THEME_KEYS: ThemeKey[] = ['salvia', 'leander', 'zigge', 'linnea', 'edit']
const WIZARD_THEMES: Record<ThemeKey, ThemeDef> = {
  salvia: {
    name: 'Salvia', primary: '#5E7361', bg: '#F6F4EE', fg: '#232520', fg2: '#5C5F55', line: '#E2DED2',
    display: "'Cormorant Garamond', Georgia, serif", radius: 10, caps: false, vibe: 'Lugn & minimal',
    eyebrow: 'Frisörsalong', hero: 'Skarpt klippt. Skönt mottagen.',
    lede: 'En stilla salong där varje klippning får ta sin tid.', img: uns('1521590832167-7bcbfaa6381f'),
  },
  leander: {
    name: 'Leander', primary: '#7E6E92', bg: '#FBFAF8', fg: '#2A2630', fg2: '#6A6472', line: '#ECE7EF',
    display: "'Playfair Display', Georgia, serif", radius: 14, caps: false, vibe: 'Romantisk editorial',
    eyebrow: 'Salong & studio', hero: 'Din stund av lugn.',
    lede: 'Mjuka toner och varsam hand i en romantisk miljö.', img: uns('1633681926035-ec1ac984418a'),
  },
  zigge: {
    name: 'Zigge', primary: '#C8743C', bg: '#14120E', fg: '#F2ECE2', fg2: '#B3A998', line: '#322C24',
    display: "'Bebas Neue', sans-serif", radius: 4, caps: true, vibe: 'Mörk & rå barber',
    eyebrow: 'Barber & frisör', hero: 'Skarp fade. Ren stil.',
    lede: 'Klassisk barbering med modern attityd.', img: uns('1585747860715-2ba37e788b70'),
  },
  linnea: {
    name: 'Linnea', primary: '#B0693F', bg: '#F4EDE1', fg: '#2E2820', fg2: '#6E6452', line: '#E3D9C8',
    display: "'DM Serif Display', Georgia, serif", radius: 12, caps: false, vibe: 'Varm skandinavisk',
    eyebrow: 'Hår & välmående', hero: 'Naturligt vacker.',
    lede: 'Varma jordnära toner i en avslappnad salong.', img: uns('1595476108010-b4d1f102b1b1'),
  },
  edit: {
    name: 'Edit', primary: '#3A3733', bg: '#F8F6F1', fg: '#232220', fg2: '#6B675F', line: '#E5E0D6',
    display: "'Cormorant Garamond', Georgia, serif", radius: 2, caps: false, vibe: 'Elegant minimal',
    eyebrow: 'Hair atelier', hero: 'Tidlöst. Editorial.',
    lede: 'Ren typografi och skarp komposition.', img: uns('1599351431202-1e0f0137899a'),
  },
}

// Multi-bransch: the chosen template key is now a free string (it comes from the
// `templates` catalog filtered by bransch, not just the built-in five). A key that
// matches one of the five renders its rich preview; an unknown DB key falls back to
// this neutral ThemeDef so the preview never crashes on a not-yet-styled template.
function neutralTheme(name: string): ThemeDef {
  return {
    name, primary: '#5E7361', bg: '#F6F4EE', fg: '#232520', fg2: '#5C5F55', line: '#E2DED2',
    display: "'Cormorant Garamond', Georgia, serif", radius: 10, caps: false, vibe: 'Förhandsvisning',
    eyebrow: 'Storefront', hero: 'Din sida. Din stil.',
    lede: 'Mallens egna färger och bilder sätts när den är färdigstylad.', img: uns('1521590832167-7bcbfaa6381f'),
  }
}
/** Preview metadata for a template key: the rich built-in theme when known, else a
 *  neutral fallback carrying the template's display name. */
function wizardTheme(key: string, name?: string): ThemeDef {
  return (WIZARD_THEMES as Record<string, ThemeDef>)[key] ?? neutralTheme(name ?? key)
}

// Multi-bransch (spår 5): a NEW step 0 "Bransch" leads the wizard (preset-driven),
// and the old "Bokningsvariant" step is replaced by "Moduler" (state-toggle per
// module; booking.variant survives as a sub-choice there). The remaining steps keep
// their design intent, shifted one index down.
//
// Sajtbyggare S3 (goal-38): two step-sequences. STEPS_LEGACY = the flag-OFF wizard,
// BYTE-IDENTICAL to before (Temamall + Token-branding as separate steps). STEPS_EDITOR
// = the flag-ON wizard, where Temamall + Token-branding are REPLACED by a single
// "Designa sidan" step (the in-wizard SiteEditor; theme comes from the vertical default
// chooseVertical already sets, so no theme-picker is needed). The active sequence is
// chosen per-render from `editorEnabled`; every step's JSX is gated on the step LABEL
// (STEPS[step]) — never a hardcoded index — so both sequences map to the right block.
// Stegsekvenserna (legacy vs editor) bor i lib/platform/onboarding-steps.ts (PURE +
// testad, onboarding-steps.test.ts) — onboardingSteps(editorEnabled) väljer aktiv.
// Accent swatches = the five theme primaries (design step "Token-branding").
const ACCENTS = ['#5E7361', '#7E6E92', '#C8743C', '#B0693F', '#3A3733']

// Svenska etiketter per salvia-region-nyckel (mirror av admin/sajtbyggare/page.tsx
// REGION_LABELS — kopierad så onboardingeditorn visar samma etiketter). Saknad nyckel
// faller tillbaka på själva nyckeln så en framtida region aldrig blir osynlig.
const REGION_LABELS: Record<string, string> = {
  'hero.eyebrow': 'Etikett ovanför rubrik',
  'hero.title': 'Rubrik (hero)',
  'hero.lede': 'Ingress (hero)',
  'about.copy': 'Om oss — text',
  'footer.tagline': 'Slogan (sidfot)',
  'about.italic': 'Om oss — kursiv fras',
  'hero.image': 'Hero-bild',
  'about.image': 'Om oss — bild',
  'closing.image': 'Avslutningsbild',
  'color.primary': 'Primärfärg',
  'color.bg': 'Bakgrundsfärg',
  'color.fg': 'Textfärg',
  'color.accent': 'Accentfärg',
  'font.body': 'Brödtypsnitt',
  logo: 'Logotyp',
}

/** name → a clean storefront slug (a–z, 0–9, bindestreck) — mirrors validateSlug. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "Bokning (Live), Bildbibliotek (Utkast)" — the non-off modules for the summary. */
function liveModuleSummary(
  options: { key: string; name: string }[],
  stateFor: (key: string) => ModuleState,
): string {
  return options
    .map((m) => ({ m, st: stateFor(m.key) }))
    .filter(({ st }) => st !== 'off')
    .map(({ m, st }) => `${m.name} (${MODULE_STATE_LABELS[st]})`)
    .join(', ')
}

export function CreateTenantForm({
  presets,
  editorEnabled,
}: {
  presets: VerticalPresetData
  /** Sajtbyggare S3 (goal-38): SAJTBYGGARE_ENABLED, beräknad server-side och
   *  inskickad. true → "Designa sidan"-steget (in-wizard SiteEditor) ersätter
   *  Temamall + Token-branding. false → BYTE-IDENTISK legacy-wizard. */
  editorEnabled: boolean
}) {
  // Aktiv stegsekvens + sista index — härledda ur flaggan. Stepper + footer-navigering
  // är index-baserade (de fungerar för båda sekvenserna); varje stegs JSX gatas på
  // etiketten STEPS[step], aldrig på ett hårdkodat index.
  const STEPS = onboardingSteps(editorEnabled)
  const LAST_STEP = STEPS.length - 1
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenant, {})
  const [step, setStep] = useState(0)
  // Multi-bransch (spår 5): the chosen vertical (bransch). null = none picked yet —
  // the operator can still skip it (vertical_id is a mjuk, mutabel FK). Picking a
  // bransch prefills the theme + the per-module preset states (see chooseVertical).
  const [verticalKey, setVerticalKey] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [city, setCity] = useState('')
  // Multi-bransch: theme = the chosen template key (free string from the bransch-
  // filtered `templates` catalog; defaults to the built-in 'salvia'). Rendered via
  // wizardTheme() so a DB template key outside the built-in five still previews.
  const [theme, setTheme] = useState<string>('salvia')
  const [variant, setVariant] = useState<BookingVariant>(DEFAULT_BOOKING_VARIANT)
  // Per-module states (the "Moduler" step) → tenant_modules rows. Keyed by module_key.
  // Seeded from the bransch preset; booking is always floored to 'live' before submit.
  const [moduleStates, setModuleStates] = useState<Record<string, ModuleState>>({})
  const [accent, setAccent] = useState('') // '' = none picked yet
  const [tagline, setTagline] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [logoName, setLogoName] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)
  // Sajtbyggare S3 (goal-38): den onboarding-editorns osparade region-draft (regionKey
  // → värde). SiteEditor i 'onboarding'-läge lyfter den hit; den speglas i ett dolt
  // <input name="site_content_draft"> som createTenant läser. Tomt {} när oanvänd.
  const [siteDraft, setSiteDraft] = useState<Draft>({})

  const onName = (v: string) => {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  // The picked bransch (for terminology + summary). null until step 0 is answered.
  const vertical = verticalKey ? presets.verticals.find((v) => v.key === verticalKey) ?? null : null
  // What we call the customer everywhere: the bransch name when picked, else "kund".
  const kundLabel = vertical?.name ?? 'kund'
  // Multi-bransch terminologi: the chosen bransch's terminology overlay (e.g.
  // { staff:'Stylist', service:'Klippning', unit:'bord' }) supplies bransch-specific
  // labels. term(key, fallback) reads it safely → neutral fallback when the bransch
  // has no terminology (or none is picked yet), so the wizard never hardcodes "salong".
  const terminology = vertical?.terminology ?? {}
  const term = (key: string, fallback: string): string => terminology[key]?.trim() || fallback

  // The module options for the chosen bransch (catalog × preset state). booking is
  // floored to at least 'live' for display; the rest reflect the bransch preset.
  const moduleOptions = useMemo(
    () => modulesForVertical(presets, verticalKey),
    [presets, verticalKey],
  )
  // The Temamall options for the chosen bransch: the `templates` catalog filtered by
  // tags.bransch (presets.templatesByVertical[verticalKey]). Fallback to the built-in
  // five themes when no bransch is picked OR the bransch has no templates seeded yet,
  // so the step is never empty. The first option's key is the safe default theme.
  const BUILTIN_TEMPLATES: TemplateOption[] = useMemo(
    () => THEME_KEYS.map((k) => ({ key: k, name: WIZARD_THEMES[k].name })),
    [],
  )
  const templateOptions: TemplateOption[] = useMemo(() => {
    const forVertical = verticalKey ? presets.templatesByVertical[verticalKey] : undefined
    return forVertical && forVertical.length > 0 ? forVertical : BUILTIN_TEMPLATES
  }, [presets, verticalKey, BUILTIN_TEMPLATES])
  // Display name of the currently chosen template (from the option list when present).
  const themeName = templateOptions.find((o) => o.key === theme)?.name
  const t = wizardTheme(theme, themeName)
  // Sajtbyggare S3 (goal-38): seed-regionerna för "Designa sidan"-steget. resolveSiteContent
  // på salvia-manifestet utan tenant/bransch-data → alla theme-defaults (provenance
  // 'standard'). Theme-oberoende → tom dep-lista. Mappas till SiteEditors prop-form
  // (släpp `source`, lägg på svensk etikett ur REGION_LABELS).
  const onboardingRegions: SiteEditorRegion[] = useMemo(
    () =>
      resolveSiteContent(SALVIA_REGION_MANIFEST, {
        verticalDefaults: {},
        tenantCopy: null,
        tenantBranding: null,
      }).map((r) => ({
        key: r.key,
        type: r.type,
        value: r.value,
        provenance: r.provenance,
        label: REGION_LABELS[r.key] ?? r.key,
      })),
    [],
  )
  // Resolve a module's CURRENT chosen state: explicit pick → preset default → 'off'.
  // booking can never read below 'live' (the floor) regardless of stored value.
  const stateFor = (key: string): ModuleState => {
    const picked = moduleStates[key]
    const preset = moduleOptions.find((m) => m.key === key)?.defaultState ?? 'off'
    const resolved = picked ?? preset
    return key === 'booking' && resolved !== 'live' && resolved !== 'paused' ? 'live' : resolved
  }
  // The exact { module_key: state } map submitted to the server (hidden `modules`
  // field). booking floored to live; off-state modules included as 'off' (the write
  // helper drops them) so the operator's explicit "off" is unambiguous.
  const moduleSubmitMap = useMemo(() => {
    const out: Record<string, ModuleState> = {}
    for (const m of moduleOptions) out[m.key] = stateFor(m.key)
    out.booking = stateFor('booking') === 'paused' ? 'paused' : 'live'
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleOptions, moduleStates])

  /** Pick a bransch: set it, prefill the theme from its default_template (when that
   *  maps to a known wizard theme), and seed the module states from its preset. The
   *  operator can still override theme + module states in their own steps after. */
  const chooseVertical = (key: string) => {
    setVerticalKey(key)
    const v = presets.verticals.find((x) => x.key === key)
    if (!v) return
    // Prefill the theme from the bransch's default_template (a free template key now).
    // Prefer the bransch's own default; else the first bransch-filtered template; else
    // keep the current theme. The Temamall step then lists the bransch's templates.
    const branschTemplates = presets.templatesByVertical[key] ?? []
    const next =
      v.defaultTemplate ??
      branschTemplates[0]?.key ??
      null
    if (next) setTheme(next)
    // Seed module states from the preset (booking floored to live on read via stateFor).
    const seeded: Record<string, ModuleState> = {}
    for (const m of modulesForVertical(presets, key)) seeded[m.key] = m.defaultState
    setModuleStates(seeded)
  }

  /** Toggle/cycle a module's state. booking is restricted to live↔paused (floor);
   *  other modules cycle off→draft→live→paused→off. */
  const setModule = (key: string, next: ModuleState) =>
    setModuleStates((prev) => ({ ...prev, [key]: next }))

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead
        eyebrow="Plattform"
        title="Onboarda ny kund"
        lede="Du skapar kunderna — inte publik self-service. Välj bransch först; fyll resten du vill, inget fält är tvingande."
      />

      <div style={{ marginBottom: 18 }}>
        <Callout tone="info">
          Inga forcerade måste-fält. Skapandet är <b>atomiskt</b>: bransch + moduler + slug +
          settings + ägarroll i ett svep.
        </Callout>
      </div>

      <form action={formAction}>
        {/* Persistent submitted fields — kept mounted across steps so leaving a step
            never drops a value, and the logo File survives step navigation. */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="theme" value={theme} />
        <input type="hidden" name="booking_variant" value={variant} />
        {/* Multi-bransch (spår 5): vertical_id (null → empty = no bransch) + the
            module-state map (JSON { module_key: state }) the server writes to
            tenant_modules. */}
        {verticalKey ? <input type="hidden" name="vertical_id" value={verticalKey} /> : null}
        <input type="hidden" name="modules" value={JSON.stringify(moduleSubmitMap)} />
        {/* Sajtbyggare S3 (goal-38): "Designa sidan"-editorns region-draft (regionKey →
            värde). Alltid monterad — '{}' när oanvänd (legacy-flöde / inget redigerat).
            createTenant läser detta, JSON.parse i try/catch, → applySiteContentEdits. */}
        <input type="hidden" name="site_content_draft" value={JSON.stringify(siteDraft)} />
        {accent ? <input type="hidden" name="color_accent" value={accent} /> : null}
        <input type="hidden" name="tagline" value={tagline} />
        <input type="hidden" name="owner_name" value={ownerName} />
        <input type="hidden" name="owner_email" value={ownerEmail} />
        {/* #11 — the owner role seam value. Only salon_admin is assignable today (the
            multi-role taxonomy is goal-21), so this is a fixed honest value, NOT a
            fake/disabled selector. createTenant resolves it via resolveOwnerRole. */}
        <input type="hidden" name="owner_role" value="salon_admin" />
        <input
          ref={logoRef}
          type="file"
          name="logo"
          accept="image/png,image/svg+xml,image/jpeg"
          hidden
          onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? '')}
        />

        <Card>
          {/* ── Stepper ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 26 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1 }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: i <= step ? 'var(--c-gold)' : 'var(--c-line)',
                    transition: 'all var(--dur-base)',
                  }}
                />
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 8,
                    color: i <= step ? 'var(--c-ink)' : 'var(--c-ink-3)',
                    fontWeight: i === step ? 600 : 500,
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {i + 1}. {s}
                </div>
              </div>
            ))}
          </div>

          {/* ── Bransch (multi-bransch spår 5 — preset-driven) ── */}
          {STEPS[step] === 'Bransch' && (
            <div>
              <p className="body" style={{ marginTop: 0, marginBottom: 16 }}>
                Vilken bransch är kunden i? Branschen förväljer mall + moduler — du kan ändra allt
                i nästa steg. (Valfritt — du kan hoppa över och välja moduler manuellt.)
              </p>
              {presets.verticals.length === 0 ? (
                <Callout tone="warning">
                  Inga branscher i katalogen ännu. Du kan fortsätta utan bransch och välja moduler
                  manuellt i steget &quot;Moduler&quot;.
                </Callout>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  {presets.verticals.map((v) => {
                    const on = verticalKey === v.key
                    const mods = modulesForVertical(presets, v.key).filter((m) => m.defaultState !== 'off')
                    return (
                      <button
                        key={v.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => chooseVertical(v.key)}
                        style={{
                          textAlign: 'left', padding: 16, border: `2px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                          borderRadius: 14, cursor: 'pointer', background: on ? 'var(--c-paper-2)' : 'var(--c-paper)',
                          transition: 'all var(--dur-fast)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--c-ink)' }}>{v.name}</span>
                          {on ? <IconTint color="var(--c-forest)"><Icon name="check" size={15} /></IconTint> : null}
                        </div>
                        <p style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.5, margin: 0 }}>
                          {v.defaultTemplate ? <>Mall <b>{v.defaultTemplate}</b>. </> : null}
                          {mods.length > 0
                            ? <>Moduler: {mods.map((m) => `${m.name} (${MODULE_STATE_LABELS[m.defaultState]})`).join(', ')}.</>
                            : 'Inga förvalda moduler.'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ marginTop: 14 }}><TableChip>verticals · tenants.vertical_id</TableChip></div>
            </div>
          )}

          {/* ── Namn & subdomän ── */}
          {STEPS[step] === 'Namn & subdomän' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label={`Namn på ${kundLabel}`} hint="Valfritt nu — går att ändra sen." ph="t.ex. Klippoteket" value={name} onChange={onName} />
              <div>
                <label style={fieldLabel}>Subdomän</label>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', marginTop: 6, border: '1px solid var(--c-line)',
                    borderRadius: 10, overflow: 'hidden', background: 'var(--c-paper)',
                  }}
                >
                  <input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }}
                    placeholder="klippoteket"
                    autoCapitalize="none"
                    spellCheck={false}
                    style={{ flex: 1, padding: '11px 13px', border: 'none', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 14, background: 'transparent', color: 'var(--c-ink)' }}
                  />
                  <span style={{ padding: '0 14px', color: 'var(--c-ink-3)', fontSize: 14, fontFamily: 'var(--font-ui)', borderLeft: '1px solid var(--c-line)', alignSelf: 'stretch', display: 'grid', placeItems: 'center' }}>
                    .{ROOT}
                  </span>
                </div>
                <div style={{ marginTop: 8 }}><TableChip>tenants · tenant_settings</TableChip></div>
              </div>
              <Field label="Stad" hint="Valfritt — syns i kundlistan." ph="t.ex. Göteborg" value={city} onChange={setCity} />
            </div>
          )}

          {/* ── Temamall (the live preview the operator chooses from) ──
              Multi-bransch: the choices come from the `templates` catalog filtered by
              the chosen bransch (tags.bransch). Falls back to the built-in five when no
              bransch is picked or the bransch has no templates seeded yet.
              Sajtbyggare S3: legacy-only — i editor-läget ersätts detta av "Designa sidan". */}
          {STEPS[step] === 'Temamall' && (
            <div>
              <p className="body" style={{ marginTop: 0, marginBottom: 14 }}>
                {vertical
                  ? <>Mallar för <b>{vertical.name}</b>. Välj utseendet — du ser kundens riktiga startsida live nedan.</>
                  : <>Välj utseendet — du ser kundens riktiga startsida live nedan. (Välj en bransch i steg 1 för att se branschens egna mallar.)</>}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(5, Math.max(2, templateOptions.length))},1fr)`,
                  gap: 10, marginBottom: 22,
                }}
              >
                {templateOptions.map((opt) => {
                  const on = theme === opt.key
                  const tk = wizardTheme(opt.key, opt.name)
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTheme(opt.key)}
                      style={{
                        textAlign: 'left', padding: 5, border: `2px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                        borderRadius: 14, cursor: 'pointer', background: 'var(--c-paper)',
                        boxShadow: on ? 'var(--shadow-md)' : 'none', transition: 'all var(--dur-fast)',
                      }}
                    >
                      <div style={{ height: 56, borderRadius: 9, background: tk.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px', overflow: 'hidden' }}>
                        <span style={{ fontFamily: tk.display, fontSize: tk.caps ? 16 : 15, color: tk.fg, fontWeight: 600, textTransform: tk.caps ? 'uppercase' : 'none', lineHeight: 1 }}>Aa</span>
                        <span style={{ display: 'inline-block', marginTop: 6, width: 30, height: 7, borderRadius: 999, background: tk.primary }} />
                      </div>
                      <div style={{ padding: '8px 6px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-ink)' }}>{opt.name}</span>
                        {on ? <IconTint color="var(--c-forest)"><Icon name="check" size={14} /></IconTint> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <IconTint color="var(--c-gold-600)"><Icon name="sun" size={14} /></IconTint>
                <span className="eyebrow">Förhandsvisning · {t.name} — {t.vibe}</span>
              </div>
              <ThemePreview
                themeKey={theme}
                themeName={themeName}
                salon={name || `Din ${kundLabel}`}
                serviceLabel={term('service', '')}
              />
              <div style={{ marginTop: 12 }}><TableChip>templates · tags.bransch</TableChip></div>
            </div>
          )}

          {/* ── Designa sidan (Sajtbyggare S3 / goal-38 — endast editor-läge) ──
              Ersätter Temamall + Token-branding. Temat kommer från branschens default
              (chooseVertical satte det redan), så ingen tema-väljare behövs här. När
              temat är 'salvia' monteras SiteEditor i 'onboarding'-läge (ingen Spara,
              ingen iframe — tenant finns ej än) och lyfter sin draft hit via
              onDraftChange → dolt site_content_draft. Andra mallar saknar S2-manifest →
              en notis + de gamla accent/tagline-fälten så även de får branding. */}
          {STEPS[step] === 'Designa sidan' && (
            <div>
              {theme === 'salvia' ? (
                <>
                  <p className="body" style={{ marginTop: 0, marginBottom: 14 }}>
                    Designa kundens startsida — ändra texter, bilder och färger. Allt sparas
                    tillsammans med salongen när du skapar den. (Förhandsvisning visas när kunden
                    har skapats.)
                  </p>
                  <SiteEditor
                    slug=""
                    templateKey="salvia"
                    regions={onboardingRegions}
                    mediaAssets={[]}
                    mode="onboarding"
                    onDraftChange={setSiteDraft}
                  />
                  <div style={{ marginTop: 12 }}><TableChip>tenant_settings · settings.copy + branding</TableChip></div>
                </>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  <Callout tone="info" icon="info">
                    Full sajt-redigering finns för mallen ”salvia”. Den här mallen designas efter
                    skapande.
                  </Callout>
                  <Field label="Tagline" ph="Hårvård med lugn hand" value={tagline} onChange={setTagline} />
                  <div>
                    <label style={fieldLabel}>Accentfärg</label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      {ACCENTS.map((c) => {
                        const on = accent === c
                        return (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Accentfärg ${c}`}
                            aria-pressed={on}
                            onClick={() => setAccent(on ? '' : c)}
                            style={{
                              width: 34, height: 34, borderRadius: 9, background: c, cursor: 'pointer',
                              border: '2px solid var(--c-paper)',
                              boxShadow: on ? '0 0 0 2px var(--c-forest)' : '0 0 0 1px var(--c-line)',
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ marginTop: 2 }}><TableChip>tenant_settings</TableChip></div>
                </div>
              )}
            </div>
          )}

          {/* ── Moduler (multi-bransch spår 5 — state-toggle per modul) ── */}
          {STEPS[step] === 'Moduler' && (
            <div>
              <p className="body" style={{ marginTop: 0, marginBottom: 16 }}>
                Slå på modulerna kunden ska ha. Varje modul har ett <b>läge</b>: utkast (dold publikt),
                live (publik) eller pausad. Bokning är alltid minst live.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {moduleOptions.map((m) => {
                  const isBooking = m.key === 'booking'
                  const cur = stateFor(m.key)
                  // booking → live/paused only; others → off/draft/live/paused.
                  const choices: ModuleState[] = isBooking
                    ? (['live', 'paused'] as ModuleState[])
                    : ([...MODULE_STATES] as ModuleState[])
                  return (
                    <div
                      key={m.key}
                      style={{
                        padding: 16, border: '1px solid var(--c-line)', borderRadius: 14,
                        background: 'var(--c-paper)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--c-ink)' }}>
                          {m.name}
                          {isBooking ? <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', fontWeight: 600, marginLeft: 8 }}>Kärnmodul</span> : null}
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {choices.map((st) => {
                            const on = cur === st
                            return (
                              <button
                                key={st}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setModule(m.key, st)}
                                style={{
                                  padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5,
                                  fontWeight: 600, fontFamily: 'var(--font-ui)',
                                  border: `1.5px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                                  background: on ? 'var(--c-paper-2)' : 'var(--c-paper)',
                                  color: on ? 'var(--c-ink)' : 'var(--c-ink-3)',
                                }}
                              >
                                {MODULE_STATE_LABELS[st]}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--c-ink-3)', lineHeight: 1.5, margin: '4px 0 0' }}>
                        {MODULE_STATE_HINTS[cur]}
                      </p>
                      {/* booking.variant survives here as a sub-choice of the booking module. */}
                      {isBooking ? (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--c-line)' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-ink)', marginBottom: 8 }}>
                            Bokningsvariant — hur bokningen presenteras (99 % sker på mobil)
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {BOOKING_VARIANTS.map((v) => {
                              const von = variant === v
                              const rec = v === RECOMMENDED_BOOKING_VARIANT
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  role="radio"
                                  aria-checked={von}
                                  onClick={() => setVariant(v)}
                                  style={{
                                    textAlign: 'left', padding: 12, border: `2px solid ${von ? 'var(--c-forest)' : 'var(--c-line)'}`,
                                    borderRadius: 12, cursor: 'pointer', background: von ? 'var(--c-paper-2)' : 'var(--c-paper)',
                                    transition: 'all var(--dur-fast)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--c-ink)' }}>{BOOKING_VARIANT_LABELS[v]}</span>
                                    {rec ? (
                                      <Badge tone="gold" dot={false}>Rek.</Badge>
                                    ) : (
                                      <span style={{ fontSize: 11, color: 'var(--c-ink-3)', fontWeight: 600 }}>{BOOKING_VARIANT_TAGS[v]}</span>
                                    )}
                                  </div>
                                  <p style={{ fontSize: 12, color: 'var(--c-ink-2)', lineHeight: 1.45, margin: 0 }}>{BOOKING_VARIANT_DESCRIPTIONS[v]}</p>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 14 }}><TableChip>tenant_modules · modules</TableChip></div>
            </div>
          )}

          {/* ── Token-branding (Sajtbyggare S3: legacy-only — i editor-läget ingår
              accent/tagline i "Designa sidan") ── */}
          {STEPS[step] === 'Token-branding' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="eyebrow">Leksakslådan · no-code</span>
                <TableChip>tenant_settings</TableChip>
              </div>
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: 'var(--c-paper-2)',
                  borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
              >
                <span style={{ width: 56, height: 56, borderRadius: 12, border: '2px dashed var(--c-line-strong)', display: 'grid', placeItems: 'center', color: 'var(--c-ink-3)', flex: 'none' }}>
                  <Icon name="upload" size={20} />
                </span>
                <span>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>
                    {logoName || 'Ladda upp logga'}
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 2 }}>
                    {logoName ? 'Klicka för att byta' : 'PNG/SVG → R2 · valfritt'}
                  </span>
                </span>
              </button>
              <Field label="Tagline" ph="Hårvård med lugn hand" value={tagline} onChange={setTagline} />
              <div>
                <label style={fieldLabel}>Accentfärg</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {ACCENTS.map((c) => {
                    const on = accent === c
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Accentfärg ${c}`}
                        aria-pressed={on}
                        onClick={() => setAccent(on ? '' : c)}
                        style={{
                          width: 34, height: 34, borderRadius: 9, background: c, cursor: 'pointer',
                          border: '2px solid var(--c-paper)',
                          boxShadow: on ? '0 0 0 2px var(--c-forest)' : '0 0 0 1px var(--c-line)',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
              <InfoLine icon="info">Look på nivå-3 (scoped CSS) görs via kod i säker miljö — aldrig här.</InfoLine>
            </div>
          )}

          {/* ── Ägare & roll ── */}
          {STEPS[step] === 'Ägare & roll' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Ägarens namn" ph="Förnamn Efternamn" value={ownerName} onChange={setOwnerName} />
              <Field
                label="Ägarens e-post"
                hint="Får en magic-link-invite — bekräftar och sätter eget lösenord."
                ph="agare@kund.se"
                type="email"
                value={ownerEmail}
                onChange={setOwnerEmail}
              />
              {/* #11 — roll är ett ÄRLIGT konstaterat faktum, inte en fejkad väljare.
                  Idag är salongsadmin den enda tilldelbara ägarrollen; fler roller
                  kommer i behörighetsmodulen. owner_role skickas som hidden input. */}
              <div>
                <label style={fieldLabel}>Ägarroll</label>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, padding: '12px 14px',
                    border: '1px solid var(--c-line)', borderRadius: 10, background: 'var(--c-paper-2)',
                  }}
                >
                  <Badge tone="gold" dot={false}>Salongsadmin (ägare)</Badge>
                  <span style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.5 }}>
                    Full åtkomst till sin egen salongspanel.
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 6 }}>
                  Fler roller kommer i den kommande behörighetsmodulen.
                </div>
              </div>
              <Callout tone="success">
                <b>{name || `${kundLabel[0]?.toUpperCase()}${kundLabel.slice(1)}`}</b> skapas på{' '}
                <b>{(slug || 'subdomän')}.{ROOT}</b>
                {vertical ? <> i branschen <b>{vertical.name}</b></> : null} med tema <b>{t.name}</b>.
                Moduler: <b>{liveModuleSummary(moduleOptions, stateFor) || 'Bokning (Live)'}</b>.
                Ägaren bjuds in som salongsadmin.
              </Callout>
              <InfoLine icon="link">
                Egen domän är parkerat — subdomän räcker tills vidare.
              </InfoLine>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--c-line)' }}>
            <Button variant="ghost" icon="arrowLeft" onClick={() => setStep((s) => Math.max(0, s - 1))} style={{ opacity: step === 0 ? 0.4 : 1 }}>
              Tillbaka
            </Button>
            {step < LAST_STEP ? (
              <Button variant="primary" icon="arrowRight" onClick={() => setStep((s) => Math.min(LAST_STEP, s + 1))}>
                Fortsätt
              </Button>
            ) : (
              <Button variant="gold" icon="check" type="submit" disabled={pending}>
                {pending ? 'Skapar…' : `Skapa ${kundLabel}`}
              </Button>
            )}
          </div>
        </Card>

        {state.error ? (
          <div style={{ marginTop: 14 }}>
            <Callout tone="warning" role="alert">{state.error}</Callout>
          </div>
        ) : null}
        {state.success ? (
          <div style={{ marginTop: 14 }}>
            <Callout tone="success" role="status">{state.success}</Callout>
          </div>
        ) : null}
      </form>
    </div>
  )
}

// ── Local primitives (mirror the handoff Field / TableChip / ThemePreview) ────────

const fieldLabel = { fontSize: 13, fontWeight: 600, color: 'var(--c-ink)', fontFamily: 'var(--font-ui)' } as const

function Field({
  label, hint, ph, type = 'text', value, onChange,
}: {
  label: string
  hint?: string
  ph?: string
  type?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        autoCapitalize={type === 'email' ? 'none' : undefined}
        style={{
          width: '100%', marginTop: 6, padding: '11px 13px', border: '1px solid var(--c-line)',
          borderRadius: 10, background: 'var(--c-paper)', fontFamily: 'var(--font-ui)', fontSize: 14,
          outline: 'none', boxSizing: 'border-box', color: 'var(--c-ink)',
        }}
      />
      {hint ? <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 6 }}>{hint}</div> : null}
    </div>
  )
}

/** Small pill telling the operator which real table(s) a step writes to. */
function TableChip({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--c-paper-2)', color: 'var(--c-ink-2)', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-ui)', padding: '5px 10px', borderRadius: 999 }}>
      <IconTint color="var(--c-ink-3)"><Icon name="layers" size={13} /></IconTint>
      {children}
    </span>
  )
}

/** Tints a (currentColor) Icon without depending on Icon's own style prop. */
function IconTint({ color, children }: { color: string; children: ReactNode }) {
  return <span style={{ color, display: 'inline-flex', alignItems: 'center' }}>{children}</span>
}

function InfoLine({ icon, children }: { icon: 'info' | 'link'; children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--c-ink-3)', display: 'flex', gap: 8, alignItems: 'center' }}>
      <IconTint color="var(--c-ink-3)"><Icon name={icon} size={14} /></IconTint>
      {children}
    </div>
  )
}

/** Live storefront mock for the chosen theme — browser chrome + the real two-column
 *  hero so the operator sees exactly what the salon's start page will look like.
 *  themeKey is a free template key now; wizardTheme() resolves the rich built-in
 *  preview when known, else a neutral fallback carrying the template's display name. */
function ThemePreview({
  themeKey,
  themeName,
  salon,
  serviceLabel,
}: {
  themeKey: string
  themeName?: string
  salon: string
  /** Bransch `service` term (e.g. "Klippning"). '' → keep the generic example chips. */
  serviceLabel?: string
}) {
  const t = wizardTheme(themeKey, themeName)
  const slug = (salon || 'sida').toLowerCase().replace(/[^a-z0-9]/g, '') || 'sida'
  // Lead the example chips with the bransch's own service word when it has one, so a
  // non-frisör bransch doesn't preview "Klippning". Falls back to the generic set.
  const chips = serviceLabel ? [serviceLabel, 'Färg', 'Styling'] : ['Klippning', 'Färg', 'Styling']
  const dot = (bg: string) => <span style={{ width: 10, height: 10, borderRadius: 999, background: bg }} />
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-md)' }}>
      {/* browser chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: '#EDEAE3', borderBottom: '1px solid var(--c-line)' }}>
        {dot('#E0726A')}{dot('#E6B34D')}{dot('#7FB47F')}
        <div style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--c-ink-3)', fontFamily: 'var(--font-ui)', background: '#fff', padding: '3px 11px', borderRadius: 999 }}>
          {slug}.{ROOT}
        </div>
      </div>
      {/* two-column hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', background: t.bg, minHeight: 280 }}>
        <div style={{ padding: '26px 28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: t.display, fontSize: t.caps ? 20 : 18, fontWeight: 600, color: t.fg, textTransform: t.caps ? 'uppercase' : 'none', letterSpacing: t.caps ? '.04em' : 0 }}>{salon}</span>
            <span style={{ background: t.primary, color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, padding: '7px 14px', borderRadius: t.radius * 2 }}>Boka tid</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: t.primary, fontWeight: 600 }}>— {t.eyebrow}</span>
            <div style={{ fontFamily: t.display, fontSize: 34, fontWeight: 600, color: t.fg, lineHeight: t.caps ? 1.12 : 1.04, margin: '8px 0 0', textTransform: t.caps ? 'uppercase' : 'none', letterSpacing: t.caps ? '.01em' : '-0.01em' }}>{t.hero}</div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: t.fg2, lineHeight: 1.5, margin: t.caps ? '14px 0 0' : '10px 0 0', maxWidth: 280 }}>{t.lede}</p>
            <div style={{ display: 'flex', gap: 7, marginTop: 16, flexWrap: 'wrap' }}>
              {chips.map((s) => (
                <span key={s} style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: t.fg2, border: `1px solid ${t.line}`, borderRadius: t.radius + 4, padding: '5px 11px' }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', backgroundImage: `url(${t.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: themeKey === 'zigge' ? 'linear-gradient(180deg, rgba(20,18,14,.1), rgba(20,18,14,.5))' : 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.12))' }} />
        </div>
      </div>
    </div>
  )
}
