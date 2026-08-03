-- External booking keeps public services visible while Corevo booking writes stay closed.
begin;

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('01360000-0000-0000-0000-000000000001', 'external-booking-0136', 'External Booking 0136', 'active'),
  ('01360000-0000-0000-0000-000000000002', 'external-missing-0136', 'External Missing 0136', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.tenant_settings (tenant_id, settings) values
  (
    '01360000-0000-0000-0000-000000000001',
    '{"other":{"keep":true},"booking":{"keep":"yes","verificationMode":"email_only"}}'::jsonb
  ),
  (
    '01360000-0000-0000-0000-000000000002',
    '{"booking":{"provider":"external"}}'::jsonb
  );
insert into public.tenant_modules (tenant_id, module_key, state) values
  ('01360000-0000-0000-0000-000000000001', 'booking', 'off'),
  ('01360000-0000-0000-0000-000000000002', 'booking', 'off');

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where lower(email) = 'platform@corevo.se' limit 1),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from auth.users where lower(email) = 'platform@corevo.se' limit 1),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('platform_admin', true)
  )::text,
  true
);
set local role authenticated;

select public.update_booking_operational_settings(
  '01360000-0000-0000-0000-000000000001',
  'external',
  'https://www.bokadirekt.se/places/external-booking-0136',
  '{"hero":"https://www.bokadirekt.se/places/external-booking-0136","service:01360000-0000-4000-8000-000000000021":"https://www.bokadirekt.se/places/external-booking-0136/services/21"}'::jsonb,
  null
);

do $$
begin
  begin
    perform public.update_booking_operational_settings(
      '01360000-0000-0000-0000-000000000001',
      'external', 'http://unsafe.example', '{}'::jsonb, null
    );
    raise exception 'unsafe_external_url_accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'booking_external_url_invalid' then raise; end if;
  end;
end;
$$;

reset role;

do $$
declare v_settings jsonb;
begin
  select settings into v_settings
    from public.tenant_settings
   where tenant_id = '01360000-0000-0000-0000-000000000001';
  if v_settings #>> '{other,keep}' <> 'true'
     or v_settings #>> '{booking,keep}' <> 'yes'
     or v_settings #>> '{booking,verificationMode}' <> 'email_only'
     or v_settings #>> '{booking,provider}' <> 'external'
     or v_settings #>> '{booking,external_cta_urls,service:01360000-0000-4000-8000-000000000021}'
        <> 'https://www.bokadirekt.se/places/external-booking-0136/services/21' then
    raise exception 'booking_settings_patch_overwrote_or_lost_data';
  end if;
end;
$$;

update public.tenant_modules
set state = 'live'
where tenant_id = '01360000-0000-0000-0000-000000000001'
  and module_key = 'booking';

do $$
begin
  begin
    update public.tenant_modules
       set state = 'live'
     where tenant_id = '01360000-0000-0000-0000-000000000002'
       and module_key = 'booking';
    raise exception 'external_module_without_url_went_live';
  exception when check_violation then
    if sqlerrm <> 'booking_external_url_required' then raise; end if;
  end;
end;
$$;

insert into public.locations (
  id, tenant_id, name, is_primary, timezone, slot_step_min, min_notice_min, max_advance_days
) values (
  '01360000-0000-0000-0000-000000000011',
  '01360000-0000-0000-0000-000000000001',
  'Primary', true, 'UTC', 30, 0, 30
);
insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents, active
) values (
  '01360000-0000-4000-8000-000000000021',
  '01360000-0000-0000-0000-000000000001',
  '01360000-0000-0000-0000-000000000011',
  'External service', 30, 0, true
);
insert into public.staff (id, tenant_id, location_id, title, active) values (
  '01360000-0000-0000-0000-000000000031',
  '01360000-0000-0000-0000-000000000001',
  '01360000-0000-0000-0000-000000000011',
  'Staff', false
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '01360000-0000-0000-0000-000000000001',
  '01360000-0000-0000-0000-000000000031',
  '01360000-0000-4000-8000-000000000021'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
)
select '01360000-0000-0000-0000-000000000001',
       '01360000-0000-0000-0000-000000000011',
       '01360000-0000-0000-0000-000000000031',
       day, '09:00', '18:00'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '01360000-0000-0000-0000-000000000001',
       '01360000-0000-0000-0000-000000000011',
       day, '09:00', '18:00', 'confirmed', now()
  from generate_series(0, 6) day;
