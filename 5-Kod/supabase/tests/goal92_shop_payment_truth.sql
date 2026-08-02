-- Goal 92 webshop: reserve idempotency, SEK-only payment truth and durable events.
-- Fixtures are added below once the contract objects exist; every mutation rolls back.
begin;

do $$
declare
  v_reserve_def text;
  v_prepare_def text;
  v_settle_def text;
begin
  if to_regprocedure(
       'public.reserve_shop_order(text,jsonb,text,text,integer,uuid)'
     ) is null
     or to_regprocedure(
       'public.prepare_shop_order_payment(uuid,uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.record_shop_payment_order_reference(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.register_shop_payment_event(text,text,text,text,uuid,uuid,text,integer,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.settle_shop_payment_event(uuid)'
     ) is null
     or to_regprocedure(
       'public.complete_shop_payment_event(uuid,text,text)'
     ) is null
     or to_regclass('private.shop_payment_events') is null then
    raise exception 'goal92_shop_payment_truth_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shop_orders'
      and column_name = 'reserve_request_id'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'provider_payment_id'
  ) or to_regclass('public.shop_orders_tenant_reserve_request_key') is null
     or to_regclass('public.payments_provider_payment_identity_key') is null then
    raise exception 'goal92_shop_payment_storage_missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.reserve_shop_order(text,jsonb,text,text,integer,uuid)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.reserve_shop_order(text,jsonb,text,text,integer,uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.prepare_shop_order_payment(uuid,uuid,text,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.settle_shop_payment_event(uuid)',
       'execute'
     )
     or has_table_privilege(
       'authenticated',
       'private.shop_payment_events',
       'select'
     ) then
    raise exception 'goal92_shop_payment_grants_invalid';
  end if;

  v_reserve_def := pg_catalog.lower(pg_catalog.pg_get_functiondef(
    'public.reserve_shop_order(text,jsonb,text,text,integer,uuid)'::regprocedure
  ));
  v_prepare_def := pg_catalog.lower(pg_catalog.pg_get_functiondef(
    'public.prepare_shop_order_payment(uuid,uuid,text,text)'::regprocedure
  ));
  v_settle_def := pg_catalog.lower(pg_catalog.pg_get_functiondef(
    'public.settle_shop_payment_event(uuid)'::regprocedure
  ));
  if position('pg_advisory_xact_lock' in v_reserve_def) = 0
     or position('reserve_request_mismatch' in v_reserve_def) = 0
     or position('for update' in v_prepare_def) = 0
     or position('sum(' in v_prepare_def) = 0
     or position('_commit_shop_order_stock' in v_settle_def) = 0
     or position('amount_cents <>' in v_settle_def) = 0 then
    raise exception 'goal92_shop_payment_lock_or_exactness_missing';
  end if;
end
$$;

alter table public.tenants disable trigger trg_tenant_launch_readiness;
alter table public.tenant_modules disable trigger trg_tenant_modules_state_guard;

do $$
declare
  v_tenant uuid := '92300000-0000-0000-0000-000000000001';
  v_product uuid := '92300000-0000-0000-0000-000000000002';
  v_variant uuid := '92300000-0000-0000-0000-000000000003';
  v_request uuid := '92300000-0000-4000-8000-000000000004';
  v_order uuid;
  v_replay uuid;
  v_confirm record;
  v_snapshot jsonb;
  v_snapshot_replay jsonb;
  v_payment uuid;
  v_event jsonb;
  v_event_id uuid;
  v_outcome jsonb;
  v_failed_event_id uuid;
  v_mismatch_event_id uuid;
  v_currency_event_id uuid;
  v_late_event_id uuid;
  v_external_order uuid := '92300000-0000-0000-0000-000000000012';
  v_external_payment uuid := '92300000-0000-0000-0000-000000000013';
  v_external_event_id uuid;
  v_cart jsonb;
