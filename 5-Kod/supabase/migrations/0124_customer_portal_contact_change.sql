-- 0124 — Session-bound, double-verified customer contact changes.
-- Raw destinations are private and transient. Browser roles can execute nothing.
begin;

create table private.customer_portal_verified_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  contact_digest text not null check (contact_digest ~ '^[a-f0-9]{64}$'),
  contact_masked text not null check (length(contact_masked) between 3 and 200),
  source_flow_public_id uuid not null,
  verified_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (revoked_at is null or revoked_at >= verified_at)
);

create index customer_portal_verified_contacts_customer_idx
  on private.customer_portal_verified_contacts (tenant_id, customer_id, channel);
create unique index customer_portal_verified_contacts_active_destination_uidx
  on private.customer_portal_verified_contacts (tenant_id, channel, contact_digest)
  where revoked_at is null;
create unique index customer_portal_verified_contacts_active_customer_channel_uidx
  on private.customer_portal_verified_contacts (tenant_id, customer_id, channel)
  where revoked_at is null;

create table private.customer_portal_contact_change_flows (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null references private.customer_portal_sessions(id) on delete cascade,
  subject_digest text not null unique check (subject_digest ~ '^[a-f0-9]{64}$'),
  key_version integer not null check (key_version = 1),
  action text not null check (action in ('change_phone', 'add_phone', 'change_email')),
  current_channel text not null check (current_channel in ('sms', 'email')),
  current_contact_digest text not null check (current_contact_digest ~ '^[a-f0-9]{64}$'),
  current_contact_masked text not null check (length(current_contact_masked) between 3 and 200),
  current_code_digest text not null check (current_code_digest ~ '^[a-f0-9]{64}$'),
  current_delivery_state text not null default 'pending'
    check (current_delivery_state in ('pending', 'delivered', 'failed')),
  current_delivered_at timestamptz,
  current_attempt_count integer not null default 0 check (current_attempt_count between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts = 5),
  current_expires_at timestamptz not null,
  current_resend_after timestamptz not null,
  flow_expires_at timestamptz not null,
  current_verified_at timestamptz,
  step_up_expires_at timestamptz,
  new_channel text check (new_channel is null or new_channel in ('sms', 'email')),
  new_destination text check (new_destination is null or length(new_destination) between 3 and 200),
  new_contact_digest text check (new_contact_digest is null or new_contact_digest ~ '^[a-f0-9]{64}$'),
  new_booking_contact_digest text check (
    new_booking_contact_digest is null or new_booking_contact_digest ~ '^[a-f0-9]{64}$'
  ),
  new_contact_masked text check (new_contact_masked is null or length(new_contact_masked) between 3 and 200),
  new_code_digest text check (new_code_digest is null or new_code_digest ~ '^[a-f0-9]{64}$'),
  new_delivery_state text check (
    new_delivery_state is null or new_delivery_state in ('pending', 'delivered', 'failed')
  ),
  new_delivered_at timestamptz,
  new_attempt_count integer not null default 0 check (new_attempt_count between 0 and 5),
  new_expires_at timestamptz,
  new_resend_after timestamptz,
  locked_at timestamptz,
  rotated_session_id uuid references private.customer_portal_sessions(id) on delete set null,
  rotated_session_public_id uuid,
  rotated_session_digest text check (
    rotated_session_digest is null or rotated_session_digest ~ '^[a-f0-9]{64}$'
  ),
  completed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (current_expires_at > created_at),
  check (current_resend_after > created_at),
  check (flow_expires_at > created_at and flow_expires_at <= created_at + interval '10 minutes 1 second'),
  check ((current_verified_at is null) = (step_up_expires_at is null)),
  check (step_up_expires_at is null or step_up_expires_at <= current_verified_at + interval '10 minutes'),
  check ((completed_at is null) = (rotated_session_public_id is null)),
  check ((completed_at is null) = (rotated_session_digest is null)),
  check ((new_delivery_state = 'delivered') = (new_delivered_at is not null))
);

create index customer_portal_contact_change_subject_idx
  on private.customer_portal_contact_change_flows (tenant_id, customer_id, created_at desc);
create index customer_portal_contact_change_expiry_idx
  on private.customer_portal_contact_change_flows (current_expires_at, step_up_expires_at, new_expires_at)
  where completed_at is null and revoked_at is null;

alter table private.customer_portal_verified_contacts enable row level security;
alter table private.customer_portal_contact_change_flows enable row level security;
revoke all on table private.customer_portal_verified_contacts
  from public, anon, authenticated, service_role;
revoke all on table private.customer_portal_contact_change_flows
  from public, anon, authenticated, service_role;

create or replace function private.customer_portal_digest_equal(p_left text, p_right text)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_difference integer := 0;
  v_index integer;
begin
  if p_left is null or p_right is null
     or pg_catalog.length(p_left) <> 64 or pg_catalog.length(p_right) <> 64 then
    return false;
  end if;
  for v_index in 1..64 loop
    v_difference := v_difference | (
      pg_catalog.ascii(pg_catalog.substr(p_left, v_index, 1))
      # pg_catalog.ascii(pg_catalog.substr(p_right, v_index, 1))
    );
  end loop;
  return v_difference = 0;
end;
$$;

