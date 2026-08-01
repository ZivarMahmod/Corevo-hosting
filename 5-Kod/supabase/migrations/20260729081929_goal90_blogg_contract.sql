-- Goal 90 — bloggidentitet, atomisk status och bevarad publiceringshistorik.
-- Append-only. Ingen produktions- eller previewdatabas muteras av filen i sig.
begin;

-- Legacyrader kan sakna slug eller bära en skiftlägesdubblett. Behåll varje rad
-- och ge bara de redan ambigua/obrukbara identiteterna en deterministisk slug.
update public.blog_posts
   set slug = pg_catalog.lower(pg_catalog.btrim(slug))
 where slug is not null
   and pg_catalog.btrim(slug) <> '';

do $$
declare
  v_row record;
  v_candidate text;
  v_suffix integer;
begin
  for v_row in
    select b.id, b.tenant_id
      from public.blog_posts b
     where b.slug is null or pg_catalog.btrim(b.slug) = ''
     order by b.tenant_id, b.created_at, b.id
  loop
    v_candidate := 'post-' || pg_catalog.replace(v_row.id::text, '-', '');
    v_suffix := 1;
    while exists (
      select 1
        from public.blog_posts other
       where other.tenant_id = v_row.tenant_id
         and other.id <> v_row.id
         and pg_catalog.lower(other.slug) = pg_catalog.lower(v_candidate)
    ) loop
      v_candidate :=
        'post-' || pg_catalog.replace(v_row.id::text, '-', '') || '-' || v_suffix::text;
      v_suffix := v_suffix + 1;
    end loop;
    update public.blog_posts set slug = v_candidate where id = v_row.id;
  end loop;

  for v_row in
    select ranked.id, ranked.tenant_id
      from (
        select b.id,
               b.tenant_id,
               pg_catalog.row_number() over (
                 partition by b.tenant_id, pg_catalog.lower(b.slug)
                 order by b.created_at, b.id
               ) as duplicate_no
          from public.blog_posts b
      ) ranked
     where ranked.duplicate_no > 1
     order by ranked.tenant_id, ranked.id
  loop
    v_candidate := 'post-' || pg_catalog.replace(v_row.id::text, '-', '');
    v_suffix := 1;
    while exists (
      select 1
        from public.blog_posts other
       where other.tenant_id = v_row.tenant_id
         and other.id <> v_row.id
         and pg_catalog.lower(other.slug) = pg_catalog.lower(v_candidate)
    ) loop
      v_candidate :=
        'post-' || pg_catalog.replace(v_row.id::text, '-', '') || '-' || v_suffix::text;
      v_suffix := v_suffix + 1;
    end loop;
    update public.blog_posts set slug = v_candidate where id = v_row.id;
  end loop;
end;
$$;

alter table public.blog_posts
  alter column slug set not null;

alter table public.blog_posts
  add constraint blog_posts_slug_nonblank
  check (pg_catalog.btrim(slug) <> '');

create unique index blog_posts_tenant_slug_unique
  on public.blog_posts (tenant_id, lower(slug));

-- RLS begränsar rader men inte kolumner. Status och published_at får därför
-- bara ändras av den granskade SECURITY DEFINER-funktionen nedan.
create or replace function private.guard_blog_post_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.published_at is not null then
      raise exception 'blog_post_lifecycle_is_db_owned'
        using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status
     or new.published_at is distinct from old.published_at then
    raise exception 'blog_post_lifecycle_is_db_owned'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_blog_post_lifecycle()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_blog_post_lifecycle_guard on public.blog_posts;
create trigger trg_blog_post_lifecycle_guard
  before insert or update on public.blog_posts
  for each row execute function private.guard_blog_post_lifecycle();

-- Publicerade inlägg är historik. Endast ett aldrig publicerat utkast får
-- hard-deletas; arkivering är den normala livscykeln efter publicering.
create or replace function private.guard_blog_post_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception 'published_blog_post_delete_forbidden'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

revoke all on function private.guard_blog_post_delete()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_blog_post_delete_guard on public.blog_posts;
create trigger trg_blog_post_delete_guard
  before delete on public.blog_posts
  for each row execute function private.guard_blog_post_delete();

-- SECURITY DEFINER krävs för den append-only auditloggen. Funktionen verifierar
-- därför identitet, adminnivå, tenant, aktiv tenant och skrivbart modulläge själv
-- innan den låser och ändrar exakt en tenantbunden rad.
create or replace function public.set_blog_post_status(
  p_tenant uuid,
  p_post uuid,
  p_status text
) returns table (
  outcome text,
  blog_status text,
  first_published_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant uuid := (select private.tenant_id());
  v_level integer := (select private.role_level());
  v_external_scope boolean := (select private.can_access_tenant(p_tenant));
  v_post public.blog_posts%rowtype;
  v_published_at timestamptz;
begin
  if v_uid is null
     or not (
       (v_tenant = p_tenant and coalesce(v_level, 0) >= 6)
       or coalesce(v_external_scope, false)
     )
     or not exists (
       select 1
         from public.tenants t
        where t.id = p_tenant
          and t.status = 'active'
     ) then
    raise exception 'blog_post_status_access_denied'
      using errcode = '42501';
  end if;

  if p_status is null
     or p_status not in ('draft', 'published', 'archived') then
    raise exception 'blog_post_status_invalid'
      using errcode = '22023';
  end if;

  if (select private.module_state(p_tenant, 'blogg')) not in ('draft', 'live') then
    raise exception 'blog_post_module_read_only'
      using errcode = '55000';
  end if;

  select b.*
    into v_post
    from public.blog_posts b
   where b.id = p_post
     and b.tenant_id = p_tenant
   for update;

  if v_post.id is null then
    raise exception 'blog_post_not_found'
      using errcode = '22023';
  end if;

  if v_post.status = p_status then
    return query
      select 'already_set'::text, v_post.status, v_post.published_at;
    return;
  end if;

  v_published_at := case
    when p_status = 'published'
      then coalesce(v_post.published_at, pg_catalog.now())
    else v_post.published_at
  end;

  update public.blog_posts b
     set status = p_status,
         published_at = v_published_at
   where b.id = v_post.id;

  insert into public.audit_log (
    tenant_id,
    actor_profile_id,
    action,
    entity,
    entity_id,
    meta
  ) values (
    p_tenant,
    v_uid,
    'blog_post.status_changed',
    'blog_posts',
    v_post.id,
    pg_catalog.jsonb_build_object(
      'from_status', v_post.status,
      'to_status', p_status
    )
  );

  return query
    select 'changed'::text, p_status, v_published_at;
end;
$$;

revoke all on function public.set_blog_post_status(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_blog_post_status(uuid, uuid, text)
  to authenticated;

comment on function public.set_blog_post_status(uuid, uuid, text) is
  'Goal 90: tenant-scoped, locked and audited blog status transition.';

commit;
