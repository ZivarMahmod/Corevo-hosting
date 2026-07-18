-- 0092 runtime: tenantbackstops, idempotent enqueue och lease/CAS.
-- Allt rullas tillbaka.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.tenants (id, slug, name) values
  ('92000000-0000-0000-0000-000000000001', 'outbox-0092-a', 'Outbox A'),
  ('92000000-0000-0000-0000-000000000002', 'outbox-0092-b', 'Outbox B');

insert into public.roles (id, tenant_id, name, level) values
  ('92000000-0000-0000-0000-000000000091', '92000000-0000-0000-0000-000000000001', 'owner-0092', 6);
insert into auth.users (id, email) values
  ('92000000-0000-0000-0000-000000000092', 'owner-0092@example.test');
insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('92000000-0000-0000-0000-000000000092', '92000000-0000-0000-0000-000000000001', 'owner-0092@example.test', '92000000-0000-0000-0000-000000000091', 'organization', 'active');

insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('92000000-0000-0000-0000-000000000011', '92000000-0000-0000-0000-000000000001', 'A', 'Europe/Stockholm', true),
  ('92000000-0000-0000-0000-000000000012', '92000000-0000-0000-0000-000000000002', 'B', 'Europe/Stockholm', true);

insert into public.staff (id, tenant_id, location_id, title, active) values
  ('92000000-0000-0000-0000-000000000021', '92000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000011', 'A', false),
  ('92000000-0000-0000-0000-000000000022', '92000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000012', 'B', false);

insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents
) values (
  '92000000-0000-0000-0000-000000000031',
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000011', 'A service', 30, 10000
);

insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000021',
  '92000000-0000-0000-0000-000000000031'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
)
select '92000000-0000-0000-0000-000000000001',
       '92000000-0000-0000-0000-000000000011',
       '92000000-0000-0000-0000-000000000021',
       day, '09:00', '17:00'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '92000000-0000-0000-0000-000000000001',
       '92000000-0000-0000-0000-000000000011',
       day, '09:00', '17:00', 'confirmed', now()
  from generate_series(0, 6) day;
update public.staff set active = true
 where id = '92000000-0000-0000-0000-000000000021';

insert into public.customers (id, tenant_id, full_name) values
  ('92000000-0000-0000-0000-000000000041', '92000000-0000-0000-0000-000000000001', 'Customer A'),
  ('92000000-0000-0000-0000-000000000042', '92000000-0000-0000-0000-000000000002', 'Customer B');

insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values (
  '92000000-0000-0000-0000-000000000051',
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000011',
  '92000000-0000-0000-0000-000000000021',
  '92000000-0000-0000-0000-000000000031',
  '92000000-0000-0000-0000-000000000041',
  date_trunc('day', now()) + interval '7 days 12 hours',
  date_trunc('day', now()) + interval '7 days 12 hours 30 minutes',
  'confirmed', 10000
);

-- Preferences/push måste bära samma tenant som kunden, även för service-role.
do $$ begin
  insert into public.customer_notification_prefs (customer_id, tenant_id)
  values ('92000000-0000-0000-0000-000000000041', '92000000-0000-0000-0000-000000000002');
  raise exception 'cross_tenant_notification_prefs_succeeded';
exception when foreign_key_violation then null; end $$;

do $$ begin
  insert into public.push_subscriptions (
    customer_id, tenant_id, endpoint, p256dh, auth
  ) values (
    '92000000-0000-0000-0000-000000000041',
    '92000000-0000-0000-0000-000000000002',
    'https://push.example.test/cross-tenant', 'key', 'auth'
  );
  raise exception 'cross_tenant_push_subscription_succeeded';
exception when foreign_key_violation then null; end $$;

