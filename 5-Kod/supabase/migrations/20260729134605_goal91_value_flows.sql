-- Goal 91: tenant-bound, append-only gift-card and loyalty value commands.
-- Paid purchase/refund integration stays fail-closed until Goal 92.
begin;

-- Existing raw gift-card codes must be normalizable without collisions before
-- they are irreversibly replaced by hashes.
do $$
begin
  if (exists (
    select 1
      from public.gift_cards g
     where g.balance_cents < 0
        or g.initial_amount_cents < 0
        or g.balance_cents > 10000000
        or g.initial_amount_cents > 10000000
        or g.currency !~ '^[A-Z]{3}$'
        or pg_catalog.length(
             pg_catalog.upper(pg_catalog.regexp_replace(g.code, '[^0-9A-Za-z]', '', 'g'))
           ) < 4
  )) then
    raise exception 'goal91_gift_card_preflight_failed';
  end if;

  if (exists (
    select 1
      from public.gift_cards g
     group by
       g.tenant_id,
       pg_catalog.upper(pg_catalog.regexp_replace(g.code, '[^0-9A-Za-z]', '', 'g'))
    having pg_catalog.count(*) > 1
  )) then
    raise exception 'goal91_normalized_code_collision';
  end if;
end
$$;

alter table public.gift_cards
  add column if not exists code_hash text,
  add column if not exists code_last_four text,
  add column if not exists code_version text;

update public.gift_cards g
   set code_hash = pg_catalog.encode(
         extensions.digest(
           pg_catalog.convert_to(
             pg_catalog.upper(pg_catalog.regexp_replace(g.code, '[^0-9A-Za-z]', '', 'g')),
             'UTF8'
           ),
           'sha256'
         ),
         'hex'
       ),
       code_last_four = pg_catalog.right(
         pg_catalog.upper(pg_catalog.regexp_replace(g.code, '[^0-9A-Za-z]', '', 'g')),
         4
       ),
       code_version = 'legacy-v1',
       code = 'redacted:' || g.id::text
 where g.code_hash is null;

alter table public.gift_cards
  alter column code_hash set not null,
  alter column code_last_four set not null,
  alter column code_version set not null,
  add constraint gift_cards_code_hash_format
    check (code_hash ~ '^[0-9a-f]{64}$'),
  add constraint gift_cards_code_last_four_format
    check (code_last_four ~ '^[0-9A-Z]{4}$'),
  add constraint gift_cards_code_redacted
    check (code = 'redacted:' || id::text),
  add constraint gift_cards_amount_bounds
    check (
      initial_amount_cents between 0 and 10000000
      and balance_cents between 0 and 10000000
    ),
  add constraint gift_cards_currency_format
    check (currency ~ '^[A-Z]{3}$');

create unique index if not exists gift_cards_tenant_code_hash_unique
  on public.gift_cards (tenant_id, code_hash);
create unique index if not exists gift_cards_id_tenant_unique
  on public.gift_cards (id, tenant_id);

create table public.gift_card_entries (
  id                  uuid primary key default extensions.gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete restrict,
  gift_card_id        uuid not null,
  amount_cents        integer not null,
  balance_after_cents integer not null check (balance_after_cents between 0 and 10000000),
  currency            text not null check (currency ~ '^[A-Z]{3}$'),
  entry_type          text not null check (
    entry_type in ('opening', 'issue', 'redeem', 'restore', 'void', 'adjustment')
  ),
  source_type         text not null,
  source_id           text,
  reversal_of         uuid,
  idempotency_key     uuid,
  request_hash        text,
  actor_user_id       uuid,
  reason              text,
  created_at          timestamptz not null default pg_catalog.now(),
  constraint gift_card_entries_card_tenant_fkey
    foreign key (gift_card_id, tenant_id)
    references public.gift_cards (id, tenant_id)
    on delete restrict,
  constraint gift_card_entries_command_metadata
    check (
      entry_type = 'opening'
      or (
        idempotency_key is not null
        and request_hash ~ '^[0-9a-f]{64}$'
      )
    ),
  constraint gift_card_entries_reason_required
    check (
      entry_type not in ('restore', 'void', 'adjustment')
      or pg_catalog.btrim(coalesce(reason, '')) <> ''
    )
);

create unique index gift_card_entries_id_tenant_unique
  on public.gift_card_entries (id, tenant_id);
alter table public.gift_card_entries
  add constraint gift_card_entries_reversal_tenant_fkey
    foreign key (reversal_of, tenant_id)
    references public.gift_card_entries (id, tenant_id)
    on delete restrict;
create unique index gift_card_entries_tenant_idempotency_unique
  on public.gift_card_entries (tenant_id, idempotency_key)
  where idempotency_key is not null;
create unique index gift_card_entries_tenant_reversal_unique
  on public.gift_card_entries (tenant_id, reversal_of)
  where reversal_of is not null;
create index gift_card_entries_card_created_idx
  on public.gift_card_entries (tenant_id, gift_card_id, created_at, id);

alter table public.gift_card_entries enable row level security;
create policy gift_card_entries_admin_read
  on public.gift_card_entries
  for select
  to authenticated
  using (
    (
      tenant_id = (select private.tenant_id())
      and (select private.has_organization_scope())
    )
    or (select private.can_access_tenant(tenant_id))
  );
revoke all on table public.gift_card_entries from public, anon, authenticated, service_role;
grant select on table public.gift_card_entries to authenticated, service_role;

