-- 0093 runtime: storefrontens service-role kan inte skriva en ej erbjuden tid.
-- Alla fixtures rullas tillbaka.
begin;

select set_config(
  'corevo.test_0093_day',
  (date_trunc('day', current_timestamp) + interval '7 days')::text,
  true
);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, slug, name) values
  ('93000000-0000-0000-0000-000000000001', 'public-0093', 'Public 0093');
insert into public.locations (
  id, tenant_id, name, is_primary, timezone,
  slot_step_min, min_notice_min, max_advance_days
) values (
  '93000000-0000-0000-0000-000000000011',
  '93000000-0000-0000-0000-000000000001',
  'Primary', true, 'UTC', 30, 0, 30
);
insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents, active
) values (
  '93000000-0000-0000-0000-000000000021',
  '93000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000011',
  'Test', 30, 10000, true
);
insert into public.staff (id, tenant_id, location_id, title, active) values (
  '93000000-0000-0000-0000-000000000031',
  '93000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000011',
  'Staff', false
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '93000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000031',
  '93000000-0000-0000-0000-000000000021'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
)
select '93000000-0000-0000-0000-000000000001',
       '93000000-0000-0000-0000-000000000011',
       '93000000-0000-0000-0000-000000000031',
       day, '09:00', '18:00'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '93000000-0000-0000-0000-000000000001',
       '93000000-0000-0000-0000-000000000011',
       day, '09:00', '18:00', 'confirmed', now()
  from generate_series(0, 6) day;
insert into public.working_hour_slots (
  tenant_id, location_id, staff_id, weekday, start_time, active
)
select '93000000-0000-0000-0000-000000000001',
       '93000000-0000-0000-0000-000000000011',
       '93000000-0000-0000-0000-000000000031',
       day, '09:00', true
  from generate_series(0, 6) day;
update public.staff set active = true
 where id = '93000000-0000-0000-0000-000000000031';

do $$ begin
  if not has_function_privilege(
    'service_role',
    'public.create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)',
    'execute'
  ) then raise exception 'storefront_service_role_execute_missing'; end if;
  if has_function_privilege(
    'service_role',
    'public.create_storefront_booking(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid)',
    'execute'
  ) then raise exception 'storefront_legacy_release_blind_execute_exposed'; end if;
  if has_function_privilege(
    'service_role',
    'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
    'execute'
  ) then raise exception 'legacy_public_booking_still_exposed'; end if;
  if not has_function_privilege(
    'authenticated',
    'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
    'execute'
  ) then raise exception 'customer_rebook_execute_missing'; end if;
  if has_function_privilege(
    'anon',
    'public.create_storefront_booking(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.create_storefront_booking(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)',
    'execute'
  ) then raise exception 'storefront_client_execute_exposed'; end if;
end $$;

-- Erbjuden explicit start lyckas och kontakten hamnar i customers, inte note.
do $$
declare v_booking uuid; v_customer uuid;
begin
  select r.booking_id into v_booking
    from public.create_storefront_booking_with_release(
    'public-0093',
    '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '9 hours',
    'Känslig hårbotten', 'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011',
    '93000000-0000-0000-0000-000000000041', false
  ) r;
  select b.customer_id into v_customer from public.bookings b where b.id = v_booking;
  if v_customer is null then raise exception 'customer_relation_missing'; end if;
  if not exists (
    select 1 from public.bookings b
     where b.id = v_booking and b.note = 'Känslig hårbotten'
  ) then raise exception 'booking_message_not_preserved'; end if;
  if not exists (
    select 1 from public.customers c
     where c.id = v_customer
       and c.tenant_id = '93000000-0000-0000-0000-000000000001'
       and c.email = 'kund-0093@example.test'
       and c.phone = '0701234567'
  ) then raise exception 'customer_contact_not_resolved'; end if;
end $$;

-- Service-role får inte använda en minut som saknas i den explicita listan.
do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093',
    '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '9 hours 30 minutes',
    null, 'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011',
    '93000000-0000-0000-0000-000000000042', false
  );
  raise exception 'non_explicit_start_succeeded';
exception when raise_exception then
  if sqlerrm = 'non_explicit_start_succeeded' or sqlerrm not like '%booking_not_explicit_slot%' then raise; end if;
end $$;

-- Utan explicit lista gäller rastersteget.
delete from public.working_hour_slots
 where tenant_id = '93000000-0000-0000-0000-000000000001';
do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093',
    '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '9 hours 45 minutes',
    null, 'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011',
    '93000000-0000-0000-0000-000000000043', false
  );
  raise exception 'off_step_start_succeeded';
exception when raise_exception then
  if sqlerrm = 'off_step_start_succeeded' or sqlerrm not like '%booking_not_on_slot_step%' then raise; end if;
end $$;

-- Min notice och max advance håller trots service-role.
update public.locations set min_notice_min = 50000
 where id = '93000000-0000-0000-0000-000000000011';
