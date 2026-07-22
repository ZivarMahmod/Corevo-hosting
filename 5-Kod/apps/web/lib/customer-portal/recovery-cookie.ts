import 'server-only'
import {
  CUSTOMER_PORTAL_KEY_VERSION,
  createPortalPublicId,
  createPortalSecret,
  portalRecoverySubjectDigest,
} from './crypto'
import { PORTAL_SECRET_PATTERN, PORTAL_UUID_PATTERN } from './link'

export const PORTAL_RECOVERY_COOKIE = '__Host-corevo-portal-recovery'
export const PORTAL_RECOVERY_MAX_AGE_SECONDS = 300

export const portalRecoveryCookieOptions = {
  secure: true,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: PORTAL_RECOVERY_MAX_AGE_SECONDS,
}

export async function createPortalRecoveryCredential() {
  const challengePublicId = createPortalPublicId()
  const subjectSecret = createPortalSecret()
  return {
    challengePublicId,
    subjectSecret,
    subjectDigest: await portalRecoverySubjectDigest(subjectSecret),
    keyVersion: CUSTOMER_PORTAL_KEY_VERSION,
    cookieValue: `v${CUSTOMER_PORTAL_KEY_VERSION}.${challengePublicId}.${subjectSecret}`,
  } as const
}

export function parsePortalRecoveryCookie(value: string | null | undefined): {
  challengePublicId: string
  subjectSecret: string
  keyVersion: 1
} | null {
  if (!value) return null
  const match = /^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(value)
  const challengePublicId = match?.[1]
  const subjectSecret = match?.[2]
  if (
    !challengePublicId || !subjectSecret ||
    !PORTAL_UUID_PATTERN.test(challengePublicId) ||
    !PORTAL_SECRET_PATTERN.test(subjectSecret)
  ) return null
  return { challengePublicId: challengePublicId.toLowerCase(), subjectSecret, keyVersion: 1 }
}
