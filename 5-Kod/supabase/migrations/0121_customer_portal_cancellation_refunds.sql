-- 0121 — Customer-portal cancellation + durable booking refund rail.
-- A cancellation, its notification, audit row and any required refund job are
-- one transaction. Provider calls happen later under a lease/CAS state machine.

create unique index if not exists payments_tenant_id_id_booking_id_key
  on public.payments (tenant_id, id, booking_id);
create unique index if not exists payments_tenant_id_id_key
  on public.payments (tenant_id, id);
create unique index if not exists bookings_tenant_id_id_key
  on public.bookings (tenant_id, id);

alter table public.payments
  add column if not exists stripe_connected_account_id text;
alter table public.payments
  add constraint payments_stripe_connected_account_format
  check (
    stripe_connected_account_id is null
    or stripe_connected_account_id ~ '^acct_[A-Za-z0-9_]{1,196}$'
  );

-- Existing captured booking money must have a historically proven Connect
-- account before refund automation can exist. Never guess from the tenant's
-- current account: that account may have changed since capture.
create or replace function private.assert_booking_payment_account_snapshots()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.payments p
    where p.booking_id is not null
      and p.status = 'succeeded'
      and p.stripe_connected_account_id is null
  ) then
    raise exception 'legacy_succeeded_payment_account_snapshot_missing'
      using errcode = '55000';
  end if;
end;
$$;
revoke all on function private.assert_booking_payment_account_snapshots()
  from public, anon, authenticated, service_role;
select private.assert_booking_payment_account_snapshots();

-- The preflight above gives operators a repairable migration error. The
-- validated CHECK below makes the invariant permanent while still allowing
-- legacy pending/failed rows to bind status + account in one atomic update.
alter table public.payments
  add constraint payments_succeeded_booking_account_required
  check (
    booking_id is null
    or status <> 'succeeded'
    or stripe_connected_account_id is not null
  ) not valid;
alter table public.payments
  validate constraint payments_succeeded_booking_account_required;

-- Direct-charge PaymentIntent identity is scoped by the connected account.
-- Rows without a historical account snapshot (notably legacy webshop rows)
-- are deliberately excluded: assigning the tenant's current account would be
-- an unsafe guess. All new order/booking succeeded webhooks persist the account.
create or replace function private.assert_payment_intent_identity_unique()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.payments p
    where p.stripe_connected_account_id is not null
      and p.stripe_payment_intent_id is not null
    group by p.stripe_connected_account_id, p.stripe_payment_intent_id
    having count(*) > 1
  ) then
    raise exception 'legacy_payment_intent_duplicate'
      using errcode = '55000';
  end if;
end;
$$;
revoke all on function private.assert_payment_intent_identity_unique()
  from public, anon, authenticated, service_role;
select private.assert_payment_intent_identity_unique();
create unique index payments_account_payment_intent_key
  on public.payments (stripe_connected_account_id, stripe_payment_intent_id)
  where stripe_connected_account_id is not null
    and stripe_payment_intent_id is not null;

-- Once provider money is captured, the Connect account + PaymentIntent pair is
-- historical identity. Status may move succeeded -> refunded, but neither half
-- of that identity may ever be rewritten (including to NULL).
create or replace function private.guard_settled_payment_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('succeeded', 'refunded') and (
    new.stripe_connected_account_id is distinct from old.stripe_connected_account_id
    or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  ) then
    raise exception 'payment_provider_identity_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_settled_payment_identity()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_guard_settled_payment_identity on public.payments;
create trigger trg_guard_settled_payment_identity
before update of status, stripe_connected_account_id, stripe_payment_intent_id
on public.payments
for each row execute function private.guard_settled_payment_identity();

create table private.payment_refund_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  payment_id uuid not null,
  booking_id uuid not null,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_payment_intent_id text not null,
  provider_connected_account_id text not null,
  provider_idempotency_key text not null,
  status text not null default 'queued'
    check (status in ('queued', 'attempting', 'provider_started', 'completed', 'review_required')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  max_attempts integer not null default 8 check (max_attempts = 8),
  available_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_started_at timestamptz,
  completed_at timestamptz,
  review_required_at timestamptz,
  provider_ref text,
  last_error_code text check (last_error_code is null or length(last_error_code) between 1 and 80),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (payment_id),
  unique (provider_idempotency_key),
  foreign key (tenant_id, payment_id, booking_id)
    references public.payments (tenant_id, id, booking_id) on delete cascade,
  foreign key (tenant_id, booking_id)
    references public.bookings (tenant_id, id) on delete cascade,
  check (provider_payment_intent_id ~ '^pi_[A-Za-z0-9_]{1,196}$'),
  check (provider_connected_account_id ~ '^acct_[A-Za-z0-9_]{1,196}$'),
  check (provider_idempotency_key ~ '^refund_[0-9a-f-]{36}$'),
  check (
    (status = 'queued' and lease_token is null and lease_expires_at is null
      and provider_started_at is null and completed_at is null and review_required_at is null)
    or (status = 'attempting' and lease_token is not null and lease_expires_at is not null
      and provider_started_at is null and completed_at is null and review_required_at is null)
    or (status = 'provider_started' and lease_token is not null and lease_expires_at is null
      and provider_started_at is not null and completed_at is null and review_required_at is null)
    or (status = 'completed' and lease_token is null and lease_expires_at is null
      and completed_at is not null and review_required_at is null)
    or (status = 'review_required' and lease_token is null and lease_expires_at is null
      and completed_at is null and review_required_at is not null)
  )
);

