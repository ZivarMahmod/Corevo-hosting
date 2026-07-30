-- Goal 90: idempotent onsite intake and one locked event lifecycle.

begin;

alter table public.event_registrations
  add column if not exists idempotency_key uuid,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists lifecycle_version integer not null default 0;

update public.event_registrations
   set idempotency_key = id
 where idempotency_key is null;

alter table public.event_registrations
  alter column idempotency_key set default gen_random_uuid(),
  alter column idempotency_key set not null,
  drop constraint if exists event_registrations_lifecycle_version_check,
  add constraint event_registrations_lifecycle_version_check
    check (lifecycle_version >= 0),
  drop constraint if exists event_registrations_cancellation_reason_check,
  add constraint event_registrations_cancellation_reason_check
    check (cancellation_reason is null or char_length(cancellation_reason) between 1 and 500);

create unique index if not exists event_registrations_tenant_idempotency_unique
  on public.event_registrations (tenant_id, idempotency_key);

alter table public.tenant_events
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists lifecycle_version integer not null default 0;

alter table public.tenant_events
  drop constraint if exists tenant_events_lifecycle_version_check,
  add constraint tenant_events_lifecycle_version_check
    check (lifecycle_version >= 0),
  drop constraint if exists tenant_events_cancellation_reason_check,
  add constraint tenant_events_cancellation_reason_check
    check (cancellation_reason is null or char_length(cancellation_reason) between 1 and 500);

create unique index if not exists tenant_events_id_tenant_unique
  on public.tenant_events (id, tenant_id);

alter table public.event_registrations
  drop constraint if exists event_registrations_event_id_fkey,
  drop constraint if exists event_registrations_event_tenant_fkey,
  add constraint event_registrations_event_tenant_fkey
    foreign key (event_id, tenant_id)
    references public.tenant_events (id, tenant_id)
    on delete restrict
    not valid;

alter table public.event_registrations
  validate constraint event_registrations_event_tenant_fkey;

create or replace function private.guard_goal90_event_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_taken integer;
begin
  if tg_op = 'DELETE' then
    if current_user not in ('postgres', 'supabase_admin')
       and (
         exists (
           select 1
             from public.event_registrations r
            where r.event_id = old.id
         )
         or exists (
           select 1
             from public.shop_order_items i
            where i.event_id = old.id
         )
       ) then
      raise exception 'event_has_registration_history' using errcode = '23503';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'open'
       or new.cancelled_at is not null
       or new.cancelled_by is not null
       or new.cancellation_reason is not null
       or new.lifecycle_version <> 0 then
      raise exception 'event_lifecycle_is_machine_owned' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.capacity is distinct from old.capacity then
    select coalesce(sum(r.party_size), 0)::integer
      into v_taken
      from public.event_registrations r
     where r.tenant_id = old.tenant_id
       and r.event_id = old.id
       and r.status = 'confirmed';
    if new.capacity < v_taken + coalesce(old.reserved_qty, 0) then
      raise exception 'event_capacity_below_occupancy'
        using errcode = '23514',
              detail = (v_taken + coalesce(old.reserved_qty, 0))::text;
    end if;
  end if;

  if current_user not in ('postgres', 'supabase_admin')
     and (
       new.status is distinct from old.status
       or new.cancelled_at is distinct from old.cancelled_at
       or new.cancelled_by is distinct from old.cancelled_by
       or new.cancellation_reason is distinct from old.cancellation_reason
       or new.lifecycle_version is distinct from old.lifecycle_version
     ) then
    raise exception 'event_lifecycle_is_machine_owned' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_goal90_event_lifecycle()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_goal90_event_lifecycle on public.tenant_events;
create trigger trg_goal90_event_lifecycle
  before insert or update or delete on public.tenant_events
  for each row execute function private.guard_goal90_event_lifecycle();

create or replace function private.guard_goal90_registration_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'event_registration_history_is_immutable' using errcode = '23503';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'confirmed'
       or new.cancelled_at is not null
       or new.cancelled_by is not null
       or new.cancellation_reason is not null
       or new.lifecycle_version <> 0 then
      raise exception 'event_registration_lifecycle_is_machine_owned' using errcode = '42501';
    end if;
    return new;
  end if;

  if current_user not in ('postgres', 'supabase_admin')
     and (
       new.status is distinct from old.status
       or new.cancelled_at is distinct from old.cancelled_at
       or new.cancelled_by is distinct from old.cancelled_by
       or new.cancellation_reason is distinct from old.cancellation_reason
       or new.lifecycle_version is distinct from old.lifecycle_version
     ) then
    raise exception 'event_registration_lifecycle_is_machine_owned' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_goal90_registration_lifecycle()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_goal90_registration_lifecycle on public.event_registrations;
