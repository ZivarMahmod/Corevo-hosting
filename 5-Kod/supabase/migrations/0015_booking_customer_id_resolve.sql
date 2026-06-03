-- 0015 — Additive customer_id resolution on every RPC booking insert.
-- Closes the customer_profile_id/customer_id split-brain WITHOUT ever repointing
-- customer_profile_id (the live RLS/GDPR/konto key). create_public_booking now ALSO
-- populates bookings.customer_id by lazy-resolving/creating a public.customers row.
-- Loyalty-earn (0016) depends on this. customer_profile_id is left untouched.
-- Atomic single migration (DROP+CREATE+REVOKE+GRANT in one apply — no grant window).
set search_path = public;

-- 1) Shared resolver: returns a customers.id for the booking identity, lazy-creating
--    the row. SECURITY DEFINER so it upserts customers regardless of caller RLS.
--    AUTHED branch keys on (tenant, auth_user_id) and leaves contact_hash NULL
--    (collision-safe). GUEST branch keys on (tenant, contact_hash); no hashable
--    contact -> NULL (no stable key, matches the 0011 backfill skip).
create or replace function private.resolve_customer_id(
  p_tenant      uuid,
  p_auth_user   uuid,
  p_full_name   text,
  p_email       text,
  p_phone       text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_hash text;
begin
  if p_tenant is null then return null; end if;

  if p_auth_user is not null then
    insert into public.customers (tenant_id, auth_user_id, full_name, email, phone, last_seen_at)
    values (p_tenant, p_auth_user, nullif(btrim(p_full_name),''), nullif(btrim(p_email),''), nullif(btrim(p_phone),''), now())
    on conflict (tenant_id, auth_user_id) where (auth_user_id is not null)
      do update set last_seen_at = now(),
                    full_name = coalesce(customers.full_name, excluded.full_name),
                    email     = coalesce(customers.email,     excluded.email),
                    phone     = coalesce(customers.phone,     excluded.phone)
    returning id into v_id;
    return v_id;
  end if;

  v_hash := public.customer_contact_hash(p_tenant, p_email, p_phone);
  if v_hash is null then
    return null;
  end if;
  insert into public.customers (tenant_id, contact_hash, full_name, email, phone, last_seen_at)
  values (p_tenant, v_hash, nullif(btrim(p_full_name),''), nullif(btrim(p_email),''), nullif(btrim(p_phone),''), now())
  on conflict (tenant_id, contact_hash) where (contact_hash is not null)
    do update set last_seen_at = now(),
                  full_name = coalesce(customers.full_name, excluded.full_name),
                  email     = coalesce(customers.email,     excluded.email),
                  phone     = coalesce(customers.phone,     excluded.phone)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.resolve_customer_id(uuid,uuid,text,text,text) from public;

-- 2) Replace create_public_booking with structured guest params + additive customer_id.
--    Body preserved EXACTLY from the live 0009 definition; only the customer_id
--    resolution + insert column are new. customer_profile_id (= p_customer) UNCHANGED.
drop function if exists public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid);

create or replace function public.create_public_booking(
  p_tenant_slug text,
  p_service     uuid,
  p_staff       uuid,
  p_start       timestamptz,
  p_note        text default null,
  p_customer    uuid default null,
  p_guest_name  text default null,
  p_guest_email text default null,
  p_guest_phone text default null
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

  select l.id into v_location from public.locations l
   where l.tenant_id = v_tenant and l.is_primary limit 1;

  -- NEW: resolve the additive customer_id (customer_profile_id stays = p_customer).
  if p_customer is not null then
    -- authed: pull canonical PII from public.users; structured guest fields ignored.
    select u.email, u.phone into v_email, v_phone from public.users u where u.id = p_customer;
    v_customer_id := private.resolve_customer_id(v_tenant, p_customer, nullif(btrim(p_guest_name),''), v_email, v_phone);
  else
    -- guest: structured fields (the caller still writes the note seam for notifications).
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

revoke execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text) from public;
grant  execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text) to anon, authenticated;
