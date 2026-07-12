import type { FloristTheme } from './types'
import { floristThemeBlock } from './types'
import type { ThemeContentDefaults } from '../../theme-content'
import type { ThemeCaps, ExtraField } from '@/lib/platform/theme-capabilities'
import { calytrix } from './calytrix.theme'
import { aurora } from './aurora.theme'
import { sage } from './sage.theme'
import { oliviathyme } from './oliviathyme.theme'
import { paisley } from './paisley.theme'
import { onyx } from './onyx.theme'
import { viora } from './viora.theme'
import { isalara } from './isalara.theme'
import { seraphina } from './seraphina.theme'
import { wildthistle } from './wildthistle.theme'
import { mina } from './mina.theme'
import { lunaria } from './lunaria.theme'
import { eloria } from './eloria.theme'

export type { FloristTheme } from './types'

/**
 * EN sanning för florist-sviten (goal-58, 13 mallar). Allt en annan yta behöver om
 * en florist-mall — nyckel, palett, copy, caps, CSS — härleds härifrån:
 *
 *   lib/tenant-data.ts            → nycklarna (literal-listan speglar FLORIST_KEYS)
 *   layouts/index.ts              → komponenten (florist/layouts.ts) + THEME_OWNS_MODULES
 *   theme-content.ts              → THEME_CONTENT sprider FLORIST_CONTENT
 *   lib/platform/theme-palettes   → THEME_PALETTES sprider FLORIST_PALETTES
 *   theme-capabilities.ts         → THEME_CAPS sprider FLORIST_CAPS
 *   app/layout.tsx                → FLORIST_THEME_CSS (palettblocken)
 *
 * INGEN React-import här — filen dras in av klient-ytor (mallväljaren, studion).
 */
export const FLORIST_THEMES: FloristTheme[] = [
  calytrix, aurora, sage, oliviathyme, paisley, onyx, viora,
  isalara, seraphina, wildthistle, mina, lunaria, eloria,
]

export const FLORIST_KEYS: string[] = FLORIST_THEMES.map((t) => t.key)

export const FLORIST_CONTENT: Record<string, ThemeContentDefaults> = Object.fromEntries(
  FLORIST_THEMES.map((t) => [t.key, t.content]),
)

export const FLORIST_CAPS: Record<string, ThemeCaps> = Object.fromEntries(
  FLORIST_THEMES.map((t) => [t.key, t.caps]),
)

/** goal-61 editor-paritet: mallens redigerbara element → Sida-editorns fält
 *  (spreadas in i THEME_EXTRA_HOME). Bara mallar som deklarerat extraHome. */
export const FLORIST_EXTRA_HOME: Record<string, ExtraField[]> = Object.fromEntries(
  FLORIST_THEMES.filter((t) => t.extraHome?.length).map((t) => [t.key, t.extraHome!]),
)

/** Swatchar till mallväljaren (samma form som THEME_PALETTES). accent = primary,
 *  precis som storefronten gör när tenanten inte valt en egen accent. */
export const FLORIST_PALETTES = FLORIST_THEMES.map((t) => ({
  key: t.key,
  name: t.name,
  desc: t.desc,
  primary: t.palette.primary,
  bg: t.palette.bg,
  fg: t.palette.fg,
  accent: t.palette.primary,
}))

/** Alla 13 [data-theme]-blocken, emitteras en gång i app/layout.tsx. */
export const FLORIST_THEME_CSS: string = FLORIST_THEMES.map(floristThemeBlock).join('\n')

export function isFloristTheme(key: string): boolean {
  return FLORIST_KEYS.includes(key)
}
