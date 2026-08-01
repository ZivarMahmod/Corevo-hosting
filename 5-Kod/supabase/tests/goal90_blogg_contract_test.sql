-- Goal 90 runtime: tenantunik slug, atomisk status/audit och bevarad historik.
-- Alla fixtures och mutationer rullas tillbaka.
begin;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

-- Dessa två minimala fixtures testar bloggkontraktet, inte hela onboardingens
-- readinessmatris. Triggervakten återställs innan någon Goal 90-assertion körs
-- och hela DDL-ändringen rullas dessutom tillbaka sist.
alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('90000000-0000-0000-0000-000000000001', 'goal90-blog-a', 'Goal 90 Blog A', 'active'),
  ('90000000-0000-0000-0000-000000000002', 'goal90-blog-b', 'Goal 90 Blog B', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.roles (id, tenant_id, name, level) values
  ('90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000001', 'salon_admin', 6),
  ('90000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000001', 'staff', 3);

insert into auth.users (id, email) values
  ('90000000-0000-0000-0000-000000000021', 'goal90-owner@example.test'),
  ('90000000-0000-0000-0000-000000000022', 'goal90-staff@example.test'),
  ('90000000-0000-0000-0000-000000000023', 'goal90-platform@example.test');

insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('90000000-0000-0000-0000-000000000021', '90000000-0000-0000-0000-000000000001', 'goal90-owner@example.test', '90000000-0000-0000-0000-000000000011', 'organization', 'active'),
  ('90000000-0000-0000-0000-000000000022', '90000000-0000-0000-0000-000000000001', 'goal90-staff@example.test', '90000000-0000-0000-0000-000000000012', 'organization', 'active');

insert into public.users (id, tenant_id, email, role_id, access_scope, status)
select
  '90000000-0000-0000-0000-000000000023',
  null,
  'goal90-platform@example.test',
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
     where id = '90000000-0000-0000-0000-000000000023'
  ) then
    raise exception 'platform_blog_fixture_missing';
  end if;
end
$$;

insert into public.tenant_modules (tenant_id, module_key, state, config) values
  ('90000000-0000-0000-0000-000000000001', 'blogg', 'off', '{}'),
  ('90000000-0000-0000-0000-000000000002', 'blogg', 'off', '{}');
update public.tenant_modules
   set state = 'draft'
 where module_key = 'blogg'
   and tenant_id in (
     '90000000-0000-0000-0000-000000000001',
     '90000000-0000-0000-0000-000000000002'
   );

insert into public.blog_posts (id, tenant_id, title, slug, status) values
  ('90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0000-000000000001', 'Första', 'shared-slug', 'draft'),
  ('90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000001', 'Raderbart utkast', 'draft-only', 'draft'),
  ('90000000-0000-0000-0000-000000000103', '90000000-0000-0000-0000-000000000002', 'Samma slug annan tenant', 'SHARED-SLUG', 'draft');

do $$
begin
  begin
    insert into public.blog_posts (tenant_id, title, slug)
    values ('90000000-0000-0000-0000-000000000001', 'Dublett', 'SHARED-SLUG');
    raise exception 'same_tenant_case_insensitive_slug_succeeded';
  exception when unique_violation then null;
  end;

  begin
    insert into public.blog_posts (tenant_id, title, slug)
    values ('90000000-0000-0000-0000-000000000001', 'Tom slug', '   ');
    raise exception 'blank_slug_succeeded';
  exception when check_violation or not_null_violation then null;
  end;
end
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"90000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
declare
  v_first timestamptz;
  v_second timestamptz;
begin
  begin
    update public.blog_posts
       set status = 'published',
           published_at = now()
     where id = '90000000-0000-0000-0000-000000000101';
    raise exception 'direct_blog_lifecycle_write_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'blog_post_lifecycle_is_db_owned' then raise; end if;
  end;

  perform *
  from public.set_blog_post_status(
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000101',
    'published'
  );
  select published_at into v_first
  from public.blog_posts
  where id = '90000000-0000-0000-0000-000000000101';

  perform *
  from public.set_blog_post_status(
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000101',
    'published'
  );
  select published_at into v_second
  from public.blog_posts
  where id = '90000000-0000-0000-0000-000000000101';

  if v_first is null or v_second is distinct from v_first then
    raise exception 'first_publish_timestamp_not_preserved';
  end if;

  begin
    delete from public.blog_posts
    where id = '90000000-0000-0000-0000-000000000101';
    raise exception 'published_post_delete_succeeded';
  exception when check_violation then
    if sqlerrm <> 'published_blog_post_delete_forbidden' then raise; end if;
  end;

  delete from public.blog_posts
  where id = '90000000-0000-0000-0000-000000000102';
  if found is false then raise exception 'draft_delete_failed'; end if;

  begin
    perform *
    from public.set_blog_post_status(
      '90000000-0000-0000-0000-000000000002',
      '90000000-0000-0000-0000-000000000103',
      'published'
    );
    raise exception 'cross_tenant_blog_status_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'blog_post_status_access_denied' then raise; end if;
  end;
end
$$;

reset role;
do $$
declare v_audits integer;
begin
  select count(*) into v_audits
  from public.audit_log
  where entity = 'blog_posts'
    and entity_id = '90000000-0000-0000-0000-000000000101'
    and action = 'blog_post.status_changed';
  if v_audits <> 1 then
    raise exception 'idempotent_publish_audit_count_%', v_audits;
  end if;
end
$$;

-- Organisationsgemensamt innehåll får inte muteras av ett konto som bara har
-- platsomfattning. SECURITY DEFINER-funktionen måste spegla tabellens RLS.
update public.users
   set access_scope = 'locations'
 where id = '90000000-0000-0000-0000-000000000021';

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"90000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform *
    from public.set_blog_post_status(
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000101',
      'archived'
    );
    raise exception 'location_scoped_blog_status_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'blog_post_status_access_denied' then raise; end if;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;

select *
from public.set_blog_post_status(
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000101',
  'archived'
);

reset role;
do $$
begin
  if (
    select count(*)
      from public.audit_log
     where entity_id = '90000000-0000-0000-0000-000000000101'
       and action = 'blog_post.status_changed'
       and actor_profile_id = '90000000-0000-0000-0000-000000000023'
  ) <> 1 then
    raise exception 'platform_blog_transition_not_audited';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000022', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000022","role":"authenticated","app_metadata":{"tenant_id":"90000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform *
    from public.set_blog_post_status(
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000101',
      'archived'
    );
    raise exception 'staff_blog_status_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'blog_post_status_access_denied' then raise; end if;
  end;
end
$$;

reset role;
rollback;
