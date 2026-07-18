-- 0114_partner_foundation.sql
-- goal-72 S7a: partner identity, tenant ownership, auditable monthly licensing
-- and Vault-backed SMS provider configuration. Global super-admin remains
-- "partner zero" and sees everything; partner operators are always DB-scoped.

begin;

-- ── Partner identity ─────────────────────────────────────────────────────────
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  status text not null default 'provisioning'
    check (status in ('provisioning', 'active', 'suspended')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'UTC',
  -- Zivar sets this freely per partner. It is never a hard-coded product price.
  license_price_ore integer not null
    check (license_price_ore between 0 and 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_partners_updated
  before update on public.partners
  for each row execute function public.set_updated_at();

create table public.partner_members (
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_id, user_id),
  unique (user_id)
);

create trigger trg_partner_members_updated
  before update on public.partner_members
  for each row execute function public.set_updated_at();

alter table public.tenants
  add column if not exists partner_id uuid references public.partners(id) on delete restrict;

alter table public.tenants drop constraint if exists tenants_status_chk;
alter table public.tenants add constraint tenants_status_chk
  check (status in ('provisioning', 'active', 'suspended', 'deleted'));

create index if not exists tenants_partner_id_idx
  on public.tenants (partner_id, status, created_at desc);

-- Freeze cost ownership when an outbox row is enqueued. Joining through the
-- tenant's current partner_id would retroactively move this month's already
-- incurred SMS cost from A to B when a customer changes partner.
alter table public.notifications_outbox
  add column if not exists partner_id uuid references public.partners(id) on delete restrict;
alter table public.notifications_outbox
  add column if not exists cost_currency text;
update public.notifications_outbox
set cost_currency = 'SEK'
where chosen_channel = 'sms' and cost_ore is not null and cost_currency is null;
alter table public.notifications_outbox
  drop constraint if exists notifications_outbox_cost_currency_chk;
alter table public.notifications_outbox
  add constraint notifications_outbox_cost_currency_chk
  check (cost_currency is null or cost_currency ~ '^[A-Z]{3}$');

update public.notifications_outbox o
set partner_id = t.partner_id
from public.tenants t
where t.id = o.tenant_id
  and o.partner_id is null
  and t.partner_id is not null;

create index if not exists notifications_outbox_partner_created_idx
  on public.notifications_outbox (partner_id, created_at desc)
  where partner_id is not null;

create or replace function private.capture_outbox_partner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id
       or new.partner_id is distinct from old.partner_id then
      raise exception 'outbox_cost_owner_is_immutable' using errcode = '42501';
    end if;
    return new;
  end if;
  select t.partner_id into new.partner_id
  from public.tenants t
  where t.id = new.tenant_id;
  return new;
end;
$$;
revoke all on function private.capture_outbox_partner() from public;

drop trigger if exists trg_notifications_outbox_partner on public.notifications_outbox;
create trigger trg_notifications_outbox_partner
  before insert or update of tenant_id, partner_id on public.notifications_outbox
  for each row execute function private.capture_outbox_partner();

-- SMS worker claims only SMS rows. This lets the transport remain physically off
-- without consuming email/push rows and enables one explicit channel at a time.
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
  update public.notifications_outbox
    set status = 'failed',
        last_error = 'lease_expired_after_max_attempts',
        lease_token = null,
        lease_expires_at = null,
        updated_at = p_now
  where chosen_channel = 'sms'
    and status = 'attempting'
    and lease_expires_at <= p_now
    and attempt_count >= max_attempts;

  return query
  with due as (
    select o.id
    from public.notifications_outbox o
    where o.chosen_channel = 'sms'
      and o.attempt_count < o.max_attempts
      and (
        (o.status = 'queued' and o.available_at <= p_now)
        or (o.status = 'attempting' and o.lease_expires_at <= p_now)
      )
    order by o.available_at, o.created_at, o.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  )
  update public.notifications_outbox o
    set status = 'attempting',
        attempt_count = o.attempt_count + 1,
        lease_token = p_lease_token,
        lease_expires_at = p_now
          + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)),
        updated_at = p_now
  from due
  where o.id = due.id
  returning o.*;