create or replace function private.customer_portal_scrub_expired_contact_changes(
  p_now timestamptz default statement_timestamp()
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update private.customer_portal_contact_change_flows f
  set new_destination = null,
      updated_at = greatest(f.updated_at, p_now)
  where f.new_destination is not null
    and (
      f.completed_at is not null
      or f.revoked_at is not null
      or f.flow_expires_at <= p_now
      or (f.step_up_expires_at is not null and f.step_up_expires_at <= p_now)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.sweep_customer_portal_contact_changes(
  p_now timestamptz default statement_timestamp()
) returns integer
language sql
security definer
set search_path = ''
as $$
  select private.customer_portal_scrub_expired_contact_changes(p_now)
$$;

create or replace function private.customer_portal_contact_is_verified(
  p_tenant uuid,
  p_customer uuid,
  p_channel text,
  p_contact_digest text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1
    from private.customer_portal_verified_contacts active_binding
    where active_binding.tenant_id = p_tenant
      and active_binding.customer_id = p_customer
      and active_binding.channel = p_channel
      and active_binding.revoked_at is null
  ) then exists (
    select 1
    from private.customer_portal_verified_contacts vc
    where vc.tenant_id = p_tenant
      and vc.customer_id = p_customer
      and vc.channel = p_channel
      and vc.contact_digest = p_contact_digest
      and vc.revoked_at is null
  ) else exists (
    select 1
    from private.booking_verification_challenges bv
    join public.bookings b
      on b.id = bv.booking_id
     and b.tenant_id = p_tenant
     and b.customer_id = p_customer
    where bv.tenant_id = p_tenant
      and bv.channel = p_channel
      and bv.contact_digest = p_contact_digest
      and bv.delivery_state = 'delivered'
      and bv.consumed_at is not null
  ) end
$$;

-- Keep a verified destination unique per tenant/channel even when a writer
-- bypasses the customer-portal RPC (for example the admin customer card).
create or replace function private.customer_portal_guard_customer_contact_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
  v_raw text;
  v_normalized text;
  v_now timestamptz := statement_timestamp();
  v_contact_changed boolean;
begin
  v_contact_changed := false;
  if tg_op = 'UPDATE' then
    v_contact_changed := new.tenant_id is distinct from old.tenant_id
      or new.phone is distinct from old.phone
      or new.email is distinct from old.email
      or new.status is distinct from old.status;
  end if;

  if v_contact_changed then
    update private.customer_portal_verified_contacts verified
    set revoked_at = coalesce(verified.revoked_at, v_now)
    where verified.tenant_id = old.tenant_id
      and verified.customer_id = old.id
      and verified.revoked_at is null
      and (
        new.tenant_id is distinct from old.tenant_id
        or new.status is distinct from old.status
        or (verified.channel = 'sms' and new.phone is distinct from old.phone)
        or (verified.channel = 'email' and new.email is distinct from old.email)
      );
    update private.customer_portal_sessions session_row
    set revoked_at = coalesce(session_row.revoked_at, v_now)
    where session_row.tenant_id = old.tenant_id
      and session_row.customer_id = old.id
      and session_row.revoked_at is null;
    update private.customer_booking_trusts trust_row
    set revoked_at = coalesce(trust_row.revoked_at, v_now)
    where trust_row.tenant_id = old.tenant_id
      and trust_row.customer_id = old.id
      and trust_row.revoked_at is null;
    update private.customer_portal_links link_row
    set revoked_at = coalesce(link_row.revoked_at, v_now)
    where link_row.tenant_id = old.tenant_id
      and link_row.customer_id = old.id
      and link_row.revoked_at is null
      and link_row.consumed_at is null;
    update private.customer_portal_challenges challenge_row
    set revoked_at = coalesce(challenge_row.revoked_at, v_now)
    where challenge_row.tenant_id = old.tenant_id
      and challenge_row.customer_id = old.id
      and challenge_row.revoked_at is null
      and challenge_row.consumed_at is null;
  end if;

  if new.status <> 'active' then return new; end if;

  for v_channel, v_raw in
    select candidate.channel, candidate.raw_value
    from (values ('sms'::text, new.phone), ('email'::text, new.email)) candidate(channel, raw_value)
  loop
    if v_raw is null or (
      tg_op = 'UPDATE'
      and new.tenant_id is not distinct from old.tenant_id
      and new.status is not distinct from old.status
      and (
        (v_channel = 'sms' and new.phone is not distinct from old.phone)
        or (v_channel = 'email' and new.email is not distinct from old.email)
      )
    ) then continue; end if;

    select normalized.normalized into v_normalized
    from private.customer_portal_normalize_recovery_lookup(v_raw) normalized
    where normalized.channel = v_channel;
    if not found then continue; end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      new.tenant_id::text || ':' || v_channel || ':' || v_normalized, 0
    ));
    if exists (
      select 1
      from public.customers existing
      cross join lateral private.customer_portal_normalize_recovery_lookup(
        case when v_channel = 'sms' then existing.phone else existing.email end
      ) normalized
      where existing.tenant_id = new.tenant_id
        and existing.id <> new.id
        and existing.status = 'active'
        and normalized.channel = v_channel
        and normalized.normalized = v_normalized
    ) then
      raise unique_violation using message = 'customer_contact_conflict';
    end if;
  end loop;
  return new;
end;
$$;

create trigger customer_portal_guard_customer_contact_uniqueness
before insert or update of tenant_id, phone, email, status on public.customers
for each row execute function private.customer_portal_guard_customer_contact_uniqueness();

