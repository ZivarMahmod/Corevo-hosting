-- 0022 — staff↔location fence in create_public_booking (VÅG 5, agent-B HIGH).
--
-- DEFECT (rolled-back repro, VÅG 5): the 10-arg create_public_booking (0021)
-- validates p_location belongs-to-tenant + active, but NEVER checks that the chosen
-- staff actually works at that location. The RPC is anon-granted, so a crafted
-- REST/rpc call that skips the storefront UI could book a staff member at a location
-- they have no working_hours at — a scheduling-integrity hole (intra-tenant; the
-- tenant boundary itself held, cross-tenant p_location was already rejected).
--
-- FIX: mirror the availability READ-layer exactly. getAvailableSlots (boka/actions.ts
-- L133-145) restricts the candidate staff set to those with ≥1 working_hours row at
-- the chosen location ("stationed at L"); we now enforce the same invariant in the
-- write path so a direct RPC caller can't bypass it. Every legit UI booking already
-- satisfies this (the wizard only offers staff at the location), so no flow breaks;
-- FreshCut (1 location, all staff hours backfilled to primary by 0021) is unchanged.
--
-- create-or-replace (signature + grants unchanged); body is byte-identical to 0021
-- with ONE added fence block. Rollback = re-run 0021's function body.
set search_path = public;

create or replace function public.create_public_booking(
  p_tenant_slug text,
  p_service     uuid,
  p_staff       uuid,
  p_start       timestamptz,
  p_note        text default null,
  p_customer    uuid default null,
  p_guest_name  text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_location    uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid; v_duration int; v_price int; v_location uuid; v_id uuid;
  v_uid uuid := auth.uid();
  v_customer_id uuid;
  v_email text; v_phone text;
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

  -- location resolution (0021). A validated p_location (ours + active) wins; null
  -- falls back to the primary (byte-identical 1-location behavior). bookings.location_id
  -- is NOT NULL, so a non-null v_location is guaranteed or we raise.
  if p_location is not null then
    select l.id into v_location from public.locations l
     where l.id = p_location and l.tenant_id = v_tenant and l.active;
    if v_location is null then raise exception 'invalid_location' using errcode = 'P0002'; end if;
  else
    select l.id into v_location from public.locations l
     where l.tenant_id = v_tenant and l.is_primary and l.active limit 1;
  end if;
  if v_location is null then raise exception 'no_location' using errcode = 'P0002'; end if;

  -- NEW (0022 / VÅG 5): staff↔location fence. A staff member is bookable at a
  -- location iff they have ≥1 working_hours row there — the SAME signal the
  -- availability read-layer uses (getAvailableSlots restricts candidates to staff
  -- with working_hours at the chosen location). The RPC is anon-granted, so enforce
  -- it here too; a direct caller that skips the UI must not book staff at a location
  -- they don't work at. Errcode P0002 (booking action maps it → "välj ny tid").
  if not exists (
    select 1 from public.working_hours wh
     where wh.staff_id = p_staff and wh.location_id = v_location and wh.tenant_id = v_tenant
  ) then raise exception 'invalid_staff_location' using errcode = 'P0002'; end if;

  -- resolve the additive customer_id (customer_profile_id stays = p_customer).
  if p_customer is not null then
    select u.email, u.phone into v_email, v_phone from public.users u where u.id = p_customer;
    v_customer_id := private.resolve_customer_id(v_tenant, p_customer, nullif(btrim(p_guest_name),''), v_email, v_phone);
  else
    v_customer_id := private.resolve_customer_id(v_tenant, null, p_guest_name, p_guest_email, p_guest_phone);
  end if;

  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id, customer_profile_id, customer_id,
    start_ts, end_ts, status, price_cents, note
  ) values (
    v_tenant, v_location, p_staff, p_service, p_customer, v_customer_id,
    p_start, p_start + (v_duration * interval '1 minute'), 'pending', v_price, p_note
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Grants are preserved by create-or-replace; re-assert for explicitness/idempotency.
revoke execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid) from public;
grant  execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid) to anon, authenticated;