end;
$$;
revoke all on function public.claim_sms_notification_outbox(uuid, timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_sms_notification_outbox(uuid, timestamptz, integer, integer)
  to service_role;

-- Terminal acknowledgement snapshots the provider account currency together
-- with the cost. The default keeps the short migration/app rollout window
-- backward-compatible with the existing Corevo SEK sender.
drop function if exists public.ack_notification_outbox(
  uuid, uuid, text, text, integer, text, integer
);
create function public.ack_notification_outbox(
  p_id uuid,
  p_lease_token uuid,
  p_status text,
  p_provider_ref text,
  p_cost_ore integer,
  p_skip_reason text,
  p_parts integer default null,
  p_cost_currency text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated uuid;
  v_currency text := case when p_cost_ore is null then null else coalesce(p_cost_currency, 'SEK') end;
begin
  if p_status not in ('sent', 'delivered', 'failed', 'skipped', 'simulated') then
    raise exception 'notification_terminal_status_invalid' using errcode = '22023';
  end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'notification_cost_currency_invalid' using errcode = '22023';
  end if;

  update public.notifications_outbox
    set status = p_status,
        provider_ref = coalesce(p_provider_ref, provider_ref),
        cost_ore = coalesce(p_cost_ore, cost_ore),
        cost_currency = coalesce(v_currency, cost_currency),
        parts = coalesce(p_parts, parts),
        skip_reason = p_skip_reason,
        sent_at = case when p_status in ('sent', 'delivered') then coalesce(sent_at, now()) else sent_at end,
        delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
        lease_token = null,
        lease_expires_at = null,
        last_error = case when p_status = 'failed' then coalesce(p_skip_reason, last_error) else null end,
        updated_at = now()
  where id = p_id
    and status in ('attempting', 'delivery_started')
    and lease_token = p_lease_token
  returning id into v_updated;
  return v_updated is not null;
end;
$$;
revoke all on function public.ack_notification_outbox(
  uuid, uuid, text, text, integer, text, integer, text
) from public, anon, authenticated;
grant execute on function public.ack_notification_outbox(
  uuid, uuid, text, text, integer, text, integer, text
) to service_role;

-- ── Authoritative helpers ────────────────────────────────────────────────────
-- partner_id is resolved from live DB state, never from editable user_metadata
-- and never from a stale JWT claim alone.
create or replace function private.partner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pm.partner_id
  from public.partner_members pm
  join public.partners p on p.id = pm.partner_id
  join public.users u on u.id = pm.user_id
  join public.roles r on r.id = u.role_id
  where pm.user_id = (select auth.uid())
    and pm.status = 'active'
    and p.status = 'active'
    and u.status = 'active'
    and u.tenant_id is null
    and r.tenant_id is null
    and r.name = 'partner_admin'
    and r.level = 7
  limit 1
$$;
revoke all on function private.partner_id() from public;
grant execute on function private.partner_id() to authenticated, supabase_auth_admin;

-- Tighten global admin identity before the level-7 partner role exists. A stale
-- or forged platform_admin claim still needs the active global super_admin row.
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'platform_admin')::boolean,
      false
    )
    and exists (
      select 1
      from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = (select auth.uid())
        and u.status = 'active'
        and u.tenant_id is null
        and r.tenant_id is null
        and r.name = 'super_admin'
        and r.level = 8
    )
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated, supabase_auth_admin;

-- Seed the level-7 role only AFTER the global bypass has been narrowed to the
-- exact super_admin identity above. The transaction is atomic, and the ordering
-- also makes the security invariant mechanically reviewable.
create unique index if not exists roles_global_partner_admin_unique_idx
  on public.roles (name)
  where tenant_id is null and name = 'partner_admin';

insert into public.roles (tenant_id, name, level)
select null, 'partner_admin', 7
where not exists (
  select 1 from public.roles r where r.tenant_id is null and r.name = 'partner_admin'
);

create or replace function private.has_platform_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin())
    or (select private.partner_id()) is not null
$$;
revoke all on function private.has_platform_access() from public;
grant execute on function private.has_platform_access() to authenticated;

create or replace function private.can_access_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin()) or exists (
    select 1
    from public.tenants t
    where t.id = p_tenant
      and t.partner_id = (select private.partner_id())
  )
$$;
revoke all on function private.can_access_tenant(uuid) from public;
grant execute on function private.can_access_tenant(uuid) to authenticated;