-- Service-role kan inte kringgå outboxens customer/booking/staff-band.
do $$ begin
  insert into public.notifications_outbox (
    tenant_id, customer_id, event_type, event_key, category, chosen_channel
  ) values (
    '92000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000041',
    'test', 'customer-mismatch', 'transactional', 'email'
  );
  raise exception 'cross_tenant_outbox_customer_succeeded';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.notifications_outbox (
    tenant_id, booking_id, event_type, event_key, category, chosen_channel
  ) values (
    '92000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000051',
    'test', 'booking-mismatch', 'transactional', 'email'
  );
  raise exception 'cross_tenant_outbox_booking_succeeded';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.notifications_outbox (
    tenant_id, staff_id, event_type, event_key, category, chosen_channel
  ) values (
    '92000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000021',
    'test', 'staff-mismatch', 'transactional', 'email'
  );
  raise exception 'cross_tenant_outbox_staff_succeeded';
exception when check_violation then null; end $$;

-- Authenticated får inte anropa worker-RPC:erna.
set local role authenticated;
do $$ begin
  perform public.claim_notification_outbox(
    '92000000-0000-0000-0000-000000000061', now(), 120, 1
  );
  raise exception 'authenticated_outbox_claim_succeeded';
exception when insufficient_privilege then null; end $$;
reset role;

-- Dubbel enqueue returnerar samma rad och skapar exakt en leverans.
do $$
declare
  v_first uuid;
  v_second uuid;
  v_inserted boolean;
  v_count integer;
begin
  select e.id, e.inserted into v_first, v_inserted
    from public.enqueue_notification(
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000041',
      '92000000-0000-0000-0000-000000000051',
      '92000000-0000-0000-0000-000000000021',
      'booking_confirmation', 'booking:0092:confirmation',
      'transactional', 'email', null, '{}'::jsonb,
      '{"template":"booking_confirmation"}'::jsonb, 5
    ) e;
  if not v_inserted then raise exception 'first_enqueue_not_inserted'; end if;

  select e.id, e.inserted into v_second, v_inserted
    from public.enqueue_notification(
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000041',
      '92000000-0000-0000-0000-000000000051',
      '92000000-0000-0000-0000-000000000021',
      'booking_confirmation', 'booking:0092:confirmation',
      'transactional', 'email', null, '{}'::jsonb,
      '{"template":"booking_confirmation"}'::jsonb, 5
    ) e;
  if v_inserted or v_first <> v_second then
    raise exception 'duplicate_enqueue_not_idempotent';
  end if;

  select count(*) into v_count
    from public.notifications_outbox
   where event_key = 'booking:0092:confirmation';
  if v_count <> 1 then raise exception 'duplicate_outbox_rows_%', v_count; end if;
end $$;

-- Tenant A:s ägare kan inte läsa tenant B:s ledger.
select * from public.enqueue_notification(
  '92000000-0000-0000-0000-000000000002', null, null, null,
  'tenant_b_test', 'tenant-b:0092', 'transactional', 'email', null,
  '{}'::jsonb, '{}'::jsonb, 5
);
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000092', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000092","role":"authenticated","app_metadata":{"tenant_id":"92000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$ declare v_count integer; begin
  select count(*) into v_count
    from public.notifications_outbox
   where tenant_id = '92000000-0000-0000-0000-000000000002';
  if v_count <> 0 then raise exception 'cross_tenant_outbox_read_%', v_count; end if;
end $$;
reset role;
update public.notifications_outbox
   set status = 'sent', sent_at = now()
 where event_key = 'tenant-b:0092';

-- En lease kan inte dubbelclaimas och bara rätt token får börja/terminalisera.
do $$
declare
  v_id uuid;
  v_count integer;
  v_ok boolean;