create trigger trg_goal90_registration_lifecycle
  before insert or update or delete on public.event_registrations
  for each row execute function private.guard_goal90_registration_lifecycle();

drop function if exists public.create_onsite_event_registration(
  uuid, uuid, text, text, text, integer, text
);

create or replace function public.create_onsite_event_registration(
  p_tenant uuid,
  p_event uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_party_size integer,
  p_message text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.tenant_events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_taken integer := 0;
  v_left integer := 0;
  v_registration uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if p_idempotency_key is null then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if char_length(v_email) < 3 or char_length(v_email) > 160 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_phone is not null and char_length(v_phone) > 40 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_party_size is null or p_party_size < 1 or p_party_size > 8 then
    raise exception 'invalid_party_size' using errcode = '22023';
  end if;
  if v_message is not null and char_length(v_message) > 2000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  select r.*
    into v_existing
    from public.event_registrations r
   where r.tenant_id = p_tenant
     and r.idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    if v_existing.event_id is distinct from p_event
       or v_existing.name is distinct from v_name
       or v_existing.email is distinct from v_email
       or v_existing.phone is distinct from v_phone
       or v_existing.party_size is distinct from p_party_size
       or v_existing.message is distinct from v_message then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'registration_id', v_existing.id,
      'seats_left', null,
      'already_registered', true
    );
  end if;

  select e.*
    into v_event
    from public.tenant_events e
   where e.id = p_event
     and e.tenant_id = p_tenant
   for update;

  -- A concurrent first request may have inserted while this call waited on the event lock.
  select r.*
    into v_existing
    from public.event_registrations r
   where r.tenant_id = p_tenant
     and r.idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    if v_existing.event_id is distinct from p_event
       or v_existing.name is distinct from v_name
       or v_existing.email is distinct from v_email
       or v_existing.phone is distinct from v_phone
       or v_existing.party_size is distinct from p_party_size
       or v_existing.message is distinct from v_message then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'registration_id', v_existing.id,
      'seats_left', null,
      'already_registered', true
    );
  end if;

  if v_event.id is null or v_event.status <> 'open' or v_event.starts_at <= now() then
    raise exception 'event_not_open' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.tenant_modules tm
     where tm.tenant_id = p_tenant
       and tm.module_key = 'kurser'
       and tm.state = 'live'
       and coalesce(tm.config->>'payment', 'onsite') = 'onsite'
  ) then
    raise exception 'onsite_registration_not_live' using errcode = '42501';
  end if;

  select coalesce(sum(r.party_size), 0)::integer
    into v_taken
    from public.event_registrations r
   where r.tenant_id = p_tenant
     and r.event_id = p_event
     and r.status = 'confirmed';

  v_left := greatest(0, v_event.capacity - v_taken - coalesce(v_event.reserved_qty, 0));
  if p_party_size > v_left then
    raise exception 'event_capacity_exceeded'
      using errcode = '23P01', detail = v_left::text;
  end if;

  insert into public.event_registrations (
    tenant_id,
    event_id,
    name,
    email,
    phone,
    party_size,
    message,
    status,
    idempotency_key
  ) values (
    p_tenant,
    p_event,
    v_name,
    v_email,
    v_phone,
    p_party_size,
    v_message,
    'confirmed',
    p_idempotency_key
  )
  returning id into v_registration;

  return jsonb_build_object(
    'registration_id', v_registration,
    'seats_left', v_left - p_party_size,
    'already_registered', false
  );
end;
$$;

