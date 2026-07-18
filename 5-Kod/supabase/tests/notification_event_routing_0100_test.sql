-- 0100 runtime: tenant/status/consent routing and stable event idempotence.
-- Run against a fresh migrated test database; everything rolls back.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, slug, name) values
  ('a0000000-0000-4000-8000-000000000001', 'routing-0100-a', 'Routing A'),
  ('a0000000-0000-4000-8000-000000000002', 'routing-0100-b', 'Routing B');
insert into public.tenant_settings (tenant_id, settings) values (
  'a0000000-0000-4000-8000-000000000001',
  '{"sms_enabled":true,"notifications":{"confirmation":true,"reminder":true}}'::jsonb
);
insert into public.locations (id, tenant_id, name, timezone, is_primary) values (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000001', 'Primary', 'Europe/Stockholm', true
);
insert into public.staff (id, tenant_id, location_id, title, active) values (
  'a0000000-0000-4000-8000-000000000021',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000011', 'Staff', false
);
insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents
) values (
  'a0000000-0000-4000-8000-000000000031',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000011', 'Service', 30, 10000
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000021',
  'a0000000-0000-4000-8000-000000000031'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
)
select 'a0000000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000011',
       'a0000000-0000-4000-8000-000000000021',
       day, '09:00', '17:00'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select 'a0000000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000011',
       day, '09:00', '17:00', 'confirmed', now()
  from generate_series(0, 6) day;
update public.staff set active = true
 where id = 'a0000000-0000-4000-8000-000000000021';
insert into public.customers (id, tenant_id, full_name, email, phone) values (
  'a0000000-0000-4000-8000-000000000041',
  'a0000000-0000-4000-8000-000000000001',
  'Customer', 'customer@example.test', '0701234567'
);
insert into public.customer_notification_prefs (
  customer_id, tenant_id, push_enabled, email_enabled, sms_enabled,
  marketing_consent, want_recommendations
) values (
  'a0000000-0000-4000-8000-000000000041',
  'a0000000-0000-4000-8000-000000000001',
  false, true, true, false, false
);
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values (
  'a0000000-0000-4000-8000-000000000051',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000021',
  'a0000000-0000-4000-8000-000000000031',
  'a0000000-0000-4000-8000-000000000041',
  date_trunc('day', now()) + interval '7 days 12 hours',
  date_trunc('day', now()) + interval '7 days 12 hours 30 minutes',
  'confirmed', 10000
);

-- Only service_role may expose the security-definer API.
set local role authenticated;
do $$ begin
  perform public.route_booking_notification(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000051', null,
    'booking_confirmation', 'booking:a:confirmation', 'transactional', null,
    array['pending','confirmed'], '{"template":"booking_confirmation"}'::jsonb,
    true, null, null
  );
  raise exception 'authenticated_notification_route_succeeded';
exception when insufficient_privilege then null; end $$;
reset role;

-- Same domain event twice chooses email once and returns the same durable row.
do $$
declare
  v_first uuid;
  v_second uuid;
  v_status text;
  v_channel text;
  v_count integer;
begin
  select r.id, r.status, r.chosen_channel
    into v_first, v_status, v_channel
    from public.route_booking_notification(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000051', null,
      'booking_confirmation', 'booking:a:confirmation', 'transactional', null,
      array['pending','confirmed'],
      '{"template":"booking_confirmation","booking_id":"a0000000-0000-4000-8000-000000000051"}'::jsonb,
      true, null, null
    ) r;
  select r.id into v_second
    from public.route_booking_notification(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000051', null,
      'booking_confirmation', 'booking:a:confirmation', 'transactional', null,
      array['pending','confirmed'],
      '{"template":"booking_confirmation","booking_id":"a0000000-0000-4000-8000-000000000051"}'::jsonb,
      true, null, null
    ) r;
  select count(*) into v_count from public.notifications_outbox
   where tenant_id = 'a0000000-0000-4000-8000-000000000001'
     and event_key = 'booking:a:confirmation';
  if v_first is null or v_first <> v_second or v_status <> 'queued'
     or v_channel <> 'email' or v_count <> 1 then
    raise exception 'notification_route_not_idempotent';
  end if;
end $$;

