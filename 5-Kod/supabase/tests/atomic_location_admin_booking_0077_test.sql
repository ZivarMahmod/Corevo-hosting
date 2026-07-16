-- 0077 runtime: riktiga triggers, RPC:er och scope-helpers. Allt rullas tillbaka.
begin;

grant select, insert, update, delete on public.locations, public.services,
  public.staff, public.staff_services, public.working_hours, public.time_off,
  public.customers, public.bookings, public.user_location_access,
  public.location_opening_hours, public.location_closures to authenticated;
grant usage on schema extensions to authenticated;
grant execute on function extensions.gen_random_uuid() to authenticated;

insert into public.tenants (id, slug, name) values
  ('77000000-0000-0000-0000-000000000001', 'rpc-0077-a', 'RPC 0077 A');
insert into public.locations (id, tenant_id, name, is_primary) values
  ('77000000-0000-0000-0000-000000000011', '77000000-0000-0000-0000-000000000001', 'A', true),
  ('77000000-0000-0000-0000-000000000012', '77000000-0000-0000-0000-000000000001', 'B', false);
insert into public.roles (id, tenant_id, name, level) values
  ('77000000-0000-0000-0000-000000000021', '77000000-0000-0000-0000-000000000001', 'owner', 6);
insert into auth.users (id, email) values
  ('77000000-0000-0000-0000-000000000101', 'owner-0077@example.test'),
  ('77000000-0000-0000-0000-000000000102', 'admin-a-0077@example.test'),
  ('77000000-0000-0000-0000-000000000103', 'admin-empty-0077@example.test');
insert into public.users (id, tenant_id, email, role_id, access_scope) values
  ('77000000-0000-0000-0000-000000000101', '77000000-0000-0000-0000-000000000001', 'owner-0077@example.test', '77000000-0000-0000-0000-000000000021', 'organization'),
  ('77000000-0000-0000-0000-000000000102', '77000000-0000-0000-0000-000000000001', 'admin-a-0077@example.test', '77000000-0000-0000-0000-000000000021', 'locations'),
  ('77000000-0000-0000-0000-000000000103', '77000000-0000-0000-0000-000000000001', 'admin-empty-0077@example.test', '77000000-0000-0000-0000-000000000021', 'locations');

select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.user_location_access (tenant_id, user_id, location_id) values
  ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000102', '77000000-0000-0000-0000-000000000011');
insert into public.services (id, tenant_id, location_id, name, duration_min) values
  ('77000000-0000-0000-0000-000000000031', '77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000011', 'A service', 30),
  ('77000000-0000-0000-0000-000000000032', '77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000012', 'B service', 30);
insert into public.staff (id, tenant_id, location_id, title) values
  ('77000000-0000-0000-0000-000000000041', '77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000011', 'Staff A'),
  ('77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000012', 'Staff B');
insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000041', '77000000-0000-0000-0000-000000000031'),
  ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000032');
insert into public.working_hours (tenant_id, staff_id, location_id, weekday, start_time, end_time) values
  ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000041', '77000000-0000-0000-0000-000000000011', 1, '09:00', '18:00'),
  ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000012', 1, '09:00', '18:00');
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
) values
  ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000011', 1, '09:00', '18:00', 'confirmed', now()),
  ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000012', 1, '09:00', '18:00', 'confirmed', now());
insert into public.location_closures (
  id, tenant_id, location_id, start_ts, end_ts, reason
) values (
  '77000000-0000-0000-0000-000000000051',
  '77000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000011',
  '2027-01-04 14:00+00', '2027-01-04 15:00+00', 'Closed'
);
insert into public.customers (id, tenant_id, full_name) values
  ('77000000-0000-0000-0000-000000000061', '77000000-0000-0000-0000-000000000001', 'Customer A'),
  ('77000000-0000-0000-0000-000000000062', '77000000-0000-0000-0000-000000000001', 'Customer B');
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values
  ('77000000-0000-0000-0000-000000000071', '77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000011', '77000000-0000-0000-0000-000000000041', '77000000-0000-0000-0000-000000000031', '77000000-0000-0000-0000-000000000061', '2027-01-04 08:00+00', '2027-01-04 08:30+00', 'confirmed', 0),
  ('77000000-0000-0000-0000-000000000072', '77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000012', '77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000032', '77000000-0000-0000-0000-000000000062', '2027-01-04 08:00+00', '2027-01-04 08:30+00', 'confirmed', 0);