begin
  insert into public.tenants (
    id,
    slug,
    name,
    status,
    stripe_account_id,
    stripe_charges_enabled
  ) values (
    v_tenant,
    'goal92-shop-truth',
    'Goal 92 Shop Truth',
    'active',
    'acct_goal92_truth',
    true
  );
  insert into public.tenant_modules (
    tenant_id,
    module_key,
    state,
    config
  ) values (
    v_tenant,
    'shop',
    'live',
    '{"fulfilment":"ship","payment_methods":["paypal","card"]}'::jsonb
  );
  insert into public.shop_products (
    id,
    tenant_id,
    name,
    price_cents,
    currency,
    stock,
    active
  ) values (
    v_product,
    v_tenant,
    'Goal 92 produkt',
    5000,
    'SEK',
    10,
    true
  );
  insert into public.shop_product_variants (
    id,
    tenant_id,
    product_id,
    name,
    price_cents,
    currency,
    stock,
    reserved_qty,
    active
  ) values (
    v_variant,
    v_tenant,
    v_product,
    'Standard',
    5000,
    'SEK',
    10,
    0,
    true
  );

  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    '{"role":"service_role"}',
    true
  );

  v_cart := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'kind', 'product',
    'variant_id', v_variant,
    'quantity', 2
  ));

  v_order := public.reserve_shop_order(
    'goal92-shop-truth',
    v_cart,
    'ship',
    'goal92-token',
    30,
    v_request
  );
  v_replay := public.reserve_shop_order(
    'goal92-shop-truth',
    v_cart,
    'ship',
    'goal92-token',
    30,
    v_request
  );
  if v_replay is distinct from v_order
     or (select reserved_qty from public.shop_product_variants where id = v_variant) <> 2
     or (select count(*) from public.shop_orders where tenant_id = v_tenant) <> 1 then
    raise exception 'goal92_reserve_replay_invalid';
  end if;

  begin
    perform public.reserve_shop_order(
      'goal92-shop-truth',
      v_cart,
      'ship',
      'other-token',
      30,
      v_request
    );
    raise exception 'goal92_reserve_token_mismatch_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'reserve_request_mismatch' then raise; end if;
  end;
  begin
    perform public.reserve_shop_order(
      'goal92-shop-truth',
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'kind', 'product',
        'variant_id', v_variant,
        'quantity', 1
      )),
      'ship',
      'goal92-token',
      30,
      v_request
    );
    raise exception 'goal92_reserve_cart_mismatch_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'reserve_request_mismatch' then raise; end if;
  end;

  begin
    insert into public.shop_product_variants (
      tenant_id,
      product_id,
      name,
      price_cents,
      currency,
      stock,
      active
    ) values (
      v_tenant,
      v_product,
      'USD-förbjuden',
      5000,
      'USD',
      1,
      true
    );
    raise exception 'goal92_non_sek_variant_accepted';
  exception when check_violation then
    null;
  end;

  begin
    update public.shop_orders
    set total_cents = 0, payment_method = 'card', status = 'awaiting_payment'
    where id = v_order;
    raise exception 'goal92_zero_total_payment_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'zero_total_payment_not_required' then raise; end if;
  end;

  begin
    perform public.confirm_shop_order(
      v_order,
      'goal92-token',
      null,
      'Goal 92 Köpare',
      'buyer@example.test',
      '+46700000000',
      null,
      null,
      null,
      null,
      null
    );
    raise exception 'goal92_missing_payment_method_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'payment_method_required' then raise; end if;
  end;

  select * into v_confirm
  from public.confirm_shop_order(
    v_order,
    'goal92-token',
    null,
    'Goal 92 Köpare',
    'buyer@example.test',
    '+46700000000',
    null,
    null,
    null,
    null,
    'paypal'
  );
  if not v_confirm.requires_payment
     or (select status from public.shop_orders where id = v_order) <> 'awaiting_payment'
     or (select stock_committed from public.shop_orders where id = v_order)
     or (select reserved_qty from public.shop_product_variants where id = v_variant) <> 2 then
    raise exception 'goal92_paypal_hold_was_not_preserved';
  end if;

  v_snapshot := public.prepare_shop_order_payment(
    v_order,
    v_tenant,
    'paypal',
    'paypal:platform'
  );
  v_snapshot_replay := public.prepare_shop_order_payment(
    v_order,
    v_tenant,
    'paypal',
    'paypal:platform'
  );
  v_payment := (v_snapshot->>'payment_id')::uuid;
  if v_payment is null
     or v_snapshot_replay->>'payment_id' is distinct from v_snapshot->>'payment_id'
     or (v_snapshot->>'subtotal_cents')::integer <> 10000
     or (v_snapshot->>'total_cents')::integer <> 10000
     or v_snapshot->>'currency' <> 'SEK'
     or (select provider from public.payments where id = v_payment) <> 'paypal'
     or (select amount_cents from public.payments where id = v_payment) <> 10000 then
    raise exception 'goal92_payment_snapshot_invalid snapshot=% replay=% payment=%',
      v_snapshot,
      v_snapshot_replay,
      v_payment;
  end if;

  begin
    perform public.prepare_shop_order_payment(
      v_order,
      v_tenant,
      'stripe',
      'acct_goal92_truth'
    );
    raise exception 'goal92_payment_provider_switch_accepted';
  exception when sqlstate '55000' then
    null;
  end;

  update public.shop_order_items
  set unit_price_cents = 5100
  where order_id = v_order;
  begin
    perform public.prepare_shop_order_payment(
      v_order,
      v_tenant,
      'paypal',
      'paypal:platform'
    );
    raise exception 'goal92_payment_item_sum_drift_accepted';
  exception when check_violation then
    null;
  end;
  update public.shop_order_items
  set unit_price_cents = 5000
  where order_id = v_order;

  perform public.record_shop_payment_order_reference(
    v_payment,
    'paypal',
    'PAYPAL-ORDER-GOAL92'
  );
  perform public.record_shop_payment_order_reference(
    v_payment,
    'paypal',
    'PAYPAL-ORDER-GOAL92'
  );
  begin
    perform public.record_shop_payment_order_reference(
      v_payment,
      'paypal',
      'PAYPAL-ORDER-OTHER'
    );
    raise exception 'goal92_provider_order_reference_switch_accepted';
  exception when sqlstate '55000' then
    null;
  end;

  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'WH-FAILED-GOAL92',
    'payment_failed',
    v_tenant,
    v_order,
    'CAPTURE-GOAL92',
    null,
    'SEK',
    '{"source":"webhook","email":"must-not-survive@example.test"}'::jsonb
  );
  v_failed_event_id := (v_event->>'event_id')::uuid;
  v_outcome := public.settle_shop_payment_event(v_failed_event_id);
  if v_outcome->>'outcome' <> 'failed'
     or (select status from public.payments where id = v_payment) <> 'failed'
     or (select status from public.shop_orders where id = v_order) <> 'awaiting_payment'
     or (select normalized_payload ? 'email'
           from private.shop_payment_events where id = v_failed_event_id)
     or (select count(*) from public.audit_log
         where entity_id = v_order and action = 'shop.payment.failed') <> 1 then
    raise exception 'goal92_failed_event_invalid';
  end if;
  perform public.settle_shop_payment_event(v_failed_event_id);
  if (select count(*) from public.audit_log
      where entity_id = v_order and action = 'shop.payment.failed') <> 1 then
    raise exception 'goal92_failed_event_replay_audit_duplicated';
  end if;

  perform public.prepare_shop_order_payment(
    v_order,
    v_tenant,
    'paypal',
    'paypal:platform'
  );

  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'WH-SUCCEEDED-GOAL92',
    'payment_succeeded',
    v_tenant,
    v_order,
    'CAPTURE-GOAL92',
    10000,
    'SEK',
    '{"source":"webhook"}'::jsonb
  );
  v_event_id := (v_event->>'event_id')::uuid;
  v_outcome := public.settle_shop_payment_event(v_event_id);
  if v_outcome->>'outcome' <> 'succeeded'
     or (select status from public.payments where id = v_payment) <> 'succeeded'
     or (select provider_payment_id from public.payments where id = v_payment)
        <> 'CAPTURE-GOAL92'
     or (select payment_status from public.shop_orders where id = v_order) <> 'paid'
     or not (select stock_committed from public.shop_orders where id = v_order)
     or (select stock from public.shop_product_variants where id = v_variant) <> 8
     or (select reserved_qty from public.shop_product_variants where id = v_variant) <> 0
     or (select count(*) from public.audit_log
         where entity_id = v_order and action = 'shop.payment.succeeded') <> 1 then
    raise exception 'goal92_payment_settlement_invalid';
  end if;

  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'WH-SUCCEEDED-GOAL92',
    'payment_succeeded',
    v_tenant,
    v_order,
    'CAPTURE-GOAL92',
    10000,
    'SEK',
    '{"source":"webhook"}'::jsonb
  );
  if (v_event->>'event_id')::uuid is distinct from v_event_id then
    raise exception 'goal92_event_replay_identity_invalid';
  end if;
  perform public.settle_shop_payment_event(v_event_id);

  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'RETURN-SUCCEEDED-GOAL92',
    'payment_succeeded',
    v_tenant,
    v_order,
    'CAPTURE-GOAL92',
    10000,
    'SEK',
    '{"source":"return"}'::jsonb
  );
  v_outcome := public.settle_shop_payment_event((v_event->>'event_id')::uuid);
  if v_outcome->>'outcome' <> 'already_succeeded'
     or (select count(*) from public.audit_log
         where entity_id = v_order and action = 'shop.payment.succeeded') <> 1
     or (select stock from public.shop_product_variants where id = v_variant) <> 8 then
    raise exception 'goal92_cross_transport_replay_invalid';
  end if;

  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'WH-AMOUNT-MISMATCH-GOAL92',
    'payment_succeeded',
    v_tenant,
    v_order,
    'CAPTURE-GOAL92',
    10001,
    'SEK',
    '{"source":"webhook"}'::jsonb
  );
  v_mismatch_event_id := (v_event->>'event_id')::uuid;
  v_outcome := public.settle_shop_payment_event(v_mismatch_event_id);
  if v_outcome->>'outcome' <> 'amount_mismatch'
     or (select status from private.shop_payment_events where id = v_mismatch_event_id)
        <> 'review_required' then
    raise exception 'goal92_overpayment_was_not_rejected';
  end if;

  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'WH-CURRENCY-MISMATCH-GOAL92',
    'payment_succeeded',
    v_tenant,
    v_order,
    'CAPTURE-GOAL92',
    10000,
    'USD',
    '{"source":"webhook"}'::jsonb
  );
  v_currency_event_id := (v_event->>'event_id')::uuid;
  v_outcome := public.settle_shop_payment_event(v_currency_event_id);
  if v_outcome->>'outcome' <> 'amount_mismatch' then
    raise exception 'goal92_currency_mismatch_was_not_rejected';
  end if;

  v_outcome := public.complete_shop_payment_event(
    v_mismatch_event_id,
    'refunded',
    'amount_mismatch'
  );
  if v_outcome->>'outcome' <> 'refunded'
     or (select status from public.payments where id = v_payment) <> 'refunded'
     or (select payment_status from public.shop_orders where id = v_order) <> 'refunded'
     or (select status from public.shop_orders where id = v_order) <> 'pending'
     or (select stock from public.shop_product_variants where id = v_variant) <> 8
     or (select reserved_qty from public.shop_product_variants where id = v_variant) <> 0
     or (select count(*) from public.audit_log
         where entity_id = v_order and action = 'shop.payment.refunded') <> 1 then
    raise exception 'goal92_compensating_refund_invalid';
  end if;

  insert into public.shop_orders (
    id, tenant_id, subtotal_cents, total_cents, currency,
    status, payment_status, stock_committed
  ) values (
    v_external_order, v_tenant, 10000, 10000, 'SEK',
    'ready', 'paid', true
  );
  insert into public.payments (
    id, tenant_id, order_id, amount_cents, currency, status,
    provider, provider_account_scope, provider_order_id, provider_payment_id
  ) values (
    v_external_payment, v_tenant, v_external_order, 10000, 'SEK', 'succeeded',
    'paypal', 'paypal:platform',
    'PAYPAL-ORDER-EXTERNAL-GOAL92', 'CAPTURE-EXTERNAL-GOAL92'
  );
  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'WH-REFUND-EXTERNAL-GOAL92',
    'refund_succeeded',
    null,
    null,
    'CAPTURE-EXTERNAL-GOAL92',
    10000,
    'SEK',
    '{"source":"webhook"}'::jsonb
  );
  v_external_event_id := (v_event->>'event_id')::uuid;
  v_outcome := public.settle_shop_payment_event(v_external_event_id);
  if v_outcome->>'outcome' <> 'refunded'
     or (select status from public.payments where id = v_external_payment) <> 'refunded'
     or (select payment_status from public.shop_orders where id = v_external_order) <> 'refunded'
     or (select status from public.shop_orders where id = v_external_order) <> 'ready'
     or not (select stock_committed from public.shop_orders where id = v_external_order)
     or (select stock from public.shop_product_variants where id = v_variant) <> 8
     or (select count(*) from public.audit_log
         where entity_id = v_external_order and action = 'shop.payment.refunded') <> 1 then
    raise exception 'goal92_external_refund_changed_workflow';
  end if;

  v_event := public.register_shop_payment_event(
    'paypal',
    'paypal:platform',
    'WH-LATE-SUCCESS-GOAL92',
    'payment_succeeded',
    v_tenant,
    v_order,
    'CAPTURE-GOAL92',
    10000,
    'SEK',
    '{"source":"webhook"}'::jsonb
  );
  v_late_event_id := (v_event->>'event_id')::uuid;
  v_outcome := public.settle_shop_payment_event(v_late_event_id);
  if v_outcome->>'outcome' <> 'refunded'
     or (select stock from public.shop_product_variants where id = v_variant) <> 8
     or (select count(*) from public.audit_log
         where entity_id = v_order and action = 'shop.payment.succeeded') <> 1 then
    raise exception 'goal92_late_success_revived_refund';
  end if;

  raise notice 'goal92_shop_payment_truth_ok';
end
$$;

alter table public.tenants enable trigger trg_tenant_launch_readiness;
alter table public.tenant_modules enable trigger trg_tenant_modules_state_guard;

rollback;
