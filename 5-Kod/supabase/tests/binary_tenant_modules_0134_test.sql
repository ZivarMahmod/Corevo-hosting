-- Binary module contract: live = on/public, off = off/hidden.

begin;

do $$
declare
  v_constraint text;
begin
  select pg_catalog.pg_get_constraintdef(c.oid)
    into v_constraint
    from pg_catalog.pg_constraint c
   where c.conrelid = 'public.tenant_modules'::regclass
     and c.conname = 'tenant_modules_state_check';

  if v_constraint is null
     or v_constraint like '%draft%'
     or v_constraint like '%paused%'
     or v_constraint not like '%off%'
     or v_constraint not like '%live%' then
    raise exception 'binary_module_constraint_missing';
  end if;

  if exists (
    select 1 from public.tenant_modules where state not in ('off', 'live')
  ) then
    raise exception 'non_binary_tenant_module_row';
  end if;

  if exists (
    select 1
      from public.verticals v
      cross join lateral pg_catalog.jsonb_each_text(v.default_modules) preset
     where preset.value not in ('off', 'live')
  ) then
    raise exception 'non_binary_vertical_preset';
  end if;

  if private.module_state('00000000-0000-0000-0000-000000000000', 'booking') <> 'off' then
    raise exception 'missing_booking_defaulted_on';
  end if;
end;
$$;

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('01340000-0000-0000-0000-000000000001', 'binary-modules-0134', 'Binary Modules 0134', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.tenant_modules (tenant_id, module_key, state) values
  ('01340000-0000-0000-0000-000000000001', 'booking', 'off');

do $$
declare
  v_row public.tenant_modules%rowtype;
begin
  select tm.* into v_row
  from public.tenant_modules tm
  where tm.tenant_id = '01340000-0000-0000-0000-000000000001'
    and tm.module_key = 'booking';

  if not found then
    raise exception 'binary_module_fixture_missing';
  end if;

  update public.tenant_modules set state = 'off' where id = v_row.id;
  if private.module_public_readable(v_row.tenant_id, v_row.module_key) then
    raise exception 'off_module_publicly_readable';
  end if;

  update public.tenant_modules set state = 'live' where id = v_row.id;
  if not private.module_public_readable(v_row.tenant_id, v_row.module_key) then
    raise exception 'live_module_not_publicly_readable';
  end if;

  begin
    update public.tenant_modules set state = 'draft' where id = v_row.id;
    raise exception 'draft_module_was_accepted';
  exception when check_violation then
    null;
  end;

  begin
    update public.tenant_modules set state = 'paused' where id = v_row.id;
    raise exception 'paused_module_was_accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
