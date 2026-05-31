-- ============================================================================
-- 0003 — Custom Access Token Hook (ADR 01 §4, open question 1)
-- Injects app_metadata.tenant_id (+ platform_admin) into every issued JWT so
-- RLS can read it via auth.tenant_id(). The hook runs as supabase_auth_admin.
--
-- ⚠️ On Supabase Cloud you MUST ALSO enable this hook in:
--    Dashboard → Authentication → Hooks → Customize Access Token (JWT) Claims
--    → point it at public.custom_access_token_hook
-- (The SQL below only creates the function + grants; the Dashboard toggle wires
--  it into token issuance.)
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims   jsonb;
  amd      jsonb;
  v_tenant uuid;
  v_level  int;
begin
  select u.tenant_id, r.level
    into v_tenant, v_level
    from public.users u
    left join public.roles r on r.id = u.role_id
   where u.id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  amd    := coalesce(claims -> 'app_metadata', '{}'::jsonb);

  if v_tenant is not null then
    amd := jsonb_set(amd, '{tenant_id}', to_jsonb(v_tenant::text), true);
  end if;

  -- platform/super admin = global role (level 7-8) → cross-tenant flag.
  amd := jsonb_set(amd, '{platform_admin}', to_jsonb(coalesce(v_level >= 7, false)), true);

  claims := jsonb_set(claims, '{app_metadata}', amd, true);
  event  := jsonb_set(event, '{claims}', claims, true);
  return event;
end;
$$;

-- Grants required for the GoTrue auth hook (runs as supabase_auth_admin).
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.users to supabase_auth_admin;
grant select on table public.roles to supabase_auth_admin;

-- The hook reads users/roles, which have RLS on → allow supabase_auth_admin to read.
create policy auth_admin_read_users on public.users
  for select to supabase_auth_admin using (true);
create policy auth_admin_read_roles on public.roles
  for select to supabase_auth_admin using (true);
