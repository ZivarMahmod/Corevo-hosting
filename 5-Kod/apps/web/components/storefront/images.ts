// Storefront-foton: TYPEN + bransch-kopplingen. Inga plattforms-default-foton.
//
// Här låg tidigare fem konstanter (HERO_PHOTOS, GALLERY_PHOTOS, ABOUT_PHOTO,
// STYLIST_PHOTOS, CLOSING_PHOTO) med frisör-motiv och frisör-alt-texter
// ("Närbild på klippning hos frisören", "Porträtt av frisör"). De var döda —
// ingen sida importerade dem — men de stod kvar som en inbjudan att göra
// salongsfoton till plattformens default. Det är precis buggen som lät floristen
// ärva frisörens bilder. Rivna (goal-67).
//
// Kedjan som FAKTISKT gäller, via withBranschMedia nedan:
//     ägarens uppladdade bild  >  BRANSCH_IMAGES  >  mallens egna default
// Mallen äger formen (vektor-regeln, goal-59) — inklusive sina default-foton.

import type { TenantBranding } from '@corevo/ui'
import { branschMedia } from './bransch-copy'

export type StorePhoto = { src: string; alt: string }

// ─────────────────────────────────────────────────────────────────────────────
// BRANSCH-FOTON → branding-kanalen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lägg branschens foton UNDER tenantens egna, i `branding`-formen.
 *
 * Varför branding-kanalen: `resolveThemeContent(theme, branding, copy)` behandlar
 * redan `branding.{hero_images,gallery_images,about_image,closing_image}` som
 * HÖGSTA precedens och faller annars till mallens default. Matar vi in branschens
 * foton som branding-värden får vi exakt rätt kedja UTAN att röra theme-content.ts:
 *
 *     ägarens uppladdade bild  >  BRANSCH_IMAGES  >  mallens default
 *
 * Ägaren vinner ALLTID: ett fält som tenanten faktiskt fyllt (icke-tom array /
 * icke-tom sträng) lämnas orört. Bara de fält ägaren INTE laddat upp fylls med
 * branschens foto. Har branschen inga verifierade foton (BRANSCH_IMAGES är medvetet
 * gles) returneras `branding` oförändrat → mallens default gäller, precis som idag.
 *
 * PURE — muterar inte sitt argument. Övriga branding-fält (färger, logo, team,
 * stats) kopieras rakt igenom orörda.
 */
export function withBranschMedia(
  branding: TenantBranding | null | undefined,
  verticalId: string | null | undefined,
): TenantBranding | null | undefined {
  const media = branschMedia(verticalId)
  if (!media) return branding // ingen bransch-media → oförändrat (mallens default)
  const b = branding ?? {}
  const hasList = (v: unknown): boolean => Array.isArray(v) && v.length > 0
  const hasStr = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0
  return {
    ...b,
    hero_images: hasList(b.hero_images) ? b.hero_images : media.heroImages,
    gallery_images: hasList(b.gallery_images) ? b.gallery_images : media.galleryImages,
    about_image: hasStr(b.about_image) ? b.about_image : media.aboutImage,
    closing_image: hasStr(b.closing_image) ? b.closing_image : media.closingImage,
  }
}
