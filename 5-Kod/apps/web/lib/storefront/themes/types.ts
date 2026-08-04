import { accentForeground, accentInk, contrastRatio } from '@corevo/ui'
import type { ThemeContentDefaults } from '../theme-content.types'

export function unsplashPhoto(id: string, width = 1600): string {
  return `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format&fit=crop`
}

export type ThemeCaps = {
  heroEyebrow: boolean
  homeStats: boolean
  homeGallery: boolean
  homeAbout: boolean
}

export type ExtraField = {
  name: string
  label: string
  hint?: string
  rows?: number
  default: string
}

export type StorefrontThemeDefinition = {
  key: string
  name: string
  desc: string
  palette: {
    primary: string
    primaryD: string
    bg: string
    surface: string
    fg: string
    fg2: string
    line: string
    accentSoft: string
  }
  fonts: { display: string; body: string }
  radius: string
  navHeight?: { desktop: string; mobile: string }
  shellOffset?: { desktop: string; mobile: string }
  content: ThemeContentDefaults
  caps: ThemeCaps
  orderPrefix?: string
  extraHome?: ExtraField[]
  ownsCopy?: boolean
}

export function themeCssBlock(theme: StorefrontThemeDefinition): string {
  const shellOffset = theme.shellOffset ?? theme.navHeight
  const nav = shellOffset
    ? `[data-world="storefront"][data-theme="${theme.key}"]{--nav-h:${shellOffset.desktop};}` +
      `@media(max-width:720px){[data-world="storefront"][data-theme="${theme.key}"]{--nav-h:${shellOffset.mobile};}}`
    : ''
  const accentFg = accentForeground(theme.palette.primary) ?? '#ffffff'
  const lightSurfaces = [theme.palette.bg, theme.palette.surface, theme.palette.accentSoft].filter(
    (color) => {
      const foreground = accentForeground(color)
      return foreground === '#15281f' || foreground === '#000000'
    },
  )
  const worstLight = lightSurfaces.sort(
    (a, b) => (contrastRatio('#000000', a) ?? 0) - (contrastRatio('#000000', b) ?? 0),
  )[0]
  const ink =
    (worstLight ? accentInk(theme.palette.primary, worstLight) : null) ?? theme.palette.primary
  return (
    nav +
    `[data-world="storefront"][data-theme="${theme.key}"]{--color-primary:${theme.palette.primary};--color-primary-d:${theme.palette.primaryD};--color-bg:${theme.palette.bg};--color-surface:${theme.palette.surface};--color-fg:${theme.palette.fg};--color-fg-2:${theme.palette.fg2};--color-line:${theme.palette.line};--color-accent-soft:${theme.palette.accentSoft};--color-accent-fg:${accentFg};--color-primary-fg:${accentFg};--color-primary-ink:${ink};--font-display:${theme.fonts.display};--font-body:${theme.fonts.body};--sf-radius:${theme.radius};}`
  )
}