-- One deliberately small transactional outbox. It records value events only;
-- no raw code, hash, PII, transport or generic command bus lives here.
create table private.value_flow_outbox (
  id           uuid primary key default extensions.gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  domain       text not null check (domain in ('gift_card', 'loyalty')),
  event_type   text not null,
  event_key    text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  attempts     integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default pg_catalog.now(),
  processed_at timestamptz,
  created_at   timestamptz not null default pg_catalog.now(),
  unique (tenant_id, domain, event_type, event_key)
);
revoke all on table private.value_flow_outbox from public, anon, authenticated, service_role;
grant select, update on table private.value_flow_outbox to service_role;

create or replace function private.gift_card_entries_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'gift_card_entries_append_only' using errcode = '42501';
end;
$$;
revoke all on function private.gift_card_entries_append_only()
  from public, anon, authenticated, service_role;

create trigger trg_gift_card_entries_no_update
  before update on public.gift_card_entries
  for each row execute function private.gift_card_entries_append_only();
create trigger trg_gift_card_entries_no_delete
  before delete on public.gift_card_entries
  for each row execute function private.gift_card_entries_append_only();

-- Preserve every existing cached balance as an opening entry. Legacy void cards
-- then receive an explicit migration void so unusable value is no longer hidden
-- behind a positive mutable balance.
insert into public.gift_card_entries (
  tenant_id,
  gift_card_id,
  amount_cents,
  balance_after_cents,
  currency,
  entry_type,
  source_type,
  reason
)
select
  g.tenant_id,
  g.id,
  g.balance_cents,
  g.balance_cents,
  g.currency,
  'opening',
  'goal91_migration',
  'legacy balance opening'
from public.gift_cards g;

insert into public.gift_card_entries (
  tenant_id,
  gift_card_id,
  amount_cents,
  balance_after_cents,
  currency,
  entry_type,
  source_type,
  reason
)
select
  g.tenant_id,
  g.id,
  -g.balance_cents,
  0,
  g.currency,
  'void',
  'goal91_migration',
  'legacy void normalization'
from public.gift_cards g
where g.status = 'void'
  and g.balance_cents > 0;

update public.gift_cards
   set balance_cents = 0
 where status = 'void'
   and balance_cents > 0;

create or replace function private.goal91_request_hash(p_payload jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_payload::text, 'UTF8'), 'sha256'),
    'hex'
  )
$$;
revoke all on function private.goal91_request_hash(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.require_goal91_value_admin(
  p_tenant uuid,
  p_module text,
  p_require_live boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.role()), '');
  v_state text;
begin
  if p_tenant is null then
    raise exception 'value_tenant_required' using errcode = '22023';
  end if;

  if v_role <> 'service_role' and (
    (select auth.uid()) is null
    or not (
      (
        (select private.tenant_id()) = p_tenant
        and (select private.role_level()) >= 6
        and (select private.has_organization_scope())
      )
      or (select private.can_access_tenant(p_tenant))
    )
  ) then
    raise exception 'value_admin_scope_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.tenants t
     where t.id = p_tenant
       and t.status = 'active'
  ) then
    raise exception 'value_tenant_inactive' using errcode = '42501';
  end if;

  if p_require_live then
    select tm.state
      into v_state
      from public.tenant_modules tm
     where tm.tenant_id = p_tenant
       and tm.module_key = p_module;
    if v_state is distinct from 'live' then
      raise exception 'value_module_not_live' using errcode = '42501';
    end if;
  end if;
end;
$$;
revoke all on function private.require_goal91_value_admin(uuid, text, boolean)
  from public, anon, authenticated, service_role;

-- All value writes now go through commands. Service-role keeps only the narrow
-- delivery-claim field until Goal 92 replaces the old paid issuance path.
drop policy if exists gift_cards_owner_insert on public.gift_cards;
drop policy if exists gift_cards_owner_update on public.gift_cards;
drop policy if exists gift_cards_platform_write on public.gift_cards;
revoke insert, update, delete on table public.gift_cards from authenticated, service_role;
grant select on table public.gift_cards to authenticated, service_role;
grant update (emailed_at) on table public.gift_cards to service_role;

