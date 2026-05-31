import type { BrandProps } from './types'

/** Tenant logo: image when `branding.logo_url` is set, else the salon name. */
export function Logo({ tenant, branding }: BrandProps) {
  if (branding.logo_url) {
    // Arbitrary per-tenant external URL → plain <img> (not next/image).
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={branding.logo_url} alt={tenant.name} className="logo-img" />
  }
  return <span className="logo-text">{tenant.name}</span>
}
