-- ============================================================================
-- 0002 — Row Level Security (tenant isolation) · ADR 01 §4 / 01-DB-schema §4
-- tenant_id is read from the JWT app_metadata claim (server-set, never
-- user_metadata). Helpers are STABLE and wrapped as (select ...) in policies so
-- the planner caches them (Supabase best practice).
--
-- NOTE: Supabase Cloud denies CREATE in the `auth` schema, so the helpers live
-- in a dedicated `private` schema (sanctioned alternative — NOT exposed by
-- PostgREST, which only serves `public`). Policies call private.tenant_id().
-- ============================================================================

create schema if not exists private;
grant usage on schema private to authenticated, anon, service_role;

create or replace function private.tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
    ''
  )::uuid
$$;

-- Global platform/super admin (level 7-8) → cross-tenant read (ADR 01 §4).
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'platform_admin')::boolean,
    false
  )
$$;

-- ── tenants (no tenant_id; the row IS the tenant) ──
alter table public.tenants enable row level security;
create policy tenants_rls on public.tenants
  for all to authenticated
  using      (id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (id = (select private.tenant_id()) or (select private.is_platform_admin()));

-- ── roles (tenant_id nullable: global roles are readable to authenticated) ──
alter table public.roles enable row level security;
create policy roles_select on public.roles
  for select to authenticated
  using (tenant_id = (select private.tenant_id()) or tenant_id is null or (select private.is_platform_admin()));
create policy roles_write on public.roles
  for all to authenticated
  using      ((tenant_id = (select private.tenant_id())) or (select private.is_platform_admin()))
  with check ((tenant_id = (select private.tenant_id())) or (select private.is_platform_admin()));

-- ── standard tenant-scoped tables ──
do $$
declare
  t text;
begin
  foreach t in array array[
    'tenant_domains', 'tenant_settings', 'users', 'staff', 'services',
    'staff_services', 'working_hours', 'time_off', 'bookings', 'payments'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy %1$s_rls on public.%1$I for all to authenticated '
      || 'using (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin())) '
      || 'with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));',
      t
    );
  end loop;
end $$;

-- ── audit_log: APPEND-ONLY (insert + select; no update/delete) ──
alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- No update/delete policy → denied by RLS. Plus a hard trigger as belt-and-suspenders:
create or replace function public.block_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only (no % allowed)', tg_op;
end;
$$;
create trigger trg_audit_no_update before update on public.audit_log
  for each row execute function public.block_audit_mutation();
create trigger trg_audit_no_delete before delete on public.audit_log
  for each row execute function public.block_audit_mutation();