create or replace function private.guard_gift_card_owner_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if pg_catalog.current_setting('private.goal91_gift_command', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and coalesce((select auth.role()), '') = 'service_role'
     and (
       pg_catalog.to_jsonb(new) - array['emailed_at', 'updated_at']
     ) is not distinct from (
       pg_catalog.to_jsonb(old) - array['emailed_at', 'updated_at']
     ) then
    return new;
  end if;
  raise exception 'gift_card_value_fields_are_command_owned' using errcode = '42501';
end;
$$;
revoke all on function private.guard_gift_card_owner_write()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_gift_card_owner_guard on public.gift_cards;
create trigger trg_gift_card_owner_guard
  before insert or update on public.gift_cards
  for each row execute function private.guard_gift_card_owner_write();

create or replace function public.issue_gift_card(
  p_tenant uuid,
  p_code_hash text,
  p_code_last_four text,
  p_amount_cents integer,
  p_currency text,
  p_recipient_name text,
  p_recipient_email text,
  p_message text,
  p_expires_at timestamptz,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.gift_card_entries%rowtype;
  v_card_id uuid := extensions.gen_random_uuid();
  v_entry_id uuid;
  v_currency text := pg_catalog.upper(pg_catalog.btrim(p_currency));
begin
  perform private.require_goal91_value_admin(p_tenant, 'presentkort', true);
  if p_idempotency_key is null
     or p_amount_cents not between 100 and 10000000
     or v_currency !~ '^[A-Z]{3}$'
     or pg_catalog.lower(coalesce(p_code_hash, '')) !~ '^[0-9a-f]{64}$'
     or pg_catalog.upper(coalesce(p_code_last_four, '')) !~ '^[0-9A-F]{4}$'
     or pg_catalog.length(coalesce(p_recipient_name, '')) > 120
     or pg_catalog.length(coalesce(p_recipient_email, '')) > 320
     or pg_catalog.length(coalesce(p_message, '')) > 2000
     or (p_expires_at is not null and p_expires_at <= pg_catalog.now())
  then
    raise exception 'gift_card_issue_invalid' using errcode = '22023';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'issue',
    'code_hash', pg_catalog.lower(p_code_hash),
    'last_four', pg_catalog.upper(p_code_last_four),
    'amount_cents', p_amount_cents,
    'currency', v_currency,
    'recipient_name', p_recipient_name,
    'recipient_email', p_recipient_email,
    'message', p_message,
    'expires_at', p_expires_at
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select e.*
    into v_existing
    from public.gift_card_entries e
   where e.tenant_id = p_tenant
     and e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.entry_type <> 'issue' then
      raise exception 'gift_card_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'gift_card_id', v_existing.gift_card_id,
      'entry_id', v_existing.id,
      'balance_cents', v_existing.balance_after_cents,
      'status', 'active',
      'code_last_four', pg_catalog.upper(p_code_last_four)
    );
  end if;

  perform pg_catalog.set_config('private.goal91_gift_command', 'on', true);
  insert into public.gift_cards (
    id,
    tenant_id,
    code,
    code_hash,
    code_last_four,
    code_version,
    initial_amount_cents,
    balance_cents,
    currency,
    status,
    recipient_name,
    recipient_email,
    message,
    expires_at,
    issued_at
  ) values (
    v_card_id,
    p_tenant,
    'redacted:' || v_card_id::text,
    pg_catalog.lower(p_code_hash),
    pg_catalog.upper(p_code_last_four),
    'hmac-sha256-v1',
    p_amount_cents,
    p_amount_cents,
    v_currency,
    'active',
    nullif(pg_catalog.btrim(p_recipient_name), ''),
    nullif(pg_catalog.btrim(p_recipient_email), ''),
    nullif(pg_catalog.btrim(p_message), ''),
    p_expires_at,
    pg_catalog.now()
  );

  insert into public.gift_card_entries (
    tenant_id,
    gift_card_id,
    amount_cents,
    balance_after_cents,
    currency,
    entry_type,
    source_type,
    source_id,
    idempotency_key,
    request_hash,
    actor_user_id
  ) values (
    p_tenant,
    v_card_id,
    p_amount_cents,
    p_amount_cents,
    v_currency,
    'issue',
    'admin',
    p_idempotency_key::text,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid())
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'gift_card.issue',
    'gift_card',
    v_card_id,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'amount_cents', p_amount_cents,
      'currency', v_currency
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'gift_card',
    'gift_card.issued',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'gift_card_id', v_card_id,
      'amount_cents', p_amount_cents,
      'balance_after_cents', p_amount_cents
    )
  );

  return pg_catalog.jsonb_build_object(
    'gift_card_id', v_card_id,
    'entry_id', v_entry_id,
    'balance_cents', p_amount_cents,
    'status', 'active',
    'code_last_four', pg_catalog.upper(p_code_last_four)
  );
end;
$$;

create or replace function public.redeem_gift_card(
  p_tenant uuid,
  p_code_hash text,
  p_amount_cents integer,
  p_currency text,
  p_idempotency_key uuid,
  p_source_type text default 'admin',
  p_source_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.gift_card_entries%rowtype;
  v_card public.gift_cards%rowtype;
  v_entry_id uuid;
  v_balance integer;
  v_status text;
  v_currency text := pg_catalog.upper(pg_catalog.btrim(p_currency));
begin
  perform private.require_goal91_value_admin(p_tenant, 'presentkort', true);
  if p_idempotency_key is null
     or p_amount_cents not between 1 and 10000000
     or v_currency !~ '^[A-Z]{3}$'
     or pg_catalog.lower(coalesce(p_code_hash, '')) !~ '^[0-9a-f]{64}$'
     or p_source_type not in ('admin', 'booking', 'checkout', 'shop_order', 'payment')
     or pg_catalog.length(coalesce(p_source_id, '')) > 200
  then
    raise exception 'gift_card_redemption_invalid' using errcode = '22023';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'redeem',
    'code_hash', pg_catalog.lower(p_code_hash),
    'amount_cents', p_amount_cents,
    'currency', v_currency,
    'source_type', p_source_type,
    'source_id', p_source_id
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select e.*
    into v_existing
    from public.gift_card_entries e
   where e.tenant_id = p_tenant
     and e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.entry_type <> 'redeem' then
      raise exception 'gift_card_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'gift_card_id', v_existing.gift_card_id,
      'entry_id', v_existing.id,
      'balance_cents', v_existing.balance_after_cents,
      'status', case
        when v_existing.balance_after_cents = 0 then 'redeemed'
        else 'active'
      end,
      'code_last_four', (
        select g.code_last_four
          from public.gift_cards g
         where g.id = v_existing.gift_card_id
           and g.tenant_id = p_tenant
      )
    );
  end if;

  select g.*
    into v_card
    from public.gift_cards g
   where g.tenant_id = p_tenant
     and g.code_hash = pg_catalog.lower(p_code_hash)
   for update;
  if not found then
    raise exception 'gift_card_unavailable' using errcode = 'P0002';
  end if;
  if v_card.status = 'void' then
    raise exception 'gift_card_void' using errcode = 'P0001';
  end if;
  if v_card.expires_at is not null and v_card.expires_at <= pg_catalog.now() then
    raise exception 'gift_card_expired' using errcode = 'P0001';
  end if;
  if v_card.status <> 'active' or v_card.balance_cents <= 0 then
    raise exception 'gift_card_unavailable' using errcode = 'P0001';
  end if;
  if v_card.currency <> v_currency then
    raise exception 'gift_card_currency_mismatch' using errcode = '22023';
  end if;
  if v_card.balance_cents < p_amount_cents then
    raise exception 'gift_card_insufficient_balance' using errcode = 'P0001';
  end if;

  v_balance := v_card.balance_cents - p_amount_cents;
  v_status := case when v_balance = 0 then 'redeemed' else 'active' end;
  perform pg_catalog.set_config('private.goal91_gift_command', 'on', true);
  update public.gift_cards
     set balance_cents = v_balance,
         status = v_status
   where id = v_card.id
     and tenant_id = p_tenant;

  insert into public.gift_card_entries (
    tenant_id,
    gift_card_id,
    amount_cents,
    balance_after_cents,
    currency,
    entry_type,
    source_type,
    source_id,
    idempotency_key,
    request_hash,
    actor_user_id
  ) values (
    p_tenant,
    v_card.id,
    -p_amount_cents,
    v_balance,
    v_currency,
    'redeem',
    p_source_type,
    p_source_id,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid())
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'gift_card.redeem',
    'gift_card',
    v_card.id,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'amount_cents', p_amount_cents,
      'currency', v_currency,
      'balance_after_cents', v_balance
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'gift_card',
    'gift_card.redeemed',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'gift_card_id', v_card.id,
      'amount_cents', p_amount_cents,
      'balance_after_cents', v_balance
    )
  );

  return pg_catalog.jsonb_build_object(
    'gift_card_id', v_card.id,
    'entry_id', v_entry_id,
    'balance_cents', v_balance,
    'status', v_status,
    'code_last_four', v_card.code_last_four
  );
