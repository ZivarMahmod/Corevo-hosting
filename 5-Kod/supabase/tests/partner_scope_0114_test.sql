-- 0114 runtime proof: partner isolation, global partner-zero access, mutable open
-- month pricing, immutable closed history and no plaintext credential columns.
-- Every row and setting is rolled back.
begin;

insert into public.partners (
  id, slug, name, status, country_code, currency, timezone, license_price_ore
) values
  ('a1140000-0000-0000-0000-000000000001', 'partner-0114-a', 'Partner 0114 A', 'active', 'SE', 'SEK', 'Europe/Stockholm', 1234),
  ('a1140000-0000-0000-0000-000000000002', 'partner-0114-b', 'Partner 0114 B', 'active', 'GR', 'EUR', 'Europe/Athens', 2345);

insert into auth.users (id, email) values
  ('a1140000-0000-0000-0000-000000000021', 'partner-a-0114@example.test'),
  ('a1140000-0000-0000-0000-000000000022', 'partner-b-0114@example.test'),
  ('a1140000-0000-0000-0000-000000000023', 'global-0114@example.test'),
  ('a1140000-0000-0000-0000-000000000024', 'level-seven-0114@example.test'),
  ('a1140000-0000-0000-0000-000000000051', 'tenant-a-owner-0114@example.test'),
  ('a1140000-0000-0000-0000-000000000052', 'tenant-b-owner-0114@example.test');

insert into public.roles (id, tenant_id, name, level) values
  ('a1140000-0000-0000-0000-000000000025', null, 'fake_super_admin_0114', 7);

insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1140000-0000-0000-0000-000000000021', null, 'partner-a-0114@example.test',
    (select id from public.roles where tenant_id is null and name = 'partner_admin' limit 1),
    'active', 'organization'
  ),
  (
    'a1140000-0000-0000-0000-000000000022', null, 'partner-b-0114@example.test',
    (select id from public.roles where tenant_id is null and name = 'partner_admin' limit 1),
    'active', 'organization'
  ),
  (
    'a1140000-0000-0000-0000-000000000023', null, 'global-0114@example.test',
    (select id from public.roles where tenant_id is null and name = 'super_admin' limit 1),
    'active', 'organization'
  ),
  (
    'a1140000-0000-0000-0000-000000000024', null, 'level-seven-0114@example.test',
    'a1140000-0000-0000-0000-000000000025',
    'active', 'organization'
  );

insert into public.partner_members (partner_id, user_id, role, status) values
  ('a1140000-0000-0000-0000-000000000001', 'a1140000-0000-0000-0000-000000000021', 'owner', 'active'),
  ('a1140000-0000-0000-0000-000000000002', 'a1140000-0000-0000-0000-000000000022', 'owner', 'active');

insert into public.tenants (id, slug, name, status, partner_id) values
  ('a1140000-0000-0000-0000-000000000031', 'tenant-0114-a', 'Tenant 0114 A', 'active', 'a1140000-0000-0000-0000-000000000001'),
  ('a1140000-0000-0000-0000-000000000032', 'tenant-0114-b', 'Tenant 0114 B', 'active', 'a1140000-0000-0000-0000-000000000002'),
  ('a1140000-0000-0000-0000-000000000033', 'tenant-0114-a-next', 'Tenant 0114 A Next', 'provisioning', 'a1140000-0000-0000-0000-000000000001');

insert into public.roles (id, tenant_id, name, level) values
  ('a1140000-0000-0000-0000-000000000041', 'a1140000-0000-0000-0000-000000000031', 'owner_a_0114', 6),
  ('a1140000-0000-0000-0000-000000000042', 'a1140000-0000-0000-0000-000000000032', 'owner_b_0114', 6);

insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1140000-0000-0000-0000-000000000051', 'a1140000-0000-0000-0000-000000000031',
    'tenant-a-owner-0114@example.test', 'a1140000-0000-0000-0000-000000000041', 'active', 'locations'
  ),
  (
    'a1140000-0000-0000-0000-000000000052', 'a1140000-0000-0000-0000-000000000032',
    'tenant-b-owner-0114@example.test', 'a1140000-0000-0000-0000-000000000042', 'active', 'locations'
  );

insert into public.locations (id, tenant_id, name, timezone, is_primary, active) values
  ('a1140000-0000-0000-0000-000000000061', 'a1140000-0000-0000-0000-000000000031', 'Location A', 'Europe/Stockholm', true, true),
  ('a1140000-0000-0000-0000-000000000062', 'a1140000-0000-0000-0000-000000000032', 'Location B', 'Europe/Athens', true, true),
  ('a1140000-0000-0000-0000-000000000063', 'a1140000-0000-0000-0000-000000000033', 'Location A Next', 'Europe/Stockholm', true, true);

insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
) values (
  'a1140000-0000-0000-0000-000000000031', 'a1140000-0000-0000-0000-000000000061',
  1, '08:00', '18:00', 'confirmed', now()
);

insert into public.services (id, tenant_id, location_id, name, duration_min, price_cents, active) values
  ('a1140000-0000-0000-0000-000000000071', 'a1140000-0000-0000-0000-000000000031', null, 'Service A1', 30, 1000, true),
  ('a1140000-0000-0000-0000-000000000072', 'a1140000-0000-0000-0000-000000000031', null, 'Service A2', 45, 2000, true),
  ('a1140000-0000-0000-0000-000000000073', 'a1140000-0000-0000-0000-000000000032', null, 'Service B', 30, 1000, true);

insert into public.staff (id, tenant_id, location_id, title, active) values
  ('a1140000-0000-0000-0000-000000000081', 'a1140000-0000-0000-0000-000000000031', 'a1140000-0000-0000-0000-000000000061', 'Staff A', false),
  ('a1140000-0000-0000-0000-000000000082', 'a1140000-0000-0000-0000-000000000032', 'a1140000-0000-0000-0000-000000000062', 'Staff B', false);
insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('a1140000-0000-0000-0000-000000000031', 'a1140000-0000-0000-0000-000000000081', 'a1140000-0000-0000-0000-000000000071');
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
) values (
  'a1140000-0000-0000-0000-000000000031', 'a1140000-0000-0000-0000-000000000061',
  'a1140000-0000-0000-0000-000000000081', 1, '09:00', '17:00'
);
update public.staff set active = true where id = 'a1140000-0000-0000-0000-000000000081';

insert into public.customers (id, tenant_id, full_name, display_name, email, phone, status) values
  ('a1140000-0000-0000-0000-000000000091', 'a1140000-0000-0000-0000-000000000031', 'Customer A', 'Customer A', 'customer-a@example.test', '+46700000001', 'active'),
  ('a1140000-0000-0000-0000-000000000092', 'a1140000-0000-0000-0000-000000000032', 'Customer B', 'Customer B', 'customer-b@example.test', '+46700000002', 'active');

insert into public.tenant_settings (tenant_id) values
  ('a1140000-0000-0000-0000-000000000031'),
  ('a1140000-0000-0000-0000-000000000032');

insert into public.push_subscriptions (
  id, tenant_id, customer_id, endpoint, p256dh, auth
) values (
  'a1140000-0000-0000-0000-000000000105', 'a1140000-0000-0000-0000-000000000031',
  'a1140000-0000-0000-0000-000000000091', 'https://push.example.test/a114', 'secret-p256dh', 'secret-auth'
);

