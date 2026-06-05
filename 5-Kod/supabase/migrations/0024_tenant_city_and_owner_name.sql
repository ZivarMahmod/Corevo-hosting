-- 0024_tenant_city_and_owner_name.sql
-- GOAL-20: ge onboarding-/översikts-fält en riktig DB-koppling ("syns i UI → finns i DB").
--   #14 Stad      → tenants.city  (text, nullable): fylls i onboarding, visas i översikt (tom = ärlig tom).
--   #10 Ägar-namn → users.full_name (text, nullable): läsbar källa som ersätter den döda
--                   auth.user_metadata.full_name-skrivningen (ingen vy läste metadata).
-- Additivt + idempotent (add column if not exists). Inget destruktivt, ingen data rörs.
-- RLS: ingen ny policy behövs — tenants.city täcks av befintlig tenants-RLS (samma rad),
--   users.full_name av users_rls (tenant_id = private.tenant_id() OR private.is_platform_admin()).
--   Stad är inte hemlig → ingen kolumn-fence.

alter table public.tenants add column if not exists city text;
alter table public.users  add column if not exists full_name text;

-- Rollback (additiva kolumner → drop är rent om inga andra goals hunnit förlita sig på dem):
--   alter table public.tenants drop column if exists city;
--   alter table public.users   drop column if exists full_name;