-- Tokens carry a useful partner hint for routing/chrome, while every DB decision
-- above re-checks current membership. platform_admin is now super_admin-only.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb;
  amd jsonb;
  v_tenant uuid;
  v_platform boolean := false;
  v_partner uuid;
begin
  select
    u.tenant_id,
    (u.status = 'active' and u.tenant_id is null and r.tenant_id is null
      and r.name = 'super_admin' and r.level = 8),
    case
      when u.status = 'active' and u.tenant_id is null and r.tenant_id is null
        and r.name = 'partner_admin' and r.level = 7
        and pm.status = 'active' and p.status = 'active'
      then pm.partner_id
      else null
    end
  into v_tenant, v_platform, v_partner
  from public.users u
  left join public.roles r on r.id = u.role_id
  left join public.partner_members pm on pm.user_id = u.id
  left join public.partners p on p.id = pm.partner_id
  where u.id = (event ->> 'user_id')::uuid
  limit 1;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  amd := coalesce(claims -> 'app_metadata', '{}'::jsonb);
  if v_tenant is not null then
    amd := jsonb_set(amd, '{tenant_id}', to_jsonb(v_tenant::text), true);
  else
    amd := amd - 'tenant_id';
  end if;
  amd := jsonb_set(amd, '{platform_admin}', to_jsonb(coalesce(v_platform, false)), true);
  amd := jsonb_set(amd, '{partner_admin}', to_jsonb(v_partner is not null), true);
  if v_partner is not null then
    amd := jsonb_set(amd, '{partner_id}', to_jsonb(v_partner::text), true);
  else
    amd := amd - 'partner_id';
  end if;
  claims := jsonb_set(claims, '{app_metadata}', amd, true);
  return jsonb_set(event, '{claims}', claims, true);
end;
$$;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on table public.partners, public.partner_members to supabase_auth_admin;

-- ── Partner and tenant RLS ───────────────────────────────────────────────────
alter table public.partners enable row level security;
alter table public.partner_members enable row level security;

create policy partners_global_all on public.partners
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy partners_self_read on public.partners
  for select to authenticated
  using (id = (select private.partner_id()));

create policy partner_members_global_all on public.partner_members
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy partner_members_self_read on public.partner_members
  for select to authenticated
  using (user_id = (select auth.uid()) and partner_id = (select private.partner_id()));

create policy auth_admin_read_partners on public.partners
  for select to supabase_auth_admin using (true);
create policy auth_admin_read_partner_members on public.partner_members
  for select to supabase_auth_admin using (true);

-- Partners may create and fully administer only tenants already bound to their
-- own scope. Reassignment is root-only because WITH CHECK fixes partner_id.
create policy tenants_partner_select on public.tenants
  for select to authenticated
  using (partner_id = (select private.partner_id()));
create policy tenants_partner_insert on public.tenants
  for insert to authenticated
  with check (partner_id = (select private.partner_id()));
create policy tenants_partner_update on public.tenants
  for update to authenticated
  using (partner_id = (select private.partner_id()))
  with check (partner_id = (select private.partner_id()));
-- A failed onboarding may remove its still-provisioning shell. Once activated,
-- every lifecycle change is soft and its billing/audit history is preserved.
create policy tenants_partner_provisioning_delete on public.tenants
  for delete to authenticated
  using (
    partner_id = (select private.partner_id())
    and status = 'provisioning'
  );

-- Explicit grants are separate from RLS and required when Data API automatic
-- grants are disabled. Writes still pass only through the policies above.
grant select, insert, update on public.partners to authenticated;
grant select, insert, update, delete on public.partner_members to authenticated;
grant select, insert, update, delete on public.partners, public.partner_members to service_role;

-- ── Monthly license ledger ───────────────────────────────────────────────────
create table public.partner_license_price_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  old_price_ore integer,
  new_price_ore integer not null check (new_price_ore between 0 and 100000000),
  actor_user_id uuid references auth.users(id) on delete set null,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index partner_license_price_events_partner_idx
  on public.partner_license_price_events (partner_id, effective_at desc);

create table public.partner_tenant_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null check (event_type in ('assigned', 'unassigned', 'activated', 'suspended', 'deleted')),
  tenant_status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index partner_tenant_events_partner_month_idx
  on public.partner_tenant_events (partner_id, occurred_at desc, tenant_id);

