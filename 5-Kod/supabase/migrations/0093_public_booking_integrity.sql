-- 0093 — publik bokning får aldrig ärva service-role som adminundantag.
--
-- Storefrontens server action behöver service_role för rate-limitad gästskrivning,
-- men private.assert_booking_available har avsiktligt ett service-role-undantag
-- för ADMINENS fria minutval. Därför får storefronten en separat, smal RPC som
-- alltid verifierar det publika startkontraktet innan den befintliga atomiska
-- create_public_booking används internt. Admin-RPC:n behåller sitt kontrakt.
--
-- bookings.note är nu bara kundens meddelande. Kontakt lagras i customers via
-- create_public_booking -> private.resolve_customer_id, aldrig i fri text.

begin;

create or replace function private.assert_storefront_booking_start(
  p_tenant uuid,
  p_location uuid,
  p_staff uuid,
  p_service uuid,
  p_start timestamptz,
  p_end timestamptz
) returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday int;
  v_step int;
begin
  select coalesce(svc.slot_step_min, st.slot_step_min, l.slot_step_min, 15),
         l.timezone
    into v_step, v_timezone
    from public.staff st
    join public.staff_services ss
      on ss.tenant_id = p_tenant
     and ss.staff_id = st.id
     and ss.service_id = p_service
    join public.services svc
      on svc.id = ss.service_id
     and svc.tenant_id = p_tenant
     and svc.active = true
    join public.locations l
      on l.id = p_location
     and l.tenant_id = p_tenant
     and l.active = true
   where st.id = p_staff
     and st.tenant_id = p_tenant
     and st.location_id = p_location
     and st.active = true
     and (svc.location_id is null or svc.location_id = p_location);

  if v_step is null or v_timezone is null then
    raise exception 'invalid_booking_resources' using errcode = 'P0002';
  end if;

  v_local_start := p_start at time zone v_timezone;
  v_local_end := p_end at time zone v_timezone;
  v_weekday := extract(dow from v_local_start)::int;

  -- En konfigurerad explicit lista är auktoritativ för veckodagen.
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
    select 1 from public.working_hours wh
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
end;
$$;

revoke all on function private.assert_storefront_booking_start(
  uuid,uuid,uuid,uuid,timestamptz,timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.create_storefront_booking(
  p_tenant_slug text,
  p_service uuid,
  p_staff uuid,
  p_start timestamptz,
  p_note text default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_location uuid default null,
  p_request_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_location uuid;
  v_duration int;
  v_existing uuid;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  select t.id into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  -- En lyckad intent ska fortfarande vara idempotent om schemat ändrats efteråt.
  if p_request_id is not null then
    select b.id into v_existing
      from public.bookings b
     where b.tenant_id = v_tenant and b.request_id = p_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;

  if nullif(pg_catalog.btrim(p_guest_name), '') is null
     or nullif(pg_catalog.btrim(p_guest_email), '') is null
     or nullif(pg_catalog.btrim(p_guest_phone), '') is null then
    raise exception 'guest_contact_required' using errcode = '22023';
  end if;
  if pg_catalog.length(v_note) > 2000 then
    raise exception 'booking_note_too_long' using errcode = '22023';
  end if;
  if v_note ~* '^Gäst:\s*[^<\r\n]+\s*<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>\s*([+0-9][+0-9() .-]{3,})?(\s+—\s+.*)?$' then
    raise exception 'booking_note_contains_legacy_contact' using errcode = '22023';
  end if;

  if p_location is not null then
    select l.id into v_location
      from public.locations l
     where l.id = p_location
       and l.tenant_id = v_tenant
       and l.active = true;
  else
    select l.id into v_location
      from public.locations l
     where l.tenant_id = v_tenant
       and l.is_primary = true
       and l.active = true
     limit 1;
  end if;
  if v_location is null then
    raise exception 'invalid_location' using errcode = 'P0002';
  end if;

  select svc.duration_min into v_duration
    from public.services svc
   where svc.id = p_service
     and svc.tenant_id = v_tenant
     and svc.active = true
     and (svc.location_id is null or svc.location_id = v_location);
  if v_duration is null then
    raise exception 'invalid_service' using errcode = 'P0002';
  end if;

  -- Full DB-backstop: min/max, bekräftade platsöppettider, arbetstid,
  -- stängning, frånvaro, buffert och krock. Den separata publika vakten nedan
  -- stänger just det slotundantag som service_role annars har för admin.
  perform private.assert_booking_available(
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_tenant,
    v_location,
    p_staff,
    p_service,
    p_start,
    p_start + pg_catalog.make_interval(mins => v_duration)
  );
  perform private.assert_storefront_booking_start(
    v_tenant,
    v_location,
    p_staff,
    p_service,
    p_start,
    p_start + pg_catalog.make_interval(mins => v_duration)
  );

  return public.create_public_booking(
    p_tenant_slug => p_tenant_slug,
    p_service => p_service,
    p_staff => p_staff,
    p_start => p_start,
    p_note => v_note,
    p_customer => null,
    p_guest_name => p_guest_name,
    p_guest_email => p_guest_email,
    p_guest_phone => p_guest_phone,
    p_location => v_location,
    p_request_id => p_request_id
  );
end;
$$;

-- Den generella funktionen är intern för admin/storefront men fortsatt exponerad
-- för den inloggade kundens ombokning. service_role måste gå storefrontvägen.
revoke all on function public.create_public_booking(
  text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_public_booking(
  text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid
) to authenticated;
revoke all on function public.create_storefront_booking(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_storefront_booking(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid
) to service_role;

comment on function public.create_storefront_booking(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid
) is 'Publik service-role-skrivväg som alltid verifierar erbjuden start och lagrar kontakt i customers, aldrig bookings.note.';

commit;
