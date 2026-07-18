-- 0099 runtime: tenant fence, rollback injection, complete PII scrub,
-- idempotence and the contained external-Auth phase. Fresh migrated DB only.
-- Every fixture rolls back.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.tenants (id, slug, name) values
  ('99000000-0000-0000-0000-000000000001', 'gdpr-0099-a', 'GDPR A'),
  ('99000000-0000-0000-0000-000000000002', 'gdpr-0099-b', 'GDPR B');
insert into public.roles (id, tenant_id, name, level) values
  ('99000000-0000-0000-0000-000000000011', '99000000-0000-0000-0000-000000000001', 'owner-a', 6),
  ('99000000-0000-0000-0000-000000000012', '99000000-0000-0000-0000-000000000001', 'customer-a', 2),
  ('99000000-0000-0000-0000-000000000013', '99000000-0000-0000-0000-000000000002', 'customer-b', 2);
insert into auth.users (id, email) values
  ('99000000-0000-0000-0000-000000000021', 'owner-0099@example.test'),
  ('99000000-0000-0000-0000-000000000022', 'shared-0099@example.test'),
  ('99000000-0000-0000-0000-000000000023', 'single-0099@example.test');
insert into public.users (id, tenant_id, email, phone, role_id, status) values
  ('99000000-0000-0000-0000-000000000021', '99000000-0000-0000-0000-000000000001', 'owner-0099@example.test', '+46700000001', '99000000-0000-0000-0000-000000000011', 'active'),
  ('99000000-0000-0000-0000-000000000022', '99000000-0000-0000-0000-000000000001', 'shared-0099@example.test', '+46700000002', '99000000-0000-0000-0000-000000000012', 'active'),
  ('99000000-0000-0000-0000-000000000023', '99000000-0000-0000-0000-000000000001', 'single-0099@example.test', '+46700000003', '99000000-0000-0000-0000-000000000012', 'active');

insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('99000000-0000-0000-0000-000000000031', '99000000-0000-0000-0000-000000000001', 'A', 'Europe/Stockholm', true);
insert into public.staff (id, tenant_id, location_id, title, active) values
  ('99000000-0000-0000-0000-000000000041', '99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000031', 'Staff', false);
insert into public.services (id, tenant_id, location_id, name, duration_min, price_cents) values
  ('99000000-0000-0000-0000-000000000051', '99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000031', 'Service', 30, 10000);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000041',
  '99000000-0000-0000-0000-000000000051'
);
insert into public.working_hours (
  tenant_id, staff_id, location_id, weekday, start_time, end_time
)
select '99000000-0000-0000-0000-000000000001',
       '99000000-0000-0000-0000-000000000041',
       '99000000-0000-0000-0000-000000000031',
       day, '09:00', '17:00'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '99000000-0000-0000-0000-000000000001',
       '99000000-0000-0000-0000-000000000031',
       day, '09:00', '17:00', 'confirmed', now()
  from generate_series(0, 6) day;
update public.staff set active = true
 where id = '99000000-0000-0000-0000-000000000041';

-- Shared Auth identity across two tenants: self-service must fail before writes.
insert into public.customers (
  id, tenant_id, auth_user_id, contact_hash, display_name, full_name, email, phone
) values
  ('99000000-0000-0000-0000-000000000061', '99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000022', repeat('a',64), 'Target', 'Target Person', 'target@example.test', '+46711111111'),
  ('99000000-0000-0000-0000-000000000062', '99000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000022', repeat('b',64), 'Other', 'Other Tenant', 'other@example.test', '+46722222222'),
  ('99000000-0000-0000-0000-000000000063', '99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000023', repeat('c',64), 'Single', 'Single Person', 'single-0099@example.test', '+46733333333');

-- A compensation call without a pending erasure is a strict no-op. It must not
-- be usable as a service-side account lock primitive for an arbitrary UUID.
do $$
begin
  if public.fail_customer_erasure_auth_cleanup(
    '99000000-0000-0000-0000-000000000191',
    '99000000-0000-0000-0000-000000000021',
    '99000000-0000-0000-0000-000000000192',
    'auth_delete_failed'
  ) then raise exception 'non_pending_auth_failure_reported_contained'; end if;
  if not exists (
    select 1 from public.users
     where id='99000000-0000-0000-0000-000000000021'
       and email='owner-0099@example.test' and phone='+46700000001' and status='active'
  ) then raise exception 'non_pending_auth_failure_mutated_user'; end if;
