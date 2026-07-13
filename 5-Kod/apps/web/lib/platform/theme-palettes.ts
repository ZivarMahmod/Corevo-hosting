/**
 * Storefront-mallarnas standard-paletter — EN sanning som mall-väljaren (ThemePicker),
 * onboarding-studion och Varumärke-formuläret (PlatformBrandingForm) läser, så operatören
 * SER vad varje mall är. Värdena SPEGLAR [data-theme]-blocken (packages/ui/tokens.css för
 * de äldre temana; florist-sviten genererar sina ur florist/registry.ts).
 * accent = mallens primary: storefronten sätter --color-accent: var(--color-primary)
 * när tenanten inte valt en egen accent (tokens.css, storefront-blocket).
 *
 * goal-58: sviten är 20 mallar. En platt lista blir en röra → varje mall bär KATEGORI
 * (mallväljarens flikar), TAGGAR (filter: Mörk/Ljus/Minimal…) och HERO (kortets foto).
 */
import { FLORIST_PALETTES } from '@/components/storefront/layouts/florist/registry'
import { EKONOMI_PALETTES } from '@/components/storefront/layouts/ekonomi/registry'
import { SALONG_PALETTES } from '@/components/storefront/layouts/salong/registry'
import { THEME_CONTENT } from '@/components/storefront/theme-content'
import type { StorefrontTheme } from '@/lib/tenant-data'

/** Mallväljarens flikar. En mall kan bara ligga i EN kategori (annars är den inte ett val). */
export type ThemeCategory = 'florist' | 'bokning' | 'ekonomi' | 'kund'

export const THEME_CATEGORIES: { key: ThemeCategory; label: string; hint: string }[] = [
  { key: 'florist', label: 'Blomsterhandel', hint: 'Butik, buketter, bröllop & begravning' },
  { key: 'bokning', label: 'Bokning & behandling', hint: 'Tidsbokning, personal, behandlingar' },
  { key: 'ekonomi', label: 'Ekonomi & redovisning', hint: 'Redovisningsbyrå, rådgivning, bokslut' },
  { key: 'kund', label: 'Kundegna', hint: 'Byggda åt en specifik kund — erbjuds inte nya' },
]

export type ThemePalette = {
  key: string
  name: string
  desc: string
  primary: string
  bg: string
  fg: string
  accent: string
  category: ThemeCategory
  /** Filter-chips i mallväljaren (härledda + mall-egna). */
  tags: string[]
  /** Mallens egen hero-bild (THEME_CONTENT) — kortets förhandsvisning. */
  hero: string
}

/** Ljus eller mörk mall? Relativ luminans på bakgrunden (samma formel som WCAG). */
function isDark(bg: string): boolean {
  const c = parseInt(bg.replace('#', ''), 16)
  const lin = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] < 0.4
}

/** Kulör-ordet ur mallens desc ("Plommon · e-handel först" → "Plommon"). */
function hueTag(desc: string): string {
  const first = (desc.split('·')[0] ?? '').trim()
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function hero(key: string): string {
  return THEME_CONTENT[key as StorefrontTheme]?.heroImages[0] ?? ''
}

function tagsFor(key: string, desc: string, bg: string, extra: string[] = []): string[] {
  return [isDark(bg) ? 'Mörk' : 'Ljus', hueTag(desc), ...extra].filter(Boolean)
}

/** De handbyggda salongs-/barbermallarna (kvar som literaler — de speglar tokens.css). */
const LEGACY: Omit<ThemePalette, 'category' | 'tags' | 'hero'>[] = [
  { key: 'salvia', name: 'Salvia', desc: 'Sage · luftig, minimal', primary: '#5E7361', bg: '#F6F4EE', fg: '#232520', accent: '#5E7361' },
  { key: 'leander', name: 'Leander', desc: 'Lavendel · romantisk editorial', primary: '#7E6E92', bg: '#FBFAF8', fg: '#2A2630', accent: '#7E6E92' },
  { key: 'zigge', name: 'Zigge', desc: 'Mörk · djärv och rå', primary: '#C8743C', bg: '#14120E', fg: '#F2ECE2', accent: '#C8743C' },
  { key: 'linnea', name: 'Linnea', desc: 'Terrakotta · varm skandinavisk', primary: '#B0693F', bg: '#F4EDE1', fg: '#2E2820', accent: '#B0693F' },
  { key: 'edit', name: 'Edit', desc: 'Charcoal på ivory · stram', primary: '#3A3733', bg: '#F8F6F1', fg: '#232220', accent: '#3A3733' },
]

export const THEME_PALETTES: ThemePalette[] = [
  // FLORIST-SVITEN (goal-58) — 13 mallar + flora, härledda ur florist/registry.ts.
  ...FLORIST_PALETTES.map((p) => ({
    ...p,
    category: 'florist' as const,
    tags: tagsFor(p.key, p.desc, p.bg),
    hero: hero(p.key),
  })),
  {
    key: 'flora',
    name: 'Flora',
    desc: 'Mossgrönt på linne · bohemisk florist',
    primary: '#44523B',
    bg: '#F7F3EA',
    fg: '#2B2A24',
    accent: '#44523B',
    category: 'florist',
    tags: tagsFor('flora', 'Mossgrönt på linne · bohemisk florist', '#F7F3EA'),
    hero: hero('flora'),
  },
  // EKONOMI-SVITEN (goal-63) — härledd ur ekonomi/registry.ts.
  ...EKONOMI_PALETTES.map((p) => ({
    ...p,
    category: 'ekonomi' as const,
    tags: tagsFor(p.key, p.desc, p.bg),
    hero: hero(p.key),
  })),
  // SALONG-SVITEN (goal-64) — Claude Design-paketen för salong/frisör. Kategori 'bokning',
  // samma flik som de äldre handbyggda salongsmallarna.
  ...SALONG_PALETTES.map((p) => ({
    ...p,
    category: 'bokning' as const,
    tags: tagsFor(p.key, p.desc, p.bg),
    hero: hero(p.key),
  })),
  ...LEGACY.map((p) => ({
    ...p,
    category: 'bokning' as const,
    tags: tagsFor(p.key, p.desc, p.bg),
    hero: hero(p.key),
  })),
  {
    key: 'freshcut',
    name: 'FreshCut',
    desc: 'Vit & guld · skarp och ljus',
    primary: '#B59775',
    bg: '#FFFFFF',
    fg: '#252525',
    accent: '#B59775',
    // Kundens EGEN mall (freshcut.se-kopian) — erbjuds aldrig nya kunder. Ligger i en egen
    // kategori istället för att filtreras bort i fem olika listor.
    category: 'kund',
    tags: ['Ljus', 'Skarp'],
    hero: hero('freshcut'),
  },
]

export function themePalette(key: string): ThemePalette {
  return THEME_PALETTES.find((t) => t.key === key) ?? (THEME_PALETTES[0] as ThemePalette)
}

/** Mallar en NY kund kan välja bland (allt utom kundegna). */
export const SELECTABLE_THEMES: ThemePalette[] = THEME_PALETTES.filter((t) => t.category !== 'kund')