insert into public.shop_products (id, tenant_id, name, price_cents, stock, active) values (
  'a1140000-0000-0000-0000-000000000111', 'a1140000-0000-0000-0000-000000000031',
  'Product A', 1000, 10, true
);
insert into public.shop_product_variants (
  id, tenant_id, product_id, name, price_cents, stock, reserved_qty, active
) values (
  'a1140000-0000-0000-0000-000000000112', 'a1140000-0000-0000-0000-000000000031',
  'a1140000-0000-0000-0000-000000000111', 'Standard', 1000, 10, 1, true
);
insert into public.shop_orders (
  id, tenant_id, status, fulfilment, total_cents, currency, payment_status
) values (
  'a1140000-0000-0000-0000-000000000113', 'a1140000-0000-0000-0000-000000000031',
  'reserved', 'ship', 1000, 'SEK', 'unpaid'
);
insert into public.shop_order_items (
  id, tenant_id, order_id, product_id, variant_id, product_name, unit_price_cents, quantity, item_type
) values (
  'a1140000-0000-0000-0000-000000000114', 'a1140000-0000-0000-0000-000000000031',
  'a1140000-0000-0000-0000-000000000113', 'a1140000-0000-0000-0000-000000000111',
  'a1140000-0000-0000-0000-000000000112', 'Product A', 1000, 1, 'product'
);

insert into public.tenant_events (
  id, tenant_id, title, starts_at, duration_min, capacity, price_cents, status, reserved_qty
) values (
  'a1140000-0000-0000-0000-000000000121', 'a1140000-0000-0000-0000-000000000031',
  'Event A', now() + interval '7 days', 60, 10, 1000, 'open', 1
);

-- Partner A gets A and never B.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1140000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"platform_admin":false,"partner_admin":true,"partner_id":"a1140000-0000-0000-0000-000000000001"}}',
  true
);
select set_config('request.jwt.claim.sub', 'a1140000-0000-0000-0000-000000000021', true);

do $$
begin
  if private.partner_id() is distinct from 'a1140000-0000-0000-0000-000000000001'::uuid then
    raise exception 'partner_scope_resolution_failed';
  end if;
  if not private.can_access_tenant('a1140000-0000-0000-0000-000000000031') then
    raise exception 'partner_own_tenant_missing';
  end if;
  if private.can_access_tenant('a1140000-0000-0000-0000-000000000032') then
    raise exception 'partner_cross_tenant_leak';
  end if;
end
$$;

insert into public.tenants (
  id, slug, name, plan, status, partner_id, stripe_account_id,
  stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted,
  vertical_id, created_at, updated_at
) values (
  'a1140000-0000-0000-0000-000000000034',
  'tenant-0114-direct-guard',
  'Direct guard tenant',
  'enterprise',
  'active',
  'a1140000-0000-0000-0000-000000000001',
  'acct_forbidden',
  true,
  true,
  true,
  'salon',
  '2000-01-01T00:00:00Z',
  '2000-01-02T00:00:00Z'
);

do $$
declare
  v_tenant public.tenants%rowtype;
begin
  select * into strict v_tenant
  from public.tenants
  where slug = 'tenant-0114-direct-guard';
  if v_tenant.id = 'a1140000-0000-0000-0000-000000000034'::uuid
    or v_tenant.partner_id is distinct from 'a1140000-0000-0000-0000-000000000001'::uuid
    or v_tenant.plan <> 'standard'
    or v_tenant.status <> 'provisioning'
    or v_tenant.stripe_account_id is not null
    or v_tenant.stripe_charges_enabled
    or v_tenant.stripe_payouts_enabled
    or v_tenant.stripe_details_submitted
    or v_tenant.vertical_id is not null
    or v_tenant.updated_at is not null
    or v_tenant.created_at < now() - interval '1 minute'
  then
    raise exception 'partner_direct_tenant_insert_guard_failed';
  end if;
end
$$;

do $$
declare
  v_count integer;
  v_partner uuid;
  v_license bigint;
begin
  select count(*), max(s.partner_id::text)::uuid, max(s.license_total_ore)
    into v_count, v_partner, v_license
  from public.platform_partner_summaries() s;
  if v_count <> 1
    or v_partner <> 'a1140000-0000-0000-0000-000000000001'::uuid
    or v_license <> 1234 then
    raise exception 'partner_summary_scope_failed';
  end if;
