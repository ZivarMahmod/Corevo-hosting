-- 0120 runtime: passwordless portal credentials are private, replay-safe and
-- tenant/customer-bound. Run only against an isolated reset/test database.
begin;

do $security$
declare
  v_table text;
  v_rpc text;
  v_proc regprocedure;
  v_definition text;
begin
  foreach v_table in array array[
    'customer_portal_links',
    'customer_portal_sessions',
    'customer_booking_trusts',
    'customer_portal_challenges',
    'customer_portal_audit'
  ] loop
    if to_regclass('private.' || v_table) is null then
      raise exception 'portal_table_missing:%', v_table;
    end if;
    if has_table_privilege('anon', 'private.' || v_table, 'SELECT')
       or has_table_privilege('authenticated', 'private.' || v_table, 'SELECT')
       or has_table_privilege('service_role', 'private.' || v_table, 'SELECT') then
      raise exception 'portal_table_grant_invalid:%', v_table;
    end if;
  end loop;

  foreach v_rpc in array array[
    'set_customer_portal_mode',
    'customer_portal_mint_link',
    'customer_portal_exchange_link',
    'customer_portal_session_snapshot',
    'customer_portal_list_bookings',
    'customer_portal_get_booking',
    'customer_portal_cancel_booking',
    'customer_portal_update_name',
    'customer_portal_create_challenge',
    'customer_portal_record_challenge_delivery',
    'customer_portal_verify_challenge',
    'customer_portal_start_recovery',
    'customer_portal_record_recovery_delivery',
    'customer_portal_recovery_delivery_target',
    'customer_portal_prepare_recovery_delivery',
    'customer_portal_record_recovery_outbox_delivery',
    'customer_portal_recovery_outbox_candidates',
    'customer_portal_prepare_recovery_resend',
    'customer_portal_resend_recovery',
    'customer_portal_recovery_state',
    'customer_portal_verify_recovery_and_mint_session',
    'customer_portal_revoke_session',
    'customer_portal_revoke_other_sessions',
    'customer_portal_revoke_booking_trusts',
    'customer_portal_gdpr_scrub'
  ] loop
    select p.oid::regprocedure into v_proc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_rpc;
    if v_proc is null then
      raise exception 'portal_rpc_missing:%', v_rpc;
    end if;
    if has_function_privilege('anon', v_proc, 'EXECUTE')
       or has_function_privilege('authenticated', v_proc, 'EXECUTE')
       or not has_function_privilege('service_role', v_proc, 'EXECUTE') then
      raise exception 'portal_rpc_grant_invalid:%', v_rpc;
    end if;
    select pg_get_functiondef(v_proc) into v_definition;
    if v_definition not like '%SECURITY DEFINER%'
       or v_definition not like '%SET search_path TO ''''%' then
      raise exception 'portal_rpc_hardening_invalid:%', v_rpc;
    end if;
  end loop;

  select lower(pg_get_functiondef(
    'public.customer_portal_start_recovery(text,text,text,uuid,text,text,text,integer,timestamptz)'::regprocedure
  )) into v_definition;
  if strpos(v_definition, 'pg_advisory_xact_lock') = 0
     or strpos(v_definition, 'pg_advisory_xact_lock')
       > strpos(v_definition, 'update private.customer_portal_challenges') then
    raise exception 'portal_recovery_lock_order_invalid:start';
  end if;

  select lower(pg_get_functiondef(
    'public.customer_portal_resend_recovery(uuid,text,uuid,text,text,integer,timestamptz)'::regprocedure
  )) into v_definition;
  if strpos(v_definition, 'pg_advisory_xact_lock') = 0
     or strpos(v_definition, 'pg_advisory_xact_lock') > strpos(v_definition, 'for update') then
    raise exception 'portal_recovery_lock_order_invalid:resend';
  end if;
end
$security$;

do $runtime$
declare
  v_tenant_a uuid := gen_random_uuid();
  v_tenant_b uuid := gen_random_uuid();
  v_customer_a uuid := gen_random_uuid();
  v_customer_b uuid := gen_random_uuid();
  v_duplicate_customer uuid := gen_random_uuid();
  v_location_a uuid := gen_random_uuid();
  v_location_b uuid := gen_random_uuid();
  v_staff_a uuid := gen_random_uuid();
  v_staff_b uuid := gen_random_uuid();
  v_service_a uuid := gen_random_uuid();
  v_service_b uuid := gen_random_uuid();
  v_booking_a uuid := gen_random_uuid();
  v_booking_b uuid := gen_random_uuid();
  v_link uuid;
  v_link_expiry timestamptz;
  v_link_intent uuid;
  v_session uuid := gen_random_uuid();
  v_session_digest text := repeat('b', 64);
  v_result record;
  v_payload jsonb;
  v_count integer;
  v_i integer;
  v_recovery_public uuid;
  v_recovery_session uuid;
  v_failed_delivery_public uuid;
  v_resend_public uuid;
  v_resend_new_public uuid;
  v_generic_decoy_public uuid;
  v_decoy_public uuid;
  v_outbox_id uuid;
  v_lease_token uuid;
  v_generic_public uuid;
  v_generic_failed_public uuid;
  v_generic_locked_public uuid;
  v_mode_flow uuid := gen_random_uuid();
  v_mode_session_id uuid;
begin
  insert into public.tenants (id, slug, name, status) values
    (v_tenant_a, 'portal-test-a', 'Portal Test A', 'active'),
    (v_tenant_b, 'portal-test-b', 'Portal Test B', 'active');
  insert into public.tenant_settings (tenant_id, branding, settings) values
    (v_tenant_a, '{"logo_url":"https://cdn.corevo.se/portal-test-a.png"}'::jsonb,
     '{"customer_portal":{"mode":"passwordless_tenant"},"cancellation_cutoff_hours":24,"contact":{"phone":"+46700000001"},"map":{"lat":58.41,"lon":15.62,"q":"Testgatan 1"}}'::jsonb),
    (v_tenant_b, '{}'::jsonb,
     '{"customer_portal":{"mode":"passwordless_tenant"},"cancellation_cutoff_hours":24}'::jsonb);
  insert into public.tenant_domains (tenant_id, domain, is_primary, verified) values
    (v_tenant_a, 'portal-test-a.example', true, true);
  insert into public.customers (id, tenant_id, full_name, phone, email, status) values
    (v_customer_a, v_tenant_a, 'Portal A', '+46700000001', 'portal-a@example.test', 'active'),
    (v_customer_b, v_tenant_b, 'Portal B', '+46700000002', 'portal-b@example.test', 'active');
  insert into public.locations (id, tenant_id, name, address, timezone, is_primary) values
    (v_location_a, v_tenant_a, 'A', 'Testgatan 1', 'Europe/Stockholm', true),
    (v_location_b, v_tenant_b, 'B', null, 'Europe/Stockholm', true);
  insert into public.staff (id, tenant_id, location_id, title, active) values
    (v_staff_a, v_tenant_a, v_location_a, 'A', true),
    (v_staff_b, v_tenant_b, v_location_b, 'B', true);
  insert into public.services (
    id, tenant_id, location_id, name, duration_min, price_cents, active
  ) values
    (v_service_a, v_tenant_a, v_location_a, 'A', 30, 10000, true),
    (v_service_b, v_tenant_b, v_location_b, 'B', 30, 10000, true);
  insert into public.staff_services (tenant_id, staff_id, service_id) values
    (v_tenant_a, v_staff_a, v_service_a),
    (v_tenant_b, v_staff_b, v_service_b);
  insert into public.working_hours (
    tenant_id, staff_id, location_id, weekday, start_time, end_time
  )
  select v_tenant_a, v_staff_a, v_location_a, d, time '00:00', time '23:59'
  from generate_series(0, 6) d
  union all
  select v_tenant_b, v_staff_b, v_location_b, d, time '00:00', time '23:59'
  from generate_series(0, 6) d;
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values
    (v_booking_a, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
     date_trunc('hour', statement_timestamp()) + interval '3 days',
     date_trunc('hour', statement_timestamp()) + interval '3 days 30 minutes',
     'confirmed', 10000),
    (v_booking_b, v_tenant_b, v_location_b, v_staff_b, v_service_b, v_customer_b,
     date_trunc('hour', statement_timestamp()) + interval '4 days',
     date_trunc('hour', statement_timestamp()) + interval '4 days 30 minutes',
     'confirmed', 10000);

  -- Recovery may trust only a consumed + delivered Goal-74 challenge whose
  -- booking still points to the same tenant/customer.
  insert into private.booking_verification_challenges (
    tenant_id, staff_id, service_id, start_ts, session_token, channel,
    contact_digest, contact_masked, pin_digest, delivery_state,
    expires_at, consumed_at, booking_id
  ) values
    (v_tenant_a, v_staff_a, v_service_a, date_trunc('hour', statement_timestamp()) + interval '3 days',
     gen_random_uuid(), 'sms', repeat('a', 64), '+46 ••• •• 01', repeat('c', 64),
     'delivered', statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking_a),
    (v_tenant_b, v_staff_b, v_service_b, date_trunc('hour', statement_timestamp()) + interval '4 days',
     gen_random_uuid(), 'sms', repeat('b', 64), '+46 ••• •• 02', repeat('d', 64),
     'delivered', statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking_b);

  select r.id into v_link_intent
  from public.route_booking_notification(
    p_tenant => v_tenant_a,
    p_booking => v_booking_a,
    p_staff => v_staff_a,
    p_event_type => 'booking_confirmation',
    p_event_key => 'portal-link-confirmation:' || v_booking_a::text,
    p_category => 'transactional',
    p_type_opt_in => null,
    p_expected_statuses => array['confirmed']::text[],
    p_payload => pg_catalog.jsonb_build_object(
      'template', 'booking_confirmation', 'booking_id', v_booking_a
    )
  ) r;
  if v_link_intent is null then raise exception 'portal_link_intent_missing'; end if;

  select m.link_public_id, m.expires_at into v_link, v_link_expiry
  from public.customer_portal_mint_link(
    v_tenant_a, v_customer_a, 'booking_access', repeat('a', 64), 1,
    statement_timestamp() + interval '15 minutes', v_link_intent
  ) m;
  select * into v_result
  from public.customer_portal_mint_link(
    v_tenant_a, v_customer_a, 'booking_access', repeat('a', 64), 1,
    statement_timestamp() + interval '1 minute', v_link_intent
  );
  if v_result.link_public_id <> v_link or v_result.expires_at <> v_link_expiry
     or (select count(*) from private.customer_portal_links l
         where l.delivery_intent_id = v_link_intent and l.purpose = 'booking_access') <> 1
     or (select count(*) from private.customer_portal_audit a
         where a.entity_public_id = v_link and a.event_type = 'link_minted') <> 1 then
    raise exception 'portal_link_mint_not_idempotent';
  end if;
  begin
    perform public.customer_portal_mint_link(
      v_tenant_a, v_customer_a, 'booking_access', repeat('x', 64), 1,
      statement_timestamp() + interval '15 minutes', v_link_intent
    );
    raise exception 'portal_link_intent_mismatch_allowed';
  exception when sqlstate '22023' then
    null;
  end;

  update public.notifications_outbox set booking_id = null where id = v_link_intent;

  select * into v_result
  from public.customer_portal_exchange_link(
    v_link, repeat('a', 64), v_session, v_session_digest, 1
  );
  if v_result.outcome <> 'ok' or v_result.booking_id <> v_booking_a then
    raise exception 'portal_exchange_failed:%', row_to_json(v_result);
  end if;
  select * into v_result
  from public.customer_portal_exchange_link(
    v_link, repeat('a', 64), gen_random_uuid(), repeat('c', 64), 1,
    v_session, v_session_digest
  );
  if v_result.outcome <> 'ok'
     or v_result.session_public_id <> v_session
     or v_result.booking_id <> v_booking_a then
    raise exception 'portal_consumed_link_reopen_failed:%', row_to_json(v_result);
  end if;

  select * into v_result
  from public.customer_portal_session_snapshot(v_session, v_session_digest);
  if v_result.outcome <> 'ok'
     or v_result.snapshot ->> 'tenantSlug' <> 'portal-test-a'
     or v_result.snapshot ->> 'bookingOrigin' <> 'https://portal-test-a.example'
     or v_result.snapshot ->> 'logoUrl' <> 'https://cdn.corevo.se/portal-test-a.png'
     or v_result.snapshot ->> 'mapUrl' is null
     or v_result.snapshot ? 'tenantId'
     or v_result.snapshot ? 'customerId' then
    raise exception 'portal_snapshot_projection_invalid:%', v_result.snapshot;
  end if;

  -- Known and decoy starts both return one durable, PII-free outbox identity.
  -- The PIN is installed only after an exact-id lease and current-contact CAS.
  v_recovery_public := gen_random_uuid();
  select * into v_result from public.customer_portal_start_recovery(
    'portal-test-a', '+46700000001', repeat('a', 64), v_recovery_public,
    repeat('e', 64), repeat('f', 64), repeat('0', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'accepted' or not v_result.created or v_result.outbox_id is null then
    raise exception 'portal_recovery_known_start_invalid:%', row_to_json(v_result);
  end if;
  v_outbox_id := v_result.outbox_id;
  select count(*) into v_count from public.notifications_outbox o
  where o.id = v_outbox_id and o.customer_id is null and o.booking_id is null
    and o.event_type = 'customer_portal_recovery_code'
    and o.payload = pg_catalog.jsonb_build_object(
      'template', 'customer_portal_recovery_code', 'challenge_id', v_recovery_public
    )
    and o.payload::text not like '%+46700000001%';
  if v_count <> 1 then raise exception 'portal_recovery_outbox_payload_invalid'; end if;

  v_lease_token := gen_random_uuid();
  select * into v_result from public.claim_notification_outbox_by_id(
    v_outbox_id, v_lease_token, statement_timestamp(), 120
  );
  if not found or not public.begin_notification_delivery(v_outbox_id, v_lease_token) then
    raise exception 'portal_recovery_claim_failed';
  end if;
  select * into v_result from public.customer_portal_recovery_delivery_target(
    v_outbox_id, v_lease_token
  );
  if v_result.delivery_destination <> '+46700000001' then
    raise exception 'portal_recovery_target_invalid:%', row_to_json(v_result);
  end if;
  if public.customer_portal_prepare_recovery_delivery(
    v_outbox_id, v_lease_token, '+46700000001', repeat('f', 64), repeat('a', 64), repeat('a', 64)
  ) <> 'ready' then raise exception 'portal_recovery_prepare_failed'; end if;
  if public.customer_portal_record_recovery_outbox_delivery(
    v_outbox_id, v_lease_token, true
  ) <> 'ok' then raise exception 'portal_recovery_delivery_record_failed'; end if;
  perform public.ack_notification_outbox(
    v_outbox_id, v_lease_token, 'sent', 'test:recovery:1', null, null, null, null
  );
  select * into v_result from public.customer_portal_recovery_state(
    v_recovery_public, repeat('e', 64)
  );
  if v_result.outcome <> 'sent' or v_result.attempts_remaining <> 5 then
    raise exception 'portal_recovery_sent_state_invalid:%', row_to_json(v_result);
  end if;
  v_recovery_session := gen_random_uuid();
  select * into v_result from public.customer_portal_verify_recovery_and_mint_session(
    v_recovery_public, repeat('e', 64), repeat('a', 64),
    v_recovery_session, repeat('7', 64), 1
  );
  if v_result.outcome <> 'verified' or v_result.tenant_slug <> 'portal-test-a' then
    raise exception 'portal_recovery_verify_failed:%', row_to_json(v_result);
  end if;
  select count(*) into v_count from private.customer_portal_sessions ps
  where ps.public_id = v_recovery_session;
  if v_count <> 1 then raise exception 'portal_recovery_session_count:%', v_count; end if;
  select * into v_result from public.customer_portal_verify_recovery_and_mint_session(
    v_recovery_public, repeat('e', 64), repeat('a', 64),
    gen_random_uuid(), repeat('c', 64), 1
  );
  if v_result.outcome = 'verified' then raise exception 'portal_recovery_replay_minted'; end if;

  -- Provider failure stays publicly neutral and never mints a session.
  update private.customer_portal_challenges set created_at = statement_timestamp() - interval '1 minute'
  where public_id = v_recovery_public;
  v_failed_delivery_public := gen_random_uuid();
  select * into v_result from public.customer_portal_start_recovery(
    'portal-test-a', '+46700000001', repeat('a', 64), v_failed_delivery_public,
    repeat('1', 64), repeat('2', 64), repeat('0', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  v_outbox_id := v_result.outbox_id;
  v_lease_token := gen_random_uuid();
  perform public.claim_notification_outbox_by_id(v_outbox_id, v_lease_token, statement_timestamp(), 120);
  perform public.begin_notification_delivery(v_outbox_id, v_lease_token);
  if public.customer_portal_prepare_recovery_delivery(
    v_outbox_id, v_lease_token, '+46700000001', repeat('2', 64), repeat('a', 64), repeat('3', 64)
  ) <> 'ready' then raise exception 'portal_recovery_failed_prepare'; end if;
  perform public.customer_portal_record_recovery_outbox_delivery(v_outbox_id, v_lease_token, false);
  perform public.ack_notification_outbox(
    v_outbox_id, v_lease_token, 'failed', null, null, 'provider_rejected', null, null
  );
  select * into v_result from public.customer_portal_recovery_state(
    v_failed_delivery_public, repeat('1', 64)
  );
  if v_result.outcome <> 'sent' then raise exception 'portal_recovery_failure_enumerated'; end if;
  v_recovery_session := gen_random_uuid();
  select * into v_result from public.customer_portal_verify_recovery_and_mint_session(
    v_failed_delivery_public, repeat('1', 64), repeat('3', 64),
    v_recovery_session, repeat('4', 64), 1
  );
  if v_result.outcome <> 'invalid' then
    raise exception 'portal_recovery_failed_delivery_verified:%', row_to_json(v_result);
  end if;
  select count(*) into v_count from private.customer_portal_sessions ps where ps.public_id = v_recovery_session;
  if v_count <> 0 then raise exception 'portal_recovery_failed_delivery_session_created'; end if;

  -- Changing the contact revokes the open recovery challenge immediately.
  update private.customer_portal_challenges set created_at = statement_timestamp() - interval '1 minute'
  where public_id = v_failed_delivery_public;
  v_resend_public := gen_random_uuid();
  select * into v_result from public.customer_portal_start_recovery(
    'portal-test-a', '+46700000001', repeat('a', 64), v_resend_public,
    repeat('4', 64), repeat('5', 64), repeat('0', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  update private.customer_portal_challenges
  set resend_after = statement_timestamp() - interval '1 second'
  where public_id = v_resend_public;
  update public.customers set phone = '+46700000009' where id = v_customer_a;
  v_resend_new_public := gen_random_uuid();
  select * into v_result from public.customer_portal_resend_recovery(
    v_resend_public, repeat('4', 64), v_resend_new_public,
    repeat('7', 64), repeat('0', 64), 1, statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'invalid' or v_result.created or v_result.outbox_id is not null then
    raise exception 'portal_recovery_changed_contact_resend_invalid:%', row_to_json(v_result);
  end if;
  update public.customers set phone = '+46700000001' where id = v_customer_a;

  -- A missing customer/evidence match is queued identically, traverses the same
  -- lease/CAS path as a decoy, exposes the same state, and can never mint.
  v_decoy_public := gen_random_uuid();
  select * into v_result from public.customer_portal_start_recovery(
    'portal-test-a', '+46709999999', repeat('d', 64), v_decoy_public,
    repeat('a', 64), repeat('b', 64), repeat('0', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'accepted' or not v_result.created or v_result.outbox_id is null then
    raise exception 'portal_recovery_decoy_start_invalid:%', row_to_json(v_result);
  end if;
  v_outbox_id := v_result.outbox_id;
  v_lease_token := gen_random_uuid();
  perform public.claim_notification_outbox_by_id(v_outbox_id, v_lease_token, statement_timestamp(), 120);
  perform public.begin_notification_delivery(v_outbox_id, v_lease_token);
  select * into v_result from public.customer_portal_recovery_delivery_target(v_outbox_id, v_lease_token);
  if v_result.delivery_destination is not null then raise exception 'portal_recovery_decoy_recipient'; end if;
  if public.customer_portal_prepare_recovery_delivery(
    v_outbox_id, v_lease_token, null, null, null, repeat('c', 64)
  ) <> 'decoy' then raise exception 'portal_recovery_decoy_prepare_invalid'; end if;
  perform public.customer_portal_record_recovery_outbox_delivery(v_outbox_id, v_lease_token, false);
  select * into v_result from public.customer_portal_recovery_state(v_decoy_public, repeat('a', 64));
  if v_result.outcome <> 'sent' then raise exception 'portal_recovery_decoy_enumerated'; end if;
  select * into v_result from public.customer_portal_verify_recovery_and_mint_session(
    v_decoy_public, repeat('a', 64), repeat('c', 64), gen_random_uuid(), repeat('d', 64), 1
  );
  if v_result.outcome <> 'invalid' then raise exception 'portal_recovery_decoy_verified'; end if;

  -- Tenant B evidence never authenticates through tenant A; public shape stays identical.
  v_decoy_public := gen_random_uuid();
  select * into v_result from public.customer_portal_start_recovery(
    'portal-test-a', '+46700000002', repeat('b', 64), v_decoy_public,
    repeat('d', 64), repeat('e', 64), repeat('0', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'accepted' or not v_result.created or v_result.outbox_id is null then
    raise exception 'portal_recovery_cross_tenant_shape';
  end if;
  if exists (select 1 from private.customer_portal_challenges pc
    where pc.public_id = v_decoy_public and pc.customer_id is not null) then
    raise exception 'portal_recovery_cross_tenant_match';
  end if;

  -- Active contacts are unique per tenant, so an ambiguous recovery identity
  -- cannot be created in the first place.
  begin
    insert into public.customers (id, tenant_id, full_name, phone, status) values
      (v_duplicate_customer, v_tenant_a, 'Portal A duplicate', '+46700000001', 'active');
    raise exception 'portal_duplicate_contact_created';
  exception when unique_violation then
    if sqlerrm <> 'customer_contact_conflict' then raise; end if;
  end;
  if exists (select 1 from public.customers where id = v_duplicate_customer) then
    raise exception 'portal_duplicate_contact_persisted';
  end if;

  -- Generic challenges are contact-change-only; recovery has its dedicated lifecycle.
  v_generic_decoy_public := gen_random_uuid();
  select * into v_result from public.customer_portal_create_challenge(
    v_tenant_a, v_customer_a, v_generic_decoy_public, 'recovery', 'sms',
    repeat('a', 64), repeat('b', 64), repeat('c', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'accepted'
     or v_result.should_deliver is distinct from false
     or exists (select 1 from private.customer_portal_challenges pc
       where pc.public_id = v_generic_decoy_public) then
    raise exception 'portal_generic_recovery_purpose_created:%', row_to_json(v_result);
  end if;

  -- Generic contact-change challenges require a service-only delivery CAS.
  v_generic_public := gen_random_uuid();
  perform public.customer_portal_create_challenge(
    v_tenant_a, v_customer_a, v_generic_public, 'contact_change', 'sms',
    repeat('1', 64), repeat('2', 64), repeat('3', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if public.customer_portal_record_challenge_delivery(
    v_generic_public, repeat('1', 64), true
  ) <> 'ok' then raise exception 'portal_generic_delivery_success_cas'; end if;
  if public.customer_portal_record_challenge_delivery(
    v_generic_public, repeat('1', 64), true
  ) <> 'invalid' then raise exception 'portal_generic_delivery_replay_allowed'; end if;
  select * into v_result from public.customer_portal_verify_challenge(
    v_generic_public, repeat('1', 64), repeat('3', 64)
  );
  if v_result.outcome <> 'verified' then raise exception 'portal_generic_verify_failed'; end if;
  select * into v_result from public.customer_portal_verify_challenge(
    v_generic_public, repeat('1', 64), repeat('3', 64)
  );
  if v_result.outcome <> 'invalid' then raise exception 'portal_generic_replay_allowed'; end if;

  v_generic_failed_public := gen_random_uuid();
  perform public.customer_portal_create_challenge(
    v_tenant_a, v_customer_a, v_generic_failed_public, 'contact_change', 'sms',
    repeat('4', 64), repeat('5', 64), repeat('6', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  perform public.customer_portal_record_challenge_delivery(
    v_generic_failed_public, repeat('4', 64), false
  );
  if public.customer_portal_record_challenge_delivery(
    v_generic_failed_public, repeat('4', 64), false
  ) <> 'invalid' then raise exception 'portal_generic_failed_delivery_replay_allowed'; end if;
  select * into v_result from public.customer_portal_verify_challenge(
    v_generic_failed_public, repeat('4', 64), repeat('6', 64)
  );
  if v_result.outcome <> 'invalid' then raise exception 'portal_generic_failed_delivery_verified'; end if;

  v_generic_locked_public := gen_random_uuid();
  perform public.customer_portal_create_challenge(
    v_tenant_a, v_customer_a, v_generic_locked_public, 'contact_change', 'sms',
    repeat('7', 64), repeat('8', 64), repeat('9', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  perform public.customer_portal_record_challenge_delivery(
    v_generic_locked_public, repeat('7', 64), true
  );
  for v_i in 1..5 loop
    select * into v_result from public.customer_portal_verify_challenge(
      v_generic_locked_public, repeat('7', 64), repeat('0', 64)
    );
  end loop;
  if v_result.outcome <> 'invalid' or v_result.attempts_remaining <> 0
     or not exists (select 1 from private.customer_portal_challenges c
       where c.public_id = v_generic_locked_public and c.attempt_count = 5 and c.revoked_at is not null) then
    raise exception 'portal_generic_fifth_attempt_not_locked:%', row_to_json(v_result);
  end if;

  perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  for v_i in 1..20 loop
    insert into public.bookings (
      id, tenant_id, location_id, staff_id, service_id, customer_id,
      start_ts, end_ts, status, price_cents
    ) values (
      gen_random_uuid(), v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
      date_trunc('hour', statement_timestamp()) - pg_catalog.make_interval(days => v_i),
      date_trunc('hour', statement_timestamp()) - pg_catalog.make_interval(days => v_i)
        + interval '30 minutes',
      'completed', 10000
    );
  end loop;
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  select r.id into v_link_intent
  from public.route_booking_notification(
    p_tenant => v_tenant_a,
    p_booking => v_booking_a,
    p_staff => v_staff_a,
    p_event_type => 'booking_reminder',
    p_event_key => 'portal-link-reminder:' || v_booking_a::text,
    p_category => 'transactional',
    p_type_opt_in => 'reminders',
    p_expected_statuses => array['confirmed']::text[],
    p_payload => pg_catalog.jsonb_build_object(
      'template', 'booking_reminder', 'booking_id', v_booking_a
    )
  ) r;
  if v_link_intent is null then raise exception 'portal_reauth_intent_missing'; end if;

  select m.link_public_id into v_link
  from public.customer_portal_mint_link(
    v_tenant_a, v_customer_a, 'booking_access', repeat('f', 64), 1,
    statement_timestamp() + interval '15 minutes', v_link_intent
  ) m;
  v_session := gen_random_uuid();
  v_session_digest := repeat('9', 64);
  select * into v_result
  from public.customer_portal_exchange_link(
    v_link, repeat('f', 64), v_session, v_session_digest, 1
  );
  if v_result.outcome <> 'ok' or v_result.booking_id <> v_booking_a then
    raise exception 'portal_reauthentication_failed:%', row_to_json(v_result);
  end if;

  select public.customer_portal_list_bookings(
    v_session, v_session_digest, 'history', null, null, 20
  ) into v_payload;
  if pg_catalog.jsonb_array_length(v_payload -> 'items') <> 20
     or (v_payload ->> 'hasMore')::boolean
     or v_payload -> 'nextCursor' <> 'null'::jsonb then
    raise exception 'portal_exact_page_pagination_invalid:%', v_payload;
  end if;

  perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values (
    gen_random_uuid(), v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
    date_trunc('hour', statement_timestamp()) - interval '30 minutes',
    date_trunc('hour', statement_timestamp()),
    'completed', 10000
  );
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  select public.customer_portal_list_bookings(
    v_session, v_session_digest, 'history', null, null, 20
  ) into v_payload;
  if pg_catalog.jsonb_array_length(v_payload -> 'items') <> 20
     or not (v_payload ->> 'hasMore')::boolean
     or v_payload -> 'nextCursor' = 'null'::jsonb
     or v_payload #>> '{items,0,status}' <> 'completed' then
    raise exception 'portal_history_cursor_invalid:%', v_payload;
  end if;

  select public.customer_portal_list_bookings(
    v_session, v_session_digest, 'upcoming', null, null, 20
  ) into v_payload;
  if v_payload::text like '%completed%' then
    raise exception 'portal_history_status_leaked_into_upcoming';
  end if;

  select public.customer_portal_get_booking(
    v_session, v_session_digest, v_booking_a
  ) into v_payload;
  if v_payload #>> '{booking,publicRebookUrl}'
       <> ('https://portal-test-a.example/boka?plats=' || v_location_a::text
           || '&tjanst=' || v_service_a::text)
     or not (v_payload #>> '{booking,canCancel}')::boolean
     or v_payload #>> '{booking,durationMinutes}' <> '30'
     or v_payload #>> '{booking,location,timezone}' <> 'Europe/Stockholm'
     or v_payload #> '{booking,location,phone}' <> 'null'::jsonb
     or v_payload #> '{booking,location,mapUrl}' <> 'null'::jsonb then
    raise exception 'portal_booking_projection_invalid:%', v_payload;
  end if;

  select * into v_result
  from public.customer_portal_exchange_link(
    v_link, repeat('f', 64), gen_random_uuid(), repeat('c', 64), 1
  );
  if v_result.outcome <> 'invalid' then raise exception 'portal_link_replay_allowed'; end if;

  select public.customer_portal_get_booking(
    v_session, v_session_digest, v_booking_b
  ) into v_payload;
  if v_payload ->> 'outcome' <> 'not_found' then
    raise exception 'portal_cross_tenant_booking_leaked';
  end if;

  select * into v_result
  from public.customer_portal_cancel_booking(
    v_session, v_session_digest, v_booking_a, 24, repeat('i', 32)
  );
  if v_result.outcome <> 'cancelled' then raise exception 'portal_cancel_failed'; end if;

  select * into v_result
  from public.customer_portal_cancel_booking(
    v_session, v_session_digest, v_booking_a, 24, repeat('i', 32)
  );
  if v_result.outcome <> 'cancelled' then raise exception 'portal_cancel_not_idempotent'; end if;

  select count(*) into v_count
  from public.notifications_outbox o
  where o.tenant_id = v_tenant_a
    and o.event_type = 'booking_cancelled'
    and o.event_key = 'booking:' || v_booking_a::text || ':cancelled';
  if v_count <> 1 then raise exception 'portal_cancel_event_count:%', v_count; end if;

  update public.tenant_settings ts
  set settings = pg_catalog.jsonb_set(
    ts.settings, '{customer_portal,mode}', '"unknown_mode"'::jsonb, true
  )
  where ts.tenant_id = v_tenant_b;
  begin
    perform public.customer_portal_mint_link(
      v_tenant_b, v_customer_b, 'booking_access', repeat('z', 64), 1,
      statement_timestamp() + interval '15 minutes', gen_random_uuid()
    );
    raise exception 'portal_unknown_mode_did_not_fail_closed';
  exception when sqlstate '22023' then
    null;
  end;

  -- The canonical setter creates the missing nested object and revokes every
  -- passwordless credential kind. Re-enabling must not resurrect any of them.
  update public.tenant_settings set settings = '{}'::jsonb where tenant_id = v_tenant_b;
  select * into v_result from public.set_customer_portal_mode(
    v_tenant_b, 'passwordless_tenant'
  );
  if v_result.mode <> 'passwordless_tenant'
     or (select settings #>> '{customer_portal,mode}' from public.tenant_settings
         where tenant_id = v_tenant_b) <> 'passwordless_tenant' then
    raise exception 'portal_mode_nested_write_failed';
  end if;

  select m.link_public_id into v_link
  from public.customer_portal_mint_link(
    v_tenant_b, v_customer_b, 'recovery', repeat('t', 64), 1,
    statement_timestamp() + interval '15 minutes', null
  ) m;
  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (
    gen_random_uuid(), v_tenant_b, v_customer_b, repeat('u', 64), 1,
    statement_timestamp() + interval '1 day', statement_timestamp() + interval '7 days'
  ) returning id into v_mode_session_id;
  insert into private.customer_booking_trusts (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (
    gen_random_uuid(), v_tenant_b, v_customer_b, repeat('v', 64), 1,
    statement_timestamp() + interval '1 day', statement_timestamp() + interval '7 days'
  );
  insert into private.customer_portal_challenges (
    public_id, tenant_id, customer_id, purpose, channel,
    subject_digest, contact_digest, code_digest, key_version, expires_at
  ) values (
    gen_random_uuid(), v_tenant_b, v_customer_b, 'recovery', 'sms',
    repeat('w', 64), repeat('x', 64), repeat('y', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  insert into private.customer_portal_verified_contacts (
    tenant_id, customer_id, channel, contact_digest, contact_masked,
    source_flow_public_id
  ) values (
    v_tenant_b, v_customer_b, 'sms', repeat('a', 64), '+46 ••• •• 02',
    v_mode_flow
  );
  insert into private.customer_portal_contact_change_flows (
    public_id, tenant_id, customer_id, session_id, subject_digest,
    key_version, action, current_channel, current_contact_digest,
    current_contact_masked, current_code_digest, current_expires_at,
    current_resend_after, flow_expires_at, new_destination
  ) values (
    v_mode_flow, v_tenant_b, v_customer_b, v_mode_session_id, repeat('b', 64),
    1, 'change_phone', 'sms', repeat('a', 64), '+46 ••• •• 02',
    repeat('c', 64), statement_timestamp() + interval '5 minutes',
    statement_timestamp() + interval '30 seconds',
    statement_timestamp() + interval '10 minutes', '+46700000003'
  );

  select * into v_result from public.set_customer_portal_mode(v_tenant_b, 'off');
  if v_result.mode <> 'off'
     or (select settings #>> '{customer_portal,mode}' from public.tenant_settings
         where tenant_id = v_tenant_b) <> 'off'
     or exists (select 1 from private.customer_portal_links
                where tenant_id = v_tenant_b and revoked_at is null and consumed_at is null)
     or exists (select 1 from private.customer_portal_sessions
                where tenant_id = v_tenant_b and revoked_at is null)
     or exists (select 1 from private.customer_booking_trusts
                where tenant_id = v_tenant_b and revoked_at is null)
     or exists (select 1 from private.customer_portal_challenges
                where tenant_id = v_tenant_b and revoked_at is null and consumed_at is null)
     or exists (select 1 from private.customer_portal_verified_contacts
                where tenant_id = v_tenant_b and revoked_at is null)
     or exists (select 1 from private.customer_portal_contact_change_flows
                where tenant_id = v_tenant_b
                  and (revoked_at is null or new_destination is not null)) then
    raise exception 'portal_mode_revocation_failed';
  end if;
  perform public.set_customer_portal_mode(v_tenant_b, 'passwordless_tenant');
  select * into v_result from public.customer_portal_exchange_link(
    v_link, repeat('t', 64), gen_random_uuid(), repeat('z', 64), 1
  );
  if v_result.outcome <> 'invalid' then raise exception 'portal_mode_credential_resurrected'; end if;

  -- A credential statement that predates the current mode generation cannot
  -- become active after a completed off/on cutover.
  update public.tenant_settings ts
  set settings = pg_catalog.jsonb_set(
    ts.settings,
    '{customer_portal,mode_changed_at}',
    pg_catalog.to_jsonb(statement_timestamp() + interval '1 minute'),
    true
  )
  where ts.tenant_id = v_tenant_b;
  begin
    insert into private.customer_portal_sessions (
      public_id, tenant_id, customer_id, secret_digest, key_version,
      idle_expires_at, absolute_expires_at
    ) values (
      gen_random_uuid(), v_tenant_b, v_customer_b, repeat('d', 64), 1,
      statement_timestamp() + interval '1 day', statement_timestamp() + interval '7 days'
    );
    raise exception 'portal_mode_generation_fence_missing';
  exception when sqlstate '55000' then
    null;
  end;

  -- A correctly digested expired session exposes only the tenant slug needed
  -- for recovery. A wrong digest exposes no slug and neither path returns PII.
  update private.customer_portal_sessions ps
  set created_at = statement_timestamp() - interval '2 seconds',
      idle_expires_at = statement_timestamp() - interval '1 second'
  where ps.public_id = v_session;
  select * into v_result
  from public.customer_portal_session_snapshot(v_session, v_session_digest);
  if v_result.outcome <> 'expired' or v_result.snapshot is not null
     or v_result.recovery_tenant_slug <> 'portal-test-a' then
    raise exception 'portal_expired_snapshot_recovery_slug_invalid:%', row_to_json(v_result);
  end if;
  select * into v_result
  from public.customer_portal_session_snapshot(v_session, repeat('f', 64));
  if v_result.outcome <> 'expired' or v_result.snapshot is not null
     or v_result.recovery_tenant_slug is not null then
    raise exception 'portal_wrong_digest_recovery_slug_leaked:%', row_to_json(v_result);
  end if;

  perform public.customer_portal_gdpr_scrub(v_tenant_a, v_customer_a);
  if exists (
    select 1 from private.customer_portal_resolve_session(
      v_session, v_session_digest, statement_timestamp()
    )
  ) then
    raise exception 'portal_gdpr_session_survived';
  end if;
end
$runtime$;

rollback;