end;
$$;

create or replace function public.restore_gift_card_redemption(
  p_tenant uuid,
  p_redemption_entry uuid,
  p_idempotency_key uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.gift_card_entries%rowtype;
  v_original public.gift_card_entries%rowtype;
  v_card public.gift_cards%rowtype;
  v_entry_id uuid;
  v_restore integer;
  v_balance integer;
  v_status text;
begin
  perform private.require_goal91_value_admin(p_tenant, 'presentkort', false);
  if p_idempotency_key is null
     or p_redemption_entry is null
     or pg_catalog.btrim(coalesce(p_reason, '')) = ''
     or pg_catalog.length(p_reason) > 500
  then
    raise exception 'gift_card_restore_invalid' using errcode = '22023';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'restore',
    'redemption_entry', p_redemption_entry,
    'reason', pg_catalog.btrim(p_reason)
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select e.*
    into v_existing
    from public.gift_card_entries e
   where e.tenant_id = p_tenant
     and e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.entry_type <> 'restore' then
      raise exception 'gift_card_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'gift_card_id', v_existing.gift_card_id,
      'entry_id', v_existing.id,
      'balance_cents', v_existing.balance_after_cents
    );
  end if;

  select e.*
    into v_original
    from public.gift_card_entries e
   where e.id = p_redemption_entry
     and e.tenant_id = p_tenant
   for update;
  if not found
     or v_original.entry_type <> 'redeem'
     or v_original.amount_cents >= 0
  then
    raise exception 'gift_card_redemption_not_found' using errcode = 'P0002';
  end if;
  if (exists (
    select 1
      from public.gift_card_entries e
     where e.tenant_id = p_tenant
       and e.reversal_of = v_original.id
  )) then
    raise exception 'gift_card_reversal_exists' using errcode = '23505';
  end if;

  select g.*
    into v_card
    from public.gift_cards g
   where g.id = v_original.gift_card_id
     and g.tenant_id = p_tenant
   for update;
  if not found then
    raise exception 'gift_card_unavailable' using errcode = 'P0002';
  end if;

  v_restore := -v_original.amount_cents;
  v_balance := v_card.balance_cents + v_restore;
  if v_balance > 10000000 then
    raise exception 'gift_card_balance_limit' using errcode = '22003';
  end if;
  v_status := case
    when v_card.status = 'void' then 'void'
    when v_card.expires_at is not null and v_card.expires_at <= pg_catalog.now() then 'expired'
    else 'active'
  end;

  perform pg_catalog.set_config('private.goal91_gift_command', 'on', true);
  update public.gift_cards
     set balance_cents = v_balance,
         status = v_status
   where id = v_card.id
     and tenant_id = p_tenant;

  insert into public.gift_card_entries (
    tenant_id,
    gift_card_id,
    amount_cents,
    balance_after_cents,
    currency,
    entry_type,
    source_type,
    source_id,
    reversal_of,
    idempotency_key,
    request_hash,
    actor_user_id,
    reason
  ) values (
    p_tenant,
    v_card.id,
    v_restore,
    v_balance,
    v_card.currency,
    'restore',
    'refund_restore',
    v_original.id::text,
    v_original.id,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid()),
    pg_catalog.btrim(p_reason)
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'gift_card.restore',
    'gift_card',
    v_card.id,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'reversal_of', v_original.id,
      'amount_cents', v_restore,
      'balance_after_cents', v_balance
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'gift_card',
    'gift_card.restored',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'gift_card_id', v_card.id,
      'reversal_of', v_original.id,
      'amount_cents', v_restore,
      'balance_after_cents', v_balance
    )
  );

  return pg_catalog.jsonb_build_object(
    'gift_card_id', v_card.id,
    'entry_id', v_entry_id,
    'balance_cents', v_balance,
    'status', v_status
  );
end;
$$;

