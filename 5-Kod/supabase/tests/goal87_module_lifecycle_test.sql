-- Goal 87 runtime regression: lifecycle, first defaults, role/activity gates,
-- public read/action decisions, readiness shape, policy inventory and grants.
-- Every fixture and catalog tweak is rolled back.

select pg_catalog.position('draft' in pg_catalog.pg_get_constraintdef(c.oid)) = 0 as binary_modules
from pg_catalog.pg_constraint c
where c.conrelid = 'public.tenant_modules'::regclass
  and c.conname = 'tenant_modules_state_check'
\gset

\if :binary_modules
\echo 'goal87 legacy four-state test superseded by binary_tenant_modules_0134_test.sql'
\else

begin;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

do $$
declare
  v_expected constant text[] := array[
    'booking',
    'media_library',
    'shop',
    'offert',
    'blogg',
    'lojalitet',
    'presentkort',
    'kurser',
    'galleri'
  ]::text[];
begin
  if (
    select pg_catalog.count(*)
      from public.modules m
     where m.key = any(v_expected)
  ) <> 9 then
    raise exception 'goal87_catalog_missing_key';
  end if;
  if exists (select 1 from public.modules m where m.key = 'loyalty') then
    raise exception 'goal87_catalog_still_has_loyalty';
  end if;
  if exists (
    select 1
      from public.verticals v
      cross join lateral pg_catalog.jsonb_each_text(v.default_modules) preset(module_key, state)
     where not (preset.module_key = any(v_expected))
        or preset.state is null
        or preset.state not in ('off', 'draft', 'live', 'paused')
        or not exists (
          select 1 from public.modules m where m.key = preset.module_key
        )
  ) then
    raise exception 'goal87_vertical_preset_invalid';
  end if;
end;
$$;

update public.modules
   set default_config = '{"base":true,"shared":"catalog"}'::jsonb
 where key = 'galleri';

insert into public.partners (
  id,
  slug,
  name,
  status,
  country_code,
  currency,
  timezone,
  license_price_ore
) values (
  '87000000-0000-0000-0000-000000000040',
  'goal87-partner',
  'Goal 87 partner',
  'active',
  'SE',
  'SEK',
  'Europe/Stockholm',
  5000
);

insert into auth.users (id, email) values (
  '87000000-0000-0000-0000-000000000041',
  'goal87-partner@example.test'
);
insert into public.users (
  id,
  tenant_id,
  email,
  role_id,
  access_scope,
  status
) values (
  '87000000-0000-0000-0000-000000000041',
  null,
  'goal87-partner@example.test',
  (
    select r.id
      from public.roles r
     where r.tenant_id is null
       and r.name = 'partner_admin'
     limit 1
  ),
  'organization',
  'active'
);
insert into public.partner_members (partner_id, user_id, role, status) values (
  '87000000-0000-0000-0000-000000000040',
  '87000000-0000-0000-0000-000000000041',
  'owner',
  'active'
);

insert into public.tenants (id, slug, name, status, partner_id) values
  (
    '87000000-0000-0000-0000-000000000001',
    'goal87-active',
    'Goal 87 active',
    'provisioning',
    '87000000-0000-0000-0000-000000000040'
  ),
  (
    '87000000-0000-0000-0000-000000000002',
    'goal87-suspended',
    'Goal 87 suspended',
    'suspended',
    null
  ),
  (
    '87000000-0000-0000-0000-000000000003',
    'goal87-legacy',
    'Goal 87 legacy',
    'provisioning',
    null
  );

insert into public.roles (id, tenant_id, name, level) values
  (
    '87000000-0000-0000-0000-000000000011',
    '87000000-0000-0000-0000-000000000001',
    'salon_admin',
    6
  ),
  (
    '87000000-0000-0000-0000-000000000012',
    '87000000-0000-0000-0000-000000000002',
    'salon_admin',
    6
  ),
  (
    '87000000-0000-0000-0000-000000000013',
    '87000000-0000-0000-0000-000000000003',
    'salon_admin',
    6
  );