revoke all on function public.create_onsite_event_registration(
  uuid, uuid, text, text, text, integer, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_onsite_event_registration(
  uuid, uuid, text, text, text, integer, text, uuid
) to service_role;

create or replace function public.set_tenant_event_status(
  p_tenant uuid,
  p_event uuid,
  p_status text,
  p_reason text default null
) returns table (
  outcome text,
  event_status text,
  version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant uuid := (select private.tenant_id());
  v_level integer := (select private.role_level());
  v_external_scope boolean := (select private.can_access_tenant(p_tenant));
  v_event public.tenant_events%rowtype;
  v_reg record;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_version integer;
begin
  if v_uid is null
     or not (
       (v_tenant = p_tenant and coalesce(v_level, 0) >= 6)
       or coalesce(v_external_scope, false)
     )
     or not exists (
       select 1 from public.tenants t
        where t.id = p_tenant and t.status = 'active'
     ) then
    raise exception 'event_status_access_denied' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('open', 'cancelled', 'done') then
    raise exception 'event_status_invalid' using errcode = '22023';
  end if;
  if p_status = 'cancelled'
     and (v_reason is null or char_length(v_reason) > 500) then
    raise exception 'event_cancellation_reason_required' using errcode = '22023';
  end if;
  if (select private.module_state(p_tenant, 'kurser')) not in ('draft', 'live') then
    raise exception 'event_module_read_only' using errcode = '55000';
  end if;

  select e.*
    into v_event
    from public.tenant_events e
   where e.id = p_event
     and e.tenant_id = p_tenant
   for update;

  if v_event.id is null then
    raise exception 'event_not_found' using errcode = '22023';
  end if;
  if v_event.status = p_status then
    return query select 'already_set'::text, v_event.status, v_event.lifecycle_version;
    return;
  end if;
  if v_event.status <> 'open' then
    raise exception 'event_status_transition_invalid' using errcode = '55000';
  end if;

  if p_status = 'cancelled' and exists (
    select 1
      from public.event_registrations r
     where r.tenant_id = p_tenant
       and r.event_id = p_event
       and r.status = 'confirmed'
       and r.order_item_id is not null
  ) then
    raise exception 'event_paid_refund_required' using errcode = '55000';
  end if;

  v_version := v_event.lifecycle_version + 1;
  update public.tenant_events e
     set status = p_status,
         lifecycle_version = v_version,
         cancelled_at = case when p_status = 'cancelled' then now() else e.cancelled_at end,
         cancelled_by = case when p_status = 'cancelled' then v_uid else e.cancelled_by end,
         cancellation_reason = case
           when p_status = 'cancelled' then v_reason
           else e.cancellation_reason
         end
   where e.id = v_event.id;

  if p_status = 'cancelled' then
    for v_reg in
      update public.event_registrations r
         set status = 'cancelled',
             lifecycle_version = r.lifecycle_version + 1,
             cancelled_at = now(),
             cancelled_by = v_uid,
             cancellation_reason = v_reason
       where r.tenant_id = p_tenant
         and r.event_id = p_event
         and r.status = 'confirmed'
         and r.order_item_id is null
      returning r.id, r.lifecycle_version
    loop
      insert into public.audit_log (
        tenant_id, actor_profile_id, action, entity, entity_id, meta
      ) values (
        p_tenant,
        v_uid,
        'event_registration.status_changed',
        'event_registrations',
        v_reg.id,
        jsonb_build_object(
          'from_status', 'confirmed',
          'to_status', 'cancelled',
          'reason', v_reason,
          'lifecycle_version', v_reg.lifecycle_version,
          'source', 'event_cancelled'
        )
      );

      insert into public.notifications_outbox (
        tenant_id,
        event_type,
        event_key,
        category,
        chosen_channel,
        consent_state,
        payload,
        status
      ) values (
        p_tenant,
        'event_registration_cancelled',
        'registration:' || v_reg.id::text || ':v' || v_reg.lifecycle_version::text || ':cancelled',
        'transactional',
        null,
        '{}'::jsonb,
        jsonb_build_object(
          'event_id', p_event,
          'registration_id', v_reg.id,
          'lifecycle_version', v_reg.lifecycle_version
        ),
        'routing'
      )
      on conflict (tenant_id, event_type, event_key)
        where chosen_channel is null
      do nothing;
    end loop;
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    v_uid,
    'tenant_event.status_changed',
    'tenant_events',
    v_event.id,
    jsonb_build_object(
      'from_status', v_event.status,
      'to_status', p_status,
      'reason', v_reason,
      'lifecycle_version', v_version
    )
  );

  return query select 'changed'::text, p_status, v_version;
end;
$$;

revoke all on function public.set_tenant_event_status(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_tenant_event_status(uuid, uuid, text, text)
  to authenticated;

create or replace function public.set_event_registration_status(
  p_tenant uuid,
  p_registration uuid,
  p_status text,
  p_reason text default null
) returns table (
  outcome text,
  registration_status text,
  version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant uuid := (select private.tenant_id());
  v_level integer := (select private.role_level());
  v_external_scope boolean := (select private.can_access_tenant(p_tenant));
  v_event_id uuid;
  v_event public.tenant_events%rowtype;
  v_reg public.event_registrations%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_taken integer;
  v_left integer;
  v_version integer;
  v_event_type text;
begin
  if v_uid is null
     or not (
       (v_tenant = p_tenant and coalesce(v_level, 0) >= 6)
       or coalesce(v_external_scope, false)
     )
     or not exists (
       select 1 from public.tenants t
        where t.id = p_tenant and t.status = 'active'
     ) then
    raise exception 'event_registration_status_access_denied' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('confirmed', 'cancelled') then
    raise exception 'event_registration_status_invalid' using errcode = '22023';
  end if;
  if p_status = 'cancelled'
     and (v_reason is null or char_length(v_reason) > 500) then
    raise exception 'registration_cancellation_reason_required' using errcode = '22023';
  end if;
  if (select private.module_state(p_tenant, 'kurser')) not in ('draft', 'live') then
    raise exception 'event_module_read_only' using errcode = '55000';
  end if;

  select r.event_id
    into v_event_id
    from public.event_registrations r
   where r.id = p_registration
     and r.tenant_id = p_tenant;

  if v_event_id is null then
    raise exception 'event_registration_not_found' using errcode = '22023';
  end if;

  select e.*
    into v_event
    from public.tenant_events e
   where e.id = v_event_id
     and e.tenant_id = p_tenant
   for update;

  select r.*
    into v_reg
    from public.event_registrations r
   where r.id = p_registration
     and r.tenant_id = p_tenant
     and r.event_id = v_event.id
   for update;

  if v_reg.id is null then
    raise exception 'event_registration_not_found' using errcode = '22023';
  end if;
  if v_reg.status = p_status then
    return query select 'already_set'::text, v_reg.status, v_reg.lifecycle_version;
    return;
  end if;

  if p_status = 'cancelled' and v_reg.order_item_id is not null then
    raise exception 'registration_paid_refund_required' using errcode = '55000';
  end if;

  if p_status = 'confirmed' then
    if v_event.status <> 'open' or v_event.starts_at <= now() then
      raise exception 'event_not_open' using errcode = '55000';
    end if;
    select coalesce(sum(r.party_size), 0)::integer
      into v_taken
      from public.event_registrations r
     where r.tenant_id = p_tenant
       and r.event_id = v_event.id
       and r.status = 'confirmed';
    v_left := greatest(0, v_event.capacity - v_taken - coalesce(v_event.reserved_qty, 0));
    if v_reg.party_size > v_left then
      raise exception 'event_capacity_exceeded'
        using errcode = '23P01', detail = v_left::text;
    end if;
  end if;

  v_version := v_reg.lifecycle_version + 1;
  update public.event_registrations r
     set status = p_status,
         lifecycle_version = v_version,
         cancelled_at = case when p_status = 'cancelled' then now() else r.cancelled_at end,
         cancelled_by = case when p_status = 'cancelled' then v_uid else r.cancelled_by end,
         cancellation_reason = case
           when p_status = 'cancelled' then v_reason
           else r.cancellation_reason
         end
   where r.id = v_reg.id;

  v_event_type := case
    when p_status = 'cancelled' then 'event_registration_cancelled'
    else 'event_registration_restored'
  end;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    v_uid,
    'event_registration.status_changed',
    'event_registrations',
    v_reg.id,
    jsonb_build_object(
      'from_status', v_reg.status,
      'to_status', p_status,
      'reason', v_reason,
      'lifecycle_version', v_version
    )
  );

  insert into public.notifications_outbox (
    tenant_id,
    event_type,
    event_key,
    category,
    chosen_channel,
    consent_state,
    payload,
    status
  ) values (
    p_tenant,
    v_event_type,
    'registration:' || v_reg.id::text || ':v' || v_version::text || ':' || p_status,
    'transactional',
    null,
    '{}'::jsonb,
    jsonb_build_object(
      'event_id', v_event.id,
      'registration_id', v_reg.id,
      'lifecycle_version', v_version
    ),
    'routing'
  )
  on conflict (tenant_id, event_type, event_key)
    where chosen_channel is null
  do nothing;

  return query select 'changed'::text, p_status, v_version;
end;
$$;

revoke all on function public.set_event_registration_status(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_event_registration_status(uuid, uuid, text, text)
  to authenticated;

comment on function public.set_tenant_event_status(uuid, uuid, text, text) is
  'Goal 90: locked event status transition; paid cancellation fails closed.';
comment on function public.set_event_registration_status(uuid, uuid, text, text) is
  'Goal 90: locked registration transition with capacity, audit and routing outbox.';

commit;
