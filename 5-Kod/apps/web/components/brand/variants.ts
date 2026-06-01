// Single source of variant selection per layout slot (ADR 01 §3, nivå 2).
// One map per slot; tenant `settings.layout.*` picks a key. New variant =
// new component + new key here — never scattered if-statements.
import { NavA } from './NavA'
import { NavB } from './NavB'
import { NavC } from './NavC'
import { Hero1, Hero2, Hero3 } from './Hero'

export const NAV_VARIANTS = { A: NavA, B: NavB, C: NavC } as const
export const HERO_VARIANTS = { '1': Hero1, '2': Hero2, '3': Hero3 } as const

export function pickNav(variant?: string) {
  return NAV_VARIANTS[(variant ?? 'A') as keyof typeof NAV_VARIANTS] ?? NAV_VARIANTS.A
}

export function pickHero(variant?: string) {
  return HERO_VARIANTS[(variant ?? '1') as keyof typeof HERO_VARIANTS] ?? HERO_VARIANTS['1']
}

// Editorial template (A/B/C) — the per-tenant style personality. Driven off the
// nav variant (the primary composition axis): A 'Salong' (centered, soft, round),
// B 'Atelier' (left editorial, uppercase, square, dark-warm), C 'Studio' (split,
// grid-driven, medium radius). Set as `data-template` on the storefront root so
// the SHARED editorial sections (numbered services, about, …) restyle per
// template too — not just nav + hero. Two tenants on two templates read as
// genuinely unrelated sites.
export const TEMPLATES = ['A', 'B', 'C'] as const
export type TemplateKey = (typeof TEMPLATES)[number]

export function pickTemplate(navVariant?: string): TemplateKey {
  const v = (navVariant ?? 'A').toUpperCase()
  return (TEMPLATES as readonly string[]).includes(v) ? (v as TemplateKey) : 'A'
}
