'use client'

import { useActionState, useState } from 'react'
import type { CSSProperties } from 'react'
import { accentForeground, type TenantBranding } from '@corevo/ui'
import { updateBookingSettings } from '@/lib/platform/actions'
import type { ActionState } from '@/lib/platform/actions'
import type { BookingVariant, PickerMode, StaffAvatarMode } from '@/lib/platform/booking-variant'
import { themePalette } from '@/lib/platform/theme-palettes'
import studio from './SidaStudio.module.css'
import pform from './platform.module.css'

/**
 * Bokningspanelen — designpaketet "Frisörbokningsformulär redesign" ⭐-kravet:
 * ALLT i bokningsflödet valbart per salong från admin, utan kodändring per kund.
 * Zivar 2026-07-10: "boknings-vyn och bokningsflödet går hand i hand — gör dem
 * samma, och inte 2 previewn" → panelen är numera EN flik (Bokning) i SidaStudio
 * och delar studions preview + reload; den äger ingen egen iframe. EN komponent
 * för BÅDA ytorna (kundens /admin/sida + super-adminens kundkort) via SidaStudio —
 * action bakom sidaCtx-dubbelguarden. Kontrollerna = prototypens kontrollrad
 * (Bokningssätt / Tid-väljare / Barberarbilder); de fyra bokningssätts-korten bär
 * exakt label + tag + beskrivning + mini-schematic från "Jämför alla"-vyn
 * (compareCards i "FreshCut bokning.dc.html"). Färgerna redigeras i Allmänt →
 * Varumärke (samma tokens) — här visas bara CTA-chippen + kontrast-varningen.
 */

// Compare-kortens exakta texter + panel-geometri (compareCards, design-kanon).
// booking-variant.ts är läs-KONTRAKTET (labels där speglar SU_VARIANTS) — de här
// admin-korten speglar i stället jämför-vyns kort och ägs av den här ytan.
const VARIANT_CARDS: {
  id: BookingVariant
  label: string
  tag: string
  desc: string
}[] = [
  {
    id: 'wizard',
    label: 'Steg-för-steg',
    tag: 'Rekommenderad',
    desc: 'Guide i flera steg i en centrerad ruta. Ett beslut per skärm — tryggast för nya kunder.',
  },
  {
    id: 'drawer',
    label: 'Sidopanel',
    tag: 'Desktop',
    desc: 'Samma guide men i en panel som glider in från kanten. Sidan syns kvar bakom.',
  },
  {
    id: 'compact',
    label: 'Snabbboka',
    tag: 'Genväg',
    desc: 'Allt på en skärm med chips. Snabbast för stamkunder som vet vad de vill.',
  },
  {
    id: 'inline',
    label: 'Inbäddad',
    tag: 'Native',
    desc: 'Bokningen ligger i sidan utan popup. Knappen scrollar ner till formuläret.',
  },
]

const PICKER_OPTIONS: { id: PickerMode; label: string; hint: string }[] = [
  { id: 'calendar', label: 'Kalender', hint: 'Månadsvy med prickar på lediga dagar.' },
  { id: 'strip', label: 'Dag-remsa', hint: 'Rad med de närmaste dagarna — snabbt på mobil.' },
]

const AVATAR_OPTIONS: { id: StaffAvatarMode; label: string; hint: string }[] = [
  { id: 'foto', label: 'Foto', hint: 'Medarbetarnas riktiga bilder.' },
  { id: 'initialer', label: 'Initialer', hint: 'Färgad rundel med initial.' },
  { id: 'namn', label: 'Namn', hint: 'Bara namn och roll — ingen bild.' },
]

