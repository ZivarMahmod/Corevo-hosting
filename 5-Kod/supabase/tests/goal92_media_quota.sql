-- Goal 92 media lifecycle, quota, dedupe, RLS and durable R2 cleanup.
-- All fixtures and mutations are transactional and rolled back.
begin;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

do $$
declare
  v_reserve_def text;
  v_fk_guard_def text;
  v_url_guard_def text;
  v_json_guard_def text;
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'media_assets'
       and column_name = 'status'
  )
  or to_regprocedure('public.reserve_media_upload(uuid,text,bigint,text)') is null
  or to_regprocedure('public.finalize_media_upload(uuid,uuid,text,jsonb,boolean)') is null
  or to_regprocedure('public.cancel_media_upload(uuid,uuid,text,boolean)') is null
  or to_regprocedure('public.request_media_delete(uuid,uuid)') is null
  or to_regprocedure('public.update_media_alt(uuid,uuid,text)') is null
  or to_regprocedure('public.claim_media_cleanup_jobs(integer,integer)') is null
  or to_regprocedure('public.retry_media_cleanup_job(uuid,uuid,text,integer)') is null
  or to_regprocedure('public.complete_media_cleanup_job(uuid,uuid)') is null
  or to_regprocedure('private.publish_referenced_media()') is null
  or to_regprocedure('private.guard_media_url_reference()') is null
  or to_regprocedure('private.guard_media_json_references()') is null then
    raise exception 'goal92_media_lifecycle_missing';
  end if;

  if to_regclass('public.media_assets_tenant_hash_active_unique') is null
     or to_regclass('private.media_cleanup_jobs') is null
     or to_regclass('private.media_cleanup_jobs_expired_lease_idx') is null then
    raise exception 'goal92_media_storage_contract_missing';
  end if;

  if has_table_privilege('authenticated', 'public.media_assets', 'insert')
     or has_table_privilege('authenticated', 'public.media_assets', 'update')
     or has_table_privilege('authenticated', 'public.media_assets', 'delete')
     or not has_table_privilege('authenticated', 'public.media_assets', 'select')
     or not has_table_privilege('anon', 'public.media_assets', 'select') then
    raise exception 'media_assets_grants_invalid';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.reserve_media_upload(uuid,text,bigint,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.reserve_media_upload(uuid,text,bigint,text)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.claim_media_cleanup_jobs(integer,integer)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.claim_media_cleanup_jobs(integer,integer)',
       'execute'
     ) then
    raise exception 'media_lifecycle_function_grants_invalid';
  end if;

  v_reserve_def := lower(pg_get_functiondef(
    'public.reserve_media_upload(uuid,text,bigint,text)'::regprocedure
  ));
  if position('for update' in v_reserve_def) = 0
     or position('tenant_modules' in v_reserve_def) = 0 then
    raise exception 'media_quota_serialization_lock_missing';
  end if;

  v_fk_guard_def := lower(pg_get_functiondef(
    'private.publish_referenced_media()'::regprocedure
  ));
  v_url_guard_def := lower(pg_get_functiondef(
    'private.guard_media_url_reference()'::regprocedure
  ));
  v_json_guard_def := lower(pg_get_functiondef(
    'private.guard_media_json_references()'::regprocedure
  ));
  if position('for update' in v_fk_guard_def) = 0
     or position('for update' in v_url_guard_def) = 0
     or position('for update' in v_json_guard_def) = 0 then
    raise exception 'media_reference_serialization_lock_missing';
  end if;
