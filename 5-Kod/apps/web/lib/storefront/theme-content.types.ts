export type ThemeTeamMember = { name: string; role: string; img: string }
export type ThemeStat = [value: string, label: string]

export type ThemeContent = {
  /** Small uppercase label above the hero headline (the salon "kind"). */
  heroEyebrow: string
  /** Hero headline — may contain a \n for a two-line display break. */
  heroTitle: string
  /** Hero supporting paragraph. */
  heroLede: string
  /** One-line tagline used in the footer / utility copy. */
  tagline: string
  /** Thin top utility-strip micro-copy. */
  utility: string
  /** Italic warmth phrase used in About / quote bands. */
  italic: string
  /** "Om salongen" body copy. */
  aboutCopy: string
  /** Per-theme section headers, not owner-editable. */
  servicesEyebrow: string
  servicesTitle: string
  aboutTitle: string
  teamEyebrow: string
  teamTitle: string
  /** Strong per-theme defaults (used only when the owner hasn't uploaded). */
  heroImages: string[]
  galleryImages: string[]
  aboutImage: string
  closingImage: string
  team: ThemeTeamMember[]
  stats: ThemeStat[]
}

export type ResolvedThemeContent = ThemeContent & {
  /** Startsidans om-sektion: aboutCopyHome-override → aboutCopy → temats default. */
  aboutCopyHome: string
  homeSecondTitle?: string
  whyTitle?: string
  whySub?: string
  whyBody?: string
  servicesIntro?: string
  teamLead?: string
  closingEyebrow?: string
  closingTitle?: string
  closingLede?: string
  contactEyebrow?: string
  contactTitle?: string
  pillar1Title?: string
  pillar1Body?: string
  pillar1Link?: string
  pillar2Title?: string
  pillar2Body?: string
  pillar2Link?: string
  pillar3Title?: string
  pillar3Body?: string
  pillar3Link?: string
  shopEyebrow?: string
  shopTitle?: string
  shopCta?: string
  blogEyebrow?: string
  blogTitle?: string
  blogCta?: string
  giftEyebrow?: string
  giftLede?: string
  giftCta?: string
  homeGalleryEyebrow?: string
  galleryEyebrow?: string
  findEyebrow?: string
  clubEyebrow?: string
  clubTitle?: string
  clubLede?: string
  clubCta?: string
  clubNote?: string
  galleryTitle?: string
  galleryLede?: string
}

/** The full default contract a theme is allowed to provide. */
export type ThemeContentDefaults = ThemeContent &
  Partial<Omit<ResolvedThemeContent, keyof ThemeContent>>
