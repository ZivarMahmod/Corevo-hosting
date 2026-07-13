import type { FloristTheme } from '../florist/types'
import { floristThemeBlock } from '../florist/types'
import type { ThemeContentDefaults } from '../../theme-content'
import type { ThemeCaps, ExtraField } from '@/lib/platform/theme-capabilities'
import { kalla } from './kalla.theme'
import { siluett } from './siluett.theme'
import { snitt } from './snitt.theme'

/**
 * EN sanning för SALONG-sviten (goal-64) — Källa · Siluett · Snitt, ur Claude Design-paketen.
 * Samma form som florist/registry.ts och ekonomi/registry.ts: varje yta som behöver veta
 * något om en salong-mall härleder det HÄRIFRÅN, ingen handskriven lista någon annanstans.
 *
 *   lib/tenant-data.ts            → nycklarna (literal-listan speglar SALONG_KEYS)
 *   layouts/index.ts              → komponenten (salong/layouts.ts) + THEME_OWNS_MODULES
 *   theme-content.ts              → THEME_CONTENT sprider SALONG_CONTENT
 *   lib/platform/theme-palettes   → THEME_PALETTES sprider SALONG_PALETTES (kategori 'bokning')
 *   theme-capabilities.ts         → THEME_CAPS + THEME_EXTRA_HOME
 *   app/layout.tsx                → SALONG_THEME_CSS (palettblocken)
 *
 * Sviten återanvänder FloristTheme-TYPEN (kontraktet är svit-oberoende, se salong/types.ts)
 * men INTE florist-registryt. INGEN React-import här — filen dras in av klient-ytor
 * (mallväljaren, studion) som inte ska tvingas ladda tre layout-träd.
 */
export const SALONG_THEMES: FloristTheme[] = [kalla, siluett, snitt]

export const SALONG_KEYS: string[] = SALONG_THEMES.map((t) => t.key)

export const SALONG_CONTENT: Record<string, ThemeContentDefaults> = Object.fromEntries(
  SALONG_THEMES.map((t) => [t.key, t.content]),
)

export const SALONG_CAPS: Record<string, ThemeCaps> = Object.fromEntries(
  SALONG_THEMES.map((t) => [t.key, t.caps]),
)

/** Mallens redigerbara hem-element → Sida-editorns fält. Bara mallar som deklarerat extraHome. */
export const SALONG_EXTRA_HOME: Record<string, ExtraField[]> = Object.fromEntries(
  SALONG_THEMES.filter((t) => t.extraHome?.length).map((t) => [t.key, t.extraHome!]),
)

/** Swatchar till mallväljaren (samma form som THEME_PALETTES). */
export const SALONG_PALETTES = SALONG_THEMES.map((t) => ({
  key: t.key,
  name: t.name,
  desc: t.desc,
  primary: t.palette.primary,
  bg: t.palette.bg,
  fg: t.palette.fg,
  accent: t.palette.primary,
}))

/** goal-64: mallar som äger sin egen text (bransch-lagret hoppas över). */
export const SALONG_OWNS_COPY: string[] = SALONG_THEMES.filter((t) => t.ownsCopy).map((t) => t.key)

/** [data-theme]-blocken, emitteras en gång i app/layout.tsx. */
export const SALONG_THEME_CSS: string = SALONG_THEMES.map(floristThemeBlock).join('\n')

export function isSalongTheme(key: string): boolean {
  return SALONG_KEYS.includes(key)
}
