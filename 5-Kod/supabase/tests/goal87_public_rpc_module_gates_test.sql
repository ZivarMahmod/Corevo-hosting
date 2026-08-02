-- Goal 87 follow-up runtime regression: every public SECURITY DEFINER module
-- RPC applies the central read/action gate, while admin booking keeps the
-- draft/live write contract. All fixtures are rolled back.

begin;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

insert into public.tenants (id, slug, name, status) values (
  '87870000-0000-0000-0000-000000000001',
  'goal87-rpc-gates',
  'Goal 87 RPC gates',
  'provisioning'
);

insert into public.roles (id, tenant_id, name, level) values (
  '87870000-0000-0000-0000-000000000011',
  '87870000-0000-0000-0000-000000000001',
  'salon_admin',
  6
);
insert into auth.users (id, email) values (
  '87870000-0000-0000-0000-000000000021',
  'goal87-rpc-owner@example.test'
);
insert into public.users (
  id,
  tenant_id,
  email,
  role_id,
  access_scope,
  status
) values (
  '87870000-0000-0000-0000-000000000021',
  '87870000-0000-0000-0000-000000000001',
  'goal87-rpc-owner@example.test',
  '87870000-0000-0000-0000-000000000011',
  'organization',
  'active'
);

insert into public.tenant_modules (tenant_id, module_key, state) values
  ('87870000-0000-0000-0000-000000000001', 'booking', 'off'),
  ('87870000-0000-0000-0000-000000000001', 'shop', 'off'),
  ('87870000-0000-0000-0000-000000000001', 'kurser', 'off');

insert into public.tenant_settings (tenant_id) values (
  '87870000-0000-0000-0000-000000000001'
);
insert into public.locations (id, tenant_id, name, is_primary, active) values (
  '87870000-0000-0000-0000-000000000051',
  '87870000-0000-0000-0000-000000000001',
  'Goal 87 primary',
  true,
  true
);
insert into public.services (
  id,
  tenant_id,
  location_id,
  name,
  duration_min,
  price_cents,
  active
) values (
  '87870000-0000-0000-0000-000000000061',
  '87870000-0000-0000-0000-000000000001',
  '87870000-0000-0000-0000-000000000051',
  'Goal 87 service',
  60,
  10000,
  true
);
insert into public.staff (
  id,
  tenant_id,
  location_id,
  title,
  active
) values (
  '87870000-0000-0000-0000-000000000071',
  '87870000-0000-0000-0000-000000000001',
  '87870000-0000-0000-0000-000000000051',
  'Goal 87 staff',
  false
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '87870000-0000-0000-0000-000000000001',
  '87870000-0000-0000-0000-000000000071',
  '87870000-0000-0000-0000-000000000061'
);
insert into public.working_hours (
  tenant_id,
  staff_id,
  location_id,
  weekday,
  start_time,
  end_time
) values (
  '87870000-0000-0000-0000-000000000001',
  '87870000-0000-0000-0000-000000000071',
  '87870000-0000-0000-0000-000000000051',
  1,
  time '09:00',
  time '17:00'
);
insert into public.location_opening_hours (
  tenant_id,
  location_id,
  weekday,
  start_time,
  end_time,
  source,
  confirmed_at
) values (
  '87870000-0000-0000-0000-000000000001',
  '87870000-0000-0000-0000-000000000051',
  1,
  time '09:00',
  time '17:00',
  'confirmed',
  pg_catalog.now()
);
update public.staff
   set active = true
 where id = '87870000-0000-0000-0000-000000000071';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  v_result jsonb;
begin
  v_result := public.publish_tenant(
    '87870000-0000-0000-0000-000000000001'
  );
  if v_result ->> 'tenant_status' <> 'active' then
    raise exception 'goal87_rpc_fixture_publish_failed_%', v_result;
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
   set state = 'draft'
 where tenant_id = '87870000-0000-0000-0000-000000000001';
