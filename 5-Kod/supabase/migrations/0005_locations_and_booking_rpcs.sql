-- ============================================================================
-- 0005 — Locations (multi-store framtidssäkring) + public booking RPCs (M3).
--
-- Adds:
--   · public.locations           — one row per physical salong (tenant-scoped).
--   · location_id                — on staff/services/working_hours/time_off/bookings,
--                                  backfilled to each tenant's PRIMARY location.
--   · anon SELECT                — staff / staff_services / working_hours / locations
--                                  (no PII; the public booking page renders these).
--   · 3 SECURITY DEFINER RPCs    — get_busy_intervals / create_public_booking /
--                                  get_public_booking. The booking engine runs as
--                                  `anon` (no service-role key needed). Tenant
--                                  scoping is enforced *inside* each function, and
--                                  none of them leak customer PII.
--
-- SECURITY DEFINER + granted-to-anon ⇒ every function pins `set search_path = ''`
-- and fully-qualifies objects (same hardening as the 0004 advisor 0011 fix).
-- create_public_booking does NOT catch the EXCLUDE violation — it lets 23P01
-- propagate so the app layer can turn it into a friendly "tiden togs precis".
--
-- Re-runnable: add-column-if-not-exists, guarded triggers/policies, idempotent
-- location seed + backfill. Customers stay out of scope (01-DB-schema.md models a
-- future `customers` table); guest contact rides bookings.note as a temp seam.
-- ============================================================================

-- ── 1. locations table ──
create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  address    text,
  timezone   text not null default 'Europe/Stockholm',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists locations_tenant_id_idx on public.locations (tenant_id);
-- at most one primary location per tenant
create unique index if not exists locations_one_primary_idx
  on public.locations (tenant_id) where (is_primary);

-- updated_at trigger (guarded — create trigger has no IF NOT EXISTS)
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_locations_updated'
      and tgrelid = 'public.locations'::regclass
  ) then
    create trigger trg_locations_updated before update on public.locations
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── 2. location_id on the operational tables ──
-- Nullable on staff/services/working_hours/time_off (multi-store is framtids-
-- säkring; keep the door open). bookings.location_id is set NOT NULL after the
-- backfill — the create_public_booking RPC always supplies it.
alter table public.staff         add column if not exists location_id uuid references public.locations(id);
alter table public.services      add column if not exists location_id uuid references public.locations(id);
alter table public.working_hours add column if not exists location_id uuid references public.locations(id);
alter table public.time_off      add column if not exists location_id uuid references public.locations(id);
alter table public.bookings      add column if not exists location_id uuid references public.locations(id);

create index if not exists staff_location_id_idx         on public.staff (location_id);
create index if not exists services_location_id_idx      on public.services (location_id);
create index if not exists working_hours_location_id_idx on public.working_hours (location_id);
create index if not exists time_off_location_id_idx      on public.time_off (location_id);
create index if not exists bookings_location_id_idx      on public.bookings (location_id);

-- ── 3. Seed a PRIMARY location per existing tenant + backfill (idempotent) ──
-- On a fresh local reset, tenants don't exist yet at migration time, so this is a
-- no-op there and seed.sql carries the equivalent block. On the live cloud DB the
-- tenants already exist, so this is what actually backfills them.
insert into public.locations (tenant_id, name, timezone, is_primary)
select t.id, t.name, 'Europe/Stockholm', true
  from public.tenants t
 where not exists (
   select 1 from public.locations l where l.tenant_id = t.id and l.is_primary
 );

update public.staff s
   set location_id = l.id
  from public.locations l
 where l.tenant_id = s.tenant_id and l.is_primary and s.location_id is null;

update public.services sv
   set location_id = l.id
  from public.locations l
 where l.tenant_id = sv.tenant_id and l.is_primary and sv.location_id is null;

update public.working_hours wh
   set location_id = l.id
  from public.locations l
 where l.tenant_id = wh.tenant_id and l.is_primary and wh.location_id is null;

update public.time_off tf
   set location_id = l.id
  from public.locations l
 where l.tenant_id = tf.tenant_id and l.is_primary and tf.location_id is null;

update public.bookings b
   set location_id = l.id
  from public.locations l
 where l.tenant_id = b.tenant_id and l.is_primary and b.location_id is null;

-- Now that every booking has a location, enforce it (the RPC always sets it).
alter table public.bookings alter column location_id set not null;

-- ── 4. RLS for locations ──
alter table public.locations enable row level security;

drop policy if exists locations_rls on public.locations;
create policy locations_rls on public.locations
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));

-- anon reads locations of an active tenant (timezone/name for the booking page).
drop policy if exists locations_public_read on public.locations;
create policy locations_public_read on public.locations
  for select to anon
  using (exists (
    select 1 from public.tenants t
     where t.id = locations.tenant_id and t.status = 'active'
  ));

