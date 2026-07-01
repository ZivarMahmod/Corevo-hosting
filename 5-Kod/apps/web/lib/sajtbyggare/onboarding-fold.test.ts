// Onboarding draft-fold (Sajtbyggare S3 / goal-38) — folds editor draft into the new
// tenant's settings/branding via the sanitizing core; fail-open (never blocks create).

import { describe, expect, it } from 'vitest'
import { foldOnboardingDraft } from './onboarding-fold'

const baseSettings = () => ({ theme: 'salvia', booking: { variant: 'wizard' }, copy: { tagline: 'bas-tagline' } })
const baseBranding = () => ({ color_accent: '#5E7361', logo_url: 'https://cdn/logo.png' })
const json = (o: unknown) => JSON.stringify(o)

describe('foldOnboardingDraft — folds the draft onto base (salvia)', () => {
  it('TEXT draft → settings.copy.<field> (resolves modifierad), preserving base', () => {
    const r = foldOnboardingDraft('salvia', json({ 'hero.title': 'Vår salong' }), baseSettings(), baseBranding())
    const copy = r.settings.copy as Record<string, unknown>
    expect(copy.heroTitle).toBe('Vår salong') // editor value folded in
    expect(copy.tagline).toBe('bas-tagline') // base copy preserved
    expect(r.settings.theme).toBe('salvia')
    expect(r.branding.color_accent).toBe('#5E7361') // base branding preserved
  })

  it('COLOR draft → branding.<field>, base accent/logo preserved', () => {
    const r = foldOnboardingDraft('salvia', json({ 'color.primary': '#112233' }), baseSettings(), baseBranding())
    expect(r.branding.color_primary).toBe('#112233')
    expect(r.branding.logo_url).toBe('https://cdn/logo.png')
  })

  it('strips XSS from a TEXT draft (same sanitizer as S2 save)', () => {
    const r = foldOnboardingDraft('salvia', json({ 'about.copy': 'Hej<script>alert(1)</script>' }), baseSettings(), baseBranding())
    const v = (r.settings.copy as Record<string, string>).aboutCopy
    expect(v).toContain('Hej')
    expect(v.toLowerCase()).not.toContain('<script')
  })

  it('non-salvia theme with a manifest (zigge) → draft folds via ITS manifest', () => {
    const r = foldOnboardingDraft('zigge', json({ 'hero.title': 'Vår barbershop' }), { ...baseSettings(), theme: 'zigge' }, baseBranding())
    const copy = r.settings.copy as Record<string, unknown>
    expect(copy.heroTitle).toBe('Vår barbershop')
    expect(copy.tagline).toBe('bas-tagline') // base copy preserved
  })
})

describe('foldOnboardingDraft — fail-open (never blocks tenant creation)', () => {
  it('unknown theme (no manifest) → draft ignored, base returned unchanged', () => {
    const s = baseSettings()
    const b = baseBranding()
    const r = foldOnboardingDraft('okant-tema', json({ 'hero.title': 'x' }), s, b)
    expect(r.settings).toBe(s)
    expect(r.branding).toBe(b)
  })
  it('malformed JSON → base unchanged', () => {
    const r = foldOnboardingDraft('salvia', '{not-json', baseSettings(), baseBranding())
    expect((r.settings.copy as Record<string, unknown>).heroTitle).toBeUndefined()
  })
  it('empty draft → base unchanged', () => {
    const r = foldOnboardingDraft('salvia', json({}), baseSettings(), baseBranding())
    expect(r.settings).toEqual(baseSettings())
  })
  it('a draft with an UNSAFE value (fail-closed in the applier) → whole draft ignored, base kept', () => {
    // color.primary invalid → applySiteContentEdits returns ok:false → fold keeps base
    const r = foldOnboardingDraft(
      'salvia',
      json({ 'hero.title': 'ok', 'color.primary': 'red;}body{}' }),
      baseSettings(),
      baseBranding(),
    )
    expect((r.settings.copy as Record<string, unknown>).heroTitle).toBeUndefined() // not folded
    expect(r.branding.color_primary).toBeUndefined()
  })
  it('non-string draft values are dropped, string ones still fold', () => {
    const r = foldOnboardingDraft('salvia', json({ 'hero.title': 'Titel', 'hero.lede': 42 }), baseSettings(), baseBranding())
    const copy = r.settings.copy as Record<string, unknown>
    expect(copy.heroTitle).toBe('Titel')
    expect(copy.heroLede).toBeUndefined()
  })
})