update public.tenant_modules
   set state = 'live'
 where tenant_id = '87870000-0000-0000-0000-000000000001';

insert into public.bookings (
  id,
  tenant_id,
  location_id,
  staff_id,
  service_id,
  start_ts,
  end_ts,
  status,
  price_cents
) values (
  '87870000-0000-0000-0000-000000000082',
  '87870000-0000-0000-0000-000000000001',
  '87870000-0000-0000-0000-000000000051',
  '87870000-0000-0000-0000-000000000071',
  '87870000-0000-0000-0000-000000000061',
  pg_catalog.date_trunc('week', pg_catalog.now()) + interval '1 week 13 hours',
  pg_catalog.date_trunc('week', pg_catalog.now()) + interval '1 week 14 hours',
  'confirmed',
  10000
);
insert into public.shop_orders (
  id,
  tenant_id,
  status,
  fulfilment,
  session_token,
  subtotal_cents,
  total_cents,
  currency,
  payment_status
) values (
  '87870000-0000-0000-0000-000000000098',
  '87870000-0000-0000-0000-000000000001',
  'reserved',
  'ship',
  'goal87-rpc-token',
  25000,
  25000,
  'SEK',
  'unpaid'
);
insert into public.tenant_events (
  id,
  tenant_id,
  title,
  starts_at,
  capacity,
  price_cents,
  status,
  reserved_qty
) values (
  '87870000-0000-0000-0000-000000000095',
  '87870000-0000-0000-0000-000000000001',
  'Goal 87 event',
  pg_catalog.now() + interval '14 days',
  10,
  25000,
  'open',
  2
);

-- live: all reads delegate and the new PIN action succeeds.
select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare
  v_count integer;
begin
  select pg_catalog.count(*)
    into v_count
    from public.get_public_bookable_starts(
      '87870000-0000-0000-0000-000000000001',
      '87870000-0000-0000-0000-000000000051',
      '87870000-0000-0000-0000-000000000061',
      array['87870000-0000-0000-0000-000000000071'::uuid],
      array[
        pg_catalog.date_trunc('week', pg_catalog.now())
          + interval '1 week 9 hours'
      ]
    );
  if v_count <> 1 then
    raise exception 'goal87_live_availability_hidden_%', v_count;
  end if;
  if not exists (
    select 1
      from public.get_public_booking(
        '87870000-0000-0000-0000-000000000082'
      )
  ) then
    raise exception 'goal87_live_booking_receipt_hidden';
  end if;
  if public.get_public_shop_order(
       '87870000-0000-0000-0000-000000000098',
       'goal87-rpc-token'
     ) is null then
    raise exception 'goal87_live_shop_receipt_hidden';
  end if;
  begin
    perform public.get_public_shop_order(
      '87870000-0000-0000-0000-000000000098',
      'wrong-goal87-rpc-token'
    );
    raise exception 'goal87_live_bad_shop_token_accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'forbidden_order' then raise; end if;
  end;
  if public.event_seats_left(
       '87870000-0000-0000-0000-000000000095'
     ) <> 8 then
    raise exception 'goal87_live_event_seats_hidden';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  perform 1
    from public.start_booking_verification(
      'goal87-rpc-gates',
      '87870000-0000-0000-0000-000000000071',
      '87870000-0000-0000-0000-000000000061',
      pg_catalog.date_trunc('week', pg_catalog.now())
        + interval '1 week 10 hours',
      '87870000-0000-0000-0000-000000000096',
      'email',
      pg_catalog.repeat('a', 64),
      'g***@example.test',
      pg_catalog.repeat('b', 64),
      null
    );
  if not found then
    raise exception 'goal87_live_verification_start_hidden';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- paused: reads remain visible, while new public/admin actions are denied.
update public.tenant_modules
   set state = 'paused'
 where tenant_id = '87870000-0000-0000-0000-000000000001';

select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare
  v_count integer;