-- Publiken får bara godkända staff/start-par, aldrig de råa intervallen.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare n int; only_start timestamptz;
begin
  if has_function_privilege(
    'anon', 'public.get_busy_intervals(uuid,uuid[],timestamptz,timestamptz)', 'EXECUTE'
  ) then raise exception 'anon_raw_busy_execute'; end if;
  if not has_function_privilege(
    'anon', 'public.get_public_bookable_starts(uuid,uuid,uuid,uuid[],timestamptz[])', 'EXECUTE'
  ) then raise exception 'anon_bookable_starts_missing'; end if;

  select count(*), min(start_ts) into n, only_start
    from public.get_public_bookable_starts(
      '77000000-0000-0000-0000-000000000001',
      '77000000-0000-0000-0000-000000000011',
      '77000000-0000-0000-0000-000000000031',
      array['77000000-0000-0000-0000-000000000041'::uuid],
      array[
        '2027-01-04 08:00+00'::timestamptz,
        '2027-01-04 09:00+00'::timestamptz,
        '2027-01-04 14:00+00'::timestamptz
      ]
    );
  if n <> 1 or only_start <> '2027-01-04 09:00+00'::timestamptz then
    raise exception 'public_bookable_projection_wrong: %, %', n, only_start;
  end if;
end $$;

-- Platsadmin A.
reset role;
select set_config('request.jwt.claim.sub', '77000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"77000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"tenant_id":"77000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;

-- Befintlig kund och idempotent retry.
do $$
declare r jsonb; bid uuid; n int;
begin
  r := public.create_admin_booking(
    '77000000-0000-0000-0000-000000000031',
    '77000000-0000-0000-0000-000000000041',
    '2027-01-04 10:00+00',
    '77000000-0000-0000-0000-000000000081',
    '77000000-0000-0000-0000-000000000061',
    null, null, null, 'existing',
    '77000000-0000-0000-0000-000000000011'
  );
  bid := (r->>'booking_id')::uuid;
  if coalesce((r->>'created')::boolean, false) is not true then raise exception 'first_create_not_created'; end if;
  if not exists (select 1 from public.bookings b where b.id=bid and b.customer_id='77000000-0000-0000-0000-000000000061' and b.status='confirmed') then raise exception 'existing_customer_not_linked'; end if;

  -- En retry är en lookup av redan committad intent. Senare schemaändringar
  -- får inte göra samma request-id omöjligt att kvittera.
  insert into public.location_closures (
    tenant_id, location_id, start_ts, end_ts, reason
  ) values (
    '77000000-0000-0000-0000-000000000001',
    '77000000-0000-0000-0000-000000000011',
    '2027-01-04 10:00+00', '2027-01-04 10:30+00', 'Added after booking'
  );

  r := public.create_admin_booking(
    '77000000-0000-0000-0000-000000000031',
    '77000000-0000-0000-0000-000000000041',
    '2027-01-04 10:00+00',
    '77000000-0000-0000-0000-000000000081',
    '77000000-0000-0000-0000-000000000061',
    null, null, null, 'retry',
    '77000000-0000-0000-0000-000000000011'
  );
  if (r->>'created')::boolean is not false then raise exception 'retry_created_duplicate'; end if;
  select count(*) into n from public.bookings b where b.request_id='77000000-0000-0000-0000-000000000081';
  if n <> 1 then raise exception 'retry_booking_count_%', n; end if;
end $$;

-- Namn-only skapar stabil customer-rad i samma transaktion.
do $$
declare r jsonb; bid uuid; cid uuid;
begin
  r := public.create_admin_booking(
    '77000000-0000-0000-0000-000000000031',
    '77000000-0000-0000-0000-000000000041',
    '2027-01-04 11:00+00',
    '77000000-0000-0000-0000-000000000082',
    null, 'New Customer', null, null, null,
    '77000000-0000-0000-0000-000000000011'
  );
  bid := (r->>'booking_id')::uuid;
  select b.customer_id into cid from public.bookings b where b.id=bid;
  if cid is null or not exists (select 1 from public.customers c where c.id=cid and c.full_name='New Customer') then raise exception 'name_only_customer_missing'; end if;
end $$;

-- Kunden som bara hör till B och B-platsen är fail-closed.
do $$ begin
  begin
    perform public.create_admin_booking(
      '77000000-0000-0000-0000-000000000031',
      '77000000-0000-0000-0000-000000000041',
      '2027-01-04 12:00+00',
      '77000000-0000-0000-0000-000000000083',
      '77000000-0000-0000-0000-000000000062',
      null, null, null, null,
      '77000000-0000-0000-0000-000000000011'
    );
    raise exception 'cross_location_customer_succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_admin_booking(
      '77000000-0000-0000-0000-000000000032',
      '77000000-0000-0000-0000-000000000042',
      '2027-01-04 12:00+00',
      '77000000-0000-0000-0000-000000000084',
      null, 'Forbidden', null, null, null,
      '77000000-0000-0000-0000-000000000012'
    );
    raise exception 'cross_location_booking_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Ombokning använder snapshot-duration, samma plats och stale-vakt.
