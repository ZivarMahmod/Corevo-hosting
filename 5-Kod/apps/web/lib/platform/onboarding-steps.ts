// Onboarding-stegsekvenser (Sajtbyggare S3 / goal-38) — PURE, testbar källa.
//
// Flag-OFF (legacy) = Temamall + Token-branding som separata steg (BYTE-IDENTISK med
// före S3). Flag-ON = de två ersätts av ETT "Designa sidan"-steg (in-wizard SiteEditor;
// temat kommer från branschens default → ingen tema-väljare). CreateTenantForm gatar
// varje steg på ETIKETTEN (STEPS[step]), aldrig på hårdkodat index, så båda sekvenserna
// mappar rätt. Inget tredje "blandat" tillstånd får vara nåbart (maxning §2).

export const ONBOARDING_STEPS_LEGACY = [
  'Bransch',
  'Namn & subdomän',
  'Temamall',
  'Moduler',
  'Token-branding',
  'Ägare & roll',
] as const

export const ONBOARDING_STEPS_EDITOR = [
  'Bransch',
  'Namn & subdomän',
  'Designa sidan',
  'Moduler',
  'Ägare & roll',
] as const

/** Aktiv stegsekvens utifrån SAJTBYGGARE_ENABLED (server-beräknad, inskickad som prop). */
export function onboardingSteps(editorEnabled: boolean): readonly string[] {
  return editorEnabled ? ONBOARDING_STEPS_EDITOR : ONBOARDING_STEPS_LEGACY
}
