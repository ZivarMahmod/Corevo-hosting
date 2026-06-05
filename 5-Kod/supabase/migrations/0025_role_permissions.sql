-- 0025_role_permissions.sql
-- GOAL-21 RBAC: make the hardcoded permission matrix real, stored, editable config.
--   Stores ONLY the editable matrix cells (role_name × area → perm). Role identity,
--   labels, tone and the DEFAULT fallback stay in code (DEFAULT_ROLE_CATALOG) so the
--   app still works if this table is dropped (rollback safety).
-- Global per role_name (NOT per tenant) in v1 — mirrors the current catalog. Per-tenant
--   override is future, not here.
-- Additive + idempotent. Seed = EXACTLY the current ROLE_CATALOG (catalog.ts) → diff 0.
--   '—' in the UI maps to 'none' here (no special chars in the check constraint).

create table if not exists public.role_permissions (
  id          uuid primary key default gen_random_uuid(),
  role_name   text not null,                       -- super_admin | salon_admin | staff | support | ekonomi
  area        text not null,                       -- matches PERMISSION_AREAS
  perm        text not null check (perm in ('full','own','view','none')),
  updated_at  timestamptz not null default now(),
  unique (role_name, area)
);

alter table public.role_permissions enable row level security;

-- Read: any authenticated user may read the matrix (read-only insyn). Write: platform_admin only.
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists role_permissions_write_admin on public.role_permissions;
create policy role_permissions_write_admin on public.role_permissions
  for all using (private.is_platform_admin()) with check (private.is_platform_admin());

-- Seed defaults = current ROLE_CATALOG, IDENTICAL. on conflict do nothing so re-running
-- the migration never clobbers an admin's later edits (idempotent + edit-safe).
-- Areas order: Tenants, Kunder, Bokningar, Fakturering, Branding, Personal, Drift.
insert into public.role_permissions (role_name, area, perm) values
  ('super_admin','Tenants','full'),('super_admin','Kunder','full'),('super_admin','Bokningar','full'),
  ('super_admin','Fakturering','full'),('super_admin','Branding','full'),('super_admin','Personal','full'),
  ('super_admin','Drift','full'),
  ('salon_admin','Tenants','none'),('salon_admin','Kunder','own'),('salon_admin','Bokningar','own'),
  ('salon_admin','Fakturering','view'),('salon_admin','Branding','own'),('salon_admin','Personal','own'),
  ('salon_admin','Drift','none'),
  ('staff','Tenants','none'),('staff','Kunder','view'),('staff','Bokningar','own'),
  ('staff','Fakturering','none'),('staff','Branding','none'),('staff','Personal','none'),
  ('staff','Drift','none'),
  ('support','Tenants','view'),('support','Kunder','view'),('support','Bokningar','view'),
  ('support','Fakturering','none'),('support','Branding','none'),('support','Personal','none'),
  ('support','Drift','view'),
  ('ekonomi','Tenants','view'),('ekonomi','Kunder','none'),('ekonomi','Bokningar','none'),
  ('ekonomi','Fakturering','full'),('ekonomi','Branding','none'),('ekonomi','Personal','none'),
  ('ekonomi','Drift','none')
on conflict (role_name, area) do nothing;

-- Rollback (app falls back to DEFAULT_ROLE_CATALOG in code):
--   drop table if exists public.role_permissions cascade;
