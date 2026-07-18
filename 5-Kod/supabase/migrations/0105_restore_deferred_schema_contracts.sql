-- 0105 — make fresh and upgraded databases converge after historical manual runs.
--
-- Production records 0014 as applied although slot_holds and its RPCs are absent.
-- A normal db push cannot repair an object hidden behind an applied history row,
-- so this additive migration restores the dormant contract explicitly. The two
-- write RPCs remain service-only until the booking wizard deliberately activates
-- holds in a later product migration.
--
-- 0058 also intended shop_order_counters to be server-only. Give that intent an
-- explicit deny policy so RLS inventory and fresh projects do not depend on old
-- default grants.

create table if not exists public.slot_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  session_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (end_ts > start_ts),
  check (expires_at > created_at)
);

create index if not exists slot_holds_lookup_idx
  on public.slot_holds (tenant_id, staff_id, expires_at);
create index if not exists slot_holds_expires_idx
  on public.slot_holds (expires_at);
create unique index if not exists slot_holds_session_uniq
  on public.slot_holds (staff_id, start_ts, session_token);

alter table public.slot_holds enable row level security;

drop policy if exists slot_holds_rls on public.slot_holds;
drop policy if exists slot_holds_public_read on public.slot_holds;
drop policy if exists slot_holds_public_write on public.slot_holds;
drop policy if exists slot_holds_public_release on public.slot_holds;
drop policy if exists slot_holds_admin_read on public.slot_holds;
drop policy if exists slot_holds_scoped_read on public.slot_holds;
create policy slot_holds_scoped_read on public.slot_holds
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or (
          (select private.role_level()) >= 3
          and exists (
            select 1
            from public.staff s
            where s.id = slot_holds.staff_id
              and s.tenant_id = slot_holds.tenant_id
              and s.location_id is not null
              and (select private.can_access_location(s.location_id))
          )
        )
      )
    )
  );

revoke all on table public.slot_holds from public, anon, authenticated;
grant select on table public.slot_holds to authenticated;
grant select, insert, update, delete on table public.slot_holds to service_role;

create or replace function public.place_slot_hold(
  p_tenant_slug text,
  p_staff uuid,
  p_service uuid,
  p_start timestamptz,
  p_token text,
  p_ttl_min integer default 5
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_duration integer;
  v_end timestamptz;
  v_id uuid;
begin
  if p_token is null or btrim(p_token) = '' or char_length(p_token) > 200 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if p_ttl_min is null or p_ttl_min <= 0 or p_ttl_min > 60 then
    raise exception 'invalid_ttl' using errcode = '22023';
  end if;
  if p_start < now() - interval '2 minutes' then
    raise exception 'start_in_past' using errcode = '22023';
  end if;

  select t.id into v_tenant
  from public.tenants t
  where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  select s.duration_min into v_duration
  from public.services s
  where s.id = p_service and s.tenant_id = v_tenant and s.active = true;
  if v_duration is null then
    raise exception 'invalid_service' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.staff st
    join public.staff_services ss
      on ss.tenant_id = st.tenant_id
     and ss.staff_id = st.id
     and ss.service_id = p_service
    where st.id = p_staff
      and st.tenant_id = v_tenant
      and st.active = true
  ) then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;

  v_end := p_start + make_interval(mins => v_duration);

  -- Serialize contenders for the same staff/start before checking bookings and
  -- live holds. A hash collision only serializes unrelated attempts; it cannot
  -- allow two holds through.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_staff::text || ':' || p_start::text, 0)
  );

  if exists (
    select 1
    from public.bookings b
    where b.tenant_id = v_tenant
      and b.staff_id = p_staff
      and b.status in ('pending', 'confirmed', 'completed')
      and tstzrange(b.start_ts, b.end_ts) && tstzrange(p_start, v_end)
  ) then
    raise exception 'slot_taken' using errcode = '23P01';
  end if;

  if exists (
    select 1
    from public.slot_holds h
    where h.tenant_id = v_tenant
      and h.staff_id = p_staff
      and h.expires_at > now()
      and h.session_token <> p_token
      and tstzrange(h.start_ts, h.end_ts) && tstzrange(p_start, v_end)
  ) then
    raise exception 'slot_held' using errcode = '23P01';
  end if;

  insert into public.slot_holds (
    tenant_id, staff_id, service_id, start_ts, end_ts, session_token, expires_at
  ) values (
    v_tenant, p_staff, p_service, p_start, v_end, p_token,
    now() + make_interval(mins => p_ttl_min)
  )
  on conflict (staff_id, start_ts, session_token) do update set
    expires_at = now() + make_interval(mins => p_ttl_min),
    end_ts = excluded.end_ts,
    service_id = excluded.service_id
  returning id into v_id;

  return v_id;
end
$$;

create or replace function public.release_slot_hold(
  p_staff uuid,
  p_start timestamptz,
  p_token text
) returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.slot_holds
  where staff_id = p_staff and start_ts = p_start and session_token = p_token
$$;

create or replace function public.prune_expired_slot_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.slot_holds where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

revoke all on function public.place_slot_hold(
  text, uuid, uuid, timestamptz, text, integer
) from public, anon, authenticated;
revoke all on function public.release_slot_hold(
  uuid, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.prune_expired_slot_holds()
  from public, anon, authenticated;
grant execute on function public.place_slot_hold(
  text, uuid, uuid, timestamptz, text, integer
) to service_role;
grant execute on function public.release_slot_hold(
  uuid, timestamptz, text
) to service_role;
grant execute on function public.prune_expired_slot_holds()
  to service_role;

drop policy if exists shop_order_counters_client_deny_all
  on public.shop_order_counters;
create policy shop_order_counters_client_deny_all
  on public.shop_order_counters
  for all to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.shop_order_counters from public, anon, authenticated;
grant select, insert, update on table public.shop_order_counters to service_role;
