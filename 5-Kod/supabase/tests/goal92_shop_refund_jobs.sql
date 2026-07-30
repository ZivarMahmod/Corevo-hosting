-- Goal 92 Task 3, refund-slice.
-- Kör tillsammans med migrationen i en YTTRE begin/rollback.

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Samordnad framtidsschema-simulering. Goal 92:s payment-migration äger dessa
-- kolumner; IF NOT EXISTS gör testet körbart både före och efter den migrationen.
alter table public.payments add column if not exists provider text;
alter table public.payments add column if not exists provider_account_scope text;
alter table public.payments add column if not exists provider_order_id text;
alter table public.payments add column if not exists provider_payment_id text;

do $catalog$
declare
  v_definition text;
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'private'
       and table_name = 'payment_refund_jobs'
       and column_name = 'order_id'
       and is_nullable = 'YES'
  ) or exists (
    select 1
      from information_schema.columns
     where table_schema = 'private'
       and table_name = 'payment_refund_jobs'
       and column_name = 'booking_id'
       and is_nullable = 'NO'
  ) then
    raise exception 'goal92_shop_refund_source_shape_invalid';
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid)
    into v_definition
    from pg_catalog.pg_constraint c
   where c.conrelid = 'private.payment_refund_jobs'::regclass
     and c.conname = 'payment_refund_jobs_one_source';
  if v_definition is null
     or v_definition not like '%booking_id IS NOT NULL%'
     or v_definition not like '%order_id IS NOT NULL%' then
    raise exception 'goal92_shop_refund_xor_constraint_invalid';
  end if;

  if to_regprocedure('public.enqueue_shop_order_refund(uuid,uuid)') is null
     or to_regprocedure('public.shop_order_refund_statuses(uuid)') is null
     or has_function_privilege(
       'anon',
       'public.enqueue_shop_order_refund(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.enqueue_shop_order_refund(uuid,uuid)',
       'EXECUTE'
     ) then
    raise exception 'goal92_shop_refund_rpc_grant_invalid';
  end if;
end
$catalog$;

alter table public.tenants disable trigger trg_tenant_launch_readiness;

do $runtime$
declare
  v_tenant uuid := gen_random_uuid();
  v_owner_role uuid := gen_random_uuid();
  v_customer_role uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_customer uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_variant uuid := gen_random_uuid();
  v_stripe_order uuid := gen_random_uuid();
  v_paypal_order uuid := gen_random_uuid();
  v_admin_order uuid := gen_random_uuid();
  v_stripe_payment uuid := gen_random_uuid();
  v_paypal_payment uuid := gen_random_uuid();
  v_admin_payment uuid := gen_random_uuid();
  v_suffix text := pg_catalog.replace(v_tenant::text, '-', '');
  v_stripe_pi text := 'pi_refund_' || v_suffix;
  v_stripe_account text := 'acct_refund_' || v_suffix;
  v_stripe_order_ref text := 'cs_refund_' || v_suffix;
  v_paypal_order_ref text := 'PAYPAL-ORDER-' || v_suffix;
  v_paypal_capture text := 'CAPTURE-' || v_suffix;
  v_admin_pi text := 'pi_admin_' || v_suffix;
  v_admin_account text := 'acct_admin_' || v_suffix;
  v_admin_order_ref text := 'cs_admin_' || v_suffix;
  v_job uuid;
  v_repeat_job uuid;
  v_paypal_job uuid;
  v_admin_job uuid;
  v_lease_a uuid := gen_random_uuid();
  v_lease_b uuid := gen_random_uuid();
  v_lease_c uuid := gen_random_uuid();
  v_claim record;
  v_result record;
  v_failed boolean := false;
  v_began boolean;
  v_completed boolean;
