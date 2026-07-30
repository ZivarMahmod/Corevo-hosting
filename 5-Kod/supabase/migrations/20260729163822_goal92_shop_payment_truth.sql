-- Goal 92 — webshop order/payment truth.
-- One reserve request, one SEK snapshot, one durable provider-event boundary.

-- ---------------------------------------------------------------------------
-- SEK-only snapshots and reserve request identity.
-- ---------------------------------------------------------------------------
alter table public.shop_orders
  add column if not exists reserve_request_id uuid,
  add column if not exists reserve_cart_hash bytea;

create unique index if not exists shop_orders_tenant_reserve_request_key
  on public.shop_orders (tenant_id, reserve_request_id)
  where reserve_request_id is not null;

alter table public.shop_order_items
  add column if not exists currency text not null default 'SEK';

alter table public.tenant_events
  add column if not exists currency text not null default 'SEK';

update public.shop_product_variants set currency = 'SEK'
where pg_catalog.upper(currency) = 'SEK' and currency <> 'SEK';
update public.tenant_events set currency = 'SEK'
where pg_catalog.upper(currency) = 'SEK' and currency <> 'SEK';
update public.shop_order_items set currency = 'SEK'
where pg_catalog.upper(currency) = 'SEK' and currency <> 'SEK';
update public.shop_orders set currency = 'SEK'
where pg_catalog.upper(currency) = 'SEK' and currency <> 'SEK';
update public.payments set currency = 'SEK'
where order_id is not null and pg_catalog.upper(currency) = 'SEK' and currency <> 'SEK';

alter table public.shop_product_variants
  drop constraint if exists shop_product_variants_goal92_sek;
alter table public.shop_product_variants
  add constraint shop_product_variants_goal92_sek check (currency = 'SEK');

alter table public.tenant_events
  drop constraint if exists tenant_events_goal92_sek;
alter table public.tenant_events
  add constraint tenant_events_goal92_sek check (currency = 'SEK');

alter table public.shop_order_items
  drop constraint if exists shop_order_items_goal92_sek;
alter table public.shop_order_items
  add constraint shop_order_items_goal92_sek check (currency = 'SEK');

alter table public.shop_orders
  drop constraint if exists shop_orders_goal92_sek,
  drop constraint if exists shop_orders_goal92_total_formula;
alter table public.shop_orders
  add constraint shop_orders_goal92_sek check (currency = 'SEK'),
  add constraint shop_orders_goal92_total_formula check (
    total_cents = greatest(
      0,
      subtotal_cents + shipping_cents - discount_cents + tax_cents
    )
  );

alter table public.payments
  drop constraint if exists payments_goal92_shop_sek;
alter table public.payments
  add constraint payments_goal92_shop_sek check (
    order_id is null or currency = 'SEK'
  );

-- Provider-neutral frozen identity. Existing Stripe columns remain populated for
-- booking compatibility and refund lookup.
alter table public.payments
  add column if not exists provider text,
  add column if not exists provider_account_scope text,
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text;

alter table public.payments
  drop constraint if exists payments_goal92_provider;
alter table public.payments
  add constraint payments_goal92_provider check (
    provider is null or provider in ('stripe', 'paypal')
  );

create unique index if not exists payments_provider_payment_identity_key
  on public.payments (provider, provider_account_scope, provider_payment_id)
  where provider is not null and provider_account_scope is not null
    and provider_payment_id is not null;