end
$$;

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('92920000-0000-0000-0000-000000000001', 'goal92-media-a', 'Goal 92 Media A', 'active'),
  ('92920000-0000-0000-0000-000000000002', 'goal92-media-b', 'Goal 92 Media B', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.roles (id, tenant_id, name, level) values
  ('92920000-0000-0000-0000-000000000011', '92920000-0000-0000-0000-000000000001', 'owner', 6),
  ('92920000-0000-0000-0000-000000000012', '92920000-0000-0000-0000-000000000001', 'staff', 3),
  ('92920000-0000-0000-0000-000000000013', '92920000-0000-0000-0000-000000000002', 'owner', 6),
  ('92920000-0000-0000-0000-000000000014', '92920000-0000-0000-0000-000000000001', 'customer', 2);

insert into auth.users (id, email) values
  ('92920000-0000-0000-0000-000000000021', 'goal92-media-owner-a@example.test'),
  ('92920000-0000-0000-0000-000000000022', 'goal92-media-staff-a@example.test'),
  ('92920000-0000-0000-0000-000000000023', 'goal92-media-owner-b@example.test'),
  ('92920000-0000-0000-0000-000000000024', 'goal92-media-customer-a@example.test');

insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  (
    '92920000-0000-0000-0000-000000000021',
    '92920000-0000-0000-0000-000000000001',
    'goal92-media-owner-a@example.test',
    '92920000-0000-0000-0000-000000000011',
    'organization',
    'active'
  ),
  (
    '92920000-0000-0000-0000-000000000022',
    '92920000-0000-0000-0000-000000000001',
    'goal92-media-staff-a@example.test',
    '92920000-0000-0000-0000-000000000012',
    'organization',
    'active'
  ),
  (
    '92920000-0000-0000-0000-000000000023',
    '92920000-0000-0000-0000-000000000002',
    'goal92-media-owner-b@example.test',
    '92920000-0000-0000-0000-000000000013',
    'organization',
    'active'
  ),
  (
    '92920000-0000-0000-0000-000000000024',
    '92920000-0000-0000-0000-000000000001',
    'goal92-media-customer-a@example.test',
    '92920000-0000-0000-0000-000000000014',
    'organization',
    'active'
  );

-- Media RBAC needs a real active staff identity. The unrelated booking-readiness
-- trigger is bypassed only for this isolated fixture.
alter table public.staff disable trigger trg_staff_activation_readiness;
insert into public.staff (id, tenant_id, profile_id, active)
values (
  '92920000-0000-0000-0000-000000000031',
  '92920000-0000-0000-0000-000000000001',
  '92920000-0000-0000-0000-000000000022',
  true
);
alter table public.staff enable trigger trg_staff_activation_readiness;

-- Fixture setup bypasses Goal 87's transition trigger only while creating the
-- already-live module rows that this lifecycle test needs.
alter table public.tenant_modules disable trigger trg_tenant_modules_state_guard;
insert into public.tenant_modules (tenant_id, module_key, state, config)
values
  (
    '92920000-0000-0000-0000-000000000001',
    'media_library',
    'live',
    '{"quota_bytes":100}'::jsonb
  ),
  (
    '92920000-0000-0000-0000-000000000002',
    'media_library',
    'live',
    '{"quota_bytes":100}'::jsonb
  )
on conflict (tenant_id, module_key) do update
set state = excluded.state,
    config = excluded.config;
alter table public.tenant_modules enable trigger trg_tenant_modules_state_guard;

-- Tenant A owner: reserve, same-tenant dedupe, finalize CAS and quota.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_asset uuid;
  v_retry uuid;
  v_outcome text;
begin
  begin
    insert into public.media_assets (tenant_id, r2_key, url)
    values (
      '92920000-0000-0000-0000-000000000001',
      'goal92/direct-write',
      'https://cdn.example.test/direct-write'
    );
    raise exception 'direct_media_insert_succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform *
      from public.reserve_media_upload(
        '92920000-0000-0000-0000-000000000002',
        repeat('a', 64),
        60,
        'upload'
      );
    raise exception 'cross_tenant_media_reserve_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'media_access_denied' then raise; end if;
  end;

  select r.asset_id, r.outcome
    into v_asset, v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000001',
      repeat('a', 64),
      60,
      'upload'
    ) r;
  if v_outcome <> 'reserved' then
    raise exception 'media_reserve_outcome_invalid';
  end if;

  select r.asset_id, r.outcome
    into v_retry, v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000001',
      repeat('a', 64),
      60,
      'upload'
    ) r;
  if v_retry <> v_asset or v_outcome <> 'duplicate_pending' then
    raise exception 'media_pending_dedupe_not_idempotent';
  end if;

  begin
    perform *
      from public.finalize_media_upload(
        '92920000-0000-0000-0000-000000000001',
        v_asset,
        'https://cdn.example.test/media/a',
        jsonb_build_object(
          'thumb', 'https://cdn.example.test/media/a',
          'card', 'https://cdn.example.test/media/a'
        ),
        false
      );
    raise exception 'invalid_media_variants_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'media_variants_invalid' then raise; end if;
  end;

  select f.outcome
    into v_outcome
    from public.finalize_media_upload(
      '92920000-0000-0000-0000-000000000001',
      v_asset,
      'https://cdn.example.test/media/a',
      jsonb_build_object(
        'thumb', 'https://cdn.example.test/media/a',
        'card', 'https://cdn.example.test/media/a',
        'hero', 'https://cdn.example.test/media/a'
      ),
      false
    ) f;
  if v_outcome <> 'finalized' then
    raise exception 'media_finalize_outcome_invalid';
  end if;

  select f.outcome
    into v_outcome
    from public.finalize_media_upload(
      '92920000-0000-0000-0000-000000000001',
      v_asset,
      'https://cdn.example.test/media/a',
      jsonb_build_object(
        'thumb', 'https://cdn.example.test/media/a',
        'card', 'https://cdn.example.test/media/a',
        'hero', 'https://cdn.example.test/media/a'
      ),
      false
    ) f;
  if v_outcome <> 'already_ready' then
    raise exception 'media_finalize_retry_not_idempotent';
  end if;

  begin
    perform *
      from public.finalize_media_upload(
        '92920000-0000-0000-0000-000000000001',
        v_asset,
        'https://cdn.example.test/media/changed',
        jsonb_build_object(
          'thumb', 'https://cdn.example.test/media/changed',
          'card', 'https://cdn.example.test/media/changed',
          'hero', 'https://cdn.example.test/media/changed'
        ),
        false
      );
    raise exception 'media_finalize_cas_mismatch_succeeded';
  exception when serialization_failure then
    if sqlerrm <> 'media_finalize_conflict' then raise; end if;
  end;

  -- This sequential outcome is the established equivalent of two waiters after
  -- the function-level tenant_modules FOR UPDATE lock: 60 + 50 must never fit 100.
  begin
    perform *
      from public.reserve_media_upload(
        '92920000-0000-0000-0000-000000000001',
        repeat('b', 64),
        50,
        'upload'
      );
    raise exception 'media_quota_exceeded_reserve_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'media_quota_exceeded' then raise; end if;
  end;

  select r.asset_id, r.outcome
    into v_asset, v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000001',
      repeat('c', 64),
      40,
      'upload'
    ) r;
  if v_outcome <> 'reserved' then
    raise exception 'media_exact_quota_reserve_failed';
  end if;

  select f.outcome
    into v_outcome
    from public.finalize_media_upload(
      '92920000-0000-0000-0000-000000000001',
      v_asset,
      'https://cdn.example.test/media/c',
      jsonb_build_object(
        'thumb', 'https://cdn.example.test/media/c',
        'card', 'https://cdn.example.test/media/c',
        'hero', 'https://cdn.example.test/media/c'
      ),
      false
    ) f;
  if v_outcome <> 'finalized' then
    raise exception 'media_delete_fixture_finalize_failed';
  end if;