do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093', '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '10 hours',
    null, 'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011', null, false
  );
  raise exception 'min_notice_bypassed';
exception when raise_exception then
  if sqlerrm = 'min_notice_bypassed' or sqlerrm not like '%booking_inside_min_notice%' then raise; end if;
end $$;
update public.locations set min_notice_min = 0, max_advance_days = 1
 where id = '93000000-0000-0000-0000-000000000011';
do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093', '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '10 hours',
    null, 'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011', null, false
  );
  raise exception 'max_advance_bypassed';
exception when raise_exception then
  if sqlerrm = 'max_advance_bypassed' or sqlerrm not like '%booking_outside_advance_window%' then raise; end if;
end $$;
update public.locations set max_advance_days = 30
 where id = '93000000-0000-0000-0000-000000000011';

-- Arbetstid, frånvaro och krock är DB-backstops, inte UI-antaganden.
do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093', '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '8 hours',
    null, 'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011', null, false
  );
  raise exception 'outside_schedule_succeeded';
exception when raise_exception then
  if sqlerrm = 'outside_schedule_succeeded' or sqlerrm not like '%booking_outside_%hours%' then raise; end if;
end $$;
insert into public.time_off (
  tenant_id, location_id, staff_id, start_ts, end_ts, kind
) values (
  '93000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000011',
  '93000000-0000-0000-0000-000000000031',
  current_setting('corevo.test_0093_day')::timestamptz + interval '10 hours',
  current_setting('corevo.test_0093_day')::timestamptz + interval '10 hours 30 minutes',
  'other'
);
do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093', '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '10 hours',
    null, 'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011', null, false
  );
  raise exception 'time_off_bypassed';
exception when raise_exception then
  if sqlerrm = 'time_off_bypassed' or sqlerrm not like '%booking_overlaps_time_off%' then raise; end if;
end $$;

select * from public.create_storefront_booking_with_release(
  'public-0093', '93000000-0000-0000-0000-000000000021',
  '93000000-0000-0000-0000-000000000031',
  current_setting('corevo.test_0093_day')::timestamptz + interval '11 hours',
  null, 'Test Kund', 'kund-0093@example.test', '0701234567',
  '93000000-0000-0000-0000-000000000011',
  '93000000-0000-0000-0000-000000000044', false
);
do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093', '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '11 hours',
    null, 'Annan Kund', 'annan-0093@example.test', '0709999999',
    '93000000-0000-0000-0000-000000000011', null, false
  );
  raise exception 'collision_bypassed';
exception when exclusion_violation then null;
when raise_exception then
  if sqlerrm = 'collision_bypassed' or sqlerrm not like '%booking_overlaps_reserved_time%' then raise; end if;
end $$;

do $$ begin
  perform * from public.create_storefront_booking_with_release(
    'public-0093', '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '12 hours',
    'Gäst: Test <test@example.test> 0701234567',
    'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011', null, false
  );
  raise exception 'legacy_contact_note_succeeded';
exception when invalid_parameter_value then null; end $$;

do $$ declare v_booking uuid; begin
  select r.booking_id into v_booking
    from public.create_storefront_booking_with_release(
    'public-0093', '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '12 hours 30 minutes',
    'Gäst: min syster följer med',
    'Test Kund', 'kund-0093@example.test', '0701234567',
    '93000000-0000-0000-0000-000000000011',
    '93000000-0000-0000-0000-000000000045', false
  ) r;
  if not exists (
    select 1 from public.bookings b
     where b.id = v_booking and b.note = 'Gäst: min syster följer med'
  ) then raise exception 'legitimate_guest_note_not_preserved'; end if;
end $$;

-- Adminens fria minut är oförändrad: authenticated admin-RPC:n använder den
-- interna create_public_booking och omfattas inte av storefrontens slotvakt.
insert into public.roles (id, tenant_id, name, level) values (
  '93000000-0000-0000-0000-000000000051',
  '93000000-0000-0000-0000-000000000001', 'owner', 6
);
insert into auth.users (id, email) values (
  '93000000-0000-0000-0000-000000000061', 'owner-0093@example.test'
);
insert into public.users (id, tenant_id, email, role_id, access_scope) values (
  '93000000-0000-0000-0000-000000000061',
  '93000000-0000-0000-0000-000000000001',
  'owner-0093@example.test',
  '93000000-0000-0000-0000-000000000051', 'organization'
);
reset role;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000061', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000061","role":"authenticated","app_metadata":{"tenant_id":"93000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$ declare v_result jsonb; begin
  v_result := public.create_admin_booking(
    '93000000-0000-0000-0000-000000000021',
    '93000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0093_day')::timestamptz + interval '13 hours 15 minutes',
    '93000000-0000-0000-0000-000000000071',
    null, 'Admin Kund', null, null, null,
    '93000000-0000-0000-0000-000000000011'
  );
  if coalesce((v_result ->> 'created')::boolean, false) is not true then
    raise exception 'admin_free_minute_regressed';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
