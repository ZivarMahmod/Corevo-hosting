-- 0131 runtime: Sweden-first tenant contract, IANA timezones and lifecycle/RLS.
-- Every fixture and mutation is rolled back.
begin;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

insert into public.tenants (id, slug, name, status) values
  ('13100000-0000-0000-0000-000000000001', 'regional-a-0131', 'Regional A', 'provisioning'),
  ('13100000-0000-0000-0000-000000000002', 'regional-b-0131', 'Regional B', 'provisioning'),
  ('13100000-0000-0000-0000-000000000003', 'regional-suspended-0131', 'Regional Suspended', 'suspended');

insert into public.tenant_settings (tenant_id, settings) values
  (
    '13100000-0000-0000-0000-000000000001',
    '{"customer_portal":{"mode":"passwordless_tenant"}}'::jsonb
  ),
  ('13100000-0000-0000-0000-000000000002', '{}'::jsonb),
  ('13100000-0000-0000-0000-000000000003', '{}'::jsonb);

-- The settings lifecycle trigger must not block the tenant FK cascade used by
-- onboarding rollback.
insert into public.tenants (id, slug, name, status) values (
  '13100000-0000-0000-0000-000000000004',
  'regional-rollback-0131',
  'Regional Rollback',
  'provisioning'
);
insert into public.tenant_settings (tenant_id, settings) values (
  '13100000-0000-0000-0000-000000000004',
  '{}'::jsonb
);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
delete from public.tenants
where id = '13100000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
do $cascade_delete$
begin
  if exists (
    select 1 from public.tenant_settings
    where tenant_id = '13100000-0000-0000-0000-000000000004'
  ) then
    raise exception 'tenant_settings_cascade_delete_blocked';
  end if;
end
$cascade_delete$;

insert into public.locations (
  id, tenant_id, name, timezone, is_primary, active
) values
  (
    '13100000-0000-0000-0000-000000000011',
    '13100000-0000-0000-0000-000000000001',
    'Helsinki location', 'Europe/Helsinki', true, true
  ),
  (
    '13100000-0000-0000-0000-000000000012',
    '13100000-0000-0000-0000-000000000002',
    'Stockholm location', 'Europe/Stockholm', true, true
  ),
  (
    '13100000-0000-0000-0000-000000000013',
    '13100000-0000-0000-0000-000000000003',
    'Suspended location', 'Europe/Stockholm', true, true
  );

insert into public.roles (id, tenant_id, name, level) values
  (
    '13100000-0000-0000-0000-000000000021',
    '13100000-0000-0000-0000-000000000001',
    'salon_admin', 6
  ),
  (
    '13100000-0000-0000-0000-000000000022',
    '13100000-0000-0000-0000-000000000002',
    'salon_admin', 6
  ),
  (
    '13100000-0000-0000-0000-000000000023',
    '13100000-0000-0000-0000-000000000003',
    'salon_admin', 6
  );

insert into auth.users (id, email) values
  ('13100000-0000-0000-0000-000000000101', 'regional-a-0131@example.test'),
  ('13100000-0000-0000-0000-000000000102', 'regional-b-0131@example.test'),
  ('13100000-0000-0000-0000-000000000103', 'regional-suspended-0131@example.test');

insert into public.users (
  id, tenant_id, email, role_id, access_scope, status
) values
  (
    '13100000-0000-0000-0000-000000000101',
    '13100000-0000-0000-0000-000000000001',
    'regional-a-0131@example.test',
    '13100000-0000-0000-0000-000000000021',
    'organization', 'active'
  ),
  (
    '13100000-0000-0000-0000-000000000102',
    '13100000-0000-0000-0000-000000000002',
    'regional-b-0131@example.test',
    '13100000-0000-0000-0000-000000000022',
    'organization', 'active'
  ),
  (
    '13100000-0000-0000-0000-000000000103',
    '13100000-0000-0000-0000-000000000003',
    'regional-suspended-0131@example.test',
    '13100000-0000-0000-0000-000000000023',
    'organization', 'active'
  );

-- Publish the two complete fixtures through the same service-owned lifecycle
-- path as production. The suspended fixture never needs publication.
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.tenants
set status = 'active'
where id in (
  '13100000-0000-0000-0000-000000000001',
  '13100000-0000-0000-0000-000000000002'
);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