end
$$;

reset role;

-- Tenant B owner: identical bytes are valid in a different tenant.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000002","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_asset uuid;
  v_published boolean;
  v_outcome text;
begin
  select r.asset_id, r.outcome
    into v_asset, v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000002',
      repeat('a', 64),
      60,
      'upload'
    ) r;
  if v_outcome <> 'reserved' then
    raise exception 'cross_tenant_same_hash_rejected';
  end if;

  select f.outcome
    into v_outcome
    from public.finalize_media_upload(
      '92920000-0000-0000-0000-000000000002',
      v_asset,
      'https://cdn.example.test/media/b-draft',
      jsonb_build_object(
        'thumb', 'https://cdn.example.test/media/b-draft',
        'card', 'https://cdn.example.test/media/b-draft',
        'hero', 'https://cdn.example.test/media/b-draft'
      ),
      false
    ) f;
  if v_outcome <> 'finalized' then
    raise exception 'private_media_finalize_failed';
  end if;

  select r.published, r.outcome
    into v_published, v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000002',
      repeat('a', 64),
      60,
      'upload'
    ) r;
  if v_outcome <> 'duplicate_ready' or v_published then
    raise exception 'private_duplicate_publication_state_invalid';
  end if;

  begin
    perform *
      from public.finalize_media_upload(
        '92920000-0000-0000-0000-000000000002',
        v_asset,
        'https://cdn.example.test/media/b-draft',
        jsonb_build_object(
          'thumb', 'https://cdn.example.test/media/b-draft',
          'card', 'https://cdn.example.test/media/b-draft',
          'hero', 'https://cdn.example.test/media/b-draft'
        ),
        true
      );
    raise exception 'unreferenced_media_publication_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'media_publication_requires_reference' then raise; end if;
  end;

  select r.outcome
    into v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000002',
      repeat('f', 64),
      40,
      'upload'
    ) r;
  if v_outcome <> 'reserved' then
    raise exception 'module_gate_pending_fixture_failed';
  end if;
