'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant } from '@/lib/admin/tenant'
import type { ActionState } from '@/lib/admin/actions'
import { BLOG_STATUSES, slugify } from './types'

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/**
 * Authorization fence for every blog mutation. Mirrors adminCtx() in
 * lib/admin/actions.ts — RLS isolates tenants but is NOT role-aware, so the
 * role gate lives here. Returns null when the user has no tenant context.
 */
async function adminCtx() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
}

/**
 * Resolve a submitted media asset id to a value safe to persist.
 * '' / missing → null. A non-empty id is verified to belong to THIS tenant
 * (defence-in-depth: a tampered cross-tenant id resolves to null, never persists).
 */
async function resolveTenantAssetId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  raw: string,
): Promise<string | null> {
  const id = raw.trim()
  if (!id) return null
  const { data } = await supabase
    .from('media_assets')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data ? id : null
}

// ── Blog posts ─────────────────────────────────────────────────────────────────

export async function createBlogPost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const title = String(fd.get('title') ?? '').trim()
  if (!title) return { error: 'Ange en rubrik.' }

  const slugRaw = String(fd.get('slug') ?? '').trim()
  const slug = slugRaw || slugify(title)

  const excerpt = String(fd.get('excerpt') ?? '').trim() || null
  const body = String(fd.get('body') ?? '').trim() || null

  const statusRaw = String(fd.get('status') ?? '')
  const status = (BLOG_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as (typeof BLOG_STATUSES)[number])
    : 'draft'

  const sortOrderRaw = String(fd.get('sort_order') ?? '').trim()
  const sort_order = sortOrderRaw !== '' ? parseInt(sortOrderRaw, 10) : 0

  // published_at is set to now only when publishing for the first time.
  const published_at = status === 'published' ? new Date().toISOString() : null

  const supabase = await createClient()
  const cover_asset_id = await resolveTenantAssetId(
    supabase,
    ctx.tenant.id,
    String(fd.get('cover_asset_id') ?? ''),
  )
  const { error } = await supabase.from('blog_posts').insert({
    tenant_id: ctx.tenant.id,
    title,
    slug,
    excerpt,
    body,
    status,
    sort_order: Number.isInteger(sort_order) ? sort_order : 0,
    published_at,
    cover_asset_id,
  })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Inlägg skapat.' }
}

export async function updateBlogPost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar inlägg.' }

  const title = String(fd.get('title') ?? '').trim()
  if (!title) return { error: 'Ange en rubrik.' }

  const slugRaw = String(fd.get('slug') ?? '').trim()
  const slug = slugRaw || slugify(title)

  const excerpt = String(fd.get('excerpt') ?? '').trim() || null
  const body = String(fd.get('body') ?? '').trim() || null

  const statusRaw = String(fd.get('status') ?? '')
  const status = (BLOG_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as (typeof BLOG_STATUSES)[number])
    : 'draft'

  const sortOrderRaw = String(fd.get('sort_order') ?? '').trim()
  const sort_order = sortOrderRaw !== '' ? parseInt(sortOrderRaw, 10) : 0

  const supabase = await createClient()

  // Read the current row to decide published_at behaviour:
  // - If new status is 'published' AND published_at is currently null → set it to now
  //   (first-time publish; we do NOT reset it on re-publish so the original date is kept)
  // - If new status is NOT 'published' → keep published_at as-is (do not null it;
  //   re-publishing later still reflects the original first-publish date)
  const { data: current } = await supabase
    .from('blog_posts')
    .select('status, published_at')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()

  if (!current) return { error: 'Okänt inlägg.' }

  const published_at =
    status === 'published' && current.published_at == null
      ? new Date().toISOString()
      : current.published_at

  const cover_asset_id = await resolveTenantAssetId(
    supabase,
    ctx.tenant.id,
    String(fd.get('cover_asset_id') ?? ''),
  )

  const { error } = await supabase
    .from('blog_posts')
    .update({
      title,
      slug,
      excerpt,
      body,
      status,
      sort_order: Number.isInteger(sort_order) ? sort_order : 0,
      published_at,
      cover_asset_id,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Inlägg uppdaterat.' }
}

/**
 * Quick publish/unpublish toggle (used by the status button in the list).
 * published_at semantics: first publish → set to now; subsequent publishes
 * after archive/draft → keep the original published_at (do not reset).
 */
export async function setBlogPostStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar inlägg.' }

  const statusRaw = String(fd.get('status') ?? '')
  if (!(BLOG_STATUSES as readonly string[]).includes(statusRaw))
    return { error: 'Ogiltig status.' }
  const status = statusRaw as (typeof BLOG_STATUSES)[number]

  const supabase = await createClient()

  // Read current published_at to preserve it on re-publish.
  const { data: current } = await supabase
    .from('blog_posts')
    .select('published_at')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()

  if (!current) return { error: 'Okänt inlägg.' }

  const published_at =
    status === 'published' && current.published_at == null
      ? new Date().toISOString()
      : current.published_at

  const { error } = await supabase
    .from('blog_posts')
    .update({ status, published_at })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Status uppdaterad.' }
}

export async function deleteBlogPost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar inlägg.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Inlägg borttaget.' }
}
