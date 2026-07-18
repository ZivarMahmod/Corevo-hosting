-- 0094 runtime: a named walk-in gets a real tenant customer relation and never
-- stores identity/contact in bookings.note. All fixtures roll back.
begin;

select set_config(
  'corevo.test_0094_start',
  (
    case
      when (date_trunc('minute', statement_timestamp()) at time zone 'UTC')::time
           >= time '23:58'
        then date_trunc('minute', statement_timestamp()) - interval '2 minutes'
      else date_trunc('minute', statement_timestamp())
    end
  )::text,
  true
);

insert into public.tenants (id, slug, name) values (
  '94000000-0000-0000-0000-000000000001', 'walk-in-0094', 'Walk-in 0094'
);
insert into public.locations (
  id, tenant_id, name, is_primary, timezone,
  slot_step_min, min_notice_min, max_advance_days
) values (
  '94000000-0000-0000-0000-000000000011',
  '94000000-0000-0000-0000-000000000001',
  'Primary', true, 'UTC', 15, 1440, 30
);
insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents, active
) values (
  '94000000-0000-0000-0000-000000000021',
  '94000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000011',
  'Drop-in', 1, 45000, true
);
insert into public.roles (id, tenant_id, name, level) values (
  '94000000-0000-0000-0000-000000000041',
  '94000000-0000-0000-0000-000000000001',
  'staff', 3
);
insert into auth.users (id, email) values (
  '94000000-0000-0000-0000-000000000051', 'staff-0094@example.test'
);
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values (
  '94000000-0000-0000-0000-000000000051',
  '94000000-0000-0000-0000-000000000001',
  'staff-0094@example.test',
  '94000000-0000-0000-0000-000000000041',
  'active', 'organization'
);
insert into public.staff (
  id, tenant_id, location_id, profile_id, title, active
) values (
  '94000000-0000-0000-0000-000000000031',
  '94000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000011',
  '94000000-0000-0000-0000-000000000051',
  'Staff', false
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '94000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000031',
  '94000000-0000-0000-0000-000000000021'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
)
select '94000000-0000-0000-0000-000000000001',
       '94000000-0000-0000-0000-000000000011',
       '94000000-0000-0000-0000-000000000031',
       day, '00:00', '23:59'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '94000000-0000-0000-0000-000000000001',
       '94000000-0000-0000-0000-000000000011',
       day, '00:00', '23:59', 'confirmed', now()
  from generate_series(0, 6) day;
update public.staff set active = true
 where id = '94000000-0000-0000-0000-000000000031';

do $$ begin
  if not has_function_privilege(
    'authenticated',
    'public.create_staff_walk_in(uuid,uuid,uuid,timestamptz,text)',
    'execute'
  ) then raise exception 'staff_walk_in_execute_missing'; end if;
  if has_function_privilege(
    'anon', 'public.create_staff_walk_in(uuid,uuid,uuid,timestamptz,text)', 'execute'
  ) or has_function_privilege(
    'service_role', 'public.create_staff_walk_in(uuid,uuid,uuid,timestamptz,text)', 'execute'
  ) then raise exception 'staff_walk_in_execute_too_broad'; end if;
end $$;

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000051', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000051","role":"authenticated","app_metadata":{"tenant_id":"94000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare v_booking uuid; v_customer uuid;
begin
  v_booking := public.create_staff_walk_in(
    '94000000-0000-0000-0000-000000000031',
    '94000000-0000-0000-0000-000000000011',
    '94000000-0000-0000-0000-000000000021',
    current_setting('corevo.test_0094_start')::timestamptz + interval '37 seconds',
    ' Drop-in Kund '
  );
  select b.customer_id into v_customer
    from public.bookings b
   where b.id = v_booking
     and b.tenant_id = '94000000-0000-0000-0000-000000000001'
     and b.start_ts = current_setting('corevo.test_0094_start')::timestamptz
     and b.note is null
     and b.price_cents = 45000;
  if v_customer is null then raise exception 'walk_in_customer_relation_missing'; end if;
  if not exists (
    select 1 from public.customers c
     where c.id = v_customer
       and c.tenant_id = '94000000-0000-0000-0000-000000000001'
       and c.full_name = 'Drop-in Kund'
       and c.email is null
       and c.phone is null
       and c.contact_hash is null
       and c.auth_user_id is null
  ) then raise exception 'walk_in_customer_not_name_only'; end if;
end $$;

-- A conflict occurs after the customer insert inside the function. PostgreSQL
-- rolls the whole function statement back, so no orphan customer may survive.
do $$ begin
  perform public.create_staff_walk_in(
    '94000000-0000-0000-0000-000000000031',
    '94000000-0000-0000-0000-000000000011',
    '94000000-0000-0000-0000-000000000021',
    current_setting('corevo.test_0094_start')::timestamptz + interval '37 seconds',
    'Collision Orphan'
  );
  raise exception 'walk_in_collision_succeeded';
exception when exclusion_violation then null;
when raise_exception then
  if sqlerrm = 'walk_in_collision_succeeded'
     or sqlerrm not like '%booking_overlaps_reserved_time%' then raise; end if;
