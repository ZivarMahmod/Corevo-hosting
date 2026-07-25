do $goal84_user_role_rls$
declare
  v_platform uuid;
  v_tenant uuid := gen_random_uuid();
  v_role uuid := gen_random_uuid();
  v_location uuid := gen_random_uuid();
  v_auth uuid := gen_random_uuid();
  v_email text := 'goal84-rls-' || replace(v_auth::text, '-', '') || '@corevo.se';
  v_state text;
begin
  select au.id into v_platform
  from auth.users au
  where lower(au.email) = 'platform@corevo.se'
  limit 1;
  if v_platform is null then
    raise exception 'goal84_user_role_rls_platform_missing';
  end if;

  insert into public.tenants (id, slug, name, status, plan)
  values (v_tenant, 'goal84-rls-' || left(replace(v_tenant::text, '-', ''), 12),
          'Goal 84 RLS runtime', 'provisioning', 'standard');
  insert into public.roles (id, tenant_id, name, level)
  values (v_role, v_tenant, 'salon_admin', 6);
  insert into public.locations (id, tenant_id, name, timezone, is_primary)
  values (v_location, v_tenant, 'Goal 84 RLS runtime', 'Europe/Stockholm', true);
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_auth, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', v_email,
    crypt('Goal84-runtime-only', gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    '{}'::jsonb, now(), now()
  );

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_platform::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_platform::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('platform_admin', true)
    )::text,
    true
  );
  execute 'set local role authenticated';
  begin
    insert into public.users (
      id, tenant_id, email, role_id, status, access_scope, primary_location_id
    ) values (
      v_auth, v_tenant, v_email, v_role, 'active', 'organization', v_location
    );
    perform public.save_location_booking_settings(
      v_location,
      '[{"weekday":1,"start_time":"09:00","end_time":"17:00"}]'::jsonb,
      15,
      60,
      90
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    execute 'reset role';
    raise exception 'goal84_user_role_rls_insert_failed:%', v_state;
  end;
  execute 'reset role';

  if not exists (
    select 1 from public.users u
    where u.id = v_auth and u.tenant_id = v_tenant and u.role_id = v_role
  ) then
    raise exception 'goal84_user_role_rls_profile_missing';
  end if;
  if not exists (
    select 1 from public.location_opening_hours loh
    where loh.tenant_id = v_tenant
      and loh.location_id = v_location
      and loh.source = 'confirmed'
      and loh.confirmed_at is not null
      and loh.confirmed_by = v_platform
  ) then
    raise exception 'goal84_user_role_rls_opening_hours_missing';
  end if;

  delete from auth.users where id = v_auth;
  delete from public.tenants where id = v_tenant;
  if exists (select 1 from auth.users where id = v_auth)
     or exists (select 1 from public.tenants where id = v_tenant) then
    raise exception 'goal84_user_role_rls_cleanup_failed';
  end if;
end
$goal84_user_role_rls$;