insert into auth.users (id, email) values
  (
    '87000000-0000-0000-0000-000000000021',
    'goal87-owner-active@example.test'
  ),
  (
    '87000000-0000-0000-0000-000000000022',
    'goal87-owner-suspended@example.test'
  ),
  (
    '87000000-0000-0000-0000-000000000023',
    'goal87-owner-legacy@example.test'
  );

insert into public.users (
  id,
  tenant_id,
  email,
  role_id,
  access_scope,
  status
) values
  (
    '87000000-0000-0000-0000-000000000021',
    '87000000-0000-0000-0000-000000000001',
    'goal87-owner-active@example.test',
    '87000000-0000-0000-0000-000000000011',
    'organization',
    'active'
  ),
  (
    '87000000-0000-0000-0000-000000000022',
    '87000000-0000-0000-0000-000000000002',
    'goal87-owner-suspended@example.test',
    '87000000-0000-0000-0000-000000000012',
    'organization',
    'active'
  ),
  (
    '87000000-0000-0000-0000-000000000023',
    '87000000-0000-0000-0000-000000000003',
    'goal87-owner-legacy@example.test',
    '87000000-0000-0000-0000-000000000013',
    'organization',
    'active'
  );

insert into public.tenant_modules (tenant_id, module_key, state, config) values
  (
    '87000000-0000-0000-0000-000000000001',
    'galleri',
    'off',
    '{"shared":"explicit","choice":"kept"}'::jsonb
  ),
  (
    '87000000-0000-0000-0000-000000000001',
    'shop',
    'off',
    '{}'::jsonb
  ),
  (
    '87000000-0000-0000-0000-000000000001',
    'booking',
    'off',
    '{}'::jsonb
  ),
  (
    '87000000-0000-0000-0000-000000000001',
    'offert',
    'off',
    '{}'::jsonb
  ),
  (
    '87000000-0000-0000-0000-000000000002',
    'shop',
    'off',
    '{}'::jsonb
  ),
  (
    '87000000-0000-0000-0000-000000000001',
    'lojalitet',
    'off',
    '{}'::jsonb
  ),
  (
    '87000000-0000-0000-0000-000000000002',
    'lojalitet',
    'off',
    '{}'::jsonb
  );

-- A DB-verified partner may activate only a tenant owned by that partner.
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '87000000-0000-0000-0000-000000000041',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000041","role":"authenticated","app_metadata":{"platform_admin":false,"partner_admin":true,"partner_id":"87000000-0000-0000-0000-000000000040"}}',
  true
);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  begin
    insert into public.tenant_modules (tenant_id, module_key, state)
    values (
      '87000000-0000-0000-0000-000000000001',
      'media_library',
      'live'
    );
    raise exception 'goal87_live_insert_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'tenant_module_insert_must_start_off' then raise; end if;
  end;

  begin
    delete from public.tenant_modules
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'booking';
    raise exception 'goal87_partner_module_delete_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'tenant_module_delete_forbidden' then raise; end if;
  end;

  update public.tenant_modules
     set state = 'draft'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'lojalitet';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'goal87_partner_own_tenant_denied';
  end if;

  update public.tenant_modules
     set state = 'draft'
   where tenant_id = '87000000-0000-0000-0000-000000000002'
     and module_key = 'lojalitet';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'goal87_partner_cross_tenant_succeeded';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

do $$
begin
  if (
    select tm.state
      from public.tenant_modules tm
     where tm.tenant_id = '87000000-0000-0000-0000-000000000002'
       and tm.module_key = 'lojalitet'
  ) <> 'off' then
    raise exception 'goal87_partner_cross_tenant_changed_row';
  end if;
end;
$$;