create or replace function public.customer_portal_start_contact_change(
  p_session_public_id uuid,
  p_secret_digest text,
  p_action text,
  p_flow_public_id uuid,
  p_flow_subject_digest text,
  p_current_contact_digest text,
  p_current_destination text,
  p_current_contact_masked text,
  p_code_digest text,
  p_key_version integer,
  p_expires_at timestamptz
) returns table (
  outcome text,
  flow_public_id uuid,
  channel text,
  delivery_destination text,
  masked_destination text,
  tenant_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
  v_customer record;
  v_channel text;
  v_destination text;
  v_normalized record;
begin
  if p_action not in ('change_phone', 'add_phone', 'change_email')
     or p_flow_public_id is null
     or p_flow_subject_digest !~ '^[a-f0-9]{64}$'
     or p_current_contact_digest !~ '^[a-f0-9]{64}$'
     or p_code_digest !~ '^[a-f0-9]{64}$'
     or p_key_version <> 1
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '5 minutes' then
    return query select 'invalid'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::timestamptz;
    return;
  end if;
  perform private.customer_portal_scrub_expired_contact_changes(v_now);

  select * into v_session
  from private.customer_portal_resolve_session(p_session_public_id, p_secret_digest, v_now);
  if not found then
    return query select 'expired'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::timestamptz;
    return;
  end if;

  select c.phone, c.email into v_customer
  from public.customers c
  where c.id = v_session.customer_id and c.tenant_id = v_session.tenant_id
    and c.status = 'active'
  for update;
  if not found then
    return query select 'expired'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_customer.phone is not null and pg_catalog.btrim(v_customer.phone) <> '' then
    v_channel := 'sms';
    v_destination := v_customer.phone;
    if p_action = 'add_phone'
       or (p_action = 'change_email' and (v_customer.email is null or pg_catalog.btrim(v_customer.email) = '')) then
      return query select 'invalid'::text, null::uuid, null::text, null::text,
        null::text, null::text, null::timestamptz;
      return;
    end if;
  else
    v_channel := 'email';
    v_destination := v_customer.email;
    if p_action = 'change_phone' then
      return query select 'invalid'::text, null::uuid, null::text, null::text,
        null::text, null::text, null::timestamptz;
      return;
    end if;
  end if;

  select n.* into v_normalized
  from private.customer_portal_normalize_recovery_lookup(v_destination) n;
  if not found or v_normalized.channel <> v_channel
     or v_normalized.normalized is distinct from p_current_destination
     or v_normalized.masked is distinct from p_current_contact_masked
     or not private.customer_portal_safe_contact_mask(v_channel, p_current_contact_masked)
     or not private.customer_portal_contact_is_verified(
       v_session.tenant_id, v_session.customer_id, v_channel, p_current_contact_digest
     ) then
    return query select 'invalid'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::timestamptz;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_session.session_id::text || ':contact-change', 0)
  );
  if exists (
    select 1 from private.customer_portal_contact_change_flows f
    where f.session_id = v_session.session_id
      and f.completed_at is null
      and f.revoked_at is null
      and coalesce(f.step_up_expires_at, f.flow_expires_at) > v_now
  ) then
    return query select 'max_attempts'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::timestamptz;
    return;
  end if;
  if exists (
    select 1 from private.customer_portal_contact_change_flows f
    where f.session_id = v_session.session_id
      and f.created_at > v_now - interval '30 seconds'
  ) then
    return query select 'cooldown'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::timestamptz;
    return;
  end if;

  update private.customer_portal_contact_change_flows f
  set revoked_at = v_now, new_destination = null, updated_at = v_now
  where f.session_id = v_session.session_id
    and f.completed_at is null and f.revoked_at is null;

  insert into private.customer_portal_contact_change_flows (
    public_id, tenant_id, customer_id, session_id, subject_digest, key_version,
    action, current_channel, current_contact_digest, current_contact_masked,
    current_code_digest, current_expires_at, current_resend_after, flow_expires_at
  ) values (
    p_flow_public_id, v_session.tenant_id, v_session.customer_id, v_session.session_id,
    p_flow_subject_digest, p_key_version, p_action, v_channel,
    p_current_contact_digest, p_current_contact_masked, p_code_digest, p_expires_at,
    v_now + interval '30 seconds', v_now + interval '10 minutes'
  );

  return query select 'ready'::text, p_flow_public_id, v_channel,
    v_normalized.normalized, p_current_contact_masked, v_session.tenant_name, p_expires_at;
end;
$$;

