-- 0099 — Atomic, tenant-fenced customer erasure.
--
-- A customer erasure used to be a sequence of independent Data API writes. A
-- late failure could therefore leave a half-erased customer while the UI only
-- knew that "something failed". The transaction core below owns the complete
-- tenant/customer privacy boundary and appends its contact-free audit row last.
--
-- Retention boundary:
--   * bookings, loyalty_ledger, order/quote financial state and payments stay;
--     they are operational/accounting history and point only at an anonymized
--     customer stub after this transaction;
--   * direct contact/free-text, notification routing, consent, push keys,
--     claims, favourites and memberships are scrubbed/deleted;
--   * auth.users is an external Supabase Auth operation. Self-service first
--     commits containment (`gdpr_pending_auth_delete`) and a private cleanup
--     marker. The app may only claim full account erasure after Admin Auth
--     deletion succeeds. A failed Auth delete remains blocked and retryable by
--     operations without restoring tenant PII.

begin;

create table private.customer_erasure_auth_cleanup (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  customer_id uuid,
  auth_user_id uuid,
  state text not null check (state in ('pending', 'claimed', 'completed')),
  erase_status text not null check (erase_status in ('erased', 'already_erased')),
  erased_bookings integer not null default 0 check (erased_bookings >= 0),
  claim_token uuid,
  claim_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint customer_erasure_auth_cleanup_identity_check check (
    (
      state in ('pending', 'claimed')
      and tenant_id is not null
      and customer_id is not null
      and auth_user_id is not null
    ) or (
      state = 'completed'
      and tenant_id is null
      and customer_id is null
      and auth_user_id is null
    )
  ),
  constraint customer_erasure_auth_cleanup_claim_check check (
    (state = 'pending' and claim_token is null and claim_expires_at is null)
    or (state = 'claimed' and claim_token is not null and claim_expires_at is not null)
    or (state = 'completed' and claim_expires_at is null)
  )
);

create unique index customer_erasure_auth_cleanup_pending_auth_uniq
  on private.customer_erasure_auth_cleanup (auth_user_id)
  where auth_user_id is not null and state in ('pending', 'claimed');

revoke all on table private.customer_erasure_auth_cleanup
  from public, anon, authenticated, service_role;

