'use client'

import { useActionState, useState } from 'react'
import { createTenant, type ActionState } from '@/lib/platform/actions'
import { BILLING_MODELS, BILLING_MODEL_LABELS, type BillingModel } from '@/lib/platform/billing'
import {
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_DESCRIPTIONS,
  DEFAULT_BOOKING_VARIANT,
  type BookingVariant,
} from '@/lib/platform/booking-variant'
import styles from './platform.module.css'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

type NavVariant = 'A' | 'B'
type HeroVariant = '1' | '2'

// One curated theme template = one nav + one hero pairing. Picking a template
// writes settings.layout.{nav,hero}_variant so each new salon gets a DISTINCT
// storefront, never a copy of the last one.
const TEMPLATES: {
  id: string
  nav: NavVariant
  hero: HeroVariant
  name: string
  desc: string
}[] = [
  { id: 'centrerad', nav: 'A', hero: '1', name: 'Centrerad', desc: 'Centrerad logga + stor rubrik. Klassiskt och varmt.' },
  { id: 'redaktionell', nav: 'B', hero: '2', name: 'Redaktionell', desc: 'Delad meny + vänsterställd rubrik med etikett. Stramt.' },
  { id: 'klassisk-split', nav: 'B', hero: '1', name: 'Klassisk split', desc: 'Delad meny, centrerad hjälte. Tydlig och proper.' },
  { id: 'galleri', nav: 'A', hero: '2', name: 'Galleri', desc: 'Centrerad meny, vänsterställd hjälte. Lugnt galleri-uttryck.' },
]

// Sensible Corevo-neutral starting palette per template (operator can tweak).
const PALETTES: { id: string; primary: string; bg: string; fg: string; label: string }[] = [
  { id: 'corevo', primary: '#1f4636', bg: '#fefcf7', fg: '#0e1411', label: 'Skogsgrön (Corevo)' },
  { id: 'koppar', primary: '#9a5b34', bg: '#fbf6f0', fg: '#231812', label: 'Koppar' },
  { id: 'natt', primary: '#26303f', bg: '#f5f6f8', fg: '#11161e', label: 'Nattblå' },
  { id: 'ros', primary: '#9b3b54', bg: '#fdf5f6', fg: '#231116', label: 'Roséröd' },
]

// Guaranteed-defined defaults (the literals above are non-empty; this satisfies
// noUncheckedIndexedAccess without non-null assertions).
const DEFAULT_TEMPLATE = TEMPLATES[0] ?? {
  id: 'centrerad', nav: 'A' as NavVariant, hero: '1' as HeroVariant, name: 'Centrerad', desc: '',
}
const DEFAULT_PALETTE = PALETTES[0] ?? {
  id: 'corevo', primary: '#1f4636', bg: '#fefcf7', fg: '#0e1411', label: 'Skogsgrön (Corevo)',
}

