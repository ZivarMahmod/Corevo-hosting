-- 0072 — Atomisk tillgänglighets- och tillståndsvakt för alla bokningsvägar.
--
-- Appen visar bara giltiga tider, men publika/authenticated API-anrop kan göras
-- utan UI:t. Databasen verifierar därför samma kedja som slotmotorn:
-- aktiv plats → aktiv personal+tjänst → längd → arbetstid → explicit tid
-- eller rastersteg → buffert mot bokning/frånvaro.

create or replace function private.assert_booking_available(
  p_booking uuid,
  p_tenant uuid,
  p_location uuid,
  p_staff uuid,
  p_service uuid,
  p_start timestamptz,
  p_end timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday int;
  v_step int;
  v_buffer int;
  v_reserved_end timestamptz;
  v_admin boolean := coalesce((select auth.role()), '') = 'service_role'
    or coalesce((select private.role_level()), 0) >= 3;
begin
  select l.timezone into v_timezone
    from public.locations l
   where l.id = p_location
     and l.tenant_id = p_tenant
     and l.active = true;
  if v_timezone is null then
    raise exception 'invalid_location' using errcode = 'P0002';
  end if;

  select coalesce(svc.slot_step_min, st.slot_step_min, 15),
         coalesce(svc.buffer_min, st.buffer_min, 0)
    into v_step, v_buffer
    from public.staff st
    join public.staff_services ss
      on ss.tenant_id = p_tenant
     and ss.staff_id = st.id
     and ss.service_id = p_service
    join public.services svc
      on svc.id = ss.service_id
     and svc.tenant_id = p_tenant
   where st.id = p_staff
     and st.tenant_id = p_tenant
     and st.active = true
     and svc.active = true;
  if v_step is null then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;

  v_local_start := p_start at time zone v_timezone;
  v_local_end := p_end at time zone v_timezone;
  v_weekday := extract(dow from v_local_start)::int;

  -- Arbetspass går inte över midnatt (end_time > start_time). Bokningen måste
  -- börja och sluta samma lokala datum och rymmas i minst ett arbetspass.
  if v_local_start::date <> v_local_end::date or not exists (
    select 1
      from public.working_hours wh
     where wh.tenant_id = p_tenant
       and wh.location_id = p_location
       and wh.staff_id = p_staff
       and wh.weekday = v_weekday
       and v_local_start::time >= wh.start_time
       and v_local_end::time <= wh.end_time
  ) then
    raise exception 'booking_outside_working_hours' using errcode = 'P0001';
  end if;

  -- Explicita starter ersätter rastret. Utan explicita rader måste starten ligga
  -- på tjänstens/personalens steg, förankrat i det arbetspass den ryms i.
  if not v_admin then
    if exists (
      select 1 from public.working_hour_slots s
       where s.tenant_id = p_tenant
         and s.location_id = p_location
         and s.staff_id = p_staff
         and s.weekday = v_weekday
         and s.active = true
    ) then
      if not exists (
        select 1 from public.working_hour_slots s
         where s.tenant_id = p_tenant
           and s.location_id = p_location
           and s.staff_id = p_staff
           and s.weekday = v_weekday
           and s.active = true
           and s.start_time = v_local_start::time
      ) then
        raise exception 'booking_not_explicit_slot' using errcode = 'P0001';
      end if;
    elsif not exists (
      select 1
        from public.working_hours wh
       where wh.tenant_id = p_tenant
         and wh.location_id = p_location
         and wh.staff_id = p_staff
         and wh.weekday = v_weekday
         and v_local_start::time >= wh.start_time
         and v_local_end::time <= wh.end_time
         and mod(
           (extract(epoch from (v_local_start::time - wh.start_time)) / 60)::int,
           v_step
         ) = 0
    ) then
      raise exception 'booking_not_on_slot_step' using errcode = 'P0001';
    end if;
  end if;

  v_reserved_end := p_end + make_interval(mins => v_buffer);

  -- Kandidatens buffert måste vara fri fram till v_reserved_end. Halvöppna
  -- intervall gör att nästa bokning får börja exakt när bufferten slutar.
  if exists (
    select 1 from public.time_off t
     where t.tenant_id = p_tenant
       and t.staff_id = p_staff
       and (t.location_id is null or t.location_id = p_location)
       and tstzrange(t.start_ts, t.end_ts, '[)')
           && tstzrange(p_start, v_reserved_end, '[)')
  ) then
    raise exception 'booking_overlaps_time_off' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.bookings b
      join public.staff bst
        on bst.id = b.staff_id
       and bst.tenant_id = b.tenant_id
      join public.services bsvc
        on bsvc.id = b.service_id
       and bsvc.tenant_id = b.tenant_id
     where b.tenant_id = p_tenant
       and b.staff_id = p_staff
       and b.id <> p_booking
       and b.status in ('pending', 'confirmed', 'completed')
       and tstzrange(
             b.start_ts,
             b.end_ts + make_interval(mins => coalesce(bsvc.buffer_min, bst.buffer_min, 0)),
             '[)'
           )
           && tstzrange(p_start, v_reserved_end, '[)')
  ) then
    raise exception 'booking_overlaps_reserved_time' using errcode = '23P01';
  end if;
