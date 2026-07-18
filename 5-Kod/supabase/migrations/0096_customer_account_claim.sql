-- 0096 — Secure guest-customer -> authenticated-account claim.
-- Raw bearer tokens never enter Postgres. The app stores only SHA-256 digests in
-- the private schema; the authenticated claim is tenant-bound, expiring,
-- single-use and performs every relationship move in the caller's transaction.

begin;

create table private.customer_account_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid,
  claimed_customer_id uuid,
  token_hash text,
  purpose text not null check (purpose in ('customer_account')),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  scrubbed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_account_claim_token_hash_check
    check (token_hash is null or token_hash ~ '^[a-f0-9]{64}$'),
  constraint customer_account_claim_customer_tenant_fkey
    foreign key (customer_id, tenant_id)
    references public.customers (id, tenant_id),
  constraint customer_account_claim_claimed_tenant_fkey
    foreign key (claimed_customer_id, tenant_id)
    references public.customers (id, tenant_id)
);

create unique index customer_account_claim_token_hash_uniq
  on private.customer_account_claims (token_hash)
  where token_hash is not null;
create index customer_account_claim_customer_idx
  on private.customer_account_claims (tenant_id, customer_id, purpose, expires_at desc);

-- Transaction-scoped capabilities. No caller can write these tables; only the
-- SECURITY DEFINER claim RPC can mint the exact row consumed by the two guards.
create table private.customer_claim_merge_intents (
  txid bigint primary key,
  tenant_id uuid not null,
  canonical_customer_id uuid not null,
  duplicate_customer_id uuid not null,
  auth_user_id uuid not null,
  created_at timestamptz not null default clock_timestamp()
);

revoke all on table private.customer_account_claims from public, anon, authenticated, service_role;
revoke all on table private.customer_claim_merge_intents from public, anon, authenticated, service_role;

-- Preserve the immutable auth-binding invariant while allowing one exact,
-- authenticated, tenant-checked null -> auth.uid binding inside this transaction.
create or replace function private.protect_customer_auth_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.tenant_id is distinct from new.tenant_id then
    raise exception 'customer_tenant_immutable' using errcode = '42501';
  end if;

  if old.auth_user_id is distinct from new.auth_user_id
     and coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not ((select auth.uid()) is null and session_user in ('postgres', 'supabase_admin'))
     and not exists (
       select 1
         from private.customer_claim_merge_intents i
        where i.txid = pg_catalog.txid_current()
          and i.tenant_id = new.tenant_id
          and i.canonical_customer_id = new.id
          and i.auth_user_id = new.auth_user_id
          and old.auth_user_id is null
          and new.auth_user_id = (select auth.uid())
     ) then
    raise exception 'customer_auth_binding_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_customer_auth_binding()
  from public, anon, authenticated, service_role;

-- Loyalty is append-only for every normal caller. During a verified merge only
-- customer_id may change, and only for the exact duplicate/canonical pair in the
-- transaction intent. This avoids globally disabling any trigger.
create or replace function private.protect_loyalty_customer_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from private.customer_claim_merge_intents i
     where i.txid = pg_catalog.txid_current()
       and i.tenant_id = old.tenant_id
       and i.duplicate_customer_id = old.customer_id
       and i.canonical_customer_id = new.customer_id
  )
  and old.id = new.id
  and old.tenant_id = new.tenant_id
  and old.booking_id is not distinct from new.booking_id
  and old.points_delta = new.points_delta
  and old.reason = new.reason
  and old.note is not distinct from new.note
  and old.created_at = new.created_at then
    return new;
  end if;
  raise exception 'append_only' using errcode = '42501';
end;
$$;
revoke all on function private.protect_loyalty_customer_merge()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_loyalty_no_update on public.loyalty_ledger;
create trigger trg_loyalty_no_update
  before update on public.loyalty_ledger
  for each row execute function private.protect_loyalty_customer_merge();

