-- ============================================================================
-- Double-booking guard proof. Two overlapping 'confirmed' bookings on the same
-- staff member must raise exclusion_violation on the second insert. Self-cleans.
-- ============================================================================
do $$
declare
  tenant_a uuid := '11111111-1111-1111-1111-111111111111';
  staff_a  uuid := '44444444-0000-0000-0000-000000000001';
  svc_a    uuid := '55555555-0000-0000-0000-000000000001';
  t0       timestamptz := timestamptz '2030-01-01 10:00:00+00';
begin
  insert into public.bookings (tenant_id, staff_id, service_id, start_ts, end_ts, status)
    values (tenant_a, staff_a, svc_a, t0, t0 + interval '30 min', 'confirmed');

  begin
    insert into public.bookings (tenant_id, staff_id, service_id, start_ts, end_ts, status)
      values (tenant_a, staff_a, svc_a, t0 + interval '15 min', t0 + interval '45 min', 'confirmed');
    -- should never reach here
    delete from public.bookings where staff_id = staff_a and start_ts >= t0 and start_ts < t0 + interval '1 hour';
    raise exception 'DOUBLE-BOOKING TEST FAILED: overlapping insert was allowed';
  exception
    when exclusion_violation then
      raise notice 'DOUBLE-BOOKING TEST PASS: exclusion_violation raised as expected';
  end;

  -- cleanup the first (committed) test booking
  delete from public.bookings where staff_id = staff_a and start_ts = t0;
end $$;
