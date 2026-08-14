-- Stripe draft invoicing for the platform account. The period ledger is the
-- permanent billing snapshot; test and live Stripe objects share that row so
-- the unique tenant/month contract stays intact.

begin;

create table private.platform_billing_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  period_start date not null,
  billing_model text not null check (billing_model in ('per_booking', 'flat_monthly')),
  completed_bookings integer not null check (completed_bookings >= 0),
  unit_amount_cents integer not null check (unit_amount_cents between 0 and 100000000),
  total_cents integer not null check (total_cents between 0 and 1000000000),
  currency text not null default 'sek' check (currency ~ '^[a-z]{3}$'),
  stripe_test_customer_id text,
  stripe_test_invoice_id text unique,
  stripe_test_invoice_status text,
  stripe_customer_id text,
  stripe_invoice_id text unique,
  stripe_invoice_status text,
  last_error_code text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (tenant_id, period_start),
  check (period_start = pg_catalog.date_trunc('month', period_start)::date),
  check (stripe_test_customer_id is null or stripe_test_customer_id ~ '^cus_[A-Za-z0-9_]{1,196}$'),
  check (stripe_test_invoice_id is null or stripe_test_invoice_id ~ '^in_[A-Za-z0-9_]{1,196}$'),
  check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9_]{1,196}$'),
  check (stripe_invoice_id is null or stripe_invoice_id ~ '^in_[A-Za-z0-9_]{1,196}$'),
  check (stripe_test_invoice_status is null or stripe_test_invoice_status in (
    'draft', 'open', 'paid', 'void', 'uncollectible', 'deleted'
  )),
  check (stripe_invoice_status is null or stripe_invoice_status in (
    'draft', 'open', 'paid', 'void', 'uncollectible', 'deleted'
  ))
);

create index platform_billing_periods_period_idx
  on private.platform_billing_periods (period_start, tenant_id);

alter table private.platform_billing_periods enable row level security;
revoke all on table private.platform_billing_periods
  from public, anon, authenticated, service_role;

create table private.platform_billing_webhook_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9_]{1,196}$'),
  event_type text not null,
  object_id text not null check (object_id ~ '^in_[A-Za-z0-9_]{1,196}$'),
  livemode boolean not null,
  received_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table private.platform_billing_webhook_events enable row level security;
revoke all on table private.platform_billing_webhook_events
  from public, anon, authenticated, service_role;