create or replace function public.customer_portal_record_contact_change_delivery(
  p_session_public_id uuid,
  p_secret_digest text,
  p_flow_public_id uuid,
  p_flow_subject_digest text,
  p_stage text,
  p_code_digest text,
  p_delivered boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
  v_flow private.customer_portal_contact_change_flows%rowtype;
begin
  select * into v_session
  from private.customer_portal_resolve_session(p_session_public_id, p_secret_digest, v_now);
  if not found then return 'invalid'; end if;
  select f.* into v_flow
  from private.customer_portal_contact_change_flows f
  where f.public_id = p_flow_public_id and f.subject_digest = p_flow_subject_digest
    and f.session_id = v_session.session_id and f.revoked_at is null
  for update;
  if not found or p_stage not in ('current', 'new') or v_flow.locked_at is not null
     or v_flow.completed_at is not null or p_code_digest !~ '^[a-f0-9]{64}$'
     then return 'invalid'; end if;
  if p_stage = 'current' then
    if v_flow.current_delivery_state <> 'pending' or v_flow.current_expires_at <= v_now
       or not private.customer_portal_digest_equal(v_flow.current_code_digest, p_code_digest) then
      return 'invalid';
    end if;
    update private.customer_portal_contact_change_flows f
    set current_delivery_state = case when p_delivered then 'delivered' else 'failed' end,
        current_delivered_at = case when p_delivered then v_now else null end,
        updated_at = v_now
    where f.id = v_flow.id and f.current_delivery_state = 'pending';
  else
    if v_flow.new_delivery_state <> 'pending' or v_flow.new_expires_at <= v_now
       or not private.customer_portal_digest_equal(v_flow.new_code_digest, p_code_digest) then
      return 'invalid';
    end if;
    update private.customer_portal_contact_change_flows f
    set new_delivery_state = case when p_delivered then 'delivered' else 'failed' end,
        new_delivered_at = case when p_delivered then v_now else null end,
        updated_at = v_now
    where f.id = v_flow.id and f.new_delivery_state = 'pending';
  end if;
  return 'ok';
end;
$$;

create or replace function public.customer_portal_verify_contact_change_current(
  p_session_public_id uuid,
  p_secret_digest text,
  p_flow_public_id uuid,
  p_flow_subject_digest text,
  p_code_digest text
) returns table (outcome text, attempts_remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
  v_flow private.customer_portal_contact_change_flows%rowtype;
  v_remaining integer;
begin
  select * into v_session
  from private.customer_portal_resolve_session(p_session_public_id, p_secret_digest, v_now);
  if not found then return query select 'expired'::text, 0; return; end if;
  select f.* into v_flow from private.customer_portal_contact_change_flows f
  where f.public_id = p_flow_public_id and f.subject_digest = p_flow_subject_digest
    and f.session_id = v_session.session_id and f.customer_id = v_session.customer_id
  for update;
  if not found or v_flow.revoked_at is not null or v_flow.completed_at is not null then
    return query select 'expired'::text, 0; return;
  end if;
  v_remaining := greatest(v_flow.max_attempts - v_flow.current_attempt_count, 0);
  if v_flow.locked_at is not null then return query select 'max_attempts'::text, 0; return; end if;
  if v_flow.flow_expires_at <= v_now then return query select 'expired'::text, v_remaining; return; end if;
  if v_flow.current_expires_at <= v_now then return query select 'expired'::text, v_remaining; return; end if;
  if v_flow.current_attempt_count >= v_flow.max_attempts then
    return query select 'max_attempts'::text, 0; return;
  end if;
  if v_flow.current_delivery_state <> 'delivered' then
    return query select 'invalid'::text, v_remaining; return;
  end if;
  if not private.customer_portal_digest_equal(v_flow.current_code_digest, p_code_digest) then
    update private.customer_portal_contact_change_flows f
    set current_attempt_count = least(f.current_attempt_count + 1, f.max_attempts),
        locked_at = case when f.current_attempt_count + 1 >= f.max_attempts then v_now else f.locked_at end,
        updated_at = v_now
    where f.id = v_flow.id;
    v_remaining := greatest(v_remaining - 1, 0);
    return query select case when v_remaining = 0 then 'max_attempts' else 'invalid' end, v_remaining;
    return;
  end if;
  update private.customer_portal_contact_change_flows f
  set current_verified_at = v_now,
      step_up_expires_at = v_now + interval '10 minutes',
      updated_at = v_now
  where f.id = v_flow.id and f.current_verified_at is null;
  return query select 'verified'::text, v_remaining;
end;
$$;

create or replace function public.customer_portal_contact_change_context(
  p_session_public_id uuid,
  p_secret_digest text,
  p_flow_public_id uuid,
  p_flow_subject_digest text
) returns table (outcome text, action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
begin
  select * into v_session
  from private.customer_portal_resolve_session(p_session_public_id, p_secret_digest, v_now);
  if not found then return query select 'expired'::text, null::text; return; end if;
  return query
  select case
      when f.current_verified_at is not null and f.step_up_expires_at > v_now
        and f.revoked_at is null and f.locked_at is null and f.completed_at is null then 'ready' else 'expired'
    end,
    case when f.current_verified_at is not null and f.step_up_expires_at > v_now
      and f.revoked_at is null and f.locked_at is null and f.completed_at is null
      then f.action else null end
  from private.customer_portal_contact_change_flows f
  where f.public_id = p_flow_public_id and f.subject_digest = p_flow_subject_digest
    and f.session_id = v_session.session_id and f.customer_id = v_session.customer_id;
  if not found then return query select 'expired'::text, null::text; end if;
end;
$$;

create or replace function public.customer_portal_prepare_contact_change_destination(
  p_session_public_id uuid,
  p_secret_digest text,
  p_flow_public_id uuid,
  p_flow_subject_digest text,
  p_current_contact_digest text,
  p_current_destination text,
  p_new_destination text,
  p_new_channel text,
  p_new_contact_digest text,
  p_new_booking_contact_digest text,
  p_new_contact_masked text,
  p_code_digest text,
  p_key_version integer,
  p_expires_at timestamptz
) returns table (
  outcome text,
  channel text,
  delivery_destination text,
  masked_destination text,
  tenant_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
  v_flow private.customer_portal_contact_change_flows%rowtype;
  v_customer record;
  v_new record;
  v_current record;
  v_target record;
  v_conflict boolean;
begin
  select * into v_session
  from private.customer_portal_resolve_session(p_session_public_id, p_secret_digest, v_now);
  if not found then return query select 'expired'::text, null::text, null::text, null::text, null::text, null::timestamptz; return; end if;
  select f.* into v_flow from private.customer_portal_contact_change_flows f
  where f.public_id = p_flow_public_id and f.subject_digest = p_flow_subject_digest
    and f.session_id = v_session.session_id and f.customer_id = v_session.customer_id
  for update;
  if not found or v_flow.revoked_at is not null or v_flow.completed_at is not null
     or v_flow.locked_at is not null
     or v_flow.current_verified_at is null or v_flow.step_up_expires_at <= v_now then
    return query select 'step_up_expired'::text, null::text, null::text, null::text, null::text, null::timestamptz; return;
  end if;
  if v_flow.new_code_digest is not null
     or p_current_contact_digest !~ '^[a-f0-9]{64}$'
     or not private.customer_portal_digest_equal(
       v_flow.current_contact_digest, p_current_contact_digest
     ) then
    return query select 'invalid'::text, null::text, null::text, null::text,
      null::text, null::timestamptz;
    return;
  end if;
  if ((v_flow.action in ('change_phone', 'add_phone')) and p_new_channel <> 'sms')
     or (v_flow.action = 'change_email' and p_new_channel <> 'email')
     or p_new_contact_digest !~ '^[a-f0-9]{64}$'
     or p_new_booking_contact_digest !~ '^[a-f0-9]{64}$'
     or p_code_digest !~ '^[a-f0-9]{64}$' or p_key_version <> 1
     or p_expires_at <= v_now or p_expires_at > v_now + interval '5 minutes' then
    return query select 'invalid'::text, null::text, null::text, null::text, null::text, null::timestamptz; return;
  end if;
  select n.* into v_new from private.customer_portal_normalize_recovery_lookup(p_new_destination) n;
  if not found or v_new.channel <> p_new_channel or v_new.normalized <> p_new_destination
     or v_new.masked <> p_new_contact_masked
     or not private.customer_portal_safe_contact_mask(p_new_channel, p_new_contact_masked) then
    return query select 'invalid'::text, null::text, null::text, null::text, null::text, null::timestamptz; return;
  end if;
  select c.phone, c.email into v_customer from public.customers c
  where c.id = v_session.customer_id and c.tenant_id = v_session.tenant_id and c.status = 'active'
  for update;
  select n.* into v_current from private.customer_portal_normalize_recovery_lookup(
    case when v_flow.current_channel = 'sms' then v_customer.phone else v_customer.email end
  ) n;
  if not found or v_current.channel is distinct from v_flow.current_channel
     or v_current.normalized is distinct from p_current_destination
     or not private.customer_portal_contact_is_verified(
       v_flow.tenant_id, v_flow.customer_id, v_flow.current_channel, v_flow.current_contact_digest
     ) then
    return query select 'step_up_expired'::text, null::text, null::text, null::text, null::text, null::timestamptz; return;
  end if;
  select n.* into v_target from private.customer_portal_normalize_recovery_lookup(
    case when p_new_channel = 'sms' then v_customer.phone else v_customer.email end
  ) n;
  if found and v_target.channel = p_new_channel and v_target.normalized = v_new.normalized then
    return query select 'same'::text, null::text, null::text, null::text, null::text, null::timestamptz; return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_session.tenant_id::text || ':' || p_new_channel || ':' || v_new.normalized, 0
  ));
  select exists (
    select 1 from public.customers c
    cross join lateral private.customer_portal_normalize_recovery_lookup(
      case when p_new_channel = 'sms' then c.phone else c.email end
    ) n
    where c.tenant_id = v_session.tenant_id and c.status = 'active'
      and c.id <> v_session.customer_id and n.channel = p_new_channel
      and n.normalized = v_new.normalized
  ) or exists (
    select 1 from private.customer_portal_verified_contacts vc
    where vc.tenant_id = v_session.tenant_id and vc.channel = p_new_channel
      and vc.contact_digest = p_new_booking_contact_digest
      and vc.customer_id <> v_session.customer_id
      and vc.revoked_at is null
  ) into v_conflict;
  if v_conflict then
    return query select 'conflict'::text, null::text, null::text, null::text, null::text, null::timestamptz; return;
  end if;
  update private.customer_portal_contact_change_flows f
  set new_channel = p_new_channel, new_destination = v_new.normalized,
      new_contact_digest = p_new_contact_digest,
      new_booking_contact_digest = p_new_booking_contact_digest,
      new_contact_masked = p_new_contact_masked, new_code_digest = p_code_digest,
      new_delivery_state = 'pending', new_delivered_at = null,
      new_expires_at = least(p_expires_at, v_flow.step_up_expires_at),
      new_resend_after = v_now + interval '30 seconds', updated_at = v_now
  where f.id = v_flow.id;
  return query select 'ready'::text, p_new_channel, v_new.normalized,
    p_new_contact_masked, v_session.tenant_name, least(p_expires_at, v_flow.step_up_expires_at);
end;
$$;

create or replace function public.customer_portal_resend_contact_change(
  p_session_public_id uuid,
  p_secret_digest text,
  p_flow_public_id uuid,
  p_flow_subject_digest text,
  p_stage text,
  p_current_contact_digest text,
  p_current_destination text,
  p_code_digest text,
  p_expires_at timestamptz
) returns table (
  outcome text,
  channel text,
  delivery_destination text,
  masked_destination text,
  tenant_name text,
  expires_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
  v_flow private.customer_portal_contact_change_flows%rowtype;
  v_customer record;
  v_current record;
  v_effective_expiry timestamptz;
begin
  if p_stage not in ('current', 'new') or p_code_digest !~ '^[a-f0-9]{64}$'
     or p_expires_at <= v_now or p_expires_at > v_now + interval '5 minutes' then
    return query select 'invalid'::text, null::text, null::text, null::text,
      null::text, null::timestamptz, null::integer;
    return;
  end if;
  select * into v_session
  from private.customer_portal_resolve_session(p_session_public_id, p_secret_digest, v_now);
  if not found then
    return query select 'expired'::text, null::text, null::text, null::text,
      null::text, null::timestamptz, null::integer;
    return;
  end if;
  select f.* into v_flow from private.customer_portal_contact_change_flows f
  where f.public_id = p_flow_public_id and f.subject_digest = p_flow_subject_digest
    and f.session_id = v_session.session_id and f.customer_id = v_session.customer_id
  for update;
  if not found or v_flow.revoked_at is not null or v_flow.completed_at is not null then
    return query select 'expired'::text, null::text, null::text, null::text,
      null::text, null::timestamptz, null::integer;
    return;
  end if;
  if v_flow.locked_at is not null then
    return query select 'max_attempts'::text, null::text, null::text, null::text,
      null::text, null::timestamptz, 600;
    return;
  end if;

  if p_stage = 'current' then
    if p_current_contact_digest !~ '^[a-f0-9]{64}$'
       or not private.customer_portal_digest_equal(
         v_flow.current_contact_digest, p_current_contact_digest
       ) then
      return query select 'invalid'::text, null::text, null::text, null::text,
        null::text, null::timestamptz, null::integer;
      return;
    end if;
    select c.phone, c.email into v_customer from public.customers c
    where c.id = v_flow.customer_id and c.tenant_id = v_flow.tenant_id
      and c.status = 'active'
    for update;
    select n.* into v_current from private.customer_portal_normalize_recovery_lookup(
      case when v_flow.current_channel = 'sms' then v_customer.phone else v_customer.email end
    ) n;
    if not found or v_current.channel is distinct from v_flow.current_channel
       or v_current.normalized is distinct from p_current_destination then
      return query select 'invalid'::text, null::text, null::text, null::text,
        null::text, null::timestamptz, null::integer;
      return;
    end if;
    if v_flow.current_verified_at is not null or v_flow.flow_expires_at <= v_now then
      return query select 'expired'::text, null::text, null::text, null::text,
        null::text, null::timestamptz, null::integer;
      return;
    end if;
    if v_flow.current_resend_after > v_now then
      return query select 'cooldown'::text, null::text, null::text, null::text,
        null::text, null::timestamptz,
        greatest(1, pg_catalog.ceil(extract(epoch from (v_flow.current_resend_after - v_now)))::integer);
      return;
    end if;
    v_effective_expiry := least(p_expires_at, v_flow.flow_expires_at);
    update private.customer_portal_contact_change_flows f
    set current_code_digest = p_code_digest, current_delivery_state = 'pending',
        current_delivered_at = null, current_expires_at = v_effective_expiry,
        current_resend_after = v_now + interval '30 seconds', updated_at = v_now
    where f.id = v_flow.id;
    return query select 'ready'::text, v_flow.current_channel,
      v_current.normalized, v_flow.current_contact_masked,
      v_session.tenant_name, v_effective_expiry, 30;
    return;
  end if;

  if v_flow.current_verified_at is null or v_flow.step_up_expires_at <= v_now
     or v_flow.new_channel is null or v_flow.new_destination is null then
    return query select 'step_up_expired'::text, null::text, null::text, null::text,
      null::text, null::timestamptz, null::integer;
    return;
  end if;
  if v_flow.new_resend_after > v_now then
    return query select 'cooldown'::text, null::text, null::text, null::text,
      null::text, null::timestamptz,
      greatest(1, pg_catalog.ceil(extract(epoch from (v_flow.new_resend_after - v_now)))::integer);
    return;
  end if;
  v_effective_expiry := least(p_expires_at, v_flow.step_up_expires_at);
  update private.customer_portal_contact_change_flows f
  set new_code_digest = p_code_digest, new_delivery_state = 'pending',
      new_delivered_at = null, new_expires_at = v_effective_expiry,
      new_resend_after = v_now + interval '30 seconds', updated_at = v_now
  where f.id = v_flow.id;
  return query select 'ready'::text, v_flow.new_channel, v_flow.new_destination,
    v_flow.new_contact_masked, v_session.tenant_name, v_effective_expiry, 30;
end;
$$;

create or replace function public.customer_portal_finalize_contact_change(
  p_session_public_id uuid,
  p_secret_digest text,
  p_flow_public_id uuid,
  p_flow_subject_digest text,
  p_code_digest text,
  p_current_contact_digest text,
  p_current_destination text,
  p_new_session_public_id uuid,
  p_new_session_digest text,
  p_key_version integer
) returns table (outcome text, attempts_remaining integer, action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_flow private.customer_portal_contact_change_flows%rowtype;
  v_session private.customer_portal_sessions%rowtype;
  v_customer public.customers%rowtype;
  v_current record;
  v_new record;
  v_remaining integer;
  v_conflict boolean;
  v_new_session_id uuid;
begin
  select f.* into v_flow from private.customer_portal_contact_change_flows f
  where f.public_id = p_flow_public_id and f.subject_digest = p_flow_subject_digest
  for update;
  if not found then return query select 'expired'::text, 0, null::text; return; end if;
  if v_flow.completed_at is not null then
    select original.* into v_session
    from private.customer_portal_sessions original
    where original.id = v_flow.session_id
      and original.public_id = p_session_public_id
      and original.secret_digest = p_secret_digest
    for update;
    if found
       and v_flow.completed_at > v_now - interval '15 minutes'
       and v_flow.rotated_session_public_id = p_new_session_public_id
       and private.customer_portal_digest_equal(v_flow.rotated_session_digest, p_new_session_digest)
       and exists (
         select 1 from private.customer_portal_sessions rotated
         where rotated.id = v_flow.rotated_session_id
           and rotated.public_id = v_flow.rotated_session_public_id
           and rotated.secret_digest = v_flow.rotated_session_digest
           and rotated.revoked_at is null
           and rotated.idle_expires_at > v_now
           and rotated.absolute_expires_at > v_now
       ) then
      return query select 'completed'::text, v_flow.max_attempts - v_flow.new_attempt_count, v_flow.action;
    else
      return query select 'expired'::text, 0, null::text;
    end if;
    return;
  end if;
  select s.* into v_session from private.customer_portal_sessions s
  where s.id = v_flow.session_id and s.public_id = p_session_public_id
    and s.secret_digest = p_secret_digest and s.revoked_at is null
    and s.idle_expires_at > v_now and s.absolute_expires_at > v_now
  for update;
  if not found or v_flow.revoked_at is not null then
    return query select 'expired'::text, 0, null::text; return;
  end if;
  if p_current_contact_digest !~ '^[a-f0-9]{64}$'
     or not private.customer_portal_digest_equal(
       v_flow.current_contact_digest, p_current_contact_digest
     ) then
    return query select 'invalid'::text, 0, null::text;
    return;
  end if;
  v_remaining := greatest(v_flow.max_attempts - v_flow.new_attempt_count, 0);
  if v_flow.locked_at is not null then return query select 'max_attempts'::text, 0, null::text; return; end if;
  if v_flow.current_verified_at is null or v_flow.step_up_expires_at <= v_now then
    return query select 'step_up_expired'::text, v_remaining, null::text; return;
  end if;
  if v_flow.new_expires_at is null or v_flow.new_expires_at <= v_now then
    return query select 'expired'::text, v_remaining, null::text; return;
  end if;
  if v_flow.new_attempt_count >= v_flow.max_attempts then
    return query select 'max_attempts'::text, 0, null::text; return;
  end if;
  if v_flow.new_delivery_state <> 'delivered' or v_flow.new_delivered_at is null then
    return query select 'invalid'::text, v_remaining, null::text; return;
  end if;
  if not private.customer_portal_digest_equal(v_flow.new_code_digest, p_code_digest) then
    update private.customer_portal_contact_change_flows f
    set new_attempt_count = least(f.new_attempt_count + 1, f.max_attempts),
        locked_at = case when f.new_attempt_count + 1 >= f.max_attempts then v_now else f.locked_at end,
        updated_at = v_now
    where f.id = v_flow.id;
    v_remaining := greatest(v_remaining - 1, 0);
    return query select case when v_remaining = 0 then 'max_attempts' else 'invalid' end,
      v_remaining, null::text;
    return;
  end if;
  if p_new_session_public_id is null or p_new_session_digest !~ '^[a-f0-9]{64}$'
     or p_key_version <> 1 then
    return query select 'invalid'::text, v_remaining, null::text; return;
  end if;

  select c.* into v_customer from public.customers c
  where c.id = v_flow.customer_id and c.tenant_id = v_flow.tenant_id and c.status = 'active'
  for update;
  select n.* into v_current from private.customer_portal_normalize_recovery_lookup(
    case when v_flow.current_channel = 'sms' then v_customer.phone else v_customer.email end
  ) n;
  select n.* into v_new from private.customer_portal_normalize_recovery_lookup(v_flow.new_destination) n;
  if v_customer.id is null
     or v_current.channel is distinct from v_flow.current_channel
     or v_current.normalized is distinct from p_current_destination
     or v_current.masked is distinct from v_flow.current_contact_masked
     or v_new.channel is distinct from v_flow.new_channel
     or v_new.normalized is distinct from v_flow.new_destination
     or v_new.masked is distinct from v_flow.new_contact_masked
     or not private.customer_portal_contact_is_verified(
       v_flow.tenant_id, v_flow.customer_id, v_flow.current_channel, v_flow.current_contact_digest
     ) then
    return query select 'invalid'::text, v_remaining, null::text; return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_flow.tenant_id::text || ':' || v_flow.new_channel || ':' || v_flow.new_destination, 0
  ));
  select exists (
    select 1 from public.customers c
    cross join lateral private.customer_portal_normalize_recovery_lookup(
      case when v_flow.new_channel = 'sms' then c.phone else c.email end
    ) n
    where c.tenant_id = v_flow.tenant_id and c.status = 'active'
      and c.id <> v_flow.customer_id and n.channel = v_flow.new_channel
      and n.normalized = v_flow.new_destination
  ) or exists (
    select 1 from private.customer_portal_verified_contacts vc
    where vc.tenant_id = v_flow.tenant_id and vc.channel = v_flow.new_channel
      and vc.contact_digest = v_flow.new_booking_contact_digest
      and vc.customer_id <> v_flow.customer_id
      and vc.revoked_at is null
  ) into v_conflict;
  if v_conflict then return query select 'conflict'::text, v_remaining, null::text; return; end if;

  if v_flow.current_channel <> v_flow.new_channel
     and not exists (
       select 1 from private.customer_portal_verified_contacts vc
       where vc.tenant_id = v_flow.tenant_id and vc.customer_id = v_flow.customer_id
         and vc.channel = v_flow.current_channel and vc.revoked_at is null
     ) then
    insert into private.customer_portal_verified_contacts (
      tenant_id, customer_id, channel, contact_digest, contact_masked, source_flow_public_id
    ) values (
      v_flow.tenant_id, v_flow.customer_id, v_flow.current_channel,
      v_flow.current_contact_digest, v_flow.current_contact_masked, v_flow.public_id
    );
  end if;
  if v_flow.action in ('change_phone', 'add_phone') then
    update public.customers c
    set phone = v_flow.new_destination,
        contact_hash = case when c.auth_user_id is null
          then public.customer_contact_hash(c.tenant_id, c.email, v_flow.new_destination)
          else null end,
        updated_at = v_now
    where c.id = v_flow.customer_id and c.tenant_id = v_flow.tenant_id;
  elsif v_flow.action = 'change_email' then
    update public.customers c
    set email = v_flow.new_destination,
        contact_hash = case when c.auth_user_id is null
          then public.customer_contact_hash(c.tenant_id, v_flow.new_destination, c.phone)
          else null end,
        updated_at = v_now
    where c.id = v_flow.customer_id and c.tenant_id = v_flow.tenant_id;
  else
    raise exception 'contact_change_action_invalid' using errcode = '22023';
  end if;

  update private.customer_portal_verified_contacts vc
  set revoked_at = v_now
  where vc.tenant_id = v_flow.tenant_id and vc.customer_id = v_flow.customer_id
    and vc.channel = v_flow.new_channel and vc.revoked_at is null;
  insert into private.customer_portal_verified_contacts (
    tenant_id, customer_id, channel, contact_digest, contact_masked, source_flow_public_id
  ) values (
    v_flow.tenant_id, v_flow.customer_id, v_flow.new_channel,
    v_flow.new_booking_contact_digest, v_flow.new_contact_masked, v_flow.public_id
  );

  update private.customer_portal_links l set revoked_at = v_now
  where l.tenant_id = v_flow.tenant_id and l.customer_id = v_flow.customer_id
    and l.revoked_at is null and l.consumed_at is null;
  update private.customer_portal_challenges c set revoked_at = v_now
  where c.tenant_id = v_flow.tenant_id and c.customer_id = v_flow.customer_id
    and c.revoked_at is null and c.consumed_at is null;
  update private.customer_booking_trusts t set revoked_at = v_now
  where t.tenant_id = v_flow.tenant_id and t.customer_id = v_flow.customer_id
    and t.revoked_at is null;
  update private.customer_portal_sessions s set revoked_at = v_now
  where s.tenant_id = v_flow.tenant_id and s.customer_id = v_flow.customer_id
    and s.revoked_at is null;

  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at, device_label
  ) values (
    p_new_session_public_id, v_flow.tenant_id, v_flow.customer_id,
    p_new_session_digest, p_key_version,
    least(v_now + interval '180 days', v_session.absolute_expires_at),
    v_session.absolute_expires_at, v_session.device_label
  ) returning id into v_new_session_id;

  update private.customer_portal_contact_change_flows f
  set completed_at = v_now, new_destination = null,
      rotated_session_id = v_new_session_id,
      rotated_session_public_id = p_new_session_public_id,
      rotated_session_digest = p_new_session_digest,
      updated_at = v_now
  where f.id = v_flow.id and f.completed_at is null;
  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type, entity_public_id
  ) values (
    v_flow.tenant_id, v_flow.customer_id, v_new_session_id,
    'contact_changed', v_flow.public_id
  );
  return query select 'completed'::text, v_remaining, v_flow.action;