create index payment_refund_jobs_claim_idx
  on private.payment_refund_jobs (available_at, created_at, id)
  where status in ('queued', 'attempting');
create index payment_refund_jobs_review_idx
  on private.payment_refund_jobs (review_required_at, created_at)
  where status = 'review_required';
create index payment_refund_jobs_provider_started_idx
  on private.payment_refund_jobs (provider_started_at)
  where status = 'provider_started';

alter table private.payment_refund_jobs enable row level security;
revoke all on table private.payment_refund_jobs
  from public, anon, authenticated, service_role;

-- Durable idempotency and webhook routing for create-new-then-release-old
-- customer rebooks. A row exists for every committed rebook, with nullable
-- payment snapshots only when no payment was carried.
create table private.customer_booking_rebooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  old_booking_id uuid not null,
  new_booking_id uuid not null,
  customer_profile_id uuid not null,
  customer_id uuid,
  payment_id uuid,
  provider_payment_intent_id text,
  provider_connected_account_id text,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, old_booking_id),
  unique (tenant_id, new_booking_id),
  unique (payment_id),
  foreign key (tenant_id, old_booking_id)
    references public.bookings (tenant_id, id) on delete cascade,
  foreign key (tenant_id, new_booking_id)
    references public.bookings (tenant_id, id) on delete cascade,
  foreign key (tenant_id, payment_id)
    references public.payments (tenant_id, id) on delete restrict,
  check (old_booking_id <> new_booking_id),
  check (
    (payment_id is null and provider_payment_intent_id is null
      and provider_connected_account_id is null)
    or (payment_id is not null
      and provider_payment_intent_id ~ '^pi_[A-Za-z0-9_]{1,196}$'
      and provider_connected_account_id ~ '^acct_[A-Za-z0-9_]{1,196}$')
  )
);
alter table private.customer_booking_rebooks enable row level security;
revoke all on table private.customer_booking_rebooks
  from public, anon, authenticated, service_role;

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
    tenant_id, payment_id, booking_id, provider_payment_intent_id,
    provider_connected_account_id,
    provider_idempotency_key
  ) values (
    p_tenant, p_payment, p_booking, v_payment.stripe_payment_intent_id,
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

drop function if exists public.customer_portal_cancel_booking(uuid,text,uuid,integer,text);
create function public.customer_portal_cancel_booking(
  p_session_public_id uuid,
  p_secret_digest text,
  p_booking_public_id uuid,
  p_expected_cutoff_hours integer,
  p_idempotency_key text
) returns table (outcome text, booking_status text, refund_job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_audit private.customer_portal_audit%rowtype;
  v_now timestamptz := statement_timestamp();
  v_cutoff integer := 24;
  v_setting text;
  v_event_key text;
  v_refund_job_id uuid;
begin
  if p_idempotency_key is null
     or length(p_idempotency_key) not between 16 and 160 then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;

  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, v_now
  );
  if not found then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_session.tenant_id::text || ':booking_cancelled:' || p_idempotency_key, 0
  ));

  select a.* into v_audit
  from private.customer_portal_audit a
  where a.tenant_id = v_session.tenant_id
    and a.event_type = 'booking_cancelled'
    and a.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_audit.customer_id = v_session.customer_id
       and v_audit.entity_public_id = p_booking_public_id then
      select j.id into v_refund_job_id
      from private.payment_refund_jobs j
      where j.tenant_id = v_session.tenant_id
        and j.booking_id = p_booking_public_id;
      return query select 'cancelled'::text, 'cancelled'::text, v_refund_job_id;
    else
      return query select 'idempotency_conflict'::text, null::text, null::uuid;
    end if;
    return;
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_public_id
    and b.tenant_id = v_session.tenant_id
    and b.customer_id = v_session.customer_id
  for update;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;
  if v_booking.status = 'cancelled' then
    select j.id into v_refund_job_id
    from private.payment_refund_jobs j
    where j.tenant_id = v_session.tenant_id and j.booking_id = v_booking.id;
    if v_refund_job_id is null then
      select p.* into v_payment
      from public.payments p
      where p.tenant_id = v_session.tenant_id and p.booking_id = v_booking.id
      for update;
      if found and v_payment.status = 'succeeded' then
        v_refund_job_id := private.enqueue_booking_payment_refund(
          v_session.tenant_id, v_booking.id, v_payment.id
        );
      end if;
    end if;
    insert into private.customer_portal_audit (
      tenant_id, customer_id, session_id, event_type,
      entity_public_id, idempotency_key, metadata
    ) values (
      v_session.tenant_id, v_session.customer_id, v_session.session_id,
      'booking_cancelled', v_booking.id, p_idempotency_key,
      pg_catalog.jsonb_build_object('outcome', 'already_cancelled')
    );
    return query select 'already_cancelled'::text, 'cancelled'::text, v_refund_job_id;
    return;
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    return query select 'not_allowed'::text, v_booking.status, null::uuid;
    return;
  end if;

  select ts.settings ->> 'cancellation_cutoff_hours' into v_setting
  from public.tenant_settings ts
  where ts.tenant_id = v_session.tenant_id;
  if v_setting ~ '^[0-9]{1,4}$' then
    v_cutoff := greatest(0, v_setting::integer);
  end if;
  if p_expected_cutoff_hours is distinct from v_cutoff then
    return query select 'policy_changed'::text, v_booking.status, null::uuid;
    return;
  end if;
  if v_booking.start_ts <= v_now + pg_catalog.make_interval(hours => v_cutoff) then
    return query select 'not_allowed'::text, v_booking.status, null::uuid;
    return;
  end if;

  select p.* into v_payment
  from public.payments p
  where p.tenant_id = v_session.tenant_id and p.booking_id = v_booking.id
  for update;

  update public.bookings b
  set status = 'cancelled', cancelled_at = v_now, cancelled_by = 'customer'
  where b.id = v_booking.id
    and b.tenant_id = v_session.tenant_id
    and b.customer_id = v_session.customer_id
    and b.status in ('pending', 'confirmed');
  if not found then
    return query select 'already_cancelled'::text, 'cancelled'::text, null::uuid;
    return;
  end if;

  v_event_key := 'booking:' || v_booking.id::text || ':cancelled';
  perform 1 from public.route_booking_notification(
    p_tenant => v_session.tenant_id,
    p_booking => v_booking.id,
    p_staff => v_booking.staff_id,
    p_event_type => 'booking_cancelled',
    p_event_key => v_event_key,
    p_category => 'transactional',
    p_type_opt_in => null,
    p_expected_statuses => array['cancelled']::text[],
    p_payload => pg_catalog.jsonb_build_object(
      'template', 'booking_cancelled', 'booking_id', v_booking.id
    ),
    p_allow => true,
    p_skip_reason => null,
    p_outbox_id => null
  );

  if v_payment.id is not null and v_payment.status = 'succeeded' then
    v_refund_job_id := private.enqueue_booking_payment_refund(
      v_session.tenant_id, v_booking.id, v_payment.id
    );
  end if;

  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type,
    entity_public_id, idempotency_key
  ) values (
    v_session.tenant_id, v_session.customer_id, v_session.session_id,
    'booking_cancelled', v_booking.id, p_idempotency_key
  );

  return query select 'cancelled'::text, 'cancelled'::text, v_refund_job_id;