create or replace function public.platform_billing_periods(
  p_year integer,
  p_month integer
)
returns table (
  id uuid,
  tenant_id uuid,
  period_start date,
  billing_model text,
  completed_bookings integer,
  unit_amount_cents integer,
  total_cents integer,
  currency text,
  stripe_test_customer_id text,
  stripe_test_invoice_id text,
  stripe_test_invoice_status text,
  stripe_customer_id text,
  stripe_invoice_id text,
  stripe_invoice_status text,
  last_error_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period date;
begin
  if (select auth.uid()) is null or not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  if p_year not between 2000 and 2100 or p_month not between 1 and 12 then
    raise exception 'billing_period_invalid' using errcode = '22023';
  end if;
  v_period := pg_catalog.make_date(p_year, p_month, 1);

  return query
  select
    b.id,
    b.tenant_id,
    b.period_start,
    b.billing_model,
    b.completed_bookings,
    b.unit_amount_cents,
    b.total_cents,
    b.currency,
    b.stripe_test_customer_id,
    b.stripe_test_invoice_id,
    b.stripe_test_invoice_status,
    b.stripe_customer_id,
    b.stripe_invoice_id,
    b.stripe_invoice_status,
    b.last_error_code
  from private.platform_billing_periods b
  where b.period_start = v_period
  order by b.tenant_id;
end;
$$;

create or replace function public.platform_billing_period(
  p_tenant uuid,
  p_period_start date
)
returns table (
  id uuid,
  total_cents integer,
  currency text,
  stripe_test_customer_id text,
  stripe_test_invoice_id text,
  stripe_test_invoice_status text,
  stripe_customer_id text,
  stripe_invoice_id text,
  stripe_invoice_status text,
  last_error_code text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  if p_tenant is null
     or p_period_start is null
     or p_period_start <> pg_catalog.date_trunc('month', p_period_start)::date then
    raise exception 'billing_period_invalid' using errcode = '22023';
  end if;

  return query
  select
    b.id,
    b.total_cents,
    b.currency,
    b.stripe_test_customer_id,
    b.stripe_test_invoice_id,
    b.stripe_test_invoice_status,
    b.stripe_customer_id,
    b.stripe_invoice_id,
    b.stripe_invoice_status,
    b.last_error_code
  from private.platform_billing_periods b
  where b.tenant_id = p_tenant and b.period_start = p_period_start;
end;
$$;

create or replace function public.platform_billing_completed_counts(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.has_platform_access()) then
    raise exception 'platform_operator_required' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'billing_range_invalid' using errcode = '22023';
  end if;

  return (
    select coalesce(
      pg_catalog.jsonb_object_agg(counts.tenant_id::text, counts.completed_bookings),
      '{}'::jsonb
    )
    from (
      select b.tenant_id, pg_catalog.count(*)::integer as completed_bookings
      from public.bookings b
      where b.status = 'completed'
        and b.start_ts >= p_from
        and b.start_ts < p_to
        and (
          (select private.is_platform_admin())
          or exists (
            select 1
            from public.tenants t
            where t.id = b.tenant_id
              and t.partner_id = (select private.partner_id())
          )
        )
      group by b.tenant_id
    ) counts
  );
end;
$$;

create or replace function public.reserve_platform_billing_period(
  p_tenant uuid,
  p_period_start date,
  p_billing_model text,
  p_completed_bookings integer,
  p_unit_amount_cents integer,
  p_total_cents integer,
  p_currency text default 'sek'
)
returns table (
  id uuid,
  stripe_test_customer_id text,
  stripe_test_invoice_id text,
  stripe_test_invoice_status text,
  stripe_customer_id text,
  stripe_invoice_id text,
  stripe_invoice_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.platform_billing_periods%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  if p_tenant is null
     or p_period_start is null
     or p_billing_model is null
     or p_completed_bookings is null
     or p_unit_amount_cents is null
     or p_total_cents is null
     or p_currency is null
     or p_period_start <> pg_catalog.date_trunc('month', p_period_start)::date
     or p_period_start >= pg_catalog.date_trunc('month', pg_catalog.now())::date
     or p_billing_model not in ('per_booking', 'flat_monthly')
     or p_completed_bookings not between 0 and 100000000
     or p_unit_amount_cents not between 0 and 100000000
     or p_total_cents not between 0 and 1000000000
     or p_currency !~ '^[a-z]{3}$'
     or (p_billing_model = 'per_booking'
         and p_total_cents::bigint <> p_completed_bookings::bigint * p_unit_amount_cents::bigint)
     or (p_billing_model = 'flat_monthly' and p_total_cents <> p_unit_amount_cents) then
    raise exception 'billing_snapshot_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tenants t where t.id = p_tenant and t.status <> 'deleted'
  ) then
    raise exception 'billing_tenant_missing' using errcode = 'P0002';
  end if;

  insert into private.platform_billing_periods (
    tenant_id,
    period_start,
    billing_model,
    completed_bookings,
    unit_amount_cents,
    total_cents,
    currency,
    stripe_test_customer_id,
    stripe_customer_id,
    created_by
  ) values (
    p_tenant,
    p_period_start,
    p_billing_model,
    p_completed_bookings,
    p_unit_amount_cents,
    p_total_cents,
    p_currency,
    (
      select previous.stripe_test_customer_id
      from private.platform_billing_periods previous
      where previous.tenant_id = p_tenant
        and previous.period_start < p_period_start
        and previous.stripe_test_customer_id is not null
      order by previous.period_start desc
      limit 1
    ),
    (
      select previous.stripe_customer_id
      from private.platform_billing_periods previous
      where previous.tenant_id = p_tenant
        and previous.period_start < p_period_start
        and previous.stripe_customer_id is not null
      order by previous.period_start desc
      limit 1
    ),
    (select auth.uid())
  )
  on conflict (tenant_id, period_start) do nothing;

  select * into strict v_row
  from private.platform_billing_periods b
  where b.tenant_id = p_tenant and b.period_start = p_period_start;

  if v_row.billing_model <> p_billing_model
     or v_row.completed_bookings <> p_completed_bookings
     or v_row.unit_amount_cents <> p_unit_amount_cents
     or v_row.total_cents <> p_total_cents
     or v_row.currency <> p_currency then
    raise exception 'billing_snapshot_mismatch' using errcode = '23505';
  end if;

  return query select
    v_row.id,
    v_row.stripe_test_customer_id,
    v_row.stripe_test_invoice_id,
    v_row.stripe_test_invoice_status,
    v_row.stripe_customer_id,
    v_row.stripe_invoice_id,
    v_row.stripe_invoice_status;
end;
$$;

create or replace function public.attach_platform_billing_draft(
  p_period uuid,
  p_customer_id text,
  p_invoice_id text,
  p_invoice_status text,
  p_livemode boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_period is null
     or p_customer_id is null
     or p_livemode is null
     or p_customer_id !~ '^cus_[A-Za-z0-9_]{1,196}$'
     or (p_invoice_id is not null and p_invoice_id !~ '^in_[A-Za-z0-9_]{1,196}$')
     or (p_invoice_status is not null and p_invoice_status not in (
       'draft', 'open', 'paid', 'void', 'uncollectible', 'deleted'
     )) then
    raise exception 'billing_provider_identity_invalid' using errcode = '22023';
  end if;

  if p_livemode then
    update private.platform_billing_periods b
    set stripe_customer_id = p_customer_id,
        stripe_invoice_id = coalesce(p_invoice_id, b.stripe_invoice_id),
        stripe_invoice_status = coalesce(p_invoice_status, b.stripe_invoice_status),
        last_error_code = null,
        updated_at = pg_catalog.clock_timestamp()
    where b.id = p_period
      and (
        b.stripe_customer_id is null
        or b.stripe_customer_id = p_customer_id
        or b.stripe_invoice_id is null
      )
      and (p_invoice_id is null or b.stripe_invoice_id is null or b.stripe_invoice_id = p_invoice_id);
  else
    update private.platform_billing_periods b
    set stripe_test_customer_id = p_customer_id,
        stripe_test_invoice_id = coalesce(p_invoice_id, b.stripe_test_invoice_id),
        stripe_test_invoice_status = coalesce(p_invoice_status, b.stripe_test_invoice_status),
        last_error_code = null,
        updated_at = pg_catalog.clock_timestamp()
    where b.id = p_period
      and (
        b.stripe_test_customer_id is null
        or b.stripe_test_customer_id = p_customer_id
        or b.stripe_test_invoice_id is null
      )
      and (p_invoice_id is null or b.stripe_test_invoice_id is null or b.stripe_test_invoice_id = p_invoice_id);
  end if;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.mark_platform_billing_error(
  p_period uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_period is null
     or p_error_code is null
     or pg_catalog.length(pg_catalog.btrim(p_error_code)) not between 1 and 80 then
    raise exception 'billing_error_code_invalid' using errcode = '22023';
  end if;
  update private.platform_billing_periods b
  set last_error_code = pg_catalog.btrim(p_error_code),
      updated_at = pg_catalog.clock_timestamp()
  where b.id = p_period;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.record_platform_billing_event_and_enqueue(
  p_event_id text,
  p_event_type text,
  p_object_id text,
  p_livemode boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if p_event_id is null
     or p_event_type is null
     or p_object_id is null
     or p_livemode is null
     or p_event_id !~ '^evt_[A-Za-z0-9_]{1,196}$'
     or p_object_id !~ '^in_[A-Za-z0-9_]{1,196}$'
     or p_event_type not in (
       'invoice.created',
       'invoice.updated',
       'invoice.finalized',
       'invoice.paid',
       'invoice.payment_failed',
       'invoice.voided',
       'invoice.marked_uncollectible',
       'invoice.deleted'
     ) then
    raise exception 'billing_event_invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from private.platform_billing_periods b
    where (p_livemode and b.stripe_invoice_id = p_object_id)
       or (not p_livemode and b.stripe_test_invoice_id = p_object_id)
  ) then
    return false;
  end if;

  insert into private.platform_billing_webhook_events (
    event_id, event_type, object_id, livemode
  ) values (
    p_event_id, p_event_type, p_object_id, p_livemode
  )
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    perform public.enqueue_corevo_job(pg_catalog.jsonb_build_object(
      'v', 1,
      'type', 'stripe.billing.reconcile',
      'eventId', p_event_id,
      'objectId', p_object_id
    ));
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.platform_billing_webhook_event(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event jsonb;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]{1,196}$' then
    raise exception 'billing_event_id_invalid' using errcode = '22023';
  end if;

  select pg_catalog.jsonb_build_object(
    'eventType', e.event_type,
    'objectId', e.object_id,
    'livemode', e.livemode
  ) into v_event
  from private.platform_billing_webhook_events e
  where e.event_id = p_event_id;

  if v_event is null then
    raise exception 'billing_event_missing' using errcode = 'P0002';
  end if;
  return v_event;
end;
$$;

create or replace function public.reconcile_platform_billing_invoice(
  p_invoice_id text,
  p_customer_id text,
  p_invoice_status text,
  p_livemode boolean,
  p_total_cents integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_invoice_id is null
     or p_invoice_status is null
     or p_livemode is null
     or p_invoice_id !~ '^in_[A-Za-z0-9_]{1,196}$'
     or p_invoice_status not in ('draft', 'open', 'paid', 'void', 'uncollectible', 'deleted')
     or (p_invoice_status <> 'deleted' and (
       p_customer_id is null
       or p_customer_id !~ '^cus_[A-Za-z0-9_]{1,196}$'
       or p_total_cents is null
       or p_total_cents < 0
     )) then
    raise exception 'billing_reconcile_invalid' using errcode = '22023';
  end if;

  if p_livemode then
    update private.platform_billing_periods b
    set stripe_customer_id = coalesce(p_customer_id, b.stripe_customer_id),
        stripe_invoice_status = p_invoice_status,
        last_error_code = null,
        updated_at = pg_catalog.clock_timestamp()
    where b.stripe_invoice_id = p_invoice_id
      and (p_customer_id is null or b.stripe_customer_id is null or b.stripe_customer_id = p_customer_id)
      and (p_invoice_status = 'deleted' or b.total_cents = p_total_cents);
  else
    update private.platform_billing_periods b
    set stripe_test_customer_id = coalesce(p_customer_id, b.stripe_test_customer_id),
        stripe_test_invoice_status = p_invoice_status,
        last_error_code = null,
        updated_at = pg_catalog.clock_timestamp()
    where b.stripe_test_invoice_id = p_invoice_id
      and (p_customer_id is null or b.stripe_test_customer_id is null or b.stripe_test_customer_id = p_customer_id)
      and (p_invoice_status = 'deleted' or b.total_cents = p_total_cents);
  end if;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.platform_billing_periods(integer, integer)
  from public, anon, service_role;
revoke all on function public.platform_billing_period(uuid, date)
  from public, anon, service_role;
revoke all on function public.platform_billing_completed_counts(timestamptz, timestamptz)
  from public, anon, service_role;
revoke all on function public.reserve_platform_billing_period(
  uuid, date, text, integer, integer, integer, text
) from public, anon, service_role;
grant execute on function public.platform_billing_periods(integer, integer) to authenticated;
grant execute on function public.platform_billing_period(uuid, date) to authenticated;
grant execute on function public.platform_billing_completed_counts(timestamptz, timestamptz)
  to authenticated;
grant execute on function public.reserve_platform_billing_period(
  uuid, date, text, integer, integer, integer, text
) to authenticated;

revoke all on function public.attach_platform_billing_draft(uuid, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.mark_platform_billing_error(uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_platform_billing_event_and_enqueue(text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.platform_billing_webhook_event(text)
  from public, anon, authenticated;
revoke all on function public.reconcile_platform_billing_invoice(text, text, text, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.attach_platform_billing_draft(uuid, text, text, text, boolean)
  to service_role;
grant execute on function public.mark_platform_billing_error(uuid, text) to service_role;
grant execute on function public.record_platform_billing_event_and_enqueue(text, text, text, boolean)
  to service_role;
grant execute on function public.platform_billing_webhook_event(text) to service_role;
grant execute on function public.reconcile_platform_billing_invoice(text, text, text, boolean, integer)
  to service_role;

commit;