create table public.partner_license_months (
  partner_id uuid not null references public.partners(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  month date not null check (month = date_trunc('month', month::timestamp)::date),
  unit_price_ore integer not null check (unit_price_ore between 0 and 100000000),
  qualified_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_id, tenant_id, month)
);
create index partner_license_months_month_idx
  on public.partner_license_months (month desc, partner_id);

create trigger trg_partner_license_months_updated
  before update on public.partner_license_months
  for each row execute function public.set_updated_at();

create or replace function private.guard_closed_partner_license_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.closed_at is not null then
    raise exception 'closed_partner_license_month_is_immutable' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_closed_partner_license_month() from public;

drop trigger if exists trg_partner_license_months_closed_guard on public.partner_license_months;
create trigger trg_partner_license_months_closed_guard
  before update or delete on public.partner_license_months
  for each row execute function private.guard_closed_partner_license_month();

create or replace function private.partner_month(
  p_partner uuid,
  p_at timestamptz default now()
)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select date_trunc('month', p_at at time zone p.timezone)::date
  from public.partners p
  where p.id = p_partner
$$;
revoke all on function private.partner_month(uuid, timestamptz) from public;
grant execute on function private.partner_month(uuid, timestamptz) to authenticated, service_role;

-- One active day qualifies the full local partner month. Pausing never deletes
-- a qualification. A move A -> B while active qualifies both A and B that month.
create or replace function private.capture_partner_license_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_price integer;
begin
  -- If an active tenant leaves a partner immediately after that partner's local
  -- month boundary but before the hourly sweep, the active minutes still qualify
  -- the old partner for the new month.
  if tg_op = 'UPDATE'
     and old.partner_id is not null
     and old.status = 'active'
     and (
       old.partner_id is distinct from new.partner_id
       or new.status is distinct from 'active'
     ) then
    select private.partner_month(old.partner_id, now()), p.license_price_ore
      into v_month, v_price
    from public.partners p
    where p.id = old.partner_id;

    insert into public.partner_license_months (
      partner_id, tenant_id, month, unit_price_ore, qualified_at
    ) values (old.partner_id, old.id, v_month, v_price, now())
    on conflict (partner_id, tenant_id, month) do nothing;
  end if;

  if tg_op = 'UPDATE' and old.partner_id is distinct from new.partner_id and old.partner_id is not null then
    insert into public.partner_tenant_events (
      partner_id, tenant_id, event_type, tenant_status, actor_user_id
    ) values (old.partner_id, old.id, 'unassigned', old.status, (select auth.uid()));
  end if;

  if new.partner_id is not null and (
    tg_op = 'INSERT' or old.partner_id is distinct from new.partner_id
  ) then
    insert into public.partner_tenant_events (
      partner_id, tenant_id, event_type, tenant_status, actor_user_id
    ) values (new.partner_id, new.id, 'assigned', new.status, (select auth.uid()));
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.partner_id is not null then
    insert into public.partner_tenant_events (
      partner_id, tenant_id, event_type, tenant_status, actor_user_id
    ) values (
      new.partner_id,
      new.id,
      case
        when new.status = 'active' then 'activated'
        when new.status = 'deleted' then 'deleted'
        else 'suspended'
      end,
      new.status,
      (select auth.uid())
    );
  end if;

  if new.partner_id is not null and new.status = 'active' and (
    tg_op = 'INSERT'
    or old.partner_id is distinct from new.partner_id
    or old.status is distinct from new.status
  ) then
    select private.partner_month(new.partner_id, now()), p.license_price_ore
      into v_month, v_price
    from public.partners p
    where p.id = new.partner_id;

    insert into public.partner_license_months (
      partner_id, tenant_id, month, unit_price_ore, qualified_at
    ) values (new.partner_id, new.id, v_month, v_price, now())
    on conflict (partner_id, tenant_id, month) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.capture_partner_license_month() from public;

create trigger trg_tenant_partner_license
  after insert or update of partner_id, status on public.tenants
  for each row execute function private.capture_partner_license_month();

