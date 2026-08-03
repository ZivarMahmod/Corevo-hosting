-- Goal 88 runtime: root-only atomic theme switch shares save_site_draft's tenant lock.
-- Everything is rolled back.
begin;

insert into public.tenants (id, slug, name, vertical_id) values
  ('88000000-0000-0000-0000-000000000001', 'goal88-theme', 'Goal 88 Theme', 'frisör'),
  ('88000000-0000-0000-0000-000000000002', 'goal88-theme-empty', 'Goal 88 Empty', null);
insert into public.tenant_settings (tenant_id, settings) values
  (
    '88000000-0000-0000-0000-000000000001',
    '{"theme":"siluett","copy":{"heroTitle":"Före"},"keep":true}'
  );
insert into public.site_revisions (
  id,
  tenant_id,
  status,
  snapshot,
  published_at
) values (
  '88000000-0000-0000-0000-000000000031',
  '88000000-0000-0000-0000-000000000001',
  'published',
  '{
    "tenant":{"name":"Goal 88 Theme"},
    "settings":{
      "copy":{},"theme":"siluett",
      "contact":{"email":null,"phone":null},
      "social":{"instagram":null,"facebook":null,"tiktok":null},
      "map":null,"opening_hours":null,
      "seo":{"title":null,"description":null},
      "booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}
    },
    "branding":{},"location":{"address":null}
  }',
  now()
);
insert into public.roles (id, tenant_id, name, level) values
  ('88000000-0000-0000-0000-000000000011', null, 'super_admin', 8),
  ('88000000-0000-0000-0000-000000000012', '88000000-0000-0000-0000-000000000001', 'owner', 6);
insert into auth.users (id, email) values
  ('88000000-0000-0000-0000-000000000021', 'goal88-root@example.test'),
  ('88000000-0000-0000-0000-000000000022', 'goal88-owner@example.test');
insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('88000000-0000-0000-0000-000000000021', null, 'goal88-root@example.test', '88000000-0000-0000-0000-000000000011', 'organization', 'active'),
  ('88000000-0000-0000-0000-000000000022', '88000000-0000-0000-0000-000000000001', 'goal88-owner@example.test', '88000000-0000-0000-0000-000000000012', 'organization', 'active');

do $$
declare
  v_definition text := lower(pg_get_functiondef(
    'public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)'::regprocedure
  ));
  v_restore_definition text := lower(pg_get_functiondef(
    'public.restore_site_revision(uuid,uuid,bigint)'::regprocedure
  ));
  v_save_definition text := lower(pg_get_functiondef(
    'public.save_site_draft(uuid,jsonb,bigint)'::regprocedure
  ));
begin
  if strpos(v_definition, 'select t.vertical_id') = 0
     or strpos(v_definition, 'select t.vertical_id')
        > strpos(v_definition, 'from public.site_revisions sr') then
    raise exception 'theme_switch_missing_canonical_tenant_lock_order';
  end if;
  if strpos(v_definition, 'from public.site_revisions sr')
     > strpos(v_definition, 'insert into public.tenant_settings') then
    raise exception 'theme_switch_draft_check_not_atomic';
  end if;
  if strpos(v_definition, 'from public.site_revisions sr')
     > strpos(v_definition, 'v_vertical_id is distinct from p_expected_vertical') then
    raise exception 'theme_switch_draft_check_not_truthful';
  end if;
  if strpos(v_save_definition, 'perform 1 from public.tenants t where t.id = p_tenant for update') = 0
     or strpos(v_save_definition, 'site_revision_theme_conflict')
        > strpos(v_save_definition, 'insert into public.site_revisions') then
    raise exception 'save_draft_theme_lock_order_missing';
  end if;
  if strpos(v_restore_definition, 'perform 1 from public.tenants t where t.id = p_tenant for update') = 0
     or strpos(v_restore_definition, 'site_revision_theme_conflict')
        > strpos(v_restore_definition, 'insert into public.site_revisions') then
    raise exception 'restore_revision_theme_lock_order_missing';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"88000000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;

select public.switch_tenant_theme(
  '88000000-0000-0000-0000-000000000002',
  '{}',
  null,
  'freshcut',
  '{}'
);

do $$
begin
  if not exists (
    select 1
      from public.tenant_settings ts
     where ts.tenant_id = '88000000-0000-0000-0000-000000000002'
       and ts.settings = '{"theme":"freshcut","copy":{}}'::jsonb
  ) then
    raise exception 'theme_switch_missing_row_not_materialized';
  end if;
  begin
    perform public.switch_tenant_theme(
      '88000000-0000-0000-0000-000000000002',
      '{}',
      null,
      'kalla',
      '{}'
    );
    raise exception 'theme_switch_missing_row_cas_overwrote_insert';
  exception when serialization_failure then
    if sqlerrm <> 'site_theme_settings_conflict' then raise; end if;
  end;
end
$$;

select public.switch_tenant_theme(
  '88000000-0000-0000-0000-000000000001',
  '{"theme":"siluett","copy":{"heroTitle":"Före"},"keep":true}',
  'frisör',
  'kalla',
  '{"heroTitle":"Efter"}'
);

