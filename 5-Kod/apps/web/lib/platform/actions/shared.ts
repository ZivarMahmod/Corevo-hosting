// Shared types + constants for the platform server-action concern files (actions/*).
// NOT a 'use server' module: it exports plain types/consts, so the per-concern
// 'use server' files import these without making them client-importable values.
import type { DcvRecord } from '@/lib/cloudflare/custom-hostnames'

export type ActionState = {
  error?: string
  success?: string
  /** The primary action succeeded, but a secondary guarantee did not. */
  warning?: string
  /** On a successful createTenant: the new tenant's id + slug, so the onboarding-studio
   *  result-vy (W6) can link the real /kunder/[id] + show the reserved public address.
   *  Optional + additive — message-only consumers (CreateTenantForm) ignore it. */
  tenant?: { id: string; slug: string }
}

export type DomainActionState = {
  error?: string
  success?: string
  /** verify: true ONLY when the DB verified flag was flipped (the resolution contract). */
  verified?: boolean
  /** On add/verify: the live CF hostname state + the DCV records to show the customer. */
  hostname?: { domain: string; status: string; sslStatus: string | null; dcv: DcvRecord[] }
}

export const GENERIC = 'Något gick fel. Försök igen.'
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