-- Reminders respect explicit channel toggles; mandatory e-mail fallback must not
-- turn email_enabled=false into a surprise reminder.
update public.customer_notification_prefs
   set email_enabled = false, sms_enabled = false
 where customer_id = 'a0000000-0000-4000-8000-000000000041'
   and tenant_id = 'a0000000-0000-4000-8000-000000000001';
do $$
declare v_status text; v_reason text;
begin
  select r.status, r.skip_reason into v_status, v_reason
    from public.route_booking_notification(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000051', null,
      'booking_reminder', 'booking:a:reminder:preferences', 'transactional', 'reminders',
      array['pending','confirmed'],
      '{"template":"booking_reminder","booking_id":"a0000000-0000-4000-8000-000000000051"}'::jsonb,
      true, null, null
    ) r;
  if v_status <> 'skipped' or v_reason <> 'no_channel' then
    raise exception 'reminder_channel_preference_ignored';
  end if;
end $$;
update public.customer_notification_prefs
   set email_enabled = true, sms_enabled = true
 where customer_id = 'a0000000-0000-4000-8000-000000000041'
   and tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- Actor chose none: durable terminal skip, never a queued/sent claim.
do $$
declare v_status text; v_reason text;
begin
  select r.status, r.skip_reason into v_status, v_reason
    from public.route_booking_notification(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000051', null,
      'booking_rebooked', 'booking:a:rebook:one', 'transactional', null,
      array['pending','confirmed'],
      '{"template":"booking_rebooked","booking_id":"a0000000-0000-4000-8000-000000000051"}'::jsonb,
      false, 'actor_opted_out', null
    ) r;
  if v_status <> 'skipped' or v_reason <> 'actor_opted_out' then
    raise exception 'actor_skip_not_terminal';
  end if;
end $$;

-- An expected completed event against a confirmed booking fails closed. This
-- shares the same booking row lock used by a concurrent no_show correction.
do $$
declare v_status text; v_reason text;
begin
  select r.status, r.skip_reason into v_status, v_reason
    from public.route_booking_notification(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000051', null,
      'booking_completed', 'booking:a:completed', 'marketing', 'recommendations',
      array['completed'],
      '{"template":"booking_completed","booking_id":"a0000000-0000-4000-8000-000000000051"}'::jsonb,
      true, null, null
    ) r;
  if v_status <> 'skipped' or v_reason <> 'booking_outcome_changed' then
    raise exception 'booking_outcome_race_not_closed';
  end if;
end $$;

-- A pending request and its later confirmation are two truthful, durable events.
update public.bookings
   set status = 'pending'
 where id = 'a0000000-0000-4000-8000-000000000051';
do $$
declare v_status text; v_channel text; v_count integer;
begin
  select r.status, r.chosen_channel into v_status, v_channel
    from public.route_booking_notification(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000051', null,
      'booking_request_received', 'booking:a:request-received', 'transactional', null,
      array['pending'],
      '{"template":"booking_request_received","booking_id":"a0000000-0000-4000-8000-000000000051"}'::jsonb,
      true, null, null
    ) r;
  if v_status <> 'queued' or v_channel <> 'email' then
    raise exception 'pending_request_was_not_routed_truthfully';
  end if;

  update public.bookings
     set status = 'confirmed'
   where id = 'a0000000-0000-4000-8000-000000000051';

  perform public.route_booking_notification(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000051', null,
    'booking_confirmation', 'booking:a:confirmation:approved', 'transactional', null,
    array['confirmed'],
    '{"template":"booking_confirmation","booking_id":"a0000000-0000-4000-8000-000000000051"}'::jsonb,
    true, null, null
  );

  select count(*) into v_count
    from public.notifications_outbox
   where tenant_id = 'a0000000-0000-4000-8000-000000000001'
     and event_key in ('booking:a:request-received', 'booking:a:confirmation:approved')
     and status = 'queued';
  if v_count <> 2 then raise exception 'request_and_confirmation_not_distinct'; end if;
end $$;

-- A tenant/booking mismatch is rejected before any outbox row can be written.
do $$ begin
  perform public.route_booking_notification(
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000051', null,
    'booking_confirmation', 'booking:cross:confirmation', 'transactional', null,
    array['pending','confirmed'], '{"template":"booking_confirmation"}'::jsonb,
    true, null, null
  );
  raise exception 'cross_tenant_notification_route_succeeded';
exception when sqlstate 'P0002' then null; end $$;

rollback;
