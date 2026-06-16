// S0 sajtbyggare spike — deploy-wide feature flag (the ENV axis, not tenant_modules).
//
// OFF in prod: top-level wrangler vars set SAJTBYGGARE_ENABLED="false" → every
// spike route calls notFound() → zero new public surface on the production worker.
// ON only on the staging worker (env.staging.vars.SAJTBYGGARE_ENABLED="true").
//
// READ AT CALL TIME, never at module scope: on the OpenNext/Workers adapter the
// wrangler `vars` are injected into process.env per-request, so a top-level read can
// observe `undefined` even when the var is set (the documented failure in
// lib/tenant.ts:63-77 that caused a live 404). Always call this inside the
// server-component/route body.
export function sajtbyggareEnabled(): boolean {
  return process.env.SAJTBYGGARE_ENABLED === 'true'
}
