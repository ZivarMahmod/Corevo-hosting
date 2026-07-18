-- 0106 runtime: platform insights stay read-only, gated in the database, and
-- tolerate preview branches without pg_cron.
begin;

insert into public.roles (id, tenant_id, name, level) values
  ('a1060000-0000-0000-0000-000000000001', null, 'platform-0106', 8);
insert into auth.users (id, email) values
  ('a1060000-0000-0000-0000-000000000002', 'platform-0106@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1060000-0000-0000-0000-000000000002', null,
    'platform-0106@example.test', 'a1060000-0000-0000-0000-000000000001',
    'active', 'organization'
  );

do $$
begin
  if to_regprocedure('public.platform_outbox_summary()') is null
     or to_regprocedure('public.platform_cron_health()') is null then
    raise exception 'platform_insyn_rpc_missing';
  end if;
  if has_function_privilege('anon', 'public.platform_outbox_summary()', 'EXECUTE')
     or has_function_privilege('anon', 'public.platform_cron_health()', 'EXECUTE') then
    raise exception 'platform_insyn_rpc_exposed_to_anon';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.platform_outbox_summary()', 'EXECUTE'
  ) then
    raise exception 'platform_insyn_authenticated_grant_missing';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"platform_admin":false}}',
  true
);
do $$
begin
  perform public.platform_outbox_summary();
  raise exception 'non_platform_outbox_summary_succeeded';
exception when insufficient_privilege then null;
end
$$;
do $$
begin
  perform public.platform_cron_health();
  raise exception 'non_platform_cron_health_succeeded';
exception when insufficient_privilege then null;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1060000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'a1060000-0000-0000-0000-000000000002', true
);
select count(*) from public.platform_outbox_summary();
select count(*) from public.platform_cron_health();

rollback;
