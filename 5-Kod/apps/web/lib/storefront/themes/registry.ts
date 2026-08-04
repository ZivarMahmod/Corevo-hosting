import { ateljevinter } from './ateljevinter.theme'
import { aurora } from './aurora.theme'
import { blomstertorget } from './blomstertorget.theme'
import { calytrix } from './calytrix.theme'
import { eloria } from './eloria.theme'
import { kalla } from './kalla.theme'
import { lunaria } from './lunaria.theme'
import { onyx } from './onyx.theme'
import { siluett } from './siluett.theme'
import { sivsav } from './sivsav.theme'
import { snitt } from './snitt.theme'
import { solsalt } from './solsalt.theme'
import { zentum } from './zentum.theme'

export const THEME_SUITES = {
  florist: [
    ateljevinter,
    aurora,
    blomstertorget,
    calytrix,
    eloria,
    lunaria,
    onyx,
    sivsav,
    solsalt,
  ],
  salong: [kalla, siluett, snitt],
  ekonomi: [zentum],
} as const

export const THEME_DEFINITIONS = [
  ...THEME_SUITES.florist,
  ...THEME_SUITES.salong,
  ...THEME_SUITES.ekonomi,
]

export function themeDefinition(key: string) {
  return THEME_DEFINITIONS.find((theme) => theme.key === key)
}

export function themeOrderPrefix(key: string): string {
  return themeDefinition(key)?.orderPrefix ?? '#'
}
