-- 0122 runtime: customer-portal rebook origins are tenant-bound and routable.
-- Run only against an isolated reset/test database.
begin;

do $rebook_origin$
declare
  v_custom uuid := gen_random_uuid();
  v_fallback uuid := gen_random_uuid();
  v_hostile uuid := gen_random_uuid();
  v_invalid_slug uuid := gen_random_uuid();
  v_reserved_slug uuid := gen_random_uuid();
  v_customer uuid := gen_random_uuid();
  v_other_customer uuid := gen_random_uuid();
  v_location uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_booking uuid := gen_random_uuid();
  v_proc regprocedure;
  v_definition text;
begin
  insert into public.tenants (id, slug, name, status) values
    (v_custom, 'portal-rebook-custom', 'Portal Rebook Custom', 'active'),
    (v_fallback, 'portal-rebook-fallback', 'Portal Rebook Fallback', 'active'),
    (v_hostile, 'portal-rebook-hostile', 'Portal Rebook Hostile', 'active'),
    (v_invalid_slug, 'Portal-Rebook-Invalid', 'Portal Rebook Invalid', 'active'),
    (v_reserved_slug, 'boka', 'Portal Rebook Reserved', 'active');

  insert into public.tenant_domains (tenant_id, domain, is_primary, verified) values
    (v_custom, 'book.portal-rebook.example', false, true),
    (v_custom, 'unverified.portal-rebook.example', true, false),
    (v_hostile, 'evil-0122.corevo.se', true, true);

  if private.customer_portal_booking_origin(v_custom)
       <> 'https://book.portal-rebook.example' then
    raise exception 'verified_non_primary_custom_domain_not_selected';
  end if;
  if private.customer_portal_booking_origin(v_fallback)
       <> 'https://portal-rebook-fallback.boka.corevo.se' then
    raise exception 'canonical_booking_fallback_invalid';
  end if;
  if private.customer_portal_booking_origin(v_hostile)
       <> 'https://portal-rebook-hostile.boka.corevo.se' then
    raise exception 'corevo_custom_claim_not_rejected';
  end if;
  if private.customer_portal_booking_origin(v_invalid_slug) is not null then
    raise exception 'invalid_unroutable_slug_not_rejected';
  end if;
  if private.customer_portal_booking_origin(v_reserved_slug) is not null then
    raise exception 'reserved_unroutable_slug_not_rejected';
  end if;

  insert into public.customers (id, tenant_id, full_name, phone, status) values
    (v_customer, v_custom, 'Portal Rebook Customer', '+46700000122', 'active'),
    (v_other_customer, v_fallback, 'Portal Rebook Other', '+46700000123', 'active');
  insert into public.locations (id, tenant_id, name, timezone, is_primary, active) values
    (v_location, v_custom, 'Portal Rebook Location', 'Europe/Stockholm', true, true);
  insert into public.staff (id, tenant_id, location_id, title, active) values
    (v_staff, v_custom, v_location, 'Portal Rebook Staff', true);
  insert into public.services (
    id, tenant_id, location_id, name, duration_min, price_cents, active
  ) values
    (v_service, v_custom, v_location, 'Portal Rebook Service', 30, 10000, true);
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values (
    v_booking, v_custom, v_location, v_staff, v_service, v_customer,
    statement_timestamp() + interval '30 days',
    statement_timestamp() + interval '30 days 30 minutes',
    'confirmed', 10000
  );

  if private.customer_portal_rebook_url(v_custom, v_customer, v_booking)
       <> 'https://book.portal-rebook.example/boka?plats=' || v_location::text
          || '&tjanst=' || v_service::text then
    raise exception 'active_context_rebook_url_invalid';
  end if;
  if private.customer_portal_rebook_url(v_fallback, v_customer, v_booking) is not null
     or private.customer_portal_rebook_url(v_custom, v_other_customer, v_booking) is not null then
    raise exception 'cross_tenant_or_customer_rebook_leak';
  end if;

  update public.services set active = false where id = v_service;
  if private.customer_portal_rebook_url(v_custom, v_customer, v_booking)
       <> 'https://book.portal-rebook.example/boka?plats=' || v_location::text then
    raise exception 'inactive_service_not_omitted_independently';
  end if;
  update public.services set active = true where id = v_service;
  update public.locations set active = false where id = v_location;
  if private.customer_portal_rebook_url(v_custom, v_customer, v_booking)
       <> 'https://book.portal-rebook.example/boka' then
    raise exception 'inactive_specific_location_context_not_omitted';
  end if;
  update public.services set location_id = null where id = v_service;
  if private.customer_portal_rebook_url(v_custom, v_customer, v_booking)
       <> 'https://book.portal-rebook.example/boka?tjanst=' || v_service::text then
    raise exception 'active_global_service_with_invalid_location_not_preserved';
  end if;

  perform pg_catalog.set_config(
    'request.headers',
    '{"host":"attacker.example","x-forwarded-host":"attacker.example"}',
    true
  );
  if private.customer_portal_booking_origin(v_fallback)
       <> 'https://portal-rebook-fallback.boka.corevo.se' then
    raise exception 'request_host_influenced_booking_origin';
  end if;

  foreach v_proc in array array[
    'public.customer_portal_session_snapshot(uuid,text,text,integer)'::regprocedure,
    'public.customer_portal_list_bookings(uuid,text,text,timestamptz,uuid,integer)'::regprocedure,
    'public.customer_portal_get_booking(uuid,text,uuid)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_proc, 'EXECUTE')
       or has_function_privilege('authenticated', v_proc, 'EXECUTE')
       or not has_function_privilege('service_role', v_proc, 'EXECUTE') then
      raise exception 'public_rebook_rpc_grant_invalid:%', v_proc;
    end if;
    select pg_get_functiondef(v_proc) into v_definition;
    if v_definition not like '%SECURITY DEFINER%'
       or v_definition not like '%SET search_path TO ''''%' then
      raise exception 'public_rebook_rpc_hardening_invalid:%', v_proc;
    end if;
  end loop;

  if has_function_privilege(
       'service_role',
       'private.customer_portal_session_snapshot(uuid,text,text,integer)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.customer_portal_list_bookings(uuid,text,text,timestamptz,uuid,integer)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.customer_portal_get_booking(uuid,text,uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.customer_portal_booking_origin(uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.customer_portal_rebook_url(uuid,uuid,uuid)'::regprocedure,
       'EXECUTE'
     ) then
    raise exception 'private_0120_reader_still_executable';
  end if;

  if (select provolatile from pg_proc where oid =
       'public.customer_portal_session_snapshot(uuid,text,text,integer)'::regprocedure) <> 'v'
     or (select provolatile from pg_proc where oid =
       'public.customer_portal_list_bookings(uuid,text,text,timestamptz,uuid,integer)'::regprocedure) <> 's'
     or (select provolatile from pg_proc where oid =
       'public.customer_portal_get_booking(uuid,text,uuid)'::regprocedure) <> 's' then
    raise exception 'portal_reader_volatility_changed';
  end if;

  if (select pronargdefaults from pg_proc where oid =
       'public.customer_portal_session_snapshot(uuid,text,text,integer)'::regprocedure) <> 2
     or (select pronargdefaults from pg_proc where oid =
       'public.customer_portal_list_bookings(uuid,text,text,timestamptz,uuid,integer)'::regprocedure) <> 4
     or (select pronargdefaults from pg_proc where oid =
       'public.customer_portal_get_booking(uuid,text,uuid)'::regprocedure) <> 0 then
    raise exception 'portal_reader_defaults_changed';
  end if;
end
$rebook_origin$;

rollback;
