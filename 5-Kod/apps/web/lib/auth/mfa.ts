// MFA (TOTP) seam — Supabase Auth MFA is enabled at the project level; the full
// enrollment UI (QR + verify) is built in the admin goal. This module exists so
// portals can already branch on assurance level and so 2FA can be turned on for
// admin/staff roles without a refactor. 2FA is the real account protection here
// (leaked-password protection is deliberately deferred — see migration 0004).
import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Authenticator Assurance Level for the current session.
 *  - 'aal1' = password only
 *  - 'aal2' = password + a verified TOTP factor this session
 * `nextLevel > currentLevel` ⇒ the user has a factor but hasn't completed the
 * second step yet (challenge pending).
 */
export async function getAssuranceLevel(): Promise<{
  current: string | null
  next: string | null
  mfaRequired: boolean
}> {
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return {
    current: data?.currentLevel ?? null,
    next: data?.nextLevel ?? null,
    mfaRequired: !!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2',
  }
}

/** Whether this account has at least one verified TOTP factor. */
export async function hasVerifiedTotp(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  return !!data?.totp?.some((f) => f.status === 'verified')
}