do $$
begin
  if not exists (
    select 1
      from public.tenant_settings ts
     where ts.tenant_id = '88000000-0000-0000-0000-000000000001'
       and ts.settings = '{"theme":"kalla","copy":{"heroTitle":"Efter"},"keep":true}'::jsonb
  ) then
    raise exception 'theme_switch_did_not_preserve_coowned_settings';
  end if;
end
$$;

do $$
begin
  begin
    perform public.restore_site_revision(
      '88000000-0000-0000-0000-000000000001',
      '88000000-0000-0000-0000-000000000031',
      null
    );
    raise exception 'theme_switch_accepted_old_theme_restore';
  exception when serialization_failure then
    if sqlerrm <> 'site_revision_theme_conflict' then raise; end if;
  end;
end
$$;

do $$
declare
  v_old_snapshot jsonb := '{
    "tenant":{"name":"Goal 88 Theme"},
    "settings":{
      "copy":{},"theme":"siluett",
      "contact":{"email":null,"phone":null},
      "social":{"instagram":null,"facebook":null,"tiktok":null},
      "map":null,"opening_hours":null,
      "seo":{"title":null,"description":null},
      "booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}
    },
    "branding":{},"location":{"address":null}
  }'::jsonb;
begin
  begin
    perform public.save_site_draft(
      '88000000-0000-0000-0000-000000000001',
      v_old_snapshot,
      null
    );
    raise exception 'theme_switch_accepted_old_theme_save';
  exception when serialization_failure then
    if sqlerrm <> 'site_revision_theme_conflict' then raise; end if;
  end;
end
$$;

do $$
begin
  begin
    perform public.switch_tenant_theme(
      '88000000-0000-0000-0000-000000000001',
      '{"theme":"siluett","copy":{"heroTitle":"Före"},"keep":true}',
      'frisör',
      'snitt',
      '{}'
    );
    raise exception 'theme_switch_accepted_stale_settings';
  exception when serialization_failure then
    if sqlerrm <> 'site_theme_settings_conflict' then raise; end if;
  end;
end
$$;

do $$
begin
  begin
    perform public.switch_tenant_theme(
      '88000000-0000-0000-0000-000000000001',
      '{"theme":"kalla","copy":{"heroTitle":"Efter"},"keep":true}',
      'not-a-uuid',
      'snitt',
      '{}'
    );
    raise exception 'theme_switch_accepted_stale_vertical';
  exception when serialization_failure then
    if sqlerrm <> 'site_theme_tenant_conflict' then raise; end if;
  end;
end
$$;

do $$
begin
  begin
    perform public.switch_tenant_theme(
      '88000000-0000-0000-0000-000000000001',
      '{"theme":"kalla","copy":{"heroTitle":"Efter"},"keep":true}',
      'frisör',
      'legacy-unsafe',
      '{}'
    );
    raise exception 'theme_switch_accepted_invalid_theme';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_theme_invalid' then raise; end if;
  end;

  begin
    perform public.switch_tenant_theme(
      '88000000-0000-0000-0000-000000000001',
      '{"theme":"kalla","copy":{"heroTitle":"Efter"},"keep":true}',
      'frisör',
      'snitt',
      '[]'
    );
    raise exception 'theme_switch_accepted_invalid_copy';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_theme_copy_invalid' then raise; end if;
  end;
end
$$;

reset role;
update public.tenant_settings
   set settings = jsonb_set(settings, '{theme}', '"legacy-typo"')
 where tenant_id = '88000000-0000-0000-0000-000000000001';
set local role authenticated;

select public.save_site_draft(
  '88000000-0000-0000-0000-000000000001',
  '{
    "tenant":{"name":"Goal 88 Theme"},
    "settings":{
      "copy":{},"theme":"legacy-typo",
      "contact":{"email":null,"phone":null},
      "social":{"instagram":null,"facebook":null,"tiktok":null},
      "map":null,"opening_hours":null,
      "seo":{"title":null,"description":null},
      "booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}
    },
    "branding":{},"location":{"address":null}
  }',
  null
);

do $$
begin
  begin
    perform public.switch_tenant_theme(
      '88000000-0000-0000-0000-000000000001',
      '{"theme":"legacy-typo","copy":{"heroTitle":"Efter"},"keep":true}',
      'wrong-draft-vertical',
      'snitt',
      '{}'
    );
    raise exception 'theme_switch_accepted_existing_draft';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'site_theme_draft_exists' then raise; end if;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000022', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"88000000-0000-0000-0000-000000000022","role":"authenticated","app_metadata":{"tenant_id":"88000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.switch_tenant_theme(
      '88000000-0000-0000-0000-000000000001',
      '{"theme":"kalla","copy":{"heroTitle":"Efter"},"keep":true}',
      'frisör',
      'snitt',
      '{}'
    );
    raise exception 'tenant_admin_switched_theme';
  exception when insufficient_privilege then
    if sqlerrm <> 'site_theme_scope_denied' then raise; end if;
  end;
end
$$;

reset role;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated_theme_switch_execute_missing';
  end if;
  if has_function_privilege('anon', 'public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)', 'EXECUTE')
     or has_function_privilege('public', 'public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)', 'EXECUTE') then
    raise exception 'theme_switch_execute_overgranted';
  end if;
  if has_function_privilege('authenticated', 'private.canonical_site_theme(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'private.canonical_site_theme(jsonb)', 'EXECUTE') then
    raise exception 'canonical_theme_helper_exposed';
  end if;
end
$$;

rollback;
