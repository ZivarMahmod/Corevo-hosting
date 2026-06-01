-- 0009 — create_public_booking identity + past-time hardening (FAS 3 security)
--
-- create_public_booking is SECURITY DEFINER and `grant execute ... to anon` (0005),
-- so it is callable DIRECTLY via PostgREST with the public anon key — bypassing the
-- entire server action (rate-limit, validation, header-tenant resolution). The
-- review found two write-path holes that only the RPC (the unbypassable layer) can
-- close:
--   1. p_customer was inserted into bookings.customer_profile_id with NO check that
--      it matches the caller → an anon/auth caller could FORGE attribution onto any
--      user id (customer_profile_id is the kund "my bookings" ownership key).
--   2. No p_start sanity → past-dated spam bookings were accepted.
--
-- Identity rule (matches the two legitimate callers):
--   · anon  (auth.uid() IS NULL): may ONLY create unattributed guest bookings
--     (createBooking calls the RPC without p_customer). p_customer MUST be NULL.
--   · authenticated: may ONLY attribute to themselves (rebookBooking passes
--     p_customer = user.id). p_customer, if given, MUST equal auth.uid().
-- A logged-in user using the public guest wizard (no p_customer) still works — NULL
-- is allowed for everyone; only a NON-NULL mismatch is rejected.
--
-- NOTE: full working-hours / slot-step alignment enforcement (mirroring
-- availability.ts computeSlots) is a deliberate FOLLOW-UP — it must match the read
-- path exactly or it rejects legitimate bookings. This migration adds only the
-- cheap, regression-safe past-time guard; the EXCLUDE constraint already blocks
-- overlaps.

create or replace function public.create_public_booking(
  p_tenant_slug text,
  p_service uuid,
  p_staff uuid,
  p_start timestamptz,
  p_note text default null,
  p_customer uuid default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tenant uuid; v_duration int; v_price int; v_location uuid; v_id uuid;
  v_uid uuid := auth.uid();
begin
  -- Identity fence (the action layer is bypassable; this is not).
  if v_uid is null then
    if p_customer is not null then
      raise exception 'forbidden_customer' using errcode = '42501';
    end if;
  elsif p_customer is not null and p_customer <> v_uid then
    raise exception 'forbidden_customer' using errcode = '42501';
  end if;

  -- No past-dated bookings (cheap anti-spam; small grace for clock skew / slot edge).
  if p_start < (now() - interval '2 minutes') then
    raise exception 'start_in_past' using errcode = 'P0001';
  end if;

  select t.id into v_tenant from public.tenants t
   where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002'; end if;

  select s.duration_min, s.price_cents into v_duration, v_price from public.services s
   where s.id = p_service and s.tenant_id = v_tenant and s.active = true;
  if v_duration is null then raise exception 'invalid_service' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.staff st
      join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service
     where st.id = p_staff and st.tenant_id = v_tenant and st.active = true
  ) then raise exception 'invalid_staff' using errcode = 'P0002'; end if;

  select l.id into v_location from public.locations l
   where l.tenant_id = v_tenant and l.is_primary limit 1;

  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id, customer_profile_id,
    start_ts, end_ts, status, price_cents, note
  ) values (
    v_tenant, v_location, p_staff, p_service, p_customer,
    p_start, p_start + (v_duration * interval '1 minute'), 'pending', v_price, p_note
  ) returning id into v_id;
  return v_id;
end;
$function$;