end;
$$;
revoke all on function public.customer_portal_cancel_booking(uuid,text,uuid,integer,text)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_cancel_booking(uuid,text,uuid,integer,text)
  to service_role;

-- Reserve the one checkout-backed payment row without an UPSERT that can revive
-- succeeded/refunded money. The Stripe session may already exist, but its URL is
-- returned only when this transaction wins.
create or replace function public.prepare_booking_checkout_payment(
  p_booking uuid,
  p_tenant uuid,
  p_amount_cents integer,
  p_currency text,
  p_checkout_session text,
  p_connected_account text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_status text;
  v_booking_price integer;
  v_existing public.payments%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_connected_account !~ '^acct_[A-Za-z0-9_]{1,196}$'
     or p_checkout_session !~ '^cs_[A-Za-z0-9_]{1,196}$'
     or p_currency !~ '^[a-z]{3}$' then
    return false;
  end if;
  select b.status, b.price_cents into v_booking_status, v_booking_price
  from public.bookings b
  where b.id = p_booking and b.tenant_id = p_tenant
  for update;
  if not found or v_booking_status <> 'pending'
     or p_amount_cents <= 0 or p_amount_cents is distinct from v_booking_price
     or not exists (
       select 1 from public.tenants t
       where t.id = p_tenant and t.stripe_account_id = p_connected_account
         and t.stripe_charges_enabled
     ) then
    return false;
  end if;
  insert into public.payments (
    tenant_id, booking_id, amount_cents, currency, status,
    stripe_checkout_session_id, stripe_connected_account_id
  ) values (
    p_tenant, p_booking, p_amount_cents, p_currency, 'pending',
    p_checkout_session, p_connected_account
  ) on conflict (booking_id) do nothing;
  if found then return true; end if;
  select p.* into v_existing from public.payments p
  where p.tenant_id = p_tenant and p.booking_id = p_booking;
  return found
    and v_existing.status = 'pending'
    and v_existing.amount_cents = p_amount_cents
    and v_existing.currency = p_currency
    and v_existing.stripe_checkout_session_id = p_checkout_session
    and v_existing.stripe_connected_account_id = p_connected_account;
end;
$$;
revoke all on function public.prepare_booking_checkout_payment(uuid,uuid,integer,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.prepare_booking_checkout_payment(uuid,uuid,integer,text,text,text)
  to service_role;

-- Settle one webshop payment under a row lock. Exact Stripe delivery replay is
-- accepted, while a second account/PaymentIntent can never replace captured
-- identity. This is the only webhook write path for successful shop payments.
create or replace function public.confirm_shop_order_payment(
  p_order uuid,
  p_tenant uuid,
  p_payment_intent text,
  p_connected_account text
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
  if p_connected_account !~ '^acct_[A-Za-z0-9_]{1,196}$'
     or p_payment_intent !~ '^pi_[A-Za-z0-9_]{1,196}$' then
    raise exception 'payment_provider_identity_invalid' using errcode = '22023';
  end if;

  select p.* into v_payment
  from public.payments p
  where p.order_id = p_order and p.tenant_id = p_tenant
  for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if v_payment.status = 'succeeded' then
    if v_payment.stripe_payment_intent_id is distinct from p_payment_intent
       or v_payment.stripe_connected_account_id is distinct from p_connected_account then
      raise exception 'payment_provider_identity_conflict' using errcode = '55000';
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'already_succeeded');
  end if;
  if v_payment.status = 'refunded' then
    if v_payment.stripe_payment_intent_id is distinct from p_payment_intent
       or v_payment.stripe_connected_account_id is distinct from p_connected_account then
      raise exception 'payment_provider_identity_conflict' using errcode = '55000';
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'refunded');
  end if;
  if v_payment.status in ('pending', 'failed') then
    if (v_payment.stripe_payment_intent_id is not null
        and v_payment.stripe_payment_intent_id is distinct from p_payment_intent)
       or (v_payment.stripe_connected_account_id is not null
           and v_payment.stripe_connected_account_id is distinct from p_connected_account) then
      raise exception 'payment_provider_identity_conflict' using errcode = '55000';
    end if;
    update public.payments p
    set status = 'succeeded',
        stripe_payment_intent_id = p_payment_intent,
        stripe_connected_account_id = p_connected_account
    where p.id = v_payment.id and p.tenant_id = p_tenant;
    return pg_catalog.jsonb_build_object('outcome', 'succeeded');
  end if;

  raise exception 'payment_state_invalid' using errcode = '55000';
end;
$$;
revoke all on function public.confirm_shop_order_payment(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_shop_order_payment(uuid,uuid,text,text)
  to service_role;

-- Finalize an already-created replacement booking in one transaction. A lost
-- client response is reconciled separately; the app never cancels directly.
create or replace function public.finalize_customer_booking_rebook(
  p_tenant uuid,
  p_old_booking uuid,
  p_new_booking uuid,
  p_customer_profile uuid,
  p_customer uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.bookings%rowtype;
  v_new public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_existing private.customer_booking_rebooks%rowtype;
  v_now timestamptz := statement_timestamp();
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_old_booking is null or p_new_booking is null
     or p_old_booking = p_new_booking or p_customer_profile is null then
    raise exception 'rebook_scope_invalid' using errcode = '22023';
  end if;

  -- Same lock family as confirm_booking_payment: webhook-first and rebook-first
  -- both serialize on the provider's original booking identity.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text || ':booking-payment:' || p_old_booking::text, 0
  ));
  perform 1 from public.bookings b
  where b.tenant_id = p_tenant and b.id in (p_old_booking, p_new_booking)
  order by b.id
  for update;

  select b.* into v_old from public.bookings b
  where b.tenant_id = p_tenant and b.id = p_old_booking;
  select b.* into v_new from public.bookings b
  where b.tenant_id = p_tenant and b.id = p_new_booking;
  if v_old.id is null or v_new.id is null
     or v_new.customer_profile_id is distinct from p_customer_profile
     or not (
       v_old.customer_profile_id = p_customer_profile
       or (p_customer is not null and v_old.customer_id = p_customer)
     )
     or (p_customer is not null and (
       v_old.customer_id is distinct from p_customer
       or v_new.customer_id is distinct from p_customer
     ))
     or v_old.service_id is distinct from v_new.service_id then
    raise exception 'rebook_scope_invalid' using errcode = '42501';
  end if;

  select r.* into v_existing
  from private.customer_booking_rebooks r
  where r.tenant_id = p_tenant and r.old_booking_id = p_old_booking;
  if found then
    if v_existing.new_booking_id is distinct from p_new_booking
       or v_existing.customer_profile_id is distinct from p_customer_profile
       or v_existing.customer_id is distinct from p_customer then
      raise exception 'rebook_already_finalized' using errcode = '55000';
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_finalized', 'payment_carried', v_existing.payment_id is not null
    );
  end if;
  if v_old.status not in ('pending', 'confirmed')
     or v_new.status not in ('pending', 'confirmed') then
    raise exception 'rebook_booking_state_invalid' using errcode = '55000';
  end if;

  select p.* into v_payment from public.payments p
  where p.tenant_id = p_tenant and p.booking_id = p_old_booking
  for update;
  if found then
    if v_payment.status <> 'succeeded' then
      raise exception 'rebook_payment_not_settled' using errcode = '55000';
    end if;
    if v_payment.stripe_payment_intent_id is null
       or v_payment.stripe_connected_account_id is null then
      raise exception 'rebook_payment_identity_missing' using errcode = '55000';
    end if;
    if exists (
      select 1 from private.payment_refund_jobs j
      where j.tenant_id = p_tenant
        and (j.payment_id = v_payment.id or j.booking_id = p_old_booking)
    ) then
      raise exception 'rebook_refund_state_conflict' using errcode = '55000';
    end if;
  elsif exists (
    select 1 from private.payment_refund_jobs j
    where j.tenant_id = p_tenant and j.booking_id = p_old_booking
  ) then
    raise exception 'rebook_refund_state_conflict' using errcode = '55000';
  end if;

  update public.bookings b
  set status = 'cancelled', cancelled_at = v_now, cancelled_by = 'customer'
  where b.tenant_id = p_tenant and b.id = p_old_booking
    and b.status in ('pending', 'confirmed');
  if not found then raise exception 'rebook_booking_state_invalid' using errcode = '55000'; end if;

  if v_payment.id is not null then
    update public.payments p
    set booking_id = p_new_booking
    where p.id = v_payment.id and p.tenant_id = p_tenant
      and p.booking_id = p_old_booking and p.status = 'succeeded';
    if not found then raise exception 'rebook_payment_move_failed' using errcode = '55000'; end if;
    update public.bookings b set status = 'confirmed'
    where b.tenant_id = p_tenant and b.id = p_new_booking
      and b.status in ('pending', 'confirmed');
  end if;

  insert into private.customer_booking_rebooks (
    tenant_id, old_booking_id, new_booking_id, customer_profile_id, customer_id,
    payment_id, provider_payment_intent_id, provider_connected_account_id
  ) values (
    p_tenant, p_old_booking, p_new_booking, p_customer_profile, p_customer,
    v_payment.id, v_payment.stripe_payment_intent_id,
    v_payment.stripe_connected_account_id
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'finalized', 'payment_carried', v_payment.id is not null
  );