-- Cross the existing launch-readiness fence instead of manufacturing active
-- tenants. Explicit booking=off lets tenant 1 use the website-only tuple;
-- tenant 3 deliberately keeps booking absent and supplies a real bookable tuple.
insert into public.tenant_settings (tenant_id) values
  ('87000000-0000-0000-0000-000000000001'),
  ('87000000-0000-0000-0000-000000000003');

insert into public.locations (
  id,
  tenant_id,
  name,
  is_primary,
  active
) values
  (
    '87000000-0000-0000-0000-000000000051',
    '87000000-0000-0000-0000-000000000001',
    'Goal 87 active primary',
    true,
    true
  ),
  (
    '87000000-0000-0000-0000-000000000053',
    '87000000-0000-0000-0000-000000000003',
    'Goal 87 legacy primary',
    true,
    true
  );

insert into public.services (
  id,
  tenant_id,
  location_id,
  name,
  duration_min,
  price_cents,
  active
) values (
  '87000000-0000-0000-0000-000000000061',
  '87000000-0000-0000-0000-000000000003',
  '87000000-0000-0000-0000-000000000053',
  'Goal 87 legacy service',
  60,
  10000,
  true
);

insert into public.staff (
  id,
  tenant_id,
  location_id,
  title,
  active
) values (
  '87000000-0000-0000-0000-000000000071',
  '87000000-0000-0000-0000-000000000003',
  '87000000-0000-0000-0000-000000000053',
  'Goal 87 legacy staff',
  false
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '87000000-0000-0000-0000-000000000003',
  '87000000-0000-0000-0000-000000000071',
  '87000000-0000-0000-0000-000000000061'
);
insert into public.working_hours (
  tenant_id,
  staff_id,
  location_id,
  weekday,
  start_time,
  end_time
) values (
  '87000000-0000-0000-0000-000000000003',
  '87000000-0000-0000-0000-000000000071',
  '87000000-0000-0000-0000-000000000053',
  1,
  time '09:00',
  time '17:00'
);
insert into public.location_opening_hours (
  tenant_id,
  location_id,
  weekday,
  start_time,
  end_time,
  source,
  confirmed_at
) values (
  '87000000-0000-0000-0000-000000000003',
  '87000000-0000-0000-0000-000000000053',
  1,
  time '09:00',
  time '17:00',
  'confirmed',
  pg_catalog.now()
);
update public.staff
   set active = true
 where id = '87000000-0000-0000-0000-000000000071';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
set local role service_role;
do $$
declare
  v_active jsonb;
  v_legacy jsonb;
begin
  v_active := public.publish_tenant(
    '87000000-0000-0000-0000-000000000001'
  );
  v_legacy := public.publish_tenant(
    '87000000-0000-0000-0000-000000000003'
  );
  if v_active ->> 'tenant_status' <> 'active'
     or v_legacy ->> 'tenant_status' <> 'active' then
    raise exception 'goal87_fixture_publish_failed';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- Offert is a service-role table write, so the trigger is its DB boundary:
-- claim-free fixtures pass; API off/draft/paused fail; API live succeeds.
insert into public.offert_requests (id, tenant_id, customer_name) values (
  '87000000-0000-0000-0000-000000000090',
  '87000000-0000-0000-0000-000000000001',
  'Maintenance fixture'
);
delete from public.offert_requests
 where id = '87000000-0000-0000-0000-000000000090';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    insert into public.offert_requests (id, tenant_id, customer_name) values (
      '87000000-0000-0000-0000-000000000091',
      '87000000-0000-0000-0000-000000000001',
      'Off'
    );
    raise exception 'goal87_off_offert_intake_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'module_public_action_denied' then raise; end if;
  end;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
   set state = 'draft'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'offert';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    insert into public.offert_requests (id, tenant_id, customer_name) values (
      '87000000-0000-0000-0000-000000000092',
      '87000000-0000-0000-0000-000000000001',
      'Draft'
    );
    raise exception 'goal87_draft_offert_intake_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'module_public_action_denied' then raise; end if;
  end;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
   set state = 'live'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'offert';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into public.offert_requests (id, tenant_id, customer_name) values (
  '87000000-0000-0000-0000-000000000093',
  '87000000-0000-0000-0000-000000000001',
  'Live'
);
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
   set state = 'paused'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'offert';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    insert into public.offert_requests (id, tenant_id, customer_name) values (
      '87000000-0000-0000-0000-000000000094',
      '87000000-0000-0000-0000-000000000001',
      'Paused'
    );
    raise exception 'goal87_paused_offert_intake_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'module_public_action_denied' then raise; end if;
  end;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- Direct module-row deletes are forbidden, but the existing tenant teardown