end
$$;

reset role;

-- An inactive consumer may lock and retain a ready asset, but publication starts
-- only when that consumer becomes part of the public storefront.
insert into public.gallery_items (
  id,
  tenant_id,
  asset_id,
  alt_override,
  decorative,
  sort_order,
  active
)
select
  '92920000-0000-0000-0000-000000000109',
  '92920000-0000-0000-0000-000000000002',
  m.id,
  'Inactive publication probe',
  false,
  92,
  false
from public.media_assets m
where m.tenant_id = '92920000-0000-0000-0000-000000000002'
  and m.content_hash = repeat('a', 64);

do $$
begin
  if exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000002'
       and content_hash = repeat('a', 64)
       and published
  ) then
    raise exception 'inactive_media_reference_published';
  end if;
end
$$;

update public.gallery_items
   set active = true
 where id = '92920000-0000-0000-0000-000000000109';

do $$
begin
  if not exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000002'
       and content_hash = repeat('a', 64)
       and published
  ) then
    raise exception 'activated_media_reference_not_published';
  end if;
end
$$;

-- Finalize still requires an active writable module; cleanup-cancel deliberately
-- remains available after the module closes so a pending reservation cannot leak.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.tenant_modules
   set state = 'paused'
 where tenant_id = '92920000-0000-0000-0000-000000000002'
   and module_key = 'media_library';

select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000002","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_asset uuid;
  v_outcome text;
begin
  select id
    into v_asset
    from public.media_assets
   where tenant_id = '92920000-0000-0000-0000-000000000002'
     and content_hash = repeat('f', 64);

  begin
    perform *
      from public.finalize_media_upload(
        '92920000-0000-0000-0000-000000000002',
        v_asset,
        'https://cdn.example.test/media/module-closed',
        jsonb_build_object(
          'thumb', 'https://cdn.example.test/media/module-closed',
          'card', 'https://cdn.example.test/media/module-closed',
          'hero', 'https://cdn.example.test/media/module-closed'
        ),
        false
      );
    raise exception 'paused_module_finalize_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'media_module_read_only' then raise; end if;
  end;

  select c.outcome
    into v_outcome
    from public.cancel_media_upload(
      '92920000-0000-0000-0000-000000000002',
      v_asset,
      'module_closed_before_finalize',
      false
    ) c;
  if v_outcome <> 'cancelled' then
    raise exception 'paused_module_cleanup_cancel_failed';
  end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.tenant_modules
   set state = 'live'
 where tenant_id = '92920000-0000-0000-0000-000000000002'
   and module_key = 'media_library';

-- A library upload is ready but private until a content row explicitly selects it.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000002","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
declare
  v_asset uuid;
begin
  select r.asset_id
    into v_asset
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000002',
      repeat('9', 64),
      1,
      'upload'
    ) r;
  perform *
    from public.finalize_media_upload(
      '92920000-0000-0000-0000-000000000002',
      v_asset,
      'https://cdn.example.test/media/private-library',
      jsonb_build_object(
        'thumb', 'https://cdn.example.test/media/private-library',
        'card', 'https://cdn.example.test/media/private-library',
        'hero', 'https://cdn.example.test/media/private-library'
      ),
      false
    );
end
$$;
reset role;

-- Staff cannot mutate media even inside its own tenant.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000022', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000022","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform *
      from public.reserve_media_upload(
        '92920000-0000-0000-0000-000000000001',
        repeat('d', 64),
        1,
        'upload'
      );
    raise exception 'staff_media_reserve_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'media_access_denied' then raise; end if;
  end;

  if exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
       and not published
  ) then
    raise exception 'staff_private_media_read_succeeded';
  end if;
