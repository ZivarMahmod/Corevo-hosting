-- 0070 — adminbokning skapar/länkar alltid en riktig kundrad.
--
-- Publika create_public_booking måste tillåta en anonym bokning med bara namn och
-- kan därför inte deduplicera den mot customers utan e-post/telefon. Adminflödet
-- lovar däremot att namn räcker för att skapa en kund. Den här smala wrappern gör
-- bokning + kundkoppling i SAMMA transaktion och lämnar den publika RPC:n orörd.
--
-- SECURITY DEFINER behövs för den atomiska skrivningen, men funktionen är endast
-- körbar av authenticated och verifierar dessutom auth, roll, tenant och vald kund
-- i kroppen. search_path är tom; alla objekt är kvalificerade.

create or replace function public.create_admin_booking(
  p_service     uuid,
  p_staff       uuid,
  p_start       timestamptz,
  p_request_id  uuid,
  p_customer_id uuid default null,
  p_guest_name  text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_note        text default null,
  p_location    uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_slug text;
  v_booking_id uuid;
  v_customer_id uuid;
  v_guest_name text := nullif(btrim(p_guest_name), '');
  v_guest_email text := nullif(btrim(p_guest_email), '');
  v_guest_phone text := nullif(btrim(p_guest_phone), '');
begin
  if auth.uid() is null or coalesce(private.role_level(), 0) < 3 then
    raise exception 'forbidden_admin_booking' using errcode = '42501';
  end if;

  select t.id, t.slug into v_tenant, v_slug
    from public.tenants t
   where t.id = private.tenant_id()
     and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;
  if p_request_id is null then
    raise exception 'invalid_request_id' using errcode = 'P0002';
  end if;

  -- Serialisera samma bokningsintent. Utan låset kan två samtidiga retries båda
  -- passera förkontrollen och förloraren sedan skriva sin kund på vinnarens rad.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_tenant::text || ':' || p_request_id::text, 0)
  );

  -- Samma request-id är en retry, inte tillstånd att byta kund på en redan skapad
  -- bokning. Returnera innan någon kundrad kan ändras eller skapas.
  select b.id into v_booking_id
    from public.bookings b
   where b.tenant_id = v_tenant
     and b.request_id = p_request_id;
  if v_booking_id is not null then
    return pg_catalog.jsonb_build_object('booking_id', v_booking_id, 'created', false);
  end if;

  if p_customer_id is not null then
    select c.id into v_customer_id
      from public.customers c
     where c.id = p_customer_id
       and c.tenant_id = v_tenant
       and c.status = 'active';
    if v_customer_id is null then
      raise exception 'invalid_customer' using errcode = 'P0002';
    end if;
  elsif v_guest_name is null then
    raise exception 'customer_name_required' using errcode = 'P0002';
  end if;

  -- Den kanoniska boknings-RPC:n äger fortfarande alla slot-, resurs-, plats-,
  -- kapacitets- och idempotensvakter. För en vald kund skickas inga gästfält;
  -- länken sätts exakt nedan och kan därför inte skapa en kontakt-dubblett.
  v_booking_id := public.create_public_booking(
    p_tenant_slug => v_slug,
    p_service      => p_service,
    p_staff        => p_staff,
    p_start        => p_start,
    p_note         => p_note,
    p_customer     => null,
    p_guest_name   => case when p_customer_id is null then v_guest_name else null end,
    p_guest_email  => case when p_customer_id is null then v_guest_email else null end,
    p_guest_phone  => case when p_customer_id is null then v_guest_phone else null end,
    p_location     => p_location,
    p_request_id   => p_request_id
  );

  if v_customer_id is null then
    -- Med kontaktuppgift har create_public_booking redan löst/skapat den stabila
    -- kundidentiteten. Läs länken från bokningen, fortfarande i samma transaktion.
    select b.customer_id into v_customer_id
      from public.bookings b
     where b.id = v_booking_id
       and b.tenant_id = v_tenant;

    -- Namn-only saknar medvetet contact_hash och går inte att deduplicera säkert.
    -- Admin har uttryckligen skapat kunden, så en riktig separat kundrad är korrekt.
    if v_customer_id is null then
      if v_guest_email is not null or v_guest_phone is not null then
        raise exception 'customer_resolution_failed' using errcode = 'P0002';
      end if;
      insert into public.customers (tenant_id, full_name, last_seen_at)
      values (v_tenant, v_guest_name, now())
      returning id into v_customer_id;
    end if;
  else
    update public.customers c
       set last_seen_at = now()
     where c.id = v_customer_id
       and c.tenant_id = v_tenant;
  end if;

  update public.bookings b
     set customer_id = v_customer_id,
         status = 'confirmed'
   where b.id = v_booking_id
     and b.tenant_id = v_tenant;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object('booking_id', v_booking_id, 'created', true);
end;
$$;

revoke execute on function public.create_admin_booking(uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid) from public;
grant execute on function public.create_admin_booking(uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid) to authenticated;

comment on function public.create_admin_booking(uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid) is
  'Atomisk adminbokning som tenant-säkert skapar eller länkar public.customers.';
