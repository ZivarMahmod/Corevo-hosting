export type GalleryAdminRow = {
  id: string
  assetId: string | null
  imageUrl: string | null
  caption: string | null
  tag: string | null
  yearLabel: string | null
  aspectRatio: string | null
  altOverride: string | null
  decorative: boolean
  sortOrder: number
  active: boolean
}

export const GALLERY_RATIOS = ['3/2', '4/5', '3/4', '1/1', '16/9'] as const