end
$$;

-- Partner A can operate its own tenant through bounded policies/RPCs, while raw
-- PII/secrets, cross-tenant writes and machine-owned fields remain fail-closed.
set local role authenticated;

do $$
declare
  v_count integer;
  v_masked text;
begin
  select count(*) into v_count
  from public.customers
  where id = 'a1140000-0000-0000-0000-000000000091';
  if v_count <> 0 then raise exception 'partner_raw_customer_pii_exposed'; end if;

  select count(*), max(masked_email) into v_count, v_masked
  from public.platform_customer_safe_rows(
    'a1140000-0000-0000-0000-000000000031', null, null, 100
  );
  if v_count <> 1 or v_masked <> '•••••@•••' then
    raise exception 'partner_customer_safe_projection_failed';
  end if;

  begin
    perform 1 from public.platform_customer_safe_rows(
      'a1140000-0000-0000-0000-000000000032', null, null, 100
    );
    raise exception 'partner_cross_customer_scope_open';
  exception when insufficient_privilege then null;
  end;

  select count(*) into v_count from public.push_subscriptions;
  if v_count <> 0 then raise exception 'partner_push_secret_exposed'; end if;
  select count(*) into v_count from public.notifications_outbox;
  if v_count <> 0 then raise exception 'partner_raw_outbox_exposed'; end if;
end
$$;

do $$
begin
  begin
    update public.users
    set role_id = 'a1140000-0000-0000-0000-000000000042'
    where id = 'a1140000-0000-0000-0000-000000000051';
    raise exception 'partner_direct_role_update_open';
  exception when insufficient_privilege then null;
  end;

  insert into public.roles (tenant_id, name, level) values (
    'a1140000-0000-0000-0000-000000000033', 'salon_admin', 6
  );
  begin
    insert into public.roles (tenant_id, name, level) values (
      'a1140000-0000-0000-0000-000000000033', 'invented_operator', 5
    );
    raise exception 'partner_arbitrary_role_provisioning_open';
  exception when insufficient_privilege or check_violation then null;
  end;

  insert into public.user_location_access (tenant_id, user_id, location_id) values (
    'a1140000-0000-0000-0000-000000000031',
    'a1140000-0000-0000-0000-000000000051',
    'a1140000-0000-0000-0000-000000000061'
  );
  begin
    update public.user_location_access
    set location_id = 'a1140000-0000-0000-0000-000000000063'
    where user_id = 'a1140000-0000-0000-0000-000000000051';
    raise exception 'partner_location_access_update_open';
  exception when insufficient_privilege then null;
  end;
end
$$;

do $$
declare
  v_count integer;
begin
  insert into public.staff (id, tenant_id, location_id, title, active) values (
    'a1140000-0000-0000-0000-000000000083',
    'a1140000-0000-0000-0000-000000000031',
    'a1140000-0000-0000-0000-000000000061',
    'Partner-created staff', false
  );
  update public.staff set title = 'Partner-updated staff'
  where id = 'a1140000-0000-0000-0000-000000000083';

  select public.platform_replace_staff_services(
    'a1140000-0000-0000-0000-000000000031',
    'a1140000-0000-0000-0000-000000000081',
    array['a1140000-0000-0000-0000-000000000072'::uuid]
  ) into v_count;
  if v_count <> 1 then raise exception 'partner_atomic_staff_services_failed'; end if;

  select public.platform_replace_service_staff(
    'a1140000-0000-0000-0000-000000000031',
    'a1140000-0000-0000-0000-000000000071',
    array['a1140000-0000-0000-0000-000000000081'::uuid]
  ) into v_count;
  if v_count <> 1 then raise exception 'partner_atomic_service_staff_failed'; end if;

  select public.platform_replace_staff_schedule(
    'a1140000-0000-0000-0000-000000000031',
    'a1140000-0000-0000-0000-000000000081',
    '[{"weekday":1,"start_time":"10:00","end_time":"16:00"}]'::jsonb
  ) into v_count;
  if v_count <> 1 then raise exception 'partner_atomic_staff_schedule_failed'; end if;

  begin
    perform public.platform_replace_staff_services(
      'a1140000-0000-0000-0000-000000000032',
      'a1140000-0000-0000-0000-000000000082',
      array['a1140000-0000-0000-0000-000000000073'::uuid]
    );
    raise exception 'partner_cross_staff_rpc_open';
  exception when insufficient_privilege then null;
  end;

  delete from public.staff_services
  where staff_id = 'a1140000-0000-0000-0000-000000000081';
  if not exists (
    select 1 from public.staff_services
    where staff_id = 'a1140000-0000-0000-0000-000000000081'
  ) then
    raise exception 'partner_direct_staff_service_write_open';
  end if;
