// Barrel for the platform server-action layer. The actions themselves live in
// ./actions/* (one 'use server' file per concern — tenants / branding / status /
// billing / data / people / roles / domains), split out of the old 39 KB monolith
// (goal-44 Spår B). This re-export keeps the public import path `@/lib/platform/actions`
// byte-identical for all 12 consumers — no importer changed. Shared types live in
// ./actions/shared. PURE re-export: no 'use server' here; each action keeps its
// server-action identity from its definition module.
export { createTenant, isSlugTaken } from './actions/tenants'
export { savePlatformBranding } from './actions/branding'
export { setTenantStatus } from './actions/status'
export { saveBilling } from './actions/billing'
export {
  saveTenantData,
  saveTenantLegal,
  saveTenantName,
  updateBookingSettings,
  setTenantCustomerAccounts,
} from './actions/data'
export {
  revealPlatformCustomerContact,
  sendPasswordReset,
  createTenantStaff,
  inviteTenantStaff,
  updateTenantStaff,
  removeTenantStaff,
  setStaffSchedule,
  setStaffServices,
  createPlatformCustomer,
} from './actions/people'
export type { PlatformCustomerContactResult } from './actions/people'
export {
  createTenantService,
  updateTenantService,
  deleteTenantService,
  setServiceStaff,
  uploadServiceImage,
  removeServiceImage,
} from './actions/services'
// goal-64: klubbens nivåer (loyalty_plans) — kundkortets Lojalitet-yta.
export { createLoyaltyPlan, updateLoyaltyPlan, deleteLoyaltyPlan } from './actions/loyalty'
export {
  saveTenantStorefrontCopy,
  uploadTenantStorefrontImage,
  removeTenantStorefrontImage,
} from './actions/storefront-content'
export { saveRolePermissionsAction } from './actions/roles'
export { setTenantTheme } from './actions/theme'
export { saveTenantContact, saveTenantOpeningHours, setContactMessageStatus } from './actions/contact'
// goal-64: offertens förfrågningstyper (tenant_modules.config.subjects) — chipsen mallen ritar.
export { saveOffertSubjects } from './actions/offert'
export {
  saveSiteDraft,
  publishSiteDraft,
  discardSiteDraft,
  restoreSiteRevision,
} from './actions/site-revisions'
export type { SiteRevisionActionState } from './actions/site-revisions'
export {
  saveTenantSingleImage,
  saveTenantStats,
  saveTenantTeamMember,
  saveTenantStaffPhoto,
  setTenantStaffOnSite,
  // goal-64: teamsidans presentationsfält (short_name/specialties/bio, 0057).
  saveTenantStaffProfile,
} from './actions/storefront-extras'
// goal-64: galleriet (gallery_items, 0057) — kundens egna bilder ur bildbiblioteket.
export { createGalleryItem, updateGalleryItem, deleteGalleryItem } from './actions/galleri'
export { addCustomDomain, verifyCustomDomain, removeCustomDomain } from './actions/domains'
export type { ActionState, DomainActionState } from './actions/shared'
