-- 0101 runtime: claim continuity, completed-only relationship, internal notes
-- and location-aware contact PII. Run on a fresh migrated DB; everything rolls back.
begin;

grant select on public.bookings, public.customers, public.customer_notes,
  public.customer_favorites to authenticated;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.tenants (id, slug, name) values
  ('a1010000-0000-0000-0000-000000000001', 'relation-0101', 'Relation 0101');
insert into public.locations (id, tenant_id, name, is_primary) values
  ('a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000001', 'A', true),
  ('a1010000-0000-0000-0000-000000000012', 'a1010000-0000-0000-0000-000000000001', 'B', false);
insert into public.roles (id, tenant_id, name, level) values
  ('a1010000-0000-0000-0000-000000000021', 'a1010000-0000-0000-0000-000000000001', 'kund', 2),
  ('a1010000-0000-0000-0000-000000000022', 'a1010000-0000-0000-0000-000000000001', 'staff', 3);
insert into auth.users (id, email) values
  ('a1010000-0000-0000-0000-000000000031', 'relation-customer@example.test'),
  ('a1010000-0000-0000-0000-000000000032', 'relation-staff@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  ('a1010000-0000-0000-0000-000000000031', 'a1010000-0000-0000-0000-000000000001', 'relation-customer@example.test', 'a1010000-0000-0000-0000-000000000021', 'pending_claim', 'locations'),
  ('a1010000-0000-0000-0000-000000000032', 'a1010000-0000-0000-0000-000000000001', 'relation-staff@example.test', 'a1010000-0000-0000-0000-000000000022', 'active', 'locations');

insert into public.staff (id, tenant_id, location_id, profile_id, title, active) values
  ('a1010000-0000-0000-0000-000000000041', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000032', 'Alex', false),
  ('a1010000-0000-0000-0000-000000000042', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000012', null, 'Kim', false);
insert into public.services (id, tenant_id, location_id, name, duration_min, price_cents) values
  ('a1010000-0000-0000-0000-000000000051', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000011', 'Klippning', 30, 40000),
  ('a1010000-0000-0000-0000-000000000052', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000012', 'Färgning', 60, 80000);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  'a1010000-0000-0000-0000-000000000001',
  'a1010000-0000-0000-0000-000000000041',
  'a1010000-0000-0000-0000-000000000051'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
) values (
  'a1010000-0000-0000-0000-000000000001',
  'a1010000-0000-0000-0000-000000000011',
  'a1010000-0000-0000-0000-000000000041', 1, '09:00', '17:00'
);
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
) values (
  'a1010000-0000-0000-0000-000000000001',
  'a1010000-0000-0000-0000-000000000011',
  1, '09:00', '17:00', 'confirmed', now()
);
update public.staff set active = true
 where id = 'a1010000-0000-0000-0000-000000000041';

insert into public.customers (
  id, tenant_id, full_name, email, phone, name_hidden
) values
  ('a1010000-0000-0000-0000-000000000061', 'a1010000-0000-0000-0000-000000000001', 'Guest Relation', 'relation-customer@example.test', '+46700000101', false),
  ('a1010000-0000-0000-0000-000000000062', 'a1010000-0000-0000-0000-000000000001', 'Old Relation', 'old@example.test', '+46700000102', false),
  ('a1010000-0000-0000-0000-000000000063', 'a1010000-0000-0000-0000-000000000001', 'Other Location', 'other@example.test', '+46700000103', false);

insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values
  ('a1010000-0000-0000-0000-000000000071', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000041', 'a1010000-0000-0000-0000-000000000051', 'a1010000-0000-0000-0000-000000000061', now() - interval '2 hours', now() - interval '90 minutes', 'completed', 40000),
  ('a1010000-0000-0000-0000-000000000072', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000041', 'a1010000-0000-0000-0000-000000000051', 'a1010000-0000-0000-0000-000000000061', now() - interval '15 days', now() - interval '15 days' + interval '30 minutes', 'completed', 40000),
  ('a1010000-0000-0000-0000-000000000073', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000041', 'a1010000-0000-0000-0000-000000000051', 'a1010000-0000-0000-0000-000000000062', now() - interval '40 days', now() - interval '40 days' + interval '30 minutes', 'completed', 40000),
  ('a1010000-0000-0000-0000-000000000074', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000012', 'a1010000-0000-0000-0000-000000000042', 'a1010000-0000-0000-0000-000000000052', 'a1010000-0000-0000-0000-000000000063', now() - interval '2 hours', now() - interval '1 hour', 'completed', 80000),
  ('a1010000-0000-0000-0000-000000000075', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000041', 'a1010000-0000-0000-0000-000000000051', 'a1010000-0000-0000-0000-000000000061', now() - interval '20 days', now() - interval '20 days' + interval '30 minutes', 'no_show', 40000);
insert into public.customer_favorites (tenant_id, customer_id, kind, staff_id) values
  ('a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000061', 'staff', 'a1010000-0000-0000-0000-000000000041');
insert into public.customer_notes (
  tenant_id, customer_id, location_id, preferences, internal_note
) values
  ('a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000061', 'a1010000-0000-0000-0000-000000000011', array['kort på sidorna'], 'internal_note_hidden_from_customer'),
  ('a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000063', 'a1010000-0000-0000-0000-000000000012', array['varm ton'], 'other location');

select public.create_customer_account_claim(
  'a1010000-0000-0000-0000-000000000001',
  'a1010000-0000-0000-0000-000000000061',
  repeat('1', 64), 'customer_account', now() + interval '1 day'
);

reset role;
select set_config('request.jwt.claim.sub', 'a1010000-0000-0000-0000-000000000031', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a1010000-0000-0000-0000-000000000031","role":"authenticated","app_metadata":{"tenant_id":"a1010000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;

do $$
declare
  v_claim record;
  v_count int;
begin
  select * into v_claim from public.claim_customer_account(
    'a1010000-0000-0000-0000-000000000001', repeat('1', 64), 'customer_account'
  );
  if v_claim.customer_id <> 'a1010000-0000-0000-0000-000000000061'::uuid then
    raise exception 'same_customer_after_claim';
  end if;
  select count(*) into v_count
    from public.bookings
   where customer_id = v_claim.customer_id and status = 'completed';
  if v_count <> 2 then raise exception 'claimed_history_completed_only_%', v_count; end if;
  select count(*) into v_count from public.customer_notes;
  if v_count <> 0 then raise exception 'internal_note_hidden_from_customer'; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', 'a1010000-0000-0000-0000-000000000032', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a1010000-0000-0000-0000-000000000032","role":"authenticated","app_metadata":{"tenant_id":"a1010000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;

do $$
declare v_contact record; v_other_count int;
begin
  select * into v_contact from public.get_customer_contact(
    'a1010000-0000-0000-0000-000000000061'
  );
  if not v_contact.pii_visible or v_contact.phone is null then
    raise exception 'contact_not_visible_in_accessible_window';
  end if;

  select * into v_contact from public.get_customer_contact(
    'a1010000-0000-0000-0000-000000000062'
  );
  if v_contact.pii_visible or v_contact.email is not null or v_contact.phone is not null then
    raise exception 'contact_hidden_outside_window';
  end if;

  select * into v_contact from public.get_customer_contact(
    'a1010000-0000-0000-0000-000000000062', 2147483647, 2147483647
  );
  if v_contact.pii_visible or v_contact.email is not null or v_contact.phone is not null then
    raise exception 'caller_window_override_blocked';
  end if;

  begin
    select count(*) into v_other_count
      from public.get_customer_contact('a1010000-0000-0000-0000-000000000063');
    if v_other_count <> 0 then raise exception 'contact_visible_for_other_location'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