end
$$;

do $$
begin
  perform public.platform_save_tenant_billing(
    'a1140000-0000-0000-0000-000000000031', 'flat_monthly', 100, 200, 300
  );
  begin
    perform public.platform_save_tenant_billing(
      'a1140000-0000-0000-0000-000000000032', 'flat_monthly', 1, 2, 3
    );
    raise exception 'partner_cross_billing_rpc_open';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tenant_settings set payments_enabled = true
    where tenant_id = 'a1140000-0000-0000-0000-000000000031';
    raise exception 'partner_direct_payments_enable_open';
  exception when insufficient_privilege then null;
  end;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    'a1140000-0000-0000-0000-000000000031',
    'a1140000-0000-0000-0000-000000000021',
    'partner.runtime_proof', 'tenant', 'a1140000-0000-0000-0000-000000000031', '{}'::jsonb
  );
  begin
    insert into public.audit_log (
      tenant_id, actor_profile_id, action, entity, entity_id, meta
    ) values (
      'a1140000-0000-0000-0000-000000000032',
      'a1140000-0000-0000-0000-000000000021',
      'partner.runtime_escape', 'tenant', 'a1140000-0000-0000-0000-000000000032', '{}'::jsonb
    );
    raise exception 'partner_cross_audit_insert_open';
  exception when insufficient_privilege or check_violation then null;
  end;
end
$$;

do $$
begin
  begin
    update public.locations
    set tenant_id = 'a1140000-0000-0000-0000-000000000033'
    where id = 'a1140000-0000-0000-0000-000000000061';
    raise exception 'partner_intrascope_tenant_move_open';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.shop_product_variants set reserved_qty = 0
    where id = 'a1140000-0000-0000-0000-000000000112';
    raise exception 'partner_inventory_counter_write_open';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.shop_product_variants (
      id, tenant_id, product_id, name, price_cents, stock, reserved_qty, active
    ) values (
      'a1140000-0000-0000-0000-000000000115',
      'a1140000-0000-0000-0000-000000000033',
      'a1140000-0000-0000-0000-000000000111',
      'Cross-tenant variant', 1000, 10, 0, true
    );
    raise exception 'partner_cross_tenant_product_binding_open';
  exception when check_violation then null;
  end;
  begin
    delete from public.shop_product_variants
    where id = 'a1140000-0000-0000-0000-000000000112';
    raise exception 'partner_active_variant_hold_delete_open';
  exception when foreign_key_violation then null;
  end;
  begin
    delete from public.tenant_events
    where id = 'a1140000-0000-0000-0000-000000000121';
    raise exception 'partner_active_event_hold_delete_open';
  exception when foreign_key_violation then null;
  end;
end
$$;

reset role;

-- A stale/forged claim can never turn a non-level-8 lookalike into godmode.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1140000-0000-0000-0000-000000000024","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config('request.jwt.claim.sub', 'a1140000-0000-0000-0000-000000000024', true);
do $$
begin
  if private.is_platform_admin() then
    raise exception 'level_seven_global_bypass';
  end if;
