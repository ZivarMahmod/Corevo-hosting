-- 0121 runtime contract. Run only against an isolated, fully migrated test DB.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $security$
declare v_name text; v_proc regprocedure; v_definition text;
begin
  if to_regclass('private.payment_refund_jobs') is null
     or to_regclass('private.customer_booking_rebooks') is null
     or has_table_privilege('anon', 'private.payment_refund_jobs', 'SELECT')
     or has_table_privilege('authenticated', 'private.payment_refund_jobs', 'SELECT')
     or has_table_privilege('service_role', 'private.payment_refund_jobs', 'SELECT') then
    raise exception 'refund_grant_invalid';
  end if;
  foreach v_name in array array[
    'claim_payment_refund_jobs', 'claim_payment_refund_job_by_id',
    'begin_payment_refund_delivery', 'retry_payment_refund_job',
    'complete_payment_refund_job', 'review_payment_refund_job',
    'record_payment_refund_webhook', 'payment_refund_health',
    'prepare_booking_checkout_payment', 'booking_payment_event_matches',
    'finalize_customer_booking_rebook', 'compensate_customer_booking_rebook',
    'confirm_shop_order_payment'
  ] loop
    select p.oid::regprocedure, pg_get_functiondef(p.oid)
      into v_proc, v_definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_name;
    if v_proc is null
       or has_function_privilege('anon', v_proc, 'EXECUTE')
       or has_function_privilege('authenticated', v_proc, 'EXECUTE')
       or not has_function_privilege('service_role', v_proc, 'EXECUTE')
       or v_definition not like '%SECURITY DEFINER%'
       or v_definition not like '%SET search_path TO ''''%' then
      raise exception 'refund_grant_invalid:%', v_name;
    end if;
  end loop;
end
$security$;

do $runtime$
declare
  v_tenant_a uuid := gen_random_uuid(); v_tenant_b uuid := gen_random_uuid();
  v_customer_a uuid := gen_random_uuid(); v_customer_other uuid := gen_random_uuid();
  v_customer_b uuid := gen_random_uuid();
  v_location_a uuid := gen_random_uuid(); v_location_b uuid := gen_random_uuid();
  v_staff_a uuid := gen_random_uuid(); v_staff_b uuid := gen_random_uuid();
  v_service_a uuid := gen_random_uuid(); v_service_b uuid := gen_random_uuid();
  v_unpaid uuid := gen_random_uuid(); v_paid uuid := gen_random_uuid();
  v_late uuid := gen_random_uuid(); v_cutoff uuid := gen_random_uuid();
  v_other_customer uuid := gen_random_uuid(); v_cross_tenant uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid(); v_result record; v_json jsonb;
  v_payment_paid uuid := gen_random_uuid(); v_payment_late uuid := gen_random_uuid();
  v_job uuid; v_count integer;
begin
  insert into public.tenants (
    id, slug, name, status, stripe_account_id, stripe_charges_enabled
  ) values
    (v_tenant_a, 'refund-test-a', 'Refund Test A', 'active', 'acct_refund_a', true),
    (v_tenant_b, 'refund-test-b', 'Refund Test B', 'active', 'acct_refund_b', true);
  insert into public.tenant_settings (tenant_id, branding, settings) values
    (v_tenant_a, '{}'::jsonb, '{"customer_portal":{"mode":"passwordless_tenant"},"cancellation_cutoff_hours":24}'::jsonb),
    (v_tenant_b, '{}'::jsonb, '{"customer_portal":{"mode":"passwordless_tenant"},"cancellation_cutoff_hours":24}'::jsonb);
  insert into public.customers (id, tenant_id, full_name, phone, status) values
    (v_customer_a, v_tenant_a, 'Customer A', '+46700000001', 'active'),
    (v_customer_other, v_tenant_a, 'Other A', '+46700000002', 'active'),
    (v_customer_b, v_tenant_b, 'Customer B', '+46700000003', 'active');
  insert into public.locations (id, tenant_id, name, timezone, is_primary) values
    (v_location_a, v_tenant_a, 'A', 'Europe/Stockholm', true),
    (v_location_b, v_tenant_b, 'B', 'Europe/Stockholm', true);
  insert into public.staff (id, tenant_id, location_id, title, active) values
    (v_staff_a, v_tenant_a, v_location_a, 'A', true),
    (v_staff_b, v_tenant_b, v_location_b, 'B', true);
  insert into public.services (
    id, tenant_id, location_id, name, duration_min, price_cents, active
  ) values
    (v_service_a, v_tenant_a, v_location_a, 'A', 30, 10000, true),
    (v_service_b, v_tenant_b, v_location_b, 'B', 30, 10000, true);
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values
    (v_unpaid, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
      statement_timestamp() + interval '3 days', statement_timestamp() + interval '3 days 30 minutes', 'confirmed', 10000),
    (v_paid, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
      statement_timestamp() + interval '4 days', statement_timestamp() + interval '4 days 30 minutes', 'confirmed', 10000),
    (v_late, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
      statement_timestamp() + interval '5 days', statement_timestamp() + interval '5 days 30 minutes', 'pending', 10000),
    (v_cutoff, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
      statement_timestamp() + interval '2 hours', statement_timestamp() + interval '2 hours 30 minutes', 'confirmed', 10000),
    (v_other_customer, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_other,
      statement_timestamp() + interval '6 days', statement_timestamp() + interval '6 days 30 minutes', 'confirmed', 10000),
    (v_cross_tenant, v_tenant_b, v_location_b, v_staff_b, v_service_b, v_customer_b,
      statement_timestamp() + interval '7 days', statement_timestamp() + interval '7 days 30 minutes', 'confirmed', 10000);
  insert into public.payments (
    id, tenant_id, booking_id, amount_cents, currency, status,
    stripe_payment_intent_id, stripe_connected_account_id
  ) values
    (v_payment_paid, v_tenant_a, v_paid, 10000, 'sek', 'succeeded', 'pi_refund_paid', 'acct_refund_a'),
    (v_payment_late, v_tenant_a, v_late, 10000, 'sek', 'pending', null, 'acct_refund_a');
  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (
    v_session, v_tenant_a, v_customer_a, repeat('s', 64), 1,
    statement_timestamp() + interval '1 day', statement_timestamp() + interval '7 days'
  );

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_unpaid, 24, repeat('u', 32)
  );
  if v_result.outcome <> 'cancelled' or v_result.refund_job_id is not null then
    raise exception 'refund_unpaid_invalid:%', row_to_json(v_result);
  end if;

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_paid, 24, repeat('p', 32)
  );
  v_job := v_result.refund_job_id;
  if v_result.outcome <> 'cancelled' or v_job is null
     or not exists (
       select 1 from private.payment_refund_jobs j
       where j.id = v_job and j.payment_id = v_payment_paid
         and j.provider_payment_intent_id = 'pi_refund_paid'
         and j.provider_connected_account_id = 'acct_refund_a'
         and j.provider_idempotency_key = 'refund_' || v_paid::text
     ) then raise exception 'refund_succeeded_invalid:%', row_to_json(v_result); end if;

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_paid, 24, repeat('p', 32)
  );
  select count(*) into v_count from private.customer_portal_audit a
  where a.tenant_id = v_tenant_a and a.event_type = 'booking_cancelled'
    and a.entity_public_id = v_paid;
  if v_result.outcome <> 'cancelled' or v_result.refund_job_id <> v_job or v_count <> 1
     or (select count(*) from private.payment_refund_jobs j where j.payment_id = v_payment_paid) <> 1
     or (select count(*) from public.notifications_outbox o
         where o.tenant_id = v_tenant_a and o.event_key = 'booking:' || v_paid::text || ':cancelled') <> 1 then
    raise exception 'refund_exactly_once_invalid';
  end if;

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_other_customer, 24, repeat('p', 32)
  );
  if v_result.outcome <> 'idempotency_conflict'
     or (select status from public.bookings where id = v_other_customer) <> 'confirmed' then
    raise exception 'refund_idempotency_conflict_invalid';
  end if;

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_paid, 24, repeat('f', 32)
  );
  if v_result.outcome <> 'already_cancelled' then
    raise exception 'refund_already_cancelled_invalid';
  end if;
  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_other_customer, 24, repeat('f', 32)
  );
  if v_result.outcome <> 'idempotency_conflict' then
    raise exception 'refund_already_key_reuse_invalid';
  end if;

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_cross_tenant, 24, repeat('x', 32)
  );
  if v_result.outcome <> 'not_found'
     or (select status from public.bookings where id = v_cross_tenant) <> 'confirmed' then
    raise exception 'refund_cross_tenant_invalid';
  end if;

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_cutoff, 24, repeat('c', 32)
  );
  if v_result.outcome <> 'not_allowed' then raise exception 'refund_cutoff_invalid'; end if;
  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_other_customer, 12, repeat('q', 32)
  );
  if v_result.outcome <> 'not_found' then
    -- Ownership is intentionally indistinguishable before policy.
    raise exception 'refund_cross_customer_invalid';
  end if;

  select * into v_result from public.customer_portal_cancel_booking(
    v_session, repeat('s', 64), v_late, 24, repeat('l', 32)
  );
  if v_result.outcome <> 'cancelled' or v_result.refund_job_id is not null then
    raise exception 'refund_pending_cancel_invalid';
  end if;
  select public.confirm_booking_payment(
    v_late, v_tenant_a, 'pi_refund_late', 'acct_refund_a'
  ) into v_json;
  if v_json ->> 'booking_status' <> 'cancelled'
     or v_json ->> 'payment_status' <> 'succeeded'
     or nullif(v_json ->> 'refund_job_id', '') is null
     or (select count(*) from private.payment_refund_jobs j where j.payment_id = v_payment_late) <> 1 then
    raise exception 'refund_pending_late_success_invalid:%', v_json;
  end if;

  begin
    update public.bookings set status = 'confirmed', cancelled_at = null, cancelled_by = null
    where id = v_paid;
    raise exception 'refund_restoration_guard_invalid';
  exception when sqlstate '55000' then null;
  end;
end
$runtime$;

do $compat_rebook$
declare
  v_tenant uuid := gen_random_uuid(); v_other_tenant uuid := gen_random_uuid();
  v_profile uuid := gen_random_uuid(); v_role uuid := gen_random_uuid();
  v_customer uuid := gen_random_uuid(); v_other_customer uuid := gen_random_uuid();
  v_location uuid := gen_random_uuid(); v_staff uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid(); v_session uuid := gen_random_uuid();
  v_preflight uuid := gen_random_uuid(); v_pending uuid := gen_random_uuid();
  v_failed uuid := gen_random_uuid(); v_pi_conflict uuid := gen_random_uuid();
  v_account_conflict uuid := gen_random_uuid(); v_prepare uuid := gen_random_uuid();
  v_policy uuid := gen_random_uuid(); v_duplicate_pi uuid := gen_random_uuid();
  v_shop_legacy uuid := gen_random_uuid(); v_shop_new uuid := gen_random_uuid();
  v_old_a uuid := gen_random_uuid(); v_new_a uuid := gen_random_uuid();
  v_old_b uuid := gen_random_uuid(); v_new_b uuid := gen_random_uuid();
  v_old_pending uuid := gen_random_uuid(); v_new_pending uuid := gen_random_uuid();
  v_old_scope uuid := gen_random_uuid(); v_new_scope uuid := gen_random_uuid();
  v_payment uuid; v_json jsonb; v_failed_as_expected boolean;
begin
  insert into public.tenants (
    id, slug, name, status, stripe_account_id, stripe_charges_enabled
  ) values
    (v_tenant, 'refund-ext-' || substr(v_tenant::text, 1, 8), 'Refund Extended',
      'active', 'acct_refund_extended', true),
    (v_other_tenant, 'refund-ext-' || substr(v_other_tenant::text, 1, 8), 'Other',
      'active', 'acct_refund_other', true);
  insert into public.tenant_settings (tenant_id, branding, settings) values (
    v_tenant, '{}'::jsonb,
    '{"customer_portal":{"mode":"passwordless_tenant"},"cancellation_cutoff_hours":24}'::jsonb
  );
  insert into public.roles (id, tenant_id, name, level)
  values (v_role, v_tenant, 'kund-0121', 2);
  insert into auth.users (id, email)
  values (v_profile, 'refund-0121-' || substr(v_profile::text, 1, 8) || '@example.test');
  insert into public.users (id, tenant_id, email, role_id, status) values (
    v_profile, v_tenant, 'refund-0121@example.test', v_role, 'active'
  );
  insert into public.customers (id, tenant_id, auth_user_id, full_name, phone, status) values
    (v_customer, v_tenant, v_profile, 'Refund Customer', '+46700000121', 'active'),
    (v_other_customer, v_tenant, null, 'Other Customer', '+46700000122', 'active');
  insert into public.locations (id, tenant_id, name, timezone, is_primary)
  values (v_location, v_tenant, 'Extended', 'Europe/Stockholm', true);
  insert into public.staff (id, tenant_id, location_id, title, active)
  values (v_staff, v_tenant, v_location, 'Extended', true);
  insert into public.services (
    id, tenant_id, location_id, name, duration_min, price_cents, active
  ) values (v_service, v_tenant, v_location, 'Extended', 30, 10000, true);
  insert into public.shop_orders (
    id,tenant_id,total_cents,currency,status,payment_status
  ) values
    (v_shop_legacy,v_tenant,10000,'SEK','awaiting_payment','unpaid'),
    (v_shop_new,v_tenant,10000,'SEK','awaiting_payment','unpaid');

  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_profile_id,
    customer_id, start_ts, end_ts, status, price_cents
  ) values
    (v_preflight,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '10 days',statement_timestamp()+interval '10 days 30 minutes','confirmed',10000),
    (v_pending,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '11 days',statement_timestamp()+interval '11 days 30 minutes','pending',10000),
    (v_failed,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '12 days',statement_timestamp()+interval '12 days 30 minutes','pending',10000),
    (v_pi_conflict,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '13 days',statement_timestamp()+interval '13 days 30 minutes','pending',10000),
    (v_account_conflict,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '14 days',statement_timestamp()+interval '14 days 30 minutes','pending',10000),
    (v_prepare,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '15 days',statement_timestamp()+interval '15 days 30 minutes','pending',10000),
    (v_policy,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '16 days',statement_timestamp()+interval '16 days 30 minutes','confirmed',10000),
    (v_duplicate_pi,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '16 days 1 hour',statement_timestamp()+interval '16 days 1 hour 30 minutes','pending',10000),
    (v_old_a,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '17 days',statement_timestamp()+interval '17 days 30 minutes','pending',10000),
    (v_new_a,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '18 days',statement_timestamp()+interval '18 days 30 minutes','pending',10000),
    (v_old_b,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '19 days',statement_timestamp()+interval '19 days 30 minutes','confirmed',10000),
    (v_new_b,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '20 days',statement_timestamp()+interval '20 days 30 minutes','pending',10000),
    (v_old_pending,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '21 days',statement_timestamp()+interval '21 days 30 minutes','pending',10000),
    (v_new_pending,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '22 days',statement_timestamp()+interval '22 days 30 minutes','pending',10000),
    (v_old_scope,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '23 days',statement_timestamp()+interval '23 days 30 minutes','confirmed',10000),
    (v_new_scope,v_tenant,v_location,v_staff,v_service,v_profile,v_customer,statement_timestamp()+interval '24 days',statement_timestamp()+interval '24 days 30 minutes','pending',10000);

  insert into public.payments (
    id, tenant_id, booking_id, amount_cents, currency, status,
    stripe_payment_intent_id, stripe_connected_account_id
  ) values
    (gen_random_uuid(),v_tenant,v_preflight,10000,'sek','pending',null,null),
    (gen_random_uuid(),v_tenant,v_pending,10000,'sek','pending',null,null),
    (gen_random_uuid(),v_tenant,v_failed,10000,'sek','failed',null,null),
    (gen_random_uuid(),v_tenant,v_pi_conflict,10000,'sek','pending','pi_original_identity',null),
    (gen_random_uuid(),v_tenant,v_account_conflict,10000,'sek','pending',null,'acct_refund_other'),
    (gen_random_uuid(),v_tenant,v_old_a,10000,'sek','pending',null,null),
    (gen_random_uuid(),v_tenant,v_old_b,10000,'sek','succeeded','pi_rebook_before','acct_refund_extended'),
    (gen_random_uuid(),v_tenant,v_old_pending,10000,'sek','pending',null,'acct_refund_extended');
  insert into public.payments (
    id,tenant_id,order_id,amount_cents,currency,status,
    stripe_payment_intent_id,stripe_connected_account_id
  ) values
    (gen_random_uuid(),v_tenant,v_shop_legacy,10000,'sek','succeeded','pi_shop_legacy_null',null),
    (gen_random_uuid(),v_tenant,v_shop_new,10000,'sek','pending',null,null);

  v_failed_as_expected := false;
  begin
    update public.payments set status='succeeded',stripe_payment_intent_id='pi_snapshot_constraint'
    where booking_id=v_preflight;
  exception when check_violation then v_failed_as_expected := true; end;
  if not v_failed_as_expected
     or (select status from public.payments where booking_id=v_preflight) <> 'pending' then
    raise exception 'refund_succeeded_snapshot_constraint_invalid';
  end if;
  update public.payments
  set status='succeeded',stripe_payment_intent_id='pi_snapshot_constraint',
      stripe_connected_account_id='acct_refund_extended'
  where booking_id=v_preflight;
  if (select status from public.payments where booking_id=v_preflight) <> 'succeeded' then
    raise exception 'refund_succeeded_snapshot_atomic_bind_invalid';
  end if;

  v_failed_as_expected := false;
  begin
    insert into public.payments (
      id,tenant_id,booking_id,amount_cents,currency,status,
      stripe_payment_intent_id,stripe_connected_account_id
    ) values (
      gen_random_uuid(),v_tenant,v_duplicate_pi,10000,'sek','failed',
      'pi_snapshot_constraint','acct_refund_extended'
    );
  exception when unique_violation then v_failed_as_expected := true; end;
  if not v_failed_as_expected then
    raise exception 'refund_duplicate_payment_intent_constraint_invalid';
  end if;

  v_failed_as_expected := false;
  begin update public.payments set stripe_connected_account_id='acct_refund_other'
    where booking_id=v_preflight;
  exception when sqlstate '55000' then v_failed_as_expected := true; end;
  if not v_failed_as_expected then raise exception 'refund_settled_account_immutable_invalid'; end if;
  v_failed_as_expected := false;
  begin update public.payments set stripe_payment_intent_id='pi_snapshot_changed'
    where booking_id=v_preflight;
  exception when sqlstate '55000' then v_failed_as_expected := true; end;
  if not v_failed_as_expected then raise exception 'refund_settled_payment_intent_immutable_invalid'; end if;
  update public.payments set status='refunded' where booking_id=v_preflight;
  if (select status from public.payments where booking_id=v_preflight) <> 'refunded'
     or (select stripe_payment_intent_id from public.payments where booking_id=v_preflight) <> 'pi_snapshot_constraint'
     or (select stripe_connected_account_id from public.payments where booking_id=v_preflight) <> 'acct_refund_extended' then
    raise exception 'refund_settled_same_identity_refund_invalid';
  end if;

  select public.record_payment_refund_webhook(
    v_tenant,'pi_shop_legacy_null','ch_shop_legacy','acct_refund_extended'
  ) into v_json;
  if v_json->>'outcome' <> 'not_found'
     or (select status from public.payments where order_id=v_shop_legacy) <> 'succeeded'
     or (select stripe_connected_account_id from public.payments where order_id=v_shop_legacy) is not null then
    raise exception 'refund_shop_legacy_null_fail_closed_invalid';
  end if;
  select public.confirm_shop_order_payment(
    v_shop_new,v_tenant,'pi_shop_new','acct_refund_extended'
  ) into v_json;
  if v_json->>'outcome' <> 'succeeded'
     or (select status from public.payments where order_id=v_shop_new) <> 'succeeded'
     or (select stripe_payment_intent_id from public.payments where order_id=v_shop_new) <> 'pi_shop_new'
     or (select stripe_connected_account_id from public.payments where order_id=v_shop_new) <> 'acct_refund_extended' then
    raise exception 'refund_shop_new_snapshot_invalid';
  end if;
  select public.confirm_shop_order_payment(
    v_shop_new,v_tenant,'pi_shop_new','acct_refund_extended'
  ) into v_json;
  if v_json->>'outcome' <> 'already_succeeded' then
    raise exception 'refund_shop_exact_replay_invalid';
  end if;
  v_failed_as_expected := false;
  begin perform public.confirm_shop_order_payment(
    v_shop_new,v_tenant,'pi_shop_second','acct_refund_extended'
  ); exception when sqlstate '55000' then v_failed_as_expected := true; end;
  if not v_failed_as_expected
     or (select stripe_payment_intent_id from public.payments where order_id=v_shop_new) <> 'pi_shop_new' then
    raise exception 'refund_shop_second_payment_intent_invalid';
  end if;

  select public.confirm_booking_payment(v_pending,v_tenant,'pi_legacy_pending','acct_refund_extended') into v_json;
  if (select stripe_connected_account_id from public.payments where booking_id=v_pending) <> 'acct_refund_extended'
     or v_json->>'payment_status' <> 'succeeded' then
    raise exception 'refund_legacy_pending_account_bind_invalid';
  end if;
  select public.confirm_booking_payment(v_failed,v_tenant,'pi_legacy_failed','acct_refund_extended') into v_json;
  if (select stripe_connected_account_id from public.payments where booking_id=v_failed) <> 'acct_refund_extended'
     or v_json->>'payment_status' <> 'succeeded' then
    raise exception 'refund_legacy_failed_account_bind_invalid';
  end if;

  v_failed_as_expected := false;
  begin perform public.confirm_booking_payment(v_pi_conflict,v_tenant,'pi_changed_identity','acct_refund_extended');
  exception when sqlstate '55000' then v_failed_as_expected := true; end;
  if not v_failed_as_expected then raise exception 'refund_payment_intent_conflict_invalid'; end if;
  v_failed_as_expected := false;
  begin perform public.confirm_booking_payment(v_account_conflict,v_tenant,'pi_account_conflict','acct_refund_extended');
  exception when sqlstate '55000' then v_failed_as_expected := true; end;
  if not v_failed_as_expected then raise exception 'refund_payment_account_conflict_invalid'; end if;

  if not public.prepare_booking_checkout_payment(v_prepare,v_tenant,10000,'sek','cs_prepare_0121','acct_refund_extended')
     or not public.prepare_booking_checkout_payment(v_prepare,v_tenant,10000,'sek','cs_prepare_0121','acct_refund_extended')
     or public.prepare_booking_checkout_payment(v_prepare,v_tenant,9999,'sek','cs_prepare_0121','acct_refund_extended') then
    raise exception 'refund_prepare_checkout_invalid';
  end if;
  update public.payments set status='succeeded',stripe_payment_intent_id='pi_prepare_terminal'
  where booking_id=v_prepare;
  if public.prepare_booking_checkout_payment(
    v_prepare,v_tenant,10000,'sek','cs_prepare_0121','acct_refund_extended'
  ) then raise exception 'refund_prepare_terminal_revival_invalid'; end if;

  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (v_session,v_tenant,v_customer,repeat('e',64),1,
    statement_timestamp()+interval '1 day',statement_timestamp()+interval '7 days');
  select to_jsonb(x) into v_json from public.customer_portal_cancel_booking(
    v_session,repeat('e',64),v_policy,12,repeat('k',32)
  ) x;
  if v_json->>'outcome' <> 'policy_changed' then raise exception 'refund_policy_changed_invalid'; end if;

  -- Webhook settles old first, then atomic rebook carries it, then a duplicate
  -- old-metadata webhook resolves through the durable mapping.
  perform public.confirm_booking_payment(v_old_a,v_tenant,'pi_webhook_before','acct_refund_extended');
  select public.finalize_customer_booking_rebook(v_tenant,v_old_a,v_new_a,v_profile,v_customer) into v_json;
  perform public.confirm_booking_payment(v_old_a,v_tenant,'pi_webhook_before','acct_refund_extended');
  if v_json->>'outcome' <> 'finalized'
     or (select booking_id from public.payments where stripe_payment_intent_id='pi_webhook_before') <> v_new_a
     or (select status from public.bookings where id=v_old_a) <> 'cancelled'
     or (select status from public.bookings where id=v_new_a) <> 'confirmed'
     or not public.booking_payment_event_matches(v_tenant,v_old_a,'pi_webhook_before','acct_refund_extended')
     or exists (select 1 from private.payment_refund_jobs where booking_id=v_old_a) then
    raise exception 'refund_webhook_before_rebook_invalid';
  end if;
  select public.compensate_customer_booking_rebook(
    v_tenant,v_old_a,v_new_a,v_profile,v_customer
  ) into v_json;
  if v_json->>'outcome' <> 'preserved_finalized'
     or not (v_json->>'payment_carried')::boolean
     or (select status from public.bookings where id=v_new_a) <> 'confirmed' then
    raise exception 'refund_rebook_committed_response_loss_invalid';
  end if;

  -- Rebook commits first for an already-settled payment; the later duplicate
  -- succeeded webhook must resolve old -> new and remain idempotent.
  select public.finalize_customer_booking_rebook(v_tenant,v_old_b,v_new_b,v_profile,v_customer) into v_json;
  perform public.confirm_booking_payment(v_old_b,v_tenant,'pi_rebook_before','acct_refund_extended');
  if v_json->>'outcome' <> 'finalized'
     or (select booking_id from public.payments where stripe_payment_intent_id='pi_rebook_before') <> v_new_b
     or exists (select 1 from private.payment_refund_jobs where booking_id in (v_old_b,v_new_b)) then
    raise exception 'refund_rebook_before_duplicate_webhook_invalid';
  end if;

  v_failed_as_expected := false;
  begin perform public.finalize_customer_booking_rebook(
    v_tenant,v_old_pending,v_new_pending,v_profile,v_customer
  ); exception when sqlstate '55000' then v_failed_as_expected := true; end;
  if not v_failed_as_expected
     or (select status from public.bookings where id=v_old_pending) <> 'pending'
     or (select booking_id from public.payments where booking_id=v_old_pending) <> v_old_pending then
    raise exception 'refund_rebook_pending_invalid';
  end if;
  select public.compensate_customer_booking_rebook(
    v_tenant,v_old_pending,v_new_pending,v_profile,v_customer
  ) into v_json;
  if v_json->>'outcome' <> 'compensated'
     or (select status from public.bookings where id=v_old_pending) <> 'pending'
     or (select status from public.bookings where id=v_new_pending) <> 'cancelled'
     or (select booking_id from public.payments where booking_id=v_old_pending) <> v_old_pending then
    raise exception 'refund_rebook_compensation_invalid';
  end if;

  v_failed_as_expected := false;
  begin perform public.finalize_customer_booking_rebook(
    v_tenant,v_old_scope,v_new_scope,v_profile,v_other_customer
  ); exception when sqlstate '42501' then v_failed_as_expected := true; end;
  if not v_failed_as_expected then raise exception 'refund_rebook_scope_invalid'; end if;
  v_failed_as_expected := false;
  begin perform public.finalize_customer_booking_rebook(
    v_other_tenant,v_old_scope,v_new_scope,v_profile,v_customer
  ); exception when sqlstate '42501' then v_failed_as_expected := true; end;
  if not v_failed_as_expected then raise exception 'refund_rebook_tenant_invalid'; end if;

  select public.finalize_customer_booking_rebook(
    v_tenant,v_old_scope,v_new_scope,v_profile,v_customer
  ) into v_json;
  select public.finalize_customer_booking_rebook(
    v_tenant,v_old_scope,v_new_scope,v_profile,v_customer
  ) into v_json;
  if v_json->>'outcome' <> 'already_finalized'
     or (v_json->>'payment_carried')::boolean then
    raise exception 'refund_rebook_idempotency_invalid';
  end if;
end
$compat_rebook$;

do $refund_state_machine$
declare
  v_paid_job uuid; v_late_job uuid; v_review_job uuid; v_webhook_job uuid;
  v_tenant uuid; v_booking uuid; v_payment uuid;
  v_lease_a uuid := gen_random_uuid(); v_lease_b uuid := gen_random_uuid();
  v_lease_c uuid := gen_random_uuid(); v_lease_d uuid := gen_random_uuid();
  v_claim record; v_text text; v_json jsonb; v_health jsonb;
begin
  select j.id into strict v_paid_job from private.payment_refund_jobs j
  where j.provider_payment_intent_id = 'pi_refund_paid';
  select * into v_claim from public.claim_payment_refund_job_by_id(
    v_paid_job,v_lease_a,statement_timestamp(),120
  );
  if v_claim.id is distinct from v_paid_job or v_claim.lease_token is distinct from v_lease_a then
    raise exception 'refund_claim_by_id_invalid';
  end if;
  if public.begin_payment_refund_delivery(v_paid_job,gen_random_uuid())
     or not public.begin_payment_refund_delivery(v_paid_job,v_lease_a)
     or public.complete_payment_refund_job(v_paid_job,gen_random_uuid(),'re_wrong') then
    raise exception 'refund_lease_cas_invalid';
  end if;
  if not public.complete_payment_refund_job(v_paid_job,v_lease_a,'re_paid_0121')
     or not public.complete_payment_refund_job(v_paid_job,v_lease_a,'re_paid_0121')
     or (select status from private.payment_refund_jobs where id=v_paid_job) <> 'completed'
     or (select status from public.payments where stripe_payment_intent_id='pi_refund_paid') <> 'refunded' then
    raise exception 'refund_complete_repeat_invalid';
  end if;
  select public.record_payment_refund_webhook(
    (select tenant_id from public.payments where stripe_payment_intent_id='pi_refund_paid'),
    'pi_refund_paid','ch_paid_after_complete','acct_refund_a'
  ) into v_json;
  if v_json->>'outcome' <> 'recorded' then raise exception 'refund_webhook_after_complete_invalid'; end if;

  select j.id into strict v_late_job from private.payment_refund_jobs j
  where j.provider_payment_intent_id = 'pi_refund_late';
  select * into v_claim from public.claim_payment_refund_jobs(
    v_lease_b,statement_timestamp(),120,1
  ) where id=v_late_job;
  if v_claim.id is distinct from v_late_job then raise exception 'refund_batch_claim_invalid'; end if;
  if public.retry_payment_refund_job(
       v_late_job,gen_random_uuid(),'provider_unavailable_before_request',statement_timestamp()
     ) <> 'stale' then raise exception 'refund_retry_stale_lease_invalid'; end if;
  if public.retry_payment_refund_job(
       v_late_job,v_lease_b,'provider_unavailable_before_request',statement_timestamp()
     ) <> 'queued' then raise exception 'refund_retry_invalid'; end if;
  update private.payment_refund_jobs set attempt_count=7 where id=v_late_job;
  select * into v_claim from public.claim_payment_refund_job_by_id(
    v_late_job,v_lease_c,statement_timestamp(),120
  );
  v_text := public.retry_payment_refund_job(
    v_late_job,v_lease_c,'provider_unavailable_before_request',statement_timestamp()
  );
  if v_text <> 'review_required'
     or (select status from private.payment_refund_jobs where id=v_late_job) <> 'review_required' then
    raise exception 'refund_retry_max_review_invalid';
  end if;

  select p.tenant_id,p.booking_id,p.id into strict v_tenant,v_booking,v_payment
  from public.payments p where p.stripe_payment_intent_id='pi_legacy_failed';
  update public.bookings set status='cancelled',cancelled_at=statement_timestamp(),cancelled_by='customer'
  where id=v_booking and tenant_id=v_tenant;
  v_review_job := private.enqueue_booking_payment_refund(v_tenant,v_booking,v_payment);
  select * into v_claim from public.claim_payment_refund_job_by_id(
    v_review_job,v_lease_d,statement_timestamp(),120
  );
  if public.review_payment_refund_job(v_review_job,gen_random_uuid(),'provider_rejected')
     or not public.review_payment_refund_job(v_review_job,v_lease_d,'provider_rejected')
     or (select status from private.payment_refund_jobs where id=v_review_job) <> 'review_required' then
    raise exception 'refund_manual_review_invalid';
  end if;
  select public.record_payment_refund_webhook(
    v_tenant,'pi_legacy_failed','ch_wrong_account','acct_refund_other'
  ) into v_json;
  if v_json->>'outcome' <> 'not_found'
     or (select status from public.payments where stripe_payment_intent_id='pi_legacy_failed') <> 'succeeded'
     or (select status from private.payment_refund_jobs where id=v_review_job) <> 'review_required' then
    raise exception 'refund_webhook_account_mismatch_invalid';
  end if;

  select p.tenant_id,p.booking_id,p.id into strict v_tenant,v_booking,v_payment
  from public.payments p where p.stripe_payment_intent_id='pi_legacy_pending';
  update public.bookings set status='cancelled',cancelled_at=statement_timestamp(),cancelled_by='customer'
  where id=v_booking and tenant_id=v_tenant;
  v_webhook_job := private.enqueue_booking_payment_refund(v_tenant,v_booking,v_payment);
  select * into v_claim from public.claim_payment_refund_job_by_id(
    v_webhook_job,v_lease_d,statement_timestamp(),120
  );
  if not public.begin_payment_refund_delivery(v_webhook_job,v_lease_d) then
    raise exception 'refund_webhook_before_complete_begin_invalid';
  end if;
  select public.record_payment_refund_webhook(
    v_tenant,'pi_legacy_pending','ch_webhook_first','acct_refund_extended'
  ) into v_json;
  if v_json->>'outcome' <> 'recorded'
     or (select status from private.payment_refund_jobs where id=v_webhook_job) <> 'completed'
     or not public.complete_payment_refund_job(v_webhook_job,v_lease_d,'ch_webhook_first') then
    raise exception 'refund_webhook_before_complete_invalid';
  end if;

  select public.payment_refund_health() into v_health;
  if not (v_health ?& array[
       'queued','attempting','providerStarted','reviewRequired',
       'stuckProviderStarted','overduePending'
     ])
     or (v_health->>'reviewRequired')::integer < 2 then
    raise exception 'refund_health_invalid:%',v_health;
  end if;
end
$refund_state_machine$;

rollback;