-- Service-only producer: invalidates older outstanding links for the same
-- customer/purpose and records only the digest. Expiry is tightly bounded.
create or replace function public.create_customer_account_claim(
  p_tenant uuid,
  p_customer uuid,
  p_token_hash text,
  p_purpose text,
  p_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_purpose <> 'customer_account'
     or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_expires_at <= now() + interval '5 minutes'
     or p_expires_at > now() + interval '7 days' then
    raise exception 'customer_claim_invalid_input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.customers c
     where c.id = p_customer and c.tenant_id = p_tenant and c.status = 'active'
  ) then
    raise exception 'customer_claim_customer_not_found' using errcode = 'P0002';
  end if;

  update private.customer_account_claims
     set token_hash = null,
         used_at = coalesce(used_at, now())
   where tenant_id = p_tenant
     and customer_id = p_customer
     and purpose = p_purpose
     and used_at is null;

  insert into private.customer_account_claims (
    tenant_id, customer_id, token_hash, purpose, expires_at
  ) values (
    p_tenant, p_customer, p_token_hash, p_purpose, p_expires_at
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Server-side signup preflight. It reveals no identity/PII and is deliberately
-- unavailable to anon/authenticated Data API roles.
create or replace function public.inspect_customer_account_claim(
  p_tenant uuid,
  p_token_hash text,
  p_purpose text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.customer_account_claims cc
      join public.customers c
        on c.id = cc.customer_id
       and c.tenant_id = cc.tenant_id
       and c.status = 'active'
     where cc.tenant_id = p_tenant
       and cc.token_hash = p_token_hash
       and cc.purpose = p_purpose
       and cc.used_at is null
       and cc.expires_at > now()
  )
$$;

-- Service-only recovery probe for an ambiguous network response. A 256-bit
-- bearer digest is safe to retain until GDPR/retention scrub; `used_at` remains
-- the single-use latch. Reconciliation succeeds only when the same digest was
-- consumed by the same auth user and the atomic claim transaction also left an
-- active tenant customer profile plus the bound customer card.
create or replace function public.reconcile_customer_account_claim(
  p_tenant uuid,
  p_token_hash text,
  p_auth_user uuid,
  p_purpose text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.customer_account_claims cc
      join public.customers c
        on c.id = cc.claimed_customer_id
       and c.tenant_id = cc.tenant_id
       and c.auth_user_id = p_auth_user
       and c.status = 'active'
      join public.users u
        on u.id = p_auth_user
       and u.tenant_id = cc.tenant_id
       and u.status = 'active'
      join public.roles r
        on r.id = u.role_id
       and r.tenant_id = u.tenant_id
       and r.level = 2
     where cc.tenant_id = p_tenant
       and cc.token_hash = p_token_hash
       and cc.purpose = p_purpose
       and cc.used_at is not null
       and cc.used_by = p_auth_user
  )
$$;

-- Authenticated consumer. The row lock serializes competing consumers: the
-- winner sets used_at/used_by; every waiter then fails closed. The digest stays
-- only to reconcile a lost response and is removed by GDPR/retention scrubbing.
create or replace function public.claim_customer_account(
  p_tenant uuid,
  p_token_hash text,
  p_purpose text
) returns table (status text, customer_id uuid, merged boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_profile public.users%rowtype;
  v_claim private.customer_account_claims%rowtype;
  v_target public.customers%rowtype;
  v_canonical public.customers%rowtype;
  v_duplicate_member public.loyalty_members%rowtype;
  v_canonical_member public.loyalty_members%rowtype;
  v_merge boolean := false;
begin
  if v_uid is null then
    raise exception 'customer_claim_authentication_required' using errcode = '42501';
  end if;
  -- `private.tenant_id()` avvisar medvetet alla profiler som inte ar `active`.
  -- Den far darfor inte anvandas i just denna overgangs-RPC: ett sakert
  -- `pending_claim`-konto skulle annars aldrig kunna aktiveras. Den lasta
  -- public.users-raden nedan ar auktoriteten och verifierar uid + tenant + roll
  -- + det uttryckligen tillatna overgangsstatuset i samma transaktion.
  if p_tenant is null then
    raise exception 'customer_claim_tenant_mismatch' using errcode = '42501';
  end if;
  if p_purpose <> 'customer_account' or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'customer_claim_invalid' using errcode = '22023';
  end if;
  -- Lock the exact account shell before touching the token. `pending_claim` is
  -- deliberately distinct from normal `inactive`: only a signup shell minted
  -- for this flow may cross the activation boundary. The normal role helper
  -- still returns level 0 until this transaction commits.
  select u.* into v_profile
    from public.users u
    join public.roles r
      on r.id = u.role_id
     and r.tenant_id = u.tenant_id
     and r.level = 2
   where u.id = v_uid
     and u.tenant_id = p_tenant
     and u.status in ('active', 'pending_claim')
   for update of u;
  if (select private.is_platform_admin()) or v_profile.id is null then
    raise exception 'customer_claim_account_tenant_mismatch' using errcode = '42501';
  end if;

  select cc.* into v_claim
    from private.customer_account_claims cc
   where cc.tenant_id = p_tenant
     and cc.token_hash = p_token_hash
     and cc.purpose = p_purpose
   for update;

  if v_claim.id is null
     or v_claim.used_at is not null
     or v_claim.expires_at <= now()
     or v_claim.customer_id is null then
    raise exception 'customer_claim_invalid_or_expired' using errcode = 'P0002';
  end if;

  select c.* into v_target
    from public.customers c
   where c.id = v_claim.customer_id
     and c.tenant_id = p_tenant
     and c.status = 'active'
   for update;
  if v_target.id is null then
    raise exception 'customer_claim_invalid_or_expired' using errcode = 'P0002';
  end if;
  if v_target.auth_user_id is not null and v_target.auth_user_id <> v_uid then
    raise exception 'customer_claim_already_bound' using errcode = '42501';
  end if;

  select c.* into v_canonical
    from public.customers c
   where c.tenant_id = p_tenant
     and c.auth_user_id = v_uid
     and c.status = 'active'
   order by c.created_at, c.id
   limit 1
   for update;

  if v_canonical.id is null then
    v_canonical := v_target;
    insert into private.customer_claim_merge_intents (
      txid, tenant_id, canonical_customer_id, duplicate_customer_id, auth_user_id
    ) values (
      pg_catalog.txid_current(), p_tenant, v_target.id, v_target.id, v_uid
    );
    update public.customers
       set auth_user_id = v_uid,
           updated_at = now()
     where id = v_target.id and tenant_id = p_tenant and auth_user_id is null;
    if not found and v_target.auth_user_id is null then
      raise exception 'customer_claim_binding_race' using errcode = '40001';
    end if;
    v_canonical.auth_user_id := v_uid;
  elsif v_canonical.id <> v_target.id then
    v_merge := true;
    insert into private.customer_claim_merge_intents (
      txid, tenant_id, canonical_customer_id, duplicate_customer_id, auth_user_id
    ) values (
      pg_catalog.txid_current(), p_tenant, v_canonical.id, v_target.id, v_uid
    );

    update private.customer_account_claims cc
       set customer_id = null,
           used_at = now(),
           used_by = v_uid,
           claimed_customer_id = v_canonical.id
     where cc.id = v_claim.id
       and cc.used_at is null
       and cc.token_hash = p_token_hash;
    if not found then
      raise exception 'customer_claim_already_used' using errcode = '40001';
    end if;

    update public.bookings b
       set customer_id = v_canonical.id
     where b.tenant_id = p_tenant and b.customer_id = v_target.id;

    insert into public.customer_favorites (
      tenant_id, customer_id, kind, staff_id, service_id, created_at
    )
    select tenant_id, v_canonical.id, kind, staff_id, service_id, created_at
      from public.customer_favorites
     where tenant_id = p_tenant and customer_id = v_target.id
    on conflict do nothing;
    delete from public.customer_favorites f
     where f.tenant_id = p_tenant and f.customer_id = v_target.id;

    -- The replacement trigger permits this exact customer-id-only rewrite.
    update public.loyalty_ledger ll
       set customer_id = v_canonical.id
     where ll.tenant_id = p_tenant and ll.customer_id = v_target.id;

    insert into public.customer_notes (
      tenant_id, customer_id, preferences, allergies, products,
      hair_type, hair_length, sensitivity, internal_note,
      created_by, created_at, updated_at, location_id
    )
    select tenant_id, v_canonical.id, preferences, allergies, products,
           hair_type, hair_length, sensitivity, internal_note,
           created_by, created_at, updated_at, location_id
      from public.customer_notes
     where tenant_id = p_tenant and customer_id = v_target.id
    on conflict (tenant_id, customer_id) do update set
      -- Två olika platsursprung gör den sammanslagna noten tvetydig. NULL är
      -- den etablerade 0076-semantiken för owner-only och hindrar att en intern
      -- not från plats B blir läsbar för personal på plats A.
      location_id = case
        when public.customer_notes.location_id is not distinct from excluded.location_id
          then public.customer_notes.location_id
        else null
      end,
      preferences = array(
        select distinct item
          from unnest(public.customer_notes.preferences || excluded.preferences) as merged(item)
         order by item
      ),
      allergies = array(
        select distinct item
          from unnest(public.customer_notes.allergies || excluded.allergies) as merged(item)
         order by item
      ),
      products = array(
        select distinct item
          from unnest(public.customer_notes.products || excluded.products) as merged(item)
         order by item
      ),
      hair_type = coalesce(public.customer_notes.hair_type, excluded.hair_type),
      hair_length = coalesce(public.customer_notes.hair_length, excluded.hair_length),
      sensitivity = coalesce(public.customer_notes.sensitivity, excluded.sensitivity),
      internal_note = nullif(concat_ws(E'\n\n',
        nullif(public.customer_notes.internal_note, ''),
        nullif(excluded.internal_note, '')
      ), ''),
      updated_at = now();
    delete from public.customer_notes cn
     where cn.tenant_id = p_tenant and cn.customer_id = v_target.id;

    -- Authenticated account preferences win on conflict. Guest prefs move only
    -- when the canonical account has no row, so consent is never broadened.
    insert into public.customer_notification_prefs (
      customer_id, tenant_id, push_enabled, email_enabled, sms_enabled,
      preferred_channel, marketing_consent, marketing_consent_at,
      marketing_consent_source, want_reminders, want_offers, want_open_slots,
      want_recommendations, created_at, updated_at
    )
    select v_canonical.id, tenant_id, push_enabled, email_enabled, sms_enabled,
           preferred_channel, marketing_consent, marketing_consent_at,
           marketing_consent_source, want_reminders, want_offers, want_open_slots,
           want_recommendations, created_at, updated_at
      from public.customer_notification_prefs
     where tenant_id = p_tenant and customer_id = v_target.id
    on conflict (customer_id) do nothing;
    delete from public.customer_notification_prefs np
     where np.tenant_id = p_tenant and np.customer_id = v_target.id;

    update public.push_subscriptions ps
       set customer_id = v_canonical.id
     where ps.tenant_id = p_tenant and ps.customer_id = v_target.id;
    update public.notifications_outbox nox
       set customer_id = v_canonical.id
     where nox.tenant_id = p_tenant and nox.customer_id = v_target.id;

    -- Commerce/quote history follows the durable customer card. These tables
    -- have no per-customer uniqueness constraint, so every same-tenant row can
    -- be moved losslessly.
    update public.shop_orders so
       set customer_id = v_canonical.id
     where so.tenant_id = p_tenant and so.customer_id = v_target.id;
    update public.offert_requests oq
       set customer_id = v_canonical.id
     where oq.tenant_id = p_tenant and oq.customer_id = v_target.id;

    -- A membership row contains the selected tier, while all earned/redeemed
    -- point history lives in loyalty_ledger and was moved above. Move a lone
    -- source membership. If both cards are members, merge only compatible
    -- tiers deterministically; conflicting paid tiers fail the whole claim so
    -- no balance, history or customer relation can be silently lost.
    select lm.* into v_canonical_member
      from public.loyalty_members lm
     where lm.tenant_id = p_tenant and lm.customer_id = v_canonical.id
     for update;
    select lm.* into v_duplicate_member
      from public.loyalty_members lm
     where lm.tenant_id = p_tenant and lm.customer_id = v_target.id
     for update;

    if v_duplicate_member.id is not null then
      if v_canonical_member.id is null then
        update public.loyalty_members lm
           set customer_id = v_canonical.id
         where lm.id = v_duplicate_member.id and lm.tenant_id = p_tenant;
      else
        if v_canonical_member.plan_id is not null
           and v_duplicate_member.plan_id is not null
           and v_canonical_member.plan_id is distinct from v_duplicate_member.plan_id then
          raise exception 'customer_claim_loyalty_membership_conflict'
            using errcode = 'P0001';
        end if;

        update public.loyalty_members lm
           set plan_id = coalesce(v_canonical_member.plan_id, v_duplicate_member.plan_id),
               status = case
                 when v_canonical_member.status = 'active'
                   or v_duplicate_member.status = 'active' then 'active'
                 else 'cancelled'
               end,
               joined_at = least(v_canonical_member.joined_at, v_duplicate_member.joined_at)
         where lm.id = v_canonical_member.id and lm.tenant_id = p_tenant;
        delete from public.loyalty_members lm
         where lm.id = v_duplicate_member.id and lm.tenant_id = p_tenant;
      end if;
    end if;

    update private.customer_account_claims cc
       set claimed_customer_id = v_canonical.id
     where cc.tenant_id = p_tenant and cc.claimed_customer_id = v_target.id;

    update public.customers
       set full_name = coalesce(full_name, v_target.full_name),
           email = coalesce(email, v_target.email),
           phone = coalesce(phone, v_target.phone),
           display_name = coalesce(display_name, v_target.display_name),
           name_hidden = name_hidden or v_target.name_hidden,
           self_book = self_book and v_target.self_book,
           hidden_at = coalesce(hidden_at, v_target.hidden_at),
           first_seen_at = least(first_seen_at, v_target.first_seen_at),
           last_seen_at = greatest(last_seen_at, v_target.last_seen_at),
           updated_at = now()
     where id = v_canonical.id and tenant_id = p_tenant;

    update public.customers
       set auth_user_id = null,
           contact_hash = null,
           display_name = null,
           full_name = null,
           email = null,
           phone = null,
           status = 'anonymized',
           updated_at = now()
     where id = v_target.id and tenant_id = p_tenant;
  end if;

  if not v_merge then
    update private.customer_account_claims cc
       set used_at = now(),
           used_by = v_uid,
           claimed_customer_id = v_canonical.id
     where cc.id = v_claim.id
       and cc.used_at is null
       and cc.token_hash = p_token_hash;
    if not found then
      raise exception 'customer_claim_already_used' using errcode = '40001';
    end if;
  end if;

  -- Any other outstanding link for the merged duplicate is invalid after the
  -- identity move. Never let an old message rebind an anonymized stub.
  if v_merge then
    update private.customer_account_claims cc
       set token_hash = null,
           used_at = coalesce(used_at, now()),
           used_by = coalesce(used_by, v_uid),
           claimed_customer_id = v_canonical.id
     where cc.tenant_id = p_tenant
       and cc.customer_id = v_target.id
       and cc.id <> v_claim.id;
  end if;

  delete from private.customer_claim_merge_intents
   where txid = pg_catalog.txid_current();

  -- This is the sole provisional -> active transition. It commits atomically
  -- with token consumption and customer binding/merge above. A crash before the
  -- RPC leaves a level-0 shell; a crash after commit leaves a genuinely claimed
  -- active customer. Ordinary inactive accounts are never eligible.
  if v_profile.status = 'pending_claim' then
    update public.users u
       set status = 'active',
           updated_at = now()
     where u.id = v_uid
       and u.tenant_id = p_tenant
       and u.role_id = v_profile.role_id
       and u.status = 'pending_claim';
    if not found then
      raise exception 'customer_claim_profile_activation_race' using errcode = '40001';
    end if;
  end if;

  status := 'claimed';
  customer_id := v_canonical.id;
  merged := v_merge;
  return next;
end;
$$;

-- Explicit erasure helper plus a DB backstop: every status->anonymized event
-- scrubs source and merged claim references even if an app caller forgets.
create or replace function public.scrub_customer_account_claims(
  p_customer_ids uuid[]
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update private.customer_account_claims
     set token_hash = null,
         customer_id = null,
         claimed_customer_id = null,
         used_by = null,
         used_at = coalesce(used_at, now()),
         scrubbed_at = now()
   where customer_id = any(coalesce(p_customer_ids, array[]::uuid[]))
      or claimed_customer_id = any(coalesce(p_customer_ids, array[]::uuid[]));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.scrub_customer_claims_on_anonymize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.scrub_customer_account_claims(array[new.id]);
  return new;
end;
$$;
revoke all on function private.scrub_customer_claims_on_anonymize()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_customers_anonymize_scrub_claims on public.customers;
create trigger trg_customers_anonymize_scrub_claims
  after update of status on public.customers
  for each row
  when (new.status = 'anonymized' and old.status is distinct from 'anonymized')
  execute function private.scrub_customer_claims_on_anonymize();

revoke all on function public.create_customer_account_claim(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.create_customer_account_claim(
  uuid, uuid, text, text, timestamptz
) to service_role;

revoke all on function public.inspect_customer_account_claim(
  uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.inspect_customer_account_claim(
  uuid, text, text
) to service_role;

revoke all on function public.reconcile_customer_account_claim(
  uuid, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_customer_account_claim(
  uuid, text, uuid, text
) to service_role;

revoke all on function public.claim_customer_account(
  uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.claim_customer_account(
  uuid, text, text
) to authenticated;

revoke all on function public.scrub_customer_account_claims(
  uuid[]
) from public, anon, authenticated, service_role;
grant execute on function public.scrub_customer_account_claims(
  uuid[]
) to service_role;

comment on table private.customer_account_claims is
  'Hashed, expiring, single-use customer account claim records; never stores bearer plaintext.';
comment on function public.claim_customer_account(uuid, text, text) is
  'Intentional authenticated SECURITY DEFINER: checks auth.uid, private tenant, customer role, row lock, token hash/expiry/purpose and exact same-tenant ownership before an atomic bind/merge.';
comment on function public.reconcile_customer_account_claim(uuid, text, uuid, text) is
  'Service-only post-commit reconciliation for an ambiguous claim response; requires exact digest, tenant, purpose, used_by, active profile and bound customer.';

commit;