insert into public.working_hour_slots (
  tenant_id, location_id, staff_id, weekday, start_time, active
)
select '01360000-0000-0000-0000-000000000001',
       '01360000-0000-0000-0000-000000000011',
       '01360000-0000-0000-0000-000000000031',
       day, '09:00', true
  from generate_series(0, 6) day;
update public.staff set active = true
 where id = '01360000-0000-0000-0000-000000000031';

set local role anon;
do $$
begin
  if (select count(*) from public.services where tenant_id = '01360000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'external_live_service_hidden';
  end if;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1 from public.get_public_bookable_starts(
      '01360000-0000-0000-0000-000000000001',
      '01360000-0000-0000-0000-000000000011',
      '01360000-0000-4000-8000-000000000021',
      array['01360000-0000-0000-0000-000000000031']::uuid[],
      array[date_trunc('day', current_timestamp) + interval '7 days 10 hours']::timestamptz[]
    )
  ) then
    raise exception 'external_provider_exposed_corevo_availability';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
set local session_replication_role = replica;
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, start_ts, end_ts, status, price_cents
) values (
  '01360000-0000-0000-0000-000000000041',
  '01360000-0000-0000-0000-000000000001',
  '01360000-0000-0000-0000-000000000011',
  '01360000-0000-0000-0000-000000000031',
  '01360000-0000-4000-8000-000000000021',
  date_trunc('day', current_timestamp) + interval '7 days 10 hours',
  date_trunc('day', current_timestamp) + interval '7 days 10 hours 30 minutes',
  'pending', 0
);
set local session_replication_role = origin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
begin
  begin
    insert into public.bookings (
      tenant_id, location_id, staff_id, service_id, start_ts, end_ts, status, price_cents
    ) values (
      '01360000-0000-0000-0000-000000000001',
      '01360000-0000-0000-0000-000000000011',
      '01360000-0000-0000-0000-000000000031',
      '01360000-0000-4000-8000-000000000021',
      date_trunc('day', current_timestamp) + interval '8 days 10 hours',
      date_trunc('day', current_timestamp) + interval '8 days 10 hours 30 minutes',
      'pending', 0
    );
    raise exception 'external_provider_booking_insert_succeeded';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'booking_provider_external' then raise; end if;
  end;

  begin
    update public.bookings
       set start_ts = start_ts + interval '1 hour', end_ts = end_ts + interval '1 hour'
     where id = '01360000-0000-0000-0000-000000000041';
    raise exception 'external_provider_booking_reschedule_succeeded';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'booking_provider_external' then raise; end if;
  end;

  update public.bookings
     set status = 'cancelled'
   where id = '01360000-0000-0000-0000-000000000041';
  if not found then raise exception 'external_history_status_update_failed'; end if;

  begin
    insert into private.booking_verification_challenges (
      tenant_id, staff_id, service_id, start_ts, session_token, channel,
      contact_digest, contact_masked, pin_digest
    ) values (
      '01360000-0000-0000-0000-000000000001',
      '01360000-0000-0000-0000-000000000031',
      '01360000-0000-4000-8000-000000000021',
      date_trunc('day', current_timestamp) + interval '8 days 10 hours', gen_random_uuid(), 'email',
      repeat('a', 64), 'e***@example.test', repeat('b', 64)
    );
    raise exception 'external_provider_challenge_insert_succeeded';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'booking_provider_external' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
set state = 'off'
where tenant_id = '01360000-0000-0000-0000-000000000001'
  and module_key = 'booking';
set local role anon;
do $$
begin
  if exists (select 1 from public.services where tenant_id = '01360000-0000-0000-0000-000000000001') then
    raise exception 'off_booking_module_exposed_services';
  end if;
end;
$$;
reset role;

rollback;