begin
  select pg_catalog.count(*)
    into v_count
    from public.get_public_bookable_starts(
      '87870000-0000-0000-0000-000000000001',
      '87870000-0000-0000-0000-000000000051',
      '87870000-0000-0000-0000-000000000061',
      array['87870000-0000-0000-0000-000000000071'::uuid],
      array[
        pg_catalog.date_trunc('week', pg_catalog.now())
          + interval '1 week 12 hours'
      ]
    );
  if v_count <> 1 then
    raise exception 'goal87_paused_availability_hidden_%', v_count;
  end if;
  if not exists (
    select 1
      from public.get_public_booking(
        '87870000-0000-0000-0000-000000000082'
      )
  ) then
    raise exception 'goal87_paused_booking_receipt_hidden';
  end if;
  if public.get_public_shop_order(
       '87870000-0000-0000-0000-000000000098',
       'goal87-rpc-token'
     ) is null then
    raise exception 'goal87_paused_shop_receipt_hidden';
  end if;
  if public.event_seats_left(
       '87870000-0000-0000-0000-000000000095'
     ) <> 8 then
    raise exception 'goal87_paused_event_seats_hidden';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    perform 1
      from public.start_booking_verification(
        'goal87-rpc-gates',
        '87870000-0000-0000-0000-000000000071',
        '87870000-0000-0000-0000-000000000061',
        pg_catalog.date_trunc('week', pg_catalog.now())
          + interval '1 week 13 hours',
        '87870000-0000-0000-0000-000000000097',
        'email',
        pg_catalog.repeat('c', 64),
        'g***@example.test',
        pg_catalog.repeat('d', 64),
        null
      );
    raise exception 'goal87_paused_verification_start_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'module_public_action_denied' then raise; end if;
  end;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '87870000-0000-0000-0000-000000000021',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"87870000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"87870000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
begin
  begin
    perform public.create_admin_booking(
      '87870000-0000-0000-0000-000000000061',
      '87870000-0000-0000-0000-000000000071',
      pg_catalog.date_trunc('week', pg_catalog.now())
        + interval '1 week 14 hours',
      '87870000-0000-0000-0000-000000000100',
      null,
      'Admin paused',
      'admin-paused@example.test',
      null,
      null,
      '87870000-0000-0000-0000-000000000051'
    );
    raise exception 'goal87_paused_admin_booking_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'module_admin_action_denied' then raise; end if;
  end;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- draft: public reads/actions are hidden, but admin mutation is allowed.
update public.tenant_modules
   set state = 'live'
 where tenant_id = '87870000-0000-0000-0000-000000000001'
   and module_key = 'booking';
update public.tenant_modules
   set state = 'off'
 where tenant_id = '87870000-0000-0000-0000-000000000001'
   and module_key = 'booking';
update public.tenant_modules
   set state = 'draft'
 where tenant_id = '87870000-0000-0000-0000-000000000001'
   and module_key = 'booking';

select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare
  v_count integer;
begin
  select pg_catalog.count(*)
    into v_count
    from public.get_public_bookable_starts(
      '87870000-0000-0000-0000-000000000001',
      '87870000-0000-0000-0000-000000000051',
      '87870000-0000-0000-0000-000000000061',
      array['87870000-0000-0000-0000-000000000071'::uuid],
      array[
        pg_catalog.date_trunc('week', pg_catalog.now())
          + interval '1 week 14 hours'
      ]
    );
  if v_count <> 0 then
    raise exception 'goal87_draft_availability_readable_%', v_count;
  end if;
  if exists (
    select 1
      from public.get_public_booking(
        '87870000-0000-0000-0000-000000000082'
      )
  ) then
    raise exception 'goal87_draft_booking_receipt_readable';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    perform 1
      from public.start_booking_verification(
        'goal87-rpc-gates',
        '87870000-0000-0000-0000-000000000071',
        '87870000-0000-0000-0000-000000000061',
        pg_catalog.date_trunc('week', pg_catalog.now())
          + interval '1 week 14 hours',
        '87870000-0000-0000-0000-000000000102',
        'email',
        pg_catalog.repeat('e', 64),
        'g***@example.test',
        pg_catalog.repeat('f', 64),
        null
      );
    raise exception 'goal87_draft_verification_start_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'module_public_action_denied' then raise; end if;
  end;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '87870000-0000-0000-0000-000000000021',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"87870000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"87870000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
