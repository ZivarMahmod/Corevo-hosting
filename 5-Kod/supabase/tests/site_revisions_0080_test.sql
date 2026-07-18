-- 0080 runtime: private optimistic drafts, atomic publish, discard and restore.
-- Everything is rolled back.
begin;

insert into public.tenants (id, slug, name) values
  ('80000000-0000-0000-0000-000000000001', 'site-revisions-a', 'Before A'),
  ('80000000-0000-0000-0000-000000000002', 'site-revisions-x', 'Before X');
insert into public.tenant_settings (tenant_id, settings, branding) values
  (
    '80000000-0000-0000-0000-000000000001',
    '{"copy":{"heroTitle":"Before"},"theme":"kalla","social":{"instagram":"stale"},"booking":{"keepBooking":"booking"},"customer_accounts_enabled":true,"keep":"settings"}',
    '{"color_primary":"#000000","color_bg":"#ffffff","team":[{"name":"Legacy","role":"Owner","img":""}],"keep_brand":"branding"}'
  ),
  ('80000000-0000-0000-0000-000000000002', '{}', '{}');
insert into public.roles (id, tenant_id, name, level) values
  ('80000000-0000-0000-0000-000000000021', '80000000-0000-0000-0000-000000000001', 'owner', 6),
  ('80000000-0000-0000-0000-000000000022', null, 'super_admin', 8),
  ('80000000-0000-0000-0000-000000000023', '80000000-0000-0000-0000-000000000001', 'staff', 3);
insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-000000000101', 'site-owner@example.test'),
  ('80000000-0000-0000-0000-000000000102', 'site-location@example.test'),
  ('80000000-0000-0000-0000-000000000103', 'site-platform@example.test');
insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('80000000-0000-0000-0000-000000000101', '80000000-0000-0000-0000-000000000001', 'site-owner@example.test', '80000000-0000-0000-0000-000000000021', 'organization', 'active'),
  ('80000000-0000-0000-0000-000000000102', '80000000-0000-0000-0000-000000000001', 'site-location@example.test', '80000000-0000-0000-0000-000000000023', 'locations', 'active'),
  ('80000000-0000-0000-0000-000000000103', '80000000-0000-0000-0000-000000000001', 'site-platform@example.test', '80000000-0000-0000-0000-000000000022', 'organization', 'active');

-- Organization owner: create, update and publish one optimistic draft.
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"80000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);

-- Locale-independent exact twin of the TypeScript font character allowlist.
do $$ begin
  if not private.site_font_is_safe('A' || chr(65279) || 'B') then
    raise exception 'ecmascript_font_whitespace_rejected';
  end if;
  if private.site_font_is_safe('A' || chr(133) || 'B') then
    raise exception 'non_ecmascript_font_whitespace_accepted';
  end if;
end $$;

set local role authenticated;

-- Direct RPC callers must submit the same complete canonical snapshot as the web action.
do $$
declare
  v_base jsonb := '{
    "tenant":{"name":"Canonical"},
    "settings":{
      "copy":{},"theme":"kalla",
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
      '80000000-0000-0000-0000-000000000001',
      '{"tenant":{"name":"Incomplete"},"settings":{},"branding":{},"location":{"address":null}}',
      null
    );
    raise exception 'incomplete_snapshot_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{settings,contact,email}', '"inte-en-adress"'),
      null
    );
    raise exception 'invalid_email_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{settings,social,instagram}', '"javascript:alert(1)"'),
      null
    );
    raise exception 'invalid_social_href_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{settings,social,instagram}', '"instagram.com/corevo"'),
      null
    );
    raise exception 'unnormalized_social_href_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;
end $$;

-- Direct RPC callers cannot bypass the canonical trimmed/null normal form.
do $$
declare
  v_base jsonb := '{
    "tenant":{"name":"Canonical"},
    "settings":{
      "copy":{},"theme":"kalla",
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
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{tenant,name}', '" Canonical "'),
      null
    );
    raise exception 'untrimmed_name_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{tenant,name}', to_jsonb(E'\tCanonical'::text)),
      null
    );
    raise exception 'unicode_whitespace_name_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{tenant,name}', to_jsonb(repeat('😀', 201))),
      null
    );
    raise exception 'overlong_unicode_name_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{settings,contact,email}', '""'),
      null
    );
    raise exception 'empty_contact_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      jsonb_set(v_base, '{settings,opening_hours}', '[]'),
      null
    );
    raise exception 'empty_hours_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_invalid' then raise; end if;
  end;