-- cascade must still be able to remove its children.
insert into public.tenants (id, slug, name, status) values (
  '87000000-0000-0000-0000-000000000004',
  'goal87-cascade',
  'Goal 87 cascade',
  'provisioning'
);
insert into public.tenant_modules (tenant_id, module_key, state) values (
  '87000000-0000-0000-0000-000000000004',
  'booking',
  'off'
);
delete from public.tenants
 where id = '87000000-0000-0000-0000-000000000004';
do $$
begin
  if exists (
    select 1 from public.tenant_modules tm
     where tm.tenant_id = '87000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'goal87_tenant_cascade_left_module';
  end if;
end;
$$;

-- A direct maintenance/operator session exercises the complete legal matrix.
do $$
declare
  v_activated timestamptz;
  v_first_activated timestamptz;
  v_config jsonb;
begin
  update public.tenant_modules
     set state = 'draft'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'galleri'
  returning activated_at, config into v_activated, v_config;

  if v_activated is null then
    raise exception 'goal87_first_activation_not_stamped';
  end if;
  if v_config <> '{"base":true,"shared":"explicit","choice":"kept"}'::jsonb then
    raise exception 'goal87_first_defaults_wrong_%', v_config;
  end if;
  v_first_activated := v_activated;

  update public.tenant_modules
     set state = 'live'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'galleri';
  update public.tenant_modules
     set state = 'paused'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'galleri';
  update public.tenant_modules
     set state = 'live'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'galleri';
  update public.tenant_modules
     set state = 'off'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'galleri';

  -- Remove one copied default while off. Reactivation must preserve that exact
  -- retained config instead of applying catalog defaults a second time.
  update public.tenant_modules
     set config = config - 'base'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'galleri';

  begin
    update public.tenant_modules
       set state = 'draft',
           config = '{"forged":true}'::jsonb
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'galleri';
    raise exception 'goal87_reactivation_config_change_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'module_state_change_must_preserve_config' then raise; end if;
  end;

  update public.tenant_modules
     set state = 'draft'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'galleri'
  returning activated_at, config into v_activated, v_config;

  if v_activated is distinct from v_first_activated then
    raise exception 'goal87_activation_timestamp_changed';
  end if;
  if v_config ? 'base' or v_config ->> 'choice' <> 'kept' then
    raise exception 'goal87_reactivation_reapplied_defaults_%', v_config;
  end if;

  begin
    update public.tenant_modules
       set state = 'live'
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'booking';
    raise exception 'goal87_off_to_live_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'illegal_tenant_module_state_transition' then raise; end if;
  end;

  begin
    update public.tenant_modules
       set id = pg_catalog.gen_random_uuid()
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'galleri';
    raise exception 'goal87_id_change_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'tenant_module_identity_is_immutable' then raise; end if;
  end;

  begin
    update public.tenant_modules
       set tenant_id = '87000000-0000-0000-0000-000000000002'
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'galleri';
    raise exception 'goal87_tenant_change_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'tenant_module_identity_is_immutable' then raise; end if;
  end;

  begin
    update public.tenant_modules
       set module_key = 'lojalitet'
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'galleri';
    raise exception 'goal87_module_key_change_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'tenant_module_identity_is_immutable' then raise; end if;
  end;

  begin
    update public.tenant_modules
       set created_at = created_at + interval '1 second'
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'galleri';
    raise exception 'goal87_created_at_change_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'tenant_module_identity_is_immutable' then raise; end if;
  end;

  begin
    update public.tenant_modules
       set activated_at = activated_at + interval '1 second'
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'galleri';
    raise exception 'goal87_activated_at_change_succeeded';
  exception when sqlstate '23514' then
    if sqlerrm <> 'tenant_module_activation_metadata_is_immutable' then raise; end if;
  end;
end;
$$;

-- Platform performs the two initial off→draft activations.
update public.tenant_modules
   set state = 'draft'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'shop';
update public.tenant_modules
   set state = 'draft'
 where tenant_id = '87000000-0000-0000-0000-000000000002'
   and module_key = 'shop';

-- An active, DB-verified tenant owner may operate draft/live/paused, but may
-- neither change config while paused, activate off, nor turn a module off.
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '87000000-0000-0000-0000-000000000021',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"87000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

update public.tenant_modules
   set state = 'live'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'shop';
update public.tenant_modules
   set state = 'paused'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'shop';

do $$
begin
  begin
    update public.tenant_modules
       set config = '{"forged":true}'::jsonb
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'shop';
    raise exception 'goal87_paused_config_write_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'tenant_module_config_not_writable_in_state' then raise; end if;
  end;

  update public.tenant_modules
     set state = 'live'
   where tenant_id = '87000000-0000-0000-0000-000000000001'
     and module_key = 'shop';

  begin
    update public.tenant_modules
       set state = 'off'
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'shop';
    raise exception 'goal87_customer_off_succeeded';
  exception when sqlstate '42501' then
    if sqlerrm <> 'platform_operator_required' then raise; end if;
  end;

  begin
    update public.tenant_modules
       set state = 'draft'
     where tenant_id = '87000000-0000-0000-0000-000000000001'
       and module_key = 'booking';
    raise exception 'goal87_customer_activation_succeeded';
  exception when sqlstate '42501' then
    if sqlerrm <> 'platform_operator_required' then raise; end if;
  end;
end;
$$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- The same legal customer transition is denied for an inactive tenant.
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '87000000-0000-0000-0000-000000000022',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000022","role":"authenticated","app_metadata":{"tenant_id":"87000000-0000-0000-0000-000000000002","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
begin
  begin
    update public.tenant_modules
       set state = 'live'
     where tenant_id = '87000000-0000-0000-0000-000000000002'
       and module_key = 'shop';
    raise exception 'goal87_inactive_customer_transition_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'inactive_tenant_module_mutation' then raise; end if;
  end;
end;
$$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- Resolver semantics: only a genuinely missing booking row gets legacy live.
do $$
begin
  if private.module_state(
       '87000000-0000-0000-0000-000000000003',
       'booking'
     ) <> 'live' then
    raise exception 'goal87_missing_booking_not_legacy_live';
  end if;
  if private.module_state(
       '87000000-0000-0000-0000-000000000003',
       'shop'
     ) <> 'off' then
    raise exception 'goal87_missing_nonbooking_not_off';
  end if;
  if private.module_state(
       '87000000-0000-0000-0000-000000000001',
       'booking'
     ) <> 'off' then
    raise exception 'goal87_explicit_booking_off_ignored';
  end if;
  if not private.module_public_readable(
       '87000000-0000-0000-0000-000000000003',
       'booking'
     ) then
    raise exception 'goal87_legacy_booking_not_readable';
  end if;
  if private.module_public_readable(
       '87000000-0000-0000-0000-000000000002',
       'shop'
     ) then
    raise exception 'goal87_inactive_tenant_readable';
  end if;
  if not private.module_public_action_allowed(
       '87000000-0000-0000-0000-000000000001',
       'shop'
     ) then
    raise exception 'goal87_live_shop_action_denied';
  end if;
  if private.module_public_action_allowed(
       '87000000-0000-0000-0000-000000000001',
       'booking'
     ) then
    raise exception 'goal87_off_booking_action_allowed';
  end if;
end;
$$;

-- A replay of an already-created booking is not a new action. It must keep the
-- legacy request-id result even if booking is turned off after the first write.
insert into public.bookings (
  id,
  tenant_id,
  location_id,
  staff_id,
  service_id,
  start_ts,
  end_ts,
  status,
  price_cents,
  request_id
) values (
  '87000000-0000-0000-0000-000000000082',
  '87000000-0000-0000-0000-000000000003',
  '87000000-0000-0000-0000-000000000053',
  '87000000-0000-0000-0000-000000000071',
  '87000000-0000-0000-0000-000000000061',
  pg_catalog.date_trunc('week', pg_catalog.now()) + interval '1 week 9 hours',
  pg_catalog.date_trunc('week', pg_catalog.now()) + interval '1 week 10 hours',
  'confirmed',
  10000,
  '87000000-0000-0000-0000-000000000081'
);

insert into public.tenant_modules (tenant_id, module_key, state) values (
  '87000000-0000-0000-0000-000000000003',
  'booking',
  'off'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '87000000-0000-0000-0000-000000000023',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"tenant_id":"87000000-0000-0000-0000-000000000003","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
declare
  v_booking uuid;
begin
  v_booking := public.create_public_booking(
    'goal87-legacy',
    '87000000-0000-0000-0000-000000000061',
    '87000000-0000-0000-0000-000000000071',
    timestamptz '2099-01-05 09:00:00+00',
    null,
    null,
    null,
    null,
    null,
    '87000000-0000-0000-0000-000000000053',
    '87000000-0000-0000-0000-000000000081'
  );
  if v_booking <> '87000000-0000-0000-0000-000000000082'::uuid then
    raise exception 'goal87_booking_retry_changed_%', v_booking;
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- Exercise one representative public policy through the real anon role:
-- draft hidden, live readable, paused readable, off hidden.
insert into public.gallery_items (id, tenant_id, caption, active) values (
  '87000000-0000-0000-0000-000000000031',
  '87000000-0000-0000-0000-000000000001',
  'Goal 87',
  true
);

select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if exists (
    select 1 from public.gallery_items
     where id = '87000000-0000-0000-0000-000000000031'
  ) then
    raise exception 'goal87_draft_gallery_public';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
   set state = 'live'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'galleri';

select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if not exists (
    select 1 from public.gallery_items
     where id = '87000000-0000-0000-0000-000000000031'
  ) then
    raise exception 'goal87_live_gallery_hidden';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
   set state = 'paused'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'galleri';

select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if not exists (
    select 1 from public.gallery_items
     where id = '87000000-0000-0000-0000-000000000031'
  ) then
    raise exception 'goal87_paused_gallery_hidden';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

update public.tenant_modules
   set state = 'live'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'galleri';
update public.tenant_modules
   set state = 'off'
 where tenant_id = '87000000-0000-0000-0000-000000000001'
   and module_key = 'galleri';

select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if exists (
    select 1 from public.gallery_items
     where id = '87000000-0000-0000-0000-000000000031'
  ) then
    raise exception 'goal87_off_gallery_public';
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- Readiness is an authenticated/service-only, nine-module contract.
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
set local role service_role;
do $$
declare
  v_readiness jsonb;
begin
  v_readiness := public.tenant_module_readiness(
    '87000000-0000-0000-0000-000000000001'
  );
  if (
    select pg_catalog.count(*)
      from pg_catalog.jsonb_object_keys(v_readiness -> 'modules')
  ) <> 9 then
    raise exception 'goal87_readiness_module_count_%', v_readiness;
  end if;
  if v_readiness #>> '{modules,booking,state}' <> 'off'
     or (v_readiness #>> '{modules,booking,public_action_allowed}')::boolean then
    raise exception 'goal87_readiness_booking_state_%', v_readiness;
  end if;
  if v_readiness #>> '{modules,shop,state}' <> 'live'
     or not (v_readiness #>> '{modules,shop,public_readable}')::boolean
     or not (v_readiness #>> '{modules,shop,public_action_allowed}')::boolean then
    raise exception 'goal87_readiness_shop_state_%', v_readiness;
  end if;
  if not (v_readiness ->> 'ready')::boolean
     or v_readiness ->> 'tenant_status' <> 'active' then
    raise exception 'goal87_readiness_summary_%', v_readiness;
  end if;
end;
$$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

-- All fourteen public policies must point at the shared resolver and right key.
do $$
begin
  if exists (
    select 1
      from (
        values
          ('services', 'services_public_read', 'booking'),
          ('staff', 'staff_public_read', 'booking'),
          ('staff_services', 'staff_services_public_read', 'booking'),
          ('locations', 'locations_public_read', 'booking'),
          ('location_opening_hours', 'location_opening_hours_public_read', 'booking'),
          ('working_hours', 'working_hours_public_read', 'booking'),
          ('working_hour_slots', 'working_hour_slots_public_read', 'booking'),
          ('shop_products', 'shop_products_public_read', 'shop'),
          ('shop_product_variants', 'shop_variants_public_read', 'shop'),
          ('shop_shipping_options', 'shop_shipping_options_public_read', 'shop'),
          ('blog_posts', 'blog_posts_public_read', 'blogg'),
          ('loyalty_plans', 'loyalty_plans_public_read', 'lojalitet'),
          ('tenant_events', 'tenant_events_public_read', 'kurser'),
          ('gallery_items', 'gallery_items_public_read', 'galleri')
      ) expected(table_name, policy_name, module_key)
      left join pg_catalog.pg_policies p
        on p.schemaname = 'public'
       and p.tablename = expected.table_name
       and p.policyname = expected.policy_name
     where p.policyname is null
        or pg_catalog.strpos(
             coalesce(p.qual, ''),
             'module_public_readable'
           ) = 0
        or pg_catalog.strpos(
             coalesce(p.qual, ''),
             expected.module_key
           ) = 0
  ) then
    raise exception 'goal87_public_policy_gate_missing';
  end if;
end;
$$;

-- Private helpers/implementations stay private; public contracts keep only the
-- explicitly intended caller roles.
do $$
begin
  if not pg_catalog.has_function_privilege(
       'anon',
       'private.module_public_readable(uuid,text)',
       'execute'
     ) then
    raise exception 'goal87_anon_public_read_resolver_missing';
  end if;
  if pg_catalog.has_function_privilege(
       'authenticated',
       'private.module_state(uuid,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'private.module_public_action_allowed(uuid,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'private.create_public_booking_goal87_impl(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'private.reserve_shop_order_goal87_impl(text,jsonb,text,text,integer)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'private.confirm_shop_order_goal87_impl(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'private.guard_offert_public_intake_goal87()',
       'execute'
     ) then
    raise exception 'goal87_private_function_execute_leak';
  end if;
  if pg_catalog.has_function_privilege(
       'anon',
       'public.tenant_module_readiness(uuid)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.tenant_module_readiness(uuid)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.tenant_module_readiness(uuid)',
       'execute'
     ) then
    raise exception 'goal87_readiness_grants_invalid';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.reserve_shop_order(text,jsonb,text,text,integer)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.reserve_shop_order(text,jsonb,text,text,integer)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.reserve_shop_order(text,jsonb,text,text,integer)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'anon',
       'public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text)',
       'execute'
     ) then
    raise exception 'goal87_public_rpc_grants_invalid';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) acl
     where n.nspname = 'public'
       and p.oid in (
         'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)'::regprocedure,
         'public.reserve_shop_order(text,jsonb,text,text,integer)'::regprocedure,
         'public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text)'::regprocedure
       )
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'goal87_public_rpc_public_execute_leak';
  end if;
end;
$$;

rollback;
\endif
