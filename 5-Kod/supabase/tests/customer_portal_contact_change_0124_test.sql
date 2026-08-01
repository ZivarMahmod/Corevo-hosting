-- 0124 runtime: contact changes require both delivered proofs and finalize atomically.
-- Run only against an isolated reset/test database after migration 0124.
begin;

do $contact_change$
declare
  v_tenant uuid := gen_random_uuid();
  v_other_tenant uuid := gen_random_uuid();
  v_customer uuid := gen_random_uuid();
  v_other_customer uuid := gen_random_uuid();
  v_cross_tenant_customer uuid := gen_random_uuid();
  v_location uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_booking uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_other_session uuid := gen_random_uuid();
  v_flow uuid := gen_random_uuid();
  v_restart_flow uuid := gen_random_uuid();
  v_locked_flow uuid := gen_random_uuid();
  v_locked_restart_flow uuid := gen_random_uuid();
  v_revoked_flow uuid := gen_random_uuid();
  v_expired_flow uuid := gen_random_uuid();
  v_new_session uuid := v_flow;
  v_trust uuid := gen_random_uuid();
  v_link uuid := gen_random_uuid();
  v_challenge uuid := gen_random_uuid();
  v_result record;
  v_text text;
  v_count integer;
begin
  insert into public.tenants (id, slug, name, status) values
    (v_tenant, 'contact-change-test', 'Contact Test', 'active'),
    (v_other_tenant, 'contact-change-cross', 'Cross Tenant', 'active');
  insert into public.tenant_settings (tenant_id, branding, settings) values
    (v_tenant, '{}'::jsonb, '{"customer_portal":{"mode":"passwordless_tenant"}}'::jsonb),
    (v_other_tenant, '{}'::jsonb, '{"customer_portal":{"mode":"passwordless_tenant"}}'::jsonb);
  insert into public.customers (id, tenant_id, full_name, email, phone, status) values
    (v_customer, v_tenant, 'Kontakt Kund', 'kund@example.se', '+46700000001', 'active'),
    (v_other_customer, v_tenant, 'Annan Kund', 'annan@example.se', '+46700000002', 'active'),
    (v_cross_tenant_customer, v_other_tenant, 'Cross Kund', 'cross@example.se', '+46700000009', 'active');
  insert into public.locations (id, tenant_id, name, timezone, is_primary)
  values (v_location, v_tenant, 'Test', 'Europe/Stockholm', true);
  insert into public.staff (id, tenant_id, location_id, title, active)
  values (v_staff, v_tenant, v_location, 'Testare', true);
  insert into public.services (id, tenant_id, location_id, name, duration_min, price_cents, active)
  values (v_service, v_tenant, v_location, 'Test', 30, 10000, true);
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values (
    v_booking, v_tenant, v_location, v_staff, v_service, v_customer,
    statement_timestamp() + interval '2 days', statement_timestamp() + interval '2 days 30 minutes',
    'confirmed', 10000
  );
  insert into private.booking_verification_challenges (
    tenant_id, staff_id, service_id, start_ts, session_token, channel,
    contact_digest, contact_masked, pin_digest, delivery_state,
    expires_at, consumed_at, booking_id
  ) values (
    v_tenant, v_staff, v_service, statement_timestamp() + interval '2 days', gen_random_uuid(),
    'sms', repeat('a', 64), '+46 ••• •• 01', repeat('1', 64), 'delivered',
    statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking
  );
  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at, device_label
  ) values
    (v_session, v_tenant, v_customer, repeat('e', 64), 1,
     statement_timestamp() + interval '180 days', statement_timestamp() + interval '365 days', 'Current'),
    (v_other_session, v_tenant, v_customer, repeat('f', 64), 1,
     statement_timestamp() + interval '180 days', statement_timestamp() + interval '365 days', 'Other');

  select * into v_result from public.customer_portal_start_contact_change(
    v_session, repeat('e', 64), 'change_phone', v_flow, repeat('2', 64),
    repeat('a', 64), '+46700000001', '+46 ••• •• 01', repeat('c', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'ready' or v_result.delivery_destination <> '+46700000001' then
    raise exception 'contact_change_start_invalid';
  end if;

  select * into v_result from public.customer_portal_verify_contact_change_current(
    v_other_session, repeat('f', 64), v_flow, repeat('2', 64), repeat('c', 64)
  );
  if v_result.outcome <> 'expired' then raise exception 'contact_change_wrong_session_invalid'; end if;

  select * into v_result from public.customer_portal_verify_contact_change_current(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('c', 64)
  );
  if v_result.outcome <> 'invalid' then
    raise exception 'contact_change_current_undelivered_invalid';
  end if;

  v_text := public.customer_portal_record_contact_change_delivery(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), 'current', repeat('c', 64), true
  );
  if v_text <> 'ok' then raise exception 'contact_change_current_delivery_record_invalid'; end if;
  select * into v_result from public.customer_portal_resend_contact_change(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), 'current',
    repeat('5', 64), repeat('a', 64), '+46700000001',
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'cooldown' then raise exception 'contact_change_resend_cooldown_invalid'; end if;

  -- Four failed proofs must consume this session's shared active-window budget.
  -- Starting a replacement flow must not reset those attempts.
  for v_count in 1..4 loop
    select * into v_result from public.customer_portal_verify_contact_change_current(
      v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('0', 64)
    );
    if v_result.outcome <> 'invalid' or v_result.attempts_remaining <> 5 - v_count then
      raise exception 'contact_change_attempt_budget_invalid';
    end if;
  end loop;
  select * into v_result from public.customer_portal_start_contact_change(
    v_session, repeat('e', 64), 'change_phone', v_restart_flow, repeat('4', 64),
    repeat('a', 64), '+46700000001', '+46 ••• •• 01', repeat('5', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'max_attempts' then
    raise exception 'contact_change_attempt_budget_reset_invalid';
  end if;
  select * into v_result from public.customer_portal_verify_contact_change_current(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('c', 64)
  );
  if v_result.outcome <> 'verified' then raise exception 'contact_change_current_proof_invalid'; end if;

  -- A fifth failed proof locks the whole flow for the remaining active window.
  select * into v_result from public.customer_portal_start_contact_change(
    v_other_session, repeat('f', 64), 'change_phone', v_locked_flow, repeat('8', 64),
    repeat('a', 64), '+46700000001', '+46 ••• •• 01', repeat('9', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'ready' then raise exception 'contact_change_lock_setup_invalid'; end if;
  if public.customer_portal_record_contact_change_delivery(
    v_other_session, repeat('f', 64), v_locked_flow, repeat('8', 64),
    'current', repeat('9', 64), true
  ) <> 'ok' then raise exception 'contact_change_lock_delivery_invalid'; end if;
  for v_count in 1..5 loop
    select * into v_result from public.customer_portal_verify_contact_change_current(
      v_other_session, repeat('f', 64), v_locked_flow, repeat('8', 64), repeat('0', 64)
    );
    if v_result.outcome <> case when v_count = 5 then 'max_attempts' else 'invalid' end
       or v_result.attempts_remaining <> 5 - v_count then
      raise exception 'contact_change_five_error_lock_invalid';
    end if;
  end loop;
  select * into v_result from public.customer_portal_resend_contact_change(
    v_other_session, repeat('f', 64), v_locked_flow, repeat('8', 64), 'current',
    repeat('a', 64), repeat('a', 64), '+46700000001',
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'max_attempts' then raise exception 'contact_change_locked_resend_invalid'; end if;
  select * into v_result from public.customer_portal_start_contact_change(
    v_other_session, repeat('f', 64), 'change_phone', v_locked_restart_flow, repeat('b', 64),
    repeat('a', 64), '+46700000001', '+46 ••• •• 01', repeat('c', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'max_attempts' then raise exception 'contact_change_locked_restart_invalid'; end if;

  select * into v_result from public.customer_portal_prepare_contact_change_destination(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('a', 64),
    '+46700000001', '+46700000001', 'sms',
    repeat('3', 64), repeat('a', 64), '+46 ••• •• 01', repeat('d', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'same' then raise exception 'contact_change_same_destination_invalid'; end if;

  -- Same normalized contact in another tenant is deliberately not a conflict.
  select * into v_result from public.customer_portal_prepare_contact_change_destination(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('a', 64),
    '+46700000001', '+46700000009', 'sms',
    repeat('3', 64), repeat('b', 64), '+46 ••• •• 09', repeat('d', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if v_result.outcome <> 'ready' then
    raise exception 'contact_change_cross_tenant_conflict_invalid';
  end if;

  select * into v_result from public.customer_portal_finalize_contact_change(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('d', 64),
    repeat('a', 64), '+46700000001', v_new_session, repeat('9', 64), 1
  );
  if v_result.outcome <> 'invalid' then raise exception 'contact_change_new_undelivered_invalid'; end if;

  insert into private.customer_booking_trusts (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (
    v_trust, v_tenant, v_customer, repeat('7', 64), 1,
    statement_timestamp() + interval '30 days', statement_timestamp() + interval '60 days'
  );
  insert into private.customer_portal_links (
    public_id, tenant_id, customer_id, purpose, token_digest, key_version, expires_at
  ) values (
    v_link, v_tenant, v_customer, 'booking_access', repeat('6', 64), 1,
    statement_timestamp() + interval '30 minutes'
  );
  insert into private.customer_portal_challenges (
    public_id, tenant_id, customer_id, purpose, channel,
    subject_digest, contact_digest, code_digest, key_version, expires_at
  ) values (
    v_challenge, v_tenant, v_customer, 'contact_change', 'sms',
    repeat('5', 64), repeat('4', 64), repeat('3', 64), 1,
    statement_timestamp() + interval '5 minutes'
  );
  if public.customer_portal_record_contact_change_delivery(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), 'new', repeat('c', 64), true
  ) <> 'invalid' then raise exception 'contact_change_stale_delivery_ack_invalid'; end if;
  if public.customer_portal_record_contact_change_delivery(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), 'new', repeat('d', 64), true
  ) <> 'ok' then raise exception 'contact_change_new_delivery_record_invalid'; end if;

  -- Force a late unique violation after contact/binding/revocation writes. The
  -- function statement must roll every visible change back atomically.
  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at, device_label
  ) values (
    v_new_session, v_other_tenant, v_cross_tenant_customer, repeat('8', 64), 1,
    statement_timestamp() + interval '180 days', statement_timestamp() + interval '365 days',
    'Collision'
  );
  begin
    select * into v_result from public.customer_portal_finalize_contact_change(
      v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('d', 64),
      repeat('a', 64), '+46700000001', v_new_session, repeat('9', 64), 1
    );
    raise exception 'contact_change_forced_rollback_missing';
  exception when unique_violation then
    null;
  end;
  select c.phone into v_text from public.customers c where c.id = v_customer;
  if v_text <> '+46700000001' then raise exception 'contact_change_forced_rollback_customer_invalid'; end if;
  if exists (
    select 1 from private.customer_portal_verified_contacts vc
    where vc.tenant_id = v_tenant and vc.customer_id = v_customer
      and vc.channel = 'sms' and vc.contact_digest = repeat('b', 64)
  ) then raise exception 'contact_change_forced_rollback_binding_invalid'; end if;
  if not exists (
    select 1 from private.customer_portal_sessions s
    where s.public_id = v_other_session and s.revoked_at is null
  ) then raise exception 'contact_change_forced_rollback_session_invalid'; end if;
  if exists (
    select 1 from private.customer_portal_contact_change_flows f
    where f.public_id = v_flow and f.completed_at is not null
  ) then raise exception 'contact_change_forced_rollback_flow_invalid'; end if;
  delete from private.customer_portal_sessions s
  where s.public_id = v_new_session and s.tenant_id = v_other_tenant;

  select * into v_result from public.customer_portal_finalize_contact_change(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('d', 64),
    repeat('a', 64), '+46700000001', v_new_session, repeat('9', 64), 1
  );
  if v_result.outcome <> 'completed' or v_result.action <> 'change_phone' then
    raise exception 'contact_change_atomic_rollback_invalid';
  end if;
  select c.phone into v_text from public.customers c where c.id = v_customer;
  if v_text <> '+46700000009' then raise exception 'contact_change_customer_not_updated'; end if;
  select c.contact_hash into v_text from public.customers c where c.id = v_customer;
  if v_text is distinct from public.customer_contact_hash(
    v_tenant, 'kund@example.se', '+46700000009'
  ) then raise exception 'contact_change_contact_hash_not_updated'; end if;
  select pg_catalog.count(*) into v_count from private.customer_portal_verified_contacts vc
  where vc.tenant_id = v_tenant and vc.customer_id = v_customer
    and vc.channel = 'sms' and vc.contact_digest = repeat('b', 64);
  if v_count <> 1 then raise exception 'contact_change_verified_binding_missing'; end if;
  if exists (select 1 from private.customer_portal_sessions s where s.public_id = v_other_session and s.revoked_at is null) then
    raise exception 'contact_change_other_sessions_not_revoked';
  end if;
  if exists (select 1 from private.customer_booking_trusts t where t.public_id = v_trust and t.revoked_at is null) then
    raise exception 'contact_change_trusts_not_revoked';
  end if;
  if exists (select 1 from private.customer_portal_links l where l.public_id = v_link and l.revoked_at is null) then
    raise exception 'contact_change_old_links_not_revoked';
  end if;
  if exists (select 1 from private.customer_portal_challenges c where c.public_id = v_challenge and c.revoked_at is null) then
    raise exception 'contact_change_old_challenges_not_revoked';
  end if;

  -- Deterministic rotation makes concurrent/replayed callers converge on one winner.
  select * into v_result from public.customer_portal_finalize_contact_change(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('d', 64),
    repeat('a', 64), '+46700000001', v_new_session, repeat('9', 64), 1
  );
  if v_result.outcome <> 'completed' then raise exception 'contact_change_replay_idempotent_invalid'; end if;
  select * into v_result from public.customer_portal_finalize_contact_change(
    v_new_session, repeat('9', 64), v_flow, repeat('2', 64), repeat('d', 64),
    repeat('a', 64), '+46700000001', v_new_session, repeat('9', 64), 1
  );
  if v_result.outcome <> 'expired' then raise exception 'contact_change_replay_wrong_session_invalid'; end if;
  update private.customer_portal_contact_change_flows
  set completed_at = statement_timestamp() - interval '16 minutes'
  where public_id = v_flow;
  select * into v_result from public.customer_portal_finalize_contact_change(
    v_session, repeat('e', 64), v_flow, repeat('2', 64), repeat('d', 64),
    repeat('a', 64), '+46700000001', v_new_session, repeat('9', 64), 1
  );
  if v_result.outcome <> 'expired' then raise exception 'contact_change_replay_stale_invalid'; end if;
  update private.customer_portal_contact_change_flows
  set completed_at = statement_timestamp()
  where public_id = v_flow;
  select pg_catalog.count(*) into v_count from private.customer_portal_sessions s
  where s.public_id = v_new_session and s.revoked_at is null;
  if v_count <> 1 then raise exception 'contact_change_concurrent_winner_invalid'; end if;
  select pg_catalog.count(*) into v_count from private.customer_portal_audit a
  where a.tenant_id = v_tenant and a.customer_id = v_customer
    and a.event_type = 'contact_changed'
    and (a.metadata::text ~* '(phone|email|destination|46700000009)');
  if v_count <> 0 then raise exception 'contact_change_audit_contains_pii'; end if;

  -- The public service-only sweep is the scheduler-safe privacy fallback even
  -- when pg_cron is absent. It must scrub all three terminal conditions.
  update private.customer_portal_contact_change_flows
  set new_destination = '+46700000009'
  where public_id = v_flow;
  perform public.sweep_customer_portal_contact_changes(statement_timestamp());
  if exists (
    select 1 from private.customer_portal_contact_change_flows f
    where f.public_id = v_flow and f.new_destination is not null
  ) then raise exception 'contact_change_completed_destination_not_scrubbed'; end if;

  insert into private.customer_portal_contact_change_flows (
    public_id, tenant_id, customer_id, session_id, subject_digest, key_version,
    action, current_channel, current_contact_digest, current_contact_masked,
    current_code_digest, current_expires_at, current_resend_after, flow_expires_at,
    new_destination, revoked_at
  ) values (
    v_revoked_flow, v_tenant, v_customer,
    (select id from private.customer_portal_sessions where public_id = v_session), repeat('4', 64), 1,
    'change_phone', 'sms', repeat('a', 64), '+46 ••• •• 01',
    repeat('5', 64), statement_timestamp() + interval '5 minutes',
    statement_timestamp() + interval '30 seconds', statement_timestamp() + interval '10 minutes',
    '+46700000010', statement_timestamp()
  );
  insert into private.customer_portal_contact_change_flows (
    public_id, tenant_id, customer_id, session_id, subject_digest, key_version,
    action, current_channel, current_contact_digest, current_contact_masked,
    current_code_digest, current_expires_at, current_resend_after, flow_expires_at,
    new_destination, created_at, updated_at
  ) values (
    v_expired_flow, v_tenant, v_customer,
    (select id from private.customer_portal_sessions where public_id = v_session), repeat('6', 64), 1,
    'change_phone', 'sms', repeat('a', 64), '+46 ••• •• 01',
    repeat('7', 64), statement_timestamp() - interval '9 minutes',
    statement_timestamp() - interval '9 minutes', statement_timestamp() - interval '1 second',
    '+46700000011', statement_timestamp() - interval '10 minutes',
    statement_timestamp() - interval '10 minutes'
  );
  perform public.sweep_customer_portal_contact_changes(statement_timestamp());
  if exists (
    select 1 from private.customer_portal_contact_change_flows f
    where f.public_id = v_revoked_flow and f.new_destination is not null
  ) then raise exception 'contact_change_revoked_destination_not_scrubbed'; end if;
  if exists (
    select 1 from private.customer_portal_contact_change_flows f
    where f.public_id = v_expired_flow and f.new_destination is not null
  ) then raise exception 'contact_change_expired_destination_not_scrubbed'; end if;
  begin
    update public.customers set phone = '+46700000009'
    where id = v_other_customer and tenant_id = v_tenant;
    raise exception 'contact_change_direct_writer_conflict_invalid';
  exception when unique_violation then
    null;
  end;
  update private.customer_booking_trusts set revoked_at = null where public_id = v_trust;
  update private.customer_portal_links set revoked_at = null where public_id = v_link;
  update private.customer_portal_challenges set revoked_at = null where public_id = v_challenge;
  update public.customers set phone = '+46700000008'
  where id = v_customer and tenant_id = v_tenant;
  if exists (
    select 1 from private.customer_portal_sessions session_row
    where session_row.public_id = v_new_session and session_row.revoked_at is null
  ) then raise exception 'contact_change_direct_writer_session_not_revoked'; end if;
  if exists (
    select 1 from private.customer_portal_verified_contacts verified
    where verified.tenant_id = v_tenant and verified.customer_id = v_customer
      and verified.channel = 'sms' and verified.revoked_at is null
  ) then raise exception 'contact_change_direct_writer_binding_not_revoked'; end if;
  if exists (
    select 1 from private.customer_booking_trusts trust_row
    where trust_row.public_id = v_trust and trust_row.revoked_at is null
  ) then raise exception 'contact_change_direct_writer_trust_not_revoked'; end if;
  if exists (
    select 1 from private.customer_portal_links link_row
    where link_row.public_id = v_link and link_row.revoked_at is null
  ) then raise exception 'contact_change_direct_writer_link_not_revoked'; end if;
  if exists (
    select 1 from private.customer_portal_challenges challenge_row
    where challenge_row.public_id = v_challenge and challenge_row.revoked_at is null
  ) then raise exception 'contact_change_direct_writer_challenge_not_revoked'; end if;
  perform public.customer_portal_gdpr_scrub(v_tenant, v_customer);
  if exists (
    select 1 from private.customer_portal_contact_change_flows f
    where f.tenant_id = v_tenant and f.customer_id = v_customer
  ) or exists (
    select 1 from private.customer_portal_verified_contacts vc
    where vc.tenant_id = v_tenant and vc.customer_id = v_customer
  ) then raise exception 'contact_change_gdpr_scrub_invalid'; end if;
end
$contact_change$;

do $acl$
begin
  if has_table_privilege('anon', 'private.customer_portal_contact_change_flows', 'SELECT')
     or has_table_privilege('authenticated', 'private.customer_portal_verified_contacts', 'SELECT')
     or has_function_privilege(
       'anon',
       'public.customer_portal_start_contact_change(uuid,text,text,uuid,text,text,text,text,text,integer,timestamptz)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.customer_portal_finalize_contact_change(uuid,text,uuid,text,text,text,text,uuid,text,integer)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.customer_portal_resend_contact_change(uuid,text,uuid,text,text,text,text,text,timestamptz)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.sweep_customer_portal_contact_changes(timestamptz)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.sweep_customer_portal_contact_changes(timestamptz)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.customer_portal_finalize_contact_change(uuid,text,uuid,text,text,text,text,uuid,text,integer)'::regprocedure,
       'EXECUTE'
     ) then
    raise exception 'contact_change_acl_invalid';
  end if;
end
$acl$;

rollback;