end $$;

-- Direct RPC callers cannot persist malformed branding that would crash token parsing.
do $$ begin
  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      '{
        "tenant":{"name":"Bad"},
        "settings":{
          "copy":{},"theme":"kalla",
          "contact":{"email":null,"phone":null},
          "social":{"instagram":null,"facebook":null,"tiktok":null},
          "map":null,"opening_hours":null,
          "seo":{"title":null,"description":null},
          "booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}
        },
        "branding":{"color_accent":{"poison":true}},
        "location":{"address":null}
      }',
      null
    );
    raise exception 'malformed_branding_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'site_snapshot_branding_invalid' then raise; end if;
  end;
end $$;

do $$
declare
  v_id uuid;
  v_lock bigint;
  v_published_snapshot jsonb;
begin
  select revision_id, lock_version into v_id, v_lock
    from public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      '{
        "tenant":{"name":"Draft A"},
        "settings":{
          "copy":{"heroTitle":"Draft one"},"theme":"kalla",
          "contact":{"email":null,"phone":null},
          "social":{"instagram":null,"facebook":null,"tiktok":null},
          "map":null,"opening_hours":null,
          "seo":{"title":null,"description":null},
          "booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}
        },
        "branding":{"color_primary":"#112233"},
        "location":{"address":"Draft address"}
      }',
      null
    );
  if v_id is null or v_lock <> 1 then raise exception 'draft_create_failed_%_%', v_id, v_lock; end if;

  select revision_id, lock_version into v_id, v_lock
    from public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      '{
        "tenant":{"name":"Published A"},
        "settings":{
          "copy":{"heroTitle":"After"},
          "theme":"snitt",
          "contact":{"email":"after@example.test","phone":null},
          "social":{"instagram":null,"facebook":null,"tiktok":null},
          "map":null,"opening_hours":null,
          "seo":{"title":null,"description":null},
          "booking":{"variant":"compact","pickerMode":"strip","staffAvatars":"foto"}
        },
        "branding":{
          "color_primary":"#123456",
          "hero_images":["https://cdn.example.test/hero.webp"]
        },
        "location":{"address":"After address"}
      }',
      1
    );
  if v_lock <> 2 then raise exception 'draft_update_failed_%', v_lock; end if;

  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      '{
        "tenant":{"name":"Stale"},
        "settings":{"copy":{},"theme":"kalla","contact":{"email":null,"phone":null},"social":{"instagram":null,"facebook":null,"tiktok":null},"map":null,"opening_hours":null,"seo":{"title":null,"description":null},"booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}},
        "branding":{},"location":{"address":null}
      }',
      1
    );
    raise exception 'stale_save_succeeded';
  exception when serialization_failure then
    if sqlerrm <> 'site_revision_conflict' then raise; end if;
  end;

  select revision_id, lock_version, snapshot into v_id, v_lock, v_published_snapshot
    from public.publish_site_draft('80000000-0000-0000-0000-000000000001', 2);
  if v_lock <> 3 then raise exception 'publish_lock_failed_%', v_lock; end if;
  if v_published_snapshot #>> '{location,address}' <> 'After address' then
    raise exception 'publish_snapshot_missing_%', v_published_snapshot;
  end if;
end $$;

do $$
declare
  v_name text;
  v_location_name text;
  v_settings jsonb;
  v_branding jsonb;
  v_address text;
  v_status text;