end $$;

do $$
begin
  perform * from public.atomic_erase_self_customer_account(
    '99000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000022'
  );
  raise exception 'global_identity_was_erased';
exception
  when insufficient_privilege then
    if sqlerrm not like '%global_identity_decision_required%' then raise; end if;
end $$;
do $$
begin
  if not exists (
    select 1 from public.customers
     where id = '99000000-0000-0000-0000-000000000061'
       and status = 'active' and full_name = 'Target Person'
  ) then raise exception 'global_identity_failure_mutated_customer'; end if;
end $$;

insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_profile_id,
  customer_id, start_ts, end_ts, status, price_cents, note
) values (
  '99000000-0000-0000-0000-000000000071',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000031',
  '99000000-0000-0000-0000-000000000041',
  '99000000-0000-0000-0000-000000000051',
  '99000000-0000-0000-0000-000000000022',
  '99000000-0000-0000-0000-000000000061',
  now() - interval '2 hours', now() - interval '90 minutes',
  'completed', 10000, 'private booking note'
);
insert into public.payments (
  id, tenant_id, booking_id, amount_cents, currency, status
) values (
  '99000000-0000-0000-0000-000000000072',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000071', 10000, 'sek', 'succeeded'
);
insert into public.customer_favorites (id, tenant_id, customer_id, kind, staff_id) values (
  '99000000-0000-0000-0000-000000000073',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061', 'staff',
  '99000000-0000-0000-0000-000000000041'
);
insert into public.customer_notes (
  id, tenant_id, customer_id, location_id, preferences, internal_note
) values (
  '99000000-0000-0000-0000-000000000074',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061',
  '99000000-0000-0000-0000-000000000031', array['private'], 'private note'
);
insert into public.customer_notification_prefs (customer_id, tenant_id) values (
  '99000000-0000-0000-0000-000000000061',
  '99000000-0000-0000-0000-000000000001'
);
insert into public.push_subscriptions (
  id, tenant_id, customer_id, endpoint, p256dh, auth
) values (
  '99000000-0000-0000-0000-000000000075',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061',
  'https://push.example.test/gdpr-0099', 'private-key', 'private-auth'
);
insert into public.loyalty_ledger (
  id, tenant_id, customer_id, booking_id, points_delta, reason
) values (
  '99000000-0000-0000-0000-000000000076',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061',
  '99000000-0000-0000-0000-000000000071', 10, 'earn_completed'
);
insert into public.loyalty_members (id, tenant_id, customer_id, source) values (
  '99000000-0000-0000-0000-000000000077',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061', 'klubb'
);
insert into public.notifications_outbox (
  id, tenant_id, customer_id, booking_id, event_type, event_key, category,
  chosen_channel, consent_state, payload, status, lease_token
) values (
  '99000000-0000-0000-0000-000000000078',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061',
  '99000000-0000-0000-0000-000000000071',
  'gdpr-test', 'gdpr-test:0099', 'transactional', 'email',
  '{"email":true}'::jsonb, '{"recipient":"private@example.test"}'::jsonb,
  'delivery_started', '99000000-0000-0000-0000-000000000079'
);
insert into private.customer_account_claims (
  id, tenant_id, customer_id, claimed_customer_id, token_hash, purpose, expires_at
) values (
  '99000000-0000-0000-0000-000000000080',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061',
  '99000000-0000-0000-0000-000000000061', repeat('d',64),
  'customer_account', now() + interval '1 day'
);
insert into public.shop_orders (
  id, tenant_id, customer_id, customer_name, customer_email, customer_phone,
  ship_address, session_token, tracking_number, total_cents, payment_status, note
) values (
  '99000000-0000-0000-0000-000000000081',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061', 'Target Person',
  'target@example.test', '+46711111111', 'Private street 1', 'private-bearer',
  'private-tracking', 12345, 'paid', 'private order note'
);
insert into public.tenant_events (
  id, tenant_id, title, starts_at, capacity, price_cents
) values (
  '99000000-0000-0000-0000-000000000083',
  '99000000-0000-0000-0000-000000000001',
  'Retained event', now() + interval '10 days', 20, 25000
);
insert into public.shop_order_items (
  id, tenant_id, order_id, product_name, unit_price_cents, quantity, item_type,
  gift_recipient_name, gift_recipient_email, gift_message
) values (
  '99000000-0000-0000-0000-000000000084',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000081',
  'Presentkort 500', 50000, 1, 'giftcard',
  'Private Recipient', 'recipient@example.test', 'Private gift message'
);
insert into public.shop_order_items (
  id, tenant_id, order_id, product_name, unit_price_cents, quantity, item_type,
  event_id
) values (
  '99000000-0000-0000-0000-000000000085',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000081',
  'Eventplats', 25000, 2, 'event',
  '99000000-0000-0000-0000-000000000083'
);
insert into public.gift_cards (
  id, tenant_id, code, initial_amount_cents, balance_cents, status,
  recipient_name, recipient_email, message, order_id, order_item_id
) values (
  '99000000-0000-0000-0000-000000000086',
  '99000000-0000-0000-0000-000000000001', 'GDPR-A-0099',
  50000, 40000, 'active', 'Private Recipient', 'recipient@example.test',
  'Private card message', '99000000-0000-0000-0000-000000000081',
  '99000000-0000-0000-0000-000000000084'
);
insert into public.event_registrations (
  id, tenant_id, event_id, name, email, phone, party_size, message, status,
  order_item_id
) values (
  '99000000-0000-0000-0000-000000000087',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000083', 'Private Attendee',
  'attendee@example.test', '+46744444444', 2, 'Private registration message',
  'confirmed', '99000000-0000-0000-0000-000000000085'
);

