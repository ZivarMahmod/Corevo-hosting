-- A module has one public truth: live = on and visible, off = off and hidden.

update public.tenant_modules
set state = case state
  when 'paused' then 'live'
  when 'draft' then 'off'
  else state
end
where state in ('draft', 'paused');

update public.verticals v
set default_modules = (
  select coalesce(
    pg_catalog.jsonb_object_agg(
      preset.key,
      case preset.value
        when 'paused' then 'live'
        when 'draft' then 'off'
        else preset.value
      end
    ),
    '{}'::jsonb
  )
  from pg_catalog.jsonb_each_text(v.default_modules) preset
);

alter table public.tenant_modules
  drop constraint tenant_modules_state_check;
alter table public.tenant_modules
  add constraint tenant_modules_state_check check (state in ('off', 'live'));

create or replace function private.module_public_readable(p_tenant uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tenants t
     where t.id = p_tenant
       and t.status = 'active'
  )
  and private.module_state(p_tenant, p_module) = 'live'
$$;

create or replace function public.tenant_modules_state_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_no_request boolean :=
    session_user in ('postgres', 'supabase_admin')
    and coalesce((select auth.role()), '') = '';
  v_service boolean := coalesce(nullif(v_claims, '')::jsonb ->> 'role', '') = 'service_role';
  v_operator boolean := false;
  v_customer_admin boolean := false;
  v_active boolean := false;
  v_default_config jsonb;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      raise exception 'tenant_module_delete_forbidden' using errcode = '23514';
    end if;
    return old;
  end if;

  v_operator :=
    coalesce((select private.is_platform_admin()), false)
    or coalesce(
      (select private.partner_id()) is not null
      and (select private.can_access_tenant(new.tenant_id)),
      false
    );
  v_customer_admin :=
    (select auth.uid()) is not null
    and (select private.tenant_id()) = new.tenant_id
    and coalesce((select private.has_organization_scope()), false);
  select exists (
    select 1 from public.tenants t
    where t.id = new.tenant_id and t.status = 'active'
  ) into v_active;

  if not (v_no_request or v_operator) and not v_active then
    raise exception 'inactive_tenant_module_mutation' using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if not (v_no_request or v_operator or v_service or v_customer_admin) then
      raise exception 'tenant_module_access_denied' using errcode = '42501';
    end if;
    if new.activated_at is not null then
      raise exception 'tenant_module_activation_metadata_is_db_owned' using errcode = '23514';
    end if;
    if new.state = 'live' then
      if not (v_no_request or v_operator) then
        raise exception 'platform_operator_required' using errcode = '42501';
      end if;
      select m.default_config into v_default_config
      from public.modules m where m.key = new.module_key;
      if not found then
        raise exception 'unknown_module' using errcode = '23503';
      end if;
      new.config := v_default_config || new.config;
      new.activated_at := pg_catalog.now();
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.module_key is distinct from old.module_key
     or new.created_at is distinct from old.created_at then
    raise exception 'tenant_module_identity_is_immutable' using errcode = '23514';
  end if;
  if new.activated_at is distinct from old.activated_at then
    raise exception 'tenant_module_activation_metadata_is_immutable' using errcode = '23514';
  end if;
  if not (v_no_request or v_operator or v_service or v_customer_admin) then
    raise exception 'tenant_module_access_denied' using errcode = '42501';
  end if;

  if new.state = old.state then
    if new.config is distinct from old.config
       and old.state <> 'live'
       and not (v_no_request or v_operator) then
      raise exception 'tenant_module_config_not_writable_in_state' using errcode = '55000';
    end if;
    return new;
  end if;

  if not (v_no_request or v_operator) then
    raise exception 'platform_operator_required' using errcode = '42501';
  end if;
  if new.config is distinct from old.config then
    raise exception 'module_state_change_must_preserve_config' using errcode = '23514';
  end if;

  if old.state = 'off' and new.state = 'live' and old.activated_at is null then
    select m.default_config into v_default_config
    from public.modules m where m.key = new.module_key;
    if not found then
      raise exception 'unknown_module' using errcode = '23503';
    end if;
    new.config := v_default_config || new.config;
    new.activated_at := pg_catalog.now();
  end if;

  return new;
end;
$$;

comment on column public.tenant_modules.state is
  'Binary module visibility: live = enabled and public, off = disabled and hidden.';
