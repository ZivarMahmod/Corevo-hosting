-- One customer-portal mode owner and retry-safe booking-access links.

begin;

update public.tenant_settings ts
set settings = (
  case
    when ts.settings #>> '{customer_portal,mode}' in (
      'off', 'passwordless_tenant', 'global_account'
    ) then coalesce(ts.settings, '{}'::jsonb)
    when ts.settings #>> '{customer_portal,mode}' = 'legacy_account'
      then coalesce(ts.settings, '{}'::jsonb)
    when ts.settings #>> '{customer_portal,mode}' is null
    then (
      case when pg_catalog.jsonb_typeof(ts.settings) = 'object'
        then ts.settings else '{}'::jsonb
      end
    ) || pg_catalog.jsonb_build_object(
      'customer_portal',
      (
        case when pg_catalog.jsonb_typeof(ts.settings -> 'customer_portal') = 'object'
          then ts.settings -> 'customer_portal' else '{}'::jsonb
        end
      ) || pg_catalog.jsonb_build_object(
        'mode',
        case when ts.settings ->> 'customer_accounts_enabled' = 'true'
          then 'legacy_account' else 'off'
        end
      )
    )
    else coalesce(ts.settings, '{}'::jsonb)
  end
) - 'customer_accounts_enabled';

-- This timestamp is the mode generation fence. A portal write that started
-- before a later mode cutover must not become active after the cutover.
update public.tenant_settings ts
set settings = ts.settings || pg_catalog.jsonb_build_object(
  'customer_portal',
  ts.settings -> 'customer_portal' || pg_catalog.jsonb_build_object(
    'mode_changed_at', pg_catalog.to_jsonb(statement_timestamp())
  )
)
where ts.settings #>> '{customer_portal,mode}' in (
  'off', 'legacy_account', 'passwordless_tenant', 'global_account'
);

-- A booking link owns an immutable booking destination. Historical rows that
-- cannot be proven through their delivery intent are revoked before the
-- constraint is validated; they must never resolve to a guessed booking.
alter table private.customer_portal_links
  add column booking_id uuid references public.bookings(id) on delete cascade;

update private.customer_portal_links l
set booking_id = o.booking_id
from public.notifications_outbox o
where l.purpose = 'booking_access'
  and l.delivery_intent_id = o.id
  and o.tenant_id = l.tenant_id
  and o.customer_id = l.customer_id
  and o.booking_id is not null;

update private.customer_portal_links
set revoked_at = coalesce(revoked_at, statement_timestamp())
where purpose = 'booking_access' and booking_id is null;

alter table private.customer_portal_links
  add constraint customer_portal_links_booking_binding_check
  check (purpose <> 'booking_access' or booking_id is not null or revoked_at is not null)
  not valid;
alter table private.customer_portal_links
  validate constraint customer_portal_links_booking_binding_check;