-- Same-shaped child PII in another tenant must remain byte-for-byte untouched.
insert into public.shop_orders (
  id, tenant_id, customer_id, customer_name, customer_email, total_cents
) values (
  '99000000-0000-0000-0000-000000000088',
  '99000000-0000-0000-0000-000000000002',
  '99000000-0000-0000-0000-000000000062', 'Other Tenant',
  'other@example.test', 70000
);
insert into public.shop_order_items (
  id, tenant_id, order_id, product_name, unit_price_cents, item_type,
  gift_recipient_name, gift_recipient_email, gift_message
) values (
  '99000000-0000-0000-0000-000000000089',
  '99000000-0000-0000-0000-000000000002',
  '99000000-0000-0000-0000-000000000088', 'Other gift', 70000, 'giftcard',
  'Other Recipient', 'other-recipient@example.test', 'Other private message'
);
insert into public.gift_cards (
  id, tenant_id, code, initial_amount_cents, balance_cents, status,
  recipient_name, recipient_email, message, order_id, order_item_id
) values (
  '99000000-0000-0000-0000-000000000090',
  '99000000-0000-0000-0000-000000000002', 'GDPR-B-0099',
  70000, 60000, 'active', 'Other Recipient', 'other-recipient@example.test',
  'Other card message', '99000000-0000-0000-0000-000000000088',
  '99000000-0000-0000-0000-000000000089'
);
insert into public.offert_requests (
  id, tenant_id, customer_id, customer_name, customer_email, customer_phone,
  subject, message, details, estimate_cents, status, payment_status, note,
  reply_message
) values (
  '99000000-0000-0000-0000-000000000082',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061', 'Target Person',
  'target@example.test', '+46711111111', 'Private subject', 'Private message',
  '{"private":"value"}'::jsonb, 54321, 'accepted', 'paid', 'private admin note',
  'Private reply'
);

-- Wrong tenant is rejected and cannot touch the target.
do $$
begin
  perform * from public.atomic_erase_tenant_customer(
    '99000000-0000-0000-0000-000000000002',
    '99000000-0000-0000-0000-000000000061',
    '99000000-0000-0000-0000-000000000021'
  );
  raise exception 'cross_tenant_erase_succeeded';
exception when no_data_found then null;
end $$;

-- Each injected exception is caught by this PL/pgSQL subtransaction. Every
-- write performed inside the private core must be gone afterwards.
do $$
declare
  v_step text;
