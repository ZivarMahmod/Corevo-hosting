// Onboarding-studio (goal-48) — the PURE reducer + frozen prop/contract types the
// shell and its 12 leaf panels share. Ports app.jsx's App stage-machine + A-actions,
// but driven by the REAL StudioCfg model (model.ts) and submitted through the proven
// createTenant FormData contract (build-contract §6). No DB, no side effects — every
// function here is pure so the panels stay trivially testable and the flag-OFF path
// (CreateTenantForm) is never touched.
import type { Dispatch } from 'react'
import { type ModuleState } from '@/lib/tenant-modules'
import { type BookingVariant } from '@/lib/platform/booking-variant'
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
 * EXACTLY, so the payload field names are part of the frozen contract:
 *   applyBranch  { key }      — pick a bransch (delegates to model.applyBranch + presets)
 *   setName      { value }    — set name; auto-syncs slug until slugTouched
 *   setSlug      { value }    — set slug by hand → locks slugTouched=true
 *   setTheme     { key }      — set template/theme key
 *   setModule    { key, state }— set one module's lifecycle state
 *   setVariant   { variant }  — set the booking presentation variant (booking sub-choice)
 *   setServices  { services } — replace the onboarding service list (W4; whole-array set)
 *   setAccent    { hex }      — set accent hex ('' = none)
 *   setTagline   { value }
 *   setOwnerName { value }
 *   setOwnerEmail{ value }
 */
export type StudioAction =
  | { type: 'applyBranch'; key: string }
  | { type: 'setName'; value: string }
  | { type: 'setSlug'; value: string }
  | { type: 'setTheme'; key: string }
  | { type: 'setModule'; key: string; state: ModuleState }
  | { type: 'setVariant'; variant: BookingVariant }
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
      case 'applyBranch':
        return applyBranch(cfg, action.key, presets)
      case 'setName':
        return cfg.slugTouched
          ? { ...cfg, name: action.value }
          : { ...cfg, name: action.value, slug: studioSlugify(action.value) }
      case 'setSlug':
        return { ...cfg, slug: action.value, slugTouched: true }
      case 'setTheme':
        return { ...cfg, theme: action.key }
      case 'setModule':
        return { ...cfg, moduleStates: { ...cfg.moduleStates, [action.key]: action.state } }
      case 'setVariant':
        return { ...cfg, variant: action.variant }
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

/** The prop contract every leaf panel receives (frozen — leaves import this type). */
export type PanelProps = {
  cfg: StudioCfg
  dispatch: Dispatch<StudioAction>
  presets: VerticalPresetData
}

/**
 * Translate a StudioCfg into the exact FormData `createTenant` expects (build-contract
 * §6). Mirrors CreateTenantForm's hidden-input shape; createTenant's only hard
 * requirements are `name` + a valid `slug`, the rest is optional/defaulted.
 *
 * - `vertical_id`  emitted always (`branch ?? ''`); server coerces empty → null.
 * - `theme`        one of the 5 lowercase storefront keys, else server → 'leander'.
 * - `booking_variant` cfg.variant (operator-picked in the booking module row, W3;
 *                  defaults to 'wizard'). createTenant re-validates via isBookingVariant.
 * - `modules`      JSON {key:state} of cfg.moduleStates with booking floored to
 *                  live/paused (mirrors moduleSubmitMap); off-keys allowed (server drops).
 * - `color_accent` ONLY when accent !== '' (omitted otherwise — theme owns palette).
 * - `services`     JSON [{name, price_cents}] (W4); kr→öre via krToOre, empty names
 *                  dropped. createTenant re-validates (parseServiceInputs) + inserts.
 * - `hero_title` / `hero_lede` (W5) → settings.copy.{heroTitle,heroLede}; empty = theme
 *                  default. Renders on the live page + preview via resolveThemeContent.
 * - `owner_role`   fixed 'salon_admin'; `site_content_draft` fixed '{}' (W1 — hero copy
 *                  rides settings.copy, NOT the salvia-only draft-fold path).
 * - logo / city are intentionally omitted (deferred / not in StudioCfg).
 */
export function buildCreateTenantFormData(cfg: StudioCfg): FormData {
  const fd = new FormData()
  fd.set('vertical_id', cfg.branch ?? '')
  fd.set('name', cfg.name)
  fd.set('slug', cfg.slug)
  fd.set('theme', cfg.theme)
  fd.set('booking_variant', cfg.variant)

  const modules: Record<string, ModuleState> = { ...cfg.moduleStates }
  modules.booking = modules.booking === 'paused' ? 'paused' : 'live'
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
  // The owner role seam: salon_admin is the only assignable role today (honest fixed
  // value, mirrors CreateTenantForm.tsx). createTenant resolves it via resolveOwnerRole.
  fd.set('owner_role', 'salon_admin')
  // Text persistence (hero/ingress) is a later wave; submit an empty draft in W1.
  fd.set('site_content_draft', '{}')
  return fd
}
