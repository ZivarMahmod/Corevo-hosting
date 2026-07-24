-- Goal 78: public storefronts must distinguish an explicit module=off/draft row
-- from a genuinely missing row. The legacy anon policy intentionally exposes only
-- live/paused rows, so reading tenant_modules directly makes booking=off disappear
-- and the application applies its backward-compatible booking=live default.
--
-- Keep the table policy strict. This narrow function reveals only module_key +
-- state for an ACTIVE tenant; config, timestamps and inactive tenants remain hidden.

create or replace function public.get_public_tenant_module_states(p_tenant uuid)
returns table (module_key text, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select tm.module_key, tm.state
    from public.tenant_modules tm
    join public.tenants t on t.id = tm.tenant_id
   where tm.tenant_id = p_tenant
     and t.status = 'active';
$$;

revoke all on function public.get_public_tenant_module_states(uuid) from public;
grant execute on function public.get_public_tenant_module_states(uuid) to anon, authenticated, service_role;

comment on function public.get_public_tenant_module_states(uuid) is
  'Public, config-free module state read for active storefronts. Distinguishes explicit off/draft from a missing legacy row.';