begin
  select id into v_id
    from public.claim_notification_outbox(
      '92000000-0000-0000-0000-000000000071', now(), 120, 10
    );
  if v_id is null then raise exception 'outbox_not_claimed'; end if;

  select count(*) into v_count
    from public.claim_notification_outbox(
      '92000000-0000-0000-0000-000000000072', now(), 120, 10
    );
  if v_count <> 0 then raise exception 'outbox_double_claimed'; end if;

  select public.begin_notification_delivery(
    v_id, '92000000-0000-0000-0000-000000000072'
  ) into v_ok;
  if v_ok then raise exception 'wrong_lease_begin_succeeded'; end if;

  select public.begin_notification_delivery(
    v_id, '92000000-0000-0000-0000-000000000071'
  ) into v_ok;
  if not v_ok then raise exception 'lease_owner_begin_failed'; end if;

  -- Även långt efter den ursprungliga leasen är providerstarten at-most-once.
  select count(*) into v_count
    from public.claim_notification_outbox(
      '92000000-0000-0000-0000-000000000072', now() + interval '1 hour', 120, 10
    );
  if v_count <> 0 then raise exception 'delivery_started_reclaimed'; end if;

  select public.ack_notification_outbox(
    v_id, '92000000-0000-0000-0000-000000000071',
    'sent', 'provider-test', 0, null
  ) into v_ok;
  if not v_ok then raise exception 'lease_owner_ack_failed'; end if;

  select count(*) into v_count
    from public.claim_notification_outbox(
      '92000000-0000-0000-0000-000000000073', now() + interval '1 hour', 120, 10
    );
  if v_count <> 0 then raise exception 'terminal_outbox_reclaimed'; end if;
end $$;

-- Alla sex mutations-RPC:er är stängda för klientroller och öppna för worker.
do $$
declare
  v_sig text;
  v_role text;
begin
  foreach v_sig in array array[
    'public.enqueue_notification(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,jsonb,integer)',
    'public.claim_notification_outbox(uuid,timestamp with time zone,integer,integer)',
    'public.begin_notification_delivery(uuid,uuid)',
    'public.ack_notification_outbox(uuid,uuid,text,text,integer,text,integer)',
    'public.retry_notification_outbox(uuid,uuid,text,timestamp with time zone)',
    'public.scrub_notification_outbox_customer(uuid[],uuid[])'
  ] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(v_role, v_sig, 'execute') then
        raise exception 'client_execute_grant_%_%', v_role, v_sig;
      end if;
    end loop;
    if not has_function_privilege('service_role', v_sig, 'execute') then
      raise exception 'service_role_execute_missing_%', v_sig;
    end if;
  end loop;
end $$;

-- Lease-expiry återger raden exakt en gång; gammal token blir stale och den nya
-- kan terminalisera simulated.
select * from public.enqueue_notification(
  '92000000-0000-0000-0000-000000000001', null, null, null,
  'lease_expiry_test', 'lease-expiry:0092', 'transactional', 'email', null,
  '{}'::jsonb, '{}'::jsonb, 3
);
do $$
declare
  v_id uuid;
  v_reclaimed uuid;
  v_ok boolean;
  v_parts integer;
  v_base timestamptz := now();
begin
  select id into v_id from public.claim_notification_outbox(
    '92000000-0000-0000-0000-000000000074', v_base, 120, 1
  );
  select id into v_reclaimed from public.claim_notification_outbox(
    '92000000-0000-0000-0000-000000000075', v_base + interval '121 seconds', 120, 1
  );
  if v_reclaimed is distinct from v_id then raise exception 'expired_lease_not_reclaimed'; end if;

  select public.ack_notification_outbox(
    v_id, '92000000-0000-0000-0000-000000000074', 'sent', null, null, null
  ) into v_ok;
  if v_ok then raise exception 'stale_expired_lease_ack_succeeded'; end if;

  select public.begin_notification_delivery(
    v_id, '92000000-0000-0000-0000-000000000075'
  ) into v_ok;
  if not v_ok then raise exception 'reclaimed_lease_begin_failed'; end if;

  select public.ack_notification_outbox(
    v_id, '92000000-0000-0000-0000-000000000075',
    'simulated', 'dryrun-0092', 0, null, 2
  ) into v_ok;
  if not v_ok then raise exception 'reclaimed_lease_simulated_ack_failed'; end if;
  select parts into v_parts from public.notifications_outbox where id = v_id;
  if v_parts is distinct from 2 then raise exception 'simulated_parts_not_persisted'; end if;
end $$;

-- Explicit skipped är terminalt och claimas aldrig igen.
select * from public.enqueue_notification(
  '92000000-0000-0000-0000-000000000001', null, null, null,
  'skipped_test', 'skipped:0092', 'transactional', 'email', null,
  '{}'::jsonb, '{}'::jsonb, 3
);
do $$
declare
  v_id uuid;
  v_ok boolean;
  v_status text;
