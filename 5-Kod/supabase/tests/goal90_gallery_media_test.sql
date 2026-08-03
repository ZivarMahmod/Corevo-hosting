-- Goal 90 runtime: tenant-bound media, explicit image semantics and atomic
-- complete-set gallery order. All fixtures and mutations are rolled back.
begin;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

do $$
declare
  v_constraints text[] := array[
    'blog_posts_asset_tenant_fkey',
    'content_slots_asset_tenant_fkey',
    'gallery_items_asset_tenant_fkey',
    'shop_products_asset_tenant_fkey',
    'shop_product_variants_asset_tenant_fkey'
  ];
begin
  if (
    select count(*)
      from pg_catalog.pg_constraint c
     where c.conname = any(v_constraints)
       and c.confdeltype = 'r'
       and pg_catalog.array_length(c.conkey, 1) = 2
       and c.convalidated
  ) <> 5 then
    raise exception 'media_tenant_restrict_constraints_invalid';
  end if;

  if to_regclass('public.media_assets_id_tenant_unique') is null
     or to_regclass('public.blog_posts_asset_tenant_idx') is null
     or to_regclass('public.content_slots_asset_tenant_idx') is null
     or to_regclass('public.gallery_items_asset_tenant_idx') is null
     or to_regclass('public.shop_products_asset_tenant_idx') is null
     or to_regclass('public.shop_product_variants_asset_tenant_idx') is null
     or not has_function_privilege(
       'authenticated',
       'public.reorder_gallery_items(uuid,uuid[])',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.reorder_gallery_items(uuid,uuid[])',
       'execute'
     ) then
    raise exception 'gallery_contract_or_grants_invalid';
  end if;
