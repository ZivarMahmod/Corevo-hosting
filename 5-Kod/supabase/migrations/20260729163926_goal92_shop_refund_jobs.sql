-- Goal 92 Task 3: reuse the booking refund outbox for full webshop refunds.
-- Provider identity remains owned by public.payments. Legacy Stripe snapshots
-- stay on booking jobs only so the existing booking contract is unchanged.

alter table private.payment_refund_jobs
  add column if not exists order_id uuid;

alter table private.payment_refund_jobs
  alter column booking_id drop not null,
  alter column provider drop not null,
  alter column provider drop default,
  alter column provider_payment_intent_id drop not null,
  alter column provider_connected_account_id drop not null;

alter table private.payment_refund_jobs
  drop constraint if exists payment_refund_jobs_provider_check;

alter table private.payment_refund_jobs
  add constraint payment_refund_jobs_provider_check
  check (provider is null or provider in ('stripe', 'paypal'));

create unique index if not exists payments_tenant_id_id_order_id_key
  on public.payments (tenant_id, id, order_id);
create unique index if not exists shop_orders_tenant_id_id_key
  on public.shop_orders (tenant_id, id);
create unique index if not exists payment_refund_jobs_order_id_key
  on private.payment_refund_jobs (order_id)
  where order_id is not null;

do $constraints$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'private.payment_refund_jobs'::regclass
       and c.conname = 'payment_refund_jobs_one_source'
  ) then
    alter table private.payment_refund_jobs
      add constraint payment_refund_jobs_one_source
      check (
        (booking_id is not null and order_id is null)
        or (booking_id is null and order_id is not null)
      );
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'private.payment_refund_jobs'::regclass
       and c.conname = 'payment_refund_jobs_source_payload'
  ) then
    alter table private.payment_refund_jobs
      add constraint payment_refund_jobs_source_payload
      check (
        (
          booking_id is not null
          and provider is not null
          and provider = 'stripe'
          and provider_payment_intent_id is not null
          and provider_connected_account_id is not null
        )
        or (
          order_id is not null
          and provider is null
          and provider_payment_intent_id is null
          and provider_connected_account_id is null
        )
      );
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'private.payment_refund_jobs'::regclass
       and c.conname = 'payment_refund_jobs_order_payment_fk'
  ) then
    alter table private.payment_refund_jobs
      add constraint payment_refund_jobs_order_payment_fk
      foreign key (tenant_id, payment_id, order_id)
      references public.payments (tenant_id, id, order_id)
      on delete cascade;
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint c
     where c.conrelid = 'private.payment_refund_jobs'::regclass
       and c.conname = 'payment_refund_jobs_order_fk'
  ) then
    alter table private.payment_refund_jobs
      add constraint payment_refund_jobs_order_fk
      foreign key (tenant_id, order_id)
      references public.shop_orders (tenant_id, id)
      on delete cascade;
  end if;
end
$constraints$;

-- Uses row JSON deliberately: Goal 92's coordinated payment migration owns
-- provider/provider_account_scope/provider_payment_id and may run before or
-- after this additive migration. Missing keys safely fall back to the legacy
-- Stripe columns; no provider-neutral column is duplicated here.
create or replace function private.payment_refund_identity(
  p_payment public.payments
) returns table (
  provider text,
  provider_payment_id text,
  provider_account_scope text
)
language sql
stable
set search_path = ''
as $$
  with source as (
    select
      nullif(pg_catalog.to_jsonb(p_payment) ->> 'provider', '') as provider,
      nullif(pg_catalog.to_jsonb(p_payment) ->> 'provider_payment_id', '')
        as provider_payment_id,
      nullif(pg_catalog.to_jsonb(p_payment) ->> 'provider_account_scope', '')
        as provider_account_scope
  )
  select
    coalesce(
      source.provider,
      case
        when nullif(p_payment.stripe_payment_intent_id, '') is not null
          then 'stripe'
      end
    ),
    case
      when source.provider is not null then source.provider_payment_id
      else nullif(p_payment.stripe_payment_intent_id, '')
    end,
    case
      when source.provider is not null then source.provider_account_scope
      else nullif(p_payment.stripe_connected_account_id, '')
    end
  from source