begin
  select name into v_name from public.tenants where id = '80000000-0000-0000-0000-000000000001';
  select settings, branding into v_settings, v_branding
    from public.tenant_settings where tenant_id = '80000000-0000-0000-0000-000000000001';
  select name, address into v_location_name, v_address
    from public.locations where tenant_id = '80000000-0000-0000-0000-000000000001' and is_primary;
  select status into v_status
    from public.site_revisions where tenant_id = '80000000-0000-0000-0000-000000000001';

  if v_name <> 'Published A' or v_location_name <> 'Published A'
     or v_address <> 'After address' or v_status <> 'published' then
    raise exception 'published_scalar_mismatch_%_%_%_%', v_name, v_location_name, v_address, v_status;
  end if;
  if v_settings #>> '{copy,heroTitle}' <> 'After'
     or v_settings ->> 'theme' <> 'kalla'
     or v_settings #>> '{contact,email}' <> 'after@example.test'
     or v_settings ->> 'keep' <> 'settings'
     or v_settings ->> 'customer_accounts_enabled' <> 'true'
     or v_settings #>> '{booking,variant}' <> 'compact'
     or v_settings #>> '{booking,pickerMode}' <> 'strip'
     or v_settings #>> '{booking,staffAvatars}' <> 'foto'
     or v_settings #>> '{booking,keepBooking}' <> 'booking'
     or v_settings -> 'booking' ? 'poison'
     or jsonb_typeof(v_settings #> '{social,instagram}') <> 'null'
     or v_settings ? 'poison' then
    raise exception 'published_settings_mismatch_%', v_settings;
  end if;
  if v_branding ->> 'color_primary' <> '#123456'
     or v_branding ->> 'keep_brand' <> 'branding'
     or v_branding #>> '{team,0,name}' <> 'Legacy'
     or v_branding ? 'color_bg'
     or v_branding ? 'poison' then
    raise exception 'published_branding_mismatch_%', v_branding;
  end if;
end $$;

-- Restore clones history to a new draft; discard removes only that draft.
do $$
declare
  v_published uuid;
  v_draft uuid;
  v_lock bigint;
begin
  select id into v_published from public.site_revisions
   where tenant_id = '80000000-0000-0000-0000-000000000001' and status = 'published';
  select revision_id, lock_version into v_draft, v_lock
    from public.restore_site_revision(
      '80000000-0000-0000-0000-000000000001', v_published, null
    );
  if v_draft = v_published or v_lock <> 1 then raise exception 'restore_failed_%_%', v_draft, v_lock; end if;
  if not exists (
    select 1 from public.site_revisions
     where id = v_draft and status = 'draft' and source_revision_id = v_published
  ) then raise exception 'restore_lineage_missing'; end if;
  if public.discard_site_draft('80000000-0000-0000-0000-000000000001', 1) <> v_draft then
    raise exception 'discard_wrong_revision';
  end if;
  if not exists (select 1 from public.site_revisions where id = v_published and status = 'published') then
    raise exception 'discard_deleted_history';
  end if;
end $$;

-- Cross-tenant callers and staff without the explicit site grant are denied.
do $$ begin
  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000002',
      '{"tenant":{"name":"Cross"},"settings":{},"branding":{},"location":{"address":null}}',
      null
    );
    raise exception 'cross_tenant_save_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"tenant_id":"80000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$ begin
  begin
    perform public.save_site_draft(
      '80000000-0000-0000-0000-000000000001',
      '{"tenant":{"name":"Location"},"settings":{},"branding":{},"location":{"address":null}}',
      null
    );
    raise exception 'location_scope_save_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- A real platform admin may manage another tenant.
reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;
do $$
declare v_id uuid; v_lock bigint;
begin
  select revision_id, lock_version into v_id, v_lock
    from public.save_site_draft(
      '80000000-0000-0000-0000-000000000002',
      '{
        "tenant":{"name":"Platform X"},
        "settings":{"copy":{},"theme":"kalla","contact":{"email":null,"phone":null},"social":{"instagram":null,"facebook":null,"tiktok":null},"map":null,"opening_hours":null,"seo":{"title":null,"description":null},"booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}},
        "branding":{},"location":{"address":null}
      }',
      null
    );
  if v_lock <> 1 then raise exception 'platform_save_failed'; end if;
  perform public.discard_site_draft('80000000-0000-0000-0000-000000000002', 1);
end $$;

-- Authenticated has read-only table grants; history is immutable even for table owner.
reset role;
do $$
declare v_published uuid;
begin
  select id into v_published from public.site_revisions
   where tenant_id = '80000000-0000-0000-0000-000000000001' and status = 'published';
  begin
    update public.site_revisions set snapshot = '{}' where id = v_published;
    raise exception 'published_update_succeeded';
  exception when raise_exception then
    if sqlerrm <> 'published_site_revision_immutable' then raise; end if;
  end;
  begin
    delete from public.site_revisions where id = v_published;
    raise exception 'published_delete_succeeded';
  exception when raise_exception then
    if sqlerrm <> 'published_site_revision_immutable' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
