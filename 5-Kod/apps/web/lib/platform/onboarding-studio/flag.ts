// Onboarding-studio (goal-48) — deploy-wide feature flag (the ENV axis).
//
// OFF in prod (default): the platform onboarding page renders the proven
// CreateTenantForm (5-step wizard) unchanged. ON only on staging while the studio
// waves are proven; once 0-FAIL it flips on in prod and the form retires.
//
// READ AT CALL TIME, never at module scope: on the OpenNext/Workers adapter wrangler
// `vars` are injected into process.env per-request, so a top-level read can observe
// `undefined` even when set (the documented lib/tenant.ts 404). Call inside the
// server-component/route body.
export function onboardingStudioEnabled(): boolean {
  return process.env.ONBOARDING_STUDIO_ENABLED === 'true'
}
