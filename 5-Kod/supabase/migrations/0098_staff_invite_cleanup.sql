-- U5: atomic compensation fence for a failed staff Auth invite.
-- The service-role caller may remove only the exact provisional public.users row,
-- and never after any staff row has acquired its auth id.

-- One Auth identity represents one staff identity. If legacy duplicates exist,
-- migration must stop for explicit backfill instead of silently choosing a row.
create unique index if not exists staff_profile_id_unique_idx
  on public.staff (profile_id)
  where profile_id is not null;

create or replace function public.prepare_staff_invite_cleanup(
  p_auth_user uuid,
  p_tenant uuid,
  p_role uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_role uuid;
  v_linked_staff uuid;
begin
  select u.tenant_id, u.role_id
    into v_tenant, v_role
    from public.users u
   where u.id = p_auth_user
   for update;

  if not found then
    return 'profile_absent';
  end if;
  if v_tenant is distinct from p_tenant or v_role is distinct from p_role then
    return 'profile_changed';
  end if;
  select s.id
    into v_linked_staff
    from public.staff s
   where s.profile_id = p_auth_user
   for update;
  if found then
    return 'staff_linked';
  end if;

  delete from public.users u
   where u.id = p_auth_user
     and u.tenant_id = p_tenant
     and u.role_id = p_role;
  if found then
    return 'profile_deleted';
  end if;
  return 'profile_changed';
end;
$$;

revoke execute on function public.prepare_staff_invite_cleanup(uuid,uuid,uuid) from public;
revoke execute on function public.prepare_staff_invite_cleanup(uuid,uuid,uuid) from anon;
revoke execute on function public.prepare_staff_invite_cleanup(uuid,uuid,uuid) from authenticated;
grant execute on function public.prepare_staff_invite_cleanup(uuid,uuid,uuid) to service_role;

-- Durable quarantine used when cleanup itself cannot be proven. It shares the
-- exact locks/identity predicates with cleanup and never contains a staff winner.
create or replace function public.contain_staff_invite_profile(
  p_auth_user uuid,
  p_tenant uuid,
  p_role uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_role uuid;
  v_linked_staff uuid;
begin
  select u.tenant_id, u.role_id
    into v_tenant, v_role
    from public.users u
   where u.id = p_auth_user
   for update;

  if not found then
    return 'profile_absent';
  end if;
  if v_tenant is distinct from p_tenant or v_role is distinct from p_role then
    return 'profile_changed';
  end if;

  select s.id
    into v_linked_staff
    from public.staff s
   where s.profile_id = p_auth_user
   for update;
  if found then
    return 'staff_linked';
  end if;

  update public.users u
     set status = 'manual_cleanup', updated_at = now()
   where u.id = p_auth_user
     and u.tenant_id = p_tenant
     and u.role_id = p_role;
  if found then
    return 'profile_contained';
  end if;
  return 'profile_changed';
end;
$$;

revoke execute on function public.contain_staff_invite_profile(uuid,uuid,uuid) from public;
revoke execute on function public.contain_staff_invite_profile(uuid,uuid,uuid) from anon;
revoke execute on function public.contain_staff_invite_profile(uuid,uuid,uuid) from authenticated;
grant execute on function public.contain_staff_invite_profile(uuid,uuid,uuid) to service_role;