-- ---------------------------------------------------------------------------
-- Reserve idempotency. The preserved Goal 87 implementation still owns stock
-- row locks and writes; this wrapper serializes one client request around it.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_shop_order(
  p_tenant_slug text,
  p_items jsonb,
  p_fulfilment text,
  p_token text,
  p_ttl_min integer,
  p_reserve_request_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_existing public.shop_orders%rowtype;
  v_order uuid;
  v_normalized jsonb;
  v_cart_hash bytea;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_reserve_request_id is null then
    raise exception 'reserve_request_id_required' using errcode = '22023';
  end if;
  if p_token is null or pg_catalog.btrim(p_token) = '' then
    raise exception 'missing_token' using errcode = '22023';
  end if;
  if p_ttl_min is null or p_ttl_min <= 0 or p_ttl_min > 240 then
    raise exception 'bad_ttl' using errcode = '22023';
  end if;
  if p_fulfilment not in ('ship', 'pickup_within_days', 'order_in_then_pickup') then
    raise exception 'bad_fulfilment' using errcode = '22023';
  end if;
  if p_items is null
     or pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = '22023';
  end if;

  select t.id into v_tenant
  from public.tenants t
  where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
    and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;
  if not private.module_public_action_allowed(v_tenant, 'shop') then
    raise exception 'module_public_action_denied' using errcode = '55000';
  end if;

  select pg_catalog.jsonb_build_object(
    'fulfilment', p_fulfilment,
    'items', pg_catalog.jsonb_agg(n.item order by n.item::text)
  )
  into v_normalized
  from (
    select case coalesce(e->>'kind', 'product')
      when 'product' then pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'kind', 'product',
        'variant_id', e->>'variant_id',
        'quantity', coalesce((e->>'quantity')::integer, 0)
      ))
      when 'event' then pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'kind', 'event',
        'event_id', e->>'event_id',
        'quantity', coalesce((e->>'quantity')::integer, 0)
      ))
      when 'giftcard' then pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'kind', 'giftcard',
        'amount', coalesce((e->>'amount')::integer, 0),
        'delivery_mode', nullif(pg_catalog.btrim(coalesce(e->>'delivery_mode', '')), ''),
        'recipient_name', nullif(pg_catalog.btrim(coalesce(e->>'recipient_name', '')), ''),
        'recipient_email', nullif(pg_catalog.btrim(coalesce(e->>'recipient_email', '')), ''),
        'message', nullif(pg_catalog.btrim(coalesce(e->>'message', '')), '')
      ))
      else pg_catalog.jsonb_build_object('kind', e->>'kind')
    end as item
    from pg_catalog.jsonb_array_elements(p_items) e
  ) n;

  v_cart_hash := extensions.digest(
    pg_catalog.convert_to(v_normalized::text, 'UTF8'),
    'sha256'
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_tenant::text || ':shop-reserve:' || p_reserve_request_id::text,
    0
  ));

  select o.* into v_existing
  from public.shop_orders o
  where o.tenant_id = v_tenant
    and o.reserve_request_id = p_reserve_request_id
  for update;
  if found then
    if v_existing.session_token is distinct from p_token
       or v_existing.reserve_cart_hash is distinct from v_cart_hash then
      raise exception 'reserve_request_mismatch' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  -- Reject another or mixed currency before any order, hold or payment write.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) e
    left join public.shop_product_variants v
      on v.id = nullif(e->>'variant_id', '')::uuid
     and v.tenant_id = v_tenant
    where coalesce(e->>'kind', 'product') = 'product'
      and (v.id is null or v.currency <> 'SEK')
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) e
    left join public.tenant_events ev
      on ev.id = nullif(e->>'event_id', '')::uuid
     and ev.tenant_id = v_tenant
    where e->>'kind' = 'event'
      and (ev.id is null or ev.currency <> 'SEK')
  ) then
    raise exception 'shop_currency_must_be_sek' using errcode = '22023';
  end if;

  v_order := private.reserve_shop_order_goal87_impl(
    p_tenant_slug,
    p_items,
    p_fulfilment,
    p_token,
    p_ttl_min
  );

  update public.shop_orders o
  set reserve_request_id = p_reserve_request_id,
      reserve_cart_hash = v_cart_hash,
      currency = 'SEK'
  where o.id = v_order and o.tenant_id = v_tenant;

  update public.shop_order_items i
  set currency = 'SEK'
  where i.order_id = v_order and i.tenant_id = v_tenant;

  return v_order;
end;
$$;