end
$$;

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('90910000-0000-0000-0000-000000000001', 'goal90-gallery-a', 'Goal 90 Gallery A', 'active'),
  ('90910000-0000-0000-0000-000000000002', 'goal90-gallery-b', 'Goal 90 Gallery B', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.roles (id, tenant_id, name, level) values
  ('90910000-0000-0000-0000-000000000011', '90910000-0000-0000-0000-000000000001', 'salon_admin', 6),
  ('90910000-0000-0000-0000-000000000012', '90910000-0000-0000-0000-000000000001', 'staff', 3);

insert into auth.users (id, email) values
  ('90910000-0000-0000-0000-000000000021', 'goal90-gallery-owner@example.test'),
  ('90910000-0000-0000-0000-000000000022', 'goal90-gallery-staff@example.test'),
  ('90910000-0000-0000-0000-000000000023', 'goal90-gallery-platform@example.test');

insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('90910000-0000-0000-0000-000000000021', '90910000-0000-0000-0000-000000000001', 'goal90-gallery-owner@example.test', '90910000-0000-0000-0000-000000000011', 'organization', 'active'),
  ('90910000-0000-0000-0000-000000000022', '90910000-0000-0000-0000-000000000001', 'goal90-gallery-staff@example.test', '90910000-0000-0000-0000-000000000012', 'organization', 'active');

insert into public.users (id, tenant_id, email, role_id, access_scope, status)
select
  '90910000-0000-0000-0000-000000000023',
  null,
  'goal90-gallery-platform@example.test',
  r.id,
  'organization',
  'active'
from public.roles r
where r.tenant_id is null
  and r.name = 'super_admin';

do $$
begin
  if not exists (
    select 1
      from public.users
     where id = '90910000-0000-0000-0000-000000000023'
  ) then
    raise exception 'platform_gallery_fixture_missing';
  end if;
end
$$;

insert into public.tenant_modules (tenant_id, module_key, state, config) values
  ('90910000-0000-0000-0000-000000000001', 'galleri', 'off', '{}'),
  ('90910000-0000-0000-0000-000000000002', 'galleri', 'off', '{}');
update public.tenant_modules
   set state = 'draft'
 where module_key = 'galleri'
   and tenant_id in (
     '90910000-0000-0000-0000-000000000001',
     '90910000-0000-0000-0000-000000000002'
   );
update public.tenant_modules
   set state = 'live'
 where module_key = 'galleri'
   and tenant_id in (
     '90910000-0000-0000-0000-000000000001',
     '90910000-0000-0000-0000-000000000002'
   );

insert into public.media_assets (id, tenant_id, r2_key, url, alt) values
  ('90910000-0000-0000-0000-000000000101', '90910000-0000-0000-0000-000000000001', 'goal90/a-1', 'https://example.test/a-1.jpg', 'Global text 1'),
  ('90910000-0000-0000-0000-000000000102', '90910000-0000-0000-0000-000000000001', 'goal90/a-2', 'https://example.test/a-2.jpg', 'Global text 2'),
  ('90910000-0000-0000-0000-000000000103', '90910000-0000-0000-0000-000000000001', 'goal90/a-3', 'https://example.test/a-3.jpg', null),
  ('90910000-0000-0000-0000-000000000104', '90910000-0000-0000-0000-000000000001', 'goal90/a-4', 'https://example.test/a-4.jpg', null),
  ('90910000-0000-0000-0000-000000000105', '90910000-0000-0000-0000-000000000001', 'goal90/a-unused', 'https://example.test/a-unused.jpg', null),
  ('90910000-0000-0000-0000-000000000201', '90910000-0000-0000-0000-000000000002', 'goal90/b-1', 'https://example.test/b-1.jpg', null);

update public.media_assets
   set status = 'ready',
       variants = jsonb_build_object('thumb', url, 'card', url, 'hero', url),
       lifecycle_version = 1
 where id between '90910000-0000-0000-0000-000000000101'
              and '90910000-0000-0000-0000-000000000201';

insert into public.gallery_items (
  id, tenant_id, asset_id, alt_override, decorative, sort_order
) values
  ('90910000-0000-0000-0000-000000000301', '90910000-0000-0000-0000-000000000001', '90910000-0000-0000-0000-000000000101', 'Kontextuell text 1', false, 0),
  ('90910000-0000-0000-0000-000000000302', '90910000-0000-0000-0000-000000000001', '90910000-0000-0000-0000-000000000102', 'Kontextuell text 2', false, 1),
  ('90910000-0000-0000-0000-000000000303', '90910000-0000-0000-0000-000000000001', '90910000-0000-0000-0000-000000000103', null, true, 2),
  ('90910000-0000-0000-0000-000000000401', '90910000-0000-0000-0000-000000000002', '90910000-0000-0000-0000-000000000201', 'Tenant B', false, 0);

do $$
begin
  begin
    insert into public.gallery_items (
      tenant_id, asset_id, alt_override, decorative, sort_order
    ) values (
      '90910000-0000-0000-0000-000000000001',
      '90910000-0000-0000-0000-000000000201',
      'Fel tenant',
      false,
      10
    );
    raise exception 'cross_tenant_asset_succeeded';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.gallery_items (
      tenant_id, asset_id, alt_override, decorative, sort_order
    ) values (
      '90910000-0000-0000-0000-000000000001',
      '90910000-0000-0000-0000-000000000105',
      null,
      false,
      10
    );
    raise exception 'missing_contextual_alt_succeeded';
  exception when check_violation then null;
  end;

  begin
    insert into public.gallery_items (
      tenant_id, asset_id, alt_override, decorative, sort_order
    ) values (
      '90910000-0000-0000-0000-000000000001',
      '90910000-0000-0000-0000-000000000105',
      'Dekorativ ska sakna text',
      true,
      10
    );
    raise exception 'decorative_alt_conflict_succeeded';
  exception when check_violation then null;
  end;

  begin
    delete from public.media_assets
     where id = '90910000-0000-0000-0000-000000000101';
    raise exception 'referenced_media_delete_succeeded';
  exception when foreign_key_violation then null;
  end;
end
$$;

select set_config('request.jwt.claim.sub', '90910000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90910000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"90910000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_outcome text;
  v_count integer;
begin
  begin
    update public.gallery_items
       set sort_order = 7
     where id = '90910000-0000-0000-0000-000000000301';
    raise exception 'direct_gallery_order_write_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'gallery_order_is_db_owned' then raise; end if;
  end;

  insert into public.gallery_items (
    id, tenant_id, asset_id, alt_override, decorative, sort_order
  ) values (
    '90910000-0000-0000-0000-000000000304',
    '90910000-0000-0000-0000-000000000001',
    '90910000-0000-0000-0000-000000000104',
    'Kontextuell text 4',
    false,
    0
  );

  if (
    select sort_order
      from public.gallery_items
     where id = '90910000-0000-0000-0000-000000000304'
  ) <> 3 then
    raise exception 'gallery_append_order_invalid';
  end if;

  select r.outcome, r.item_count
    into v_outcome, v_count
    from public.reorder_gallery_items(
      '90910000-0000-0000-0000-000000000001',
      array[
        '90910000-0000-0000-0000-000000000304',
        '90910000-0000-0000-0000-000000000302',
        '90910000-0000-0000-0000-000000000301',
        '90910000-0000-0000-0000-000000000303'
      ]::uuid[]
    ) r;
  if v_outcome <> 'changed' or v_count <> 4 then
    raise exception 'gallery_reorder_result_invalid';
  end if;

  select r.outcome
    into v_outcome
    from public.reorder_gallery_items(
      '90910000-0000-0000-0000-000000000001',
      array[
        '90910000-0000-0000-0000-000000000304',
        '90910000-0000-0000-0000-000000000302',
        '90910000-0000-0000-0000-000000000301',
        '90910000-0000-0000-0000-000000000303'
      ]::uuid[]
    ) r;
  if v_outcome <> 'already_set' then
    raise exception 'gallery_reorder_retry_not_idempotent';
  end if;

  begin
    perform *
      from public.reorder_gallery_items(
        '90910000-0000-0000-0000-000000000001',
        array[
          '90910000-0000-0000-0000-000000000301',
          '90910000-0000-0000-0000-000000000302'
        ]::uuid[]
      );
    raise exception 'incomplete_gallery_reorder_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'gallery_reorder_incomplete' then raise; end if;
  end;

  begin
    perform *
      from public.reorder_gallery_items(
        '90910000-0000-0000-0000-000000000001',
        array[
          '90910000-0000-0000-0000-000000000301',
          '90910000-0000-0000-0000-000000000301',
          '90910000-0000-0000-0000-000000000302',
          '90910000-0000-0000-0000-000000000303'
        ]::uuid[]
      );
    raise exception 'duplicate_gallery_reorder_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'gallery_reorder_incomplete' then raise; end if;
  end;

  begin
    perform *
      from public.reorder_gallery_items(
        '90910000-0000-0000-0000-000000000002',
        array['90910000-0000-0000-0000-000000000401']::uuid[]
      );
    raise exception 'cross_tenant_gallery_reorder_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'gallery_reorder_access_denied' then raise; end if;
  end;
end
$$;

reset role;

do $$
begin
  if (
    select array_agg(id order by sort_order)
      from public.gallery_items
     where tenant_id = '90910000-0000-0000-0000-000000000001'
  ) is distinct from array[
    '90910000-0000-0000-0000-000000000304',
    '90910000-0000-0000-0000-000000000302',
    '90910000-0000-0000-0000-000000000301',
    '90910000-0000-0000-0000-000000000303'
  ]::uuid[] then
    raise exception 'gallery_order_not_persisted';
  end if;

  if (
    select count(*)
      from public.audit_log
     where tenant_id = '90910000-0000-0000-0000-000000000001'
       and action = 'gallery_items.reordered'
  ) <> 1 then
    raise exception 'gallery_reorder_audit_not_idempotent';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '90910000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90910000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;

select *
from public.reorder_gallery_items(
  '90910000-0000-0000-0000-000000000001',
  array[
    '90910000-0000-0000-0000-000000000301',
    '90910000-0000-0000-0000-000000000302',
    '90910000-0000-0000-0000-000000000303',
    '90910000-0000-0000-0000-000000000304'
  ]::uuid[]
);

reset role;
do $$
begin
  if (
    select count(*)
      from public.audit_log
     where tenant_id = '90910000-0000-0000-0000-000000000001'
       and action = 'gallery_items.reordered'
       and actor_profile_id = '90910000-0000-0000-0000-000000000023'
  ) <> 1 then
    raise exception 'platform_gallery_reorder_not_audited';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '90910000-0000-0000-0000-000000000022', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90910000-0000-0000-0000-000000000022","role":"authenticated","app_metadata":{"tenant_id":"90910000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform *
      from public.reorder_gallery_items(
        '90910000-0000-0000-0000-000000000001',
        array[
          '90910000-0000-0000-0000-000000000304',
          '90910000-0000-0000-0000-000000000302',
          '90910000-0000-0000-0000-000000000301',
          '90910000-0000-0000-0000-000000000303'
        ]::uuid[]
      );
    raise exception 'staff_gallery_reorder_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'gallery_reorder_access_denied' then raise; end if;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.tenant_modules
   set state = 'paused'
 where tenant_id = '90910000-0000-0000-0000-000000000001'
   and module_key = 'galleri';

select set_config('request.jwt.claim.sub', '90910000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90910000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"90910000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform *
      from public.reorder_gallery_items(
        '90910000-0000-0000-0000-000000000001',
        array[
          '90910000-0000-0000-0000-000000000304',
          '90910000-0000-0000-0000-000000000302',
          '90910000-0000-0000-0000-000000000301',
          '90910000-0000-0000-0000-000000000303'
        ]::uuid[]
      );
    raise exception 'paused_gallery_reorder_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'gallery_module_read_only' then raise; end if;
  end;
end
$$;

reset role;
rollback;
