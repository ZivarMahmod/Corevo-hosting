import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { buildFrom } from './email'
import type { EmailBrandFields } from './templates'

// Per-salon email brand resolution (goal-14). The customer should feel the email
// comes FROM the salon: its name as the From display, its accent/logo on the
// template, its saved slogan in the footer, and — crucially — its
// own inbox as Reply-To so a reply never lands on booking@corevo.se.
//
// Split in two on purpose (testability): resolveEmailBrand() is PURE (no I/O, no
// mocks needed); loadEmailBrand() is the thin async loader that reads the one
// tenant_settings row and delegates to the pure core.

export type EmailBrand = EmailBrandFields & {
  /** From display string: `"<Salong>" <booking@corevo.se>` (Corevo when name absent). */
  from: string
  /** Salon's own inbox; undefined when unset → replies fall back to From (never faked). */
  replyTo?: string
}

type ContactLike = { email?: unknown } | null | undefined
type CopyLike = { tagline?: unknown } | null | undefined

/**
 * PURE brand resolver. Maps salon name + branding + contact + theme into the email
 * brand bundle. Reply-To is omitted when contact.email is blank (we never fabricate
 * one). accentColor = color_accent → color_primary → undefined (template then falls
 * back to Corevo gold). From-name falls back to "Corevo" via buildFrom() when empty.
 */
export function resolveEmailBrand(input: {
  tenantName?: string | null
  branding?: TenantBranding | null
  contact?: ContactLike
  slogan?: unknown
}): EmailBrand {
  const b = input.branding ?? {}
  const email = typeof input.contact?.email === 'string' ? input.contact.email.trim() : ''
  const slogan = typeof input.slogan === 'string' ? input.slogan.trim() : ''
  const accent = (b.color_accent ?? b.color_primary) || undefined
  return {
    from: buildFrom(input.tenantName),
    replyTo: email || undefined,
    accentColor: accent,
    logoUrl: b.logo_url ?? null,
    slogan: slogan || null,
  }
}

/**
 * Thin async loader: read the tenant's branding + settings (one row) and resolve
 * the email brand. Graceful — any read failure / missing row degrades to just the
 * From display name, so a settings hiccup never blocks a notification.
 */
export async function loadEmailBrand(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  tenantName?: string | null,
): Promise<EmailBrand> {
  if (!supabase || !tenantId) return resolveEmailBrand({ tenantName })
  try {
    const { data } = await supabase
      .from('tenant_settings')
      .select('branding, settings')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    const branding = (data?.branding ?? {}) as TenantBranding
    const settings = (data?.settings ?? {}) as Record<string, unknown>
    const contact = (settings.contact ?? null) as ContactLike
    const copy = (settings.copy ?? null) as CopyLike
    return resolveEmailBrand({ tenantName, branding, contact, slogan: copy?.tagline })
  } catch {
    return resolveEmailBrand({ tenantName })
  }
}