end
$$;

-- The hourly sweep relies on partner-local months and therefore handles UTC-
-- offsets on both sides of midnight correctly.
update public.partners
set timezone = 'America/Los_Angeles'
where id = 'a1140000-0000-0000-0000-000000000002';
do $$
begin
  if private.partner_month(
    'a1140000-0000-0000-0000-000000000002',
    '2026-08-01 00:05:00+00'::timestamptz
  ) <> '2026-07-01'::date then
    raise exception 'partner_negative_timezone_month_failed';
  end if;
  if private.partner_month(
    'a1140000-0000-0000-0000-000000000002',
    '2026-08-01 08:05:00+00'::timestamptz
  ) <> '2026-08-01'::date then
    raise exception 'partner_negative_timezone_month_failed';
  end if;
end
$$;

-- Global super_admin remains partner zero and reaches both.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1140000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config('request.jwt.claim.sub', 'a1140000-0000-0000-0000-000000000023', true);

do $$
begin
  if not private.can_access_tenant('a1140000-0000-0000-0000-000000000031')
     or not private.can_access_tenant('a1140000-0000-0000-0000-000000000032') then
    raise exception 'global_platform_scope_failed';
  end if;
end
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.platform_partner_summaries();
  if v_count <> 2 then
    raise exception 'global_partner_summary_failed';
  end if;
end
$$;

-- Communication cost is attributed at enqueue time. Only real SMS rows count;
-- email and simulated SMS never inflate the partner's SEK transport cost.
insert into public.notifications_outbox (
  id, tenant_id, event_type, event_key, category, chosen_channel, status, cost_ore
) values
  (
    'a1140000-0000-0000-0000-000000000131', 'a1140000-0000-0000-0000-000000000031',
    'runtime.sms', 'runtime-sms-0114', 'transactional', 'sms', 'delivered', 100
  ),
  (
    'a1140000-0000-0000-0000-000000000132', 'a1140000-0000-0000-0000-000000000031',
    'runtime.email', 'runtime-email-0114', 'transactional', 'email', 'delivered', 500
  ),
  (
    'a1140000-0000-0000-0000-000000000133', 'a1140000-0000-0000-0000-000000000031',
    'runtime.simulated', 'runtime-simulated-0114', 'transactional', 'sms', 'simulated', 700
  );

do $$
declare
  v_cost bigint;
  v_currency text;
begin
  select sms_cost_ore, sms_cost_currency into v_cost, v_currency
  from public.platform_partner_summaries()
  where partner_id = 'a1140000-0000-0000-0000-000000000001';
  if v_cost <> 100 or v_currency <> 'SEK' then
    raise exception 'partner_sms_cost_filter_failed';
  end if;
end
$$;

-- The tenant insert qualified the current month at 1234. A price change updates
-- that open month, but a closed snapshot never changes again.
update public.partners
set license_price_ore = 4321
where id = 'a1140000-0000-0000-0000-000000000001';

do $$
declare
  v_price integer;
begin
  select unit_price_ore into strict v_price
  from public.partner_license_months
  where partner_id = 'a1140000-0000-0000-0000-000000000001'
    and tenant_id = 'a1140000-0000-0000-0000-000000000031'
    and month = private.partner_month('a1140000-0000-0000-0000-000000000001', now());
  if v_price <> 4321 then
    raise exception 'partner_license_price_refresh_failed';
  end if;
end
$$;

-- Partner hard-delete is denied and can never erase the frozen month/event rows.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1140000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"platform_admin":false,"partner_admin":true,"partner_id":"a1140000-0000-0000-0000-000000000001"}}',
  true
);
select set_config('request.jwt.claim.sub', 'a1140000-0000-0000-0000-000000000021', true);
set local role authenticated;
do $$
begin
  begin
    delete from public.tenants
    where id = 'a1140000-0000-0000-0000-000000000031';
  exception when insufficient_privilege or foreign_key_violation then
    null;
  end;