-- Private transaction core. p_fail_after is deliberately unreachable through
-- the Data API wrapper and exists only so the SQL runtime test can prove that
-- every logical step rolls back as one PostgreSQL subtransaction.
create or replace function private.atomic_erase_tenant_customer_tx(
  p_tenant uuid,
  p_customer uuid,
  p_actor uuid,
  p_expected_auth_user uuid default null,
  p_require_only_auth_relation boolean default false,
  p_fail_after text default null
) returns table (
  status text,
  erased_bookings integer,
  auth_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_customer public.customers%rowtype;
  v_auth_user uuid;
  v_booking_ids uuid[] := array[]::uuid[];
  v_order_ids uuid[] := array[]::uuid[];
  v_order_item_ids uuid[] := array[]::uuid[];
  v_erased_bookings integer := 0;
  v_auth_relations integer := 0;
  v_was_anonymized boolean := false;
begin
  if p_tenant is null or p_customer is null or p_actor is null then
    raise exception 'gdpr_erase_invalid_input' using errcode = '22023';
  end if;
  if p_fail_after is not null and p_fail_after <> all(array[
    'outbox', 'ephemeral', 'bookings', 'commerce', 'customer', 'audit'
  ]) then
    raise exception 'gdpr_erase_invalid_failure_point' using errcode = '22023';
  end if;

  select c.* into v_customer
    from public.customers c
   where c.id = p_customer
     and c.tenant_id = p_tenant
   for update;
  if v_customer.id is null then
    raise exception 'gdpr_customer_not_found' using errcode = 'P0002';
  end if;

  v_auth_user := v_customer.auth_user_id;
  v_was_anonymized := v_customer.status = 'anonymized';

  if p_expected_auth_user is not null
     and v_auth_user is distinct from p_expected_auth_user then
    raise exception 'gdpr_auth_customer_mismatch' using errcode = '42501';
  end if;

  if p_require_only_auth_relation then
    if p_expected_auth_user is null then
      raise exception 'gdpr_expected_auth_required' using errcode = '22023';
    end if;

    -- Lock every exact auth binding before counting. No email/phone matching is
    -- allowed: global identity is a product decision, not an erasure heuristic.
    perform c.id
      from public.customers c
     where c.auth_user_id = p_expected_auth_user
     order by c.id
     for update;
    select pg_catalog.count(*)::integer into v_auth_relations
      from public.customers c
     where c.auth_user_id = p_expected_auth_user;

    if v_auth_relations <> 1 then
      raise exception 'global_identity_decision_required' using errcode = '42501';
    end if;
    if not exists (
      select 1
        from public.users u
        join public.roles r
          on r.id = u.role_id
         and r.tenant_id = u.tenant_id
         and r.level = 2
       where u.id = p_expected_auth_user
         and u.tenant_id = p_tenant
         and u.status = 'active'
    ) then
      raise exception 'global_identity_decision_required' using errcode = '42501';
    end if;
  end if;

  select coalesce(pg_catalog.array_agg(b.id order by b.id), array[]::uuid[])
    into v_booking_ids
    from public.bookings b
   where b.tenant_id = p_tenant
     and (
       b.customer_id = p_customer
       or (v_auth_user is not null and b.customer_profile_id = v_auth_user)
      );

  -- Freeze the exact tenant-scoped commerce graph before any parent snapshot is
  -- scrubbed. Child rows do not carry customer_id, so resolving them later from
  -- mutable parents would leave recipient PII behind under concurrent writes.
  perform o.id
    from public.shop_orders o
   where o.tenant_id = p_tenant
     and o.customer_id = p_customer
   order by o.id
   for update;
  select coalesce(pg_catalog.array_agg(o.id order by o.id), array[]::uuid[])
    into v_order_ids
    from public.shop_orders o
   where o.tenant_id = p_tenant
     and o.customer_id = p_customer;

  perform i.id
    from public.shop_order_items i
   where i.tenant_id = p_tenant
     and i.order_id = any(v_order_ids)
   order by i.id
   for update;
  select coalesce(pg_catalog.array_agg(i.id order by i.id), array[]::uuid[])
    into v_order_item_ids
    from public.shop_order_items i
   where i.tenant_id = p_tenant
     and i.order_id = any(v_order_ids);

  -- A claimed/started delivery is terminalised and loses its lease. A provider
  -- request already accepted outside PostgreSQL cannot be recalled, but no new
  -- retry or late CAS acknowledgement can use the erased payload.
  update public.notifications_outbox o
     set status = case
           when o.status in ('routing', 'queued', 'attempting', 'delivery_started') then 'skipped'
           else o.status
         end,
         skip_reason = case
           when o.status in ('routing', 'queued', 'attempting', 'delivery_started') then 'gdpr_erased'
           else o.skip_reason
         end,
         customer_id = null,
         booking_id = null,
         payload = '{}'::jsonb,
         consent_state = '{}'::jsonb,
         provider_ref = null,
         lease_token = null,
         lease_expires_at = null,
         last_error = null,
         updated_at = now()
   where o.tenant_id = p_tenant
     and (
       o.customer_id = p_customer
       or o.booking_id = any(v_booking_ids)
     );
  if p_fail_after = 'outbox' then
    raise exception 'gdpr_test_failure_outbox';
  end if;

  delete from public.customer_favorites f
   where f.tenant_id = p_tenant and f.customer_id = p_customer;
  delete from public.customer_notes n
   where n.tenant_id = p_tenant and n.customer_id = p_customer;
  delete from public.customer_notification_prefs p
   where p.tenant_id = p_tenant and p.customer_id = p_customer;
  delete from public.push_subscriptions s
   where s.tenant_id = p_tenant and s.customer_id = p_customer;
  delete from public.loyalty_members m
   where m.tenant_id = p_tenant and m.customer_id = p_customer;

  update private.customer_account_claims c
     set token_hash = null,
         customer_id = null,
         claimed_customer_id = null,
         used_by = null,
         used_at = coalesce(c.used_at, now()),
         scrubbed_at = now()
   where c.tenant_id = p_tenant
     and (c.customer_id = p_customer or c.claimed_customer_id = p_customer);
  if p_fail_after = 'ephemeral' then
    raise exception 'gdpr_test_failure_ephemeral';
  end if;

  update public.bookings b
     set note = null,
         customer_profile_id = null
   where b.tenant_id = p_tenant
     and (
       b.customer_id = p_customer
       or (v_auth_user is not null and b.customer_profile_id = v_auth_user)
     )
     and (b.note is not null or b.customer_profile_id is not null);
  get diagnostics v_erased_bookings = row_count;
  if p_fail_after = 'bookings' then
    raise exception 'gdpr_test_failure_bookings';
  end if;

  -- Preserve order/quote amounts, saldo, capacity and status, but remove every
  -- contact/free-text snapshot in the frozen order graph.
  update public.shop_order_items i
     set gift_recipient_name = null,
         gift_recipient_email = null,
         gift_message = null
   where i.tenant_id = p_tenant
     and i.id = any(v_order_item_ids);

  update public.gift_cards g
     set recipient_name = null,
         recipient_email = null,
         message = null
   where g.tenant_id = p_tenant
     and (
       g.order_id = any(v_order_ids)
       or g.order_item_id = any(v_order_item_ids)
       or g.id in (
         select i.gift_card_id
           from public.shop_order_items i
          where i.tenant_id = p_tenant
            and i.id = any(v_order_item_ids)
            and i.gift_card_id is not null
       )
     );

  update public.event_registrations r
     set name = 'Anonymiserad',
         email = null,
         phone = null,
         message = null
   where r.tenant_id = p_tenant
     and (
       r.order_item_id = any(v_order_item_ids)
       or r.id in (
         select i.event_registration_id
           from public.shop_order_items i
          where i.tenant_id = p_tenant
            and i.id = any(v_order_item_ids)
            and i.event_registration_id is not null
       )
     );

  update public.shop_orders o
     set customer_name = null,
         customer_email = null,
         customer_phone = null,
         ship_address = null,
         session_token = null,
         tracking_number = null,
         note = null
   where o.tenant_id = p_tenant and o.customer_id = p_customer;
  update public.offert_requests q
     set customer_name = null,
         customer_email = null,
         customer_phone = null,
         subject = null,
         message = null,
         reply_message = null,
         details = '{}'::jsonb,
         note = null
   where q.tenant_id = p_tenant and q.customer_id = p_customer;
  if p_fail_after = 'commerce' then
    raise exception 'gdpr_test_failure_commerce';
  end if;

  update public.customers c
     set auth_user_id = null,
         contact_hash = null,
         display_name = null,
         name_hidden = true,
         full_name = null,
         email = null,
         phone = null,
         status = 'anonymized',
         updated_at = now()
   where c.id = p_customer and c.tenant_id = p_tenant;

  if p_require_only_auth_relation then
    update public.users u
       set email = null,
           phone = null,
           status = 'gdpr_pending_auth_delete',
           updated_at = now()
     where u.id = p_expected_auth_user
       and u.tenant_id = p_tenant;
    if not found then
      raise exception 'gdpr_public_profile_containment_failed' using errcode = '40001';
    end if;

    insert into private.customer_erasure_auth_cleanup (
      tenant_id, customer_id, auth_user_id, state, erase_status,
      erased_bookings, last_error_code, updated_at
    ) values (
      p_tenant, p_customer, p_expected_auth_user, 'pending',
      case when v_was_anonymized then 'already_erased' else 'erased' end,
      v_erased_bookings, null, now()
    )
    on conflict (auth_user_id)
      where auth_user_id is not null and state in ('pending', 'claimed')
    do update set
      tenant_id = excluded.tenant_id,
      customer_id = excluded.customer_id,
      state = 'pending',
      erase_status = excluded.erase_status,
      erased_bookings = excluded.erased_bookings,
      claim_token = null,
      claim_expires_at = null,
      last_error_code = null,
      updated_at = now();
  end if;
  if p_fail_after = 'customer' then
    raise exception 'gdpr_test_failure_customer';
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    p_actor,
    case when v_was_anonymized then 'gdpr.tenant_erase_reconciled' else 'gdpr.tenant_erase' end,
    'customer',
    p_customer,
    pg_catalog.jsonb_build_object(
      'erased_bookings', v_erased_bookings,
      'auth_cleanup_pending', p_require_only_auth_relation
    )
  );
  if p_fail_after = 'audit' then
    raise exception 'gdpr_test_failure_audit';
  end if;

  status := case when v_was_anonymized then 'already_erased' else 'erased' end;
  erased_bookings := v_erased_bookings;
  auth_user_id := v_auth_user;
  return next;
