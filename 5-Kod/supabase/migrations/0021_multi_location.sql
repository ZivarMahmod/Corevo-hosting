-- 0021 — FULL multi-location (VÅG 4b). Makes the booking engine location-aware:
--   (1) locations.active (soft-deactivate; the table had no active/status column),
--   (2) backfill working_hours.location_id so the new strict per-location availability
--       filter can never silently drop a NULL-location row (zero slots),
--   (3) create_public_booking gains an additive p_location (null -> primary, byte-identical
--       1-location behavior) and stamps bookings.location_id from the chosen location,
--   (4) set_primary_location RPC (atomic demote-then-promote, role-fenced).
set search_path = public;

-- (1) soft-deactivate support. Default true so every existing location stays active.
alter table public.locations add column if not exists active boolean not null default true;

-- (2) backfill: every working_hours/working_hour_slots row gets its tenant's primary
--     location where NULL, so getAvailableSlots' strict `location_id = p_location` filter
--     is unconditionally safe (no NULL-location row silently dropped).
update public.working_hours wh
   set location_id = l.id
  from public.locations l
 where wh.location_id is null
   and l.tenant_id = wh.tenant_id and l.is_primary;
update public.working_hour_slots ws
   set location_id = l.id
  from public.locations l
 where ws.location_id is null
   and l.tenant_id = ws.tenant_id and l.is_primary;

-- (3) create_public_booking — replace 9-arg with 10-arg (additive p_location).
--     Body preserved EXACTLY from 0015; ONLY the location-resolution block changes.
drop function if exists public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text);

create or replace function public.create_public_booking(
  p_tenant_slug text,
  p_service     uuid,
  p_staff       uuid,
  p_start       timestamptz,
  p_note        text default null,
  p_customer    uuid default null,
  p_guest_name  text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_location    uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid; v_duration int; v_price int; v_location uuid; v_id uuid;
  v_uid uuid := auth.uid();
  v_customer_id uuid;
  v_email text; v_phone text;
begin
  -- Identity fence (the action layer is bypassable; this is not).
  if v_uid is null then
    if p_customer is not null then
      raise exception 'forbidden_customer' using errcode = '42501';
    end if;
  elsif p_customer is not null and p_customer <> v_uid then
    raise exception 'forbidden_customer' using errcode = '42501';
  end if;

  -- No past-dated bookings (cheap anti-spam; small grace for clock skew / slot edge).
  if p_start < (now() - interval '2 minutes') then
    raise exception 'start_in_past' using errcode = 'P0001';
  end if;

  select t.id into v_tenant from public.tenants t
   where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002'; end if;

  select s.duration_min, s.price_cents into v_duration, v_price from public.services s
   where s.id = p_service and s.tenant_id = v_tenant and s.active = true;
  if v_duration is null then raise exception 'invalid_service' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.staff st
      join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service
     where st.id = p_staff and st.tenant_id = v_tenant and st.active = true
  ) then raise exception 'invalid_staff' using errcode = 'P0002'; end if;

  -- NEW (VÅG 4): location resolution. A validated p_location (ours + active) wins;
  -- null falls back to the primary (byte-identical 1-location behavior). bookings.location_id
  -- is NOT NULL, so a non-null v_location is guaranteed or we raise (no cryptic NOT NULL error).
  if p_location is not null then
    select l.id into v_location from public.locations l
     where l.id = p_location and l.tenant_id = v_tenant and l.active;
    if v_location is null then raise exception 'invalid_location' using errcode = 'P0002'; end if;
  else
    select l.id into v_location from public.locations l
     where l.tenant_id = v_tenant and l.is_primary and l.active limit 1;
  end if;
  if v_location is null then raise exception 'no_location' using errcode = 'P0002'; end if;

  -- resolve the additive customer_id (customer_profile_id stays = p_customer).
  if p_customer is not null then
    select u.email, u.phone into v_email, v_phone from public.users u where u.id = p_customer;
    v_customer_id := private.resolve_customer_id(v_tenant, p_customer, nullif(btrim(p_guest_name),''), v_email, v_phone);
  else
    v_customer_id := private.resolve_customer_id(v_tenant, null, p_guest_name, p_guest_email, p_guest_phone);
  end if;

  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id, customer_profile_id, customer_id,
    start_ts, end_ts, status, price_cents, note
  ) values (
    v_tenant, v_location, p_staff, p_service, p_customer, v_customer_id,
    p_start, p_start + (v_duration * interval '1 minute'), 'pending', v_price, p_note
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid) from public;
grant  execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid) to anon, authenticated;

-- (4) set_primary_location — atomic demote-then-promote (avoids 23505 on the partial
--     unique index locations_one_primary_idx) and never leaves zero primary. Role-fenced:
--     salon_admin (level>=6) or platform admin only, even though granted to authenticated.
create or replace function public.set_primary_location(p_location uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_tenant uuid := private.tenant_id();
begin
  if not (coalesce(private.role_level(), 0) >= 6 or private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_tenant is null then raise exception 'no_tenant' using errcode = '42501'; end if;
  if not exists (select 1 from public.locations where id = p_location and tenant_id = v_tenant and active) then
    raise exception 'invalid_location' using errcode = 'P0002';
  end if;
  update public.locations set is_primary = false, updated_at = now()
   where tenant_id = v_tenant and is_primary and id <> p_location;
  update public.locations set is_primary = true, updated_at = now()
   where id = p_location and tenant_id = v_tenant;
end;
$$;
revoke all on function public.set_primary_location(uuid) from public, anon;
grant execute on function public.set_primary_location(uuid) to authenticated;