create or replace function public.void_gift_card(
  p_tenant uuid,
  p_gift_card uuid,
  p_idempotency_key uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.gift_card_entries%rowtype;
  v_card public.gift_cards%rowtype;
  v_entry_id uuid;
begin
  perform private.require_goal91_value_admin(p_tenant, 'presentkort', false);
  if p_idempotency_key is null
     or p_gift_card is null
     or pg_catalog.btrim(coalesce(p_reason, '')) = ''
     or pg_catalog.length(p_reason) > 500
  then
    raise exception 'gift_card_void_invalid' using errcode = '22023';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'void',
    'gift_card_id', p_gift_card,
    'reason', pg_catalog.btrim(p_reason)
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select e.*
    into v_existing
    from public.gift_card_entries e
   where e.tenant_id = p_tenant
     and e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.entry_type <> 'void' then
      raise exception 'gift_card_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'gift_card_id', v_existing.gift_card_id,
      'entry_id', v_existing.id,
      'balance_cents', v_existing.balance_after_cents,
      'status', 'void'
    );
  end if;

  select g.*
    into v_card
    from public.gift_cards g
   where g.id = p_gift_card
     and g.tenant_id = p_tenant
   for update;
  if not found then
    raise exception 'gift_card_unavailable' using errcode = 'P0002';
  end if;
  if v_card.status <> 'active' or v_card.balance_cents <= 0 then
    raise exception 'gift_card_not_voidable' using errcode = 'P0001';
  end if;

  perform pg_catalog.set_config('private.goal91_gift_command', 'on', true);
  update public.gift_cards
     set balance_cents = 0,
         status = 'void'
   where id = v_card.id
     and tenant_id = p_tenant;

  insert into public.gift_card_entries (
    tenant_id,
    gift_card_id,
    amount_cents,
    balance_after_cents,
    currency,
    entry_type,
    source_type,
    source_id,
    idempotency_key,
    request_hash,
    actor_user_id,
    reason
  ) values (
    p_tenant,
    v_card.id,
    -v_card.balance_cents,
    0,
    v_card.currency,
    'void',
    'admin',
    p_gift_card::text,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid()),
    pg_catalog.btrim(p_reason)
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'gift_card.void',
    'gift_card',
    v_card.id,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'amount_cents', v_card.balance_cents,
      'balance_after_cents', 0,
      'reason', pg_catalog.btrim(p_reason)
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'gift_card',
    'gift_card.voided',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'gift_card_id', v_card.id,
      'amount_cents', v_card.balance_cents,
      'balance_after_cents', 0
    )
  );

  return pg_catalog.jsonb_build_object(
    'gift_card_id', v_card.id,
    'entry_id', v_entry_id,
    'balance_cents', 0,
    'status', 'void'
  );
end;
$$;

create or replace function public.adjust_gift_card(
  p_tenant uuid,
  p_gift_card uuid,
  p_delta_cents integer,
  p_idempotency_key uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.gift_card_entries%rowtype;
  v_card public.gift_cards%rowtype;
  v_entry_id uuid;
  v_balance integer;
  v_status text;
begin
  perform private.require_goal91_value_admin(p_tenant, 'presentkort', true);
  if p_idempotency_key is null
     or p_gift_card is null
     or p_delta_cents = 0
     or pg_catalog.abs(p_delta_cents) > 10000000
     or pg_catalog.btrim(coalesce(p_reason, '')) = ''
     or pg_catalog.length(p_reason) > 500
  then
    raise exception 'gift_card_adjustment_invalid' using errcode = '22023';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'adjust',
    'gift_card_id', p_gift_card,
    'delta_cents', p_delta_cents,
    'reason', pg_catalog.btrim(p_reason)
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select e.*
    into v_existing
    from public.gift_card_entries e
   where e.tenant_id = p_tenant
     and e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.entry_type <> 'adjustment' then
      raise exception 'gift_card_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'gift_card_id', v_existing.gift_card_id,
      'entry_id', v_existing.id,
      'balance_cents', v_existing.balance_after_cents
    );
  end if;

  select g.*
    into v_card
    from public.gift_cards g
   where g.id = p_gift_card
     and g.tenant_id = p_tenant
   for update;
  if not found then
    raise exception 'gift_card_unavailable' using errcode = 'P0002';
  end if;
  if v_card.status not in ('active', 'redeemed')
     or (v_card.expires_at is not null and v_card.expires_at <= pg_catalog.now())
  then
    raise exception 'gift_card_not_adjustable' using errcode = 'P0001';
  end if;

  v_balance := v_card.balance_cents + p_delta_cents;
  if v_balance not between 0 and 10000000 then
    raise exception 'gift_card_balance_limit' using errcode = '22003';
  end if;
  v_status := case when v_balance = 0 then 'redeemed' else 'active' end;

  perform pg_catalog.set_config('private.goal91_gift_command', 'on', true);
  update public.gift_cards
     set balance_cents = v_balance,
         status = v_status
   where id = v_card.id
     and tenant_id = p_tenant;

  insert into public.gift_card_entries (
    tenant_id,
    gift_card_id,
    amount_cents,
    balance_after_cents,
    currency,
    entry_type,
    source_type,
    source_id,
    idempotency_key,
    request_hash,
    actor_user_id,
    reason
  ) values (
    p_tenant,
    v_card.id,
    p_delta_cents,
    v_balance,
    v_card.currency,
    'adjustment',
    'admin',
    p_gift_card::text,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid()),
    pg_catalog.btrim(p_reason)
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'gift_card.adjust',
    'gift_card',
    v_card.id,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'delta_cents', p_delta_cents,
      'balance_after_cents', v_balance,
      'reason', pg_catalog.btrim(p_reason)
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'gift_card',
    'gift_card.adjusted',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'gift_card_id', v_card.id,
      'delta_cents', p_delta_cents,
      'balance_after_cents', v_balance
    )
  );

  return pg_catalog.jsonb_build_object(
    'gift_card_id', v_card.id,
    'entry_id', v_entry_id,
    'balance_cents', v_balance,
    'status', v_status
  );
end;
$$;