declare
  v_result jsonb;
begin
  v_result := public.create_admin_booking(
    '87870000-0000-0000-0000-000000000061',
    '87870000-0000-0000-0000-000000000071',
    pg_catalog.date_trunc('week', pg_catalog.now())
      + interval '1 week 14 hours',
    '87870000-0000-0000-0000-000000000099',
    null,
    'Admin draft',
    'admin-draft@example.test',
    null,
    null,
    '87870000-0000-0000-0000-000000000051'
  );
  if coalesce((v_result ->> 'created')::boolean, false) is not true then
    raise exception 'goal87_draft_admin_booking_denied_%', v_result;
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- off: every direct public read is hidden.
update public.tenant_modules
   set state = 'off'
 where tenant_id = '87870000-0000-0000-0000-000000000001'
   and module_key = 'booking';
update public.tenant_modules
   set state = 'live'
 where tenant_id = '87870000-0000-0000-0000-000000000001'
   and module_key in ('shop', 'kurser');
update public.tenant_modules
   set state = 'off'
 where tenant_id = '87870000-0000-0000-0000-000000000001'
   and module_key in ('shop', 'kurser');

select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if exists (
    select 1
      from public.get_public_booking(
        '87870000-0000-0000-0000-000000000082'
      )
  ) then
    raise exception 'goal87_off_booking_receipt_readable';
  end if;
  if public.get_public_shop_order(
       '87870000-0000-0000-0000-000000000098',
       'goal87-rpc-token'
     ) is not null then
    raise exception 'goal87_off_shop_receipt_readable';
  end if;
  begin
    perform public.get_public_shop_order(
      '87870000-0000-0000-0000-000000000098',
      'wrong-goal87-rpc-token'
    );
    raise exception 'goal87_off_bad_shop_token_accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'forbidden_order' then raise; end if;
  end;
  if public.event_seats_left(
       '87870000-0000-0000-0000-000000000095'
     ) <> 0 then
    raise exception 'goal87_off_event_seats_readable';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- The public wrappers keep narrow grants; no caller can invoke a preserved
-- SECURITY DEFINER implementation directly.
do $$
begin
  if pg_catalog.has_function_privilege(
       'anon',
       'private.get_public_bookable_starts_goal87_impl(uuid,uuid,uuid,uuid[],timestamptz[])',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'private.start_booking_verification_goal87_impl(text,uuid,uuid,timestamptz,uuid,text,text,text,text,uuid)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'private.event_seats_left_goal87_impl(uuid)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'private.get_public_booking_goal87_impl(uuid)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'private.get_public_shop_order_goal87_impl(uuid,text)',
       'execute'
     ) then
    raise exception 'goal87_rpc_private_execute_leak';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) acl
     where n.nspname = 'public'
       and p.oid in (
         'public.get_public_bookable_starts(uuid,uuid,uuid,uuid[],timestamptz[])'::regprocedure,
         'public.start_booking_verification(text,uuid,uuid,timestamptz,uuid,text,text,text,text,uuid)'::regprocedure,
         'public.event_seats_left(uuid)'::regprocedure,
         'public.get_public_booking(uuid)'::regprocedure,
         'public.get_public_shop_order(uuid,text)'::regprocedure,
         'public.create_admin_booking(uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid)'::regprocedure
       )
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'goal87_rpc_public_execute_leak';
  end if;
end;
$$;

rollback;