do $regional_contract$
declare
  v_settings public.tenant_settings%rowtype;
  v_timezone text;
  v_normalized record;
begin
  select * into v_settings
  from public.tenant_settings
  where tenant_id = '13100000-0000-0000-0000-000000000001';

  if v_settings.country_code <> 'SE'
     or v_settings.locale <> 'sv-SE'
     or v_settings.currency <> 'SEK'
     or v_settings.default_timezone <> 'Europe/Stockholm' then
    raise exception 'regional_defaults_invalid:%', row_to_json(v_settings);
  end if;

  select l.timezone into v_timezone
  from public.locations l
  where l.id = '13100000-0000-0000-0000-000000000011';
  if v_timezone <> 'Europe/Helsinki' then
    raise exception 'location_timezone_was_overwritten:%', v_timezone;
  end if;

  select * into v_normalized
  from private.customer_portal_normalize_recovery_lookup('070-123 45 67');
  if v_normalized.channel <> 'sms'
     or v_normalized.normalized <> '+46701234567'
     or v_normalized.masked <> '070 ••• •• 67' then
    raise exception 'regional_phone_normalization_invalid:%', row_to_json(v_normalized);
  end if;
  if exists (
    select 1 from private.customer_portal_normalize_recovery_lookup('+4512345678')
  ) or exists (
    select 1 from private.customer_portal_normalize_recovery_lookup('081234567')
  ) or exists (
    select 1 from private.customer_portal_normalize_recovery_lookup('0741234567')
  ) or exists (
    select 1 from private.customer_portal_normalize_recovery_lookup('0771234567')
  ) or exists (
    select 1 from private.customer_portal_normalize_recovery_lookup('0781234567')
  ) then
    raise exception 'unsupported_phone_format_accepted';
  end if;
  if not private.customer_portal_safe_contact_mask('sms', '070 ••• •• 67')
     or not private.customer_portal_safe_contact_mask('sms', '+46 ••• •• 67') then
    raise exception 'regional_phone_mask_contract_invalid';
  end if;

  if not has_column_privilege(
       'anon', 'public.tenant_settings', 'country_code', 'SELECT'
     )
     or not has_column_privilege(
       'anon', 'public.tenant_settings', 'locale', 'SELECT'
     )
     or not has_column_privilege(
       'anon', 'public.tenant_settings', 'currency', 'SELECT'
     )
     or not has_column_privilege(
       'anon', 'public.tenant_settings', 'default_timezone', 'SELECT'
     )
     or has_table_privilege('anon', 'public.tenant_settings', 'SELECT') then
    raise exception 'regional_anon_column_grants_invalid';
  end if;

  if has_function_privilege(
       'anon', 'private.guard_iana_timezone()', 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', 'private.guard_iana_timezone()', 'EXECUTE'
     )
     or has_function_privilege(
       'service_role', 'private.guard_iana_timezone()', 'EXECUTE'
     )
     or has_function_privilege(
       'anon', 'private.guard_tenant_settings_active_mutation()', 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', 'private.guard_tenant_settings_active_mutation()', 'EXECUTE'
     )
     or has_function_privilege(
       'service_role', 'private.guard_tenant_settings_active_mutation()', 'EXECUTE'
     ) then
    raise exception 'regional_private_trigger_function_exposed';
  end if;

  begin
    update public.tenant_settings
    set country_code = 'NO'
    where tenant_id = '13100000-0000-0000-0000-000000000001';
    raise exception 'invalid_country_accepted';
  exception when check_violation then
    null;
  end;

  begin
    update public.tenant_settings
    set locale = 'en-US'
    where tenant_id = '13100000-0000-0000-0000-000000000001';
    raise exception 'invalid_locale_accepted';
  exception when check_violation then
    null;
  end;

  begin
    update public.tenant_settings
    set currency = 'EUR'
    where tenant_id = '13100000-0000-0000-0000-000000000001';
    raise exception 'invalid_currency_accepted';
  exception when check_violation then
    null;
  end;

  begin
    update public.tenant_settings
    set default_timezone = 'Europe/Not_A_Zone'
    where tenant_id = '13100000-0000-0000-0000-000000000001';
    raise exception 'invalid_default_timezone_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'invalid_iana_timezone' then raise; end if;
  end;

  begin
    update public.tenant_settings
    set default_timezone = 'posix/Europe/Stockholm'
    where tenant_id = '13100000-0000-0000-0000-000000000001';
    raise exception 'node_incompatible_timezone_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'invalid_iana_timezone' then raise; end if;
  end;

  begin
    update public.tenant_settings
    set default_timezone = 'Factory'
    where tenant_id = '13100000-0000-0000-0000-000000000001';
    raise exception 'factory_timezone_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'invalid_iana_timezone' then raise; end if;
  end;

  begin
    update public.locations
    set timezone = 'Europe/Not_A_Zone'
    where id = '13100000-0000-0000-0000-000000000011';
    raise exception 'invalid_location_timezone_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'invalid_iana_timezone' then raise; end if;
  end;