end $$;
do $$ begin
  if exists (
    select 1 from public.customers c
     where c.tenant_id = '94000000-0000-0000-0000-000000000001'
       and c.full_name = 'Collision Orphan'
  ) then raise exception 'collision_left_orphan_customer'; end if;
end $$;

-- Om personalen inte vet namnet är det fortfarande en riktig drop-in, men utan
-- påhittad kundidentitet och utan en kontakt-söm i note.
do $$ declare v_booking uuid; begin
  v_booking := public.create_staff_walk_in(
    '94000000-0000-0000-0000-000000000031',
    '94000000-0000-0000-0000-000000000011',
    '94000000-0000-0000-0000-000000000021',
    current_setting('corevo.test_0094_start')::timestamptz + interval '5 minutes',
    null
  );
  if not exists (
    select 1 from public.bookings b
     where b.id = v_booking and b.customer_id is null and b.note is null
  ) then raise exception 'anonymous_walk_in_invented_identity'; end if;
end $$;

-- Arbitrary/cross-tenant resources cannot be smuggled through the definer RPC,
-- and the rejected request cannot leave a customer row behind.
do $$ begin
  perform public.create_staff_walk_in(
    '94999999-0000-0000-0000-000000000031',
    '94999999-0000-0000-0000-000000000011',
    '94999999-0000-0000-0000-000000000021',
    current_setting('corevo.test_0094_start')::timestamptz + interval '10 minutes',
    'Cross Tenant Leak'
  );
  raise exception 'cross_tenant_walk_in_succeeded';
exception when insufficient_privilege then null;
when raise_exception then
  if sqlerrm = 'cross_tenant_walk_in_succeeded'
     or sqlerrm not like '%staff_walk_in_resources_forbidden%' then raise; end if;
end $$;
do $$ begin
  if exists (
    select 1 from public.customers c where c.full_name = 'Cross Tenant Leak'
  ) then raise exception 'cross_tenant_walk_in_left_customer'; end if;
end $$;

-- The private capability is required: the normal authenticated booking path
-- still obeys the tenant's 24-hour notice setting at the same near-now time.
do $$ begin
  perform public.create_public_booking(
    'walk-in-0094',
    '94000000-0000-0000-0000-000000000021',
    '94000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0094_start')::timestamptz + interval '20 minutes',
    null, null, 'Vanlig Kund', 'vanlig-0094@example.test', '0700000000',
    '94000000-0000-0000-0000-000000000011', null
  );
  raise exception 'normal_booking_notice_bypassed';
exception when raise_exception then
  if sqlerrm = 'normal_booking_notice_bypassed'
     or sqlerrm not like '%booking_inside_min_notice%' then raise; end if;
end $$;

-- The walk-in-specific window is deliberately narrow: four hours back and
-- thirty minutes ahead. Rejections happen before customer/intent writes.
do $$ begin
  perform public.create_staff_walk_in(
    '94000000-0000-0000-0000-000000000031',
    '94000000-0000-0000-0000-000000000011',
    '94000000-0000-0000-0000-000000000021',
    date_trunc('minute', statement_timestamp()) - interval '4 hours 1 minute',
    'Too Old'
  );
  raise exception 'old_walk_in_succeeded';
exception when invalid_parameter_value then
  if sqlerrm not like '%walk_in_start_too_old%' then raise; end if;
end $$;
do $$ begin
  perform public.create_staff_walk_in(
    '94000000-0000-0000-0000-000000000031',
    '94000000-0000-0000-0000-000000000011',
    '94000000-0000-0000-0000-000000000021',
    date_trunc('minute', statement_timestamp()) + interval '31 minutes',
    'Too Far Ahead'
  );
  raise exception 'future_walk_in_succeeded';
exception when invalid_parameter_value then
  if sqlerrm not like '%walk_in_start_too_far_ahead%' then raise; end if;
end $$;

-- The notice exception does not weaken operative availability: time off still
-- blocks the same staff/minute through the unchanged booking trigger chain.
reset role;
insert into public.time_off (
  tenant_id, location_id, staff_id, start_ts, end_ts, kind
) values (
  '94000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000011',
  '94000000-0000-0000-0000-000000000031',
  current_setting('corevo.test_0094_start')::timestamptz + interval '15 minutes',
  current_setting('corevo.test_0094_start')::timestamptz + interval '17 minutes',
  'other'
);
set local role authenticated;
do $$ begin
  perform public.create_staff_walk_in(
    '94000000-0000-0000-0000-000000000031',
    '94000000-0000-0000-0000-000000000011',
    '94000000-0000-0000-0000-000000000021',
    current_setting('corevo.test_0094_start')::timestamptz + interval '15 minutes',
    'Time Off Blocked'
  );
  raise exception 'time_off_walk_in_succeeded';
exception when raise_exception then
  if sqlerrm = 'time_off_walk_in_succeeded'
     or sqlerrm not like '%booking_overlaps_time_off%' then raise; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
