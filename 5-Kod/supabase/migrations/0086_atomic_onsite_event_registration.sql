-- 0086 — atomisk kursanmälan för "betala på plats".
--
-- Appens tidigare check-then-insert kunde överboka när två anmälningar tog de
-- sista platserna samtidigt. Funktionen låser eventraden och räknar både
-- bekräftade anmälningar och checkout-holds innan den skriver PII-raden.
-- Endast serverns service_role får anropa den publika formulärvägen.

create or replace function public.create_onsite_event_registration(
  p_tenant uuid,
  p_event uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_party_size integer,
  p_message text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.tenant_events%rowtype;
  v_taken integer := 0;
  v_left integer := 0;
  v_registration uuid;
begin
  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_email is null or char_length(btrim(p_email)) < 3 or char_length(btrim(p_email)) > 160 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_phone is not null and char_length(btrim(p_phone)) > 40 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_party_size is null or p_party_size < 1 or p_party_size > 8 then
    raise exception 'invalid_party_size' using errcode = '22023';
  end if;
  if p_message is not null and char_length(btrim(p_message)) > 2000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  select e.*
    into v_event
    from public.tenant_events e
   where e.id = p_event
     and e.tenant_id = p_tenant
   for update;

  if v_event.id is null or v_event.status <> 'open' or v_event.starts_at <= now() then
    raise exception 'event_not_open' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.tenant_modules tm
     where tm.tenant_id = p_tenant
       and tm.module_key = 'kurser'
       and tm.state = 'live'
       and coalesce(tm.config->>'payment', 'onsite') = 'onsite'
  ) then
    raise exception 'onsite_registration_not_live' using errcode = '42501';
  end if;

  select coalesce(sum(r.party_size), 0)::integer
    into v_taken
    from public.event_registrations r
   where r.tenant_id = p_tenant
     and r.event_id = p_event
     and r.status = 'confirmed';

  v_left := greatest(0, v_event.capacity - v_taken - coalesce(v_event.reserved_qty, 0));
  if p_party_size > v_left then
    raise exception 'event_capacity_exceeded'
      using errcode = '23P01', detail = v_left::text;
  end if;

  insert into public.event_registrations (
    tenant_id, event_id, name, email, phone, party_size, message, status
  ) values (
    p_tenant,
    p_event,
    btrim(p_name),
    btrim(p_email),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_party_size,
    nullif(btrim(coalesce(p_message, '')), ''),
    'confirmed'
  ) returning id into v_registration;

  return jsonb_build_object(
    'registration_id', v_registration,
    'seats_left', v_left - p_party_size
  );
end;
$$;

revoke all on function public.create_onsite_event_registration(
  uuid, uuid, text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.create_onsite_event_registration(
  uuid, uuid, text, text, text, integer, text
) to service_role;