do $$
declare bid uuid; r jsonb;
begin
  select b.id into bid from public.bookings b where b.request_id='77000000-0000-0000-0000-000000000081';
  r := public.reschedule_admin_booking(
    bid,
    '77000000-0000-0000-0000-000000000011',
    '77000000-0000-0000-0000-000000000041',
    '77000000-0000-0000-0000-000000000031',
    '2027-01-04 13:00+00',
    '2027-01-04 10:00+00',
    '77000000-0000-0000-0000-000000000041'
  );
  if (r->>'start')::timestamptz <> '2027-01-04 13:00+00'::timestamptz then raise exception 'reschedule_start_wrong'; end if;
  if not exists (select 1 from public.bookings b where b.id=bid and b.end_ts-b.start_ts=interval '30 minutes') then raise exception 'reschedule_duration_changed'; end if;
  begin
    perform public.reschedule_admin_booking(
      bid,
      '77000000-0000-0000-0000-000000000012',
      '77000000-0000-0000-0000-000000000042',
      '77000000-0000-0000-0000-000000000031',
      '2027-01-04 13:00+00',
      '2027-01-04 13:00+00',
      '77000000-0000-0000-0000-000000000041'
    );
    raise exception 'cross_location_reschedule_succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.reschedule_admin_booking(
      bid,
      '77000000-0000-0000-0000-000000000011',
      '77000000-0000-0000-0000-000000000041',
      '77000000-0000-0000-0000-000000000031',
      '2027-01-04 13:30+00',
      '2027-01-04 10:00+00',
      '77000000-0000-0000-0000-000000000041'
    );
    raise exception 'stale_reschedule_succeeded';
  exception when serialization_failure then null; end;
  begin
    perform public.reschedule_admin_booking(
      bid,
      '77000000-0000-0000-0000-000000000011',
      '77000000-0000-0000-0000-000000000041',
      '77000000-0000-0000-0000-000000000031',
      '2027-01-04 14:00+00',
      '2027-01-04 13:00+00',
      '77000000-0000-0000-0000-000000000041'
    );
    raise exception 'closure_reschedule_succeeded';
  exception when raise_exception then
    if sqlerrm not like '%booking_overlaps_location_closure%' then raise; end if;
  end;
end $$;

-- Statusspår och befintlig 0072-FSM.
do $$
declare bid uuid;
begin
  select b.id into bid from public.bookings b where b.request_id='77000000-0000-0000-0000-000000000081';
  perform public.set_admin_booking_status(bid, 'cancelled');
  if not exists (select 1 from public.bookings b where b.id=bid and b.status='cancelled' and b.cancelled_by='business' and b.cancelled_at is not null) then raise exception 'cancellation_trace_missing'; end if;
  perform public.set_admin_booking_status(bid, 'confirmed');
  if not exists (select 1 from public.bookings b where b.id=bid and b.status='confirmed' and b.cancelled_by is null and b.cancelled_at is null) then raise exception 'restore_trace_not_cleared'; end if;
  begin
    perform public.set_admin_booking_status(bid, 'completed');
    raise exception 'future_completion_succeeded';
  exception when raise_exception then
    if sqlerrm not like '%future_booking_cannot_be_completed%' then raise; end if;
  end;
end $$;