revoke all on function public.reserve_shop_order(
  text, jsonb, text, text, integer, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.reserve_shop_order(
  text, jsonb, text, text, integer, uuid
) to service_role;

-- Keep the old service-only signature for internal callers. It intentionally
-- receives a fresh request id; session_token remains access proof, never the
-- generic idempotency key.
create or replace function public.reserve_shop_order(
  p_tenant_slug text,
  p_items jsonb,
  p_fulfilment text default 'ship',
  p_token text default null,
  p_ttl_min integer default 30
) returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.reserve_shop_order(
    p_tenant_slug,
    p_items,
    p_fulfilment,
    p_token,
    p_ttl_min,
    extensions.gen_random_uuid()
  );
$$;

revoke all on function public.reserve_shop_order(
  text, jsonb, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.reserve_shop_order(
  text, jsonb, text, text, integer
) to service_role;

-- ---------------------------------------------------------------------------
-- Confirm: a selected online provider always keeps the stock hold until the
-- durable payment settlement. PayPal may not fall through the Stripe gate.
-- ---------------------------------------------------------------------------
create or replace function private.confirm_shop_order_goal87_impl(
  p_order_id uuid,
  p_token text,
  p_customer uuid default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_ship_address text default null,
  p_pickup_location uuid default null,
  p_note text default null,
  p_shipping_option uuid default null,
  p_payment_method text default null
) returns table (order_id uuid, requires_payment boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.shop_orders%rowtype;
  v_uid uuid := auth.uid();
  v_cust uuid;
  v_email text;
  v_phone text;
  v_req boolean;
  v_ship integer := 0;
  v_ship_id uuid;
  v_no text;
  v_total integer;
begin
  select o.* into v_order
  from public.shop_orders o
  where o.id = p_order_id
  for update;
  if v_order.id is null then
    raise exception 'unknown_order' using errcode = 'P0002';
  end if;
  if p_token is null
     or v_order.session_token is null
     or v_order.session_token <> p_token then
    raise exception 'forbidden_order' using errcode = '42501';
  end if;
  if v_order.status <> 'reserved' then
    raise exception 'order_not_reservable' using errcode = 'P0001';
  end if;
  if v_order.expires_at is not null and v_order.expires_at < pg_catalog.now() then
    raise exception 'order_expired' using errcode = 'P0001';
  end if;
  if v_order.currency <> 'SEK'
     or exists (
       select 1 from public.shop_order_items i
       where i.order_id = p_order_id and i.currency <> 'SEK'
     ) then
    raise exception 'shop_currency_must_be_sek' using errcode = '22023';
  end if;

  if v_uid is null then
    if p_customer is not null then
      raise exception 'forbidden_customer' using errcode = '42501';
    end if;
  elsif p_customer is not null and p_customer <> v_uid then
    raise exception 'forbidden_customer' using errcode = '42501';
  end if;

  if p_shipping_option is not null then
    select so.id, so.cost_cents into v_ship_id, v_ship
    from public.shop_shipping_options so
    where so.id = p_shipping_option
      and so.tenant_id = v_order.tenant_id
      and so.active = true;
    if v_ship_id is null then
      raise exception 'invalid_shipping_option' using errcode = 'P0002';
    end if;
  elsif exists (
    select 1 from public.shop_shipping_options so
    where so.tenant_id = v_order.tenant_id and so.active = true
  ) then
    raise exception 'shipping_option_required' using errcode = 'P0002';
  end if;

  if p_payment_method is not null
     and p_payment_method not in ('card', 'swish', 'klarna', 'paypal', 'applepay') then
    raise exception 'bad_payment_method' using errcode = '22023';
  end if;
  if p_payment_method is not null and not exists (
    select 1
    from public.tenant_modules tm
    where tm.tenant_id = v_order.tenant_id
      and tm.module_key = 'shop'
      and tm.state = 'live'
      and coalesce(tm.config->'payment_methods', '[]'::jsonb)
          @> pg_catalog.jsonb_build_array(p_payment_method)
  ) then
    raise exception 'payment_method_not_configured' using errcode = '22023';
  end if;

  if p_customer is not null then
    select u.email, u.phone into v_email, v_phone
    from public.users u where u.id = p_customer;
    v_cust := private.resolve_customer_id(
      v_order.tenant_id,
      p_customer,
      nullif(pg_catalog.btrim(p_guest_name), ''),
      v_email,
      v_phone
    );
  else
    v_cust := private.resolve_customer_id(
      v_order.tenant_id,
      null,
      p_guest_name,
      p_guest_email,
      p_guest_phone
    );
  end if;

  v_req := p_payment_method is not null;
  v_no := coalesce(
    v_order.order_no,
    private.next_shop_order_no(v_order.tenant_id)
  );
  v_total := greatest(
    0,
    coalesce(v_order.subtotal_cents, 0)
      + v_ship
      - coalesce(v_order.discount_cents, 0)
      + coalesce(v_order.tax_cents, 0)
  );

  update public.shop_orders o
  set customer_id = v_cust,
      customer_name = nullif(pg_catalog.btrim(coalesce(p_guest_name, o.customer_name)), ''),
      customer_email = nullif(pg_catalog.btrim(coalesce(p_guest_email, o.customer_email)), ''),
      customer_phone = nullif(pg_catalog.btrim(coalesce(p_guest_phone, o.customer_phone)), ''),
      ship_address = coalesce(p_ship_address, o.ship_address),
      pickup_location_id = coalesce(p_pickup_location, o.pickup_location_id),
      note = coalesce(p_note, o.note),
      shipping_option_id = coalesce(v_ship_id, o.shipping_option_id),
      shipping_cents = v_ship,
      payment_method = coalesce(p_payment_method, o.payment_method),
      order_no = v_no,
      total_cents = v_total,
      currency = 'SEK'
  where o.id = p_order_id;

  if v_req then
    update public.shop_orders o
    set status = 'awaiting_payment',
        expires_at = pg_catalog.now() + interval '30 minutes'
    where o.id = p_order_id;
  else
    perform public._commit_shop_order_stock(p_order_id);
    update public.shop_orders o set status = 'pending' where o.id = p_order_id;
  end if;

  return query select p_order_id, v_req;
end;
$$;

revoke all on function private.confirm_shop_order_goal87_impl(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, text
) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- One frozen payment snapshot consumed by both provider adapters.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_shop_order_payment(
  p_order uuid,
  p_tenant uuid,
  p_provider text,
  p_account_scope text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.shop_orders%rowtype;
  v_payment public.payments%rowtype;
  v_subtotal bigint;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_provider not in ('stripe', 'paypal')
     or p_account_scope is null
     or pg_catalog.btrim(p_account_scope) = ''
     or pg_catalog.length(p_account_scope) > 220 then
    raise exception 'payment_provider_invalid' using errcode = '22023';
  end if;
  if p_provider = 'stripe' and p_account_scope !~ '^acct_[A-Za-z0-9_]{1,196}$' then
    raise exception 'payment_account_scope_invalid' using errcode = '22023';
  end if;
  if p_provider = 'paypal' and p_account_scope <> 'paypal:platform' then
    raise exception 'payment_account_scope_invalid' using errcode = '22023';
  end if;

  select o.* into v_order
  from public.shop_orders o
  where o.id = p_order and o.tenant_id = p_tenant
  for update;
  if not found then
    raise exception 'shop_order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'awaiting_payment'
     or v_order.payment_status <> 'unpaid'
     or v_order.total_cents <= 0 then
    raise exception 'shop_order_not_payable' using errcode = '55000';
  end if;
  if (p_provider = 'paypal' and v_order.payment_method <> 'paypal')
     or (p_provider = 'stripe'
         and v_order.payment_method not in ('card', 'swish', 'klarna', 'applepay')) then
    raise exception 'shop_payment_provider_mismatch' using errcode = '55000';
  end if;
  if p_provider = 'stripe' and not exists (
    select 1 from public.tenants t
    where t.id = p_tenant and t.stripe_account_id = p_account_scope
  ) then
    raise exception 'shop_payment_account_mismatch' using errcode = '55000';
  end if;

  perform 1
  from public.shop_order_items i
  where i.order_id = p_order
  order by i.id
  for share;

  select coalesce(sum(i.unit_price_cents::bigint * i.quantity::bigint), 0)
  into v_subtotal
  from public.shop_order_items i
  where i.order_id = p_order;

  if v_order.currency <> 'SEK'
     or exists (
       select 1 from public.shop_order_items i
       where i.order_id = p_order and i.currency <> 'SEK'
     )
     or v_subtotal <> v_order.subtotal_cents::bigint
     or v_order.total_cents <> greatest(
       0,
       v_order.subtotal_cents
         + v_order.shipping_cents
         - v_order.discount_cents
         + v_order.tax_cents
     ) then
    raise exception 'shop_payment_snapshot_invalid' using errcode = '23514';
  end if;

  select p.* into v_payment
  from public.payments p
  where p.order_id = p_order
  for update;

  if not found then
    insert into public.payments (
      tenant_id,
      order_id,
      amount_cents,
      currency,
      status,
      provider,
      provider_account_scope
    ) values (
      p_tenant,
      p_order,
      v_order.total_cents,
      'SEK',
      'pending',
      p_provider,
      p_account_scope
    )
    returning * into v_payment;
  else
    if v_payment.tenant_id <> p_tenant
       or v_payment.amount_cents <> v_order.total_cents
       or v_payment.currency <> 'SEK'
       or v_payment.provider is distinct from p_provider
       or v_payment.provider_account_scope is distinct from p_account_scope then
      raise exception 'shop_payment_snapshot_conflict' using errcode = '55000';
    end if;
    if v_payment.status in ('succeeded', 'refunded') then
      raise exception 'shop_payment_terminal' using errcode = '55000';
    end if;
    if v_payment.status = 'failed' then
      update public.payments p
      set status = 'pending'
      where p.id = v_payment.id
      returning * into v_payment;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'subtotal_cents', v_order.subtotal_cents,
    'shipping_cents', v_order.shipping_cents,
    'discount_cents', v_order.discount_cents,
    'tax_cents', v_order.tax_cents,
    'total_cents', v_order.total_cents,
    'currency', 'SEK',
    'payment_method', v_order.payment_method,
    'provider', p_provider,
    'provider_account_scope', p_account_scope,
    'provider_order_id', v_payment.provider_order_id
  );
end;
$$;

revoke all on function public.prepare_shop_order_payment(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.prepare_shop_order_payment(
  uuid, uuid, text, text
) to service_role;

create or replace function public.record_shop_payment_order_reference(
  p_payment uuid,
  p_provider text,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_reference is null
     or pg_catalog.btrim(p_reference) = ''
     or pg_catalog.length(p_reference) > 255 then
    raise exception 'provider_order_reference_invalid' using errcode = '22023';
  end if;

  select p.* into v_payment
  from public.payments p
  where p.id = p_payment
  for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;
  if v_payment.provider is distinct from p_provider
     or v_payment.provider_order_id is not null
        and v_payment.provider_order_id is distinct from p_reference then
    raise exception 'provider_order_reference_conflict' using errcode = '55000';
  end if;

  update public.payments p
  set provider_order_id = p_reference,
      stripe_checkout_session_id = case
        when p_provider = 'stripe' then p_reference
        else p.stripe_checkout_session_id
      end
  where p.id = p_payment;

  return pg_catalog.jsonb_build_object(
    'payment_id', p_payment,
    'provider_order_id', p_reference
  );
end;
$$;

revoke all on function public.record_shop_payment_order_reference(
  uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_shop_payment_order_reference(
  uuid, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Durable provider event inbox. Provider signatures remain in the transport
-- handlers; this table stores only normalized replay identity, never PII.
-- ---------------------------------------------------------------------------
create table if not exists private.shop_payment_events (
  id                    uuid primary key default extensions.gen_random_uuid(),
  provider              text not null check (provider in ('stripe', 'paypal')),
  account_scope         text not null,
  provider_event_id     text not null,
  event_type            text not null check (
    event_type in (
      'payment_succeeded',
      'payment_failed',
      'checkout_expired',
      'refund_succeeded'
    )
  ),
  tenant_id             uuid references public.tenants(id) on delete set null,
  order_id              uuid references public.shop_orders(id) on delete set null,
  order_reference       text not null,
  provider_reference_id text,
  amount_cents          integer,
  currency              text,
  normalized_payload    jsonb not null default '{}'::jsonb,
  status                text not null default 'pending' check (
    status in ('pending', 'processing', 'retryable', 'review_required', 'processed')
  ),
  attempt_count         integer not null default 0 check (attempt_count >= 0),
  last_outcome          text,
  error_code            text,
  processed_at          timestamptz,
  created_at            timestamptz not null default pg_catalog.now(),
  updated_at            timestamptz not null default pg_catalog.now(),
  unique (provider, account_scope, provider_event_id)
);

create index if not exists shop_payment_events_retry_idx
  on private.shop_payment_events (status, updated_at)
  where status in ('pending', 'retryable');
create index if not exists shop_payment_events_order_idx
  on private.shop_payment_events (order_id, created_at);

alter table private.shop_payment_events enable row level security;
revoke all on table private.shop_payment_events
  from public, anon, authenticated, service_role;
grant select, insert, update on table private.shop_payment_events to service_role;

create or replace function public.register_shop_payment_event(
  p_provider text,
  p_account_scope text,
  p_provider_event_id text,
  p_event_type text,
  p_tenant uuid,
  p_order uuid,
  p_provider_reference_id text,
  p_amount_cents integer,
  p_currency text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_tenant uuid;
  v_payment_tenant uuid;
  v_resolved_order uuid := p_order;
  v_order_reference text;
  v_tenant uuid;
  v_event private.shop_payment_events%rowtype;
  v_payload jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_provider not in ('stripe', 'paypal')
     or p_event_type not in (
       'payment_succeeded',
       'payment_failed',
       'checkout_expired',
       'refund_succeeded'
     )
     or p_account_scope is null
     or pg_catalog.btrim(p_account_scope) = ''
     or pg_catalog.length(p_account_scope) > 220
     or p_provider_event_id is null
     or pg_catalog.btrim(p_provider_event_id) = ''
     or pg_catalog.length(p_provider_event_id) > 255 then
    raise exception 'shop_payment_event_invalid' using errcode = '22023';
  end if;
  if p_provider = 'stripe' and p_account_scope !~ '^acct_[A-Za-z0-9_]{1,196}$' then
    raise exception 'payment_account_scope_invalid' using errcode = '22023';
  end if;
  if p_provider = 'paypal' and p_account_scope <> 'paypal:platform' then
    raise exception 'payment_account_scope_invalid' using errcode = '22023';
  end if;
  if p_provider_reference_id is not null
     and (
       pg_catalog.btrim(p_provider_reference_id) = ''
       or pg_catalog.length(p_provider_reference_id) > 255
     ) then
    raise exception 'provider_reference_invalid' using errcode = '22023';
  end if;
  if p_amount_cents is not null and p_amount_cents < 0 then
    raise exception 'provider_amount_invalid' using errcode = '22023';
  end if;

  if v_resolved_order is null and p_provider_reference_id is not null then
    select p.order_id, p.tenant_id
      into v_resolved_order, v_payment_tenant
      from public.payments p
     where p.provider = p_provider
       and p.provider_account_scope = p_account_scope
       and p.provider_payment_id = p_provider_reference_id
       and p.order_id is not null;
  end if;

  select o.tenant_id into v_order_tenant
  from public.shop_orders o
  where o.id = v_resolved_order;
  if v_order_tenant is not null
     and p_tenant is not null
     and v_order_tenant <> p_tenant then
    raise exception 'shop_order_tenant_mismatch' using errcode = '42501';
  end if;
  if v_payment_tenant is not null
     and p_tenant is not null
     and v_payment_tenant <> p_tenant then
    raise exception 'shop_order_tenant_mismatch' using errcode = '42501';
  end if;
  v_tenant := coalesce(v_order_tenant, v_payment_tenant, p_tenant);
  v_order_reference := case
    when p_order is not null then p_order::text
    else 'provider:' || coalesce(p_provider_reference_id, p_provider_event_id)
  end;

  -- Only one allowlisted transport marker survives. Contact/card/provider body
  -- fields can never enter the replay store.
  v_payload := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'source', case
      when p_payload->>'source' in ('webhook', 'return') then p_payload->>'source'
      else null
    end
  ));

  insert into private.shop_payment_events (
    provider,
    account_scope,
    provider_event_id,
    event_type,
    tenant_id,
    order_id,
    order_reference,
    provider_reference_id,
    amount_cents,
    currency,
    normalized_payload
  ) values (
    p_provider,
    p_account_scope,
    p_provider_event_id,
    p_event_type,
    v_tenant,
    case when v_order_tenant is null then null else v_resolved_order end,
    v_order_reference,
    p_provider_reference_id,
    p_amount_cents,
    nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_currency, ''))), ''),
    v_payload
  )
  on conflict (provider, account_scope, provider_event_id) do nothing;

  select e.* into v_event
  from private.shop_payment_events e
  where e.provider = p_provider
    and e.account_scope = p_account_scope
    and e.provider_event_id = p_provider_event_id
  for update;

  if v_event.event_type is distinct from p_event_type
     or v_event.order_reference is distinct from v_order_reference
     or v_event.tenant_id is distinct from v_tenant
     or v_event.provider_reference_id is distinct from p_provider_reference_id
     or v_event.amount_cents is distinct from p_amount_cents
     or v_event.currency is distinct from
        nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_currency, ''))), '') then
    raise exception 'shop_payment_event_identity_conflict' using errcode = '55000';
  end if;

  return pg_catalog.jsonb_build_object(
    'event_id', v_event.id,
    'status', v_event.status,
    'outcome', v_event.last_outcome,
    'duplicate', v_event.created_at < pg_catalog.statement_timestamp()
  );
