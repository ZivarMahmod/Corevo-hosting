-- 0096 runtime: hashed/single-use claim, tenant/auth fences, atomic merge and GDPR.
-- Run on a fresh migrated database. Everything rolls back.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.tenants (id, slug, name) values
  ('96000000-0000-0000-0000-000000000001', 'claim-0096-a', 'Claim A'),
  ('96000000-0000-0000-0000-000000000002', 'claim-0096-b', 'Claim B');
insert into public.roles (id, tenant_id, name, level) values
  ('96000000-0000-0000-0000-000000000011', '96000000-0000-0000-0000-000000000001', 'kund-0096-a', 2),
  ('96000000-0000-0000-0000-000000000012', '96000000-0000-0000-0000-000000000002', 'kund-0096-b', 2);
insert into auth.users (id, email) values
  ('96000000-0000-0000-0000-000000000021', 'claim-a@example.test'),
  ('96000000-0000-0000-0000-000000000022', 'claim-b@example.test'),
  ('96000000-0000-0000-0000-000000000023', 'claim-new@example.test'),
  ('96000000-0000-0000-0000-000000000024', 'claim-provisional-b@example.test');
insert into public.users (id, tenant_id, email, role_id, status) values
  ('96000000-0000-0000-0000-000000000021', '96000000-0000-0000-0000-000000000001', 'claim-a@example.test', '96000000-0000-0000-0000-000000000011', 'active'),
  ('96000000-0000-0000-0000-000000000022', '96000000-0000-0000-0000-000000000002', 'claim-b@example.test', '96000000-0000-0000-0000-000000000012', 'active'),
  ('96000000-0000-0000-0000-000000000023', '96000000-0000-0000-0000-000000000001', 'claim-new@example.test', '96000000-0000-0000-0000-000000000011', 'pending_claim'),
  ('96000000-0000-0000-0000-000000000024', '96000000-0000-0000-0000-000000000002', 'claim-provisional-b@example.test', '96000000-0000-0000-0000-000000000012', 'pending_claim');

insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('96000000-0000-0000-0000-000000000031', '96000000-0000-0000-0000-000000000001', 'A', 'Europe/Stockholm', true),
  ('96000000-0000-0000-0000-000000000032', '96000000-0000-0000-0000-000000000001', 'B', 'Europe/Stockholm', false);
insert into public.staff (id, tenant_id, location_id, title, active) values
  ('96000000-0000-0000-0000-000000000041', '96000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000031', 'Staff', false);
insert into public.services (id, tenant_id, location_id, name, duration_min, price_cents) values
  ('96000000-0000-0000-0000-000000000051', '96000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000031', 'Service', 30, 10000);

-- Canonical authenticated card, claim target and an unrelated same-phone card.
insert into public.customers (
  id, tenant_id, auth_user_id, full_name, email, phone, created_at
) values
  ('96000000-0000-0000-0000-000000000061', '96000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000021', 'Canonical', 'claim-a@example.test', null, now() - interval '2 days'),
  ('96000000-0000-0000-0000-000000000062', '96000000-0000-0000-0000-000000000001', null, 'Guest', 'guest@example.test', '+46700000000', now() - interval '1 day'),
  ('96000000-0000-0000-0000-000000000063', '96000000-0000-0000-0000-000000000001', null, 'Other person', 'other@example.test', '+46700000000', now()),
  ('96000000-0000-0000-0000-000000000064', '96000000-0000-0000-0000-000000000002', null, 'Tenant B guest', 'bguest@example.test', '+46700000001', now()),
  ('96000000-0000-0000-0000-000000000065', '96000000-0000-0000-0000-000000000001', null, 'New bind', 'new@example.test', '+46700000002', now()),
  ('96000000-0000-0000-0000-000000000066', '96000000-0000-0000-0000-000000000001', null, 'Tier conflict', 'tier@example.test', '+46700000003', now());

insert into public.loyalty_plans (id, tenant_id, name) values
  ('96000000-0000-0000-0000-000000000081', '96000000-0000-0000-0000-000000000001', 'Plan A'),
  ('96000000-0000-0000-0000-000000000082', '96000000-0000-0000-0000-000000000001', 'Plan B');
insert into public.loyalty_members (
  id, tenant_id, customer_id, plan_id, source, status, joined_at
) values (
  '96000000-0000-0000-0000-000000000083',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062',
  '96000000-0000-0000-0000-000000000081', 'klubb', 'active', now() - interval '1 day'
);
insert into public.shop_orders (id, tenant_id, customer_id) values (
  '96000000-0000-0000-0000-000000000084',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062'
);
insert into public.offert_requests (id, tenant_id, customer_id) values (
  '96000000-0000-0000-0000-000000000085',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062'
);

insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values (
  '96000000-0000-0000-0000-000000000071',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000031',
  '96000000-0000-0000-0000-000000000041',
  '96000000-0000-0000-0000-000000000051',
  '96000000-0000-0000-0000-000000000062',
  now() - interval '2 hours', now() - interval '90 minutes', 'completed', 10000
);
insert into public.customer_favorites (
  id, tenant_id, customer_id, kind, staff_id
) values (
  '96000000-0000-0000-0000-000000000072',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062', 'staff',
  '96000000-0000-0000-0000-000000000041'
);
insert into public.loyalty_ledger (
  id, tenant_id, customer_id, booking_id, points_delta, reason
) values (
  '96000000-0000-0000-0000-000000000073',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062',
  '96000000-0000-0000-0000-000000000071', 10, 'earn_completed'
);
insert into public.customer_notes (
  id, tenant_id, customer_id, preferences, internal_note, location_id
) values
(
  '96000000-0000-0000-0000-000000000091',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000061', array['canonical'], 'canonical note',
  '96000000-0000-0000-0000-000000000032'
),
(
  '96000000-0000-0000-0000-000000000074',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062', array['kort'], 'guest note',
  '96000000-0000-0000-0000-000000000031'
);
insert into public.customer_notification_prefs (
  customer_id, tenant_id, email_enabled
) values (
  '96000000-0000-0000-0000-000000000062',
  '96000000-0000-0000-0000-000000000001', false
);
insert into public.push_subscriptions (
  id, tenant_id, customer_id, endpoint, p256dh, auth
) values (
  '96000000-0000-0000-0000-000000000075',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062',
  'https://push.example.test/0096', 'key', 'auth'
);
insert into public.notifications_outbox (
  id, tenant_id, customer_id, event_type, event_key, category, chosen_channel
) values (
  '96000000-0000-0000-0000-000000000076',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062',
  'claim-test', 'claim-test:0096', 'transactional', 'email'
);

select public.create_customer_account_claim(
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000062',
  repeat('a', 64), 'customer_account', now() + interval '1 day'
);

-- Token table and producer/inspector are not Data API-readable/callable.
do $$
begin
  if has_table_privilege('authenticated', 'private.customer_account_claims', 'select')
     or has_table_privilege('service_role', 'private.customer_account_claims', 'select') then
    raise exception 'claim_table_exposed';
  end if;
  if has_function_privilege('anon', 'public.inspect_customer_account_claim(uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.inspect_customer_account_claim(uuid,text,text)', 'execute') then
    raise exception 'claim_inspector_exposed';
  end if;
  if has_function_privilege('authenticated', 'public.reconcile_customer_account_claim(uuid,text,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.reconcile_customer_account_claim(uuid,text,uuid,text)', 'execute') then
    raise exception 'claim_reconcile_grant_wrong';
  end if;
  if not has_function_privilege('authenticated', 'public.claim_customer_account(uuid,text,text)', 'execute') then
    raise exception 'authenticated_claim_grant_missing';
  end if;
end $$;

-- Tenant B account cannot consume tenant A's token, even if it knows the hash.
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000022', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000022","role":"authenticated","app_metadata":{"tenant_id":"96000000-0000-0000-0000-000000000002","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  perform public.claim_customer_account(
    '96000000-0000-0000-0000-000000000001', repeat('a', 64), 'customer_account'
  );
  raise exception 'cross_tenant_claim_succeeded';
exception when insufficient_privilege then null; end $$;
reset role;

