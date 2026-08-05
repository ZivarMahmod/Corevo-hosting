// Onboarding-studio (goal-48) — the pure reducer and prop contracts shared by the
// studio panels. StudioCfg is submitted through the existing createTenant FormData
// boundary; this file has no DB access or side effects.
import type { Dispatch } from 'react'
import { type ModuleState } from '@/lib/tenant-modules'
import { type BookingVariant } from '@/lib/platform/booking-variant'
import type { BookingProviderKind } from '@/lib/platform/booking-external-url'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import {
  type StudioCfg,
  type StudioService,
  applyBranch,
  studioSlugify,
} from './model'
import { krToOre } from './services'

/** The three top-level stages the studio walks through (port app.jsx stage). */
export type StudioStage = 'super' | 'studio' | 'result'

/**
 * Every cfg mutation a panel can dispatch (ports app.jsx's `A` action set, adapted to
 * the leaner W1 StudioCfg). Discriminated on `type`; the leaves match these literals
 * EXACTLY, so the payload field names are part of the action contract:
 *   applyBranch  { key }      — tag the customer's category ONLY (no theme/module seeding)
 *   setOnboardingMode { mode } — Corevo-led onboarding or external booking-led setup
 *   setName      { value }    — set name; auto-syncs slug until slugTouched
 *   setSlug      { value }    — set slug by hand → locks slugTouched=true
 *   setModule    { key, state }— set one module's lifecycle state
 *   setVariant   { variant }  — set the booking presentation variant (booking sub-choice)
 *   setServices  { services } — replace the onboarding service list (W4; whole-array set)
 *   setAccent    { hex }      — set accent hex ('' = none)
 *   setTagline   { value }
 *   setOwnerName { value }
 *   setOwnerEmail{ value }
 */
export type StudioAction =
  | { type: 'setOnboardingMode'; mode: StudioCfg['onboardingMode'] }
  | { type: 'applyBranch'; key: string }
  | { type: 'setName'; value: string }
  | { type: 'setSlug'; value: string }
  | { type: 'setCity'; value: string }
  | { type: 'setTheme'; value: string }
  | { type: 'setModule'; key: string; state: ModuleState }
  | { type: 'setVariant'; variant: BookingVariant }
  | { type: 'setBookingProvider'; provider: BookingProviderKind }
  | { type: 'setBookingExternalUrl'; value: string }
  | { type: 'setServices'; services: StudioService[] }
  | { type: 'setAccent'; hex: string }
  | { type: 'setTagline'; value: string }
  | { type: 'setHeroTitle'; value: string }
  | { type: 'setHeroLede'; value: string }
  | { type: 'setOwnerName'; value: string }
  | { type: 'setOwnerEmail'; value: string }

/** The reducer shape (a presets-bound pure function cfg×action → cfg). */
export type StudioReducer = (cfg: StudioCfg, action: StudioAction) => StudioCfg

/**
 * Build the PURE studio reducer bound to the loaded presets (applyBranch needs them).
 *
 * Slug wrinkle (build-contract §10 risk 1 — the CORRECT behaviour, not the design
 * bug): `setName` only auto-syncs the slug while `slugTouched` is false; once the
 * operator edits the subdomän by hand (`setSlug`) we set `slugTouched=true`, so later
 * name edits never clobber a hand-typed slug.
 */