end;
$$;
revoke all on function private.assert_booking_available(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz
) from public;

-- Slot-readmodellen måste reservera befintliga bokningars egen buffert. Annars
-- visar både kund- och adminkalendern en tid som INSERT-triggern sedan avvisar.
create or replace function public.get_busy_intervals(
  p_tenant uuid,
  p_staff_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
) returns table (staff_id uuid, start_ts timestamptz, end_ts timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.staff_id,
         b.start_ts,
         b.end_ts + make_interval(mins => coalesce(svc.buffer_min, st.buffer_min, 0))
    from public.bookings b
    join public.staff st
      on st.id = b.staff_id and st.tenant_id = b.tenant_id
    join public.services svc
      on svc.id = b.service_id and svc.tenant_id = b.tenant_id
   where b.tenant_id = p_tenant
     and b.staff_id = any(p_staff_ids)
     and b.status in ('pending', 'confirmed', 'completed')
     and b.start_ts < p_to
     and b.end_ts + make_interval(mins => coalesce(svc.buffer_min, st.buffer_min, 0)) > p_from
  union all
  select o.staff_id, o.start_ts, o.end_ts
    from public.time_off o
   where o.tenant_id = p_tenant
     and o.staff_id = any(p_staff_ids)
     and o.start_ts < p_to and o.end_ts > p_from
$$;
revoke execute on function public.get_busy_intervals(uuid,uuid[],timestamptz,timestamptz)
  from public;
grant execute on function public.get_busy_intervals(uuid,uuid[],timestamptz,timestamptz)
  to anon, authenticated;

-- Historiska bokningar ska fortfarande kunna avbokas/slutföras efter att en
-- resurs inaktiverats. Då krävs bara same-tenant-integritet. Pending/confirmed
-- kräver däremot hela aktiva tillgänglighetskedjan ovan.
create or replace function private.enforce_booking_resource_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_must_validate boolean;
  v_service_duration int;
  v_service_price int;
begin
  if new.customer_id is not null and not exists (
    select 1 from public.customers c
     where c.id = new.customer_id and c.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_booking_customer' using errcode = 'P0002';
  end if;
  if new.customer_profile_id is not null and not exists (
    select 1 from public.users u
     where u.id = new.customer_profile_id and u.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_booking_customer_profile' using errcode = 'P0002';
  end if;
  if new.customer_id is not null and new.customer_profile_id is not null and not exists (
    select 1 from public.customers c
     where c.id = new.customer_id
       and c.tenant_id = new.tenant_id
       and c.auth_user_id = new.customer_profile_id
  ) then
    raise exception 'booking_customer_identity_mismatch' using errcode = 'P0002';
  end if;

  if tg_op = 'INSERT'
    and coalesce((select auth.role()), '') <> 'service_role'
    and new.status not in ('pending', 'confirmed') then
    raise exception 'historical_booking_insert_forbidden' using errcode = '42501';
  end if;

  if new.status in ('pending', 'confirmed') then
    if tg_op = 'INSERT' then
      select svc.duration_min, svc.price_cents
        into v_service_duration, v_service_price
        from public.services svc
       where svc.id = new.service_id and svc.tenant_id = new.tenant_id;
      if new.price_cents is distinct from v_service_price then
        raise exception 'invalid_booking_price' using errcode = 'P0001';
      end if;
      if new.end_ts is distinct from new.start_ts + make_interval(mins => v_service_duration) then
        raise exception 'invalid_booking_duration' using errcode = 'P0001';
      end if;
      v_must_validate := true;
    else
      if row(new.start_ts, new.end_ts) is distinct from row(old.start_ts, old.end_ts)
        and (new.end_ts - new.start_ts) is distinct from (old.end_ts - old.start_ts) then
        raise exception 'booking_duration_snapshot_immutable' using errcode = 'P0001';
      end if;
      -- pending↔confirmed är en ren godkännande-/betalningsstatus. Själva tiden
      -- validerades när den skapades; ändrade scheman får inte låsa en betald rad.
      v_must_validate := old.status not in ('pending', 'confirmed')
        or row(new.location_id, new.staff_id, new.service_id, new.start_ts, new.end_ts)
           is distinct from
           row(old.location_id, old.staff_id, old.service_id, old.start_ts, old.end_ts);
    end if;
    if v_must_validate then
      -- Serialisera konkurrerande skrivningar för samma personal så buffertkontrollen
      -- inte blir en app-side "kolla sedan skriv"-race.
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(new.staff_id::text, 0)
      );
      perform private.assert_booking_available(
        new.id, new.tenant_id, new.location_id, new.staff_id, new.service_id,
        new.start_ts, new.end_ts
      );
    end if;
  elsif not exists (
    select 1 from public.staff st
     where st.id = new.staff_id and st.tenant_id = new.tenant_id
  ) or not exists (
    select 1 from public.services svc
     where svc.id = new.service_id and svc.tenant_id = new.tenant_id
  ) or not exists (
    select 1 from public.locations l
     where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_booking_resource' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_booking_resource_fence() from public;

-- Direkt authenticated-UPDATE får inte förvandla bokningsraden till ett eget
-- pris-/kund-/tjänste-API eller hoppa mellan godtyckliga statusar. Service role
-- behöver kunna utföra webhook/GDPR-kompensationer och passerar denna vakt.
create or replace function private.guard_authenticated_booking_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') = 'service_role' then
    return new;
  end if;

  if row(new.id, new.tenant_id, new.service_id, new.price_cents,
         new.customer_profile_id, new.request_id, new.created_at)
     is distinct from
     row(old.id, old.tenant_id, old.service_id, old.price_cents,
         old.customer_profile_id, old.request_id, old.created_at) then
    raise exception 'immutable_booking_fields' using errcode = '42501';
  end if;

  if old.status in ('completed', 'cancelled', 'no_show')
    and new.status not in ('pending', 'confirmed')
    and row(new.location_id, new.staff_id, new.start_ts, new.end_ts)
        is distinct from row(old.location_id, old.staff_id, old.start_ts, old.end_ts) then
    raise exception 'historical_booking_schedule_read_only' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending'   and new.status in ('confirmed','completed','cancelled','no_show')) or
    (old.status = 'confirmed' and new.status in ('pending','completed','cancelled','no_show')) or
    (old.status = 'completed' and new.status in ('pending','confirmed','cancelled')) or
    (old.status = 'no_show'   and new.status in ('pending','confirmed','cancelled')) or
    (old.status = 'cancelled' and new.status in ('confirmed'))
  ) then
    raise exception 'invalid_booking_status_transition' using errcode = 'P0001';
  end if;
  if new.status = 'no_show' and new.start_ts > statement_timestamp() then
    raise exception 'future_booking_cannot_be_no_show' using errcode = 'P0001';
  end if;
  if new.status = 'completed' and new.start_ts > statement_timestamp() then
    raise exception 'future_booking_cannot_be_completed' using errcode = 'P0001';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' and exists (
    select 1 from public.payments p
     where p.booking_id = old.id
       and p.tenant_id = old.tenant_id
       and p.status = 'refunded'
  ) then
    raise exception 'refunded_booking_cannot_be_restored' using errcode = 'P0001';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and (
    new.cancelled_at is null
    or new.cancelled_by is null
    or new.cancelled_by not in ('customer', 'business')
  ) then
    raise exception 'cancellation_trace_required' using errcode = 'P0001';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' and (
    new.cancelled_at is not null or new.cancelled_by is not null
  ) then
    raise exception 'cancellation_trace_must_be_cleared' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_authenticated_booking_update() from public;