-- A provisional customer role is level 0 everywhere except the narrow claim
-- RPC, and a provisional shell from another tenant cannot cross that bridge.
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000024', true);
select set_config('request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000024","role":"authenticated","app_metadata":{"tenant_id":"96000000-0000-0000-0000-000000000002","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  if (select private.role_level()) <> 0 then raise exception 'provisional_role_leaked_portal_access'; end if;
  perform public.claim_customer_account(
    '96000000-0000-0000-0000-000000000001', repeat('a', 64), 'customer_account'
  );
  raise exception 'provisional_cross_tenant_claim_succeeded';
exception when insufficient_privilege then null; end $$;
reset role;

-- Correct account wins, atomically merges every required relation and consumes.
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"96000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$
declare v record;
begin
  select * into v from public.claim_customer_account(
    '96000000-0000-0000-0000-000000000001', repeat('a', 64), 'customer_account'
  );
  if v.customer_id <> '96000000-0000-0000-0000-000000000061'::uuid or not v.merged then
    raise exception 'claim_merge_result_wrong';
  end if;
end $$;
reset role;

do $$
begin
  if not exists (select 1 from public.bookings where id='96000000-0000-0000-0000-000000000071' and customer_id='96000000-0000-0000-0000-000000000061') then raise exception 'booking_not_merged'; end if;
  if not exists (select 1 from public.customer_favorites where customer_id='96000000-0000-0000-0000-000000000061') then raise exception 'favorite_not_merged'; end if;
  if not exists (select 1 from public.loyalty_ledger where customer_id='96000000-0000-0000-0000-000000000061' and points_delta=10) then raise exception 'loyalty_not_merged'; end if;
  if not exists (
    select 1 from public.customer_notes
     where customer_id='96000000-0000-0000-0000-000000000061'
       and internal_note='canonical note' || E'\n\n' || 'guest note'
  ) then raise exception 'note_not_merged'; end if;
  if not exists (
    select 1 from public.customer_notes
     where customer_id='96000000-0000-0000-0000-000000000061'
       and location_id is null
  ) then raise exception 'cross_location_note_not_owner_only'; end if;
  if not exists (select 1 from public.customer_notification_prefs where customer_id='96000000-0000-0000-0000-000000000061') then raise exception 'prefs_not_merged'; end if;
  if not exists (select 1 from public.push_subscriptions where customer_id='96000000-0000-0000-0000-000000000061') then raise exception 'push_not_merged'; end if;
  if not exists (select 1 from public.notifications_outbox where customer_id='96000000-0000-0000-0000-000000000061') then raise exception 'outbox_not_merged'; end if;
  if not exists (select 1 from public.shop_orders where id='96000000-0000-0000-0000-000000000084' and customer_id='96000000-0000-0000-0000-000000000061') then raise exception 'shop_order_not_merged'; end if;
  if not exists (select 1 from public.offert_requests where id='96000000-0000-0000-0000-000000000085' and customer_id='96000000-0000-0000-0000-000000000061') then raise exception 'offert_not_merged'; end if;
  if not exists (select 1 from public.loyalty_members where id='96000000-0000-0000-0000-000000000083' and customer_id='96000000-0000-0000-0000-000000000061' and plan_id='96000000-0000-0000-0000-000000000081') then raise exception 'loyalty_membership_not_merged'; end if;
  if not exists (select 1 from public.customers where id='96000000-0000-0000-0000-000000000062' and status='anonymized' and email is null and phone is null) then raise exception 'duplicate_not_anonymized'; end if;
  if not public.reconcile_customer_account_claim(
    '96000000-0000-0000-0000-000000000001', repeat('a',64),
    '96000000-0000-0000-0000-000000000021', 'customer_account'
  ) then raise exception 'merged_claim_not_reconciled'; end if;
  -- Same phone/different email was never part of the strong claim and stays separate.
  if not exists (select 1 from public.customers where id='96000000-0000-0000-0000-000000000063' and status='active' and auth_user_id is null) then raise exception 'weak_phone_signal_auto_merged'; end if;
end $$;

-- Replay/second waiter gets no winner and changes nothing.
set local role authenticated;
do $$ begin
  perform public.claim_customer_account(
    '96000000-0000-0000-0000-000000000001', repeat('a', 64), 'customer_account'
  );
  raise exception 'claim_replay_succeeded';
exception when no_data_found then null; end $$;
reset role;

-- Two incompatible membership tiers must fail the complete transaction. The
-- customer, commerce relations, membership tiers and point history all remain
-- exactly where they were; no paid tier is silently chosen or discarded.
insert into public.loyalty_members (
  id, tenant_id, customer_id, plan_id, source, status
) values (
  '96000000-0000-0000-0000-000000000086',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000066',
  '96000000-0000-0000-0000-000000000082', 'klubb', 'active'
);
insert into public.shop_orders (id, tenant_id, customer_id) values (
  '96000000-0000-0000-0000-000000000087',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000066'
);
insert into public.offert_requests (id, tenant_id, customer_id) values (
  '96000000-0000-0000-0000-000000000088',
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000066'
);
insert into public.loyalty_ledger (
  id, tenant_id, customer_id, points_delta, reason
) values
  ('96000000-0000-0000-0000-000000000089', '96000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000066', 40, 'earn_completed'),
  ('96000000-0000-0000-0000-000000000090', '96000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000066', -15, 'redeem');
select public.create_customer_account_claim(
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000066',
  repeat('d', 64), 'customer_account', now() + interval '1 day'
);
set local role authenticated;
do $$
begin
  perform public.claim_customer_account(
    '96000000-0000-0000-0000-000000000001', repeat('d', 64), 'customer_account'
  );
  raise exception 'conflicting_tier_claim_succeeded';
exception when raise_exception then
  if sqlerrm <> 'customer_claim_loyalty_membership_conflict' then raise; end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.customers where id='96000000-0000-0000-0000-000000000066' and status='active' and auth_user_id is null) then raise exception 'tier_conflict_customer_changed'; end if;
  if not exists (select 1 from public.shop_orders where id='96000000-0000-0000-0000-000000000087' and customer_id='96000000-0000-0000-0000-000000000066') then raise exception 'tier_conflict_shop_changed'; end if;
  if not exists (select 1 from public.offert_requests where id='96000000-0000-0000-0000-000000000088' and customer_id='96000000-0000-0000-0000-000000000066') then raise exception 'tier_conflict_offert_changed'; end if;
  if not exists (select 1 from public.loyalty_members where id='96000000-0000-0000-0000-000000000083' and customer_id='96000000-0000-0000-0000-000000000061' and plan_id='96000000-0000-0000-0000-000000000081') then raise exception 'canonical_tier_changed'; end if;
  if not exists (select 1 from public.loyalty_members where id='96000000-0000-0000-0000-000000000086' and customer_id='96000000-0000-0000-0000-000000000066' and plan_id='96000000-0000-0000-0000-000000000082') then raise exception 'duplicate_tier_changed'; end if;
  if (select coalesce(sum(points_delta), 0) from public.loyalty_ledger where customer_id='96000000-0000-0000-0000-000000000066') <> 25 then raise exception 'tier_conflict_points_changed'; end if;
  if not exists (select 1 from private.customer_account_claims where token_hash=repeat('d',64) and used_at is null and customer_id='96000000-0000-0000-0000-000000000066') then raise exception 'tier_conflict_claim_consumed'; end if;