begin
  foreach v_step in array array['outbox','ephemeral','bookings','commerce','customer','audit']
  loop
    begin
      perform * from private.atomic_erase_tenant_customer_tx(
        '99000000-0000-0000-0000-000000000001',
        '99000000-0000-0000-0000-000000000061',
        '99000000-0000-0000-0000-000000000021',
        null, false, v_step
      );
      raise exception 'failure_injection_did_not_fail_%', v_step;
    exception when others then
      if sqlerrm not like 'gdpr_test_failure_%' then raise; end if;
    end;

    if not exists (
      select 1 from public.customers
       where id='99000000-0000-0000-0000-000000000061'
         and status='active' and full_name='Target Person'
         and auth_user_id='99000000-0000-0000-0000-000000000022'
    ) then raise exception 'rollback_customer_failed_%', v_step; end if;
    if not exists (
      select 1 from public.bookings
       where id='99000000-0000-0000-0000-000000000071'
         and note='private booking note'
         and customer_profile_id='99000000-0000-0000-0000-000000000022'
    ) then raise exception 'rollback_booking_failed_%', v_step; end if;
    if not exists (
      select 1 from public.notifications_outbox
       where id='99000000-0000-0000-0000-000000000078'
         and status='delivery_started'
         and payload ? 'recipient'
         and lease_token='99000000-0000-0000-0000-000000000079'
    ) then raise exception 'rollback_outbox_failed_%', v_step; end if;
    if not exists (
      select 1 from public.customer_notes
       where customer_id='99000000-0000-0000-0000-000000000061'
    ) then raise exception 'rollback_notes_failed_%', v_step; end if;
    if not exists (
      select 1 from private.customer_account_claims
       where id='99000000-0000-0000-0000-000000000080' and token_hash=repeat('d',64)
    ) then raise exception 'rollback_claim_failed_%', v_step; end if;
    if not exists (
      select 1 from public.shop_order_items
       where id='99000000-0000-0000-0000-000000000084'
         and gift_recipient_name='Private Recipient'
         and gift_recipient_email='recipient@example.test'
         and gift_message='Private gift message'
         and unit_price_cents=50000
    ) then raise exception 'rollback_order_item_failed_%', v_step; end if;
    if not exists (
      select 1 from public.gift_cards
       where id='99000000-0000-0000-0000-000000000086'
         and recipient_name='Private Recipient'
         and recipient_email='recipient@example.test'
         and message='Private card message' and balance_cents=40000
    ) then raise exception 'rollback_gift_card_failed_%', v_step; end if;
    if not exists (
      select 1 from public.event_registrations
       where id='99000000-0000-0000-0000-000000000087'
         and name='Private Attendee' and email='attendee@example.test'
         and phone='+46744444444' and message='Private registration message'
         and party_size=2
    ) then raise exception 'rollback_event_registration_failed_%', v_step; end if;
    if not exists (
      select 1 from public.offert_requests
       where id='99000000-0000-0000-0000-000000000082'
         and reply_message='Private reply'
    ) then raise exception 'rollback_quote_reply_failed_%', v_step; end if;
    if exists (
      select 1 from public.audit_log
       where action like 'gdpr.tenant_erase%' and entity_id='99000000-0000-0000-0000-000000000061'
    ) then raise exception 'rollback_audit_failed_%', v_step; end if;
  end loop;
end $$;