-- The legacy paid-order helper cannot satisfy the no-plaintext contract. Keep it
-- explicitly closed until Goal 92 replaces issuance and delivery as one rail.
create or replace function public._generate_gift_code(
  p_tenant uuid,
  p_prefix text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'gift_card_paid_issuance_requires_goal92' using errcode = '42501';
end;
$$;

-- Existing loyalty earns stay intact. Command metadata is nullable only for
-- historical/trigger-created rows; every new spend/reversal receives all fields.
alter table public.loyalty_ledger
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists reversal_of uuid,
  add column if not exists idempotency_key uuid,
  add column if not exists request_hash text,
  add column if not exists actor_user_id uuid,
  add column if not exists balance_after_points integer;

alter table public.loyalty_ledger
  add constraint loyalty_ledger_request_hash_format
    check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$'),
  add constraint loyalty_ledger_balance_after_nonnegative
    check (balance_after_points is null or balance_after_points >= 0);
create unique index if not exists loyalty_ledger_id_tenant_unique
  on public.loyalty_ledger (id, tenant_id);
alter table public.loyalty_ledger
  add constraint loyalty_ledger_reversal_tenant_fkey
    foreign key (reversal_of, tenant_id)
    references public.loyalty_ledger (id, tenant_id)
    on delete restrict;
create unique index loyalty_ledger_tenant_idempotency_unique
  on public.loyalty_ledger (tenant_id, idempotency_key)
  where idempotency_key is not null;
create unique index loyalty_ledger_tenant_reversal_unique
  on public.loyalty_ledger (tenant_id, reversal_of)
  where reversal_of is not null;

create or replace function private.protect_loyalty_customer_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (exists (
    select 1
      from private.customer_claim_merge_intents i
     where i.txid = pg_catalog.txid_current()
       and i.tenant_id = old.tenant_id
       and i.duplicate_customer_id = old.customer_id
       and i.canonical_customer_id = new.customer_id
  ))
  and old.id = new.id
  and old.tenant_id = new.tenant_id
  and old.booking_id is not distinct from new.booking_id
  and old.points_delta = new.points_delta
  and old.reason = new.reason
  and old.note is not distinct from new.note
  and old.source_type is not distinct from new.source_type
  and old.source_id is not distinct from new.source_id
  and old.reversal_of is not distinct from new.reversal_of
  and old.idempotency_key is not distinct from new.idempotency_key
  and old.request_hash is not distinct from new.request_hash
  and old.actor_user_id is not distinct from new.actor_user_id
  and old.balance_after_points is not distinct from new.balance_after_points
  and old.created_at = new.created_at then
    return new;
  end if;
  raise exception 'append_only' using errcode = '42501';
end;
$$;
revoke all on function private.protect_loyalty_customer_merge()
  from public, anon, authenticated, service_role;

create or replace function public.spend_loyalty_points(
  p_tenant uuid,
  p_customer uuid,
  p_points integer,
  p_idempotency_key uuid,
  p_source_type text default 'admin',
  p_source_id text default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.loyalty_ledger%rowtype;
  v_entry_id uuid;
  v_balance integer;
begin
  perform private.require_goal91_value_admin(p_tenant, 'lojalitet', true);
  if p_customer is null
     or p_idempotency_key is null
     or p_points not between 1 and 10000000
     or p_source_type not in ('admin', 'booking', 'checkout', 'shop_order')
     or pg_catalog.length(coalesce(p_source_id, '')) > 200
     or pg_catalog.length(coalesce(p_note, '')) > 500
  then
    raise exception 'loyalty_spend_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
      from public.customers c
     where c.id = p_customer
       and c.tenant_id = p_tenant
  ) then
    raise exception 'loyalty_customer_not_found' using errcode = 'P0002';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'loyalty_spend',
    'customer_id', p_customer,
    'points', p_points,
    'source_type', p_source_type,
    'source_id', p_source_id,
    'note', p_note
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select l.*
    into v_existing
    from public.loyalty_ledger l
   where l.tenant_id = p_tenant
     and l.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.reason <> 'redeem' then
      raise exception 'loyalty_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'entry_id', v_existing.id,
      'customer_id', v_existing.customer_id,
      'balance_points', v_existing.balance_after_points
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_customer::text, 0)
  );
  select coalesce(pg_catalog.sum(l.points_delta), 0)::integer
    into v_balance
    from public.loyalty_ledger l
   where l.tenant_id = p_tenant
     and l.customer_id = p_customer;
  if v_balance < p_points then
    raise exception 'loyalty_insufficient_points' using errcode = 'P0001';
  end if;
  v_balance := v_balance - p_points;

  insert into public.loyalty_ledger (
    tenant_id,
    customer_id,
    points_delta,
    reason,
    note,
    source_type,
    source_id,
    idempotency_key,
    request_hash,
    actor_user_id,
    balance_after_points
  ) values (
    p_tenant,
    p_customer,
    -p_points,
    'redeem',
    nullif(pg_catalog.btrim(p_note), ''),
    p_source_type,
    p_source_id,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid()),
    v_balance
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'loyalty.spend',
    'loyalty_ledger',
    v_entry_id,
    pg_catalog.jsonb_build_object(
      'customer_id', p_customer,
      'points', p_points,
      'balance_after_points', v_balance
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'loyalty',
    'loyalty.spent',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'points', p_points,
      'balance_after_points', v_balance
    )
  );

  return pg_catalog.jsonb_build_object(
    'entry_id', v_entry_id,
    'customer_id', p_customer,
    'balance_points', v_balance
  );
end;
$$;