export function CreateTenantForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenant, {})
  const [model, setModel] = useState<BillingModel>('per_booking')
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE.id)
  // No palette pre-selected: the preview is corevo-tinted (from primary/bg/fg below)
  // but no swatch ring shows until the operator deliberately picks one — so the UI
  // never claims "branded" while the data says "neutral default".
  const [paletteId, setPaletteId] = useState<string>('')
  const [bookingVariant, setBookingVariant] = useState<BookingVariant>(DEFAULT_BOOKING_VARIANT)
  const [primary, setPrimary] = useState<string>(DEFAULT_PALETTE.primary)
  const [bg, setBg] = useState<string>(DEFAULT_PALETTE.bg)
  const [fg, setFg] = useState<string>(DEFAULT_PALETTE.fg)
  // The default palette below is shown only as a PREVIEW. Colours are submitted —
  // and thus written to tenant_settings.branding — ONLY after the operator makes a
  // deliberate choice. This keeps onboarding step 2 ("Varumärke") on "Att göra"
  // for a salon created with defaults, matching the original ladder behaviour.
  const [touchedBranding, setTouchedBranding] = useState(false)

  const template = TEMPLATES.find((t) => t.id === templateId) ?? DEFAULT_TEMPLATE

  function applyPalette(p: (typeof PALETTES)[number]) {
    setPaletteId(p.id)
    setPrimary(p.primary)
    setBg(p.bg)
    setFg(p.fg)
    setTouchedBranding(true)
  }

  return (
    <form action={formAction} className={styles.form}>
      {/* ── Identitet ── */}
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Identitet</legend>
        <label className={styles.field}>
          <span>Salongsnamn</span>
          <input name="name" required placeholder="t.ex. Frisör Tre" />
        </label>

        <label className={styles.field}>
          <span>Subdomän</span>
          <input name="slug" required placeholder="frisor3" autoCapitalize="none" spellCheck={false} />
          <span className={styles.hint}>
            Blir <code className={styles.code}>&lt;subdomän&gt;.{ROOT}</code>. a–z, 0–9, bindestreck.
            Reserverade namn (booking, admin, app, www, api …) avvisas.
          </span>
        </label>

        <label className={styles.field}>
          <span>Salongsadmin e-post (valfritt)</span>
          <input name="admin_email" type="email" placeholder="agare@salong.se" autoCapitalize="none" />
          <span className={styles.hint}>Bjuds in som salon_admin. Kräver att e-post/SMTP är konfigurerat.</span>
        </label>
      </fieldset>

      {/* ── Temamall (nivå 2) ── */}
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Temamall</legend>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Väljer startsidans upplägg. Varje mall ger en egen layout — salongen blir
          en distinkt sajt, inte en kopia. Kan ändras senare per salong.
        </p>
        <div className={styles.templateGrid} role="radiogroup" aria-label="Temamall">
          {TEMPLATES.map((t) => {
            const selected = t.id === templateId
            return (
              <button
                type="button"
                key={t.id}
                role="radio"
                aria-checked={selected}
                onClick={() => setTemplateId(t.id)}
                className={`${styles.templateCard}${selected ? ` ${styles.templateCardSel}` : ''}`}
              >
                <TemplatePreview nav={t.nav} hero={t.hero} primary={primary} bg={bg} fg={fg} />
                <span className={styles.templateName}>{t.name}</span>
                <span className={styles.templateDesc}>{t.desc}</span>
                <span className={styles.templateMeta}>
                  Nav {t.nav} · Hero {t.hero}
                </span>
              </button>
            )
          })}
        </div>
        <input type="hidden" name="nav_variant" value={template.nav} />
        <input type="hidden" name="hero_variant" value={template.hero} />
      </fieldset>

      {/* ── Boknings-vy (§2.4) ── */}
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Boknings-vy</legend>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Konfigurerar vilken bokningsvy salongen ska ha. Valet sparas på salongen och
          aktiveras av bokningsmotorn när den läser inställningen — det ändrar inte
          startsidans utseende (det styrs av temamallen ovan). Kan ändras senare per salong.
        </p>
        <div className={styles.templateGrid} role="radiogroup" aria-label="Boknings-vy">
          {BOOKING_VARIANTS.map((v) => {
            const selected = v === bookingVariant
            return (
              <button
                type="button"
                key={v}
                role="radio"
                aria-checked={selected}
                onClick={() => setBookingVariant(v)}
                className={`${styles.templateCard}${selected ? ` ${styles.templateCardSel}` : ''}`}
              >
                <span className={styles.templateName}>{BOOKING_VARIANT_LABELS[v]}</span>
                <span className={styles.templateDesc}>{BOOKING_VARIANT_DESCRIPTIONS[v]}</span>
              </button>
            )
          })}
        </div>
        <input type="hidden" name="booking_variant" value={bookingVariant} />
      </fieldset>

      {/* ── Varumärke (nivå 1) ── */}
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Färgpalett</legend>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Startfärger för salongens publika sajt. Standard = Corevo-neutral (förhandsvisas
          nedan). Välj en palett eller justera en färg för att sätta egen branding direkt —
          annars startar salongen neutral och varumärket markeras som ”att göra”. Logotyp
          laddas upp per salong efter att den skapats.
        </p>
        <div className={styles.paletteRow} role="radiogroup" aria-label="Färgpalett">
          {PALETTES.map((p) => {
            const selected = p.id === paletteId
            return (
              <button
                type="button"
                key={p.id}
                role="radio"
                aria-checked={selected}
                onClick={() => applyPalette(p)}
                className={`${styles.swatch}${selected ? ` ${styles.swatchSel}` : ''}`}
                title={p.label}
              >
                <span className={styles.swatchDot} style={{ background: p.primary }} />
                <span className={styles.swatchDot} style={{ background: p.bg, border: '1px solid rgba(0,0,0,.12)' }} />
                <span className={styles.swatchLabel}>{p.label}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Primärfärg</span>
            <input
              type="color"
              // name omitted until the operator picks a colour → branding stays empty
              // (step 2 "Varumärke" remains "att göra") for a defaults-only create.
              name={touchedBranding ? 'color_primary' : undefined}
              value={primary}
              onChange={(e) => {
                setPrimary(e.target.value)
                setPaletteId('')
                setTouchedBranding(true)
              }}
            />
          </label>
          <label className={styles.field}>
            <span>Bakgrund</span>
            <input
              type="color"
              name={touchedBranding ? 'color_bg' : undefined}
              value={bg}
              onChange={(e) => {
                setBg(e.target.value)
                setPaletteId('')
                setTouchedBranding(true)
              }}
            />
          </label>
          <label className={styles.field}>
            <span>Text</span>
            <input
              type="color"
              name={touchedBranding ? 'color_fg' : undefined}
              value={fg}
              onChange={(e) => {
                setFg(e.target.value)
                setPaletteId('')
                setTouchedBranding(true)
              }}
            />
          </label>
        </div>
      </fieldset>

      {/* ── Prismodell (FLÖDE 2) ── */}
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Prismodell (FLÖDE 2)</legend>
        <label className={styles.field}>
          <span>Modell</span>
          <select
            name="billing_model"
            value={model}
            onChange={(e) => setModel(e.target.value as BillingModel)}
          >
            {BILLING_MODELS.map((m) => (
              <option key={m} value={m}>
                {BILLING_MODEL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Startavgift (kr)</span>
            <input name="setup_fee" inputMode="decimal" placeholder="0" />
          </label>
          {model === 'per_booking' ? (
            <label className={styles.field}>
              <span>Avgift per bokning (kr)</span>
              <input name="per_booking_fee" inputMode="decimal" placeholder="0" />
            </label>
          ) : (
            <label className={styles.field}>
              <span>Fast månadsavgift (kr)</span>
              <input name="flat_monthly_fee" inputMode="decimal" placeholder="0" />
            </label>
          )}
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Skapar…' : 'Skapa salong'}
        </button>
        {state.error ? (
          <span className={`${styles.feedback} auth-error`} role="alert">
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            {state.success}
          </span>
        ) : null}
      </div>
    </form>
  )
}

/** Tiny live wireframe of the chosen template, tinted with the chosen palette. */
function TemplatePreview({
  nav,
  hero,
  primary,
  bg,
  fg,
}: {
  nav: NavVariant
  hero: HeroVariant
  primary: string
  bg: string
  fg: string
}) {
  return (
    <span className={styles.tp} style={{ background: bg, color: fg }} aria-hidden="true">
      {/* nav row */}
      <span className={`${styles.tpNav} ${nav === 'A' ? styles.tpNavA : styles.tpNavB}`}>
        <span className={styles.tpLogo} style={{ background: primary }} />
        <span className={styles.tpLinks}>
          <span className={styles.tpLink} />
          <span className={styles.tpLink} />
          <span className={styles.tpCta} style={{ background: primary }} />
        </span>
      </span>
      {/* hero row */}
      <span className={`${styles.tpHero} ${hero === '1' ? styles.tpHero1 : styles.tpHero2}`}>
        {hero === '2' ? <span className={styles.tpEyebrow} style={{ background: primary }} /> : null}
        <span className={styles.tpTitle} style={{ background: fg }} />
        <span className={styles.tpTitleShort} style={{ background: fg }} />
        <span className={styles.tpHeroCta} style={{ background: primary }} />
      </span>
    </span>
  )
}