-- Root price changes are append-only in the event log and update only the open
-- current month. Historical closed months remain immutable.
create or replace function private.sync_current_partner_license_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
begin
  if (tg_op = 'INSERT' and new.status = 'active') or (
    tg_op = 'UPDATE' and (
      (old.license_price_ore is distinct from new.license_price_ore and old.status <> 'provisioning')
      or (old.status = 'provisioning' and new.status = 'active')
    )
  ) then
    insert into public.partner_license_price_events (
      partner_id, old_price_ore, new_price_ore, actor_user_id
    ) values (
      new.id,
      case
        when tg_op = 'INSERT' or old.status = 'provisioning' then null
        else old.license_price_ore
      end,
      new.license_price_ore,
      (select auth.uid())
    );

    v_month := private.partner_month(new.id, now());
    update public.partner_license_months
      set unit_price_ore = new.license_price_ore
    where partner_id = new.id
      and month = v_month
      and closed_at is null;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_current_partner_license_price() from public;

create trigger trg_partner_license_price
  after insert or update of license_price_ore, status on public.partners
  for each row execute function private.sync_current_partner_license_price();

-- Idempotent month-boundary refresh. pg_cron runs it monthly; tenant/status and
-- price triggers keep the open month live between cron ticks.
create or replace function public.refresh_partner_license_month(
  p_month date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_is_service boolean := current_user in ('postgres', 'service_role')
    or coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role',
      false
    );
begin
  if not v_is_service and not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  if p_month is not null and p_month <> date_trunc('month', p_month)::date then
    raise exception 'partner_license_month_invalid' using errcode = '22023';
  end if;

  -- Close every partner-local month before the requested/current month.
  update public.partner_license_months lm
    set closed_at = coalesce(lm.closed_at, now())
  from public.partners p
  where p.id = lm.partner_id
    and lm.closed_at is null
    and lm.month < coalesce(p_month, private.partner_month(p.id, now()));

  insert into public.partner_license_months (
    partner_id, tenant_id, month, unit_price_ore, qualified_at
  )
  select
    p.id,
    t.id,
    coalesce(p_month, private.partner_month(p.id, now())),
    p.license_price_ore,
    now()
  from public.partners p
  join public.tenants t on t.partner_id = p.id
  where p.status = 'active'
    and t.status = 'active'
  on conflict (partner_id, tenant_id, month) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function public.refresh_partner_license_month(date) from public, anon, authenticated;
grant execute on function public.refresh_partner_license_month(date) to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron saknas - hoppar over partnerlicensens manadsjobb';
    return;
  end if;
  perform cron.schedule(
    'corevo-partner-license-monthly',
    -- Idempotent hourly sweep crosses every partner-local month boundary within
    -- 65 minutes, including timezones west of UTC.
    '5 * * * *',
    $job$select public.refresh_partner_license_month()$job$
  );
end;
$$;

-- Append-only ledgers. Partners can inspect only their own invoice basis.
alter table public.partner_license_price_events enable row level security;
alter table public.partner_tenant_events enable row level security;
alter table public.partner_license_months enable row level security;

create policy partner_price_events_global_read on public.partner_license_price_events
  for select to authenticated using ((select private.is_platform_admin()));
create policy partner_price_events_self_read on public.partner_license_price_events
  for select to authenticated using (partner_id = (select private.partner_id()));
create policy partner_tenant_events_global_read on public.partner_tenant_events
  for select to authenticated using ((select private.is_platform_admin()));
create policy partner_tenant_events_self_read on public.partner_tenant_events
  for select to authenticated using (partner_id = (select private.partner_id()));
create policy partner_license_months_global_read on public.partner_license_months
  for select to authenticated using ((select private.is_platform_admin()));
create policy partner_license_months_self_read on public.partner_license_months
  for select to authenticated using (partner_id = (select private.partner_id()));

grant select on public.partner_license_price_events,
  public.partner_tenant_events,
  public.partner_license_months to authenticated;
grant select, insert, update on public.partner_license_price_events,
  public.partner_tenant_events,
  public.partner_license_months to service_role;

