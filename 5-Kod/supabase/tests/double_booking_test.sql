-- ============================================================================
-- Double-booking guard proof. Two overlapping 'confirmed' bookings on the same
-- staff member must raise exclusion_violation on the second insert. Self-cleans.
-- ============================================================================
begin;

do $$
declare
  tenant_a uuid := 'd0000000-0000-0000-0000-000000000001';
  loc_a    uuid := 'd0000000-0000-0000-0000-000000000011';
  staff_a  uuid := 'd0000000-0000-0000-0000-000000000041';
  svc_a    uuid := 'd0000000-0000-0000-0000-000000000051';
  t0       timestamptz := (
    date_trunc('week', current_timestamp at time zone 'UTC') + interval '14 days 10 hours'
  ) at time zone 'UTC';
begin
  insert into public.tenants (id, slug, name)
    values (tenant_a, 'double-booking-test', 'Double booking test');
  insert into public.locations (id, tenant_id, name, timezone, is_primary)
    values (loc_a, tenant_a, 'Test location', 'Europe/Stockholm', true);
  insert into public.services (
    id, tenant_id, location_id, name, duration_min, price_cents, active
  ) values (svc_a, tenant_a, loc_a, 'Test service', 30, 12500, true);
  insert into public.staff (id, tenant_id, location_id, title, active)
    values (staff_a, tenant_a, loc_a, 'Test staff', false);
  insert into public.staff_services (tenant_id, staff_id, service_id)
    values (tenant_a, staff_a, svc_a);
  insert into public.working_hours (
    tenant_id, staff_id, location_id, weekday, start_time, end_time
  ) values (tenant_a, staff_a, loc_a, 1, '09:00', '18:00');
  insert into public.location_opening_hours (
    tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
  ) values (tenant_a, loc_a, 1, '09:00', '18:00', 'confirmed', now());
  update public.staff set active = true where id = staff_a;

  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id,
    start_ts, end_ts, status, price_cents
  ) values (
    'd0000000-0000-0000-0000-000000000071', tenant_a, loc_a, staff_a, svc_a,
    t0, t0 + interval '30 min', 'confirmed', 12500
  );

  begin
    insert into public.bookings (
      tenant_id, location_id, staff_id, service_id,
      start_ts, end_ts, status, price_cents
    ) values (
      tenant_a, loc_a, staff_a, svc_a,
      t0 + interval '15 min', t0 + interval '45 min', 'confirmed', 12500
    );
    raise exception 'DOUBLE-BOOKING TEST FAILED: overlapping insert was allowed';
  exception
    when exclusion_violation then
      raise notice 'DOUBLE-BOOKING TEST PASS: exclusion_violation raised as expected';
  end;
end $$;

rollback;