end
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.partner_license_months
    where tenant_id = 'a1140000-0000-0000-0000-000000000031'
  ) or not exists (
    select 1 from public.partner_tenant_events
    where tenant_id = 'a1140000-0000-0000-0000-000000000031'
  ) then
    raise exception 'partner_license_history_deleted';
  end if;
end
$$;

update public.partner_license_months
set closed_at = now()
where partner_id = 'a1140000-0000-0000-0000-000000000001';

update public.partners
set license_price_ore = 5555
where id = 'a1140000-0000-0000-0000-000000000001';

do $$
declare
  v_price integer;
begin
  select unit_price_ore into strict v_price
  from public.partner_license_months
  where partner_id = 'a1140000-0000-0000-0000-000000000001'
    and tenant_id = 'a1140000-0000-0000-0000-000000000031';
  if v_price <> 4321 then
    raise exception 'partner_license_history_rewritten';
  end if;
end
$$;

do $$
begin
  begin
    update public.partner_license_months
    set unit_price_ore = 1
    where partner_id = 'a1140000-0000-0000-0000-000000000001'
      and tenant_id = 'a1140000-0000-0000-0000-000000000031';
    raise exception 'closed_partner_license_update_open';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.partner_license_months
    where partner_id = 'a1140000-0000-0000-0000-000000000001'
      and tenant_id = 'a1140000-0000-0000-0000-000000000031';
    raise exception 'closed_partner_license_delete_open';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Active A -> B mid-month qualifies both partners for a full month. The SMS row
-- keeps immutable A attribution even after the tenant's current owner changes.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1140000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config('request.jwt.claim.sub', 'a1140000-0000-0000-0000-000000000023', true);
update public.tenants
set partner_id = 'a1140000-0000-0000-0000-000000000002'
where id = 'a1140000-0000-0000-0000-000000000031';

do $$
declare
  v_license_rows integer;
  v_outbox_partner uuid;
  v_a_sms bigint;
  v_b_sms bigint;
begin
  select count(*) into v_license_rows
  from public.partner_license_months
  where tenant_id = 'a1140000-0000-0000-0000-000000000031'
    and partner_id in (
      'a1140000-0000-0000-0000-000000000001',
      'a1140000-0000-0000-0000-000000000002'
    );
  if v_license_rows <> 2 then
    raise exception 'partner_midmonth_move_double_qualification_failed';
  end if;

  select partner_id into strict v_outbox_partner
  from public.notifications_outbox
  where id = 'a1140000-0000-0000-0000-000000000131';
  if v_outbox_partner <> 'a1140000-0000-0000-0000-000000000001'::uuid then
    raise exception 'partner_outbox_attribution_rewritten';
  end if;

  select sms_cost_ore into v_a_sms
  from public.platform_partner_summaries()
  where partner_id = 'a1140000-0000-0000-0000-000000000001';
  select sms_cost_ore into v_b_sms
  from public.platform_partner_summaries()
  where partner_id = 'a1140000-0000-0000-0000-000000000002';
  if v_a_sms <> 100 or v_b_sms <> 0 then
    raise exception 'partner_sms_move_attribution_failed';
  end if;
end
$$;

-- No public config column can contain plaintext credentials, and the decrypting
-- resolver is service-role only.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'partner_sms_configs'
      and column_name in ('username', 'password', 'api_key', 'callback_secret')
      and data_type in ('text', 'character varying')
  ) then
    raise exception 'partner_secret_plaintext_exposed';
  end if;
  if has_function_privilege(
    'authenticated', 'public.resolve_partner_sms_config(uuid)', 'EXECUTE'
  ) then
    raise exception 'partner_secret_plaintext_exposed';
  end if;
end
$$;

rollback;
