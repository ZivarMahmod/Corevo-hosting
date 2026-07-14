-- ▸ FIL: 0064_idempotens_fangar_krockskyddet.sql
-- ▸ (döp SQL-Editor-fliken till detta — Supabase kallar den annars "Untitled query")

-- 0064 — goal-67: idempotens-handlern fångade FEL undantag.
--
-- FYND (belastningstest, 6-Testing/goal-67-belastningstest.md): 10 samtidiga anrop med
-- SAMMA request_id → 9 av 10 anropare fick "tiden togs precis" (23P01) för sin EGEN
-- bokning. Databasen hade rätt (exakt 1 rad), men SVARET ljög.
--
-- Varför: 0048:s handler fångar bara `unique_violation` (23505). Men EXCLUDE-constrainten
-- `no_double_booking` fyrar FÖRE unik-indexet på (tenant_id, request_id), och den kastar
-- `exclusion_violation` (23P01). Undantaget gick alltså rakt förbi den handler som skrevs
-- för att fånga precis det här fallet.
--
-- Det ÄR den dolda dubbelbokningsfällan 0048 skrevs för att döda: kunden dubbelklickar
-- "Boka" (eller nätet retryar) och får veta att tiden är upptagen — av sig själv.
--
-- Fixen är EN rad: fånga båda undantagen. Allt annat är 0048:s funktion ORDAGRANT —
-- identitetsvakten, dåtidsspärren, search_path, alla felkoder. Krockskyddet försvagas
-- inte en millimeter: utan request_id (eller när ingen rad med vårt request_id finns)
-- re-raisas felet precis som förut — en ÄKTA dubbelbokning får aldrig sväljas.
--
-- Idempotent (create or replace). Rör ingen constraint, inget index, ingen signatur.

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
  p_location    uuid default null,
  p_request_id  uuid default null
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

  -- IDEMPOTENS (0048): samma request-id igen ⇒ svaret gick förlorat, inte
  -- bokningen. Returnera den befintliga raden — kunden får sitt riktiga
  -- boknings-id i stället för en dubblett eller en vilseledande 23P01.
  if p_request_id is not null then
    select b.id into v_id from public.bookings b
     where b.tenant_id = v_tenant and b.request_id = p_request_id;
    if v_id is not null then return v_id; end if;
  end if;

  select s.duration_min, s.price_cents into v_duration, v_price from public.services s
   where s.id = p_service and s.tenant_id = v_tenant and s.active = true;
  if v_duration is null then raise exception 'invalid_service' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.staff st
      join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service
     where st.id = p_staff and st.tenant_id = v_tenant and st.active = true
  ) then raise exception 'invalid_staff' using errcode = 'P0002'; end if;

  -- location resolution (0021). A validated p_location (ours + active) wins; null
  -- falls back to the primary (byte-identical 1-location behavior).
  if p_location is not null then
    select l.id into v_location from public.locations l
     where l.id = p_location and l.tenant_id = v_tenant and l.active;
    if v_location is null then raise exception 'invalid_location' using errcode = 'P0002'; end if;
  else
    select l.id into v_location from public.locations l
     where l.tenant_id = v_tenant and l.is_primary and l.active limit 1;
  end if;
  if v_location is null then raise exception 'no_location' using errcode = 'P0002'; end if;

  -- staff↔location fence (0022): bookable iff ≥1 working_hours row at the location.
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

  begin
    insert into public.bookings (
      tenant_id, location_id, staff_id, service_id, customer_profile_id, customer_id,
      start_ts, end_ts, status, price_cents, note, request_id
    ) values (
      v_tenant, v_location, p_staff, p_service, p_customer, v_customer_id,
      p_start, p_start + (v_duration * interval '1 minute'), 'pending', v_price, p_note, p_request_id
    ) returning id into v_id;
  exception when unique_violation or exclusion_violation then
    -- 0064: BÅDA. EXCLUDE (23P01) fyrar före unik-indexet på (tenant_id, request_id).
    -- Utan den här grenen fick den egna retryn "tiden är upptagen" av sin egen bokning.
    -- Race: två identiska retries samtidigt — förloraren läser vinnarens rad.
    -- Enda unika indexet på bookings som kan slå här är (tenant_id, request_id);
    -- utan request-id finns inget att läsa → re-raise.
    if p_request_id is null then raise; end if;
    select b.id into v_id from public.bookings b
     where b.tenant_id = v_tenant and b.request_id = p_request_id;
    if v_id is null then raise; end if;
  end;
  return v_id;
end;
$$;

revoke execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid) from public;
grant  execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid) to anon, authenticated;
