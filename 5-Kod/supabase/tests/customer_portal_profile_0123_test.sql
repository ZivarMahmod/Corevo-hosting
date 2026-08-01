-- 0123 runtime: profile projection and name mutation stay session/tenant/customer-bound.
-- Run only against an isolated reset/test database after migration 0123.
begin;

do $profile$
declare
  v_tenant_a uuid := gen_random_uuid();
  v_tenant_b uuid := gen_random_uuid();
  v_customer_a uuid := gen_random_uuid();
  v_customer_b uuid := gen_random_uuid();
  v_location_a uuid := gen_random_uuid();
  v_location_b uuid := gen_random_uuid();
  v_staff_a uuid := gen_random_uuid();
  v_staff_b uuid := gen_random_uuid();
  v_service_a uuid := gen_random_uuid();
  v_service_b uuid := gen_random_uuid();
  v_booking_a uuid := gen_random_uuid();
  v_booking_a_email uuid := gen_random_uuid();
  v_booking_b uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_result record;
  v_text text;
  v_count integer;
begin
  insert into public.tenants (id, slug, name, status) values
    (v_tenant_a, 'profile-test-a', 'Profile Test A', 'active'),
    (v_tenant_b, 'profile-test-b', 'Profile Test B', 'active');
  insert into public.tenant_settings (tenant_id, branding, settings) values
    (v_tenant_a, '{}'::jsonb, '{"customer_portal":{"mode":"passwordless_tenant"}}'::jsonb),
    (v_tenant_b, '{}'::jsonb, '{"customer_portal":{"mode":"passwordless_tenant"}}'::jsonb);
  insert into public.customers (id, tenant_id, full_name, email, phone, status) values
    (v_customer_a, v_tenant_a, 'Portal A', 'a@example.se', '+46700000001', 'active'),
    (v_customer_b, v_tenant_b, 'Portal B', 'b@example.se', '+46700000002', 'active');
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
    (v_booking_a, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
     statement_timestamp() + interval '3 days', statement_timestamp() + interval '3 days 30 minutes',
     'confirmed', 10000),
    (v_booking_a_email, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
     statement_timestamp() + interval '4 days', statement_timestamp() + interval '4 days 30 minutes',
     'confirmed', 10000),
    (v_booking_b, v_tenant_b, v_location_b, v_staff_b, v_service_b, v_customer_b,
     statement_timestamp() + interval '5 days', statement_timestamp() + interval '5 days 30 minutes',
     'confirmed', 10000);

  insert into private.booking_verification_challenges (
    tenant_id, staff_id, service_id, start_ts, session_token, channel,
    contact_digest, contact_masked, pin_digest, delivery_state,
    expires_at, consumed_at, booking_id
  ) values
    (v_tenant_a, v_staff_a, v_service_a, statement_timestamp() + interval '3 days',
     gen_random_uuid(), 'sms', repeat('a', 64), '+46 ••• •• 01', repeat('b', 64),
     'delivered', statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking_a),
    (v_tenant_b, v_staff_b, v_service_b, statement_timestamp() + interval '5 days',
     gen_random_uuid(), 'sms', repeat('c', 64), '+46 ••• •• 02', repeat('d', 64),
     'delivered', statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking_b);

  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (
    v_session, v_tenant_a, v_customer_a, repeat('e', 64), 1,
    statement_timestamp() + interval '180 days', statement_timestamp() + interval '365 days'
  );

  select * into v_result
  from public.customer_portal_profile_snapshot(v_session, repeat('e', 64));
  if v_result.outcome <> 'ok'
     or v_result.profile #>> '{tenantSlug}' <> 'profile-test-a'
     or v_result.profile #>> '{tenantName}' <> 'Profile Test A'
     or v_result.profile #>> '{customerName}' <> 'Portal A'
     or v_result.profile #>> '{phone}' <> '+46700000001'
     or v_result.profile #>> '{email}' <> 'a@example.se'
     or v_result.profile #>> '{proofs,0,contactDigest}' <> repeat('a', 64)
     or v_result.profile #>> '{proofs,0,maskValid}' <> 'true'
     or v_result.profile ?| array['verifiedContact', 'secondaryContact']
     or v_result.profile ?| array['tenantId', 'customerId', 'sessionId'] then
    raise exception 'profile_atomic_evidence_invalid:%', v_result.profile;
  end if;

  select * into v_result
  from public.customer_portal_profile_snapshot(v_session, repeat('f', 64));
  if v_result.outcome <> 'expired' or v_result.profile is not null then
    raise exception 'profile_wrong_secret_not_closed';
  end if;

  update private.booking_verification_challenges
  set contact_masked = '+46700000001 •'
  where booking_id = v_booking_a and channel = 'sms';
  select * into v_result
  from public.customer_portal_profile_snapshot(v_session, repeat('e', 64));
  if v_result.outcome <> 'ok'
     or v_result.profile #>> '{proofs,0,maskValid}' <> 'false' then
    raise exception 'profile_hostile_mask_not_closed';
  end if;
  update private.booking_verification_challenges
  set contact_masked = '+46 ••• •• 01'
  where booking_id = v_booking_a and channel = 'sms';

  insert into private.booking_verification_challenges (
    tenant_id, staff_id, service_id, start_ts, session_token, channel,
    contact_digest, contact_masked, pin_digest, delivery_state,
    expires_at, consumed_at, booking_id
  ) values (
    v_tenant_a, v_staff_a, v_service_a, statement_timestamp() + interval '3 days',
    gen_random_uuid(), 'sms', repeat('9', 64), '+46 ••• •• 01', repeat('8', 64),
    'delivered', statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking_a
  );
  select * into v_result
  from public.customer_portal_profile_snapshot(v_session, repeat('e', 64));
  select pg_catalog.count(*) into v_count
  from pg_catalog.jsonb_array_elements(v_result.profile -> 'proofs') proof
  where proof #>> '{channel}' = 'sms'
    and proof #>> '{maskedDestination}' = '+46 ••• •• 01'
    and proof #>> '{contactDigest}' in (repeat('a', 64), repeat('9', 64));
  if v_result.outcome <> 'ok' or v_count <> 2 then
    raise exception 'profile_sms_mask_collision_evidence_invalid:%', v_result.profile;
  end if;

  if public.customer_portal_update_name(v_session, repeat('e', 64), 'X') <> 'invalid'
     or public.customer_portal_update_name(v_session, repeat('e', 64), E'Anna\nTest') <> 'invalid'
     or public.customer_portal_update_name(v_session, repeat('e', 64), U&'Anna\200BTest') <> 'invalid'
     or public.customer_portal_update_name(v_session, repeat('e', 64), U&'Anna\202ETest') <> 'invalid'
     or public.customer_portal_update_name(v_session, repeat('e', 64), U&'Anna\E000Test') <> 'invalid'
     or public.customer_portal_update_name(v_session, repeat('e', 64), U&'Anna\0378Test') <> 'invalid'
     or public.customer_portal_update_name(v_session, repeat('e', 64), U&'Anna\FDD0Test') <> 'invalid' then
    raise exception 'profile_name_invalid_input_accepted';
  end if;
  if public.customer_portal_update_name(
       v_session, repeat('e', 64), 'अनन्या शर्मा'
     ) <> 'ok' then
    raise exception 'profile_devanagari_name_rejected';
  end if;
  if public.customer_portal_update_name(
       v_session, repeat('e', 64), 'Anna 😀 Test'
     ) <> 'ok' then
    raise exception 'profile_assigned_symbol_name_rejected';
  end if;
  if public.customer_portal_update_name(
       v_session, repeat('e', 64), U&'A\088F'
     ) <> 'ok' then
    raise exception 'profile_unicode17_name_rejected';
  end if;
  if not private.customer_portal_forbidden_codepoint(888) then
    raise exception 'profile_unassigned_name_accepted';
  end if;
  if private.customer_portal_safe_contact_mask(
       'email', U&'a•••@exam\200Bple.se'
     ) then
    raise exception 'profile_email_mask_zwsp_accepted';
  end if;

  v_text := public.customer_portal_update_name(
    v_session, repeat('e', 64), U&'  A\030Asa Test  '
  );
  if v_text <> 'ok' then raise exception 'profile_name_valid_update_failed'; end if;
  select c.display_name into v_text
  from public.customers c
  where c.id = v_customer_a and c.tenant_id = v_tenant_a;
  if v_text <> 'Åsa Test' then raise exception 'profile_name_not_nfc_trimmed:%', v_text; end if;
  select pg_catalog.count(*) into v_count
  from private.customer_portal_audit a
  where a.tenant_id = v_tenant_a
    and a.customer_id = v_customer_a
    and a.event_type = 'profile_name_updated';
  if v_count <> 1 then raise exception 'profile_name_audit_invalid:%', v_count; end if;
  select c.display_name into v_text from public.customers c where c.id = v_customer_b;
  if v_text is not null then raise exception 'profile_name_cross_tenant_write'; end if;

  -- Same-looking historical and current e-mail proofs stay distinct by digest.
  insert into private.booking_verification_challenges (
    tenant_id, staff_id, service_id, start_ts, session_token, channel,
    contact_digest, contact_masked, pin_digest, delivery_state,
    expires_at, consumed_at, booking_id
  ) values
    (v_tenant_a, v_staff_a, v_service_a, statement_timestamp() + interval '4 days',
     gen_random_uuid(), 'email', repeat('1', 64), 'a•••@example.se', repeat('2', 64),
     'delivered', statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking_a_email),
    (v_tenant_a, v_staff_a, v_service_a, statement_timestamp() + interval '4 days',
     gen_random_uuid(), 'email', repeat('3', 64), 'a•••@example.se', repeat('4', 64),
     'delivered', statement_timestamp() + interval '5 minutes', statement_timestamp(), v_booking_a_email);
  select * into v_result
  from public.customer_portal_profile_snapshot(v_session, repeat('e', 64));
  select pg_catalog.count(*) into v_count
  from pg_catalog.jsonb_array_elements(v_result.profile -> 'proofs') proof
  where proof #>> '{channel}' = 'email'
    and proof #>> '{maskedDestination}' = 'a•••@example.se'
    and proof #>> '{contactDigest}' in (repeat('1', 64), repeat('3', 64));
  if v_result.outcome <> 'ok' or v_count <> 2 then
    raise exception 'profile_email_mask_collision_evidence_invalid:%', v_result.profile;
  end if;
  if v_result.profile #>> '{proofs,0,maskValid}' is null then
    raise exception 'profile_secondary_verified_invalid:%', v_result.profile;
  end if;

  update private.customer_portal_sessions set revoked_at = statement_timestamp()
  where public_id = v_session;
  if public.customer_portal_update_name(v_session, repeat('e', 64), 'Efter revoke') <> 'expired' then
    raise exception 'profile_revoked_session_updated_name';
  end if;
end
$profile$;

do $acl$
begin
  if has_function_privilege(
       'anon', 'public.customer_portal_profile_snapshot(uuid,text)'::regprocedure, 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', 'public.customer_portal_profile_snapshot(uuid,text)'::regprocedure, 'EXECUTE'
     )
     or not has_function_privilege(
       'service_role', 'public.customer_portal_profile_snapshot(uuid,text)'::regprocedure, 'EXECUTE'
     )
     or has_function_privilege(
       'anon', 'public.customer_portal_update_name(uuid,text,text)'::regprocedure, 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', 'public.customer_portal_update_name(uuid,text,text)'::regprocedure, 'EXECUTE'
     )
     or not has_function_privilege(
       'service_role', 'public.customer_portal_update_name(uuid,text,text)'::regprocedure, 'EXECUTE'
     ) then
    raise exception 'profile_snapshot_acl_invalid_or_profile_update_name_acl_invalid';
  end if;
end
$acl$;

rollback;