end;
$$;

revoke all on function public.register_shop_payment_event(
  text, text, text, text, uuid, uuid, text, integer, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.register_shop_payment_event(
  text, text, text, text, uuid, uuid, text, integer, text, jsonb
) to service_role;

create or replace function public.settle_shop_payment_event(
  p_event uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event private.shop_payment_events%rowtype;
  v_order public.shop_orders%rowtype;
  v_payment public.payments%rowtype;
  v_changed boolean := false;
  v_reference_matches boolean;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select e.* into v_event
  from private.shop_payment_events e
  where e.id = p_event
  for update;
  if not found then
    raise exception 'shop_payment_event_not_found' using errcode = 'P0002';
  end if;

  if v_event.status = 'processed' then
    return pg_catalog.jsonb_build_object(
      'outcome', coalesce(v_event.last_outcome, 'already_processed'),
      'event_id', v_event.id,
      'tenant_id', v_event.tenant_id,
      'order_id', v_event.order_id
    );
  end if;
  if v_event.status = 'review_required' then
    return pg_catalog.jsonb_build_object(
      'outcome', coalesce(v_event.last_outcome, 'review_required'),
      'event_id', v_event.id,
      'tenant_id', v_event.tenant_id,
      'order_id', v_event.order_id
    );
  end if;

  update private.shop_payment_events e
  set status = 'processing',
      attempt_count = e.attempt_count + 1,
      error_code = null,
      updated_at = pg_catalog.now()
  where e.id = p_event
  returning * into v_event;

  if v_event.order_id is null then
    update private.shop_payment_events e
    set status = 'review_required',
        last_outcome = 'unknown_order',
        error_code = 'unknown_order',
        updated_at = pg_catalog.now()
    where e.id = p_event;
    return pg_catalog.jsonb_build_object(
      'outcome', 'unknown_order',
      'event_id', p_event
    );
  end if;

  select o.* into v_order
  from public.shop_orders o
  where o.id = v_event.order_id
    and o.tenant_id = v_event.tenant_id
  for update;
  if not found then
    update private.shop_payment_events e
    set status = 'review_required',
        last_outcome = 'unknown_order',
        error_code = 'unknown_order',
        updated_at = pg_catalog.now()
    where e.id = p_event;
    return pg_catalog.jsonb_build_object(
      'outcome', 'unknown_order',
      'event_id', p_event
    );
  end if;

  select p.* into v_payment
  from public.payments p
  where p.order_id = v_order.id
    and p.tenant_id = v_order.tenant_id
  for update;
  if not found then
    update private.shop_payment_events e
    set status = 'retryable',
        last_outcome = 'payment_missing',
        error_code = 'payment_missing',
        updated_at = pg_catalog.now()
    where e.id = p_event;
    return pg_catalog.jsonb_build_object(
      'outcome', 'payment_missing',
      'event_id', p_event,
      'tenant_id', v_order.tenant_id,
      'order_id', v_order.id
    );
  end if;

  if v_payment.provider is distinct from v_event.provider
     or v_payment.provider_account_scope is distinct from v_event.account_scope then
    update private.shop_payment_events e
    set status = 'review_required',
        last_outcome = 'provider_identity_mismatch',
        error_code = 'provider_identity_mismatch',
        updated_at = pg_catalog.now()
    where e.id = p_event;
    return pg_catalog.jsonb_build_object(
      'outcome', 'provider_identity_mismatch',
      'event_id', p_event,
      'tenant_id', v_order.tenant_id,
      'order_id', v_order.id
    );
  end if;

  if v_event.event_type = 'checkout_expired' then
    v_reference_matches :=
      v_payment.provider_order_id is not distinct from v_event.provider_reference_id;
  else
    v_reference_matches :=
      v_payment.provider_payment_id is null
      or v_payment.provider_payment_id is not distinct from v_event.provider_reference_id;
  end if;
  if not v_reference_matches then
    update private.shop_payment_events e
    set status = 'review_required',
        last_outcome = 'provider_identity_mismatch',
        error_code = 'provider_identity_mismatch',
        updated_at = pg_catalog.now()
    where e.id = p_event;
    return pg_catalog.jsonb_build_object(
      'outcome', 'provider_identity_mismatch',
      'event_id', p_event,
      'tenant_id', v_order.tenant_id,
      'order_id', v_order.id
    );
  end if;

  if v_event.event_type in ('payment_succeeded', 'refund_succeeded')
     and (
       v_event.amount_cents is null
       or v_event.amount_cents <> v_payment.amount_cents
       or v_event.currency is distinct from v_payment.currency
       or v_event.currency <> 'SEK'
     ) then
    update private.shop_payment_events e
    set status = 'review_required',
        last_outcome = 'amount_mismatch',
        error_code = 'amount_mismatch',
        updated_at = pg_catalog.now()
    where e.id = p_event;
    return pg_catalog.jsonb_build_object(
      'outcome', 'amount_mismatch',
      'event_id', p_event,
      'tenant_id', v_order.tenant_id,
      'order_id', v_order.id
    );
  end if;

  if v_event.event_type = 'payment_succeeded' then
    if v_payment.status = 'refunded' or v_order.payment_status = 'refunded' then
      update private.shop_payment_events e
      set status = 'processed',
          last_outcome = 'refunded',
          processed_at = coalesce(e.processed_at, pg_catalog.now()),
          updated_at = pg_catalog.now()
      where e.id = p_event;
      return pg_catalog.jsonb_build_object(
        'outcome', 'refunded',
        'event_id', p_event,
        'tenant_id', v_order.tenant_id,
        'order_id', v_order.id
      );
    end if;
    if v_order.status in ('cancelled', 'expired') then
      update private.shop_payment_events e
      set status = 'review_required',
          last_outcome = 'terminal_order',
          error_code = 'terminal_order',
          updated_at = pg_catalog.now()
      where e.id = p_event;
      return pg_catalog.jsonb_build_object(
        'outcome', 'terminal_order',
        'event_id', p_event,
        'tenant_id', v_order.tenant_id,
        'order_id', v_order.id
      );
    end if;

    v_changed := v_payment.status <> 'succeeded'
      or v_order.payment_status <> 'paid'
      or v_order.stock_committed = false;

    update public.payments p
    set status = 'succeeded',
        provider_payment_id = coalesce(
          p.provider_payment_id,
          v_event.provider_reference_id
        ),
        stripe_payment_intent_id = case
          when v_event.provider = 'stripe'
            then coalesce(p.stripe_payment_intent_id, v_event.provider_reference_id)
          else p.stripe_payment_intent_id
        end,
        stripe_connected_account_id = case
          when v_event.provider = 'stripe'
            then coalesce(p.stripe_connected_account_id, v_event.account_scope)
          else p.stripe_connected_account_id
        end
    where p.id = v_payment.id;

    perform public._commit_shop_order_stock(v_order.id);
    update public.shop_orders o
    set status = case
          when o.status in ('reserved', 'awaiting_payment') then 'pending'
          else o.status
        end,
        payment_status = 'paid',
        expires_at = null
    where o.id = v_order.id;

    if v_changed then
      insert into public.audit_log (
        tenant_id,
        action,
        entity,
        entity_id,
        meta
      ) values (
        v_order.tenant_id,
        'shop.payment.succeeded',
        'shop_order',
        v_order.id,
        pg_catalog.jsonb_build_object(
          'event_id', v_event.id,
          'payment_id', v_payment.id,
          'provider', v_event.provider
        )
      );
    end if;

    update private.shop_payment_events e
    set status = 'processed',
        last_outcome = case when v_changed then 'succeeded' else 'already_succeeded' end,
        processed_at = coalesce(e.processed_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where e.id = p_event;

    return pg_catalog.jsonb_build_object(
      'outcome', case when v_changed then 'succeeded' else 'already_succeeded' end,
      'event_id', p_event,
      'tenant_id', v_order.tenant_id,
      'order_id', v_order.id
    );
  end if;

  if v_event.event_type = 'payment_failed' then
    if v_payment.status not in ('succeeded', 'refunded') then
      v_changed := v_payment.status <> 'failed';
      update public.payments p
      set status = 'failed',
          provider_payment_id = coalesce(
            p.provider_payment_id,
            v_event.provider_reference_id
          ),
          stripe_payment_intent_id = case
            when v_event.provider = 'stripe'
              then coalesce(p.stripe_payment_intent_id, v_event.provider_reference_id)
            else p.stripe_payment_intent_id
          end
      where p.id = v_payment.id;
    end if;

    if v_changed then
      insert into public.audit_log (
        tenant_id, action, entity, entity_id, meta
      ) values (
        v_order.tenant_id,
        'shop.payment.failed',
        'shop_order',
        v_order.id,
        pg_catalog.jsonb_build_object(
          'event_id', v_event.id,
          'payment_id', v_payment.id,
          'provider', v_event.provider
        )
      );
    end if;
  elsif v_event.event_type = 'checkout_expired' then
    if v_order.status in ('reserved', 'awaiting_payment') then
      perform public.release_shop_order(v_order.id, null, 'expired');
      v_changed := true;
    end if;
    if v_payment.status not in ('succeeded', 'refunded') then
      update public.payments p set status = 'failed' where p.id = v_payment.id;
    end if;
    if v_changed then
      insert into public.audit_log (
        tenant_id, action, entity, entity_id, meta
      ) values (
        v_order.tenant_id,
        'shop.checkout.expired',
        'shop_order',
        v_order.id,
        pg_catalog.jsonb_build_object(
          'event_id', v_event.id,
          'payment_id', v_payment.id,
          'provider', v_event.provider
        )
      );
    end if;
  elsif v_event.event_type = 'refund_succeeded' then
    v_changed := v_payment.status <> 'refunded'
      or v_order.payment_status <> 'refunded';
    update public.payments p set status = 'refunded' where p.id = v_payment.id;
    -- A refund is money state only. Workflow status and inventory stay intact.
    update public.shop_orders o
    set payment_status = 'refunded'
    where o.id = v_order.id;
    if v_changed then
      insert into public.audit_log (
        tenant_id, action, entity, entity_id, meta
      ) values (
        v_order.tenant_id,
        'shop.payment.refunded',
        'shop_order',
        v_order.id,
        pg_catalog.jsonb_build_object(
          'event_id', v_event.id,
          'payment_id', v_payment.id,
          'provider', v_event.provider
        )
      );
    end if;
  end if;

  update private.shop_payment_events e
  set status = 'processed',
      last_outcome = case
        when v_event.event_type = 'payment_failed' then 'failed'
        when v_event.event_type = 'checkout_expired' then 'expired'
        when v_event.event_type = 'refund_succeeded' then 'refunded'
      end,
      processed_at = coalesce(e.processed_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where e.id = p_event;

  return pg_catalog.jsonb_build_object(
    'outcome', case
      when v_event.event_type = 'payment_failed' then 'failed'
      when v_event.event_type = 'checkout_expired' then 'expired'
      when v_event.event_type = 'refund_succeeded' then 'refunded'
    end,
    'event_id', p_event,
    'tenant_id', v_order.tenant_id,
    'order_id', v_order.id
  );
end;
$$;

revoke all on function public.settle_shop_payment_event(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.settle_shop_payment_event(uuid) to service_role;

-- Finalize an external compensation after the provider has already refunded a
-- rejected capture. Payment + order + inbox close atomically; inventory is not
-- restored.
create or replace function public.complete_shop_payment_event(
  p_event uuid,
  p_outcome text,
  p_error_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event private.shop_payment_events%rowtype;
  v_order public.shop_orders%rowtype;
  v_payment public.payments%rowtype;
  v_changed boolean := false;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_outcome not in ('refunded', 'retryable', 'ignored') then
    raise exception 'shop_payment_event_outcome_invalid' using errcode = '22023';
  end if;

  select e.* into v_event
  from private.shop_payment_events e
  where e.id = p_event
  for update;
  if not found then
    raise exception 'shop_payment_event_not_found' using errcode = 'P0002';
  end if;
  if v_event.status = 'processed' then
    return pg_catalog.jsonb_build_object(
      'outcome', coalesce(v_event.last_outcome, 'already_processed'),
      'event_id', v_event.id
    );
  end if;

  if p_outcome = 'retryable' then
    update private.shop_payment_events e
    set status = 'retryable',
        attempt_count = e.attempt_count + 1,
        last_outcome = 'retryable',
        error_code = nullif(pg_catalog.left(coalesce(p_error_code, ''), 120), ''),
        updated_at = pg_catalog.now()
    where e.id = p_event;
    return pg_catalog.jsonb_build_object('outcome', 'retryable', 'event_id', p_event);
  end if;

  if p_outcome = 'refunded' and v_event.order_id is not null then
    select o.* into v_order
    from public.shop_orders o
    where o.id = v_event.order_id and o.tenant_id = v_event.tenant_id
    for update;
    if found then
      select p.* into v_payment
      from public.payments p
      where p.order_id = v_order.id and p.tenant_id = v_order.tenant_id
      for update;
      if found
         and v_payment.provider is not distinct from v_event.provider
         and v_payment.provider_account_scope is not distinct from v_event.account_scope
         and (
           v_payment.provider_payment_id is null
           or v_payment.provider_payment_id is not distinct from v_event.provider_reference_id
         ) then
        v_changed := v_payment.status <> 'refunded'
          or v_order.payment_status <> 'refunded';
        update public.payments p
        set status = 'refunded',
            provider_payment_id = coalesce(
              p.provider_payment_id,
              v_event.provider_reference_id
            )
        where p.id = v_payment.id;
        update public.shop_orders o
        set payment_status = 'refunded'
        where o.id = v_order.id;
        if v_changed then
          insert into public.audit_log (
            tenant_id, action, entity, entity_id, meta
          ) values (
            v_order.tenant_id,
            'shop.payment.refunded',
            'shop_order',
            v_order.id,
            pg_catalog.jsonb_build_object(
              'event_id', v_event.id,
              'payment_id', v_payment.id,
              'provider', v_event.provider,
              'compensating', true
            )
          );
        end if;
      end if;
    end if;
  end if;

  update private.shop_payment_events e
  set status = 'processed',
      last_outcome = p_outcome,
      error_code = nullif(pg_catalog.left(coalesce(p_error_code, ''), 120), ''),
      processed_at = coalesce(e.processed_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where e.id = p_event;

  return pg_catalog.jsonb_build_object(
    'outcome', p_outcome,
    'event_id', p_event,
    'tenant_id', v_event.tenant_id,
    'order_id', v_event.order_id
  );
end;
$$;

revoke all on function public.complete_shop_payment_event(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_shop_payment_event(uuid, text, text)
  to service_role;