-- Strukturerad blockering och borttagning.
do $$
declare tid uuid; n int;
begin
  tid := public.create_admin_time_off(
    '77000000-0000-0000-0000-000000000011',
    '77000000-0000-0000-0000-000000000041',
    '2027-01-04 16:00+00', '2027-01-04 16:30+00',
    'leave', 'Appointment', null
  );
  if not exists (select 1 from public.time_off t where t.id=tid and t.kind='leave' and t.reason='Appointment') then raise exception 'structured_time_off_missing'; end if;
  n := public.delete_admin_time_off(tid, false);
  if n <> 1 or exists (select 1 from public.time_off t where t.id=tid) then raise exception 'time_off_delete_failed'; end if;
  begin
    perform public.create_admin_time_off(
      '77000000-0000-0000-0000-000000000011',
      '77000000-0000-0000-0000-000000000041',
      '2027-01-04 16:00+00', '2027-01-04 16:30+00',
      'holiday', null, null
    );
    raise exception 'invalid_time_off_kind_succeeded';
  exception when invalid_parameter_value then null; end;
end $$;

-- Preview, atomisk serie och spårbar arbetskö för redan berörda bokningar.
do $$
declare ids uuid[]; tid uuid; n int; impact_count int;
begin
  select count(*) into impact_count
    from public.preview_admin_time_off_impacts(
      '77000000-0000-0000-0000-000000000011',
      '77000000-0000-0000-0000-000000000041',
      '2027-01-04 10:50+00', '2027-01-04 11:40+00'
    );
  if impact_count <> 1 then raise exception 'absence_preview_count_%', impact_count; end if;

  ids := public.create_admin_time_off_series(
    '77000000-0000-0000-0000-000000000011',
    '77000000-0000-0000-0000-000000000041',
    '[{"start_ts":"2027-01-04T10:50:00Z","end_ts":"2027-01-04T11:40:00Z"},
      {"start_ts":"2027-01-11T10:50:00Z","end_ts":"2027-01-11T11:40:00Z"}]'::jsonb,
    'sick', 'Sjukfrånvaro', '77000000-0000-0000-0000-000000000091'
  );
  if cardinality(ids) <> 2 then raise exception 'time_off_series_not_atomic'; end if;
  tid := ids[1];
  if (select count(*) from public.get_admin_time_off_impacts(tid) where not handled) <> 1 then
    raise exception 'absence_queue_missing_open_booking';
  end if;
  perform public.mark_admin_time_off_booking_handled(
    tid,
    (select b.id from public.bookings b where b.request_id='77000000-0000-0000-0000-000000000082'),
    'contacted', null
  );
  if (select count(*) from public.get_admin_time_off_impacts(tid) where handled and resolution='contacted') <> 1 then
    raise exception 'absence_queue_resolution_missing';
  end if;
  n := public.delete_admin_time_off(tid, true);
  if n <> 2 then raise exception 'time_off_series_delete_count_%', n; end if;
end $$;

do $$ begin
  begin
    perform public.create_admin_booking(
      '77000000-0000-0000-0000-000000000031',
      '77000000-0000-0000-0000-000000000041',
      '2027-01-04 12:30+00',
      '77000000-0000-0000-0000-000000000085',
      null, 'Missing location', null, null, null, null
    );
    raise exception 'missing_admin_location_succeeded';
  exception when invalid_parameter_value then null; end;
end $$;

-- Platsadmin utan medlemskap har ingen muterande väg trots samma rollnivå.
reset role;
select set_config('request.jwt.claim.sub', '77000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"77000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"tenant_id":"77000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.create_admin_time_off(
      '77000000-0000-0000-0000-000000000011',
      '77000000-0000-0000-0000-000000000041',
      '2027-01-04 16:00+00', '2027-01-04 16:30+00',
      'other', null, null
    );
    raise exception 'empty_admin_time_off_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  if has_function_privilege('anon', 'public.create_admin_booking(uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid)', 'EXECUTE') then raise exception 'anon_execute_create_admin_booking'; end if;
  if has_function_privilege('service_role', 'public.reschedule_admin_booking(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid)', 'EXECUTE') then raise exception 'service_role_execute_reschedule'; end if;
  if not has_function_privilege('authenticated', 'public.set_admin_booking_status(uuid,text)', 'EXECUTE') then raise exception 'authenticated_missing_status_execute'; end if;
  if not has_function_privilege('authenticated', 'public.get_admin_time_off_impacts(uuid)', 'EXECUTE') then raise exception 'authenticated_missing_absence_queue'; end if;
  if has_function_privilege('anon', 'public.preview_admin_time_off_impacts(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE') then raise exception 'anon_execute_absence_preview'; end if;
end $$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
