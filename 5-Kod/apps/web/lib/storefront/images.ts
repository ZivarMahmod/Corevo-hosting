/** Tenant media overrides branch media, which overrides theme defaults. */

import type { TenantBranding } from '@corevo/ui'
import { unsplashPhoto } from './themes/types'

export type StorePhoto = { src: string; alt: string }

export const SALON_IMAGE_MANIFEST = {
  salonInterior: unsplashPhoto('1521590832167-7bcbfaa6381f'),
  salonChairs: unsplashPhoto('1560066984-138dadb4c035'),
  styling: unsplashPhoto('1633681926035-ec1ac984418a'),
  cutting: unsplashPhoto('1599351431202-1e0f0137899a'),
  washing: unsplashPhoto('1595476108010-b4d1f102b1b1'),
  color: unsplashPhoto('1522336572468-97b06e8ef143'),
  barberShop: unsplashPhoto('1585747860715-2ba37e788b70'),
  barberCut: unsplashPhoto('1503951914875-452162b0f3f1'),
  barberTools: unsplashPhoto('1622286342621-4bd786c2447c'),
  beard: unsplashPhoto('1621605815971-fbc98d665033'),
  p1: unsplashPhoto('1494790108377-be9c29b29330', 700),
  p2: unsplashPhoto('1500648767791-00dcc994a43e', 700),
  p3: unsplashPhoto('1438761681033-6461ffad8d80', 700),
  p4: unsplashPhoto('1507003211169-0a1dd7228f2d', 700),
  p5: unsplashPhoto('1573497019940-1c28c88b4f3e', 700),
  p6: unsplashPhoto('1544005313-94ddf0286df2', 700),
  g1: unsplashPhoto('1605497788044-5a32c7078486', 900),
  g2: unsplashPhoto('1492106087820-71f1a00d2b11', 900),
  g3: unsplashPhoto('1487412947147-5cebf100ffc2', 900),
  g4: unsplashPhoto('1519699047748-de8e457a634e', 900),
  g5: unsplashPhoto('1559599101-f09722fb4948', 900),
  g6: unsplashPhoto('1457972729786-0411a3b2b626', 900),
} as const

export const FLORA_IMAGE_MANIFEST = {
  shop: unsplashPhoto('1487530811176-3780de880c2d'),
  bouquet: unsplashPhoto('1490750967868-88aa4486c946'),
  peonies: unsplashPhoto('1462275646964-a0e3386b89fa'),
  work: unsplashPhoto('1526047932273-341f2a7631f9'),
  wildflowers: unsplashPhoto('1470509037663-253afd7f0f51'),
  ranunculus: unsplashPhoto('1494972308805-463bc619d34e'),
  vase: unsplashPhoto('1502977249166-824b3a8a4d6d'),
  greenhouse: unsplashPhoto('1466692476868-aef1dfb1e735'),
  bouquet2: unsplashPhoto('1508610048659-a06b669e3321', 900),
  rose: unsplashPhoto('1518895949257-7621c3c786d7', 900),
  field: unsplashPhoto('1500382017468-9049fed747ef', 900),
} as const

export type BranschMedia = {
  heroImages: string[]
  galleryImages: string[]
  aboutImage: string
  closingImage: string
}

export const BRANSCH_IMAGES: Record<string, BranschMedia> = {
  frisör: {
    heroImages: [
      SALON_IMAGE_MANIFEST.salonInterior,
      SALON_IMAGE_MANIFEST.styling,
      SALON_IMAGE_MANIFEST.salonChairs,
    ],
    galleryImages: [
      SALON_IMAGE_MANIFEST.g1,
      SALON_IMAGE_MANIFEST.g2,
      SALON_IMAGE_MANIFEST.g3,
      SALON_IMAGE_MANIFEST.g4,
      SALON_IMAGE_MANIFEST.g5,
      SALON_IMAGE_MANIFEST.g6,
    ],
    aboutImage: SALON_IMAGE_MANIFEST.washing,
    closingImage: SALON_IMAGE_MANIFEST.salonChairs,
  },
  barbershop: {
    heroImages: [
      SALON_IMAGE_MANIFEST.barberShop,
      SALON_IMAGE_MANIFEST.barberCut,
      SALON_IMAGE_MANIFEST.barberTools,
    ],
    galleryImages: [
      SALON_IMAGE_MANIFEST.barberCut,
      SALON_IMAGE_MANIFEST.beard,
      SALON_IMAGE_MANIFEST.barberShop,
      SALON_IMAGE_MANIFEST.barberTools,
      SALON_IMAGE_MANIFEST.g6,
      SALON_IMAGE_MANIFEST.cutting,
    ],
    aboutImage: SALON_IMAGE_MANIFEST.barberTools,
    closingImage: SALON_IMAGE_MANIFEST.barberShop,
  },
  florist: {
    heroImages: [
      FLORA_IMAGE_MANIFEST.shop,
      FLORA_IMAGE_MANIFEST.bouquet,
      FLORA_IMAGE_MANIFEST.peonies,
    ],
    galleryImages: [
      FLORA_IMAGE_MANIFEST.bouquet2,
      FLORA_IMAGE_MANIFEST.ranunculus,
      FLORA_IMAGE_MANIFEST.vase,
      FLORA_IMAGE_MANIFEST.wildflowers,
      FLORA_IMAGE_MANIFEST.rose,
      FLORA_IMAGE_MANIFEST.field,
    ],
    aboutImage: FLORA_IMAGE_MANIFEST.work,
    closingImage: FLORA_IMAGE_MANIFEST.greenhouse,
  },
}
BRANSCH_IMAGES.frisor = BRANSCH_IMAGES['frisör']!
BRANSCH_IMAGES.barberare = BRANSCH_IMAGES.barbershop!

export function branschMedia(verticalId: string | null | undefined): BranschMedia | null {
  if (!verticalId) return null
  return BRANSCH_IMAGES[verticalId] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANSCH-FOTON → branding-kanalen
// ─────────────────────────────────────────────────────────────────────────────

/** Fill only missing tenant media without mutating the branding object. */
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