-- Real service-only call commits all bands together.
set local role service_role;
select * from public.atomic_erase_tenant_customer(
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000061',
  '99000000-0000-0000-0000-000000000021'
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.customers
     where id='99000000-0000-0000-0000-000000000061'
       and tenant_id='99000000-0000-0000-0000-000000000001'
       and status='anonymized' and name_hidden
       and auth_user_id is null and contact_hash is null and display_name is null
       and full_name is null and email is null and phone is null
  ) then raise exception 'customer_not_anonymized'; end if;

  if not exists (
    select 1 from public.customers
     where id='99000000-0000-0000-0000-000000000062'
       and tenant_id='99000000-0000-0000-0000-000000000002'
       and full_name='Other Tenant' and status='active'
  ) then raise exception 'other_tenant_mutated'; end if;

  if not exists (
    select 1 from public.bookings
     where id='99000000-0000-0000-0000-000000000071'
       and customer_id='99000000-0000-0000-0000-000000000061'
       and customer_profile_id is null and note is null and price_cents=10000
  ) then raise exception 'booking_retention_or_scrub_failed'; end if;
  if not exists (
    select 1 from public.payments
     where id='99000000-0000-0000-0000-000000000072'
       and status='succeeded' and amount_cents=10000
  ) then raise exception 'payment_retention_failed'; end if;
  if not exists (
    select 1 from public.loyalty_ledger
     where id='99000000-0000-0000-0000-000000000076'
       and customer_id='99000000-0000-0000-0000-000000000061'
       and points_delta=10
  ) then raise exception 'loyalty_ledger_retention_failed'; end if;

  if exists (select 1 from public.customer_favorites where customer_id='99000000-0000-0000-0000-000000000061')
     or exists (select 1 from public.customer_notes where customer_id='99000000-0000-0000-0000-000000000061')
     or exists (select 1 from public.customer_notification_prefs where customer_id='99000000-0000-0000-0000-000000000061')
     or exists (select 1 from public.push_subscriptions where customer_id='99000000-0000-0000-0000-000000000061')
     or exists (select 1 from public.loyalty_members where customer_id='99000000-0000-0000-0000-000000000061') then
    raise exception 'ephemeral_customer_data_survived';
  end if;

  if not exists (
    select 1 from public.notifications_outbox
     where id='99000000-0000-0000-0000-000000000078'
       and status='skipped' and skip_reason='gdpr_erased'
       and customer_id is null and booking_id is null
       and payload='{}'::jsonb and consent_state='{}'::jsonb
       and provider_ref is null and lease_token is null and lease_expires_at is null
  ) then raise exception 'outbox_not_scrubbed'; end if;
  if not exists (
    select 1 from private.customer_account_claims
     where id='99000000-0000-0000-0000-000000000080'
       and token_hash is null and customer_id is null and claimed_customer_id is null
       and used_by is null and used_at is not null and scrubbed_at is not null
  ) then raise exception 'claim_not_scrubbed'; end if;

  if not exists (
    select 1 from public.shop_orders
     where id='99000000-0000-0000-0000-000000000081'
       and customer_id='99000000-0000-0000-0000-000000000061'
       and customer_name is null and customer_email is null and customer_phone is null
       and ship_address is null and session_token is null and tracking_number is null and note is null
       and total_cents=12345 and payment_status='paid'
  ) then raise exception 'shop_contact_scrub_or_financial_retention_failed'; end if;
  if not exists (
    select 1 from public.shop_order_items
     where id='99000000-0000-0000-0000-000000000084'
       and gift_recipient_name is null and gift_recipient_email is null
       and gift_message is null and unit_price_cents=50000 and quantity=1
  ) then raise exception 'order_item_recipient_scrub_or_history_retention_failed'; end if;
  if not exists (
    select 1 from public.gift_cards
     where id='99000000-0000-0000-0000-000000000086'
       and recipient_name is null and recipient_email is null and message is null
       and initial_amount_cents=50000 and balance_cents=40000 and status='active'
  ) then raise exception 'gift_card_recipient_scrub_or_balance_retention_failed'; end if;
  if not exists (
    select 1 from public.event_registrations
     where id='99000000-0000-0000-0000-000000000087'
       and name='Anonymiserad' and email is null and phone is null and message is null
       and party_size=2 and status='confirmed'
  ) then raise exception 'event_registration_scrub_or_capacity_history_failed'; end if;
  if not exists (
    select 1 from public.shop_order_items
     where id='99000000-0000-0000-0000-000000000089'
       and gift_recipient_name='Other Recipient'
       and gift_recipient_email='other-recipient@example.test'
       and gift_message='Other private message' and unit_price_cents=70000
  ) or not exists (
    select 1 from public.gift_cards
     where id='99000000-0000-0000-0000-000000000090'
       and recipient_name='Other Recipient'
       and recipient_email='other-recipient@example.test'
       and message='Other card message' and balance_cents=60000
  ) then raise exception 'other_tenant_commerce_child_mutated'; end if;
  if not exists (
    select 1 from public.offert_requests
     where id='99000000-0000-0000-0000-000000000082'
       and customer_id='99000000-0000-0000-0000-000000000061'
       and customer_name is null and customer_email is null and customer_phone is null
       and subject is null and message is null and reply_message is null
       and details='{}'::jsonb and note is null
       and estimate_cents=54321 and status='accepted' and payment_status='paid'
  ) then raise exception 'quote_contact_scrub_or_financial_retention_failed'; end if;
  if not exists (
    select 1 from public.audit_log
     where tenant_id='99000000-0000-0000-0000-000000000001'
       and action='gdpr.tenant_erase' and entity='customer'
       and entity_id='99000000-0000-0000-0000-000000000061'
       and meta->>'erased_bookings'='1'
  ) then raise exception 'atomic_audit_missing'; end if;