end;
$$;
revoke all on function public.finalize_customer_booking_rebook(uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_customer_booking_rebook(uuid,uuid,uuid,uuid,uuid)
  to service_role;

-- Reconcile a failed/ambiguous finalizer response under the same lock. A
-- replacement is cancelled only while the old booking is still active and no
-- mapping or payment can possibly have been committed to the replacement.
create or replace function public.compensate_customer_booking_rebook(
  p_tenant uuid,
  p_old_booking uuid,
  p_new_booking uuid,
  p_customer_profile uuid,
  p_customer uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.bookings%rowtype;
  v_new public.bookings%rowtype;
  v_existing private.customer_booking_rebooks%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_old_booking is null or p_new_booking is null
     or p_old_booking = p_new_booking or p_customer_profile is null then
    return pg_catalog.jsonb_build_object('outcome', 'not_safe');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text || ':booking-payment:' || p_old_booking::text, 0
  ));
  perform 1 from public.bookings b
  where b.tenant_id = p_tenant and b.id in (p_old_booking, p_new_booking)
  order by b.id
  for update;

  select r.* into v_existing
  from private.customer_booking_rebooks r
  where r.tenant_id = p_tenant and r.old_booking_id = p_old_booking;
  if found then
    if v_existing.new_booking_id = p_new_booking
       and v_existing.customer_profile_id = p_customer_profile
       and v_existing.customer_id is not distinct from p_customer then
      return pg_catalog.jsonb_build_object(
        'outcome', 'preserved_finalized',
        'payment_carried', v_existing.payment_id is not null
      );
    end if;
    -- A competing rebook already won for this old booking. Preserve that map
    -- and its carried payment, but remove this request's orphan replacement if
    -- and only if it is still unowned, unpaid and in the same customer scope.
    select b.* into v_old from public.bookings b
    where b.tenant_id = p_tenant and b.id = p_old_booking;
    select b.* into v_new from public.bookings b
    where b.tenant_id = p_tenant and b.id = p_new_booking;
    if v_existing.customer_profile_id is distinct from p_customer_profile
       or v_existing.customer_id is distinct from p_customer
       or v_old.id is null or v_new.id is null
       or v_new.status not in ('pending', 'confirmed')
       or v_new.customer_profile_id is distinct from p_customer_profile
       or not (
         v_old.customer_profile_id = p_customer_profile
         or (p_customer is not null and v_old.customer_id = p_customer)
       )
       or (p_customer is not null and (
         v_old.customer_id is distinct from p_customer
         or v_new.customer_id is distinct from p_customer
       ))
       or v_old.service_id is distinct from v_new.service_id
       or exists (
         select 1 from private.customer_booking_rebooks r
         where r.tenant_id = p_tenant and r.new_booking_id = p_new_booking
       )
       or exists (
         select 1 from public.payments p
         where p.tenant_id = p_tenant and p.booking_id = p_new_booking
       ) then
      return pg_catalog.jsonb_build_object('outcome', 'not_safe');
    end if;
    update public.bookings b
    set status = 'cancelled', cancelled_at = statement_timestamp(), cancelled_by = 'customer'
    where b.tenant_id = p_tenant and b.id = p_new_booking
      and b.status in ('pending', 'confirmed');
    if not found then
      return pg_catalog.jsonb_build_object('outcome', 'not_safe');
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'compensated_loser', 'winner_booking_id', v_existing.new_booking_id
    );
  end if;
  if exists (
    select 1 from private.customer_booking_rebooks r
    where r.tenant_id = p_tenant and r.new_booking_id = p_new_booking
  ) then
    return pg_catalog.jsonb_build_object('outcome', 'not_safe');
  end if;

  select b.* into v_old from public.bookings b
  where b.tenant_id = p_tenant and b.id = p_old_booking;
  select b.* into v_new from public.bookings b
  where b.tenant_id = p_tenant and b.id = p_new_booking;
  if v_old.id is null or v_new.id is null
     or v_old.status not in ('pending', 'confirmed')
     or v_new.status not in ('pending', 'confirmed')
     or v_new.customer_profile_id is distinct from p_customer_profile
     or not (
       v_old.customer_profile_id = p_customer_profile
       or (p_customer is not null and v_old.customer_id = p_customer)
     )
     or (p_customer is not null and (
       v_old.customer_id is distinct from p_customer
       or v_new.customer_id is distinct from p_customer
     ))
     or v_old.service_id is distinct from v_new.service_id
     or exists (
       select 1 from public.payments p
       where p.tenant_id = p_tenant and p.booking_id = p_new_booking
     ) then
    return pg_catalog.jsonb_build_object('outcome', 'not_safe');
  end if;

  update public.bookings b
  set status = 'cancelled', cancelled_at = statement_timestamp(), cancelled_by = 'customer'
  where b.tenant_id = p_tenant and b.id = p_new_booking
    and b.status in ('pending', 'confirmed');
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_safe');
  end if;
  return pg_catalog.jsonb_build_object('outcome', 'compensated');
