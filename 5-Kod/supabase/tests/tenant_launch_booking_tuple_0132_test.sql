-- Goal 84 / 0132 runtime acceptance. Apply 0132 first, then run on preview only.
-- The inner subtransaction always rolls back the synthetic tenant.

do $outer$
declare
  v_tenant uuid;
  v_location uuid;
  v_service uuid;
  v_staff uuid;
  v_role uuid;
  v_owner uuid;
  v_readiness jsonb;
  v_status text;
begin
  begin
    -- Run through the preview SQL/migration connection with no request JWT.
    -- Goal 82 deliberately blocks service-role writes to provisioning tenants;
    -- the trusted maintenance session is the existing seed/test seam.
    insert into public.tenants (slug, name, status)
    values ('goal84-readiness-runtime', 'Goal 84 readiness runtime', 'provisioning')
    returning id into v_tenant;
    insert into public.tenant_settings (tenant_id) values (v_tenant);
    insert into public.roles (tenant_id, name, level)
    values (v_tenant, 'salon_admin', 6)
    returning id into v_role;
    insert into auth.users (id, email)
    values (pg_catalog.gen_random_uuid(), 'goal84-readiness-owner@example.test')
    returning id into v_owner;
    insert into public.users (id, tenant_id, email, role_id, status)
    values (
      v_owner,
      v_tenant,
      'goal84-readiness-owner@example.test',
      v_role,
      'active'
    );
    insert into public.locations (tenant_id, name, is_primary, active)
    values (v_tenant, 'Primär plats', true, true)
    returning id into v_location;
    -- Missing booking is deliberately the legacy-live case. Goal 87 forbids
    -- manufacturing a direct live row; explicit rows start at off below.
    insert into public.services (tenant_id, location_id, name, duration_min, active)
    values (v_tenant, v_location, 'Verifierbar tjänst', 60, true)
    returning id into v_service;
    insert into public.staff (tenant_id, location_id, title, active)
    values (v_tenant, v_location, 'Verifierbar personal', false)
    returning id into v_staff;
    insert into public.staff_services (tenant_id, staff_id, service_id)
    values (v_tenant, v_staff, v_service);
    insert into public.working_hours (tenant_id, staff_id, location_id, weekday, start_time, end_time)
    values (v_tenant, v_staff, v_location, 1, time '09:00', time '17:00');
    insert into public.location_opening_hours (
      tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
    ) values (v_tenant, v_location, 1, time '09:00', time '17:00', 'confirmed', now());
    update public.staff set active = true where id = v_staff;

    -- A matching weekday and 09:00 + n*15 fallback has a real 60-minute start.
    if pg_catalog.cardinality(private.tenant_launch_missing(v_tenant)) <> 0 then
      raise exception 'goal84_valid_tuple_not_ready';
    end if;

    -- Historical contract: no booking row is still live, while explicit off is
    -- the only website-only state that may skip booking readiness.
    update public.location_opening_hours set weekday = 2
    where tenant_id = v_tenant and location_id = v_location;
    if not ('working_hours' = any (private.tenant_launch_missing(v_tenant))) then
      raise exception 'goal84_missing_booking_row_failed_open';
    end if;
    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    perform pg_catalog.set_config(
      'request.jwt.claims',
      '{"role":"service_role"}',
      true
    );
    v_readiness := public.tenant_launch_readiness(v_tenant);
    if (v_readiness ->> 'booking_required')::boolean is not true
       or (v_readiness ->> 'ready')::boolean is not false then
      raise exception 'goal84_missing_booking_row_json_failed_open';
    end if;
    begin
      perform public.publish_tenant(v_tenant);
      raise exception 'goal84_missing_booking_publish_not_blocked';
    exception
      when sqlstate '55000' then null;
    end;
    perform pg_catalog.set_config('request.jwt.claim.role', '', true);
    perform pg_catalog.set_config('request.jwt.claims', '{}', true);
    insert into public.tenant_modules (tenant_id, module_key, state)
    values (v_tenant, 'booking', 'off');
    if 'working_hours' = any (private.tenant_launch_missing(v_tenant)) then
      raise exception 'goal84_explicit_booking_off_not_honored';
    end if;
    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    perform pg_catalog.set_config(
      'request.jwt.claims',
      '{"role":"service_role"}',
      true
    );
    v_readiness := public.tenant_launch_readiness(v_tenant);
    if (v_readiness ->> 'booking_required')::boolean is not false
       or (v_readiness ->> 'ready')::boolean is not true then
      raise exception 'goal84_explicit_booking_off_json_not_honored';
    end if;
    v_readiness := public.publish_tenant(v_tenant);
    if (v_readiness ->> 'booking_required')::boolean is not false
       or (v_readiness ->> 'transitioned')::boolean is not true then
      raise exception 'goal84_explicit_booking_off_publish_failed';
    end if;
    update public.tenants set status = 'provisioning' where id = v_tenant;
    perform pg_catalog.set_config('request.jwt.claim.role', '', true);
    perform pg_catalog.set_config('request.jwt.claims', '{}', true);
    update public.tenant_modules set state = 'live'
    where tenant_id = v_tenant and module_key = 'booking';
    update public.location_opening_hours set weekday = 1
    where tenant_id = v_tenant and location_id = v_location;

    -- Wrong weekday: no same-day staff/location intersection exists.
    update public.location_opening_hours set weekday = 2
    where tenant_id = v_tenant and location_id = v_location;
    if not ('working_hours' = any (private.tenant_launch_missing(v_tenant))) then
      raise exception 'goal84_wrong_weekday_not_blocked';
    end if;
    update public.location_opening_hours set weekday = 1
    where tenant_id = v_tenant and location_id = v_location;

    -- Too short overlap: 09:00–09:30 cannot fit the 60-minute service.
    update public.location_opening_hours set end_time = time '09:30'
    where tenant_id = v_tenant and location_id = v_location;
    if not ('working_hours' = any (private.tenant_launch_missing(v_tenant))) then
      raise exception 'goal84_short_overlap_not_blocked';
    end if;
    update public.location_opening_hours set end_time = time '17:00'
    where tenant_id = v_tenant and location_id = v_location;

    -- `time + interval` must not wrap past midnight and pretend a long service fits.
    update public.working_hours set start_time = time '23:00', end_time = time '23:30'
    where tenant_id = v_tenant and staff_id = v_staff;
    update public.location_opening_hours set start_time = time '23:00', end_time = time '23:30'
    where tenant_id = v_tenant and location_id = v_location;
    if not ('working_hours' = any (private.tenant_launch_missing(v_tenant))) then
      raise exception 'goal84_midnight_wrap_not_blocked';
    end if;
    update public.working_hours set start_time = time '09:00', end_time = time '17:00'
    where tenant_id = v_tenant and staff_id = v_staff;
    update public.location_opening_hours set start_time = time '09:00', end_time = time '17:00'
    where tenant_id = v_tenant and location_id = v_location;

    -- An explicit list is authoritative; this start falls outside the confirmed frame.
    insert into public.working_hour_slots (tenant_id, staff_id, location_id, weekday, start_time, active)
    values (v_tenant, v_staff, v_location, 1, time '16:30', true);
    if not ('working_hours' = any (private.tenant_launch_missing(v_tenant))) then
      raise exception 'goal84_unfitting_explicit_start_not_blocked';
    end if;
    update public.working_hour_slots set start_time = time '16:00'
    where tenant_id = v_tenant and staff_id = v_staff;
    if 'working_hours' = any (private.tenant_launch_missing(v_tenant)) then
      raise exception 'goal84_valid_explicit_start_not_ready';
    end if;
    delete from public.working_hour_slots where tenant_id = v_tenant;
    if 'working_hours' = any (private.tenant_launch_missing(v_tenant)) then
      raise exception 'goal84_fallback_not_restored';
    end if;

    -- A non-confirmed frame is not launch proof, even when its times match.
    update public.location_opening_hours
       set source = 'staff_union', confirmed_at = null
     where tenant_id = v_tenant and location_id = v_location;
    if not (
      'working_hours' = any (private.tenant_launch_missing(v_tenant))
      and 'confirmed_opening_hours' = any (
        private.tenant_launch_missing(v_tenant)
      )
    ) then
      raise exception 'goal84_missing_confirmation_not_blocked';
    end if;
    update public.location_opening_hours
       set source = 'confirmed', confirmed_at = pg_catalog.now()
     where tenant_id = v_tenant and location_id = v_location;

    -- Publish once, then prove the row lock path is idempotent.
    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    perform pg_catalog.set_config(
      'request.jwt.claims',
      '{"role":"service_role"}',
      true
    );
    v_readiness := public.publish_tenant(v_tenant);
    if v_readiness ->> 'tenant_status' <> 'active'
       or (v_readiness ->> 'transitioned')::boolean is not true then
      raise exception 'goal84_first_publish_failed';
    end if;
    v_readiness := public.publish_tenant(v_tenant);
    if (v_readiness ->> 'transitioned')::boolean is not false then
      raise exception 'goal84_publish_not_idempotent';
    end if;

    -- The same private source must block both the RPC and a direct status bypass.
    update public.tenants set status = 'provisioning' where id = v_tenant;
    perform pg_catalog.set_config('request.jwt.claim.role', '', true);
    perform pg_catalog.set_config('request.jwt.claims', '{}', true);
    update public.location_opening_hours
       set source = 'staff_union', confirmed_at = null
     where tenant_id = v_tenant and location_id = v_location;
    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    perform pg_catalog.set_config(
      'request.jwt.claims',
      '{"role":"service_role"}',
      true
    );
    begin
      perform public.publish_tenant(v_tenant);
      raise exception 'goal84_publish_should_have_been_blocked';
    exception
      when sqlstate '55000' then null;
    end;
    perform pg_catalog.set_config('request.jwt.claim.role', '', true);
    perform pg_catalog.set_config('request.jwt.claims', '{}', true);

    begin
      update public.tenants set status = 'active' where id = v_tenant;
      raise exception 'goal84_direct_active_should_have_been_blocked';
    exception
      when sqlstate '55000' then null;
    end;
    select t.status into v_status
      from public.tenants t
     where t.id = v_tenant;
    if v_status <> 'provisioning' then
      raise exception 'goal84_failed_publish_changed_status';
    end if;

    raise exception 'goal84_runtime_rollback' using errcode = 'Z8400';
  exception
    when sqlstate 'Z8400' then
      raise notice 'goal84_tenant_launch_booking_tuple_runtime_ok';
  end;
end;
$outer$;
