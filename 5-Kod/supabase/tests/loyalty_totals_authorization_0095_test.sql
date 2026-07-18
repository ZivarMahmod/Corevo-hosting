-- 0095 runtime: customer_loyalty_totals får kringgå booking-RLS enbart efter
-- explicit kundkortsauktorisering. Rå bokningsåtkomst förblir platsbegränsad.
-- Körs mot ett färskt migrerat testschema och rullas alltid tillbaka.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Lokala PostgreSQL-körningar saknar Supabases Data API-default grants.
-- RLS är fortfarande den radvisa auktoritetsgränsen.
grant select on public.bookings to authenticated;

insert into public.tenants (id, slug, name) values
  ('95100000-0000-0000-0000-000000000001', 'loyalty-auth-a', 'Loyalty auth A'),
  ('95100000-0000-0000-0000-000000000002', 'loyalty-auth-x', 'Loyalty auth X');

insert into public.locations (id, tenant_id, name, is_primary, timezone) values
  ('95100000-0000-0000-0000-000000000011', '95100000-0000-0000-0000-000000000001', 'A', true, 'UTC'),
  ('95100000-0000-0000-0000-000000000012', '95100000-0000-0000-0000-000000000001', 'B', false, 'UTC'),
  ('95100000-0000-0000-0000-000000000013', '95100000-0000-0000-0000-000000000002', 'X', true, 'UTC');

insert into public.roles (id, tenant_id, name, level) values
  ('95100000-0000-0000-0000-000000000021', '95100000-0000-0000-0000-000000000001', 'staff', 3),
  ('95100000-0000-0000-0000-000000000022', '95100000-0000-0000-0000-000000000001', 'customer', 2),
  ('95100000-0000-0000-0000-000000000023', '95100000-0000-0000-0000-000000000001', 'owner', 6),
  ('95100000-0000-0000-0000-000000000024', null, 'platform_admin', 8);

insert into auth.users (id, email) values
  ('95100000-0000-0000-0000-000000000101', 'restricted-staff@example.test'),
  ('95100000-0000-0000-0000-000000000102', 'customer@example.test'),
  ('95100000-0000-0000-0000-000000000103', 'inactive-owner@example.test'),
  ('95100000-0000-0000-0000-000000000104', 'platform@example.test');

insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  ('95100000-0000-0000-0000-000000000101', '95100000-0000-0000-0000-000000000001', 'restricted-staff@example.test', '95100000-0000-0000-0000-000000000021', 'active', 'locations'),
  ('95100000-0000-0000-0000-000000000102', '95100000-0000-0000-0000-000000000001', 'customer@example.test', '95100000-0000-0000-0000-000000000022', 'active', 'locations'),
  ('95100000-0000-0000-0000-000000000103', '95100000-0000-0000-0000-000000000001', 'inactive-owner@example.test', '95100000-0000-0000-0000-000000000023', 'inactive', 'organization'),
  -- En giltig platform-claim/global roll får inte använda tenantkundens totals-RPC.
  ('95100000-0000-0000-0000-000000000104', '95100000-0000-0000-0000-000000000001', 'platform@example.test', '95100000-0000-0000-0000-000000000024', 'active', 'organization');

insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents, active
) values
  ('95100000-0000-0000-0000-000000000031', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000011', 'A service', 30, 10000, true),
  ('95100000-0000-0000-0000-000000000032', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000012', 'B service', 30, 10000, true),
  ('95100000-0000-0000-0000-000000000033', '95100000-0000-0000-0000-000000000002', '95100000-0000-0000-0000-000000000013', 'X service', 30, 10000, true);

insert into public.staff (id, tenant_id, location_id, profile_id, title, active) values
  ('95100000-0000-0000-0000-000000000041', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000011', '95100000-0000-0000-0000-000000000101', 'Staff A', false),
  ('95100000-0000-0000-0000-000000000042', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000012', null, 'Staff B', false),
  ('95100000-0000-0000-0000-000000000043', '95100000-0000-0000-0000-000000000002', '95100000-0000-0000-0000-000000000013', null, 'Staff X', false);

insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000041', '95100000-0000-0000-0000-000000000031'),
  ('95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000042', '95100000-0000-0000-0000-000000000032'),
  ('95100000-0000-0000-0000-000000000002', '95100000-0000-0000-0000-000000000043', '95100000-0000-0000-0000-000000000033');

insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
) values (
  '95100000-0000-0000-0000-000000000001',
  '95100000-0000-0000-0000-000000000011',
  '95100000-0000-0000-0000-000000000041', 1, '09:00', '17:00'
);
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
) values (
  '95100000-0000-0000-0000-000000000001',
  '95100000-0000-0000-0000-000000000011',
  1, '09:00', '17:00', 'confirmed', now()
);
update public.staff set active = true
 where id = '95100000-0000-0000-0000-000000000041';

insert into public.customers (id, tenant_id, auth_user_id, full_name) values
  ('95100000-0000-0000-0000-000000000051', '95100000-0000-0000-0000-000000000001', null, 'Two-location customer'),
  ('95100000-0000-0000-0000-000000000052', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000102', 'Own customer'),
  ('95100000-0000-0000-0000-000000000053', '95100000-0000-0000-0000-000000000002', null, 'Cross-tenant customer');

insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values
  ('95100000-0000-0000-0000-000000000061', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000011', '95100000-0000-0000-0000-000000000041', '95100000-0000-0000-0000-000000000031', '95100000-0000-0000-0000-000000000051', current_timestamp - interval '4 days', current_timestamp - interval '4 days' + interval '30 minutes', 'completed', 10000),
  ('95100000-0000-0000-0000-000000000062', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000012', '95100000-0000-0000-0000-000000000042', '95100000-0000-0000-0000-000000000032', '95100000-0000-0000-0000-000000000051', current_timestamp - interval '3 days', current_timestamp - interval '3 days' + interval '30 minutes', 'completed', 10000),
  ('95100000-0000-0000-0000-000000000063', '95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000011', '95100000-0000-0000-0000-000000000041', '95100000-0000-0000-0000-000000000031', '95100000-0000-0000-0000-000000000052', current_timestamp - interval '2 days', current_timestamp - interval '2 days' + interval '30 minutes', 'completed', 10000);

insert into public.loyalty_ledger (
  tenant_id, customer_id, booking_id, points_delta, reason
) values
  ('95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000051', '95100000-0000-0000-0000-000000000061', 50, 'earn_completed'),
  ('95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000051', '95100000-0000-0000-0000-000000000062', 50, 'earn_completed'),
  ('95100000-0000-0000-0000-000000000001', '95100000-0000-0000-0000-000000000052', '95100000-0000-0000-0000-000000000063', 25, 'earn_completed');

-- Restriktiv personal får kundkortet eftersom kunden har en bokning på A. Rå
-- booking-RLS visar bara A, medan den auktoriserade totals-RPC:n returnerar hela
-- kundens tenantbundna saldo/lifetime från A+B.
reset role;
select set_config('request.jwt.claim.sub', '95100000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95100000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"95100000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ declare v_raw int; v_balance bigint; v_lifetime bigint; begin
  select count(*) into v_raw from public.bookings
   where customer_id = '95100000-0000-0000-0000-000000000051';
  if v_raw <> 1 then raise exception 'restricted_staff_raw_booking_count_%', v_raw; end if;

  select balance, lifetime into v_balance, v_lifetime
    from public.customer_loyalty_totals(
      '95100000-0000-0000-0000-000000000001',
      '95100000-0000-0000-0000-000000000051'
    );
  if v_balance <> 100 or v_lifetime <> 100 then
    raise exception 'restricted_staff_totals_inconsistent_%_%', v_balance, v_lifetime;
  end if;
end $$;

do $$ begin
  begin
    perform * from public.customer_loyalty_totals(
      '95100000-0000-0000-0000-000000000002',
      '95100000-0000-0000-0000-000000000053'
    );
    raise exception 'cross_tenant_totals_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Kundrollen får exakt den egna aktiva kundidentiteten, aldrig grannens kort.
reset role;
select set_config('request.jwt.claim.sub', '95100000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95100000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"tenant_id":"95100000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ declare v_balance bigint; v_lifetime bigint; begin
  select balance, lifetime into v_balance, v_lifetime
    from public.customer_loyalty_totals(
      '95100000-0000-0000-0000-000000000001',
      '95100000-0000-0000-0000-000000000052'
    );
  if v_balance <> 25 or v_lifetime <> 25 then
    raise exception 'customer_own_totals_wrong_%_%', v_balance, v_lifetime;
  end if;

  begin
    perform * from public.customer_loyalty_totals(
      '95100000-0000-0000-0000-000000000001',
      '95100000-0000-0000-0000-000000000051'
    );
    raise exception 'customer_other_totals_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Inaktiv lokal ägare och global platform-roll nekas även med rätt tenant-id i
-- anropet. Platform-claim är aldrig en tenantkundkortsbehörighet.
reset role;
select set_config('request.jwt.claim.sub', '95100000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95100000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"tenant_id":"95100000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  begin
    perform * from public.customer_loyalty_totals(
      '95100000-0000-0000-0000-000000000001',
      '95100000-0000-0000-0000-000000000051'
    );
    raise exception 'inactive_user_totals_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '95100000-0000-0000-0000-000000000104', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"95100000-0000-0000-0000-000000000104","role":"authenticated","app_metadata":{"tenant_id":"95100000-0000-0000-0000-000000000001","platform_admin":true}}', true);
set local role authenticated;
do $$ begin
  begin
    perform * from public.customer_loyalty_totals(
      '95100000-0000-0000-0000-000000000001',
      '95100000-0000-0000-0000-000000000051'
    );
    raise exception 'platform_role_totals_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
