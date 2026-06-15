// Blogg-modul — SHARED types + pure helpers (multi-bransch spår 5).
//
// PURE, NO I/O, NO 'server-only'. This file is the client-safe twin of the shop's
// lib/storefront/shop/types.ts and the offert module's lib/storefront/offert/types.ts:
// it may be imported by BOTH the server loader (load-blogg.ts) AND any future
// 'use client' island (e.g. an interactive post filter). It therefore must NEVER
// import a 'server-only' module (the Supabase server client) — that crashes
// `next build` the moment a client component pulls a type from here. Only types +
// framework-agnostic helpers live here.
//
// CONFIG-FIRST (beslut 14.5 / §15): blogg is ONE module with presentation VARIANTS,
// not a fork. The variant + its params live in tenant_modules.config; this module
// parses that jsonb into a typed BloggConfig the storefront can branch on. The DB
// table (0034) is variant-agnostic; only presentation differs.
//
// NO PAYMENT (unlike shop/offert): a blog publishes content and never touches money,
// so there is no payment hook here at all — nothing to park.

/** The three presentation variants (mirrors modules.variant_schema.layout.enum in
 *  0034). */
export const BLOGG_LAYOUTS = ['list', 'grid', 'featured'] as const
export type BloggLayout = (typeof BLOGG_LAYOUTS)[number]

/** Human labels per variant (Swedish storefront copy). Single source of truth so
 *  the section and any admin reuse the same wording. */
export const BLOGG_LAYOUT_LABELS: Record<BloggLayout, string> = {
  list: 'Lista',
  grid: 'Rutnät',
  featured: 'Utvald + lista',
}

/** Parsed tenant_modules.config for the blogg module. Defaults mirror 0034's
 *  default_config. No payment hook — a blog never renders a pay step. */
export type BloggConfig = {
  layout: BloggLayout
  /** How many published posts to surface in the storefront listing. */
  postsPerPage: number
}

/** One storefront-facing post (a client-safe view model; subset of blog_posts
 *  needed to render). The cover image is resolved from the joined media asset. */
export type BloggPost = {
  id: string
  title: string
  slug: string | null
  excerpt: string | null
  body: string | null
  coverAssetId: string | null
  publishedAt: string | null
  /** Resolved cover image (from the joined media_assets row), null when none. */
  coverImageUrl: string | null
  coverImageAlt: string | null
}

/** Everything the BloggSection needs after the loader runs. */
export type BloggData = {
  config: BloggConfig
  posts: BloggPost[]
}

const DEFAULT_BLOGG_CONFIG: BloggConfig = {
  layout: 'grid',
  postsPerPage: 6,
}

function asLayout(raw: unknown): BloggLayout {
  return (BLOGG_LAYOUTS as readonly string[]).includes(raw as string)
    ? (raw as BloggLayout)
    : DEFAULT_BLOGG_CONFIG.layout
}

function asPositiveInt(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

/**
 * Defensively coerce the raw tenant_modules.config jsonb into a typed BloggConfig.
 * Robust to missing/partial config (a freshly activated draft has only the 0034
 * default; a malformed row degrades to DEFAULT_BLOGG_CONFIG).
 */
export function parseBloggConfig(raw: unknown): BloggConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_BLOGG_CONFIG }
  const src = raw as Record<string, unknown>
  return {
    layout: asLayout(src.layout),
    postsPerPage: asPositiveInt(src.posts_per_page, DEFAULT_BLOGG_CONFIG.postsPerPage),
  }
}

/** Human label for a layout variant (Swedish). Pure — used by the server section
 *  and any admin reuse. */
export function bloggLayoutLabel(layout: BloggLayout): string {
  return BLOGG_LAYOUT_LABELS[layout]
}
