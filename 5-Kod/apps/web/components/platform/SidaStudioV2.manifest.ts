export type SiteEditorField = {
  key: string
  label: string
  defaultValue?: string
  rows?: number
  help?: string
}

export type SiteEditorCard = {
  id: string
  title: string
  fields?: SiteEditorField[]
  imageSlot?: 'logo_url' | 'hero_images' | 'gallery_images' | 'about_image' | 'closing_image'
  imageDefaults?: string[]
  imageLimit?: number
  statsDefaults?: [string, string][]
  info?: { text: string; href: string; label: string }
}

export type SiteEditorTab = {
  id: string
  label: string
  sub: string
  path: string
  cards: SiteEditorCard[]
  module?: string
}

export type SiteEditorManifest = {
  tabs: SiteEditorTab[]
  modules?: SiteEditorTab[]
  swatches: Partial<Record<'color_primary' | 'color_accent' | 'color_bg' | 'color_fg', string[]>>
}