$$;
revoke all on function private.payment_refund_identity(public.payments)
  from public, anon, authenticated, service_role;

-- The removed provider default must not alter booking inserts. Keep the
-- booking-only function and its return/error contract, now explicit about its
-- legacy Stripe snapshot.
create or replace function private.enqueue_booking_payment_refund(
  p_tenant uuid,
  p_booking uuid,
  p_payment uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_payment public.payments%rowtype;
begin
  select p.* into v_payment
  from public.payments p
  where p.id = p_payment
    and p.tenant_id = p_tenant
    and p.booking_id = p_booking
  for update;
  if not found or v_payment.status <> 'succeeded'
     or nullif(v_payment.stripe_payment_intent_id, '') is null
     or nullif(v_payment.stripe_connected_account_id, '') is null then
    raise exception 'refundable_payment_required' using errcode = '55000';
  end if;

  insert into private.payment_refund_jobs (
    tenant_id, payment_id, booking_id, provider,
    provider_payment_intent_id, provider_connected_account_id,
    provider_idempotency_key
  ) values (
    p_tenant, p_payment, p_booking, 'stripe',
    v_payment.stripe_payment_intent_id,
    v_payment.stripe_connected_account_id,
    'refund_' || p_booking::text
  )
  on conflict (payment_id) do nothing
  returning id into v_job_id;

  if v_job_id is null then
    select j.id into v_job_id
    from private.payment_refund_jobs j
    where j.payment_id = p_payment
      and j.tenant_id = p_tenant
      and j.booking_id = p_booking
      and j.order_id is null
      and j.provider = 'stripe'
      and j.provider_payment_intent_id = v_payment.stripe_payment_intent_id
      and j.provider_connected_account_id = v_payment.stripe_connected_account_id
      and j.provider_idempotency_key = 'refund_' || p_booking::text;
  end if;
  if v_job_id is null then
    raise exception 'refund_job_invariant_failed' using errcode = '55000';
  end if;
  return v_job_id;
end;
$$;
revoke all on function private.enqueue_booking_payment_refund(uuid,uuid,uuid)
  from public, anon, authenticated, service_role;

create or replace function public.enqueue_shop_order_refund(
  p_tenant uuid,
  p_order uuid
) returns table (
  outcome text,
  job_id uuid,
  refund_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.shop_orders%rowtype;
  v_job private.payment_refund_jobs%rowtype;
  v_provider text;
  v_provider_payment_id text;
  v_provider_account_scope text;
begin
  if coalesce((select auth.role()), '') <> 'service_role'
     and not coalesce((select private.is_platform_admin()), false)
     and (
       (select private.tenant_id()) is distinct from p_tenant
       or coalesce((select private.role_level()), 0) < 6
     ) then
    raise exception 'shop_refund_admin_required' using errcode = '42501';
  end if;

  -- Match the payment-event rail's global order: order, payment, refund job.
  select o.* into v_order
    from public.shop_orders o
   where o.tenant_id = p_tenant
     and o.id = p_order
   for update;
  if not found then
    raise exception 'refundable_order_required' using errcode = '55000';
  end if;

  select p.* into v_payment
    from public.payments p
   where p.tenant_id = p_tenant
     and p.order_id = p_order
   for update;
  if not found then
    raise exception 'refundable_payment_required' using errcode = '55000';
  end if;

  select j.* into v_job
    from private.payment_refund_jobs j
   where j.payment_id = v_payment.id
   for update;
  if found then
    if v_job.tenant_id is distinct from p_tenant
       or v_job.order_id is distinct from p_order
       or v_job.booking_id is not null then
      raise exception 'refund_job_invariant_failed' using errcode = '55000';
    end if;
    return query
    select
      'existing'::text,
      v_job.id,
      case
        when v_job.status = 'completed' then 'succeeded'
        when v_job.status = 'review_required' then 'failed'
        else 'pending'
      end::text;
    return;
  end if;

  if v_payment.status <> 'succeeded' or v_order.payment_status <> 'paid' then
    raise exception 'refundable_payment_required' using errcode = '55000';
  end if;

  select i.provider, i.provider_payment_id, i.provider_account_scope
    into v_provider, v_provider_payment_id, v_provider_account_scope
    from private.payment_refund_identity(v_payment) i;

  if v_provider = 'stripe' then
    if v_provider_payment_id is null
       or v_provider_payment_id !~ '^pi_[A-Za-z0-9_]{1,196}$'
       or v_provider_account_scope is null
       or v_provider_account_scope !~ '^acct_[A-Za-z0-9_]{1,196}$' then
      raise exception 'refundable_payment_identity_required' using errcode = '55000';
    end if;
  elsif v_provider = 'paypal' then
    if v_provider_payment_id is null
       or v_provider_payment_id !~ '^[A-Za-z0-9._:-]{1,200}$'
       or v_provider_account_scope is null
       or v_provider_account_scope !~ '^[A-Za-z0-9._:-]{1,200}$' then
      raise exception 'refundable_payment_identity_required' using errcode = '55000';
    end if;
  else
    raise exception 'refundable_payment_provider_required' using errcode = '55000';
  end if;

  insert into private.payment_refund_jobs (
    tenant_id,
    payment_id,
    order_id,
    provider_idempotency_key
  ) values (
    p_tenant,
    v_payment.id,
    p_order,
    'refund_' || p_order::text
  )
  returning * into v_job;

  return query select 'queued'::text, v_job.id, 'pending'::text;
end;
$$;

create or replace function public.shop_order_refund_statuses(
  p_tenant uuid
) returns table (
  order_id uuid,
  refund_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role'
     and not coalesce((select private.is_platform_admin()), false)
     and (
       (select private.tenant_id()) is distinct from p_tenant
       or coalesce((select private.role_level()), 0) < 6
     ) then
    raise exception 'shop_refund_admin_required' using errcode = '42501';
  end if;

  return query
  select
    j.order_id,
    case
      when j.status = 'completed' then 'succeeded'
      when j.status = 'review_required' then 'failed'
      else 'pending'
    end::text
  from private.payment_refund_jobs j
  where j.tenant_id = p_tenant
    and j.order_id is not null;
end;
$$;

-- Return type is expanded, so PostgreSQL requires drop/create. Existing column
-- names remain present for booking workers while generic provider fields are
-- added for both booking and order sources.
drop function if exists public.claim_payment_refund_jobs(
  uuid, timestamptz, integer, integer
);
create function public.claim_payment_refund_jobs(
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer,
  p_limit integer
) returns table (
  id uuid,
  tenant_id uuid,
  payment_id uuid,
  booking_id uuid,
  order_id uuid,
  provider text,
  provider_payment_id text,
  provider_account_scope text,
  payment_intent_id text,
  connected_account_id text,
  provider_idempotency_key text,
  attempt_count integer,
  lease_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update private.payment_refund_jobs j
     set status = 'review_required',
         review_required_at = p_now,
         lease_token = null,
         lease_expires_at = null,
         last_error_code = 'retry_limit_reached',
         updated_at = p_now
   where j.status = 'attempting'
     and j.lease_expires_at <= p_now
     and j.attempt_count >= j.max_attempts;

  return query
  with candidates as (
    select j.id
      from private.payment_refund_jobs j
     where j.available_at <= p_now
       and j.attempt_count < j.max_attempts
       and (
         j.status = 'queued'
         or (j.status = 'attempting' and j.lease_expires_at <= p_now)
       )
     order by j.available_at, j.created_at, j.id
     for update skip locked
     limit least(greatest(coalesce(p_limit, 5), 1), 20)
  ),
  claimed as (
    update private.payment_refund_jobs j
       set status = 'attempting',
           attempt_count = j.attempt_count + 1,
           lease_token = p_lease_token,
           lease_expires_at = p_now + pg_catalog.make_interval(
             secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
           ),
           last_error_code = null,
           updated_at = p_now
      from candidates c
     where j.id = c.id
    returning j.*
  )
  select
    c.id,
    c.tenant_id,
    c.payment_id,
    c.booking_id,
    c.order_id,
    case when c.booking_id is not null then 'stripe' else i.provider end,
    case
      when c.booking_id is not null then c.provider_payment_intent_id
      else i.provider_payment_id
    end,
    case
      when c.booking_id is not null then c.provider_connected_account_id
      else i.provider_account_scope
    end,
    c.provider_payment_intent_id,
    c.provider_connected_account_id,
    c.provider_idempotency_key,
    c.attempt_count,
    c.lease_token
  from claimed c
  join public.payments p
    on p.id = c.payment_id
   and p.tenant_id = c.tenant_id
  cross join lateral private.payment_refund_identity(p) i;
end;
$$;

drop function if exists public.claim_payment_refund_job_by_id(
  uuid, uuid, timestamptz, integer
);
create function public.claim_payment_refund_job_by_id(
  p_id uuid,
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer
) returns table (
  id uuid,
  tenant_id uuid,
  payment_id uuid,
  booking_id uuid,
  order_id uuid,
  provider text,
  provider_payment_id text,
  provider_account_scope text,
  payment_intent_id text,
  connected_account_id text,
  provider_idempotency_key text,
  attempt_count integer,
  lease_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update private.payment_refund_jobs j
     set status = 'review_required',
         review_required_at = p_now,
         lease_token = null,
         lease_expires_at = null,
         last_error_code = 'retry_limit_reached',
         updated_at = p_now
   where j.id = p_id
     and j.status = 'attempting'
     and j.lease_expires_at <= p_now
     and j.attempt_count >= j.max_attempts;

  return query
  with claimed as (
    update private.payment_refund_jobs j
       set status = 'attempting',
           attempt_count = j.attempt_count + 1,
           lease_token = p_lease_token,
           lease_expires_at = p_now + pg_catalog.make_interval(
             secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
           ),
           last_error_code = null,
           updated_at = p_now
     where j.id = p_id
       and j.available_at <= p_now
       and j.attempt_count < j.max_attempts
       and (
         j.status = 'queued'
         or (j.status = 'attempting' and j.lease_expires_at <= p_now)
       )
    returning j.*
  )
  select
    c.id,
    c.tenant_id,
    c.payment_id,
    c.booking_id,
    c.order_id,
    case when c.booking_id is not null then 'stripe' else i.provider end,
    case
      when c.booking_id is not null then c.provider_payment_intent_id
      else i.provider_payment_id
    end,
    case
      when c.booking_id is not null then c.provider_connected_account_id
      else i.provider_account_scope
    end,
    c.provider_payment_intent_id,
    c.provider_connected_account_id,
    c.provider_idempotency_key,
    c.attempt_count,
    c.lease_token
  from claimed c
  join public.payments p
    on p.id = c.payment_id
   and p.tenant_id = c.tenant_id
  cross join lateral private.payment_refund_identity(p) i;
end;
$$;

create or replace function public.complete_payment_refund_job(
  p_id uuid,
  p_lease_token uuid,
  p_provider_ref text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot private.payment_refund_jobs%rowtype;
  v_job private.payment_refund_jobs%rowtype;
  v_payment public.payments%rowtype;
  v_order public.shop_orders%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_provider_ref is null
     or p_provider_ref !~ '^[A-Za-z0-9._:-]{1,200}$' then
    return false;
  end if;

  select j.* into v_snapshot
    from private.payment_refund_jobs j
   where j.id = p_id;
  if not found then
    return false;
  end if;

  if v_snapshot.booking_id is not null then
    -- Preserve the established booking order: payment, refund job.
    select p.* into v_payment
      from public.payments p
     where p.id = v_snapshot.payment_id
       and p.tenant_id = v_snapshot.tenant_id
     for update;
    if not found then
      raise exception 'refund_payment_state_invalid' using errcode = '55000';
    end if;
    if v_payment.booking_id is distinct from v_snapshot.booking_id then
      raise exception 'refund_payment_state_invalid' using errcode = '55000';
    end if;
  else
    -- Match the Goal 92 payment-event rail: order, payment, refund job.
    select o.* into v_order
      from public.shop_orders o
     where o.id = v_snapshot.order_id
       and o.tenant_id = v_snapshot.tenant_id
     for update;
    if not found then
      raise exception 'refund_order_state_invalid' using errcode = '55000';
    end if;
    select p.* into v_payment
      from public.payments p
     where p.id = v_snapshot.payment_id
       and p.tenant_id = v_snapshot.tenant_id
     for update;
    if not found
       or v_payment.order_id is distinct from v_snapshot.order_id then
      raise exception 'refund_payment_state_invalid' using errcode = '55000';
    end if;
  end if;

  select j.* into v_job
    from private.payment_refund_jobs j
   where j.id = p_id
   for update;
  if not found then
    return false;
  end if;
  if v_job.payment_id is distinct from v_snapshot.payment_id
     or v_job.tenant_id is distinct from v_snapshot.tenant_id
     or v_job.booking_id is distinct from v_snapshot.booking_id
     or v_job.order_id is distinct from v_snapshot.order_id then
    raise exception 'refund_job_identity_changed' using errcode = '55000';
  end if;

  if v_job.status = 'completed' then
    return v_payment.status = 'refunded'
      and (
        v_job.order_id is null
        or v_order.payment_status = 'refunded'
      );
  end if;
  if v_job.status <> 'provider_started'
     or v_job.lease_token is distinct from p_lease_token then
    return false;
  end if;
  if v_payment.status not in ('succeeded', 'refunded') then
    raise exception 'refund_payment_state_invalid' using errcode = '55000';
  end if;

  update public.payments p
     set status = 'refunded'
   where p.id = v_job.payment_id
     and p.tenant_id = v_job.tenant_id
     and (
       (v_job.booking_id is not null and p.booking_id = v_job.booking_id)
       or (v_job.order_id is not null and p.order_id = v_job.order_id)
     )
     and p.status in ('succeeded', 'refunded');
  if not found then
    raise exception 'refund_payment_state_invalid' using errcode = '55000';
  end if;

  if v_job.order_id is not null then
    update public.shop_orders o
       set payment_status = 'refunded'
     where o.id = v_job.order_id
       and o.tenant_id = v_job.tenant_id
       and o.payment_status in ('paid', 'refunded');
    if not found then
      raise exception 'refund_order_state_invalid' using errcode = '55000';
    end if;
  end if;

  update private.payment_refund_jobs j
     set status = 'completed',
         completed_at = statement_timestamp(),
         provider_ref = p_provider_ref,
         lease_token = null,
         lease_expires_at = null,
         last_error_code = null,
         updated_at = statement_timestamp()
   where j.id = v_job.id
     and j.status = 'provider_started'
     and j.lease_token = p_lease_token;
  return found;
end;
$$;

-- Stripe refund webhooks can win the race against the worker response. Mirror
-- order state in that same durable transaction so a completed job can never
-- leave a paid order behind. Booking behavior and signature stay unchanged.
create or replace function public.record_payment_refund_webhook(
  p_tenant uuid,
  p_payment_intent text,
  p_provider_ref text,
  p_connected_account text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot public.payments%rowtype;
  v_payment public.payments%rowtype;
  v_order public.shop_orders%rowtype;
  v_job_id uuid;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_provider_ref is null
     or p_provider_ref !~ '^[A-Za-z0-9._:-]{1,200}$' then
    raise exception 'provider_ref_invalid' using errcode = '22023';
  end if;
  if p_connected_account !~ '^acct_[A-Za-z0-9_]{1,196}$' then
    raise exception 'connected_account_invalid' using errcode = '22023';
  end if;

  select p.* into v_snapshot
    from public.payments p
   where p.tenant_id = p_tenant
     and p.stripe_payment_intent_id = p_payment_intent
     and p.stripe_connected_account_id = p_connected_account;
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  if v_snapshot.order_id is not null then
    select o.* into v_order
      from public.shop_orders o
     where o.id = v_snapshot.order_id
       and o.tenant_id = p_tenant
     for update;
    if not found then
      raise exception 'refund_order_state_invalid' using errcode = '55000';
    end if;
    select p.* into v_payment
      from public.payments p
     where p.id = v_snapshot.id
       and p.tenant_id = p_tenant
       and p.order_id = v_snapshot.order_id
       and p.stripe_payment_intent_id = p_payment_intent
       and p.stripe_connected_account_id = p_connected_account
     for update;
  else
    select p.* into v_payment
      from public.payments p
     where p.id = v_snapshot.id
       and p.tenant_id = p_tenant
       and p.booking_id is not distinct from v_snapshot.booking_id
       and p.stripe_payment_intent_id = p_payment_intent
       and p.stripe_connected_account_id = p_connected_account
     for update;
  end if;
  if not found then
    raise exception 'refund_payment_state_invalid' using errcode = '55000';
  end if;

  update public.payments p
     set status = 'refunded'
   where p.id = v_payment.id
     and p.tenant_id = p_tenant;

  if v_payment.order_id is not null then
    update public.shop_orders o
       set payment_status = 'refunded'
     where o.id = v_payment.order_id
       and o.tenant_id = p_tenant
       and o.payment_status in ('paid', 'refunded');
    if not found then
      raise exception 'refund_order_state_invalid' using errcode = '55000';
    end if;
  end if;

  update private.payment_refund_jobs j
     set status = 'completed',
         completed_at = statement_timestamp(),
         provider_ref = p_provider_ref,
         lease_token = null,
         lease_expires_at = null,
         review_required_at = null,
         last_error_code = null,
         updated_at = statement_timestamp()
   where j.payment_id = v_payment.id
     and j.tenant_id = p_tenant
     and j.status <> 'completed'
  returning j.id into v_job_id;
  if v_job_id is null then
    select j.id into v_job_id
      from private.payment_refund_jobs j
     where j.payment_id = v_payment.id
       and j.tenant_id = p_tenant;
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'recorded',
    'payment_id', v_payment.id,
    'refund_job_id', v_job_id
  );
end;
$$;

revoke all on function public.enqueue_shop_order_refund(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_shop_order_refund(uuid,uuid)
  to authenticated, service_role;

revoke all on function public.shop_order_refund_statuses(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.shop_order_refund_statuses(uuid)
  to authenticated, service_role;

revoke all on function public.claim_payment_refund_jobs(
  uuid,timestamptz,integer,integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_payment_refund_jobs(
  uuid,timestamptz,integer,integer
) to service_role;

revoke all on function public.claim_payment_refund_job_by_id(
  uuid,uuid,timestamptz,integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_payment_refund_job_by_id(
  uuid,uuid,timestamptz,integer
) to service_role;

revoke all on function public.complete_payment_refund_job(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_payment_refund_job(uuid,uuid,text)
  to service_role;

revoke all on function public.record_payment_refund_webhook(uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_payment_refund_webhook(uuid,text,text,text)
  to service_role;