-- ── 5. anon SELECT for the booking page (no PII) ──
-- staff (name/title is shown as "Hilal/John…"), staff_services (who does what),
-- working_hours (opening hours). bookings/time_off stay anon-invisible — busy
-- slots are exposed only via the get_busy_intervals RPC (staff_id + interval).
drop policy if exists staff_public_read on public.staff;
create policy staff_public_read on public.staff
  for select to anon
  using (active = true and exists (
    select 1 from public.tenants t
     where t.id = staff.tenant_id and t.status = 'active'
  ));

drop policy if exists staff_services_public_read on public.staff_services;
create policy staff_services_public_read on public.staff_services
  for select to anon
  using (exists (
    select 1 from public.tenants t
     where t.id = staff_services.tenant_id and t.status = 'active'
  ));

drop policy if exists working_hours_public_read on public.working_hours;
create policy working_hours_public_read on public.working_hours
  for select to anon
  using (exists (
    select 1 from public.tenants t
     where t.id = working_hours.tenant_id and t.status = 'active'
  ));

-- ── 6. RPC: busy intervals (active bookings + time_off) for a staff set ──
-- Returns ONLY (staff_id, start_ts, end_ts) — no customer data. Used by the
-- TS slot engine to subtract busy time from working hours.
create or replace function public.get_busy_intervals(
  p_tenant    uuid,
  p_staff_ids uuid[],
  p_from      timestamptz,
  p_to        timestamptz
)
returns table (staff_id uuid, start_ts timestamptz, end_ts timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.staff_id, b.start_ts, b.end_ts
    from public.bookings b
   where b.tenant_id = p_tenant
     and b.staff_id = any(p_staff_ids)
     and b.status in ('pending', 'confirmed', 'completed')
     and b.start_ts < p_to and b.end_ts > p_from
  union all
  select o.staff_id, o.start_ts, o.end_ts
    from public.time_off o
   where o.tenant_id = p_tenant
     and o.staff_id = any(p_staff_ids)
     and o.start_ts < p_to and o.end_ts > p_from
$$;
revoke execute on function public.get_busy_intervals(uuid, uuid[], timestamptz, timestamptz) from public;
grant  execute on function public.get_busy_intervals(uuid, uuid[], timestamptz, timestamptz) to anon, authenticated;

-- ── 7. RPC: create a booking from the public flow ──
-- Validates active tenant (by slug) + service + staff (offers service) server-
-- side, computes end_ts from the service duration, sets the primary location,
-- inserts status='pending'. Lets the no_double_booking EXCLUDE raise 23P01 so
-- the app can render a friendly "tiden togs precis".
create or replace function public.create_public_booking(
  p_tenant_slug text,
  p_service     uuid,
  p_staff       uuid,
  p_start       timestamptz,
  p_note        text default null,
  p_customer    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant   uuid;
  v_duration int;
  v_price    int;
  v_location uuid;
  v_id       uuid;
begin
  select t.id into v_tenant
    from public.tenants t
   where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  select s.duration_min, s.price_cents into v_duration, v_price
    from public.services s
   where s.id = p_service and s.tenant_id = v_tenant and s.active = true;
  if v_duration is null then
    raise exception 'invalid_service' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.staff st
      join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service
     where st.id = p_staff and st.tenant_id = v_tenant and st.active = true
  ) then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;

  select l.id into v_location
    from public.locations l
   where l.tenant_id = v_tenant and l.is_primary
   limit 1;

  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id, customer_profile_id,
    start_ts, end_ts, status, price_cents, note
  ) values (
    v_tenant, v_location, p_staff, p_service, p_customer,
    p_start, p_start + (v_duration * interval '1 minute'), 'pending', v_price, p_note
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.create_public_booking(text, uuid, uuid, timestamptz, text, uuid) from public;
grant  execute on function public.create_public_booking(text, uuid, uuid, timestamptz, text, uuid) to anon, authenticated;

-- ── 8. RPC: read a single booking for the confirmation page ──
-- Keyed by the unguessable booking uuid. Returns a safe summary (NO note/PII).
create or replace function public.get_public_booking(p_id uuid)
returns table (
  id                uuid,
  status            text,
  start_ts          timestamptz,
  end_ts            timestamptz,
  price_cents       int,
  service_name      text,
  staff_title       text,
  location_name     text,
  location_timezone text,
  payment_mode      text,
  tenant_name       text,
  tenant_slug       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.start_ts, b.end_ts, b.price_cents,
         s.name, st.title, l.name, l.timezone,
         coalesce(ts.payment_mode, 'on_site'), t.name, t.slug
    from public.bookings b
    join public.services s        on s.id = b.service_id
    join public.staff st          on st.id = b.staff_id
    join public.tenants t         on t.id = b.tenant_id
    left join public.locations l        on l.id = b.location_id
    left join public.tenant_settings ts on ts.tenant_id = b.tenant_id
   where b.id = p_id
$$;
revoke execute on function public.get_public_booking(uuid) from public;
grant  execute on function public.get_public_booking(uuid) to anon, authenticated;
