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
    'customer_portal_mint_link',
    'customer_portal_exchange_link',
    'customer_portal_session_snapshot',
    'customer_portal_list_bookings',
    'customer_portal_get_booking',
    'customer_portal_cancel_booking',
    'customer_portal_update_name',
    'customer_portal_create_challenge',
    'customer_portal_verify_challenge',
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
end
$security$;

do $runtime$
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
  v_booking_b uuid := gen_random_uuid();
  v_link uuid;
  v_session uuid := gen_random_uuid();
  v_result record;
  v_payload jsonb;
  v_count integer;
  v_i integer;
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
  insert into public.customers (id, tenant_id, full_name, phone, status) values
    (v_customer_a, v_tenant_a, 'Portal A', '+46700000001', 'active'),
    (v_customer_b, v_tenant_b, 'Portal B', '+46700000002', 'active');
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
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values
    (v_booking_a, v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
     statement_timestamp() + interval '3 days', statement_timestamp() + interval '3 days 30 minutes',
     'confirmed', 10000),
    (v_booking_b, v_tenant_b, v_location_b, v_staff_b, v_service_b, v_customer_b,
     statement_timestamp() + interval '4 days', statement_timestamp() + interval '4 days 30 minutes',
     'confirmed', 10000);

  select m.link_public_id into v_link
  from public.customer_portal_mint_link(
    v_tenant_a, v_customer_a, 'booking_access', repeat('a', 64), 1,
    statement_timestamp() + interval '15 minutes', gen_random_uuid()
  ) m;
  select * into v_result
  from public.customer_portal_exchange_link(
    v_link, repeat('a', 64), v_session, repeat('b', 64), 1
  );
  if v_result.outcome <> 'ok' then raise exception 'portal_exchange_failed'; end if;

  select * into v_result
  from public.customer_portal_session_snapshot(v_session, repeat('b', 64));
  if v_result.outcome <> 'ok'
     or v_result.snapshot ->> 'tenantSlug' <> 'portal-test-a'
     or v_result.snapshot ->> 'bookingOrigin' <> 'https://portal-test-a.example'
     or v_result.snapshot ->> 'logoUrl' <> 'https://cdn.corevo.se/portal-test-a.png'
     or v_result.snapshot ->> 'mapUrl' is null
     or v_result.snapshot ? 'tenantId'
     or v_result.snapshot ? 'customerId' then
    raise exception 'portal_snapshot_projection_invalid:%', v_result.snapshot;
  end if;

  for v_i in 1..20 loop
    insert into public.bookings (
      id, tenant_id, location_id, staff_id, service_id, customer_id,
      start_ts, end_ts, status, price_cents
    ) values (
      gen_random_uuid(), v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
      statement_timestamp() - pg_catalog.make_interval(days => v_i),
      statement_timestamp() - pg_catalog.make_interval(days => v_i) + interval '30 minutes',
      'completed', 10000
    );
  end loop;

  select public.customer_portal_list_bookings(
    v_session, repeat('b', 64), 'history', null, null, 20
  ) into v_payload;
  if pg_catalog.jsonb_array_length(v_payload -> 'items') <> 20
     or (v_payload ->> 'hasMore')::boolean
     or v_payload -> 'nextCursor' <> 'null'::jsonb then
    raise exception 'portal_exact_page_pagination_invalid:%', v_payload;
  end if;

  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values (
    gen_random_uuid(), v_tenant_a, v_location_a, v_staff_a, v_service_a, v_customer_a,
    statement_timestamp() + interval '30 days',
    statement_timestamp() + interval '30 days 30 minutes',
    'awaiting_review', 10000
  );

  select public.customer_portal_list_bookings(
    v_session, repeat('b', 64), 'history', null, null, 20
  ) into v_payload;
  if pg_catalog.jsonb_array_length(v_payload -> 'items') <> 20
     or not (v_payload ->> 'hasMore')::boolean
     or v_payload -> 'nextCursor' = 'null'::jsonb
     or v_payload #>> '{items,0,status}' <> 'awaiting_review' then
    raise exception 'portal_history_unknown_or_cursor_invalid:%', v_payload;
  end if;

  select public.customer_portal_list_bookings(
    v_session, repeat('b', 64), 'upcoming', null, null, 20
  ) into v_payload;
  if v_payload::text like '%awaiting_review%' then
    raise exception 'portal_unknown_status_leaked_into_upcoming';
  end if;

  select public.customer_portal_get_booking(
    v_session, repeat('b', 64), v_booking_a
  ) into v_payload;
  if v_payload #>> '{booking,publicRebookUrl}' <> 'https://portal-test-a.example/boka'
     or not (v_payload #>> '{booking,canCancel}')::boolean
     or v_payload #>> '{booking,durationMinutes}' <> '30'
     or v_payload #>> '{booking,location,timezone}' <> 'Europe/Stockholm'
     or v_payload #> '{booking,location,phone}' <> 'null'::jsonb
     or v_payload #> '{booking,location,mapUrl}' <> 'null'::jsonb then
    raise exception 'portal_booking_projection_invalid:%', v_payload;
  end if;

  select * into v_result
  from public.customer_portal_exchange_link(
    v_link, repeat('a', 64), gen_random_uuid(), repeat('c', 64), 1
  );
  if v_result.outcome <> 'invalid' then raise exception 'portal_link_replay_allowed'; end if;

  select public.customer_portal_get_booking(
    v_session, repeat('b', 64), v_booking_b
  ) into v_payload;
  if v_payload ->> 'outcome' <> 'not_found' then
    raise exception 'portal_cross_tenant_booking_leaked';
  end if;

  select * into v_result
  from public.customer_portal_cancel_booking(
    v_session, repeat('b', 64), v_booking_a, 24, repeat('i', 32)
  );
  if v_result.outcome <> 'cancelled' then raise exception 'portal_cancel_failed'; end if;

  select * into v_result
  from public.customer_portal_cancel_booking(
    v_session, repeat('b', 64), v_booking_a, 24, repeat('i', 32)
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

  perform public.customer_portal_gdpr_scrub(v_tenant_a, v_customer_a);
  if exists (
    select 1 from private.customer_portal_resolve_session(
      v_session, repeat('b', 64), statement_timestamp()
    )
  ) then
    raise exception 'portal_gdpr_session_survived';
  end if;
end
$runtime$;

rollback;
