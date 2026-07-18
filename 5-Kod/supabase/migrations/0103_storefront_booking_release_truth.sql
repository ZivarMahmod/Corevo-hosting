-- 0103 — storefrontens betalningssvar och bokningsstatus måste säga samma sak.
--
-- Appens release-grind är medvetet fail-closed och separat från tenantens gamla
-- Stripe-flaggor. Före denna migration kunde RPC:n skapa status=pending enbart för
-- att de gamla flaggorna var på, samtidigt som appen (korrekt) svarade
-- requiresPayment=false. Resultatet blev en betala-på-plats-bokning utan checkout
-- som ändå såg obekräftad ut.
--
-- Den nya, service-only overloaden bär den effektiva release-sanningen in i samma
-- databastransaktion. En trigger begränsad till just den explicita storefront-
-- kontexten väljer initial status innan INSERT: godkännandekrav bevaras alltid,
-- onlinebetalning räknas endast när både release och de gamla Stripe-flaggorna är på.

begin;

alter table public.bookings
  add column if not exists requires_online_payment boolean not null default false;

comment on column public.bookings.requires_online_payment is
  'Atomiskt storefront-snapshot: denna bokning skapades med en aktiv, tenantredo onlinebetalningsräls.';

create or replace function private.apply_storefront_booking_release_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_require_approval boolean := false;
  v_online_pay boolean := false;
  v_online_payment_released boolean := false;
begin
  if pg_catalog.current_setting('app.booking_source', true) is distinct from 'storefront_release' then
    return new;
  end if;

  v_online_payment_released := coalesce(
    pg_catalog.current_setting('app.booking_online_payment_released', true) = 'true',
    false
  );

  select
    coalesce((ts.settings->>'require_booking_approval')::boolean, false),
    coalesce(ts.payments_enabled, false)
      and coalesce(t.stripe_charges_enabled, false)
    into v_require_approval, v_online_pay
  from public.tenants t
  left join public.tenant_settings ts on ts.tenant_id = t.id
  where t.id = new.tenant_id;

  new.requires_online_payment := v_online_payment_released and v_online_pay;
  new.status := case
    when v_require_approval or new.requires_online_payment then 'pending'
    else 'confirmed'
  end;
  return new;
end;
$$;

revoke all on function private.apply_storefront_booking_release_status()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_storefront_booking_release_status on public.bookings;
create trigger trg_storefront_booking_release_status
  before insert on public.bookings
  for each row execute function private.apply_storefront_booking_release_status();

create or replace function public.create_storefront_booking_with_release(
  p_tenant_slug text,
  p_service uuid,
  p_staff uuid,
  p_start timestamptz,
  p_note text default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_location uuid default null,
  p_request_id uuid default null,
  p_online_payment_released boolean default false
) returns table (booking_id uuid, requires_payment boolean, booking_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking uuid;
begin
  perform pg_catalog.set_config('app.booking_source', 'storefront_release', true);
  perform pg_catalog.set_config(
    'app.booking_online_payment_released',
    case when coalesce(p_online_payment_released, false) then 'true' else 'false' end,
    true
  );

  v_booking := public.create_storefront_booking(
    p_tenant_slug,
    p_service,
    p_staff,
    p_start,
    p_note,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_location,
    p_request_id
  );

  return query
  select b.id, b.requires_online_payment, b.status
    from public.bookings b
   where b.id = v_booking;
end;
$$;

-- Den gamla 10-argumentsvägen är implementation för release-wrappern, inte längre en
-- service-role-ingång. Därmed kan en glömd server-call inte falla tillbaka till den
-- gamla betalningssanningen.
revoke execute on function public.create_storefront_booking(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid
) from service_role;
revoke all on function public.create_storefront_booking_with_release(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean
) from public, anon, authenticated, service_role;
grant execute on function public.create_storefront_booking_with_release(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean
) to service_role;

comment on function public.create_storefront_booking_with_release(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean
) is 'Publik service-role-skrivväg där effektiv betalningsrelease deltar atomiskt i initial bokningsstatus; default false.';

commit;
