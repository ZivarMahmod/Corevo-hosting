'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Tenant scope for the module admin tools (ShopAdmin/BloggAdmin/MediaLibrary/
 * OffertInbox) — goal-54 §1. When the super-admin kundkort (/salonger/[id])
 * mounts a tool with a tenantId prop, every form inside must carry a hidden
 * `tenantId` field so the dual-guard (lib/admin/module-ctx.ts moduleCtx) knows
 * WHICH tenant the platform admin is editing. In the customer's own admin the
 * prop is absent → no hidden field is rendered → moduleCtx resolves the tenant
 * from the JWT exactly as before (zero behaviour change for salon admins; a
 * posted tenantId is ignored for them anyway).
 *
 * Context instead of prop-drilling: the tools have many nested subcomponents
 * with forms; one provider at the top + one <TenantField/> per <form> keeps the
 * diff mechanical.
 */
const TenantCtx = createContext<string | null>(null)

export function TenantScope({
  tenantId,
  children,
}: {
  tenantId?: string | null
  children: ReactNode
}) {
  return <TenantCtx.Provider value={tenantId ?? null}>{children}</TenantCtx.Provider>
}

/** Hidden tenantId input — renders nothing outside a platform-admin TenantScope. */
export function TenantField({ formId }: { formId?: string }) {
  const tenantId = useContext(TenantCtx)
  if (!tenantId) return null
  return <input type="hidden" name="tenantId" value={tenantId} form={formId} />
}
