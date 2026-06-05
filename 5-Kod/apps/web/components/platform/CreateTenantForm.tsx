'use client'

import { useActionState, useRef, useState, type ReactNode } from 'react'
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
import { PageHead, Card, Button, Badge, Icon } from '@/components/portal/ui'
import { Callout } from '@/components/portal/ui'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

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

const STEPS = ['Namn & subdomän', 'Temamall', 'Bokningsvariant', 'Token-branding', 'Ägare & roll']
// Accent swatches = the five theme primaries (design step 4 "Token-branding").
const ACCENTS = ['#5E7361', '#7E6E92', '#C8743C', '#B0693F', '#3A3733']

/** name → a clean storefront slug (a–z, 0–9, bindestreck) — mirrors validateSlug. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateTenantForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenant, {})
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [city, setCity] = useState('')
  const [theme, setTheme] = useState<ThemeKey>('salvia')
  const [variant, setVariant] = useState<BookingVariant>(DEFAULT_BOOKING_VARIANT)
  const [accent, setAccent] = useState('') // '' = none picked yet
  const [tagline, setTagline] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [logoName, setLogoName] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)

  const t = WIZARD_THEMES[theme]
  const onName = (v: string) => {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead
        eyebrow="Plattform"
        title="Onboarda ny salong"
        lede="Du skapar salongerna — inte publik self-service. Fyll det du vill, inget fält är tvingande."
      />

      <div style={{ marginBottom: 18 }}>
        <Callout tone="info">
          Inga forcerade måste-fält — du la friction på det förut. Skapandet är <b>atomiskt</b>:
          slug + settings + ägarroll i ett svep.
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

          {/* ── Step 0 · Namn & subdomän ── */}
          {step === 0 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Salongsnamn" hint="Valfritt nu — går att ändra sen." ph="t.ex. Klippoteket" value={name} onChange={onName} />
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
              <Field label="Stad" hint="Valfritt — syns i salongslistan." ph="t.ex. Göteborg" value={city} onChange={setCity} />
            </div>
          )}

          {/* ── Step 1 · Temamall (the live preview the operator chooses from) ── */}
          {step === 1 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 22 }}>
                {THEME_KEYS.map((key) => {
                  const on = theme === key
                  const tk = WIZARD_THEMES[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTheme(key)}
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
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-ink)' }}>{tk.name}</span>
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
              <ThemePreview themeKey={theme} salon={name || 'Din salong'} />
            </div>
          )}

          {/* ── Step 2 · Bokningsvariant ── */}
          {step === 2 && (
            <div>
              <p className="body" style={{ marginTop: 0, marginBottom: 16 }}>
                Välj hur bokningen presenteras på salongens storefront. 99 % av bokningarna sker på mobil.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {BOOKING_VARIANTS.map((v) => {
                  const on = variant === v
                  const rec = v === RECOMMENDED_BOOKING_VARIANT
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setVariant(v)}
                      style={{
                        textAlign: 'left', padding: 16, border: `2px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                        borderRadius: 14, cursor: 'pointer', background: on ? 'var(--c-paper-2)' : 'var(--c-paper)',
                        transition: 'all var(--dur-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--c-ink)' }}>{BOOKING_VARIANT_LABELS[v]}</span>
                        {rec ? (
                          <Badge tone="gold" dot={false}>Rekommenderad</Badge>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', fontWeight: 600 }}>{BOOKING_VARIANT_TAGS[v]}</span>
                        )}
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.5, margin: 0 }}>{BOOKING_VARIANT_DESCRIPTIONS[v]}</p>
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: 14 }}><TableChip>kopplar M3 · booking-variants</TableChip></div>
            </div>
          )}

          {/* ── Step 3 · Token-branding ── */}
          {step === 3 && (
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

          {/* ── Step 4 · Ägare & roll ── */}
          {step === 4 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Ägarens namn" ph="Förnamn Efternamn" value={ownerName} onChange={setOwnerName} />
              <Field
                label="Ägarens e-post"
                hint="Får en magic-link-invite — bekräftar och sätter eget lösenord."
                ph="agare@salong.se"
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
                <b>{name || 'Salongen'}</b> skapas på <b>{(slug || 'subdomän')}.{ROOT}</b> med tema{' '}
                <b>{t.name}</b> och variant <b>{BOOKING_VARIANT_LABELS[variant]}</b>. Ägaren bjuds in som
                salongsadmin.
              </Callout>
              <InfoLine icon="link">
                Egen domän (steg 5 i stegen) är parkerat — subdomän räcker tills vidare.
              </InfoLine>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--c-line)' }}>
            <Button variant="ghost" icon="arrowLeft" onClick={() => setStep((s) => Math.max(0, s - 1))} style={{ opacity: step === 0 ? 0.4 : 1 }}>
              Tillbaka
            </Button>
            {step < 4 ? (
              <Button variant="primary" icon="arrowRight" onClick={() => setStep((s) => Math.min(4, s + 1))}>
                Fortsätt
              </Button>
            ) : (
              <Button variant="gold" icon="check" type="submit" disabled={pending}>
                {pending ? 'Skapar…' : 'Skapa salong'}
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
 *  hero so the operator sees exactly what the salon's start page will look like. */
function ThemePreview({ themeKey, salon }: { themeKey: ThemeKey; salon: string }) {
  const t = WIZARD_THEMES[themeKey]
  const slug = (salon || 'salong').toLowerCase().replace(/[^a-z0-9]/g, '') || 'salong'
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
              {['Klippning', 'Färg', 'Styling'].map((s) => (
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