export function makeStudioReducer(presets: VerticalPresetData): StudioReducer {
  return function studioReducer(cfg: StudioCfg, action: StudioAction): StudioCfg {
    switch (action.type) {
      case 'setOnboardingMode':
        return {
          ...cfg,
          onboardingMode: action.mode,
          bookingProvider: action.mode === 'external' ? 'external' : cfg.bookingProvider,
        }
      case 'applyBranch':
        // Bransch FÖRFYLLER (Zivar 2026-07-11, "hjärndött att starta en kund"): valet
        // seedar tema (vertical.default_template) + modul-states från bransch-förvalen
        // (VerticalEditor på /branscher äger dem). Efter skapandet ändras de i
        // kundkortet; onboardingen ska bara skapa en korrekt startpunkt.
        return applyBranch(cfg, action.key, presets)
      case 'setName':
        return cfg.slugTouched
          ? { ...cfg, name: action.value }
          : { ...cfg, name: action.value, slug: studioSlugify(action.value) }
      case 'setSlug':
        return { ...cfg, slug: action.value, slugTouched: true }
      case 'setCity':
        return { ...cfg, city: action.value }
      case 'setTheme':
        return { ...cfg, theme: action.value }
      case 'setModule':
        return { ...cfg, moduleStates: { ...cfg.moduleStates, [action.key]: action.state } }
      case 'setVariant':
        return { ...cfg, variant: action.variant }
      case 'setBookingProvider':
        return { ...cfg, bookingProvider: action.provider }
      case 'setBookingExternalUrl':
        return { ...cfg, bookingExternalUrl: action.value }
      case 'setServices':
        return { ...cfg, services: action.services }
      case 'setAccent':
        return { ...cfg, accent: action.hex }
      case 'setTagline':
        return { ...cfg, tagline: action.value }
      case 'setHeroTitle':
        return { ...cfg, heroTitle: action.value }
      case 'setHeroLede':
        return { ...cfg, heroLede: action.value }
      case 'setOwnerName':
        return { ...cfg, ownerName: action.value }
      case 'setOwnerEmail':
        return { ...cfg, ownerEmail: action.value }
      default: {
        const _exhaustive: never = action
        return _exhaustive
      }
    }
  }
}

/** The prop contract every leaf panel receives. */
export type PanelProps = {
  cfg: StudioCfg
  dispatch: Dispatch<StudioAction>
  presets: VerticalPresetData
}

/**
 * Translate a StudioCfg into the exact FormData `createTenant` expects (build-contract
 * §6). createTenant requires `name`,
 * a valid `slug`, a selectable theme and `owner_email`.
 *
 * - `vertical_id`  emitted always (`branch ?? ''`); server coerces empty → null.
 * - `theme`        one of the 5 lowercase storefront keys, else server → 'leander'.
 * - `booking_variant` cfg.variant (operator-picked in the booking module row, W3;
 *                  defaults to 'wizard'). createTenant re-validates via isBookingVariant.
 * - `modules`      JSON {key:state} of the operator's exact on/off choices.
 * - `color_accent` ONLY when accent !== '' (omitted otherwise — theme owns palette).
 * - `services`     JSON [{name, price_cents}] (W4); kr→öre via krToOre, empty names
 *                  dropped. createTenant re-validates (parseServiceInputs) + inserts.
 * - `hero_title` / `hero_lede` (W5) → settings.copy.{heroTitle,heroLede}; empty = theme
 *                  default. Renders on the live page + preview via resolveThemeContent.
 * - logo / city are intentionally omitted (deferred / not in StudioCfg).
 */
export function buildTenantOnboardingFormData(cfg: StudioCfg): FormData {
  const fd = new FormData()
  fd.set('vertical_id', cfg.branch ?? '')
  fd.set('name', cfg.name)
  fd.set('slug', cfg.slug)
  fd.set('city', cfg.city)
  fd.set('theme', cfg.theme)
  fd.set('booking_variant', cfg.variant)
  fd.set('booking_provider', cfg.bookingProvider)
  fd.set('booking_external_url', cfg.bookingExternalUrl)

  const modules: Record<string, ModuleState> = { ...cfg.moduleStates }
  fd.set('modules', JSON.stringify(modules))

  if (cfg.accent !== '') fd.set('color_accent', cfg.accent)
  // Services (W4): kr string → integer öre at the boundary; drop empty names. The
  // server (parseServiceInputs) is authoritative — it re-trims, re-clamps + caps count.
  const services = cfg.services
    .map((s) => ({ name: s.name.trim(), price_cents: krToOre(s.price) }))
    .filter((s) => s.name !== '')
  fd.set('services', JSON.stringify(services))
  fd.set('tagline', cfg.tagline)
  // Hero copy (W5) → settings.copy.{heroTitle,heroLede} (createTenant). Empty = the
  // theme default wins; renders on the live page + the preview via resolveThemeContent.
  fd.set('hero_title', cfg.heroTitle)
  fd.set('hero_lede', cfg.heroLede)
  fd.set('owner_name', cfg.ownerName)
  fd.set('owner_email', cfg.ownerEmail)
  return fd
}