-- ── Vault-backed per-partner SMS configuration ───────────────────────────────
create table public.partner_sms_configs (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  provider_key text not null default 'corevo_46elks'
    check (provider_key in ('corevo_46elks', 'partner_46elks')),
  sender text check (sender is null or length(btrim(sender)) between 1 and 40),
  enabled boolean not null default false,
  username_secret_id uuid,
  password_secret_id uuid,
  callback_secret_id uuid,
  configured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_partner_sms_configs_updated
  before update on public.partner_sms_configs
  for each row execute function public.set_updated_at();

alter table public.partner_sms_configs enable row level security;
create policy partner_sms_configs_global_read on public.partner_sms_configs
  for select to authenticated using ((select private.is_platform_admin()));
create policy partner_sms_configs_self_read on public.partner_sms_configs
  for select to authenticated using (partner_id = (select private.partner_id()));
grant select on public.partner_sms_configs to authenticated;
grant select, insert, update, delete on public.partner_sms_configs to service_role;

-- Credentials enter over the authenticated server-action/RPC channel and are
-- immediately stored in Vault. The public table contains UUID references only.
create or replace function public.save_partner_sms_config(
  p_partner uuid,
  p_provider_key text,
  p_sender text,
  p_username text default null,
  p_password text default null,
  p_callback_secret text default null,
  p_enabled boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope uuid := (select private.partner_id());
  v_row public.partner_sms_configs%rowtype;
  v_username_id uuid;
  v_password_id uuid;
  v_callback_id uuid;
begin
  if not (select private.is_platform_admin()) and v_scope is distinct from p_partner then
    raise exception 'partner_scope_required' using errcode = '42501';
  end if;
  if p_provider_key not in ('corevo_46elks', 'partner_46elks') then
    raise exception 'sms_provider_invalid' using errcode = '22023';
  end if;

  select * into v_row from public.partner_sms_configs where partner_id = p_partner;
  if coalesce(v_row.provider_key, 'corevo_46elks') <> p_provider_key and exists (
    select 1
    from public.notifications_outbox o
    join public.partners p on p.id = p_partner
    where o.partner_id = p_partner
      and o.chosen_channel = 'sms'
      and o.cost_ore is not null
      and o.created_at >= (private.partner_month(p_partner, now())::timestamp at time zone p.timezone)
      and o.created_at < ((private.partner_month(p_partner, now()) + interval '1 month')::timestamp at time zone p.timezone)
  ) then
    raise exception 'sms_provider_change_current_month_locked' using errcode = '55000';
  end if;
  if p_provider_key = 'partner_46elks' and p_enabled
    and (
      (nullif(btrim(p_username), '') is null and v_row.username_secret_id is null)
      or (nullif(p_password, '') is null and v_row.password_secret_id is null)
      or (nullif(p_callback_secret, '') is null and v_row.callback_secret_id is null)
    ) then
    raise exception 'sms_credentials_required' using errcode = '22023';
  end if;

  v_username_id := v_row.username_secret_id;
  v_password_id := v_row.password_secret_id;
  v_callback_id := v_row.callback_secret_id;

  if nullif(btrim(p_username), '') is not null then
    if v_username_id is null then
      v_username_id := vault.create_secret(
        p_username,
        'partner-sms-username-' || p_partner::text,
        'Corevo partner SMS username'
      );
    else
      perform vault.update_secret(v_username_id, p_username);
    end if;
  end if;
  if nullif(p_password, '') is not null then
    if v_password_id is null then
      v_password_id := vault.create_secret(
        p_password,
        'partner-sms-password-' || p_partner::text,
        'Corevo partner SMS password'
      );
    else
      perform vault.update_secret(v_password_id, p_password);
    end if;
  end if;
  if nullif(p_callback_secret, '') is not null then
    if v_callback_id is null then
      v_callback_id := vault.create_secret(
        p_callback_secret,
        'partner-sms-callback-' || p_partner::text,
        'Corevo partner SMS callback secret'
      );
    else
      perform vault.update_secret(v_callback_id, p_callback_secret);
    end if;
  end if;

  insert into public.partner_sms_configs (
    partner_id,
    provider_key,
    sender,
    enabled,
    username_secret_id,
    password_secret_id,
    callback_secret_id,
    configured_at
  ) values (
    p_partner,
    p_provider_key,
    nullif(btrim(p_sender), ''),
    p_enabled,
    v_username_id,
    v_password_id,
    v_callback_id,
    now()
  )
  on conflict (partner_id) do update set
    provider_key = excluded.provider_key,
    sender = excluded.sender,
    enabled = excluded.enabled,
    username_secret_id = excluded.username_secret_id,
    password_secret_id = excluded.password_secret_id,
    callback_secret_id = excluded.callback_secret_id,
    configured_at = excluded.configured_at;
end;
$$;
revoke all on function public.save_partner_sms_config(uuid, text, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.save_partner_sms_config(uuid, text, text, text, text, text, boolean)
  to authenticated, service_role;

-- Service worker only: resolves one tenant to provider credentials. No browser
-- or authenticated Data API role can execute this function or read Vault.
create or replace function public.resolve_partner_sms_config(p_tenant uuid)
returns table (
  provider_key text,
  sender text,
  username text,
  password text,
  callback_secret text,
  callback_username text,
  cost_currency text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user <> 'service_role' and coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role',
    false
  ) = false then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  return query
  select
    coalesce(c.provider_key, 'corevo_46elks'),
    c.sender,
    u.decrypted_secret,
    pw.decrypted_secret,
    cb.decrypted_secret,
    case
      when c.provider_key = 'partner_46elks'
        then 'partner-' || t.partner_id::text
      else 'corevo'
    end,
    case when c.provider_key = 'partner_46elks' then p.currency else 'SEK' end
  from public.tenants t
  left join public.partners p on p.id = t.partner_id
  left join public.partner_sms_configs c
    on c.partner_id = t.partner_id and c.enabled = true
  left join vault.decrypted_secrets u on u.id = c.username_secret_id
  left join vault.decrypted_secrets pw on pw.id = c.password_secret_id
  left join vault.decrypted_secrets cb on cb.id = c.callback_secret_id
  where t.id = p_tenant;
end;
$$;
revoke all on function public.resolve_partner_sms_config(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_partner_sms_config(uuid) to service_role;

-- Delivery webhook only: resolve the callback secret selected by the Basic Auth
-- username. It remains valid for already-sent messages even if sending is paused.
create or replace function public.resolve_partner_sms_callback(p_partner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if current_user <> 'service_role' and coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role',
    false
  ) = false then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select ds.decrypted_secret into v_secret
  from public.partner_sms_configs c
  join vault.decrypted_secrets ds on ds.id = c.callback_secret_id
  where c.partner_id = p_partner
    and c.provider_key = 'partner_46elks';
  return v_secret;
end;
$$;
revoke all on function public.resolve_partner_sms_callback(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_partner_sms_callback(uuid) to service_role;

-- Bind partner-authenticated callbacks to that partner's frozen outbox owner.
-- Corevo's global callback (p_partner null) can acknowledge shared-provider rows.
drop function if exists public.record_sms_delivery(text, text, timestamptz);
create function public.record_sms_delivery(
  p_provider_ref text,
  p_status text,
  p_delivered_at timestamptz,
  p_partner uuid default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_current text;
begin
  if p_provider_ref is null or p_provider_ref !~ '^s[a-f0-9]{32}$' then
    raise exception 'sms_provider_ref_invalid' using errcode = '22023';
  end if;
  if p_status not in ('sent', 'delivered', 'failed') then
    raise exception 'sms_delivery_status_invalid' using errcode = '22023';
  end if;
  if (p_status = 'delivered' and p_delivered_at is null)
     or (p_status <> 'delivered' and p_delivered_at is not null) then
    raise exception 'sms_delivery_timestamp_invalid' using errcode = '22023';
  end if;

  select o.id, o.status into v_id, v_current
  from public.notifications_outbox o
  where o.chosen_channel = 'sms'
    and o.provider_ref = p_provider_ref
    and (p_partner is null or o.partner_id = p_partner)
  for update;

  if v_id is null then return 'unknown_provider'; end if;
  if v_current = p_status then return 'idempotent'; end if;
  if v_current in ('delivered', 'failed') then return 'terminal'; end if;

  update public.notifications_outbox
    set status = p_status,
        sent_at = coalesce(sent_at, now()),
        delivered_at = case when p_status = 'delivered' then p_delivered_at else delivered_at end,
        skip_reason = case when p_status = 'failed' then 'provider_rejected' else null end,
        last_error = case when p_status = 'failed' then 'provider_rejected' else null end,
        updated_at = now()
  where id = v_id and status not in ('delivered', 'failed');
  return 'updated';
end;
$$;
revoke all on function public.record_sms_delivery(text, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.record_sms_delivery(text, text, timestamptz, uuid)
  to service_role;

-- Existing rows belong to partner zero (Zivar) until explicitly assigned in UI.
-- Do not backfill tenants to a fabricated partner entity.

commit;