create or replace function public.set_customer_portal_mode(
  p_tenant uuid,
  p_mode text
) returns table (mode text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous text;
  v_now timestamptz := statement_timestamp();
  v_settings_inserted boolean := false;
begin
  if p_tenant is null
     or p_mode is null
     or p_mode not in ('off', 'legacy_account', 'passwordless_tenant') then
    raise exception 'customer_portal_mode_invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tenants t where t.id = p_tenant
  ) then
    raise exception 'customer_portal_mode_invalid' using errcode = '22023';
  end if;

  -- Ensure the settings owner exists before taking any credential lock. This
  -- upsert may wait on a concurrent tenant-settings writer, so it must remain
  -- ahead of the fail-fast credential preflight.
  insert into public.tenant_settings (tenant_id, settings)
  values (
    p_tenant,
    pg_catalog.jsonb_build_object(
      'customer_portal', pg_catalog.jsonb_build_object(
        'mode', p_mode,
        'mode_changed_at', pg_catalog.to_jsonb(v_now)
      )
    )
  )
  on conflict (tenant_id) do nothing
  returning true into v_settings_inserted;

  -- Never wait for a portal operation while holding the mode row: several
  -- credential flows intentionally lock more than one table. Preflight every
  -- row this cutover can revoke and fail fast if one is in use. Once these
  -- locks are held, the insert guards below serialize newly created rows.
  perform 1 from private.customer_portal_verified_contacts
  where tenant_id = p_tenant and revoked_at is null
  for update nowait;

  perform 1 from private.customer_portal_contact_change_flows
  where tenant_id = p_tenant and revoked_at is null and completed_at is null
  for update nowait;

  perform 1 from private.customer_portal_links
  where tenant_id = p_tenant and revoked_at is null
  for update nowait;

  perform 1 from private.customer_portal_sessions
  where tenant_id = p_tenant and revoked_at is null
  for update nowait;

  perform 1 from private.customer_booking_trusts
  where tenant_id = p_tenant and revoked_at is null
  for update nowait;

  perform 1 from private.customer_portal_challenges
  where tenant_id = p_tenant and revoked_at is null and consumed_at is null
  for update nowait;

  select ts.settings #>> '{customer_portal,mode}'
  into v_previous
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant
  for update nowait;

  if not found then
    raise exception 'customer_portal_mode_invalid' using errcode = '55000';
  end if;
  if v_settings_inserted then
    v_previous := null;
  end if;

  update public.tenant_settings ts
  set settings = ((
      case when pg_catalog.jsonb_typeof(ts.settings) = 'object'
        then ts.settings else '{}'::jsonb
      end
    ) - 'customer_accounts_enabled'
  ) || pg_catalog.jsonb_build_object(
    'customer_portal',
    (
      case when pg_catalog.jsonb_typeof(ts.settings -> 'customer_portal') = 'object'
        then ts.settings -> 'customer_portal' else '{}'::jsonb
      end
    ) || pg_catalog.jsonb_build_object(
      'mode', p_mode,
      'mode_changed_at',
      case
        when p_mode = 'passwordless_tenant'
          and v_previous = 'passwordless_tenant'
          and ts.settings #> '{customer_portal,mode_changed_at}' is not null
        then ts.settings #> '{customer_portal,mode_changed_at}'
        else pg_catalog.to_jsonb(v_now)
      end
    )
  )
  , updated_at = v_now
  where ts.tenant_id = p_tenant;

  -- Only an idempotent passwordless -> passwordless write may retain active
  -- credentials. Every other write clears stale artifacts before they could
  -- become valid again in a later passwordless activation.
  if p_mode <> 'passwordless_tenant'
     or v_previous is distinct from 'passwordless_tenant' then
    update private.customer_portal_sessions
    set revoked_at = v_now
    where tenant_id = p_tenant and revoked_at is null;

    update private.customer_booking_trusts
    set revoked_at = v_now
    where tenant_id = p_tenant and revoked_at is null;

    update private.customer_portal_links
    set revoked_at = v_now
    where tenant_id = p_tenant and revoked_at is null;

    update private.customer_portal_challenges
    set revoked_at = v_now
    where tenant_id = p_tenant
      and revoked_at is null
      and consumed_at is null;

    update private.customer_portal_verified_contacts
    set revoked_at = greatest(verified_at, v_now)
    where tenant_id = p_tenant and revoked_at is null;

    update private.customer_portal_contact_change_flows
    set revoked_at = v_now,
        new_destination = null,
        updated_at = v_now
    where tenant_id = p_tenant
      and revoked_at is null
      and completed_at is null;
  end if;

  return query select p_mode;
end;
$$;

