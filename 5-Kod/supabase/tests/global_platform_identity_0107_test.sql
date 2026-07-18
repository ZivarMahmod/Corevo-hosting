-- 0107 runtime: a global platform identity may exist without being attached to
-- any customer tenant. The test is transactional and leaves no auth/profile row.
begin;

do $$
begin
  if not exists (
    select 1
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'users'
       and c.column_name = 'tenant_id'
       and c.is_nullable = 'YES'
  ) then
    raise exception 'users_tenant_id_must_allow_global_platform_identity';
  end if;
end
$$;

insert into public.roles (id, tenant_id, name, level) values
  ('a1070000-0000-0000-0000-000000000001', null, 'platform-0107', 8);
insert into auth.users (id, email) values
  ('a1070000-0000-0000-0000-000000000002', 'platform-0107@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1070000-0000-0000-0000-000000000002', null,
    'platform-0107@example.test', 'a1070000-0000-0000-0000-000000000001',
    'active', 'organization'
  );

rollback;
