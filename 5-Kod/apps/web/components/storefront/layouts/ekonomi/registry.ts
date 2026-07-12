import type { FloristTheme } from '../florist/types'
import { floristThemeBlock } from '../florist/types'
import type { ThemeContentDefaults } from '../../theme-content'
import type { ThemeCaps } from '@/lib/platform/theme-capabilities'
import { zentum } from './zentum.theme'

/**
 * EN sanning för EKONOMI-sviten (goal-63). Samma form som florist/registry.ts —
 * varje yta som behöver veta något om en ekonomi-mall härleder det härifrån:
 *
 *   lib/tenant-data.ts            → nycklarna (literal-listan speglar EKONOMI_KEYS)
 *   layouts/index.ts              → komponenten (ekonomi/layouts.ts)
 *   theme-content.ts              → THEME_CONTENT sprider EKONOMI_CONTENT
 *   lib/platform/theme-palettes   → THEME_PALETTES sprider EKONOMI_PALETTES (kategori 'ekonomi')
 *   theme-capabilities.ts         → THEME_CAPS sprider EKONOMI_CAPS
 *   app/layout.tsx                → EKONOMI_THEME_CSS (palettblocken)
 *
 * Sviten återanvänder FloristTheme-TYPEN (kontraktet är svit-oberoende) men INTE
 * florist-registryt. INGEN React-import här — filen dras in av klient-ytor.
 *
 * MODUL-REGELN: ekonomi-mallar väver inte moduler (ingen webshop/blogg i designen) →
 * de står medvetet INTE i THEME_OWNS_MODULES.
 */
export const EKONOMI_THEMES: FloristTheme[] = [zentum]

export const EKONOMI_KEYS: string[] = EKONOMI_THEMES.map((t) => t.key)

export const EKONOMI_CONTENT: Record<string, ThemeContentDefaults> = Object.fromEntries(
  EKONOMI_THEMES.map((t) => [t.key, t.content]),
)

export const EKONOMI_CAPS: Record<string, ThemeCaps> = Object.fromEntries(
  EKONOMI_THEMES.map((t) => [t.key, t.caps]),
)

/** Swatchar till mallväljaren (samma form som THEME_PALETTES). */
export const EKONOMI_PALETTES = EKONOMI_THEMES.map((t) => ({
  key: t.key,
  name: t.name,
  desc: t.desc,
  primary: t.palette.primary,
  bg: t.palette.bg,
  fg: t.palette.fg,
  accent: t.palette.primary,
}))

/** [data-theme]-blocken, emitteras en gång i app/layout.tsx. */
export const EKONOMI_THEME_CSS: string = EKONOMI_THEMES.map(floristThemeBlock).join('\n')

export function isEkonomiTheme(key: string): boolean {
  return EKONOMI_KEYS.includes(key)
}
