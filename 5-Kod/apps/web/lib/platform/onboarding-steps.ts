// Onboarding-stegsekvensen — PURE, testbar källa.
//
// Sajtbyggaren revs 2026-07-12: det flagg-gatade "Designa sidan"-steget (in-wizard
// SiteEditor) och dess alternativa stegsekvens är borta. Kvar är EN sekvens — exakt den
// som alltid kördes i prod (flaggan var AV där). CreateTenantForm gatar varje steg på
// ETIKETTEN (ONBOARDING_STEPS[step]), aldrig på hårdkodat index.

export const ONBOARDING_STEPS = [
  'Bransch',
  'Namn & subdomän',
  'Temamall',
  'Moduler',
  'Token-branding',
  'Ägare & roll',
] as const