end;
$$;

-- Extend the 0120 GDPR fence with the 0124 proof/flow tables. Contact-change
-- rows are operational security state, not business records, so deletion is
-- safer than retaining stable pseudonyms after an erase request.
create or replace function public.customer_portal_gdpr_scrub(
  p_tenant uuid,
  p_customer uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_count integer := 0;
  v_rows integer := 0;
begin
  delete from private.customer_portal_verified_contacts vc
  where vc.tenant_id = p_tenant and vc.customer_id = p_customer;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  delete from private.customer_portal_contact_change_flows f
  where f.tenant_id = p_tenant and f.customer_id = p_customer;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  update private.customer_portal_links l
  set revoked_at = coalesce(l.revoked_at, v_now),
      token_digest = 'gdpr:' || gen_random_uuid()::text,
      delivery_intent_id = null
  where l.tenant_id = p_tenant and l.customer_id = p_customer;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  update private.customer_portal_sessions s
  set revoked_at = coalesce(s.revoked_at, v_now),
      secret_digest = 'gdpr:' || gen_random_uuid()::text,
      device_label = null
  where s.tenant_id = p_tenant and s.customer_id = p_customer;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  update private.customer_booking_trusts t
  set revoked_at = coalesce(t.revoked_at, v_now),
      secret_digest = 'gdpr:' || gen_random_uuid()::text,
      device_label = null
  where t.tenant_id = p_tenant and t.customer_id = p_customer;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  update private.customer_portal_challenges c
  set revoked_at = coalesce(c.revoked_at, v_now),
      subject_digest = 'gdpr:' || gen_random_uuid()::text,
      contact_digest = 'gdpr:' || gen_random_uuid()::text,
      booking_contact_digest = null,
      contact_masked = null,
      code_digest = 'gdpr:' || gen_random_uuid()::text
  where c.tenant_id = p_tenant and c.customer_id = p_customer;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  update private.customer_portal_audit a
  set customer_id = null,
      session_id = null,
      idempotency_key = null,
      metadata = '{}'::jsonb
  where a.tenant_id = p_tenant and a.customer_id = p_customer;

  return v_count;
end;
$$;

-- 0123 projection now accepts the authoritative exact contact binding in
-- addition to the legacy exact booking proof. A presentation mask is never proof.
create or replace function public.customer_portal_profile_snapshot(
  p_session_public_id uuid,
  p_secret_digest text
) returns table (outcome text, profile jsonb, recovery_tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guard record;
  v_session record;
  v_customer record;
  v_proofs jsonb;
  v_profile jsonb;
begin
  select * into v_guard from public.customer_portal_session_snapshot(
    p_session_public_id, p_secret_digest, null, null
  );
  if not found or v_guard.outcome <> 'ok' or v_guard.snapshot is null then
    return query select coalesce(v_guard.outcome, 'unavailable')::text,
      null::jsonb, v_guard.recovery_tenant_slug; return;
  end if;
  select * into v_session from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );
  if not found then return query select 'expired'::text, null::jsonb, v_guard.recovery_tenant_slug; return; end if;
  select c.display_name, c.full_name, c.name_hidden, c.phone, c.email into v_customer
  from public.customers c where c.id = v_session.customer_id
    and c.tenant_id = v_session.tenant_id and c.status = 'active';
  if not found then return query select 'unavailable'::text, null::jsonb, null::text; return; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'channel', proof.channel, 'contactDigest', proof.contact_digest,
    'maskedDestination', proof.contact_masked,
    'maskValid', private.customer_portal_safe_contact_mask(proof.channel, proof.contact_masked)
  ) order by proof.channel, proof.contact_digest, proof.contact_masked), '[]'::jsonb)
  into v_proofs
  from (
    select distinct bv.channel, bv.contact_digest, pg_catalog.btrim(bv.contact_masked) contact_masked
    from private.booking_verification_challenges bv
    join public.bookings b on b.id = bv.booking_id and b.tenant_id = v_session.tenant_id
      and b.customer_id = v_session.customer_id
    where bv.tenant_id = v_session.tenant_id and bv.channel in ('sms', 'email')
      and bv.delivery_state = 'delivered' and bv.consumed_at is not null
      and bv.contact_digest ~ '^[0-9a-f]{64}$'
      and not exists (
        select 1 from private.customer_portal_verified_contacts active_binding
        where active_binding.tenant_id = v_session.tenant_id
          and active_binding.customer_id = v_session.customer_id
          and active_binding.channel = bv.channel
          and active_binding.revoked_at is null
      )
    union
    select vc.channel, vc.contact_digest, pg_catalog.btrim(vc.contact_masked)
    from private.customer_portal_verified_contacts vc
    where vc.tenant_id = v_session.tenant_id and vc.customer_id = v_session.customer_id
      and vc.channel in ('sms', 'email') and vc.contact_digest ~ '^[0-9a-f]{64}$'
      and vc.revoked_at is null
    order by 1, 2, 3 limit 257
  ) proof;
  select pg_catalog.jsonb_build_object(
    'tenantSlug', t.slug, 'tenantName', t.name,
    'customerName', case when v_customer.name_hidden then coalesce(v_customer.display_name, '')
      else coalesce(v_customer.display_name, v_customer.full_name, '') end,
    'phone', v_customer.phone, 'email', v_customer.email, 'proofs', v_proofs
  ) into v_profile from public.tenants t
  where t.id = v_session.tenant_id and t.status = 'active';
  if v_profile is null then return query select 'unavailable'::text, null::jsonb, null::text; return; end if;
  return query select 'ok'::text, v_profile, null::text;
