// Barrel for the platform server-action layer. The actions themselves live in
// ./actions/* (one 'use server' file per concern — tenants / branding / status /
// billing / data / people / roles / domains), split out of the old 39 KB monolith
// (goal-44 Spår B). This re-export keeps the public import path `@/lib/platform/actions`
// byte-identical for all 12 consumers — no importer changed. Shared types live in
// ./actions/shared. PURE re-export: no 'use server' here; each action keeps its
// server-action identity from its definition module.
export { createTenant } from './actions/tenants'
export { savePlatformBranding } from './actions/branding'
export { setTenantStatus } from './actions/status'
export { saveBilling } from './actions/billing'
export { saveTenantData } from './actions/data'
export {
  sendPasswordReset,
  createTenantStaff,
  updateTenantStaff,
  removeTenantStaff,
  setStaffSchedule,
  createPlatformCustomer,
  enterHelpMode,
} from './actions/people'
export {
  createTenantService,
  updateTenantService,
  deleteTenantService,
} from './actions/services'
export {
  saveTenantStorefrontCopy,
  uploadTenantStorefrontImage,
  removeTenantStorefrontImage,
} from './actions/storefront-content'
export { saveRolePermissionsAction } from './actions/roles'
export { setSajtbyggareEnabled } from './actions/features'
export { addCustomDomain, verifyCustomDomain, removeCustomDomain } from './actions/domains'
export type { ActionState, DomainActionState } from './actions/shared'