create or replace function public.reverse_loyalty_spend(
  p_tenant uuid,
  p_spend_entry uuid,
  p_idempotency_key uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.loyalty_ledger%rowtype;
  v_original public.loyalty_ledger%rowtype;
  v_entry_id uuid;
  v_points integer;
  v_balance integer;
begin
  perform private.require_goal91_value_admin(p_tenant, 'lojalitet', false);
  if p_spend_entry is null
     or p_idempotency_key is null
     or pg_catalog.btrim(coalesce(p_reason, '')) = ''
     or pg_catalog.length(p_reason) > 500
  then
    raise exception 'loyalty_reversal_invalid' using errcode = '22023';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'loyalty_reverse',
    'spend_entry', p_spend_entry,
    'reason', pg_catalog.btrim(p_reason)
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select l.*
    into v_existing
    from public.loyalty_ledger l
   where l.tenant_id = p_tenant
     and l.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.reversal_of <> p_spend_entry then
      raise exception 'loyalty_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'entry_id', v_existing.id,
      'customer_id', v_existing.customer_id,
      'balance_points', v_existing.balance_after_points
    );
  end if;

  select l.*
    into v_original
    from public.loyalty_ledger l
   where l.id = p_spend_entry
     and l.tenant_id = p_tenant
   for update;
  if not found
     or v_original.reason <> 'redeem'
     or v_original.points_delta >= 0
  then
    raise exception 'loyalty_spend_not_found' using errcode = 'P0002';
  end if;
  if (exists (
    select 1
      from public.loyalty_ledger l
     where l.tenant_id = p_tenant
       and l.reversal_of = v_original.id
  )) then
    raise exception 'loyalty_reversal_exists' using errcode = '23505';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || v_original.customer_id::text, 0)
  );
  select coalesce(pg_catalog.sum(l.points_delta), 0)::integer
    into v_balance
    from public.loyalty_ledger l
   where l.tenant_id = p_tenant
     and l.customer_id = v_original.customer_id;
  v_points := -v_original.points_delta;
  v_balance := v_balance + v_points;

  insert into public.loyalty_ledger (
    tenant_id,
    customer_id,
    booking_id,
    points_delta,
    reason,
    note,
    source_type,
    source_id,
    reversal_of,
    idempotency_key,
    request_hash,
    actor_user_id,
    balance_after_points
  ) values (
    p_tenant,
    v_original.customer_id,
    v_original.booking_id,
    v_points,
    'adjustment',
    pg_catalog.btrim(p_reason),
    'spend_reversal',
    v_original.id::text,
    v_original.id,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid()),
    v_balance
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'loyalty.reverse_spend',
    'loyalty_ledger',
    v_entry_id,
    pg_catalog.jsonb_build_object(
      'reversal_of', v_original.id,
      'points', v_points,
      'balance_after_points', v_balance
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'loyalty',
    'loyalty.spend_reversed',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'reversal_of', v_original.id,
      'points', v_points,
      'balance_after_points', v_balance
    )
  );

  return pg_catalog.jsonb_build_object(
    'entry_id', v_entry_id,
    'customer_id', v_original.customer_id,
    'balance_points', v_balance
  );
end;
$$;

-- A priced plan is only intent until Goal 92 supplies verified subscription,
-- charge and refund primitives.
alter table public.loyalty_members
  drop constraint if exists loyalty_members_status_check;
alter table public.loyalty_members
  add constraint loyalty_members_status_check
    check (status in ('active', 'pending_payment', 'cancelled'));

update public.loyalty_members lm
   set status = 'pending_payment'
  from public.loyalty_plans lp
 where lp.id = lm.plan_id
   and lp.tenant_id = lm.tenant_id
   and lp.price_cents > 0
   and lm.status = 'active';