revoke all on function public.set_customer_portal_mode(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_customer_portal_mode(uuid, text)
  to service_role;

-- One table-level guard covers every credential creator, including contact
-- change RPCs defined before this cutover. Inserts take the shared mode lock
-- without waiting, so an in-flight cutover fails the credential write instead
-- of creating a lock cycle. Existing-row mutations serialize against the
-- setter's revocation update and never clear revoked_at. The timestamp rejects
-- a request that began before a completed off/on cutover.
create or replace function private.customer_portal_guard_mode_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active boolean;
  v_changed_at_text text;
  v_mode text;
  v_row jsonb := pg_catalog.to_jsonb(new);
begin
  v_active := case tg_table_name
    when 'customer_portal_links'
      then v_row ->> 'revoked_at' is null
    when 'customer_portal_sessions'
      then v_row ->> 'revoked_at' is null
    when 'customer_booking_trusts'
      then v_row ->> 'revoked_at' is null
    when 'customer_portal_challenges'
      then v_row ->> 'revoked_at' is null and v_row ->> 'consumed_at' is null
    when 'customer_portal_verified_contacts'
      then v_row ->> 'revoked_at' is null
    when 'customer_portal_contact_change_flows'
      then v_row ->> 'revoked_at' is null and v_row ->> 'completed_at' is null
    else false
  end;

  if not v_active then
    return new;
  end if;

  select
    ts.settings #>> '{customer_portal,mode}',
    ts.settings #>> '{customer_portal,mode_changed_at}'
  into v_mode, v_changed_at_text
  from public.tenant_settings ts
  where ts.tenant_id = new.tenant_id
  for share nowait;

  if v_mode is distinct from 'passwordless_tenant'
     or (
       v_changed_at_text is not null
       and statement_timestamp() < v_changed_at_text::timestamptz
     ) then
    raise exception 'customer_portal_mode_inactive' using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.customer_portal_guard_mode_write()
  from public, anon, authenticated, service_role;

create trigger customer_portal_links_mode_guard
before insert on private.customer_portal_links
for each row execute function private.customer_portal_guard_mode_write();

create trigger customer_portal_sessions_mode_guard
before insert on private.customer_portal_sessions
for each row execute function private.customer_portal_guard_mode_write();

create trigger customer_booking_trusts_mode_guard
before insert on private.customer_booking_trusts
for each row execute function private.customer_portal_guard_mode_write();

create trigger customer_portal_challenges_mode_guard
before insert on private.customer_portal_challenges
for each row execute function private.customer_portal_guard_mode_write();

create trigger customer_portal_verified_contacts_mode_guard
before insert on private.customer_portal_verified_contacts
for each row execute function private.customer_portal_guard_mode_write();

create trigger customer_portal_contact_change_flows_mode_guard
before insert on private.customer_portal_contact_change_flows
for each row execute function private.customer_portal_guard_mode_write();

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
  v_now timestamptz := statement_timestamp();
  v_public_id uuid := gen_random_uuid();
  v_booking_id uuid;
  v_booking_start timestamptz;
  v_effective_expiry timestamptz;
  v_existing private.customer_portal_links%rowtype;
  v_inserted boolean := false;
begin
  if p_tenant is null
     or p_customer is null
     or p_purpose is null
     or p_purpose not in ('booking_access', 'recovery', 'contact_change')
     or p_token_digest is null
     or length(p_token_digest) not between 32 and 256
     or p_key_version is null or p_key_version <= 0
     or p_expires_at is null
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

  if p_purpose = 'booking_access' then
    if p_delivery_intent_id is null then
      raise exception 'customer_portal_link_invalid' using errcode = '22023';
    end if;

    select b.id, b.start_ts
    into v_booking_id, v_booking_start
    from public.notifications_outbox o
    join public.bookings b
      on b.id = o.booking_id
     and b.tenant_id = o.tenant_id
     and b.customer_id = o.customer_id
    where o.id = p_delivery_intent_id
      and o.tenant_id = p_tenant
      and o.customer_id = p_customer;

    if v_booking_start is null then
      raise exception 'customer_portal_link_invalid' using errcode = '22023';
    end if;

    v_effective_expiry := least(
      greatest(v_now + interval '30 days', v_booking_start + interval '30 days'),
      v_now + interval '400 days'
    );
  else
    if p_expires_at <= v_now or p_expires_at > v_now + interval '30 days' then
      raise exception 'customer_portal_link_invalid' using errcode = '22023';
    end if;
    v_effective_expiry := p_expires_at;
  end if;

  insert into private.customer_portal_links (
    public_id, tenant_id, customer_id, purpose, token_digest,
    key_version, delivery_intent_id, booking_id, expires_at
  ) values (
    v_public_id, p_tenant, p_customer, p_purpose, p_token_digest,
    p_key_version, p_delivery_intent_id, v_booking_id, v_effective_expiry
  )
  on conflict (delivery_intent_id, purpose)
    where delivery_intent_id is not null
  do nothing
  returning true into v_inserted;

  if v_inserted then
    insert into private.customer_portal_audit (
      tenant_id, customer_id, event_type, entity_public_id
    ) values (p_tenant, p_customer, 'link_minted', v_public_id);

    return query select v_public_id, v_effective_expiry;
    return;
  end if;

  select l.*
  into v_existing
  from private.customer_portal_links l
  where l.delivery_intent_id = p_delivery_intent_id
    and l.purpose = p_purpose
  for update;

  if not found
     or v_existing.tenant_id <> p_tenant
     or v_existing.customer_id <> p_customer
     or v_existing.booking_id is distinct from v_booking_id
     or v_existing.token_digest <> p_token_digest
     or v_existing.key_version <> p_key_version
     or v_existing.consumed_at is not null
     or v_existing.revoked_at is not null
     or v_existing.expires_at <= v_now then
    raise exception 'customer_portal_link_invalid' using errcode = '22023';
  end if;

  return query select v_existing.public_id, v_existing.expires_at;
end;
$$;

revoke all on function public.customer_portal_mint_link(
  uuid, uuid, text, text, integer, timestamptz, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_mint_link(
  uuid, uuid, text, text, integer, timestamptz, uuid
) to service_role;

drop function public.customer_portal_exchange_link(uuid, text, uuid, text, integer);

create function public.customer_portal_exchange_link(
  p_link_public_id uuid,
  p_token_digest text,
  p_new_session_public_id uuid,
  p_new_session_digest text,
  p_key_version integer,
  p_existing_session_public_id uuid default null,
  p_existing_session_digest text default null
) returns table (
  outcome text,
  session_public_id uuid,
  tenant_slug text,
  booking_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link private.customer_portal_links%rowtype;
  v_now timestamptz := statement_timestamp();
  v_tenant_slug text;
  v_booking_id uuid;
  v_session_id uuid;
  v_existing_session_id uuid;
begin
  if p_link_public_id is null
     or p_token_digest is null
     or length(p_token_digest) not between 32 and 256
     or p_new_session_public_id is null
     or p_new_session_digest is null
     or length(p_new_session_digest) not between 32 and 256
     or p_key_version is null or p_key_version <= 0 then
    return query select 'invalid'::text, null::uuid, null::text, null::uuid;
    return;
  end if;

  select l.* into v_link
  from private.customer_portal_links l
  where l.public_id = p_link_public_id
  for update;

  if not found
     or v_link.token_digest <> p_token_digest
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
    return query select 'invalid'::text, null::uuid, null::text, null::uuid;
    return;
  end if;

  select t.slug into v_tenant_slug
  from public.tenants t
  where t.id = v_link.tenant_id;

  if v_link.purpose = 'booking_access' then
    v_booking_id := v_link.booking_id;
    if v_booking_id is null or not exists (
      select 1 from public.bookings b
      where b.id = v_booking_id
        and b.tenant_id = v_link.tenant_id
        and b.customer_id = v_link.customer_id
    ) then
      return query select 'invalid'::text, null::uuid, null::text, null::uuid;
      return;
    end if;
  end if;

  if v_link.consumed_at is not null then
    if p_existing_session_public_id is not null
       and p_existing_session_digest is not null then
      select r.session_id into v_existing_session_id
      from private.customer_portal_resolve_session(
        p_existing_session_public_id,
        p_existing_session_digest,
        v_now
      ) r
      where r.tenant_id = v_link.tenant_id
        and r.customer_id = v_link.customer_id;
    end if;

    if v_existing_session_id is null then
      return query select 'invalid'::text, null::uuid, null::text, null::uuid;
      return;
    end if;

    return query select 'ok'::text, p_existing_session_public_id, v_tenant_slug, v_booking_id;
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

  insert into private.customer_portal_audit (
    tenant_id, customer_id, session_id, event_type, entity_public_id
  ) values (
    v_link.tenant_id, v_link.customer_id, v_session_id,
    'link_exchanged', v_link.public_id
  );

  return query select 'ok'::text, p_new_session_public_id, v_tenant_slug, v_booking_id;
end;
$$;

revoke all on function public.customer_portal_exchange_link(
  uuid, text, uuid, text, integer, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_exchange_link(
  uuid, text, uuid, text, integer, uuid, text
) to service_role;

commit;
