'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import type { ActionState } from '@/lib/admin/actions'
import { BLOG_STATUSES, slugify } from './types'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'
const SLUG_TAKEN = 'Sluggen används redan av ett annat inlägg.'
const PUBLISHED_DELETE = 'Publicerade inlägg bevaras. Arkivera inlägget i stället.'

function blogWriteError(error: { code?: string; message?: string } | null): string {
  if (error?.code === '23505') return SLUG_TAKEN
  if (error?.message?.includes('published_blog_post_delete_forbidden'))
    return PUBLISHED_DELETE
  return GENERIC
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
    .eq('status', 'ready')
    .maybeSingle()
  return data ? id : null
}

// ── Blog posts ─────────────────────────────────────────────────────────────────

export async function createBlogPost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'blogg')
  if (!ctx) return { error: NO_TENANT }

  const title = String(fd.get('title') ?? '').trim()
  if (!title) return { error: 'Ange en rubrik.' }

  const slugRaw = String(fd.get('slug') ?? '').trim()
  const slug = slugify(slugRaw || title)
  if (!slug) return { error: 'Ange en giltig slug.' }

  const excerpt = String(fd.get('excerpt') ?? '').trim() || null
  const body = String(fd.get('body') ?? '').trim() || null

  const sortOrderRaw = String(fd.get('sort_order') ?? '').trim()
  const sort_order = sortOrderRaw !== '' ? parseInt(sortOrderRaw, 10) : 0

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
    // goal-64 (0057): etiketten mallarna ritar över rubriken. Tom → null → ingen etikett.
    tag: String(fd.get('tag') ?? '').trim() || null,
    status: 'draft',
    sort_order: Number.isInteger(sort_order) ? sort_order : 0,
    cover_asset_id,
  })
  if (error) return { error: blogWriteError(error) }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Inlägg skapat.' }
}

export async function updateBlogPost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'blogg')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar inlägg.' }

  const title = String(fd.get('title') ?? '').trim()
  if (!title) return { error: 'Ange en rubrik.' }

  const slugRaw = String(fd.get('slug') ?? '').trim()
  const slug = slugify(slugRaw || title)
  if (!slug) return { error: 'Ange en giltig slug.' }

  const excerpt = String(fd.get('excerpt') ?? '').trim() || null
  const body = String(fd.get('body') ?? '').trim() || null

  const sortOrderRaw = String(fd.get('sort_order') ?? '').trim()
  const sort_order = sortOrderRaw !== '' ? parseInt(sortOrderRaw, 10) : 0

  const supabase = await createClient()

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
      // goal-64 (0057): måste gå att ÄNDRA och TA BORT, inte bara sättas en gång.
      tag: String(fd.get('tag') ?? '').trim() || null,
      sort_order: Number.isInteger(sort_order) ? sort_order : 0,
      cover_asset_id,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: blogWriteError(error) }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Inlägg uppdaterat.' }
}

/**
 * Publish/archive via one locked DB command. First published_at and audit are
 * database-owned so retries and concurrent clicks cannot create false history.
 */
export async function setBlogPostStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'blogg')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar inlägg.' }

  const statusRaw = String(fd.get('status') ?? '')
  if (!(BLOG_STATUSES as readonly string[]).includes(statusRaw))
    return { error: 'Ogiltig status.' }
  const status = statusRaw as (typeof BLOG_STATUSES)[number]

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_blog_post_status', {
    p_tenant: ctx.tenant.id,
    p_post: id,
    p_status: status,
  })
  if (error) return { error: blogWriteError(error) }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Status uppdaterad.' }
}

export async function deleteBlogPost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'blogg')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar inlägg.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: blogWriteError(error) }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/blogg')
  return { success: 'Inlägg borttaget.' }
}