end $$;

-- Repeating the operation is explicit/idempotent and does not recreate PII.
do $$
declare
  v_status text;
begin
  select e.status into v_status
    from public.atomic_erase_tenant_customer(
      '99000000-0000-0000-0000-000000000001',
      '99000000-0000-0000-0000-000000000061',
      '99000000-0000-0000-0000-000000000021'
    ) e;
  if v_status <> 'already_erased' then raise exception 'erase_not_idempotent'; end if;
end $$;

-- Single-relation self-service contains the public profile before the external
-- Auth call. Repeating phase one simulates a lost response and returns the same
-- durable result instead of trying to rediscover an anonymized customer.
select * from public.atomic_erase_self_customer_account(
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000023'
);
do $$
begin
  if not exists (
    select 1 from public.users
     where id='99000000-0000-0000-0000-000000000023'
       and status='gdpr_pending_auth_delete' and email is null and phone is null
  ) then raise exception 'auth_failure_not_precontained'; end if;
  if not exists (
    select 1 from private.customer_erasure_auth_cleanup
     where auth_user_id='99000000-0000-0000-0000-000000000023'
       and state='pending' and last_error_code is null
  ) then raise exception 'auth_cleanup_marker_missing'; end if;
end $$;
do $$
declare
  v_status text;
begin
  select e.status into v_status
    from public.atomic_erase_self_customer_account(
      '99000000-0000-0000-0000-000000000001',
      '99000000-0000-0000-0000-000000000023'
    ) e;
  if v_status <> 'erased' then raise exception 'lost_phase_one_response_not_resumable'; end if;
end $$;

-- A still-live JWT for the contained profile may invoke the authenticated RPC,
-- but its resolver write and booking must roll back together at the DB trigger.
select set_config('request.jwt.claim.sub', '99000000-0000-0000-0000-000000000023', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"99000000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"tenant_id":"99000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
begin
  perform public.create_public_booking(
    'gdpr-0099-a',
    '99000000-0000-0000-0000-000000000051',
    '99000000-0000-0000-0000-000000000041',
    now() + interval '30 days', 'must roll back',
    '99000000-0000-0000-0000-000000000023', null, null, null,
    '99000000-0000-0000-0000-000000000031',
    '99000000-0000-0000-0000-000000000093'
  );
  raise exception 'contained_jwt_recreated_authenticated_booking';
exception when insufficient_privilege then
  if sqlerrm not like '%contained_profile_cannot_create_booking%' then raise; end if;
end $$;
do $$
begin
  perform public.create_public_booking(
    'gdpr-0099-a',
    '99000000-0000-0000-0000-000000000051',
    '99000000-0000-0000-0000-000000000041',
    now() + interval '31 days', 'must also roll back', null,
    'Forbidden Guest', 'forbidden-guest@example.test', '+46755555555',
    '99000000-0000-0000-0000-000000000031',
    '99000000-0000-0000-0000-000000000094'
  );
  raise exception 'contained_jwt_recreated_guest_booking';
exception when insufficient_privilege then
  if sqlerrm not like '%contained_profile_cannot_create_booking%' then raise; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
begin
  if exists (
    select 1 from public.customers
     where tenant_id='99000000-0000-0000-0000-000000000001'
       and (
         auth_user_id='99000000-0000-0000-0000-000000000023'
         or email='forbidden-guest@example.test'
       )
  ) or exists (
    select 1 from public.bookings
     where request_id in (
       '99000000-0000-0000-0000-000000000093',
       '99000000-0000-0000-0000-000000000094'
     )
  ) then raise exception 'contained_jwt_write_was_not_rolled_back'; end if;
end $$;

-- The trigger itself keeps the auth.uid()=NULL service/storefront path open.
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents, request_id
) values (
  '99000000-0000-0000-0000-000000000098',
  '99000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000031',
  '99000000-0000-0000-0000-000000000041',
  '99000000-0000-0000-0000-000000000051', null,
  date_trunc('day', now()) + interval '33 days 12 hours',
  date_trunc('day', now()) + interval '33 days 12 hours 30 minutes',
  'confirmed', 10000, '99000000-0000-0000-0000-000000000097'
);