end
$$;

reset role;

-- A customer session is authenticated but has no administrative media-library
-- visibility. Public ready assets remain readable through the public branch.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000024', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000024","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  if exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
       and not published
  ) then
    raise exception 'customer_private_media_read_succeeded';
  end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

-- A draft blog post may reference ready media without making it anonymous-readable.
insert into public.blog_posts (
  id,
  tenant_id,
  title,
  slug,
  cover_asset_id,
  status
)
select
  '92920000-0000-0000-0000-000000000111',
  '92920000-0000-0000-0000-000000000001',
  'Goal 92 private draft',
  'goal-92-private-draft',
  m.id,
  'draft'
from public.media_assets m
where m.tenant_id = '92920000-0000-0000-0000-000000000001'
  and m.content_hash = repeat('a', 64);

do $$
begin
  if exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
       and content_hash = repeat('a', 64)
       and published
  ) then
    raise exception 'draft_blog_media_published';
  end if;
end
$$;

-- Make the first ready asset referenced; lifecycle deletion must preserve Goal 90 RESTRICT.
insert into public.gallery_items (
  id,
  tenant_id,
  asset_id,
  alt_override,
  decorative,
  sort_order
)
select
  '92920000-0000-0000-0000-000000000101',
  '92920000-0000-0000-0000-000000000001',
  m.id,
  'Goal 92 reference',
  false,
  0
from public.media_assets m
where m.tenant_id = '92920000-0000-0000-0000-000000000001'
  and m.content_hash = repeat('a', 64);

-- Authenticated low-role sessions retain public parity without gaining private rows.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000024', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000024","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
begin
  if (
    select count(*)
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
  ) <> 1 then
    raise exception 'customer_public_media_read_invalid';
  end if;
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

-- Anonymous users see only explicitly published ready assets.
set local role anon;
do $$
declare
  v_a_count integer;
  v_b_count integer;
begin
  select count(*)
    into v_a_count
    from public.media_assets
   where tenant_id = '92920000-0000-0000-0000-000000000001';
  select count(*)
    into v_b_count
    from public.media_assets
   where tenant_id = '92920000-0000-0000-0000-000000000002';
  if v_a_count <> 1 or v_b_count <> 1 then
    raise exception 'media_public_rls_invalid';
  end if;
end
$$;
reset role;

-- Selecting the private library asset is the explicit publication event.
insert into public.gallery_items (
  id,
  tenant_id,
  asset_id,
  alt_override,
  decorative,
  sort_order
)
select
  '92920000-0000-0000-0000-000000000102',
  '92920000-0000-0000-0000-000000000002',
  m.id,
  'Explicitly published library asset',
  false,
  0
from public.media_assets m
where m.tenant_id = '92920000-0000-0000-0000-000000000002'
  and m.content_hash = repeat('9', 64);

do $$
begin
  if not exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000002'
       and content_hash = repeat('9', 64)
       and status = 'ready'
       and published
  ) then
    raise exception 'media_reference_did_not_publish_asset';
  end if;
end
$$;

set local role anon;
do $$
begin
  if (
    select count(*)
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000002'
  ) <> 2 then
    raise exception 'explicit_media_publication_rls_invalid';
  end if;
end
$$;
reset role;

-- Owner delete: referenced rows reject; unreferenced rows enqueue idempotently.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_asset uuid;
  v_outcome text;
begin
  select id
    into v_asset
    from public.media_assets
   where tenant_id = '92920000-0000-0000-0000-000000000001'
     and content_hash = repeat('a', 64);
  begin
    perform *
      from public.request_media_delete(
        '92920000-0000-0000-0000-000000000001',
        v_asset
      );
    raise exception 'referenced_media_lifecycle_delete_succeeded';
  exception when foreign_key_violation then
    if sqlerrm <> 'media_asset_in_use' then raise; end if;
  end;

  select id
    into v_asset
    from public.media_assets
   where tenant_id = '92920000-0000-0000-0000-000000000001'
     and content_hash = repeat('c', 64);
  select d.outcome
    into v_outcome
    from public.request_media_delete(
      '92920000-0000-0000-0000-000000000001',
      v_asset
    ) d;
  if v_outcome <> 'delete_queued' then
    raise exception 'media_delete_not_queued';
  end if;

  select d.outcome
    into v_outcome
    from public.request_media_delete(
      '92920000-0000-0000-0000-000000000001',
      v_asset
    ) d;
  if v_outcome <> 'already_deleting' then
    raise exception 'media_delete_retry_not_idempotent';
  end if;

  begin
    update public.media_assets
       set alt = 'bypass'
     where id = v_asset;
    raise exception 'direct_media_update_succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

