-- 0103 runtime: release-off + gamla Stripe-flaggor får aldrig skapa en bokning
-- som väntar på en checkout appen inte erbjuder. Alla fixtures rullas tillbaka.
begin;

select set_config(
  'corevo.test_0103_day',
  (date_trunc('day', current_timestamp) + interval '7 days')::text,
  true
);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, slug, name) values
  ('a3000000-0000-0000-0000-000000000001', 'release-0103', 'Release 0103');
update public.tenants set stripe_charges_enabled = true
 where id = 'a3000000-0000-0000-0000-000000000001';
insert into public.tenant_settings (tenant_id, payments_enabled, settings) values (
  'a3000000-0000-0000-0000-000000000001', true, '{}'::jsonb
);
insert into public.locations (
  id, tenant_id, name, is_primary, timezone, slot_step_min, min_notice_min, max_advance_days
) values (
  'a3000000-0000-0000-0000-000000000011',
  'a3000000-0000-0000-0000-000000000001',
  'Primary', true, 'UTC', 30, 0, 30
);
insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents, active
) values (
  'a3000000-0000-0000-0000-000000000021',
  'a3000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000011',
  'Test', 30, 10000, true
);
insert into public.staff (id, tenant_id, location_id, title, active) values (
  'a3000000-0000-0000-0000-000000000031',
  'a3000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000011',
  'Staff', false
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  'a3000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000031',
  'a3000000-0000-0000-0000-000000000021'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
)
select 'a3000000-0000-0000-0000-000000000001',
       'a3000000-0000-0000-0000-000000000011',
       'a3000000-0000-0000-0000-000000000031',
       day, '09:00', '18:00'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select 'a3000000-0000-0000-0000-000000000001',
       'a3000000-0000-0000-0000-000000000011',
       day, '09:00', '18:00', 'confirmed', now()
  from generate_series(0, 6) day;
insert into public.working_hour_slots (
  tenant_id, location_id, staff_id, weekday, start_time, active
)
select 'a3000000-0000-0000-0000-000000000001',
       'a3000000-0000-0000-0000-000000000011',
       'a3000000-0000-0000-0000-000000000031',
       day, slot, true
  from generate_series(0, 6) day
 cross join (values ('09:00'::time), ('10:00'::time), ('11:00'::time)) starts(slot);
update public.staff set active = true
 where id = 'a3000000-0000-0000-0000-000000000031';

set local role service_role;

do $$ declare v_booking uuid; v_requires_payment boolean; v_status text; begin
  select booking_id, requires_payment, booking_status into v_booking, v_requires_payment, v_status
  from public.create_storefront_booking_with_release(
    'release-0103',
    'a3000000-0000-0000-0000-000000000021',
    'a3000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0103_day')::timestamptz + interval '9 hours',
    null, 'Pay on site', 'pay-on-site@example.test', '0700000103',
    'a3000000-0000-0000-0000-000000000011',
    'a3000000-0000-0000-0000-000000000041',
    false
  );
  if not exists (select 1 from public.bookings where id = v_booking and status = 'confirmed') then
    raise exception 'release_off_booking_not_confirmed';
  end if;
  if v_status <> 'confirmed' then raise exception 'release_off_returned_wrong_status'; end if;
  if v_requires_payment or exists (
    select 1 from public.bookings where id = v_booking and requires_online_payment
  ) then raise exception 'release_off_payment_snapshot_true'; end if;
end $$;

do $$ declare v_booking uuid; v_requires_payment boolean; v_status text; begin
  select booking_id, requires_payment, booking_status into v_booking, v_requires_payment, v_status
  from public.create_storefront_booking_with_release(
    'release-0103',
    'a3000000-0000-0000-0000-000000000021',
    'a3000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0103_day')::timestamptz + interval '10 hours',
    null, 'Online', 'online@example.test', '0700000104',
    'a3000000-0000-0000-0000-000000000011',
    'a3000000-0000-0000-0000-000000000042',
    true
  );
  if not exists (select 1 from public.bookings where id = v_booking and status = 'pending') then
    raise exception 'released_online_booking_not_pending';
  end if;
  if v_status <> 'pending' then raise exception 'released_online_returned_wrong_status'; end if;
  if not v_requires_payment or not exists (
    select 1 from public.bookings where id = v_booking and requires_online_payment
  ) then raise exception 'released_online_payment_snapshot_false'; end if;
end $$;

reset role;
update public.tenant_settings
   set settings = jsonb_build_object('require_booking_approval', true)
 where tenant_id = 'a3000000-0000-0000-0000-000000000001';
set local role service_role;

do $$ declare v_booking uuid; v_requires_payment boolean; v_status text; begin
  select booking_id, requires_payment, booking_status into v_booking, v_requires_payment, v_status
  from public.create_storefront_booking_with_release(
    'release-0103',
    'a3000000-0000-0000-0000-000000000021',
    'a3000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_0103_day')::timestamptz + interval '11 hours',
    null, 'Approval', 'approval@example.test', '0700000105',
    'a3000000-0000-0000-0000-000000000011',
    'a3000000-0000-0000-0000-000000000043',
    false
  );
  if not exists (select 1 from public.bookings where id = v_booking and status = 'pending') then
    raise exception 'approval_requirement_was_bypassed';
  end if;
  if v_status <> 'pending' then raise exception 'approval_returned_wrong_status'; end if;
  if v_requires_payment then raise exception 'approval_only_falsely_requires_payment'; end if;
end $$;

reset role;
rollback;
