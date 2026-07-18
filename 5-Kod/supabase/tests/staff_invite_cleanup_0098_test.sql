-- 0098 runtime: compensation is exact, tenant-bound and service-only.
begin;

insert into public.tenants (id, slug, name) values
  ('98000000-0000-0000-0000-000000000001', 'staff-cleanup-0098', 'Cleanup 0098');
insert into public.roles (id, tenant_id, name, level) values
  ('98000000-0000-0000-0000-000000000002', '98000000-0000-0000-0000-000000000001', 'staff', 3);
insert into auth.users (id, email) values
  ('98000000-0000-0000-0000-000000000003', 'cleanup-0098@example.test'),
  ('98000000-0000-0000-0000-000000000004', 'contained-0098@example.test');
insert into public.users (id, tenant_id, email, role_id, status) values
  ('98000000-0000-0000-0000-000000000003', '98000000-0000-0000-0000-000000000001', 'cleanup-0098@example.test', '98000000-0000-0000-0000-000000000002', 'active'),
  ('98000000-0000-0000-0000-000000000004', '98000000-0000-0000-0000-000000000001', 'contained-0098@example.test', '98000000-0000-0000-0000-000000000002', 'active');

do $$
declare v_result text;
begin
  select public.prepare_staff_invite_cleanup(
    '98000000-0000-0000-0000-000000000003',
    '98000000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000002'
  ) into v_result;
  if v_result <> 'profile_deleted' then raise exception 'profile_not_deleted_%', v_result; end if;

  select public.contain_staff_invite_profile(
    '98000000-0000-0000-0000-000000000004',
    '98000000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000002'
  ) into v_result;
  if v_result <> 'profile_contained' then raise exception 'profile_not_contained_%', v_result; end if;
  if not exists (
    select 1 from public.users
     where id = '98000000-0000-0000-0000-000000000004'
       and status = 'manual_cleanup'
  ) then raise exception 'contained_status_missing'; end if;
end $$;

do $$ begin
  if has_function_privilege(
      'anon', 'public.prepare_staff_invite_cleanup(uuid,uuid,uuid)', 'execute'
    ) or has_function_privilege(
      'authenticated', 'public.contain_staff_invite_profile(uuid,uuid,uuid)', 'execute'
    ) then
    raise exception 'staff_invite_cleanup_exposed';
  end if;
end $$;

rollback;