begin
  select id into v_id from public.claim_notification_outbox(
    '92000000-0000-0000-0000-000000000076', now(), 120, 1
  );
  select public.begin_notification_delivery(
    v_id, '92000000-0000-0000-0000-000000000076'
  ) into v_ok;
  if not v_ok then raise exception 'skipped_begin_failed'; end if;
  select public.ack_notification_outbox(
    v_id, '92000000-0000-0000-0000-000000000076',
    'skipped', null, null, 'channel_disabled'
  ) into v_ok;
  select status into v_status from public.notifications_outbox where id = v_id;
  if not v_ok or v_status <> 'skipped' then raise exception 'skipped_not_terminal'; end if;
end $$;

-- Max attempts terminaliserar failed och återclaimas inte.
select * from public.enqueue_notification(
  '92000000-0000-0000-0000-000000000001', null, null, null,
  'max_attempt_test', 'max-attempt:0092', 'transactional', 'email', null,
  '{}'::jsonb, '{}'::jsonb, 1
);
do $$
declare
  v_id uuid;
  v_status text;
  v_count integer;
  v_ok boolean;
begin
  select id into v_id from public.claim_notification_outbox(
    '92000000-0000-0000-0000-000000000077', now(), 120, 1
  );
  select public.begin_notification_delivery(
    v_id, '92000000-0000-0000-0000-000000000077'
  ) into v_ok;
  if not v_ok then raise exception 'max_attempt_begin_failed'; end if;
  select public.retry_notification_outbox(
    v_id, '92000000-0000-0000-0000-000000000077',
    'provider_unavailable', now() + interval '1 minute'
  ) into v_status;
  if v_status <> 'failed' then raise exception 'max_attempt_not_failed_%', v_status; end if;
  select count(*) into v_count from public.claim_notification_outbox(
    '92000000-0000-0000-0000-000000000078', now() + interval '1 hour', 120, 10
  );
  if v_count <> 0 then raise exception 'failed_row_reclaimed'; end if;
end $$;

-- Booking-only GDPR-rad stoppas, payload/länkar/lease scrubbas och sen CAS nekas.
select * from public.enqueue_notification(
  '92000000-0000-0000-0000-000000000001', null,
  '92000000-0000-0000-0000-000000000051', null,
  'gdpr_test', 'gdpr-booking-only:0092', 'transactional', 'email', null,
  '{}'::jsonb, '{"to":"customer@example.test"}'::jsonb, 3
);
do $$
declare
  v_id uuid;
  v_scrubbed integer;
  v_row public.notifications_outbox%rowtype;
  v_ok boolean;
begin
  select id into v_id from public.claim_notification_outbox(
    '92000000-0000-0000-0000-000000000079', now(), 120, 1
  );
  select public.begin_notification_delivery(
    v_id, '92000000-0000-0000-0000-000000000079'
  ) into v_ok;
  if not v_ok then raise exception 'gdpr_begin_failed'; end if;
  select public.scrub_notification_outbox_customer(
    array[]::uuid[],
    array['92000000-0000-0000-0000-000000000051'::uuid]
  ) into v_scrubbed;
  if v_scrubbed < 1 then raise exception 'booking_only_outbox_not_scrubbed'; end if;

  select * into v_row from public.notifications_outbox where id = v_id;
  if v_row.status <> 'skipped'
     or v_row.skip_reason <> 'gdpr_erased'
     or v_row.lease_token is not null
     or v_row.customer_id is not null
     or v_row.booking_id is not null
     or v_row.payload <> '{}'::jsonb then
    raise exception 'gdpr_outbox_scrub_incomplete';
  end if;

  select public.ack_notification_outbox(
    v_id, '92000000-0000-0000-0000-000000000079',
    'sent', null, null, null
  ) into v_ok;
  if v_ok then raise exception 'gdpr_invalidated_lease_ack_succeeded'; end if;
end $$;

rollback;
