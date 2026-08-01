export const PORTAL_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/
export const PORTAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PortalLinkCredential = {
  linkPublicId: string
  secret: string
  keyVersion: 1
}

export function buildPortalLinkFragment(credential: PortalLinkCredential): string {
  if (
    credential.keyVersion !== 1 ||
    !PORTAL_UUID_PATTERN.test(credential.linkPublicId) ||
    !PORTAL_SECRET_PATTERN.test(credential.secret)
  ) {
    throw new Error('invalid_customer_portal_link')
  }
  return `#v1.${credential.linkPublicId}.${credential.secret}`
}

export function parsePortalLinkFragment(fragment: string): PortalLinkCredential | null {
  const match = /^#v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(fragment)
  const linkPublicId = match?.[1]
  const secret = match?.[2]
  if (!linkPublicId || !secret || !PORTAL_UUID_PATTERN.test(linkPublicId) || !PORTAL_SECRET_PATTERN.test(secret)) {
    return null
  }

  return { linkPublicId: linkPublicId.toLowerCase(), secret, keyVersion: 1 }
}