end
$regional_contract$;

insert into public.customers (
  id, tenant_id, full_name, phone, status
) values (
  '13100000-0000-0000-0000-000000000031',
  '13100000-0000-0000-0000-000000000001',
  'Regional Portal', '+46700000131', 'active'
);
insert into private.customer_portal_sessions (
  public_id, tenant_id, customer_id, secret_digest, key_version,
  idle_expires_at, absolute_expires_at
) values (
  '13100000-0000-0000-0000-000000000041',
  '13100000-0000-0000-0000-000000000001',
  '13100000-0000-0000-0000-000000000031',
  repeat('a', 64), 1,
  statement_timestamp() + interval '1 day',
  statement_timestamp() + interval '7 days'
);

do $portal_contract$
declare
  v_result record;
begin
  select * into v_result
  from public.customer_portal_session_snapshot(
    '13100000-0000-0000-0000-000000000041',
    repeat('a', 64)
  );
  if v_result.outcome <> 'ok'
     or v_result.snapshot ->> 'defaultCountry' <> 'SE'
     or v_result.snapshot ->> 'locale' <> 'sv-SE'
     or v_result.snapshot ->> 'currency' <> 'SEK'
     or v_result.snapshot ->> 'timezone' <> 'Europe/Helsinki' then
    raise exception 'portal_regional_snapshot_invalid:%', v_result.snapshot;
  end if;
end
$portal_contract$;

-- Tenant A may read/write itself but cannot observe or mutate tenant B.
select set_config('request.jwt.claim.sub', '13100000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13100000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"13100000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $cross_tenant$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.tenant_settings
  where tenant_id = '13100000-0000-0000-0000-000000000002';
  if v_count <> 0 then
    raise exception 'cross_tenant_regional_read_visible';
  end if;

  update public.tenant_settings
  set branding = branding
  where tenant_id = '13100000-0000-0000-0000-000000000002';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'cross_tenant_regional_write_succeeded';
  end if;

  update public.tenant_settings
  set branding = branding
  where tenant_id = '13100000-0000-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'active_own_regional_write_failed:%', v_count;
  end if;
end
$cross_tenant$;

-- The same direct owner write is denied when its tenant is suspended.
reset role;
select set_config('request.jwt.claim.sub', '13100000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13100000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"tenant_id":"13100000-0000-0000-0000-000000000003","platform_admin":false}}',
  true
);
set local role authenticated;
do $suspended_tenant$
begin
  begin
    update public.tenant_settings
    set branding = branding
    where tenant_id = '13100000-0000-0000-0000-000000000003';
    raise exception 'suspended_own_regional_write_succeeded';
  exception when sqlstate '42501' then
    if sqlerrm <> 'tenant_mutation_requires_active_tenant' then raise; end if;
  end;
end
$suspended_tenant$;
reset role;

rollback;

do $rollback_proof$
begin
  if exists (
    select 1
    from public.tenants
    where id in (
      '13100000-0000-0000-0000-000000000001',
      '13100000-0000-0000-0000-000000000002',
      '13100000-0000-0000-0000-000000000003'
    )
  ) or exists (
    select 1
    from auth.users
    where id in (
      '13100000-0000-0000-0000-000000000101',
      '13100000-0000-0000-0000-000000000102',
      '13100000-0000-0000-0000-000000000103'
    )
  ) then
    raise exception 'regional_0131_rollback_left_fixtures';
  end if;
end
$rollback_proof$;
