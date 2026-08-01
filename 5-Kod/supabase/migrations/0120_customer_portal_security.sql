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
  booking_contact_digest text check (
    booking_contact_digest is null or booking_contact_digest ~ '^[a-f0-9]{64}$'
  ),
  contact_masked text check (contact_masked is null or length(contact_masked) between 3 and 200),
  code_digest text not null check (length(code_digest) between 32 and 256),
  key_version integer not null check (key_version > 0),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts = 5),
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz,
  failed_at timestamptz,
  recovery_outbox_id uuid references public.notifications_outbox(id) on delete set null,
  resend_after timestamptz not null default (statement_timestamp() + interval '30 seconds'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (expires_at > created_at),
  check (
    (delivery_state = 'pending' and delivered_at is null and failed_at is null)
    or (delivery_state = 'delivered' and delivered_at is not null and failed_at is null)
    or (delivery_state = 'failed' and delivered_at is null and failed_at is not null)
  )
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
) returns table (outcome text, snapshot jsonb, recovery_tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session private.customer_portal_sessions%rowtype;
  v_now timestamptz := statement_timestamp();
  v_snapshot jsonb;
  v_recovery_tenant_slug text;
begin
  select s.* into v_session
  from private.customer_portal_sessions s
  join public.tenants t on t.id = s.tenant_id and t.status = 'active'
  where s.public_id = p_session_public_id
    and s.secret_digest = p_secret_digest
    and private.customer_portal_mode(s.tenant_id) = 'passwordless_tenant'
  for update of s;

  if not found then
    return query select 'expired'::text, null::jsonb, null::text;
    return;
  end if;

  select t.slug into v_recovery_tenant_slug
  from public.tenants t
  where t.id = v_session.tenant_id and t.status = 'active';

  if v_session.revoked_at is not null
     or v_session.idle_expires_at <= v_now
     or v_session.absolute_expires_at <= v_now
     or not exists (
       select 1 from public.customers c
       where c.id = v_session.customer_id
         and c.tenant_id = v_session.tenant_id
         and c.status = 'active'
     )
     or (
       p_rotated_secret_digest is not null and (
         length(p_rotated_secret_digest) not between 32 and 256
         or p_rotated_key_version is null
         or p_rotated_key_version <= 0
       )
     ) then
    return query select 'expired'::text, null::jsonb, v_recovery_tenant_slug;
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

  -- Portal v1 platform defaults are deliberately explicit until tenant locale/
  -- country/currency become canonical columns: sv-SE, SE, SEK, Europe/Stockholm.
  -- Optional identity fields are null unless backed by validated stored data.
  select pg_catalog.jsonb_build_object(
    'tenantSlug', t.slug,
    'tenantName', t.name,
    'logoUrl', case
      when pg_catalog.length(ts.branding ->> 'logo_url') between 9 and 2008
       and ts.branding ->> 'logo_url' ~* '^https://[^[:space:]]+$'
        then ts.branding ->> 'logo_url'
      else null
    end,
    'verticalLabel', nullif(btrim(v.name), ''),
    'phone', case
      when ts.settings #>> '{contact,phone}' ~ '^\+?[0-9][0-9 ()-]{3,39}$'
        then btrim(ts.settings #>> '{contact,phone}')
      else null
    end,
    'address', nullif(btrim(loc.address), ''),
    'mapUrl', case
      when loc.address is not null
       and ts.settings #>> '{map,q}' = loc.address
       and case when pg_catalog.jsonb_typeof(ts.settings #> '{map,lat}') = 'number'
                then (ts.settings #>> '{map,lat}')::numeric between -90 and 90
                else false end
       and case when pg_catalog.jsonb_typeof(ts.settings #> '{map,lon}') = 'number'
                then (ts.settings #>> '{map,lon}')::numeric between -180 and 180
                else false end
        then pg_catalog.format(
          'https://www.openstreetmap.org/?mlat=%s&mlon=%s',
          ts.settings #>> '{map,lat}', ts.settings #>> '{map,lon}'
        )
      else null
    end,
    'bookingOrigin', 'https://' || case
      when dom.domain is not null then dom.domain
      when lower(t.slug) ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
        or lower(t.slug) ~ '^[a-z0-9]$'
        then lower(t.slug) || '.corevo.se'
      else null
    end,
    'timezone', coalesce(nullif(btrim(loc.timezone), ''), 'Europe/Stockholm'),
    'locale', 'sv-SE'::text,
    'defaultCountry', 'SE'::text,
    'currency', 'SEK'::text,
    'cancellationCutoffHours', case
      when ts.settings ->> 'cancellation_cutoff_hours' ~ '^[0-9]{1,4}$'
        then greatest(0, (ts.settings ->> 'cancellation_cutoff_hours')::integer)
      else 24
    end,
    'customerName', case
      when c.name_hidden then coalesce(c.display_name, '')
      else coalesce(c.display_name, c.full_name, '')
    end,
    'lastSeenAt', v_now,
    'absoluteExpiresAt', v_session.absolute_expires_at
  ) into v_snapshot
  from public.tenants t
  join public.customers c on c.id = v_session.customer_id and c.tenant_id = t.id
  left join public.tenant_settings ts on ts.tenant_id = t.id
  left join public.verticals v on v.key = t.vertical_id
  left join lateral (
    select l.address, l.timezone
    from public.locations l
    where l.tenant_id = t.id and l.is_primary and l.active
    order by l.created_at, l.id
    limit 1
  ) loc on true
  left join lateral (
    select lower(d.domain) as domain
    from public.tenant_domains d
    where d.tenant_id = t.id
      and d.verified and d.is_primary
      and lower(d.domain) ~ '^[a-z0-9][a-z0-9.-]{1,251}[a-z0-9]$'
      and pg_catalog.strpos(lower(d.domain), '.') > 0
      and pg_catalog.strpos(lower(d.domain), '..') = 0
    order by d.created_at, d.id
    limit 1
  ) dom on true
  where t.id = v_session.tenant_id;

  return query select 'ok'::text, v_snapshot, null::text;
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
  v_has_more boolean := false;
  v_next_cursor jsonb;
  v_now timestamptz := statement_timestamp();
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, v_now
  );
  if not found
     or p_scope not in ('upcoming', 'history')
     or ((p_cursor_start is null) <> (p_cursor_id is null)) then
    return pg_catalog.jsonb_build_object('outcome', 'expired', 'items', '[]'::jsonb);
  end if;

  with fetched as (
    select
      b.id,
      b.start_ts,
      b.end_ts,
      b.status,
      sv.name as service_name,
      coalesce(st.short_name, st.title, '') as staff_title,
      l.name as location_name,
      l.address as location_address,
      l.timezone as location_timezone,
      b.price_cents,
      upper(coalesce(pay.currency, 'sek')) as currency,
      greatest(0, floor(extract(epoch from (b.end_ts - b.start_ts)) / 60)::integer) as duration_minutes,
      b.status in ('pending', 'confirmed')
        and b.start_ts > v_now + pg_catalog.make_interval(hours => policy.cutoff_hours)
        as can_cancel,
      case when b.status in ('pending', 'confirmed')
        then b.start_ts - pg_catalog.make_interval(hours => policy.cutoff_hours)
        else null
      end as cancel_deadline,
      case when t.status = 'active' and sv.active and (
        dom.domain is not null
        or lower(t.slug) ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
        or lower(t.slug) ~ '^[a-z0-9]$'
      )
        then 'https://' || coalesce(dom.domain, lower(t.slug) || '.corevo.se') || '/boka'
        else null
      end as public_rebook_url,
      row_number() over (order by
        case when p_scope = 'upcoming' then b.start_ts end asc,
        case when p_scope = 'history' then b.start_ts end desc,
        case when p_scope = 'upcoming' then b.id end asc,
        case when p_scope = 'history' then b.id end desc
      ) as row_number
    from public.bookings b
    join public.services sv
      on sv.id = b.service_id and sv.tenant_id = b.tenant_id
    join public.staff st
      on st.id = b.staff_id and st.tenant_id = b.tenant_id
    left join public.locations l
      on l.id = b.location_id and l.tenant_id = b.tenant_id
    join public.tenants t on t.id = b.tenant_id
    left join public.tenant_settings ts on ts.tenant_id = b.tenant_id
    cross join lateral (
      select case
        when ts.settings ->> 'cancellation_cutoff_hours' ~ '^[0-9]{1,4}$'
          then greatest(0, (ts.settings ->> 'cancellation_cutoff_hours')::integer)
        else 24
      end as cutoff_hours
    ) policy
    left join lateral (
      select p.currency
      from public.payments p
      where p.booking_id = b.id and p.tenant_id = b.tenant_id
      order by p.created_at desc, p.id desc
      limit 1
    ) pay on true
    left join lateral (
      select lower(d.domain) as domain
      from public.tenant_domains d
      where d.tenant_id = b.tenant_id
        and d.verified and d.is_primary
        and lower(d.domain) ~ '^[a-z0-9][a-z0-9.-]{1,251}[a-z0-9]$'
        and pg_catalog.strpos(lower(d.domain), '.') > 0
        and pg_catalog.strpos(lower(d.domain), '..') = 0
      order by d.created_at, d.id
      limit 1
    ) dom on true
    where b.tenant_id = v_session.tenant_id
      and b.customer_id = v_session.customer_id
      and (
        (p_scope = 'upcoming' and b.start_ts >= v_now and b.status in ('pending', 'confirmed'))
        or
        (p_scope = 'history' and (b.start_ts < v_now or b.status not in ('pending', 'confirmed')))
      )
      and (
        p_cursor_start is null
        or (p_scope = 'upcoming' and (b.start_ts, b.id) > (p_cursor_start, p_cursor_id))
        or (p_scope = 'history' and (b.start_ts, b.id) < (p_cursor_start, p_cursor_id))
      )
    order by
      case when p_scope = 'upcoming' then b.start_ts end asc,
      case when p_scope = 'history' then b.start_ts end desc,
      case when p_scope = 'upcoming' then b.id end asc,
      case when p_scope = 'history' then b.id end desc
    limit v_limit + 1
  )
  select
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', f.id,
          'startTs', f.start_ts,
          'endTs', f.end_ts,
          'status', f.status,
          'serviceName', f.service_name,
          'durationMinutes', f.duration_minutes,
          'staffTitle', f.staff_title,
          'location', case when f.location_timezone is null then null else
            pg_catalog.jsonb_build_object(
              'name', f.location_name,
              'address', f.location_address,
              'phone', null,
              'mapUrl', null,
              'timezone', f.location_timezone
            ) end,
          'priceCents', f.price_cents,
          'currency', f.currency,
          'canCancel', f.can_cancel,
          'cancelDeadline', f.cancel_deadline,
          'publicRebookUrl', f.public_rebook_url
        ) order by f.row_number
      ) filter (where f.row_number <= v_limit),
      '[]'::jsonb
    ),
    count(*) > v_limit,
    case when count(*) > v_limit then
      (pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('startTs', f.start_ts, 'id', f.id)
        order by f.row_number
      ) filter (where f.row_number = v_limit)) -> 0
    else null end
  into v_items, v_has_more, v_next_cursor
  from fetched f;

  return pg_catalog.jsonb_build_object(
    'outcome', 'ok',
    'scope', p_scope,
    'pageSize', v_limit,
    'items', v_items,
    'hasMore', v_has_more,
    'nextCursor', v_next_cursor
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
  v_now timestamptz := statement_timestamp();
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, v_now
  );
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  select pg_catalog.jsonb_build_object(
    'id', b.id,
    'startTs', b.start_ts,
    'endTs', b.end_ts,
    'status', b.status,
    'serviceName', sv.name,
    'durationMinutes', greatest(0, floor(extract(epoch from (b.end_ts - b.start_ts)) / 60)::integer),
    'staffTitle', coalesce(st.short_name, st.title, ''),
    'location', case when l.id is null then null else pg_catalog.jsonb_build_object(
      'name', l.name,
      'address', l.address,
      'phone', null,
      'mapUrl', null,
      'timezone', l.timezone
    ) end,
    'priceCents', b.price_cents,
    'currency', upper(coalesce(pay.currency, 'sek')),
    'canCancel', b.status in ('pending', 'confirmed')
      and b.start_ts > v_now + pg_catalog.make_interval(hours => policy.cutoff_hours),
    'cancelDeadline', case when b.status in ('pending', 'confirmed')
      then b.start_ts - pg_catalog.make_interval(hours => policy.cutoff_hours)
      else null
    end,
    'publicRebookUrl', case when t.status = 'active' and sv.active and (
      dom.domain is not null
      or lower(t.slug) ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
      or lower(t.slug) ~ '^[a-z0-9]$'
    )
      then 'https://' || coalesce(dom.domain, lower(t.slug) || '.corevo.se') || '/boka'
      else null
    end
  ) into v_booking
  from public.bookings b
  join public.services sv
    on sv.id = b.service_id and sv.tenant_id = b.tenant_id
  join public.staff st
    on st.id = b.staff_id and st.tenant_id = b.tenant_id
  left join public.locations l
    on l.id = b.location_id and l.tenant_id = b.tenant_id
  join public.tenants t on t.id = b.tenant_id
  left join public.tenant_settings ts on ts.tenant_id = b.tenant_id
  cross join lateral (
    select case
      when ts.settings ->> 'cancellation_cutoff_hours' ~ '^[0-9]{1,4}$'
        then greatest(0, (ts.settings ->> 'cancellation_cutoff_hours')::integer)
      else 24
    end as cutoff_hours
  ) policy
  left join lateral (
    select p.currency
    from public.payments p
    where p.booking_id = b.id and p.tenant_id = b.tenant_id
    order by p.created_at desc, p.id desc
    limit 1
  ) pay on true
  left join lateral (
    select lower(d.domain) as domain
    from public.tenant_domains d
    where d.tenant_id = b.tenant_id
      and d.verified and d.is_primary
      and lower(d.domain) ~ '^[a-z0-9][a-z0-9.-]{1,251}[a-z0-9]$'
      and pg_catalog.strpos(lower(d.domain), '.') > 0
      and pg_catalog.strpos(lower(d.domain), '..') = 0
    order by d.created_at, d.id
    limit 1
  ) dom on true
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

create or replace function private.customer_portal_normalize_recovery_lookup(p_lookup text)
returns table (channel text, normalized text, masked text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value text := pg_catalog.btrim(p_lookup);
  v_compact text;
  v_local text;
  v_domain text;
begin
  if v_value is null or pg_catalog.length(v_value) not between 3 and 200 then
    return;
  end if;
  if pg_catalog.strpos(v_value, '@') > 0 then
    v_value := pg_catalog.lower(v_value);
    if v_value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return; end if;
    v_local := pg_catalog.split_part(v_value, '@', 1);
    v_domain := pg_catalog.split_part(v_value, '@', 2);
    return query select 'email'::text, v_value,
      pg_catalog.left(v_local, 1) || '•••@' || v_domain;
    return;
  end if;

  v_compact := pg_catalog.regexp_replace(v_value, '[[:space:]()\-]', '', 'g');
  if v_compact ~ '^00[0-9]{8,15}$' then
    v_compact := '+' || pg_catalog.substr(v_compact, 3);
  elsif v_compact ~ '^0[0-9]{8,9}$' then
    v_compact := '+46' || pg_catalog.substr(v_compact, 2);
  end if;
  if v_compact !~ '^\+[0-9]{8,15}$' then return; end if;
  return query select 'sms'::text, v_compact,
    pg_catalog.left(v_compact, 3) || ' ••• •• ' || pg_catalog.right(v_compact, 2);
end;
$$;

revoke all on function private.customer_portal_normalize_recovery_lookup(text)
  from public, anon, authenticated, service_role;

create or replace function public.customer_portal_start_recovery(
  p_tenant_slug text,
  p_lookup text,
  p_booking_contact_digest text,
  p_public_id uuid,
  p_subject_digest text,
  p_contact_digest text,
  p_code_digest text,
  p_key_version integer,
  p_expires_at timestamptz
) returns table (
  outcome text,
  challenge_public_id uuid,
  created boolean,
  outbox_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_tenant_id uuid;
  v_tenant_name text;
  v_channel text;
  v_normalized text;
  v_masked text;
  v_customer_id uuid;
  v_candidate_count integer := 0;
  v_outbox_id uuid;
begin
  select t.id, t.name into v_tenant_id, v_tenant_name
  from public.tenants t
  where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
    and t.status = 'active'
    and private.customer_portal_mode(t.id) = 'passwordless_tenant';

  select n.channel, n.normalized, n.masked into v_channel, v_normalized, v_masked
  from private.customer_portal_normalize_recovery_lookup(p_lookup) n;

  if v_tenant_id is null or v_channel is null or p_public_id is null
     or p_booking_contact_digest !~ '^[a-f0-9]{64}$'
     or p_subject_digest !~ '^[a-f0-9]{64}$'
     or p_contact_digest !~ '^[a-f0-9]{64}$'
     or p_code_digest !~ '^[a-f0-9]{64}$'
     or p_key_version <> 1
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '5 minutes' then
    return query select 'accepted'::text, null::uuid, false, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_tenant_id::text || ':' || p_contact_digest, 0)
  );
  if exists (
    select 1 from private.customer_portal_challenges pc
    where pc.tenant_id = v_tenant_id
      and pc.purpose = 'recovery'
      and pc.contact_digest = p_contact_digest
      and pc.created_at > v_now - interval '30 seconds'
  ) then
    return query select 'cooldown'::text, null::uuid, false, null::uuid;
    return;
  end if;

  select candidate.customer_id, candidate.candidate_count
    into v_customer_id, v_candidate_count
  from (
    select c.id as customer_id, count(*) over () as candidate_count
    from public.customers c
    cross join lateral private.customer_portal_normalize_recovery_lookup(
      case when v_channel = 'sms' then c.phone else c.email end
    ) verified
    where c.tenant_id = v_tenant_id
      and c.status = 'active'
      and verified.channel = v_channel
      and verified.normalized = v_normalized
      and exists (
        select 1
        from private.booking_verification_challenges bv
        join public.bookings b
          on b.id = bv.booking_id
         and b.tenant_id = v_tenant_id
         and b.customer_id = c.id
        where bv.tenant_id = v_tenant_id
          and bv.channel = v_channel
          and bv.contact_digest = p_booking_contact_digest
          and bv.delivery_state = 'delivered'
          and bv.consumed_at is not null
      )
  ) candidate
  order by candidate.customer_id
  limit 1;
  if v_candidate_count <> 1 then
    v_customer_id := null;
  end if;

  update private.customer_portal_challenges pc
  set revoked_at = v_now
  where pc.tenant_id = v_tenant_id
    and pc.purpose = 'recovery'
    and pc.contact_digest = p_contact_digest
    and pc.consumed_at is null
    and pc.revoked_at is null;

  insert into private.customer_portal_challenges (
    public_id, tenant_id, customer_id, purpose, channel,
    subject_digest, contact_digest, booking_contact_digest, contact_masked,
    code_digest, key_version, expires_at
  ) values (
    p_public_id, v_tenant_id, v_customer_id, 'recovery', v_channel,
    p_subject_digest, p_contact_digest,
    case when v_customer_id is null then null else p_booking_contact_digest end,
    v_masked, p_code_digest, p_key_version, p_expires_at
  );

  select queued.id into v_outbox_id
  from public.enqueue_notification(
    v_tenant_id,
    null,
    null,
    null,
    'customer_portal_recovery_code',
    'customer-portal-recovery:' || p_public_id::text,
    'transactional',
    v_channel,
    null,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object(
      'template', 'customer_portal_recovery_code',
      'challenge_id', p_public_id
    ),
    5
  ) queued;
  if v_outbox_id is null then
    raise exception 'customer_portal_recovery_enqueue_failed' using errcode = '55000';
  end if;
  update private.customer_portal_challenges pc
  set recovery_outbox_id = v_outbox_id
  where pc.public_id = p_public_id;

  return query select 'accepted'::text, p_public_id, true, v_outbox_id;
end;
$$;

create or replace function public.customer_portal_record_recovery_delivery(
  p_challenge_public_id uuid,
  p_subject_digest text,
  p_booking_contact_digest text,
  p_delivered boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.customer_portal_challenges%rowtype;
  v_now timestamptz := statement_timestamp();
  v_delivered boolean;
begin
  select pc.* into v_challenge
  from private.customer_portal_challenges pc
  where pc.public_id = p_challenge_public_id
    and pc.purpose = 'recovery'
  for update;
  if not found
     or v_challenge.subject_digest is distinct from p_subject_digest
     or v_challenge.delivery_state <> 'pending'
     or v_challenge.consumed_at is not null
     or v_challenge.revoked_at is not null
     or v_challenge.expires_at <= v_now then
    return 'invalid';
  end if;
  v_delivered := p_delivered is true
    and v_challenge.customer_id is not null
    and v_challenge.booking_contact_digest is not null
    and v_challenge.booking_contact_digest = p_booking_contact_digest
    and exists (
      select 1
      from private.booking_verification_challenges bv
      join public.bookings b
        on b.id = bv.booking_id
       and b.tenant_id = v_challenge.tenant_id
       and b.customer_id = v_challenge.customer_id
      where bv.tenant_id = v_challenge.tenant_id
        and bv.channel = v_challenge.channel
        and bv.contact_digest = v_challenge.booking_contact_digest
        and bv.delivery_state = 'delivered'
        and bv.consumed_at is not null
    );
  update private.customer_portal_challenges pc
  set delivery_state = case when v_delivered then 'delivered' else 'failed' end,
      delivered_at = case when v_delivered then v_now else null end,
      failed_at = case when v_delivered then null else v_now end
  where pc.id = v_challenge.id and pc.delivery_state = 'pending';
  return 'ok';
end;
$$;

-- Dedicated worker lookup. A recipient can be resolved only after the durable
-- outbox lease has crossed begin_notification_delivery; the browser never calls
-- this RPC and the outbox payload remains free of contact data and PINs.
create or replace function public.customer_portal_recovery_delivery_target(
  p_outbox_id uuid,
  p_lease_token uuid
) returns table (
  outcome text,
  challenge_public_id uuid,
  channel text,
  delivery_destination text,
  contact_digest text,
  booking_contact_digest text,
  tenant_name text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select 'target'::text, pc.public_id, pc.channel,
    case when pc.customer_id is null then null
      when pc.channel = 'sms' then c.phone else c.email end,
    pc.contact_digest, pc.booking_contact_digest, t.name, pc.expires_at
  from public.notifications_outbox o
  join private.customer_portal_challenges pc
    on pc.recovery_outbox_id = o.id
   and pc.purpose = 'recovery'
  join public.tenants t
    on t.id = pc.tenant_id
   and t.status = 'active'
  left join public.customers c
    on c.id = pc.customer_id
   and c.tenant_id = pc.tenant_id
   and c.status = 'active'
  where o.id = p_outbox_id
    and o.event_type = 'customer_portal_recovery_code'
    and o.status = 'delivery_started'
    and o.lease_token = p_lease_token
    and o.tenant_id = pc.tenant_id
    and o.chosen_channel = pc.channel
    and o.payload = pg_catalog.jsonb_build_object(
      'template', 'customer_portal_recovery_code',
      'challenge_id', pc.public_id
    )
    and pc.delivery_state = 'pending'
    and pc.consumed_at is null
    and pc.revoked_at is null
    and pc.expires_at > statement_timestamp()
    and private.customer_portal_mode(pc.tenant_id) = 'passwordless_tenant';
end;
$$;

-- The worker generates the PIN only after claiming. Before transport, this CAS
-- re-reads the customer's current destination and revalidates both the recovery
-- HMAC and the consumed Goal-74 proof. A decoy traverses the same leased path.
create or replace function public.customer_portal_prepare_recovery_delivery(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_current_destination text,
  p_current_contact_digest text,
  p_current_booking_contact_digest text,
  p_code_digest text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.customer_portal_challenges%rowtype;
  v_now timestamptz := statement_timestamp();
  v_current_normalized text;
  v_verified_normalized text;
begin
  select pc.* into v_challenge
  from private.customer_portal_challenges pc
  join public.notifications_outbox o
    on o.id = pc.recovery_outbox_id
   and o.tenant_id = pc.tenant_id
  where o.id = p_outbox_id
    and o.event_type = 'customer_portal_recovery_code'
    and o.status = 'delivery_started'
    and o.lease_token = p_lease_token
    and pc.purpose = 'recovery'
  for update of pc;

  if not found
     or v_challenge.delivery_state <> 'pending'
     or v_challenge.consumed_at is not null
     or v_challenge.revoked_at is not null
     or v_challenge.expires_at <= v_now
     or p_code_digest !~ '^[a-f0-9]{64}$' then
    return 'invalid';
  end if;

  if v_challenge.customer_id is null then
    update private.customer_portal_challenges pc
    set code_digest = p_code_digest
    where pc.id = v_challenge.id and pc.delivery_state = 'pending';
    return 'decoy';
  end if;

  select current_contact.normalized, verified.normalized
    into v_current_normalized, v_verified_normalized
  from public.customers c
  cross join lateral private.customer_portal_normalize_recovery_lookup(
    p_current_destination
  ) current_contact
  cross join lateral private.customer_portal_normalize_recovery_lookup(
    case when v_challenge.channel = 'sms' then c.phone else c.email end
  ) verified
  where c.id = v_challenge.customer_id
    and c.tenant_id = v_challenge.tenant_id
    and c.status = 'active'
    and current_contact.channel = v_challenge.channel
    and verified.channel = v_challenge.channel
    and verified.normalized = current_contact.normalized;

  if v_current_normalized is null
     or v_verified_normalized is null
     or v_challenge.contact_digest is distinct from p_current_contact_digest
     or v_challenge.booking_contact_digest is distinct from p_current_booking_contact_digest
     or not exists (
       select 1
       from private.booking_verification_challenges bv
       join public.bookings b
         on b.id = bv.booking_id
        and b.tenant_id = v_challenge.tenant_id
        and b.customer_id = v_challenge.customer_id
       where bv.tenant_id = v_challenge.tenant_id
         and bv.channel = v_challenge.channel
         and bv.contact_digest = v_challenge.booking_contact_digest
         and bv.delivery_state = 'delivered'
         and bv.consumed_at is not null
     ) then
    return 'invalid';
  end if;

  update private.customer_portal_challenges pc
  set code_digest = p_code_digest
  where pc.id = v_challenge.id and pc.delivery_state = 'pending';
  return 'ready';
end;
$$;

create or replace function public.customer_portal_record_recovery_outbox_delivery(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_delivered boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.customer_portal_challenges%rowtype;
  v_now timestamptz := statement_timestamp();
  v_delivered boolean := false;
begin
  select pc.* into v_challenge
  from private.customer_portal_challenges pc
  join public.notifications_outbox o
    on o.id = pc.recovery_outbox_id
   and o.tenant_id = pc.tenant_id
  where o.id = p_outbox_id
    and o.event_type = 'customer_portal_recovery_code'
    and o.status = 'delivery_started'
    and o.lease_token = p_lease_token
    and pc.purpose = 'recovery'
  for update of pc;
  if not found
     or v_challenge.delivery_state <> 'pending'
     or v_challenge.consumed_at is not null
     or v_challenge.revoked_at is not null
     or v_challenge.expires_at <= v_now then
    return 'invalid';
  end if;

  v_delivered := p_delivered is true
    and v_challenge.customer_id is not null
    and v_challenge.booking_contact_digest is not null
    and exists (
      select 1
      from private.booking_verification_challenges bv
      join public.bookings b
        on b.id = bv.booking_id
       and b.tenant_id = v_challenge.tenant_id
       and b.customer_id = v_challenge.customer_id
      where bv.tenant_id = v_challenge.tenant_id
        and bv.channel = v_challenge.channel
        and bv.contact_digest = v_challenge.booking_contact_digest
        and bv.delivery_state = 'delivered'
        and bv.consumed_at is not null
    );

  update private.customer_portal_challenges pc
  set delivery_state = case when v_delivered then 'delivered' else 'failed' end,
      delivered_at = case when v_delivered then v_now else null end,
      failed_at = case when v_delivered then null else v_now end
  where pc.id = v_challenge.id and pc.delivery_state = 'pending';
  return 'ok';
end;
$$;

create or replace function public.customer_portal_prepare_recovery_resend(
  p_challenge_public_id uuid,
  p_subject_digest text
) returns table (
  outcome text,
  channel text,
  delivery_destination text,
  contact_digest text,
  booking_contact_digest text,
  tenant_name text,
  tenant_slug text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_challenge private.customer_portal_challenges%rowtype;
begin
  select pc.* into v_challenge
  from private.customer_portal_challenges pc
  where pc.public_id = p_challenge_public_id
    and pc.purpose = 'recovery'
    and pc.subject_digest = p_subject_digest;
  if not found or v_challenge.consumed_at is not null or v_challenge.revoked_at is not null then
    return query select 'invalid'::text, null::text, null::text, null::text,
      null::text, null::text, null::text;
    return;
  end if;
  return query
  select 'ready'::text, v_challenge.channel,
    case when v_challenge.customer_id is null then null
      when v_challenge.channel = 'sms' then c.phone else c.email end,
    v_challenge.contact_digest, v_challenge.booking_contact_digest,
    t.name, t.slug
  from public.tenants t
  left join public.customers c
    on c.id = v_challenge.customer_id
   and c.tenant_id = t.id
   and c.status = 'active'
  where t.id = v_challenge.tenant_id
    and t.status = 'active'
    and private.customer_portal_mode(t.id) = 'passwordless_tenant';
end;
$$;

create or replace function public.customer_portal_resend_recovery(
  p_challenge_public_id uuid,
  p_subject_digest text,
  p_new_public_id uuid,
  p_new_subject_digest text,
  p_new_code_digest text,
  p_key_version integer,
  p_expires_at timestamptz
) returns table (
  outcome text,
  challenge_public_id uuid,
  created boolean,
  outbox_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old private.customer_portal_challenges%rowtype;
  v_lock_tenant_id uuid;
  v_lock_contact_digest text;
  v_now timestamptz := statement_timestamp();
  v_tenant_name text;
  v_actual boolean := false;
  v_outbox_id uuid;
begin
  select pc.tenant_id, pc.contact_digest
  into v_lock_tenant_id, v_lock_contact_digest
  from private.customer_portal_challenges pc
  where pc.public_id = p_challenge_public_id
    and pc.purpose = 'recovery';
  if not found then
    return query select 'invalid'::text, null::uuid, false, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_lock_tenant_id::text || ':' || v_lock_contact_digest, 0)
  );

  select pc.* into v_old
  from private.customer_portal_challenges pc
  where pc.public_id = p_challenge_public_id
    and pc.purpose = 'recovery'
  for update;
  if not found
     or v_old.subject_digest is distinct from p_subject_digest
     or v_old.tenant_id is distinct from v_lock_tenant_id
     or v_old.contact_digest is distinct from v_lock_contact_digest
     or v_old.consumed_at is not null
     or v_old.revoked_at is not null
     or v_old.expires_at <= v_now
     or p_new_public_id is null
     or p_new_subject_digest !~ '^[a-f0-9]{64}$'
     or p_new_code_digest !~ '^[a-f0-9]{64}$'
     or p_key_version <> 1
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '5 minutes'
     or private.customer_portal_mode(v_old.tenant_id) is distinct from 'passwordless_tenant' then
    return query select 'invalid'::text, null::uuid, false, null::uuid;
    return;
  end if;

  select t.name into v_tenant_name from public.tenants t
  where t.id = v_old.tenant_id and t.status = 'active';
  if v_tenant_name is null then
    return query select 'invalid'::text, null::uuid, false, null::uuid;
    return;
  end if;

  if v_old.resend_after > v_now then
    return query select 'cooldown'::text, null::uuid, false, null::uuid;
    return;
  end if;

  if v_old.customer_id is not null
     and v_old.booking_contact_digest is not null
     and exists (
    select 1
    from private.booking_verification_challenges bv
    join public.bookings b
      on b.id = bv.booking_id
     and b.tenant_id = v_old.tenant_id
     and b.customer_id = v_old.customer_id
    join public.customers c
      on c.id = b.customer_id
     and c.tenant_id = b.tenant_id
     and c.status = 'active'
    where bv.tenant_id = v_old.tenant_id
      and bv.channel = v_old.channel
      and bv.contact_digest = v_old.booking_contact_digest
      and bv.delivery_state = 'delivered'
      and bv.consumed_at is not null
  ) then
    v_actual := true;
  end if;

  update private.customer_portal_challenges pc
  set revoked_at = v_now
  where pc.tenant_id = v_old.tenant_id
    and pc.purpose = 'recovery'
    and pc.contact_digest = v_old.contact_digest
    and pc.consumed_at is null
    and pc.revoked_at is null;

  insert into private.customer_portal_challenges (
    public_id, tenant_id, customer_id, purpose, channel,
    subject_digest, contact_digest, booking_contact_digest, contact_masked,
    code_digest, key_version, expires_at
  ) values (
    p_new_public_id, v_old.tenant_id,
    case when v_actual then v_old.customer_id else null end,
    'recovery', v_old.channel, p_new_subject_digest, v_old.contact_digest,
    case when v_actual then v_old.booking_contact_digest else null end,
    v_old.contact_masked, p_new_code_digest, p_key_version, p_expires_at
  );

  select queued.id into v_outbox_id
  from public.enqueue_notification(
    v_old.tenant_id,
    null,
    null,
    null,
    'customer_portal_recovery_code',
    'customer-portal-recovery:' || p_new_public_id::text,
    'transactional',
    v_old.channel,
    null,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object(
      'template', 'customer_portal_recovery_code',
      'challenge_id', p_new_public_id
    ),
    5
  ) queued;
  if v_outbox_id is null then
    raise exception 'customer_portal_recovery_enqueue_failed' using errcode = '55000';
  end if;
  update private.customer_portal_challenges pc
  set recovery_outbox_id = v_outbox_id
  where pc.public_id = p_new_public_id;

  return query select 'accepted'::text, p_new_public_id, true, v_outbox_id;
end;
$$;

create or replace function public.customer_portal_recovery_state(
  p_challenge_public_id uuid,
  p_subject_digest text
) returns table (
  outcome text,
  attempts_remaining integer,
  tenant_slug text,
  resend_after timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_challenge private.customer_portal_challenges%rowtype;
  v_tenant_slug text;
  v_now timestamptz := statement_timestamp();
begin
  select pc.* into v_challenge
  from private.customer_portal_challenges pc
  where pc.public_id = p_challenge_public_id
    and pc.purpose = 'recovery'
    and pc.subject_digest = p_subject_digest;
  if not found then
    return query select 'expired'::text, 0, null::text, null::timestamptz;
    return;
  end if;
  select t.slug into v_tenant_slug from public.tenants t
  where t.id = v_challenge.tenant_id and t.status = 'active'
    and private.customer_portal_mode(t.id) = 'passwordless_tenant';
  if v_tenant_slug is null or v_challenge.expires_at <= v_now
     or v_challenge.revoked_at is not null or v_challenge.consumed_at is not null then
    return query select 'expired'::text, 0,
      v_tenant_slug, v_challenge.resend_after;
    return;
  end if;
  if v_challenge.attempt_count >= v_challenge.max_attempts then
    return query select 'max_attempts'::text, 0,
      v_tenant_slug, v_challenge.resend_after;
    return;
  end if;
  -- CP-VER-02 is deliberately identical while active: no account existence,
  -- channel, masked recipient or provider state is exposed to the browser.
  return query select 'sent'::text,
    v_challenge.max_attempts - v_challenge.attempt_count,
    v_tenant_slug, v_challenge.resend_after;
end;
$$;

create or replace function public.customer_portal_verify_recovery_and_mint_session(
  p_challenge_public_id uuid,
  p_subject_digest text,
  p_code_digest text,
  p_new_session_public_id uuid,
  p_new_session_digest text,
  p_key_version integer
) returns table (outcome text, attempts_remaining integer, tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.customer_portal_challenges%rowtype;
  v_now timestamptz := statement_timestamp();
  v_session_id uuid;
  v_tenant_slug text;
  v_remaining integer;
begin
  select pc.* into v_challenge
  from private.customer_portal_challenges pc
  where pc.public_id = p_challenge_public_id and pc.purpose = 'recovery'
  for update;
  if not found or v_challenge.subject_digest is distinct from p_subject_digest then
    return query select 'invalid'::text, 0, null::text;
    return;
  end if;
  v_remaining := greatest(v_challenge.max_attempts - v_challenge.attempt_count, 0);
  if v_challenge.consumed_at is not null or v_challenge.revoked_at is not null
     or v_challenge.expires_at <= v_now then
    return query select 'expired'::text, v_remaining, null::text;
    return;
  end if;
  if v_challenge.attempt_count >= v_challenge.max_attempts then
    return query select 'max_attempts'::text, 0, null::text;
    return;
  end if;
  if v_challenge.customer_id is null
     or v_challenge.booking_contact_digest is null
     or v_challenge.delivery_state <> 'delivered'
     or not exists (
       select 1
       from private.booking_verification_challenges bv
       join public.bookings b
         on b.id = bv.booking_id
        and b.tenant_id = v_challenge.tenant_id
        and b.customer_id = v_challenge.customer_id
       where bv.tenant_id = v_challenge.tenant_id
         and bv.channel = v_challenge.channel
         and bv.contact_digest = v_challenge.booking_contact_digest
         and bv.delivery_state = 'delivered'
         and bv.consumed_at is not null
     ) then
    update private.customer_portal_challenges pc
    set attempt_count = least(pc.attempt_count + 1, pc.max_attempts),
        revoked_at = case when pc.attempt_count + 1 >= pc.max_attempts then v_now else pc.revoked_at end
    where pc.id = v_challenge.id;
    v_remaining := greatest(v_challenge.max_attempts - v_challenge.attempt_count - 1, 0);
    return query select case when v_remaining = 0 then 'max_attempts' else 'invalid' end,
      v_remaining, null::text;
    return;
  end if;
  if v_challenge.code_digest is distinct from p_code_digest then
    update private.customer_portal_challenges pc
    set attempt_count = least(pc.attempt_count + 1, pc.max_attempts),
        revoked_at = case when pc.attempt_count + 1 >= pc.max_attempts then v_now else pc.revoked_at end
    where pc.id = v_challenge.id;
    v_remaining := greatest(v_challenge.max_attempts - v_challenge.attempt_count - 1, 0);
    return query select case when v_remaining = 0 then 'max_attempts' else 'invalid' end,
      v_remaining, null::text;
    return;
  end if;
  if p_new_session_public_id is null or p_new_session_digest !~ '^[a-f0-9]{64}$'
     or p_key_version <> 1 then
    return query select 'invalid'::text, v_remaining, null::text;
    return;
  end if;
  select t.slug into v_tenant_slug
  from public.tenants t
  join public.customers c
    on c.id = v_challenge.customer_id
   and c.tenant_id = t.id
   and c.status = 'active'
  where t.id = v_challenge.tenant_id and t.status = 'active'
    and private.customer_portal_mode(t.id) = 'passwordless_tenant';
  if v_tenant_slug is null then
    return query select 'invalid'::text, v_remaining, null::text;
    return;
  end if;

  insert into private.customer_portal_sessions (
    public_id, tenant_id, customer_id, secret_digest, key_version,
    idle_expires_at, absolute_expires_at
  ) values (
    p_new_session_public_id, v_challenge.tenant_id, v_challenge.customer_id,
    p_new_session_digest, p_key_version,
    v_now + interval '180 days', v_now + interval '365 days'
  ) returning id into v_session_id;
  update private.customer_portal_challenges
  set consumed_at = v_now
  where id = v_challenge.id and consumed_at is null;
  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type, entity_public_id
  ) values (
    v_challenge.tenant_id, v_challenge.customer_id, v_session_id,
    'recovery_verified', v_challenge.public_id
  );
  return query select 'verified'::text, v_remaining, v_tenant_slug;
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
     or p_purpose <> 'contact_change'
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

  return query select 'accepted'::text, p_public_id, p_customer is not null;
end;
$$;

create or replace function public.customer_portal_record_challenge_delivery(
  p_challenge_public_id uuid,
  p_subject_digest text,
  p_delivered boolean
) returns text
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
     or v_challenge.purpose <> 'contact_change'
     or v_challenge.customer_id is null
     or v_challenge.delivery_state <> 'pending'
     or v_challenge.consumed_at is not null
     or v_challenge.revoked_at is not null
     or v_challenge.expires_at <= v_now then
    return 'invalid';
  end if;

  update private.customer_portal_challenges c
  set delivery_state = case when p_delivered is true then 'delivered' else 'failed' end,
      delivered_at = case when p_delivered is true then v_now else null end,
      failed_at = case when p_delivered is true then null else v_now end
  where c.id = v_challenge.id and c.delivery_state = 'pending';
  return 'ok';
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
     or v_challenge.purpose <> 'contact_change'
     or v_challenge.consumed_at is not null
     or v_challenge.revoked_at is not null
     or v_challenge.expires_at <= v_now
     or v_challenge.delivery_state <> 'delivered'
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

-- Recovery is routed by its dedicated SMS/email worker. Generic claims must
-- never race it, while the exact-id claim remains the single lease primitive.
create or replace function public.claim_notification_outbox(
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer,
  p_limit integer
) returns setof public.notifications_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications_outbox o
  set status = 'failed', last_error = 'lease_expired_after_max_attempts',
      lease_token = null, lease_expires_at = null, updated_at = p_now
  where o.event_type <> 'customer_portal_recovery_code'
    and o.status = 'attempting'
    and o.lease_expires_at <= p_now
    and o.attempt_count >= o.max_attempts;

  return query
  with due as (
    select o.id from public.notifications_outbox o
    where o.event_type <> 'customer_portal_recovery_code'
      and o.attempt_count < o.max_attempts
      and o.chosen_channel is not null
      and ((o.status = 'queued' and o.available_at <= p_now)
        or (o.status = 'attempting' and o.lease_expires_at <= p_now))
    order by o.available_at, o.created_at, o.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  )
  update public.notifications_outbox o
  set status = 'attempting', attempt_count = o.attempt_count + 1,
      lease_token = p_lease_token,
      lease_expires_at = p_now + pg_catalog.make_interval(
        secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
      ),
      updated_at = p_now
  from due where o.id = due.id
  returning o.*;
end;
$$;

create or replace function public.claim_sms_notification_outbox(
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer,
  p_limit integer
) returns setof public.notifications_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications_outbox o
  set status = 'failed', last_error = 'lease_expired_after_max_attempts',
      lease_token = null, lease_expires_at = null, updated_at = p_now
  where o.event_type <> 'customer_portal_recovery_code'
    and o.chosen_channel = 'sms'
    and o.status = 'attempting'
    and o.lease_expires_at <= p_now
    and o.attempt_count >= o.max_attempts;

  return query
  with due as (
    select o.id from public.notifications_outbox o
    where o.event_type <> 'customer_portal_recovery_code'
      and o.chosen_channel = 'sms'
      and o.attempt_count < o.max_attempts
      and ((o.status = 'queued' and o.available_at <= p_now)
        or (o.status = 'attempting' and o.lease_expires_at <= p_now))
    order by o.available_at, o.created_at, o.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  )
  update public.notifications_outbox o
  set status = 'attempting', attempt_count = o.attempt_count + 1,
      lease_token = p_lease_token,
      lease_expires_at = p_now + pg_catalog.make_interval(
        secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
      ),
      updated_at = p_now
  from due where o.id = due.id
  returning o.*;
end;
$$;

create or replace function public.claim_notification_outbox_by_id(
  p_id uuid,
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer
) returns setof public.notifications_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or p_lease_token is null or p_now is null then
    raise exception 'notification_claim_by_id_invalid' using errcode = '22023';
  end if;

  update public.notifications_outbox o
  set status = 'failed', last_error = 'lease_expired_after_max_attempts',
      lease_token = null, lease_expires_at = null, updated_at = p_now
  where o.id = p_id and o.status = 'attempting'
    and o.lease_expires_at <= p_now and o.attempt_count >= o.max_attempts;

  return query
  with due as (
    select o.id from public.notifications_outbox o
    where o.id = p_id
      and o.category = 'transactional'
      and o.event_type in (
        'booking_verification_pin', 'booking_confirmation',
        'booking_request_received', 'customer_portal_recovery_code'
      )
      and o.chosen_channel in ('sms', 'email')
      and o.attempt_count < o.max_attempts
      and ((o.status = 'queued' and (
          o.event_type in ('booking_verification_pin', 'customer_portal_recovery_code')
          or o.available_at <= p_now
        )) or (o.status = 'attempting' and o.lease_expires_at <= p_now))
    for update skip locked
  )
  update public.notifications_outbox o
  set status = 'attempting', attempt_count = o.attempt_count + 1,
      lease_token = p_lease_token,
      lease_expires_at = p_now + pg_catalog.make_interval(
        secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
      ),
      updated_at = p_now
  from due where o.id = due.id
  returning o.*;
end;
$$;

create or replace function public.customer_portal_recovery_outbox_candidates(
  p_now timestamptz,
  p_limit integer
) returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A recovery delivery_started row cannot be retried automatically (at-most-once),
  -- but once its five-minute challenge has expired it must not remain stuck forever.
  update public.notifications_outbox o
  set status = 'failed', last_error = 'delivery_uncertain',
      lease_token = null, lease_expires_at = null, updated_at = p_now
  where o.event_type = 'customer_portal_recovery_code'
    and o.status = 'delivery_started'
    and o.updated_at <= p_now - interval '5 minutes';

  update public.notifications_outbox o
  set status = 'failed', last_error = 'lease_expired_after_max_attempts',
      lease_token = null, lease_expires_at = null, updated_at = p_now
  where o.event_type = 'customer_portal_recovery_code'
    and o.status = 'attempting'
    and o.lease_expires_at <= p_now
    and o.attempt_count >= o.max_attempts;

  return query
  select o.id from public.notifications_outbox o
  where o.event_type = 'customer_portal_recovery_code'
    and o.attempt_count < o.max_attempts
    and ((o.status = 'queued' and o.available_at <= p_now)
      or (o.status = 'attempting' and o.lease_expires_at <= p_now))
  order by o.available_at, o.created_at, o.id
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
end;
$$;

revoke all on function public.claim_notification_outbox(
  uuid, timestamptz, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox(
  uuid, timestamptz, integer, integer
) to service_role;

revoke all on function public.claim_sms_notification_outbox(
  uuid, timestamptz, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_sms_notification_outbox(
  uuid, timestamptz, integer, integer
) to service_role;

revoke all on function public.claim_notification_outbox_by_id(
  uuid, uuid, timestamptz, integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox_by_id(
  uuid, uuid, timestamptz, integer
) to service_role;

revoke all on function public.customer_portal_recovery_outbox_candidates(
  timestamptz, integer
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_recovery_outbox_candidates(
  timestamptz, integer
) to service_role;

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

revoke all on function public.customer_portal_start_recovery(
  text, text, text, uuid, text, text, text, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_start_recovery(
  text, text, text, uuid, text, text, text, integer, timestamptz
) to service_role;

revoke all on function public.customer_portal_record_recovery_delivery(
  uuid, text, text, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_record_recovery_delivery(
  uuid, text, text, boolean
) to service_role;

revoke all on function public.customer_portal_recovery_delivery_target(
  uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_recovery_delivery_target(
  uuid, uuid
) to service_role;

revoke all on function public.customer_portal_prepare_recovery_delivery(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_prepare_recovery_delivery(
  uuid, uuid, text, text, text, text
) to service_role;

revoke all on function public.customer_portal_record_recovery_outbox_delivery(
  uuid, uuid, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_record_recovery_outbox_delivery(
  uuid, uuid, boolean
) to service_role;

revoke all on function public.customer_portal_prepare_recovery_resend(
  uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_prepare_recovery_resend(
  uuid, text
) to service_role;

revoke all on function public.customer_portal_resend_recovery(
  uuid, text, uuid, text, text, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_resend_recovery(
  uuid, text, uuid, text, text, integer, timestamptz
) to service_role;

revoke all on function public.customer_portal_recovery_state(
  uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_recovery_state(
  uuid, text
) to service_role;

revoke all on function public.customer_portal_verify_recovery_and_mint_session(
  uuid, text, text, uuid, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_verify_recovery_and_mint_session(
  uuid, text, text, uuid, text, integer
) to service_role;

revoke all on function public.customer_portal_create_challenge(
  uuid, uuid, uuid, text, text, text, text, text, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_create_challenge(
  uuid, uuid, uuid, text, text, text, text, text, integer, timestamptz
) to service_role;

revoke all on function public.customer_portal_record_challenge_delivery(
  uuid, text, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_record_challenge_delivery(
  uuid, text, boolean
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