end;
$$;

revoke all on function private.atomic_erase_tenant_customer_tx(
  uuid, uuid, uuid, uuid, boolean, text
) from public, anon, authenticated, service_role;

-- Owner/admin adapter. Authorization to initiate the operation is checked by
-- the server action; this privileged DB surface is callable only with the
-- backend service role and independently enforces the exact tenant/customer.
create or replace function public.atomic_erase_tenant_customer(
  p_tenant uuid,
  p_customer uuid,
  p_actor uuid
) returns table (
  status text,
  erased_bookings integer,
  auth_user_id uuid
)
language sql
security definer
set search_path = ''
as $$
  select *
    from private.atomic_erase_tenant_customer_tx(
      p_tenant, p_customer, p_actor, null, false, null
    )
$$;

-- Self-service adapter. The global-identity case deliberately fails before any
-- mutation if the Auth identity is linked to anything other than this one exact
-- tenant customer. That decision must not be made by fuzzy email/phone matching.
create or replace function public.atomic_erase_self_customer_account(
  p_tenant uuid,
  p_auth_user uuid
) returns table (
  status text,
  erased_bookings integer,
  auth_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
  v_cleanup private.customer_erasure_auth_cleanup%rowtype;
begin
  -- A retry after a committed phase one (including a lost HTTP response) must
  -- resume the exact durable cleanup identity, never try to rediscover it from
  -- the now-anonymized customer row.
  select c.* into v_cleanup
    from private.customer_erasure_auth_cleanup c
   where c.tenant_id = p_tenant
     and c.auth_user_id = p_auth_user
     and c.state in ('pending', 'claimed')
   for update;
  if v_cleanup.id is not null then
    return query select
      v_cleanup.erase_status,
      v_cleanup.erased_bookings,
      v_cleanup.auth_user_id;
    return;
  end if;

  select c.id into v_customer
    from public.customers c
   where c.tenant_id = p_tenant
     and c.auth_user_id = p_auth_user
   order by c.created_at, c.id
   limit 1;
  if v_customer is null then
    raise exception 'gdpr_customer_not_found' using errcode = 'P0002';
  end if;

  return query
  select *
    from private.atomic_erase_tenant_customer_tx(
      p_tenant, v_customer, p_auth_user, p_auth_user, true, null
    );
end;
$$;

-- Auth deletion is outside PostgreSQL. A service worker must own the exact
-- cleanup row under a short lease before calling the provider. The token makes
-- failure/ack compare-and-set operations safe across retries and lost replies.
create or replace function public.claim_customer_erasure_auth_cleanup(
  p_auth_user uuid,
  p_claim_token uuid,
  p_lease_seconds integer default 300
) returns table (
  cleanup_id uuid,
  tenant_id uuid,
  customer_id uuid,
  auth_user_id uuid,
  erase_status text,
  erased_bookings integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleanup private.customer_erasure_auth_cleanup%rowtype;
  v_lease_seconds integer;
begin
  if p_auth_user is null or p_claim_token is null then
    raise exception 'gdpr_cleanup_invalid_claim' using errcode = '22023';
  end if;
  v_lease_seconds := greatest(30, least(coalesce(p_lease_seconds, 300), 900));

  select c.* into v_cleanup
    from private.customer_erasure_auth_cleanup c
   where c.auth_user_id = p_auth_user
     and c.state in ('pending', 'claimed')
   for update;

  if v_cleanup.id is null then
    return;
  end if;
  if v_cleanup.state = 'claimed'
     and v_cleanup.claim_token is distinct from p_claim_token
     and v_cleanup.claim_expires_at > now() then
    return;
  end if;

  update private.customer_erasure_auth_cleanup c
     set state = 'claimed',
         claim_token = p_claim_token,
         claim_expires_at = now() + pg_catalog.make_interval(secs => v_lease_seconds),
         attempt_count = c.attempt_count + case
           when c.claim_token = p_claim_token then 0 else 1
         end,
         last_error_code = null,
         updated_at = now()
   where c.id = v_cleanup.id
  returning c.id, c.tenant_id, c.customer_id, c.auth_user_id,
            c.erase_status, c.erased_bookings
       into cleanup_id, tenant_id, customer_id, auth_user_id,
            erase_status, erased_bookings;
  return next;
end;
$$;

create or replace function public.fail_customer_erasure_auth_cleanup(
  p_cleanup_id uuid,
  p_auth_user uuid,
  p_claim_token uuid,
  p_error_code text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleanup private.customer_erasure_auth_cleanup%rowtype;
begin
  select c.* into v_cleanup
    from private.customer_erasure_auth_cleanup c
   where c.id = p_cleanup_id
     and c.auth_user_id = p_auth_user
     and c.claim_token = p_claim_token
     and c.state = 'claimed'
   for update;

  if v_cleanup.id is null then
    return false;
  end if;

  update private.customer_erasure_auth_cleanup c
     set state = 'pending',
         claim_token = null,
         claim_expires_at = null,
         last_error_code = case
           when p_error_code in (
             'auth_delete_failed', 'auth_provider_unavailable', 'auth_delete_uncertain',
             'cleanup_identity_mismatch'
           ) then p_error_code
           else 'auth_delete_failed'
         end,
         updated_at = now()
   where c.id = v_cleanup.id;

  update public.users u
     set email = null,
         phone = null,
         status = 'gdpr_pending_auth_delete',
         updated_at = now()
   where u.id = p_auth_user
     and u.tenant_id = v_cleanup.tenant_id;
  return true;
end;
$$;

create or replace function public.ack_customer_erasure_auth_cleanup(
  p_cleanup_id uuid,
  p_auth_user uuid,
  p_claim_token uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleanup private.customer_erasure_auth_cleanup%rowtype;
begin
  select c.* into v_cleanup
    from private.customer_erasure_auth_cleanup c
   where c.id = p_cleanup_id
   for update;

  -- Lost acknowledgement response: the same private capability may confirm the
  -- already-minimized row again without retaining the Auth/customer identity.
  if v_cleanup.state = 'completed' then
    return v_cleanup.claim_token = p_claim_token;
  end if;
  if v_cleanup.id is null
     or v_cleanup.state <> 'claimed'
     or v_cleanup.auth_user_id is distinct from p_auth_user
     or v_cleanup.claim_token is distinct from p_claim_token then
    return false;
  end if;

  update private.customer_erasure_auth_cleanup c
     set state = 'completed',
         tenant_id = null,
         customer_id = null,
         auth_user_id = null,
         last_error_code = null,
         claim_expires_at = null,
         updated_at = now(),
         completed_at = now()
   where c.id = v_cleanup.id;
  return true;
end;
$$;

-- Supabase documents that deleting/banning an Auth user cannot revoke an
-- already-issued access JWT. This trigger is therefore the database backstop:
-- every authenticated booking insert must still have one active, role-backed
-- profile in the booking tenant. A service-role storefront request has no
-- auth.uid() and remains available for ordinary public guest booking.
create or replace function private.reject_contained_profile_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user uuid := auth.uid();
  v_role_level integer;
begin
  if v_auth_user is null or private.is_platform_admin() then
    return new;
  end if;

  select r.level into v_role_level
    from public.users u
    join public.roles r
      on r.id = u.role_id
     and r.tenant_id = u.tenant_id
   where u.id = v_auth_user
     and u.tenant_id = new.tenant_id
     and u.status = 'active';

  if v_role_level between 3 and 6 then
    return new;
  end if;
  if v_role_level = 2
     and new.customer_profile_id = v_auth_user
     and exists (
       select 1
         from public.customers c
        where c.id = new.customer_id
          and c.tenant_id = new.tenant_id
          and c.auth_user_id = v_auth_user
          and c.status = 'active'
     ) then
    return new;
  end if;

  raise exception 'contained_profile_cannot_create_booking' using errcode = '42501';
end;
$$;

revoke all on function private.reject_contained_profile_booking()
  from public, anon, authenticated, service_role;

drop trigger if exists reject_contained_profile_booking on public.bookings;
create trigger reject_contained_profile_booking
  before insert on public.bookings
  for each row execute function private.reject_contained_profile_booking();

-- Auth-definer audit at this migration boundary:
--   * customer rebook calls create_public_booking -> bookings trigger above;
--   * claim_customer_account accepts only active/pending_claim profiles, so a
--     gdpr_pending_auth_delete profile fails before customer mutation;
--   * join_loyalty_club is service_role-only since 0085, preserving public
--     storefront intake without exposing a stale authenticated JWT writer.

revoke all on function public.atomic_erase_tenant_customer(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.atomic_erase_tenant_customer(uuid, uuid, uuid)
  to service_role;

revoke all on function public.atomic_erase_self_customer_account(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.atomic_erase_self_customer_account(uuid, uuid)
  to service_role;

revoke all on function public.claim_customer_erasure_auth_cleanup(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_customer_erasure_auth_cleanup(uuid, uuid, integer)
  to service_role;

revoke all on function public.fail_customer_erasure_auth_cleanup(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.fail_customer_erasure_auth_cleanup(uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.ack_customer_erasure_auth_cleanup(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ack_customer_erasure_auth_cleanup(uuid, uuid, uuid)
  to service_role;

comment on function public.atomic_erase_tenant_customer(uuid, uuid, uuid) is
  'Service-only, tenant/customer-exact atomic GDPR anonymization. Retains financial/operational history without direct customer PII.';
comment on table private.customer_erasure_auth_cleanup is
  'Service-only durable external-Auth cleanup queue. Active rows retain exact tenant/customer/Auth UUIDs only until ack; completed rows clear every identifier and retain only the private idempotency token/result.';

commit;