drop function if exists public.join_loyalty_club(text, text, text, uuid);
create function public.join_loyalty_club(
  p_tenant_slug text,
  p_email text,
  p_name text default null,
  p_plan uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_customer uuid;
  v_state text;
  v_id uuid;
  v_plan uuid;
  v_plan_price integer := 0;
  v_status text := 'active';
begin
  if coalesce(pg_catalog.btrim(p_email), '') = '' then
    raise exception 'email_required' using errcode = 'P0002';
  end if;

  select t.id
    into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  select tm.state
    into v_state
    from public.tenant_modules tm
   where tm.tenant_id = v_tenant
     and tm.module_key = 'lojalitet';
  if v_state is distinct from 'live' then
    raise exception 'module_not_live' using errcode = 'P0001';
  end if;

  if p_plan is not null then
    select lp.id, lp.price_cents
      into v_plan, v_plan_price
      from public.loyalty_plans lp
     where lp.id = p_plan
       and lp.tenant_id = v_tenant
       and lp.active = true;
  end if;
  if v_plan_price > 0 then
    v_status := 'pending_payment';
  end if;

  v_customer := private.resolve_customer_id(
    v_tenant,
    null,
    nullif(pg_catalog.btrim(p_name), ''),
    pg_catalog.btrim(p_email),
    null
  );
  if v_customer is null then
    raise exception 'customer_unresolved' using errcode = 'P0002';
  end if;

  insert into public.loyalty_members (
    tenant_id, customer_id, plan_id, source, status
  ) values (
    v_tenant, v_customer, v_plan, 'klubb', v_status
  )
  on conflict (tenant_id, customer_id) do update
    set plan_id = coalesce(excluded.plan_id, public.loyalty_members.plan_id),
        status = case
          when excluded.plan_id is null then public.loyalty_members.status
          else excluded.status
        end
  returning id, status into v_id, v_status;

  return pg_catalog.jsonb_build_object(
    'membership_id', v_id,
    'status', v_status
  );
end;
$$;

create or replace function public.admin_loyalty_members(p_tenant uuid)
returns table (
  customer_id uuid,
  points_balance bigint,
  rewarded_visits bigint,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_goal91_value_admin(p_tenant, 'lojalitet', false);
  return query
  select
    l.customer_id,
    pg_catalog.sum(l.points_delta)::bigint,
    pg_catalog.count(*) filter (where l.reason = 'earn_completed')::bigint,
    pg_catalog.max(l.created_at)
  from public.loyalty_ledger l
  where l.tenant_id = p_tenant
  group by l.customer_id
  order by pg_catalog.sum(l.points_delta) desc, l.customer_id;
end;
$$;

create or replace function public.gift_card_reconciliation(p_tenant uuid)
returns table (
  currency text,
  card_count bigint,
  cached_balance_cents bigint,
  ledger_balance_cents bigint,
  mismatch_count bigint,
  pending_outbox bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_goal91_value_admin(p_tenant, 'presentkort', false);
  return query
  with balances as (
    select
      g.id,
      g.currency,
      g.balance_cents::bigint as cached,
      coalesce(pg_catalog.sum(e.amount_cents), 0)::bigint as ledger
    from public.gift_cards g
    left join public.gift_card_entries e
      on e.tenant_id = g.tenant_id
     and e.gift_card_id = g.id
    where g.tenant_id = p_tenant
    group by g.id, g.currency, g.balance_cents
  ),
  pending as (
    select pg_catalog.count(*)::bigint as count
      from private.value_flow_outbox o
     where o.tenant_id = p_tenant
       and o.domain = 'gift_card'
       and o.status = 'pending'
  )
  select
    b.currency,
    pg_catalog.count(*)::bigint,
    pg_catalog.sum(b.cached)::bigint,
    pg_catalog.sum(b.ledger)::bigint,
    pg_catalog.count(*) filter (where b.cached <> b.ledger)::bigint,
    (select p.count from pending p)
  from balances b
  group by b.currency;
end;
$$;

create or replace function public.loyalty_reconciliation(p_tenant uuid)
returns table (
  customer_count bigint,
  total_balance_points bigint,
  negative_customer_count bigint,
  command_metadata_gap_count bigint,
  duplicate_reversal_count bigint,
  missing_completion_earn_count bigint,
  pending_outbox bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_goal91_value_admin(p_tenant, 'lojalitet', false);
  return query
  with balances as (
    select
      l.customer_id,
      pg_catalog.sum(l.points_delta)::bigint as balance
    from public.loyalty_ledger l
    where l.tenant_id = p_tenant
    group by l.customer_id
  ),
  missing_earn as (
    select pg_catalog.count(*)::bigint as count
      from public.bookings b
     where b.tenant_id = p_tenant
       and b.status = 'completed'
       and (b.customer_id is not null or b.customer_profile_id is not null)
       and not exists (
         select 1
           from public.loyalty_ledger l
          where l.tenant_id = b.tenant_id
            and l.booking_id = b.id
            and l.reason = 'earn_completed'
       )
  ),
  pending as (
    select pg_catalog.count(*)::bigint as count
      from private.value_flow_outbox o
     where o.tenant_id = p_tenant
       and o.domain = 'loyalty'
       and o.status = 'pending'
  )
  select
    (select pg_catalog.count(*)::bigint from balances),
    coalesce((select pg_catalog.sum(b.balance) from balances b), 0)::bigint,
    (select pg_catalog.count(*)::bigint from balances b where b.balance < 0),
    (
      select pg_catalog.count(*)::bigint
        from public.loyalty_ledger l
       where l.tenant_id = p_tenant
         and l.reason = 'redeem'
         and (
           l.idempotency_key is null
           or l.request_hash is null
           or l.source_type is null
           or l.balance_after_points is null
         )
    ),
    (
      select coalesce(pg_catalog.sum(x.count - 1), 0)::bigint
        from (
          select pg_catalog.count(*)::bigint as count
            from public.loyalty_ledger l
           where l.tenant_id = p_tenant
             and l.reversal_of is not null
           group by l.reversal_of
          having pg_catalog.count(*) > 1
        ) x
    ),
    (select m.count from missing_earn m),
    (select p.count from pending p);
end;
$$;

revoke all on function public.issue_gift_card(
  uuid, text, text, integer, text, text, text, text, timestamptz, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.issue_gift_card(
  uuid, text, text, integer, text, text, text, text, timestamptz, uuid
) to authenticated, service_role;
revoke all on function public.redeem_gift_card(
  uuid, text, integer, text, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.redeem_gift_card(
  uuid, text, integer, text, uuid, text, text
) to authenticated, service_role;
revoke all on function public.restore_gift_card_redemption(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_gift_card_redemption(uuid, uuid, uuid, text)
  to authenticated, service_role;
revoke all on function public.void_gift_card(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.void_gift_card(uuid, uuid, uuid, text)
  to authenticated, service_role;
revoke all on function public.adjust_gift_card(uuid, uuid, integer, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.adjust_gift_card(uuid, uuid, integer, uuid, text)
  to authenticated, service_role;
revoke all on function public.spend_loyalty_points(
  uuid, uuid, integer, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.spend_loyalty_points(
  uuid, uuid, integer, uuid, text, text, text
) to authenticated, service_role;
revoke all on function public.reverse_loyalty_spend(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.reverse_loyalty_spend(uuid, uuid, uuid, text)
  to authenticated, service_role;
revoke all on function public.join_loyalty_club(text, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.join_loyalty_club(text, text, text, uuid)
  to service_role;
revoke all on function public.admin_loyalty_members(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_loyalty_members(uuid)
  to authenticated, service_role;
revoke all on function public.gift_card_reconciliation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.gift_card_reconciliation(uuid)
  to authenticated, service_role;
revoke all on function public.loyalty_reconciliation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.loyalty_reconciliation(uuid)
  to authenticated, service_role;
revoke all on function public._generate_gift_code(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public._generate_gift_code(uuid, text)
  to service_role;

commit;
