import type { BrandProps } from './types'

/** Tenant logo: image when `branding.logo_url` is set, else the salon name. */
export function Logo({ tenant, branding }: BrandProps) {
  const logoUrl = branding.logo_url?.trim() ?? ''
  return <>
    {/* Arbitrary per-tenant external URL → plain <img> (not next/image). A hidden,
        src-less node keeps the editor preview structurally stable before first upload. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img {...(logoUrl ? { src: logoUrl } : {})} alt={tenant.name} className="logo-img"
      hidden={!logoUrl} data-corevo-logo-image data-corevo-editor-field="logo_url"
      data-corevo-editor-stable-field="logo_url" />
    <span className="logo-text" hidden={!!logoUrl} data-corevo-logo-text data-tenant-name
      data-corevo-editor-field="tenant.name" data-corevo-editor-stable-field="tenant.name">
      {tenant.name}
    </span>
  </>
}