drop trigger if exists trg_guard_authenticated_booking_update on public.bookings;
create trigger trg_guard_authenticated_booking_update
  before update on public.bookings
  for each row execute function private.guard_authenticated_booking_update();

drop trigger if exists trg_booking_resource_fence on public.bookings;
create trigger trg_booking_resource_fence
  before insert or update of tenant_id, location_id, staff_id, service_id,
    customer_id, customer_profile_id, start_ts, end_ts, status
  on public.bookings
  for each row execute function private.enforce_booking_resource_fence();

-- Stripe-succeeded måste sätta betalning + bokningsstatus i samma transaktion.
-- Annars kan ett trigger-/nätverksfel lämna en betald bokning kvar som pending.
create or replace function public.confirm_booking_payment(
  p_booking uuid,
  p_tenant uuid,
  p_payment_intent text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_status text;
  v_payment_status text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select b.status into v_booking_status
    from public.bookings b
   where b.id = p_booking and b.tenant_id = p_tenant
   for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  update public.payments p
     set status = 'succeeded', stripe_payment_intent_id = p_payment_intent
   where p.booking_id = p_booking
     and p.tenant_id = p_tenant
     and p.status <> 'refunded'
  returning p.status into v_payment_status;

  if not found then
    select p.status into v_payment_status
      from public.payments p
     where p.booking_id = p_booking and p.tenant_id = p_tenant;
    if v_payment_status is null then
      raise exception 'payment_not_found' using errcode = 'P0002';
    end if;
  end if;

  if v_payment_status = 'succeeded' and v_booking_status = 'pending' then
    update public.bookings b
       set status = 'confirmed'
     where b.id = p_booking and b.tenant_id = p_tenant;
    v_booking_status := 'confirmed';
  end if;

  return pg_catalog.jsonb_build_object(
    'booking_status', v_booking_status,
    'payment_status', v_payment_status
  );
end;
$$;
revoke execute on function public.confirm_booking_payment(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.confirm_booking_payment(uuid,uuid,text) to service_role;

-- time_off hade vanlig FK men ingen same-tenant-garanti.
create or replace function private.enforce_time_off_resource_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff s
     where s.id = new.staff_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_time_off_staff' using errcode = 'P0002';
  end if;
  if new.location_id is not null and not exists (
    select 1 from public.locations l
     where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_time_off_location' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_time_off_resource_fence() from public;

drop trigger if exists trg_time_off_resource_fence on public.time_off;
create trigger trg_time_off_resource_fence
  before insert or update of tenant_id, staff_id, location_id
  on public.time_off
  for each row execute function private.enforce_time_off_resource_fence();

comment on function private.assert_booking_available(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz
) is 'Atomisk kontroll av resurs, längd, raster/explicit start, buffert och frånvaro.';