end;
$$;

revoke all on function private.customer_portal_digest_equal(text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.customer_portal_scrub_expired_contact_changes(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.sweep_customer_portal_contact_changes(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.sweep_customer_portal_contact_changes(timestamptz)
  to service_role;
revoke all on function private.customer_portal_contact_is_verified(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.customer_portal_guard_customer_contact_uniqueness()
  from public, anon, authenticated, service_role;

revoke all on function public.customer_portal_start_contact_change(uuid, text, text, uuid, text, text, text, text, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_start_contact_change(uuid, text, text, uuid, text, text, text, text, text, integer, timestamptz)
  to service_role;
revoke all on function public.customer_portal_record_contact_change_delivery(uuid, text, uuid, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_record_contact_change_delivery(uuid, text, uuid, text, text, text, boolean)
  to service_role;
revoke all on function public.customer_portal_verify_contact_change_current(uuid, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_verify_contact_change_current(uuid, text, uuid, text, text)
  to service_role;
revoke all on function public.customer_portal_contact_change_context(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_contact_change_context(uuid, text, uuid, text)
  to service_role;
revoke all on function public.customer_portal_prepare_contact_change_destination(uuid, text, uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_prepare_contact_change_destination(uuid, text, uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz)
  to service_role;
revoke all on function public.customer_portal_resend_contact_change(uuid, text, uuid, text, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_resend_contact_change(uuid, text, uuid, text, text, text, text, text, timestamptz)
  to service_role;
revoke all on function public.customer_portal_finalize_contact_change(uuid, text, uuid, text, text, text, text, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_finalize_contact_change(uuid, text, uuid, text, text, text, text, uuid, text, integer)
  to service_role;
revoke all on function public.customer_portal_profile_snapshot(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_profile_snapshot(uuid, text)
  to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron saknas - hoppar over contact-change-scrub';
    return;
  end if;
  perform cron.schedule(
    'corevo-scrub-expired-contact-changes',
    '*/15 * * * *',
    $job$select public.sweep_customer_portal_contact_changes(statement_timestamp())$job$
  );
end;
$$;

commit;