// ── WCAG-kontrast (för färg-varningen; accentForeground håller CTA-texten läsbar) ──
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  let h = m[1]!
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function relLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrastRatio(a: string, b: string): number | null {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  if (la == null || lb == null) return null
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function BookingPanel({
  tenantId,
  templateKey,
  branding,
  variant,
  pickerMode,
  staffAvatars,
  externalUrl,
  hasStaffPhoto,
  onSaved,
}: {
  tenantId: string
  /** Tenantens sparade mall — dess palett är standardfärgerna CTA-chippen utgår från. */
  templateKey: string
  branding: TenantBranding
  variant: BookingVariant
  pickerMode: PickerMode
  staffAvatars: StaffAvatarMode
  externalUrl: string | null
  /** true när minst en AKTIV medarbetare har avatar_url — annars är Foto-läget
   *  avstängt med hint (design-kanon: "disable Foto with a hint"). */
  hasStaffPhoto: boolean
  /** SidaStudions reload — previewen laddas om efter spar. */
  onSaved?: () => void
}) {
  // Valen hålls kontrollerat så mini-schematics + segmenten markerar direkt.
  // 'foto' utan foton speglar render-fallbacken (initialer) redan i formuläret.
  const [sel, setSel] = useState<{ variant: BookingVariant; picker: PickerMode; avatars: StaffAvatarMode }>({
    variant,
    picker: pickerMode,
    avatars: staffAvatars === 'foto' && !hasStaffPhoto ? 'initialer' : staffAvatars,
  })

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await updateBookingSettings(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )

  // CTA/markering = accent med primär som fallback (samma resolution som
  // booking-ytan: var(--color-accent, var(--color-primary))) — SPARADE färger;
  // live-mixern bor i Allmänt → Varumärke.
  const pal = themePalette(templateKey)
  const bg = branding.color_bg || pal.bg
  const fg = branding.color_fg || pal.fg
  const cta = branding.color_accent || branding.color_primary || pal.accent || pal.primary
  const ctaFg = accentForeground(cta) ?? '#ffffff'
  const fgBgRatio = contrastRatio(fg, bg)
  const lowContrast = fgBgRatio != null && fgBgRatio < 4.5

  return (
    <form action={formAction} style={{ display: 'grid', gap: 16, minWidth: 0 }}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <section className={studio.card}>
        <h3 className={studio.cardHead}>Bokningssätt</h3>
        <p className={studio.note}>
          Hur bokningen öppnar sig på kundens sida. Alla fyra ger samma steg och
          bekräftelse — bara presentationen skiljer. Gäller alla &quot;Boka tid&quot;-knappar.
        </p>
        <div className={pform.templateGrid} role="radiogroup" aria-label="Bokningssätt">
          {VARIANT_CARDS.map((c) => {
            const on = sel.variant === c.id
            return (
              <label
                key={c.id}
                className={pform.templateCard}
                style={on ? variantCardOn : undefined}
              >
                <input
                  type="radio"
                  name="booking_variant"
                  value={c.id}
                  checked={on}
                  onChange={() => setSel((s) => ({ ...s, variant: c.id }))}
                  style={srOnly}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span className={pform.templateName}>{c.label}</span>
                  <span style={tagChip(on)}>{c.tag}</span>
                </span>
                <span className={pform.templateDesc}>{c.desc}</span>
                <VariantSchematic v={c.id} accent={cta} />
              </label>
            )
          })}
        </div>
      </section>

      <section className={studio.card}>
        <h3 className={studio.cardHead}>Tid-väljare</h3>
        <p className={studio.note}>Hur kunden väljer dag i steget &quot;När passar det?&quot;.</p>
        <div style={segRail} role="radiogroup" aria-label="Tid-väljare">
          {PICKER_OPTIONS.map((o) => {
            const on = sel.picker === o.id
            return (
              <label key={o.id} style={segPill(on, false)}>
                <input
                  type="radio"
                  name="picker_mode"
                  value={o.id}
                  checked={on}
                  onChange={() => setSel((s) => ({ ...s, picker: o.id }))}
                  style={srOnly}
                />
                <span style={{ fontWeight: 650 }}>{o.label}</span>
                <span style={segHint(on)}>{o.hint}</span>
              </label>
            )
          })}
        </div>
      </section>

      <section className={studio.card}>
        <h3 className={studio.cardHead}>Personalbilder</h3>
        <p className={studio.note}>Hur medarbetarna visas i steget &quot;Hos vem?&quot;.</p>
        <div style={segRail} role="radiogroup" aria-label="Personalbilder">
          {AVATAR_OPTIONS.map((o) => {
            const disabled = o.id === 'foto' && !hasStaffPhoto
            const on = sel.avatars === o.id
            return (
              <label key={o.id} style={segPill(on, disabled)}>
                <input
                  type="radio"
                  name="staff_avatars"
                  value={o.id}
                  checked={on}
                  disabled={disabled}
                  onChange={() => setSel((s) => ({ ...s, avatars: o.id }))}
                  style={srOnly}
                />
                <span style={{ fontWeight: 650 }}>{o.label}</span>
                <span style={segHint(on)}>{o.hint}</span>
              </label>
            )
          })}
        </div>
        {!hasStaffPhoto ? (
          <p className={pform.hint} style={{ marginTop: 10, marginBottom: 0 }}>
            Foto är avstängt: ingen aktiv medarbetare har en profilbild ännu. Ladda upp
            bilder under <strong>Personal</strong> så låses valet upp. Medarbetare utan
            bild visas alltid som initialer.
          </p>
        ) : null}
      </section>

      <section className={studio.card}>
        <h3 className={studio.cardHead}>Extern bokning</h3>
        <p className={studio.note}>
          Används när bokningsmodulen står på Av. Då går alla Boka-knappar till den
          externa tjänsten i en ny flik. Corevo-bokningen vinner alltid när den är live.
        </p>
        <label className={pform.field}>
          <span>Extern https-länk</span>
          <input
            name="booking_external_url"
            type="url"
            inputMode="url"
            placeholder="https://www.bokadirekt.se/..."
            defaultValue={externalUrl ?? ''}
          />
        </label>
      </section>

      <section className={studio.card}>
        <h3 className={studio.cardHead}>Färger</h3>
        <div style={ctaRow}>
          <span style={{ ...ctaChip, background: cta, color: ctaFg }}>Boka tid</span>
          <span className={pform.hint}>
            Så här ser boknings-knappen ut — textfärgen väljs automatiskt för läsbarhet.
          </span>
        </div>
        {lowContrast ? (
          <p role="alert" style={contrastWarn}>
            Låg kontrast: textfärgen och bakgrunden ligger för nära varandra
            (kontrast {fgBgRatio!.toFixed(1)}:1, rekommenderat minst 4.5:1). Texten kan bli
            svårläst — välj en mörkare text eller ljusare bakgrund.
          </p>
        ) : null}
        <p className={pform.hint} style={{ margin: 0 }}>
          Bokningen använder sidans färger — de ändras under <strong>Allmänt → Varumärke</strong>.
        </p>
      </section>

      <div className={pform.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara bokningsinställningar'}
        </button>
        {state.error ? (
          <span className={`${pform.feedback} auth-error`} role="alert">
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span className={`${pform.feedback} ${pform.feedbackOk}`} role="status">
            {state.success}
          </span>
        ) : null}
      </div>
      <p className={pform.hint} style={{ margin: '-6px 0 0' }}>
        Testa direkt: spara, klicka sedan <strong>Boka tid</strong> i previewen till höger —
        bokningen följer valen.
      </p>
    </form>
  )
}

/**
 * Mini-schematic per bokningssätt — ren CSS-mock som speglar compareCards-korten i
 * design-kanon ("FreshCut bokning.dc.html"): mörk enhetsram → surface med ink-topbar,
 * header (namn + accent-block), hero-gradient, dim-overlay (utom Inbäddad) och en
 * panelBox positionerad per variant (centrerad / dockad i kanten / i flödet) med
 * steg-rader eller chips + accent-CTA. Accent = salongens sparade CTA-färg.
 */
function VariantSchematic({ v, accent }: { v: BookingVariant; accent: string }) {
  const isSteps = v === 'wizard' || v === 'drawer'
  const dim = v !== 'inline'
  const panelBox: CSSProperties =
    v === 'wizard'
      ? { position: 'absolute', left: '13%', right: '13%', top: '52%', transform: 'translateY(-50%)', zIndex: 2 }
      : v === 'inline'
        ? { position: 'relative', margin: '6px 8px 8px' }
        : { position: 'absolute', left: 6, right: 6, bottom: 6, zIndex: 2 }
  return (
    <span aria-hidden="true" style={schemaShell}>
      <span style={schemaScreen}>
        {/* ink-topbar + header (namn-streck + accent-block) + hero */}
        <span style={{ display: 'block', height: 4, background: '#1C1A16' }} />
        <span style={schemaHeader}>
          <span style={{ display: 'block', width: 26, height: 4, borderRadius: 2, background: '#3a342c' }} />
          <span style={{ display: 'block', width: 16, height: 5, background: accent }} />
        </span>
        <span style={{ display: 'block', height: 22, background: 'linear-gradient(180deg,#5c5045,#2a231c)' }} />
        {dim ? <span style={{ position: 'absolute', inset: 0, background: 'rgba(23,17,11,.45)', zIndex: 1 }} /> : null}
        <span style={{ ...schemaPanel, ...panelBox }}>
          <span style={{ display: 'block', width: 22, height: 3, background: accent, marginBottom: 4 }} />
          {isSteps ? (
            <>
              <span style={{ display: 'block', width: '55%', height: 4, borderRadius: 2, background: '#1C1A16', marginBottom: 4 }} />
              <span style={{ display: 'block', height: 8, border: '1px solid #d8d3ca', marginBottom: 3 }} />
              <span style={{ display: 'block', height: 8, border: '1px solid #d8d3ca' }} />
            </>
          ) : (
            <>
              <span style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                <span style={{ height: 7, flex: 1, background: accent }} />
                <span style={{ height: 7, flex: 1, border: '1px solid #d8d3ca' }} />
                <span style={{ height: 7, flex: 1, border: '1px solid #d8d3ca' }} />
              </span>
              <span style={{ display: 'flex', gap: 3 }}>
                <span style={{ height: 7, flex: 1, border: '1px solid #d8d3ca' }} />
                <span style={{ height: 7, flex: 1, border: '1px solid #d8d3ca' }} />
                <span style={{ height: 7, flex: 1, border: '1px solid #d8d3ca' }} />
              </span>
            </>
          )}
          <span style={{ display: 'block', height: 5, background: accent, marginTop: 5 }} />
        </span>
      </span>
    </span>
  )
}

// ── lokala stilar (admin-grammatiken: --c-* tokens, forest = vald) ──────────────
const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
const variantCardOn: CSSProperties = {
  borderColor: 'var(--c-forest, #1f4636)',
  boxShadow: '0 0 0 1px var(--c-forest, #1f4636)',
  background: 'color-mix(in srgb, var(--c-forest, #1f4636) 5%, var(--c-paper, #fff))',
}
function tagChip(on: boolean): CSSProperties {
  return {
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    padding: '1.5px 6px',
    borderRadius: 999,
    border: `1px solid ${on ? 'var(--c-forest, #1f4636)' : 'var(--c-line-strong, #d3dacd)'}`,
    color: on ? 'var(--c-forest, #1f4636)' : 'var(--c-ink-3)',
    whiteSpace: 'nowrap',
  }
}
const segRail: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}
function segPill(on: boolean, disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '9px 14px',
    borderRadius: 8,
    border: `1.5px solid ${on ? 'var(--c-forest, #1f4636)' : 'var(--c-line, #e2e7de)'}`,
    background: on ? 'color-mix(in srgb, var(--c-forest, #1f4636) 8%, var(--c-paper, #fff))' : 'var(--c-paper, #fff)',
    color: on ? 'var(--c-forest, #1f4636)' : 'var(--c-ink-2)',
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    minWidth: 120,
  }
}
function segHint(on: boolean): CSSProperties {
  return { fontSize: 10.5, color: on ? 'var(--c-forest, #1f4636)' : 'var(--c-ink-3)', fontWeight: 400 }
}
const schemaShell: CSSProperties = {
  display: 'block',
  marginTop: 8,
  background: '#17130E',
  borderRadius: 10,
  padding: 3,
}
const schemaScreen: CSSProperties = {
  position: 'relative',
  display: 'block',
  height: 96,
  borderRadius: 8,
  overflow: 'hidden',
  background: '#ffffff',
}
const schemaHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '3px 6px',
  borderBottom: '1px solid #e6e1d8',
}
const schemaPanel: CSSProperties = {
  display: 'block',
  background: '#ffffff',
  border: '1px solid #1C1A16',
  padding: 5,
}
const ctaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 10,
}
const ctaChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 14px',
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.02em',
  flex: 'none',
}
const contrastWarn: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: 'var(--c-danger, #8a3232)',
  background: 'color-mix(in srgb, var(--c-danger, #8a3232) 8%, var(--c-paper, #fff))',
  border: '1px solid color-mix(in srgb, var(--c-danger, #8a3232) 30%, transparent)',
  borderRadius: 8,
  padding: '8px 12px',
  margin: '0 0 12px',
}