-- Claim is exact, leased and idempotent for one token. Another token cannot
-- steal an active lease; fail releases it; the next worker can resume and ack.
do $$
declare
  v_cleanup uuid;
  v_second_cleanup uuid;
begin
  select c.cleanup_id into v_cleanup
    from public.claim_customer_erasure_auth_cleanup(
      '99000000-0000-0000-0000-000000000023',
      '99000000-0000-0000-0000-000000000095', 300
    ) c;
  if v_cleanup is null then raise exception 'auth_cleanup_not_claimed'; end if;

  select c.cleanup_id into v_second_cleanup
    from public.claim_customer_erasure_auth_cleanup(
      '99000000-0000-0000-0000-000000000023',
      '99000000-0000-0000-0000-000000000095', 300
    ) c;
  if v_second_cleanup is distinct from v_cleanup then
    raise exception 'same_token_claim_not_idempotent';
  end if;
  select c.cleanup_id into v_second_cleanup
    from public.claim_customer_erasure_auth_cleanup(
      '99000000-0000-0000-0000-000000000023',
      '99000000-0000-0000-0000-000000000096', 300
    ) c;
  if v_second_cleanup is not null then raise exception 'active_lease_was_stolen'; end if;

  if public.fail_customer_erasure_auth_cleanup(
    v_cleanup,
    '99000000-0000-0000-0000-000000000023',
    '99000000-0000-0000-0000-000000000096',
    'auth_delete_failed'
  ) then raise exception 'wrong_token_released_cleanup'; end if;
  if not public.fail_customer_erasure_auth_cleanup(
    v_cleanup,
    '99000000-0000-0000-0000-000000000023',
    '99000000-0000-0000-0000-000000000095',
    'provider returned private text'
  ) then raise exception 'exact_failure_did_not_release_cleanup'; end if;

  select c.cleanup_id into v_second_cleanup
    from public.claim_customer_erasure_auth_cleanup(
      '99000000-0000-0000-0000-000000000023',
      '99000000-0000-0000-0000-000000000096', 300
    ) c;
  if v_second_cleanup is distinct from v_cleanup then
    raise exception 'released_cleanup_not_resumable';
  end if;

  if public.ack_customer_erasure_auth_cleanup(
    v_cleanup,
    '99000000-0000-0000-0000-000000000023',
    '99000000-0000-0000-0000-000000000095'
  ) then raise exception 'wrong_token_acknowledged_cleanup'; end if;
  if not public.ack_customer_erasure_auth_cleanup(
    v_cleanup,
    '99000000-0000-0000-0000-000000000023',
    '99000000-0000-0000-0000-000000000096'
  ) then raise exception 'exact_ack_failed'; end if;
  if not public.ack_customer_erasure_auth_cleanup(
    v_cleanup,
    '99000000-0000-0000-0000-000000000023',
    '99000000-0000-0000-0000-000000000096'
  ) then raise exception 'lost_ack_response_not_idempotent'; end if;

  if not exists (
    select 1 from private.customer_erasure_auth_cleanup
     where id=v_cleanup and state='completed'
       and tenant_id is null and customer_id is null and auth_user_id is null
       and claim_token='99000000-0000-0000-0000-000000000096'
       and claim_expires_at is null and completed_at is not null
  ) then raise exception 'completed_cleanup_retained_pii'; end if;
end $$;

-- Data API roles can never invoke any erasure RPC.
set local role authenticated;
do $$ begin
  perform * from public.atomic_erase_tenant_customer(
    '99000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000061',
    '99000000-0000-0000-0000-000000000021'
  );
  raise exception 'authenticated_called_service_erase';
exception when insufficient_privilege then null; end $$;
reset role;

rollback;
