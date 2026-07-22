-- 0120 — Passwordless customer portal security boundary.
--
-- The browser never receives service-role access and never selects portal tables.
-- Every raw link/session/challenge secret is generated in the web process; only a
-- versioned digest crosses this boundary. Existing /konto data and auth stay intact.

-- Existing tenants keep their current account flow. New/missing/unknown values are
-- deliberately NOT treated as a default by the RPCs: only passwordless_tenant opens
-- this rail. The canonical storage remains tenant_settings.settings.customer_portal.mode.
insert into public.tenant_settings (tenant_id, settings)
select t.id, pg_catalog.jsonb_build_object(
  'customer_portal', pg_catalog.jsonb_build_object('mode', 'legacy_account')
)
from public.tenants t
where not exists (
  select 1 from public.tenant_settings ts where ts.tenant_id = t.id
);

update public.tenant_settings ts
set settings = pg_catalog.jsonb_set(
  coalesce(ts.settings, '{}'::jsonb),
  '{customer_portal}',
  coalesce(ts.settings -> 'customer_portal', '{}'::jsonb)
    || pg_catalog.jsonb_build_object('mode', 'legacy_account'),
  true
)
where ts.settings #>> '{customer_portal,mode}' is null;

create table private.customer_portal_links (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  purpose text not null check (purpose in ('booking_access', 'recovery', 'contact_change')),
  token_digest text not null unique check (length(token_digest) between 32 and 256),
  key_version integer not null check (key_version > 0),
  delivery_intent_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create unique index customer_portal_links_delivery_unique
  on private.customer_portal_links (delivery_intent_id, purpose)
  where delivery_intent_id is not null;
create index customer_portal_links_subject_idx
  on private.customer_portal_links (tenant_id, customer_id, created_at desc);
create index customer_portal_links_expiry_idx
  on private.customer_portal_links (expires_at)
  where consumed_at is null and revoked_at is null;

create table private.customer_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  secret_digest text not null unique check (length(secret_digest) between 32 and 256),
  key_version integer not null check (key_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  device_label text check (device_label is null or length(device_label) <= 80),
  check (idle_expires_at > created_at),
  check (absolute_expires_at > created_at),
  check (idle_expires_at <= absolute_expires_at)
);

create index customer_portal_sessions_subject_idx
  on private.customer_portal_sessions (tenant_id, customer_id, last_seen_at desc);
create index customer_portal_sessions_expiry_idx
  on private.customer_portal_sessions (idle_expires_at, absolute_expires_at)
  where revoked_at is null;

create table private.customer_booking_trusts (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  secret_digest text not null unique check (length(secret_digest) between 32 and 256),
  key_version integer not null check (key_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  device_label text check (device_label is null or length(device_label) <= 80),
  check (idle_expires_at <= absolute_expires_at)
);

create index customer_booking_trusts_subject_idx
  on private.customer_booking_trusts (tenant_id, customer_id, last_seen_at desc);

create table private.customer_portal_challenges (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  purpose text not null check (purpose in ('recovery', 'contact_change')),
  channel text not null check (channel in ('sms', 'email')),
  subject_digest text not null check (length(subject_digest) between 32 and 256),
  contact_digest text not null check (length(contact_digest) between 32 and 256),
  code_digest text not null check (length(code_digest) between 32 and 256),
  key_version integer not null check (key_version > 0),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts = 5),
  sent_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (expires_at > created_at)
);

create index customer_portal_challenges_subject_idx
  on private.customer_portal_challenges (tenant_id, subject_digest, created_at desc);
create index customer_portal_challenges_expiry_idx
  on private.customer_portal_challenges (expires_at)
  where consumed_at is null and revoked_at is null;

create table private.customer_portal_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  session_id uuid references private.customer_portal_sessions(id) on delete set null,
  event_type text not null,
  entity_public_id uuid,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  check (idempotency_key is null or length(idempotency_key) between 16 and 160),
  check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create unique index customer_portal_audit_idempotency_unique
  on private.customer_portal_audit (tenant_id, event_type, idempotency_key)
  where idempotency_key is not null;
create index customer_portal_audit_subject_idx
  on private.customer_portal_audit (tenant_id, customer_id, created_at desc);

alter table private.customer_portal_links enable row level security;
alter table private.customer_portal_sessions enable row level security;
alter table private.customer_booking_trusts enable row level security;
alter table private.customer_portal_challenges enable row level security;
alter table private.customer_portal_audit enable row level security;

revoke all on table private.customer_portal_links
  from public, anon, authenticated, service_role;
revoke all on table private.customer_portal_sessions
  from public, anon, authenticated, service_role;
revoke all on table private.customer_booking_trusts
  from public, anon, authenticated, service_role;
revoke all on table private.customer_portal_challenges
  from public, anon, authenticated, service_role;
revoke all on table private.customer_portal_audit
  from public, anon, authenticated, service_role;

create or replace function private.customer_portal_mode(p_tenant uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when ts.settings #>> '{customer_portal,mode}' in (
      'off', 'legacy_account', 'passwordless_tenant', 'global_account'
    ) then ts.settings #>> '{customer_portal,mode}'
    else null
  end
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant
$$;

revoke all on function private.customer_portal_mode(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.customer_portal_resolve_session(
  p_session_public_id uuid,
  p_secret_digest text,
  p_now timestamptz default statement_timestamp()
) returns table (
  session_id uuid,
  tenant_id uuid,
  customer_id uuid,
  tenant_slug text,
  tenant_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.tenant_id, s.customer_id, t.slug, t.name
  from private.customer_portal_sessions s
  join public.tenants t
    on t.id = s.tenant_id and t.status = 'active'
  join public.customers c
    on c.id = s.customer_id
   and c.tenant_id = s.tenant_id
   and c.status = 'active'
  join public.tenant_settings ts
    on ts.tenant_id = s.tenant_id
   and ts.settings #>> '{customer_portal,mode}' = 'passwordless_tenant'
  where s.public_id = p_session_public_id
    and s.secret_digest = p_secret_digest
    and s.revoked_at is null
    and s.idle_expires_at > p_now
    and s.absolute_expires_at > p_now
  limit 1
$$;

revoke all on function private.customer_portal_resolve_session(uuid, text, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.customer_portal_mint_link(
  p_tenant uuid,
  p_customer uuid,
  p_purpose text,
  p_token_digest text,
  p_key_version integer,
  p_expires_at timestamptz,
  p_delivery_intent_id uuid default null
) returns table (link_public_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_public_id uuid := gen_random_uuid();
  v_now timestamptz := statement_timestamp();
begin
  if p_tenant is null
     or p_customer is null
     or p_purpose not in ('booking_access', 'recovery', 'contact_change')
     or p_token_digest is null
     or length(p_token_digest) not between 32 and 256
     or p_key_version is null or p_key_version <= 0
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '30 days'
     or private.customer_portal_mode(p_tenant) is distinct from 'passwordless_tenant'
     or not exists (
       select 1
       from public.tenants t
       join public.customers c
         on c.tenant_id = t.id
        and c.id = p_customer
        and c.status = 'active'
       where t.id = p_tenant and t.status = 'active'
     ) then
    raise exception 'customer_portal_link_invalid' using errcode = '22023';
  end if;

  insert into private.customer_portal_links (
    public_id, tenant_id, customer_id, purpose, token_digest,
    key_version, delivery_intent_id, expires_at
  ) values (
    v_public_id, p_tenant, p_customer, p_purpose, p_token_digest,
    p_key_version, p_delivery_intent_id, p_expires_at
  );

  insert into private.customer_portal_audit (
    tenant_id, customer_id, event_type, entity_public_id
  ) values (p_tenant, p_customer, 'link_minted', v_public_id);

  return query select v_public_id, p_expires_at;
end;
$$;

create or replace function public.customer_portal_exchange_link(
  p_link_public_id uuid,
  p_token_digest text,
  p_new_session_public_id uuid,
  p_new_session_digest text,
  p_key_version integer
) returns table (
  outcome text,
  session_public_id uuid,
  tenant_slug text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link private.customer_portal_links%rowtype;
  v_now timestamptz := statement_timestamp();
  v_tenant_slug text;
  v_session_id uuid;
begin
  if p_link_public_id is null
     or p_token_digest is null
     or p_new_session_public_id is null
     or p_new_session_digest is null
     or length(p_new_session_digest) not between 32 and 256
     or p_key_version is null or p_key_version <= 0 then
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  select l.* into v_link
  from private.customer_portal_links l
  where l.public_id = p_link_public_id
  for update;

  if not found
     or v_link.token_digest <> p_token_digest
     or v_link.consumed_at is not null
     or v_link.revoked_at is not null
     or v_link.expires_at <= v_now
     or private.customer_portal_mode(v_link.tenant_id) is distinct from 'passwordless_tenant'
     or not exists (
       select 1
       from public.tenants t
       join public.customers c
         on c.tenant_id = t.id
        and c.id = v_link.customer_id
        and c.status = 'active'
       where t.id = v_link.tenant_id and t.status = 'active'
     ) then
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (
    p_new_session_public_id, v_link.tenant_id, v_link.customer_id,
    p_new_session_digest, p_key_version,
    v_now + interval '180 days', v_now + interval '365 days'
  ) returning id into v_session_id;

  update private.customer_portal_links
  set consumed_at = v_now
  where id = v_link.id and consumed_at is null;

  select t.slug into v_tenant_slug
  from public.tenants t
  where t.id = v_link.tenant_id;

  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type, entity_public_id
  ) values (
    v_link.tenant_id, v_link.customer_id, v_session_id,
    'link_exchanged', v_link.public_id
  );

  return query select 'ok'::text, p_new_session_public_id, v_tenant_slug;
end;
$$;

create or replace function public.customer_portal_session_snapshot(
  p_session_public_id uuid,
  p_secret_digest text,
  p_rotated_secret_digest text default null,
  p_rotated_key_version integer default null
) returns table (outcome text, snapshot jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session private.customer_portal_sessions%rowtype;
  v_now timestamptz := statement_timestamp();
  v_snapshot jsonb;
begin
  if p_rotated_secret_digest is not null
     and (
       length(p_rotated_secret_digest) not between 32 and 256
       or p_rotated_key_version is null
       or p_rotated_key_version <= 0
     ) then
    return query select 'expired'::text, null::jsonb;
    return;
  end if;

  select s.* into v_session
  from private.customer_portal_sessions s
  join public.tenants t on t.id = s.tenant_id and t.status = 'active'
  join public.customers c
    on c.id = s.customer_id
   and c.tenant_id = s.tenant_id
   and c.status = 'active'
  where s.public_id = p_session_public_id
    and s.secret_digest = p_secret_digest
    and s.revoked_at is null
    and s.idle_expires_at > v_now
    and s.absolute_expires_at > v_now
    and private.customer_portal_mode(s.tenant_id) = 'passwordless_tenant'
  for update of s;

  if not found then
    return query select 'expired'::text, null::jsonb;
    return;
  end if;

  if p_rotated_secret_digest is not null then
    update private.customer_portal_sessions
    set secret_digest = p_rotated_secret_digest,
        key_version = p_rotated_key_version,
        last_seen_at = v_now,
        idle_expires_at = least(v_now + interval '180 days', absolute_expires_at)
    where id = v_session.id;
  elsif v_session.last_seen_at <= v_now - interval '15 minutes' then
    update private.customer_portal_sessions
    set last_seen_at = v_now,
        idle_expires_at = least(v_now + interval '180 days', absolute_expires_at)
    where id = v_session.id;
  end if;

  select pg_catalog.jsonb_build_object(
    'tenantSlug', t.slug,
    'tenantName', t.name,
    'customerName', case
      when c.name_hidden then coalesce(c.display_name, '')
      else coalesce(c.display_name, c.full_name, '')
    end,
    'lastSeenAt', v_now,
    'absoluteExpiresAt', v_session.absolute_expires_at
  ) into v_snapshot
  from public.tenants t
  join public.customers c on c.id = v_session.customer_id and c.tenant_id = t.id
  where t.id = v_session.tenant_id;

  return query select 'ok'::text, v_snapshot;
end;
$$;

create or replace function public.customer_portal_list_bookings(
  p_session_public_id uuid,
  p_secret_digest text,
  p_scope text default 'upcoming',
  p_cursor_start timestamptz default null,
  p_cursor_id uuid default null,
  p_page_size integer default 20
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_limit integer := least(greatest(p_page_size, 1), 20);
  v_items jsonb;
  v_now timestamptz := statement_timestamp();
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, v_now
  );
  if not found or p_scope not in ('upcoming', 'history') then
    return pg_catalog.jsonb_build_object('outcome', 'expired', 'items', '[]'::jsonb);
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', q.id,
        'startAt', q.start_ts,
        'endAt', q.end_ts,
        'status', q.status,
        'serviceName', q.service_name,
        'staffName', q.staff_name,
        'locationName', q.location_name,
        'locationAddress', q.location_address,
        'priceCents', q.price_cents,
        'currency', q.currency
      ) order by
        case when p_scope = 'upcoming' then q.start_ts end asc,
        case when p_scope = 'history' then q.start_ts end desc,
        q.id
    ),
    '[]'::jsonb
  ) into v_items
  from (
    select
      b.id,
      b.start_ts,
      b.end_ts,
      b.status,
      sv.name as service_name,
      coalesce(st.short_name, st.title, '') as staff_name,
      l.name as location_name,
      l.address as location_address,
      b.price_cents,
      upper(coalesce(pay.currency, 'sek')) as currency
    from public.bookings b
    join public.services sv
      on sv.id = b.service_id and sv.tenant_id = b.tenant_id
    join public.staff st
      on st.id = b.staff_id and st.tenant_id = b.tenant_id
    left join public.locations l
      on l.id = b.location_id and l.tenant_id = b.tenant_id
    left join public.payments pay
      on pay.booking_id = b.id and pay.tenant_id = b.tenant_id
    where b.tenant_id = v_session.tenant_id
      and b.customer_id = v_session.customer_id
      and (
        (p_scope = 'upcoming' and b.start_ts >= v_now and b.status in ('pending', 'confirmed'))
        or
        (p_scope = 'history' and (b.start_ts < v_now or b.status in ('cancelled', 'completed', 'no_show')))
      )
      and (
        p_cursor_start is null
        or (p_scope = 'upcoming' and (b.start_ts, b.id) > (p_cursor_start, p_cursor_id))
        or (p_scope = 'history' and (b.start_ts, b.id) < (p_cursor_start, p_cursor_id))
      )
    order by
      case when p_scope = 'upcoming' then b.start_ts end asc,
      case when p_scope = 'history' then b.start_ts end desc,
      b.id
    limit v_limit
  ) q;

  return pg_catalog.jsonb_build_object(
    'outcome', 'ok',
    'scope', p_scope,
    'pageSize', v_limit,
    'items', v_items
  );
end;
$$;

create or replace function public.customer_portal_get_booking(
  p_session_public_id uuid,
  p_secret_digest text,
  p_booking_public_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_booking jsonb;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  select pg_catalog.jsonb_build_object(
    'id', b.id,
    'startAt', b.start_ts,
    'endAt', b.end_ts,
    'status', b.status,
    'serviceName', sv.name,
    'staffName', coalesce(st.short_name, st.title, ''),
    'locationName', l.name,
    'locationAddress', l.address,
    'priceCents', b.price_cents,
    'currency', upper(coalesce(pay.currency, 'sek'))
  ) into v_booking
  from public.bookings b
  join public.services sv
    on sv.id = b.service_id and sv.tenant_id = b.tenant_id
  join public.staff st
    on st.id = b.staff_id and st.tenant_id = b.tenant_id
  left join public.locations l
    on l.id = b.location_id and l.tenant_id = b.tenant_id
  left join public.payments pay
    on pay.booking_id = b.id and pay.tenant_id = b.tenant_id
  where b.id = p_booking_public_id
    and b.tenant_id = v_session.tenant_id
    and b.customer_id = v_session.customer_id;

  if v_booking is null then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;
  return pg_catalog.jsonb_build_object('outcome', 'ok', 'booking', v_booking);
end;
$$;

create or replace function public.customer_portal_cancel_booking(
  p_session_public_id uuid,
  p_secret_digest text,
  p_booking_public_id uuid,
  p_expected_cutoff_hours integer,
  p_idempotency_key text
) returns table (outcome text, booking_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_booking public.bookings%rowtype;
  v_now timestamptz := statement_timestamp();
  v_cutoff integer := 24;
  v_setting text;
  v_event_key text;
begin
  if p_idempotency_key is null
     or length(p_idempotency_key) not between 16 and 160 then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, v_now
  );
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if exists (
    select 1 from private.customer_portal_audit a
    where a.tenant_id = v_session.tenant_id
      and a.customer_id = v_session.customer_id
      and a.event_type = 'booking_cancelled'
      and a.idempotency_key = p_idempotency_key
      and a.entity_public_id = p_booking_public_id
  ) then
    return query select 'cancelled'::text, 'cancelled'::text;
    return;
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_public_id
    and b.tenant_id = v_session.tenant_id
    and b.customer_id = v_session.customer_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;
  if v_booking.status = 'cancelled' then
    return query select 'already_cancelled'::text, 'cancelled'::text;
    return;
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    return query select 'not_allowed'::text, v_booking.status;
    return;
  end if;

  select ts.settings ->> 'cancellation_cutoff_hours' into v_setting
  from public.tenant_settings ts
  where ts.tenant_id = v_session.tenant_id;
  if v_setting ~ '^[0-9]{1,4}$' then
    v_cutoff := greatest(0, v_setting::integer);
  end if;

  if p_expected_cutoff_hours is distinct from v_cutoff then
    return query select 'policy_changed'::text, v_booking.status;
    return;
  end if;
  if v_booking.start_ts <= v_now + pg_catalog.make_interval(hours => v_cutoff) then
    return query select 'not_allowed'::text, v_booking.status;
    return;
  end if;

  update public.bookings b
  set status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = 'customer'
  where b.id = v_booking.id
    and b.tenant_id = v_session.tenant_id
    and b.customer_id = v_session.customer_id
    and b.status in ('pending', 'confirmed');

  if not found then
    return query select 'already_cancelled'::text, 'cancelled'::text;
    return;
  end if;

  v_event_key := 'booking:' || v_booking.id::text || ':cancelled';
  perform 1
  from public.route_booking_notification(
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

  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type,
    entity_public_id, idempotency_key
  ) values (
    v_session.tenant_id, v_session.customer_id, v_session.session_id,
    'booking_cancelled', v_booking.id, p_idempotency_key
  ) on conflict (tenant_id, event_type, idempotency_key) where idempotency_key is not null
    do nothing;

  return query select 'cancelled'::text, 'cancelled'::text;
end;
$$;

create or replace function public.customer_portal_update_name(
  p_session_public_id uuid,
  p_secret_digest text,
  p_display_name text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_name text := nullif(btrim(p_display_name), '');
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );
  if not found or v_name is null or length(v_name) > 120 then
    return 'invalid';
  end if;

  update public.customers c
  set display_name = v_name,
      updated_at = statement_timestamp()
  where c.id = v_session.customer_id
    and c.tenant_id = v_session.tenant_id
    and c.status = 'active';

  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type
  ) values (
    v_session.tenant_id, v_session.customer_id, v_session.session_id,
    'profile_name_updated'
  );
  return 'ok';
end;
$$;

create or replace function public.customer_portal_create_challenge(
  p_tenant uuid,
  p_customer uuid,
  p_public_id uuid,
  p_purpose text,
  p_channel text,
  p_subject_digest text,
  p_contact_digest text,
  p_code_digest text,
  p_key_version integer,
  p_expires_at timestamptz
) returns table (outcome text, challenge_public_id uuid, should_deliver boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  if p_tenant is null
     or p_public_id is null
     or p_purpose not in ('recovery', 'contact_change')
     or p_channel not in ('sms', 'email')
     or p_subject_digest is null
     or length(p_subject_digest) not between 32 and 256
     or p_contact_digest is null
     or length(p_contact_digest) not between 32 and 256
     or p_code_digest is null
     or length(p_code_digest) not between 32 and 256
     or p_key_version is null or p_key_version <= 0
     or p_expires_at is null
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '5 minutes'
     or private.customer_portal_mode(p_tenant) is distinct from 'passwordless_tenant'
     or (
       p_customer is not null and not exists (
         select 1 from public.customers c
         where c.id = p_customer
           and c.tenant_id = p_tenant
           and c.status = 'active'
       )
     ) then
    return query select 'accepted'::text, p_public_id, false;
    return;
  end if;

  -- Serialize the subject before checking cooldown. The HTTP response stays
  -- neutral; should_deliver is service-only transport control and is never
  -- reflected to the browser.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_subject_digest, 0)
  );

  if exists (
    select 1 from private.customer_portal_challenges c
    where c.tenant_id = p_tenant
      and c.subject_digest = p_subject_digest
      and c.created_at > v_now - interval '30 seconds'
  ) then
    return query select 'accepted'::text, p_public_id, false;
    return;
  end if;

  update private.customer_portal_challenges c
  set revoked_at = v_now
  where c.tenant_id = p_tenant
    and c.subject_digest = p_subject_digest
    and c.purpose = p_purpose
    and c.consumed_at is null
    and c.revoked_at is null;

  insert into private.customer_portal_challenges (
    public_id, tenant_id, customer_id, purpose, channel,
    subject_digest, contact_digest, code_digest, key_version, expires_at
  ) values (
    p_public_id, p_tenant, p_customer, p_purpose, p_channel,
    p_subject_digest, p_contact_digest, p_code_digest, p_key_version, p_expires_at
  );

  return query select 'accepted'::text, p_public_id, true;
end;
$$;

create or replace function public.customer_portal_verify_challenge(
  p_challenge_public_id uuid,
  p_subject_digest text,
  p_code_digest text
) returns table (outcome text, attempts_remaining integer, customer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.customer_portal_challenges%rowtype;
  v_now timestamptz := statement_timestamp();
begin
  select c.* into v_challenge
  from private.customer_portal_challenges c
  where c.public_id = p_challenge_public_id
  for update;

  if not found
     or v_challenge.subject_digest is distinct from p_subject_digest
     or v_challenge.consumed_at is not null
     or v_challenge.revoked_at is not null
     or v_challenge.expires_at <= v_now
     or v_challenge.attempt_count >= v_challenge.max_attempts
     or private.customer_portal_mode(v_challenge.tenant_id) is distinct from 'passwordless_tenant' then
    return query select 'invalid'::text, 0, null::uuid;
    return;
  end if;

  if v_challenge.code_digest is distinct from p_code_digest then
    update private.customer_portal_challenges c
    set attempt_count = least(c.attempt_count + 1, c.max_attempts),
        revoked_at = case
          when c.attempt_count + 1 >= c.max_attempts then v_now
          else c.revoked_at
        end
    where c.id = v_challenge.id;
    return query select
      'invalid'::text,
      greatest(v_challenge.max_attempts - v_challenge.attempt_count - 1, 0),
      null::uuid;
    return;
  end if;

  update private.customer_portal_challenges c
  set consumed_at = v_now
  where c.id = v_challenge.id and c.consumed_at is null;
  return query select 'verified'::text,
    greatest(v_challenge.max_attempts - v_challenge.attempt_count, 0),
    v_challenge.customer_id;
end;
$$;

create or replace function public.customer_portal_revoke_session(
  p_session_public_id uuid,
  p_secret_digest text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );
  if not found then
    return 'ok';
  end if;
  update private.customer_portal_sessions
  set revoked_at = statement_timestamp()
  where id = v_session.session_id and revoked_at is null;
  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type
  ) values (
    v_session.tenant_id, v_session.customer_id, v_session.session_id,
    'session_revoked'
  );
  return 'ok';
end;
$$;

create or replace function public.customer_portal_revoke_other_sessions(
  p_session_public_id uuid,
  p_secret_digest text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_count integer := 0;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );
  if not found then return 0; end if;
  update private.customer_portal_sessions s
  set revoked_at = statement_timestamp()
  where s.tenant_id = v_session.tenant_id
    and s.customer_id = v_session.customer_id
    and s.id <> v_session.session_id
    and s.revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.customer_portal_revoke_booking_trusts(
  p_session_public_id uuid,
  p_secret_digest text,
  p_trust_public_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_count integer := 0;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );
  if not found then return 0; end if;
  update private.customer_booking_trusts t
  set revoked_at = statement_timestamp()
  where t.tenant_id = v_session.tenant_id
    and t.customer_id = v_session.customer_id
    and (p_trust_public_id is null or t.public_id = p_trust_public_id)
    and t.revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

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

revoke all on function public.customer_portal_mint_link(
  uuid, uuid, text, text, integer, timestamptz, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_mint_link(
  uuid, uuid, text, text, integer, timestamptz, uuid
) to service_role;

revoke all on function public.customer_portal_exchange_link(
  uuid, text, uuid, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_exchange_link(
  uuid, text, uuid, text, integer
) to service_role;

revoke all on function public.customer_portal_session_snapshot(
  uuid, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_session_snapshot(
  uuid, text, text, integer
) to service_role;

revoke all on function public.customer_portal_list_bookings(
  uuid, text, text, timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_list_bookings(
  uuid, text, text, timestamptz, uuid, integer
) to service_role;

revoke all on function public.customer_portal_get_booking(
  uuid, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_get_booking(
  uuid, text, uuid
) to service_role;

revoke all on function public.customer_portal_cancel_booking(
  uuid, text, uuid, integer, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_cancel_booking(
  uuid, text, uuid, integer, text
) to service_role;

revoke all on function public.customer_portal_update_name(
  uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_update_name(
  uuid, text, text
) to service_role;

revoke all on function public.customer_portal_create_challenge(
  uuid, uuid, uuid, text, text, text, text, text, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_create_challenge(
  uuid, uuid, uuid, text, text, text, text, text, integer, timestamptz
) to service_role;

revoke all on function public.customer_portal_verify_challenge(
  uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_verify_challenge(
  uuid, text, text
) to service_role;

revoke all on function public.customer_portal_revoke_session(
  uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_revoke_session(
  uuid, text
) to service_role;

revoke all on function public.customer_portal_revoke_other_sessions(
  uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_revoke_other_sessions(
  uuid, text
) to service_role;

revoke all on function public.customer_portal_revoke_booking_trusts(
  uuid, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_revoke_booking_trusts(
  uuid, text, uuid
) to service_role;

revoke all on function public.customer_portal_gdpr_scrub(
  uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_gdpr_scrub(
  uuid, uuid
) to service_role;
