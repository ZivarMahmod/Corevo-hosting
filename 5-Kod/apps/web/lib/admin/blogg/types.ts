// Pure types for the Blogg module admin surface.
// ZERO imports — this file is safe to import from both client and server code.

export type BlogPostRow = {
  id: string
  title: string
  slug: string | null
  excerpt: string | null
  body: string | null
  cover_asset_id: string | null
  status: string
  published_at: string | null
  sort_order: number
  created_at: string
  updated_at: string | null
  /** goal-64 (0057): inläggets etikett ("Skötselråd", "Torgliv") — den lilla versalen mallarna
   *  ritar över rubriken. null = ingen etikett renderas. */
  tag: string | null
}

export const BLOG_STATUSES = ['draft', 'published', 'archived'] as const
export type BlogStatus = (typeof BLOG_STATUSES)[number]

export const BLOG_STATUS_LABELS: Record<BlogStatus, string> = {
  draft: 'Utkast',
  published: 'Publicerad',
  archived: 'Arkiverad',
}

/**
 * Convert an arbitrary string into a URL-safe slug.
 * - Swedish characters: å→a, ä→a, ö→o, é→e
 * - Spaces and underscores → '-'
 * - Strip anything that is not [a-z0-9-]
 * - Collapse repeated hyphens
 * - Trim leading/trailing hyphens
 * Pure function — no side-effects, no imports.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/ë/g, 'e')
    .replace(/à/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ü/g, 'u')
    .replace(/ú/g, 'u')
    .replace(/ù/g, 'u')
    .replace(/î/g, 'i')
    .replace(/ï/g, 'i')
    .replace(/ô/g, 'o')
    .replace(/[ _]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}
