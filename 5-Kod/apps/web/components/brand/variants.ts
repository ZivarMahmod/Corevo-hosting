// Single source of variant selection per layout slot (ADR 01 §3, nivå 2).
// One map per slot; tenant `settings.layout.*` picks a key. New variant =
// new component + new key here — never scattered if-statements.
import { NavA } from './NavA'
import { NavB } from './NavB'
import { Hero1, Hero2 } from './Hero'

export const NAV_VARIANTS = { A: NavA, B: NavB } as const
export const HERO_VARIANTS = { '1': Hero1, '2': Hero2 } as const

export function pickNav(variant?: string) {
  return NAV_VARIANTS[(variant ?? 'A') as keyof typeof NAV_VARIANTS] ?? NAV_VARIANTS.A
}

export function pickHero(variant?: string) {
  return HERO_VARIANTS[(variant ?? '1') as keyof typeof HERO_VARIANTS] ?? HERO_VARIANTS['1']
}
