/**
 * De sex storefront-mallarnas standard-paletter — EN sanning som både mall-väljaren
 * (ThemePicker) och Varumärke-formuläret (PlatformBrandingForm) läser, så operatören
 * ser exakt vilka färger "mallens standard" betyder. Värdena SPEGLAR
 * [data-theme]-blocken i packages/ui/tokens.css (lyft därifrån, aldrig påhittade).
 * accent = mallens primary: storefronten sätter --color-accent: var(--color-primary)
 * när tenanten inte valt en egen accent (tokens.css, storefront-blocket).
 */
export type ThemePalette = {
  key: string
  name: string
  desc: string
  primary: string
  bg: string
  fg: string
  accent: string
}

export const THEME_PALETTES: ThemePalette[] = [
  { key: 'freshcut', name: 'FreshCut', desc: 'Barbershop · vit & guld, skarp', primary: '#B59775', bg: '#FFFFFF', fg: '#252525', accent: '#B59775' },
  { key: 'salvia', name: 'Salvia', desc: 'Sage · luftig, minimal', primary: '#5E7361', bg: '#F6F4EE', fg: '#232520', accent: '#5E7361' },
  { key: 'leander', name: 'Leander', desc: 'Lavendel · romantisk editorial', primary: '#7E6E92', bg: '#FBFAF8', fg: '#2A2630', accent: '#7E6E92' },
  { key: 'zigge', name: 'Zigge', desc: 'Mörk · djärv barber', primary: '#C8743C', bg: '#14120E', fg: '#F2ECE2', accent: '#C8743C' },
  { key: 'linnea', name: 'Linnea', desc: 'Terrakotta · varm skandinavisk', primary: '#B0693F', bg: '#F4EDE1', fg: '#2E2820', accent: '#B0693F' },
  { key: 'edit', name: 'Edit', desc: 'Charcoal på ivory · stram', primary: '#3A3733', bg: '#F8F6F1', fg: '#232220', accent: '#3A3733' },
]

export function themePalette(key: string): ThemePalette {
  return THEME_PALETTES.find((t) => t.key === key) ?? (THEME_PALETTES[0] as ThemePalette)
}