begin
  insert into public.tenants (id, slug, name, status)
  values (
    v_tenant,
    'goal92-refund-' || pg_catalog.substr(v_tenant::text, 1, 8),
    'Goal 92 Refund',
    'active'
  );
  insert into public.roles (id, tenant_id, name, level) values
    (v_owner_role, v_tenant, 'owner-goal92', 6),
    (v_customer_role, v_tenant, 'customer-goal92', 2);
  insert into auth.users (id, email) values
    (v_owner, 'goal92-owner-' || pg_catalog.substr(v_owner::text, 1, 8) || '@example.test'),
    (v_customer, 'goal92-customer-' || pg_catalog.substr(v_customer::text, 1, 8) || '@example.test');
  insert into public.users (id, tenant_id, email, role_id, status) values
    (v_owner, v_tenant, 'goal92-owner@example.test', v_owner_role, 'active'),
    (v_customer, v_tenant, 'goal92-customer@example.test', v_customer_role, 'active');

  insert into public.shop_products (
    id, tenant_id, name, price_cents, currency, stock, active
  ) values (
    v_product, v_tenant, 'Refundprodukt', 10000, 'SEK', 7, true
  );
  insert into public.shop_product_variants (
    id, tenant_id, product_id, name, price_cents, currency, stock, reserved_qty, active
  ) values (
    v_variant, v_tenant, v_product, 'Standard', 10000, 'SEK', 7, 0, true
  );
  insert into public.shop_orders (
    id, tenant_id, total_cents, subtotal_cents, currency,
    status, payment_status, stock_committed
  ) values
    (v_stripe_order, v_tenant, 10000, 10000, 'SEK', 'completed', 'paid', true),
    (v_paypal_order, v_tenant, 10000, 10000, 'SEK', 'confirmed', 'paid', true),
    (v_admin_order, v_tenant, 10000, 10000, 'SEK', 'confirmed', 'paid', true);
  insert into public.shop_order_items (
    tenant_id, order_id, product_id, variant_id, product_name, unit_price_cents, quantity
  ) values (
    v_tenant, v_stripe_order, v_product, v_variant, 'Refundprodukt', 10000, 1
  );

  insert into public.payments (
    id, tenant_id, order_id, amount_cents, currency, status,
    stripe_payment_intent_id, stripe_connected_account_id,
    provider, provider_account_scope, provider_order_id, provider_payment_id
  ) values
    (
      v_stripe_payment, v_tenant, v_stripe_order, 10000, 'SEK', 'succeeded',
      v_stripe_pi, v_stripe_account,
      'stripe', v_stripe_account, v_stripe_order_ref, v_stripe_pi
    ),
    (
      v_paypal_payment, v_tenant, v_paypal_order, 10000, 'SEK', 'succeeded',
      null, null,
      'paypal', 'paypal:platform', v_paypal_order_ref, v_paypal_capture
    ),
    (
      v_admin_payment, v_tenant, v_admin_order, 10000, 'SEK', 'succeeded',
      v_admin_pi, v_admin_account,
      'stripe', v_admin_account, v_admin_order_ref, v_admin_pi
    );

  select * into v_result
    from public.enqueue_shop_order_refund(v_tenant, v_stripe_order);
  v_job := v_result.job_id;
  if v_job is null
     or v_result.refund_status <> 'pending'
     or not exists (
       select 1
         from private.payment_refund_jobs j
        where j.id = v_job
          and j.tenant_id = v_tenant
          and j.payment_id = v_stripe_payment
          and j.booking_id is null
          and j.order_id = v_stripe_order
          and j.provider is null
          and j.provider_payment_intent_id is null
          and j.provider_connected_account_id is null
     ) then
    raise exception 'goal92_shop_refund_enqueue_invalid';
  end if;

  select job_id into v_repeat_job
    from public.enqueue_shop_order_refund(v_tenant, v_stripe_order);
  if v_repeat_job is distinct from v_job
     or (select count(*) from private.payment_refund_jobs where order_id = v_stripe_order) <> 1 then
    raise exception 'goal92_shop_refund_enqueue_replay_invalid';
  end if;

  select * into v_claim
    from public.claim_payment_refund_job_by_id(
      v_job, v_lease_a, statement_timestamp(), 120
    );
  if v_claim.id is distinct from v_job
     or v_claim.provider <> 'stripe'
     or v_claim.provider_payment_id <> v_stripe_pi
     or v_claim.provider_account_scope <> v_stripe_account
     or v_claim.order_id <> v_stripe_order
     or v_claim.booking_id is not null then
    raise exception 'goal92_shop_refund_stripe_claim_invalid';
  end if;
  if not public.begin_payment_refund_delivery(v_job, v_lease_a)
     or not public.complete_payment_refund_job(v_job, v_lease_a, 're_goal92_stripe')
     or not public.complete_payment_refund_job(v_job, v_lease_a, 're_goal92_stripe') then
    raise exception 'goal92_shop_refund_stripe_complete_invalid';
  end if;
  if (select status from public.payments where id = v_stripe_payment) <> 'refunded'
     or (select payment_status from public.shop_orders where id = v_stripe_order) <> 'refunded'
     or (select status from public.shop_orders where id = v_stripe_order) <> 'completed'
     or not (select stock_committed from public.shop_orders where id = v_stripe_order)
     or (select stock from public.shop_product_variants where id = v_variant) <> 7
     or (select reserved_qty from public.shop_product_variants where id = v_variant) <> 0
     or (select refund_status from public.shop_order_refund_statuses(v_tenant)
          where order_id = v_stripe_order) <> 'succeeded' then
    raise exception 'goal92_shop_refund_atomic_completion_invalid';
  end if;

  select job_id into v_paypal_job
    from public.enqueue_shop_order_refund(v_tenant, v_paypal_order);
  select * into v_claim
    from public.claim_payment_refund_job_by_id(
      v_paypal_job, v_lease_b, statement_timestamp(), 120
    );
  if v_claim.provider <> 'paypal'
     or v_claim.provider_payment_id <> v_paypal_capture
     or v_claim.provider_account_scope <> 'paypal:platform'
     or v_claim.order_id <> v_paypal_order then
    raise exception 'goal92_shop_refund_paypal_claim_invalid';
  end if;
  if public.retry_payment_refund_job(
       v_paypal_job,
       v_lease_b,
       'provider_unavailable_before_request',
       statement_timestamp()
     ) <> 'queued'
     or (select refund_status from public.shop_order_refund_statuses(v_tenant)
          where order_id = v_paypal_order) <> 'pending' then
    raise exception 'goal92_shop_refund_paypal_retry_invalid';
  end if;
  select * into v_claim
    from public.claim_payment_refund_job_by_id(
      v_paypal_job, v_lease_c, statement_timestamp(), 120
    );
  v_began := public.begin_payment_refund_delivery(v_paypal_job, v_lease_c);
  if v_began then
    v_completed := public.complete_payment_refund_job(
      v_paypal_job, v_lease_c, 'REFUND-PAYPAL-GOAL92'
    );
  end if;
  if v_began is distinct from true
     or v_completed is distinct from true
     or (select status from public.payments where id = v_paypal_payment) <> 'refunded'
     or (select payment_status from public.shop_orders where id = v_paypal_order) <> 'refunded'
     or (select status from public.shop_orders where id = v_paypal_order) <> 'confirmed' then
    raise exception 'goal92_shop_refund_paypal_complete_invalid:%:%',
      v_began, v_completed;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_customer::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_customer,
      'role', 'authenticated',
      'app_metadata', pg_catalog.jsonb_build_object(
        'tenant_id', v_tenant,
        'platform_admin', false
      )
    )::text,
    true
  );
  begin
    perform * from public.enqueue_shop_order_refund(v_tenant, v_admin_order);
  exception when sqlstate '42501' then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'goal92_shop_refund_customer_auth_invalid';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_owner,
      'role', 'authenticated',
      'app_metadata', pg_catalog.jsonb_build_object(
        'tenant_id', v_tenant,
        'platform_admin', false
      )
    )::text,
    true
  );
  select job_id into v_admin_job
    from public.enqueue_shop_order_refund(v_tenant, v_admin_order);
  if v_admin_job is null then
    raise exception 'goal92_shop_refund_owner_auth_invalid';
  end if;
end
$runtime$;

alter table public.tenants enable trigger trg_tenant_launch_readiness;

select 'goal92_shop_refund_jobs_ok' as result;