-- First cleanup attempt fails: CAS rejects a wrong lease and durable retry exposes delete_failed.
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_job uuid;
  v_lease uuid;
  v_ok boolean;
begin
  select c.job_id, c.lease_token
    into v_job, v_lease
    from public.claim_media_cleanup_jobs(1, 60) c;
  if v_job is null or v_lease is null then
    raise exception 'media_cleanup_claim_missing';
  end if;

  select public.complete_media_cleanup_job(v_job, gen_random_uuid())
    into v_ok;
  if v_ok then
    raise exception 'media_cleanup_wrong_lease_acked';
  end if;

  select public.retry_media_cleanup_job(v_job, v_lease, 'r2 unavailable', 0)
    into v_ok;
  if not v_ok then
    raise exception 'media_cleanup_retry_cas_failed';
  end if;
end
$$;

reset role;

-- Owner can explicitly retry a failed delete; the active hash remains reserved meanwhile.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_asset uuid;
  v_outcome text;
begin
  select id
    into v_asset
    from public.media_assets
   where tenant_id = '92920000-0000-0000-0000-000000000001'
     and content_hash = repeat('c', 64);

  select r.outcome
    into v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000001',
      repeat('c', 64),
      40,
      'upload'
    ) r;
  if v_outcome <> 'duplicate_delete_failed' then
    raise exception 'delete_failed_hash_not_reserved';
  end if;

  select d.outcome
    into v_outcome
    from public.request_media_delete(
      '92920000-0000-0000-0000-000000000001',
      v_asset
    ) d;
  if v_outcome <> 'delete_retried' then
    raise exception 'media_delete_failed_not_retryable';
  end if;
end
$$;

reset role;

-- Second cleanup attempt succeeds and releases both visibility and quota/hash reservation.
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_job uuid;
  v_lease uuid;
  v_ok boolean;
begin
  select c.job_id, c.lease_token
    into v_job, v_lease
    from public.claim_media_cleanup_jobs(1, 60) c;
  select public.complete_media_cleanup_job(v_job, v_lease)
    into v_ok;
  if not v_ok then
    raise exception 'media_cleanup_completion_failed';
  end if;
end
$$;

reset role;

select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_asset uuid;
  v_outcome text;
begin
  select r.asset_id, r.outcome
    into v_asset, v_outcome
    from public.reserve_media_upload(
      '92920000-0000-0000-0000-000000000001',
      repeat('e', 64),
      40,
      'upload'
    ) r;
  if v_outcome <> 'reserved' then
    raise exception 'deleted_media_quota_not_released';
  end if;

  select c.outcome
    into v_outcome
    from public.cancel_media_upload(
      '92920000-0000-0000-0000-000000000001',
      v_asset,
      'r2 upload failed',
      false
    ) c;
  if v_outcome <> 'cancelled' then
    raise exception 'media_upload_cancel_failed';
  end if;

  select c.outcome
    into v_outcome
    from public.cancel_media_upload(
      '92920000-0000-0000-0000-000000000001',
      v_asset,
      'r2 upload failed',
      false
    ) c;
  if v_outcome <> 'already_deleted' then
    raise exception 'media_upload_cancel_retry_not_idempotent';
  end if;
end
$$;

reset role;

-- Deleted/delete_failed/deleting rows never leak through public RLS.
set local role anon;
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from public.media_assets
   where tenant_id = '92920000-0000-0000-0000-000000000001';
  if v_count <> 1 then
    raise exception 'deleted_media_public_visibility_invalid';
  end if;
end
$$;
reset role;