end;
$$;
revoke all on function public.compensate_customer_booking_rebook(uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.compensate_customer_booking_rebook(uuid,uuid,uuid,uuid,uuid)
  to service_role;

create or replace function public.booking_payment_event_matches(
  p_tenant uuid,
  p_booking uuid,
  p_payment_intent text,
  p_connected_account text
) returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_effective_booking uuid := p_booking;
  v_rebook private.customer_booking_rebooks%rowtype;
  v_payment public.payments%rowtype;
  v_current_account text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_payment_intent !~ '^pi_[A-Za-z0-9_]{1,196}$'
     or p_connected_account !~ '^acct_[A-Za-z0-9_]{1,196}$' then
    return false;
  end if;
  select r.* into v_rebook from private.customer_booking_rebooks r
  where r.tenant_id = p_tenant and r.old_booking_id = p_booking;
  if found then
    if v_rebook.provider_payment_intent_id is distinct from p_payment_intent
       or v_rebook.provider_connected_account_id is distinct from p_connected_account then
      return false;
    end if;
    v_effective_booking := v_rebook.new_booking_id;
  end if;
  select p.* into v_payment from public.payments p
  where p.tenant_id = p_tenant and p.booking_id = v_effective_booking;
  if not found
     or (v_payment.stripe_payment_intent_id is not null
         and v_payment.stripe_payment_intent_id is distinct from p_payment_intent) then
    return false;
  end if;
  if v_payment.stripe_connected_account_id is not null then
    return v_payment.stripe_connected_account_id = p_connected_account;
  end if;
  select t.stripe_account_id into v_current_account from public.tenants t
  where t.id = p_tenant and t.stripe_charges_enabled;
  return v_current_account = p_connected_account;
end;
$$;
revoke all on function public.booking_payment_event_matches(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.booking_payment_event_matches(uuid,uuid,text,text)
  to service_role;

-- Keep payment settlement atomic when Stripe succeeds after cancellation.
drop function if exists public.confirm_booking_payment(uuid,uuid,text);
create or replace function public.confirm_booking_payment(
  p_booking uuid,
  p_tenant uuid,
  p_payment_intent text,
  p_connected_account text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_status text;
  v_effective_booking uuid := p_booking;
  v_payment_id uuid;
  v_payment_status text;
  v_refund_job_id uuid;
  v_payment public.payments%rowtype;
  v_rebook private.customer_booking_rebooks%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_connected_account !~ '^acct_[A-Za-z0-9_]{1,196}$'
     or p_payment_intent !~ '^pi_[A-Za-z0-9_]{1,196}$' then
    raise exception 'payment_provider_identity_invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text || ':booking-payment:' || p_booking::text, 0
  ));
  select r.* into v_rebook from private.customer_booking_rebooks r
  where r.tenant_id = p_tenant and r.old_booking_id = p_booking;
  if found then
    if v_rebook.provider_payment_intent_id is distinct from p_payment_intent
       or v_rebook.provider_connected_account_id is distinct from p_connected_account then
      raise exception 'payment_provider_identity_conflict' using errcode = '55000';
    end if;
    v_effective_booking := v_rebook.new_booking_id;
  end if;
  select b.status into v_booking_status
  from public.bookings b
  where b.id = v_effective_booking and b.tenant_id = p_tenant
  for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;

  select p.* into v_payment
  from public.payments p
  where p.booking_id = v_effective_booking and p.tenant_id = p_tenant
  for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  v_payment_id := v_payment.id;

  if v_payment.status = 'succeeded' and (
    v_payment.stripe_payment_intent_id is distinct from p_payment_intent
    or v_payment.stripe_connected_account_id is distinct from p_connected_account
  ) then
    raise exception 'payment_provider_identity_conflict' using errcode = '55000';
  elsif v_payment.status = 'refunded' then
    v_payment_status := 'refunded';
  elsif v_payment.status in ('pending', 'failed') then
    if (v_payment.stripe_payment_intent_id is not null
        and v_payment.stripe_payment_intent_id is distinct from p_payment_intent)
       or (v_payment.stripe_connected_account_id is not null
           and v_payment.stripe_connected_account_id is distinct from p_connected_account) then
      raise exception 'payment_provider_identity_conflict' using errcode = '55000';
    end if;
    update public.payments p
    set status = 'succeeded', stripe_payment_intent_id = p_payment_intent,
        stripe_connected_account_id = p_connected_account
    where p.id = v_payment.id and p.tenant_id = p_tenant;
    v_payment_status := 'succeeded';
  else
    v_payment_status := v_payment.status;
  end if;

  if v_payment_status = 'succeeded' and v_booking_status = 'pending' then
    update public.bookings b set status = 'confirmed'
    where b.id = v_effective_booking and b.tenant_id = p_tenant;
    v_booking_status := 'confirmed';
  elsif v_booking_status = 'cancelled' and v_payment_status = 'succeeded' then
    v_refund_job_id := private.enqueue_booking_payment_refund(
      p_tenant, v_effective_booking, v_payment_id
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'booking_status', v_booking_status,
    'payment_status', v_payment_status,
    'effective_booking_id', v_effective_booking,
    'refund_job_id', v_refund_job_id
  );
end;
$$;
revoke all on function public.confirm_booking_payment(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_booking_payment(uuid,uuid,text,text) to service_role;

create or replace function public.claim_payment_refund_jobs(
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer,
  p_limit integer
) returns table (
  id uuid, tenant_id uuid, payment_id uuid, booking_id uuid,
  payment_intent_id text, connected_account_id text,
  provider_idempotency_key text, attempt_count integer, lease_token uuid
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
  set status = 'review_required', review_required_at = p_now,
      lease_token = null, lease_expires_at = null,
      last_error_code = 'retry_limit_reached', updated_at = p_now
  where j.status = 'attempting' and j.lease_expires_at <= p_now
    and j.attempt_count >= j.max_attempts;

  return query
  with candidates as (
    select j.id
    from private.payment_refund_jobs j
    where j.available_at <= p_now
      and j.attempt_count < j.max_attempts
      and (j.status = 'queued' or (
        j.status = 'attempting' and j.lease_expires_at <= p_now
      ))
    order by j.available_at, j.created_at, j.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
  ), claimed as (
    update private.payment_refund_jobs j
    set status = 'attempting', attempt_count = j.attempt_count + 1,
        lease_token = p_lease_token,
        lease_expires_at = p_now + pg_catalog.make_interval(
          secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
        ),
        last_error_code = null, updated_at = p_now
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select c.id, c.tenant_id, c.payment_id, c.booking_id,
    c.provider_payment_intent_id, c.provider_connected_account_id,
    c.provider_idempotency_key, c.attempt_count, c.lease_token
  from claimed c
  ;
end;
$$;

create or replace function public.claim_payment_refund_job_by_id(
  p_id uuid,
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer
) returns table (
  id uuid, tenant_id uuid, payment_id uuid, booking_id uuid,
  payment_intent_id text, connected_account_id text,
  provider_idempotency_key text, attempt_count integer, lease_token uuid
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
  set status = 'review_required', review_required_at = p_now,
      lease_token = null, lease_expires_at = null,
      last_error_code = 'retry_limit_reached', updated_at = p_now
  where j.id = p_id and j.status = 'attempting'
    and j.lease_expires_at <= p_now and j.attempt_count >= j.max_attempts;

  return query
  with claimed as (
    update private.payment_refund_jobs j
    set status = 'attempting', attempt_count = j.attempt_count + 1,
        lease_token = p_lease_token,
        lease_expires_at = p_now + pg_catalog.make_interval(
          secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
        ),
        last_error_code = null, updated_at = p_now
    where j.id = p_id
      and j.available_at <= p_now
      and j.attempt_count < j.max_attempts
      and (j.status = 'queued' or (
        j.status = 'attempting' and j.lease_expires_at <= p_now
      ))
    returning j.*
  )
  select c.id, c.tenant_id, c.payment_id, c.booking_id,
    c.provider_payment_intent_id, c.provider_connected_account_id,
    c.provider_idempotency_key, c.attempt_count, c.lease_token
  from claimed c
  ;
end;
$$;

create or replace function public.begin_payment_refund_delivery(
  p_id uuid,
  p_lease_token uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  update private.payment_refund_jobs j
  set status = 'provider_started', provider_started_at = statement_timestamp(),
      lease_expires_at = null, updated_at = statement_timestamp()
  where j.id = p_id and j.status = 'attempting'
    and j.lease_token = p_lease_token
    and j.lease_expires_at > statement_timestamp();
  return found;
end;
$$;

create or replace function public.retry_payment_refund_job(
  p_id uuid,
  p_lease_token uuid,
  p_reason text,
  p_retry_at timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempts integer; v_max integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_reason not in ('provider_unavailable_before_request', 'database_unavailable_before_request') then
    return 'invalid';
  end if;
  select j.attempt_count, j.max_attempts into v_attempts, v_max
  from private.payment_refund_jobs j
  where j.id = p_id and j.status = 'attempting' and j.lease_token = p_lease_token
  for update;
  if not found then return 'stale'; end if;
  if v_attempts >= v_max then
    update private.payment_refund_jobs j
    set status = 'review_required', review_required_at = statement_timestamp(),
        lease_token = null, lease_expires_at = null,
        last_error_code = 'retry_limit_reached', updated_at = statement_timestamp()
    where j.id = p_id;
    return 'review_required';
  end if;
  update private.payment_refund_jobs j
  set status = 'queued', available_at = greatest(p_retry_at, statement_timestamp()),
      lease_token = null, lease_expires_at = null,
      last_error_code = p_reason, updated_at = statement_timestamp()
  where j.id = p_id;
  return 'queued';
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
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_provider_ref is null or p_provider_ref !~ '^[A-Za-z0-9._:-]{1,200}$' then return false; end if;
  -- Read immutable identity without a row lock, then acquire the shared global
  -- order used by the webhook: payment first, refund job second.
  select j.* into v_snapshot from private.payment_refund_jobs j
  where j.id = p_id;
  if not found then return false; end if;

  select p.* into v_payment from public.payments p
  where p.id = v_snapshot.payment_id and p.tenant_id = v_snapshot.tenant_id
    and p.booking_id = v_snapshot.booking_id
  for update;
  if not found then
    raise exception 'refund_payment_state_invalid' using errcode = '55000';
  end if;

  select j.* into v_job from private.payment_refund_jobs j
  where j.id = p_id
  for update;
  if not found then return false; end if;
  if v_job.payment_id is distinct from v_snapshot.payment_id
     or v_job.tenant_id is distinct from v_snapshot.tenant_id
     or v_job.booking_id is distinct from v_snapshot.booking_id then
    raise exception 'refund_job_identity_changed' using errcode = '55000';
  end if;
  if v_job.status = 'completed' then
    return v_payment.status = 'refunded';
  end if;
  if v_job.status <> 'provider_started'
     or v_job.lease_token is distinct from p_lease_token then
    return false;
  end if;
  if v_payment.status not in ('succeeded', 'refunded') then
    raise exception 'refund_payment_state_invalid' using errcode = '55000';
  end if;
  update public.payments p set status = 'refunded'
  where p.id = v_job.payment_id and p.tenant_id = v_job.tenant_id
    and p.booking_id = v_job.booking_id and p.status in ('succeeded', 'refunded');
  if not found then raise exception 'refund_payment_state_invalid' using errcode = '55000'; end if;
  update private.payment_refund_jobs j
  set status = 'completed', completed_at = statement_timestamp(),
      provider_ref = p_provider_ref, lease_token = null, lease_expires_at = null,
      last_error_code = null, updated_at = statement_timestamp()
  where j.id = v_job.id and j.status = 'provider_started'
    and j.lease_token = p_lease_token;
  return found;
end;
$$;

create or replace function private.guard_booking_refund_restoration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' and (
    exists (
      select 1 from private.payment_refund_jobs j
      where j.tenant_id = old.tenant_id and j.booking_id = old.id
    ) or exists (
      select 1 from private.customer_booking_rebooks r
      where r.tenant_id = old.tenant_id and r.old_booking_id = old.id
    )
  ) then
    raise exception 'booking_refund_pending_or_completed' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_refund_restoration()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_guard_booking_refund_restoration on public.bookings;
create trigger trg_guard_booking_refund_restoration
  before update of status on public.bookings
  for each row execute function private.guard_booking_refund_restoration();

create or replace function public.review_payment_refund_job(
  p_id uuid,
  p_lease_token uuid,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_reason not in ('provider_outcome_unknown', 'provider_rejected', 'refund_data_invalid') then
    return false;
  end if;
  update private.payment_refund_jobs j
  set status = 'review_required', review_required_at = statement_timestamp(),
      lease_token = null, lease_expires_at = null,
      last_error_code = p_reason, updated_at = statement_timestamp()
  where j.id = p_id and j.status in ('attempting', 'provider_started')
    and j.lease_token = p_lease_token;
  return found;
end;
$$;

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
declare v_payment public.payments%rowtype; v_job_id uuid;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_provider_ref is null or p_provider_ref !~ '^[A-Za-z0-9._:-]{1,200}$' then
    raise exception 'provider_ref_invalid' using errcode = '22023';
  end if;
  if p_connected_account !~ '^acct_[A-Za-z0-9_]{1,196}$' then
    raise exception 'connected_account_invalid' using errcode = '22023';
  end if;
  select p.* into v_payment from public.payments p
  where p.tenant_id = p_tenant and p.stripe_payment_intent_id = p_payment_intent
    and p.stripe_connected_account_id = p_connected_account
  for update;
  if not found then return pg_catalog.jsonb_build_object('outcome', 'not_found'); end if;
  update public.payments p
  set status = 'refunded'
  where p.id = v_payment.id and p.tenant_id = p_tenant;
  update private.payment_refund_jobs j
  set status = 'completed', completed_at = statement_timestamp(),
      provider_ref = p_provider_ref, lease_token = null, lease_expires_at = null,
      review_required_at = null, last_error_code = null, updated_at = statement_timestamp()
  where j.payment_id = v_payment.id and j.tenant_id = p_tenant
    and j.status <> 'completed'
  returning j.id into v_job_id;
  if v_job_id is null then
    select j.id into v_job_id from private.payment_refund_jobs j
    where j.payment_id = v_payment.id and j.tenant_id = p_tenant;
  end if;
  return pg_catalog.jsonb_build_object(
    'outcome', 'recorded', 'payment_id', v_payment.id, 'refund_job_id', v_job_id
  );
end;
$$;

create or replace function public.payment_refund_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  return (
    select pg_catalog.jsonb_build_object(
      'queued', count(*) filter (where j.status = 'queued'),
      'attempting', count(*) filter (where j.status = 'attempting'),
      'providerStarted', count(*) filter (where j.status = 'provider_started'),
      'reviewRequired', count(*) filter (where j.status = 'review_required'),
      'stuckProviderStarted', count(*) filter (
        where j.status = 'provider_started'
          and j.provider_started_at <= statement_timestamp() - interval '15 minutes'
      ),
      'overduePending', count(*) filter (
        where j.status in ('queued', 'attempting')
          and j.created_at <= statement_timestamp() - interval '60 minutes'
      )
    )
    from private.payment_refund_jobs j
  );
end;
$$;

revoke all on function public.claim_payment_refund_jobs(uuid,timestamptz,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_payment_refund_jobs(uuid,timestamptz,integer,integer)
  to service_role;
revoke all on function public.claim_payment_refund_job_by_id(uuid,uuid,timestamptz,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_payment_refund_job_by_id(uuid,uuid,timestamptz,integer)
  to service_role;
revoke all on function public.begin_payment_refund_delivery(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.begin_payment_refund_delivery(uuid,uuid) to service_role;
revoke all on function public.retry_payment_refund_job(uuid,uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.retry_payment_refund_job(uuid,uuid,text,timestamptz) to service_role;
revoke all on function public.complete_payment_refund_job(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_payment_refund_job(uuid,uuid,text) to service_role;
revoke all on function public.review_payment_refund_job(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.review_payment_refund_job(uuid,uuid,text) to service_role;
revoke all on function public.record_payment_refund_webhook(uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_payment_refund_webhook(uuid,text,text,text) to service_role;
revoke all on function public.payment_refund_health()
  from public, anon, authenticated, service_role;
grant execute on function public.payment_refund_health() to service_role;