end $$;

-- A user without an existing card binds directly; all guest bookings become visible.
select public.create_customer_account_claim(
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000065',
  repeat('b', 64), 'customer_account', now() + interval '1 day'
);
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"tenant_id":"96000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  if (select private.role_level()) <> 0 then raise exception 'provisional_role_leaked_portal_access'; end if;
  perform public.claim_customer_account(
    '96000000-0000-0000-0000-000000000001', repeat('e', 64), 'customer_account'
  );
  raise exception 'invalid_provisional_claim_succeeded';
exception when no_data_found then null; end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.users where id='96000000-0000-0000-0000-000000000023' and status='pending_claim')
     or exists (select 1 from public.customers where id='96000000-0000-0000-0000-000000000065' and auth_user_id is not null) then
    raise exception 'provisional_activated_without_claim';
  end if;
end $$;
set local role authenticated;
select * from public.claim_customer_account(
  '96000000-0000-0000-0000-000000000001', repeat('b', 64), 'customer_account'
);
reset role;
do $$ begin
  if not exists (select 1 from public.customers where id='96000000-0000-0000-0000-000000000065' and auth_user_id='96000000-0000-0000-0000-000000000023')
     or not exists (select 1 from public.users where id='96000000-0000-0000-0000-000000000023' and status='active')
     or not exists (select 1 from private.customer_account_claims where token_hash=repeat('b',64) and used_at is not null and used_by='96000000-0000-0000-0000-000000000023' and claimed_customer_id='96000000-0000-0000-0000-000000000065') then
    raise exception 'claim_success_not_activated_atomically';
  end if;
  if not public.reconcile_customer_account_claim(
    '96000000-0000-0000-0000-000000000001', repeat('b',64),
    '96000000-0000-0000-0000-000000000023', 'customer_account'
  ) then
    raise exception 'committed_claim_not_reconciled';
  end if;
  if public.reconcile_customer_account_claim(
    '96000000-0000-0000-0000-000000000001', repeat('b',64),
    '96000000-0000-0000-0000-000000000021', 'customer_account'
  ) then
    raise exception 'wrong_user_claim_reconciled';
  end if;
end $$;

-- DB backstop scrubs every claim reference when the customer is anonymized.
select public.create_customer_account_claim(
  '96000000-0000-0000-0000-000000000002',
  '96000000-0000-0000-0000-000000000064',
  repeat('c', 64), 'customer_account', now() + interval '1 day'
);
update public.customers set status='anonymized' where id='96000000-0000-0000-0000-000000000064';
do $$ begin
  if exists (
    select 1 from private.customer_account_claims
     where token_hash=repeat('c',64) or customer_id='96000000-0000-0000-0000-000000000064'
  ) then raise exception 'gdpr_claim_not_scrubbed'; end if;
end $$;

-- Append-only protection is restored after the merge transaction intent is gone.
do $$ begin
  update public.loyalty_ledger set customer_id='96000000-0000-0000-0000-000000000063'
   where id='96000000-0000-0000-0000-000000000073';
  raise exception 'loyalty_append_guard_bypassed';
exception when insufficient_privilege then null; end $$;

rollback;