-- A lost client response may leave an uncertain R2 put behind a pending row.
-- The durable worker must reap an expired reservation without client help.
insert into public.media_assets (
  id,
  tenant_id,
  r2_key,
  url,
  type,
  size_bytes,
  source,
  content_hash,
  status,
  published,
  variants,
  reserved_at
) values (
  '92920000-0000-0000-0000-000000000051',
  '92920000-0000-0000-0000-000000000001',
  'media/92920000-0000-0000-0000-000000000001/92920000-0000-0000-0000-000000000051',
  null,
  'image',
  1,
  'upload',
  repeat('5', 64),
  'pending',
  false,
  '{}'::jsonb,
  now() - interval '31 minutes'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  v_job uuid;
  v_lease uuid;
  v_ok boolean;
begin
  select c.job_id, c.lease_token
    into v_job, v_lease
    from public.claim_media_cleanup_jobs(10, 60) c
   where c.asset_id = '92920000-0000-0000-0000-000000000051';
  if v_job is null or v_lease is null then
    raise exception 'expired_media_reservation_not_reaped';
  end if;
  select public.complete_media_cleanup_job(v_job, v_lease) into v_ok;
  if not v_ok then
    raise exception 'expired_media_reservation_cleanup_failed';
  end if;
end
$$;
reset role;

-- URL-backed storefront references are lifecycle references too. Deleting the
-- library row must not break branding JSON, a staff avatar or revision history.
select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
declare
  v_hash text;
  v_asset uuid;
begin
  foreach v_hash in array array[
    repeat('d', 64),
    repeat('7', 64),
    repeat('8', 64),
    repeat('6', 64)
  ]
  loop
    select r.asset_id
      into v_asset
      from public.reserve_media_upload(
        '92920000-0000-0000-0000-000000000001',
        v_hash,
        1,
        'sajtbyggare'
      ) r;
    perform *
      from public.finalize_media_upload(
        '92920000-0000-0000-0000-000000000001',
        v_asset,
        'https://cdn.example.test/media/' || left(v_hash, 1),
        jsonb_build_object(
          'thumb', 'https://cdn.example.test/media/' || left(v_hash, 1),
          'card', 'https://cdn.example.test/media/' || left(v_hash, 1),
          'hero', 'https://cdn.example.test/media/' || left(v_hash, 1)
        ),
        false
      );
  end loop;
end
$$;
reset role;

insert into public.tenant_settings (tenant_id, branding)
values (
  '92920000-0000-0000-0000-000000000001',
  '{"logo_url":"https://cdn.example.test/media/d"}'::jsonb
)
on conflict (tenant_id) do update set branding = excluded.branding;

update public.staff
   set show_on_site = false
 where id = '92920000-0000-0000-0000-000000000031'
   and tenant_id = '92920000-0000-0000-0000-000000000001';

update public.staff
   set avatar_url = 'https://cdn.example.test/media/7'
 where id = '92920000-0000-0000-0000-000000000031'
   and tenant_id = '92920000-0000-0000-0000-000000000001';

insert into public.services (
  id,
  tenant_id,
  name,
  duration_min,
  price_cents,
  active,
  image_url
) values (
  '92920000-0000-0000-0000-000000000032',
  '92920000-0000-0000-0000-000000000001',
  'Goal 92 media fixture',
  30,
  10000,
  false,
  'https://cdn.example.test/media/6'
);

insert into public.site_revisions (
  id,
  tenant_id,
  status,
  snapshot,
  created_by,
  published_by,
  published_at
) values (
  '92920000-0000-0000-0000-000000000041',
  '92920000-0000-0000-0000-000000000001',
  'draft',
  '{"branding":{"about_image":"https://cdn.example.test/media/8"}}'::jsonb,
  '92920000-0000-0000-0000-000000000021',
  null,
  null
);

do $$
begin
  if not exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
       and content_hash = repeat('d', 64)
       and published
  ) then
    raise exception 'live_branding_media_not_published';
  end if;
  if exists (
    select 1
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
       and content_hash in (repeat('7', 64), repeat('8', 64), repeat('6', 64))
       and published
  ) then
    raise exception 'inactive_url_media_published';
  end if;
end
$$;

update public.staff
   set show_on_site = true
 where id = '92920000-0000-0000-0000-000000000031'
   and tenant_id = '92920000-0000-0000-0000-000000000001';

update public.services
   set active = true
 where id = '92920000-0000-0000-0000-000000000032'
   and tenant_id = '92920000-0000-0000-0000-000000000001';

update public.site_revisions
   set status = 'published',
       published_by = '92920000-0000-0000-0000-000000000021',
       published_at = now()
 where id = '92920000-0000-0000-0000-000000000041';

do $$
begin
  if (
    select count(*)
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
       and content_hash in (repeat('d', 64), repeat('7', 64), repeat('8', 64), repeat('6', 64))
       and published
  ) <> 4 then
    raise exception 'activated_url_media_not_published';
  end if;
end
$$;

set local role authenticated;
do $$
declare
  v_hash text;
  v_asset uuid;
begin
  foreach v_hash in array array[
    repeat('d', 64),
    repeat('7', 64),
    repeat('8', 64),
    repeat('6', 64)
  ]
  loop
    select id
      into v_asset
      from public.media_assets
     where tenant_id = '92920000-0000-0000-0000-000000000001'
       and content_hash = v_hash;
    begin
      perform *
        from public.request_media_delete(
          '92920000-0000-0000-0000-000000000001',
          v_asset
        );
      raise exception 'url_referenced_media_delete_succeeded';
    exception when foreign_key_violation then
      if sqlerrm <> 'media_asset_in_use' then raise; end if;
    end;
  end loop;
end
$$;
reset role;

-- URL writers and deletion serialize on the same media row. Once deletion owns
-- the row, a late reference must fail closed instead of resurrecting a dead URL.
insert into public.media_assets (
  id,
  tenant_id,
  r2_key,
  url,
  type,
  size_bytes,
  source,
  content_hash,
  status,
  published,
  variants
) values (
  '92920000-0000-0000-0000-000000000052',
  '92920000-0000-0000-0000-000000000001',
  'media/92920000-0000-0000-0000-000000000001/92920000-0000-0000-0000-000000000052',
  'https://cdn.example.test/media/locked-for-delete',
  'image',
  1,
  'upload',
  repeat('2', 64),
  'deleting',
  false,
  jsonb_build_object(
    'thumb', 'https://cdn.example.test/media/locked-for-delete',
    'card', 'https://cdn.example.test/media/locked-for-delete',
    'hero', 'https://cdn.example.test/media/locked-for-delete'
  )
);

select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
begin
  begin
    update public.services
       set image_url = 'https://cdn.example.test/media/c'
     where id = '92920000-0000-0000-0000-000000000032'
       and tenant_id = '92920000-0000-0000-0000-000000000001';
    raise exception 'deleted_media_url_reference_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'media_reference_requires_ready' then raise; end if;
  end;

  begin
    update public.services
       set image_url = 'https://cdn.example.test/media/locked-for-delete'
     where id = '92920000-0000-0000-0000-000000000032'
       and tenant_id = '92920000-0000-0000-0000-000000000001';
    raise exception 'nonready_media_url_reference_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'media_reference_requires_ready' then raise; end if;
  end;
end
$$;
reset role;

-- A pending/failed upload has no public URL. JSON nulls are not references and
-- must not block the owner's durable cleanup retry.
insert into public.media_assets (
  id,
  tenant_id,
  r2_key,
  url,
  type,
  size_bytes,
  source,
  content_hash,
  status,
  published,
  variants,
  last_error
) values (
  '92920000-0000-0000-0000-000000000053',
  '92920000-0000-0000-0000-000000000001',
  'media/92920000-0000-0000-0000-000000000001/92920000-0000-0000-0000-000000000053',
  null,
  'image',
  1,
  'upload',
  repeat('1', 64),
  'delete_failed',
  false,
  '{}'::jsonb,
  'uncertain_put'
);

update public.tenant_settings
   set branding = jsonb_set(branding, '{goal92_null_probe}', 'null'::jsonb, true)
 where tenant_id = '92920000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '92920000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"92920000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"92920000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$
declare
  v_outcome text;
begin
  select d.outcome
    into v_outcome
    from public.request_media_delete(
      '92920000-0000-0000-0000-000000000001',
      '92920000-0000-0000-0000-000000000053'
    ) d;
  if v_outcome <> 'delete_retried' then
    raise exception 'null_url_cleanup_retry_invalid';
  end if;
end
$$;
reset role;

select 'goal92_media_quota_ok' as result;

rollback;
