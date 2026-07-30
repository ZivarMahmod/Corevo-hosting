-- Goal 92 Task 1: tenant-safe media lifecycle.
--
-- Lifecycle: pending -> ready -> deleting -> deleted | delete_failed.
-- New uploads reserve quota in Postgres before R2 I/O. R2 cleanup uses one
-- media-specific durable lease queue; no generic job framework is introduced.

alter table public.media_assets
  add column if not exists status text,
  add column if not exists published boolean,
  add column if not exists variants jsonb,
  add column if not exists last_error text,
  add column if not exists lifecycle_version bigint not null default 0,
  add column if not exists reserved_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- Preserve every valid legacy public surface. Rows without a usable URL remain
-- non-public pending rows instead of being advertised as ready.
update public.media_assets
   set status = case
         when nullif(btrim(url), '') is null then 'pending'
         else 'ready'
       end,
       published = nullif(btrim(url), '') is not null,
       variants = case
         when nullif(btrim(url), '') is null then '{}'::jsonb
         else jsonb_build_object('thumb', url, 'card', url, 'hero', url)
       end,
       lifecycle_version = case
         when nullif(btrim(url), '') is null then lifecycle_version
         else greatest(lifecycle_version, 1)
       end
 where status is null
    or published is null
    or variants is null;

-- Keep only canonical SHA-256 values before installing the active-hash index.
-- A malformed/duplicate legacy hash loses dedupe metadata, never the media row.
update public.media_assets
   set content_hash = lower(content_hash)
 where content_hash ~* '^[0-9a-f]{64}$';

update public.media_assets
   set content_hash = null
 where content_hash is not null
   and content_hash !~ '^[0-9a-f]{64}$';

with ranked as (
  select
    id,
    row_number() over (
      partition by tenant_id, content_hash
      order by created_at, id
    ) as duplicate_rank
  from public.media_assets
  where content_hash is not null
)
update public.media_assets m
   set content_hash = null
  from ranked r
 where r.id = m.id
   and r.duplicate_rank > 1;

alter table public.media_assets
  alter column url drop not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column published set default false,
  alter column published set not null,
  alter column variants set default '{}'::jsonb,
  alter column variants set not null,
  drop constraint if exists media_assets_status_check,
  drop constraint if exists media_assets_content_hash_check,
  drop constraint if exists media_assets_published_ready_check,
  drop constraint if exists media_assets_ready_contract_check,
  drop constraint if exists media_assets_deleted_at_check,
  add constraint media_assets_status_check
    check (status in ('pending', 'ready', 'deleting', 'deleted', 'delete_failed')),
  add constraint media_assets_content_hash_check
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  add constraint media_assets_published_ready_check
    check (not published or status = 'ready'),
  add constraint media_assets_ready_contract_check
    check (
      status <> 'ready'
      or (
        nullif(btrim(url), '') is not null
        and jsonb_typeof(variants) = 'object'
        and variants ?& array['thumb', 'card', 'hero']
        and (variants - array['thumb', 'card', 'hero']) = '{}'::jsonb
        and nullif(btrim(variants ->> 'thumb'), '') is not null
        and nullif(btrim(variants ->> 'card'), '') is not null
        and nullif(btrim(variants ->> 'hero'), '') is not null
      )
    ),
  add constraint media_assets_deleted_at_check
    check ((status = 'deleted') = (deleted_at is not null));

create unique index if not exists media_assets_tenant_hash_active_unique
  on public.media_assets (tenant_id, content_hash)
  where content_hash is not null and status <> 'deleted';

create index if not exists media_assets_tenant_lifecycle_idx
  on public.media_assets (tenant_id, status, created_at desc);

create table if not exists private.media_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  asset_id uuid not null,
  r2_keys text[] not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_cleanup_jobs_asset_tenant_fkey
    foreign key (asset_id, tenant_id)
    references public.media_assets (id, tenant_id)
    on delete cascade,
  constraint media_cleanup_jobs_asset_unique unique (tenant_id, asset_id)
);

create index if not exists media_cleanup_jobs_claim_idx
  on private.media_cleanup_jobs (available_at, created_at, id)
  where status in ('queued', 'processing');

create index if not exists media_cleanup_jobs_expired_lease_idx
  on private.media_cleanup_jobs (lease_expires_at, id)
  where status = 'processing';

revoke all on table private.media_cleanup_jobs
  from public, anon, authenticated, service_role;

create or replace function private.assert_media_access(
  p_tenant uuid,
  p_require_writable_module boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_owner boolean;
  v_module_state text;
begin
  if coalesce((select auth.role()), '') <> 'authenticated' then
    raise exception 'media_access_denied' using errcode = '42501';
  end if;

  v_tenant_owner :=
    (select private.tenant_id()) = p_tenant
    and coalesce((select private.role_level()), 0) >= 6
    and (select private.has_organization_scope());

  if not coalesce(v_tenant_owner, false)
     and not coalesce((select private.can_access_tenant(p_tenant)), false) then
    raise exception 'media_access_denied' using errcode = '42501';
  end if;

  if not p_require_writable_module then
    return;
  end if;

  perform private.assert_active_tenant_mutation(p_tenant);

  select tm.state
    into v_module_state
    from public.tenant_modules tm
   where tm.tenant_id = p_tenant
     and tm.module_key = 'media_library';

  if v_module_state is null or v_module_state not in ('draft', 'live') then
    raise exception 'media_module_read_only' using errcode = '55000';
  end if;
end;
$$;

revoke all on function private.assert_media_access(uuid, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.media_variants_valid(p_variants jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_variants) = 'object'
    and p_variants ?& array['thumb', 'card', 'hero']
    and (p_variants - array['thumb', 'card', 'hero']) = '{}'::jsonb
    and (p_variants ->> 'thumb') ~ '^https://[^[:space:]]+$'
    and (p_variants ->> 'card') ~ '^https://[^[:space:]]+$'
    and (p_variants ->> 'hero') ~ '^https://[^[:space:]]+$',
    false
  )
$$;

revoke all on function private.media_variants_valid(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.reserve_media_upload(
  p_tenant uuid,
  p_content_hash text,
  p_size_bytes bigint,
  p_source text
) returns table (
  asset_id uuid,
  r2_key text,
  status text,
  published boolean,
  url text,
  variants jsonb,
  outcome text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_id uuid;
  v_config jsonb;
  v_module_state text;
  v_quota bigint := 524288000;
  v_usage bigint;
  v_existing public.media_assets%rowtype;
begin
  perform private.assert_media_access(p_tenant, true);

  if p_content_hash is null
     or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'media_content_hash_invalid' using errcode = '22023';
  end if;
  if p_size_bytes is null
     or p_size_bytes < 1
     or p_size_bytes > 8388608 then
    raise exception 'media_size_invalid' using errcode = '22023';
  end if;
  if p_source is null
     or p_source not in ('upload', 'library', 'stock', 'branding', 'sajtbyggare') then
    raise exception 'media_source_invalid' using errcode = '22023';
  end if;

  -- This tenant-scoped lock serializes every quota reservation. Two concurrent
  -- callers therefore observe the prior pending reservation before summing.
  select tm.state, tm.config
    into v_module_state, v_config
    from public.tenant_modules tm
   where tm.tenant_id = p_tenant
     and tm.module_key = 'media_library'
   for update;

  if not found or v_module_state not in ('draft', 'live') then
    raise exception 'media_module_read_only' using errcode = '55000';
  end if;

  if jsonb_typeof(v_config -> 'quota_bytes') = 'number' then
    begin
      v_quota := (v_config ->> 'quota_bytes')::bigint;
    exception when others then
      v_quota := 524288000;
    end;
  end if;
  if v_quota < 1 then
    v_quota := 524288000;
  end if;

  select m.*
    into v_existing
    from public.media_assets m
   where m.tenant_id = p_tenant
     and m.content_hash = p_content_hash
     and m.status <> 'deleted'
   for update;

  if found then
    return query
    select
      v_existing.id,
      v_existing.r2_key,
      v_existing.status,
      v_existing.published,
      v_existing.url,
      v_existing.variants,
      'duplicate_' || v_existing.status;
    return;
  end if;

  select coalesce(sum(m.size_bytes), 0)::bigint
    into v_usage
    from public.media_assets m
   where m.tenant_id = p_tenant
     and m.status in ('pending', 'ready');

  if v_usage + p_size_bytes > v_quota then
    raise exception 'media_quota_exceeded' using errcode = '22023';
  end if;

  v_asset_id := gen_random_uuid();
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
    lifecycle_version,
    reserved_at
  ) values (
    v_asset_id,
    p_tenant,
    'media/' || p_tenant::text || '/' || v_asset_id::text,
    null,
    'image',
    p_size_bytes,
    p_source,
    p_content_hash,
    'pending',
    false,
    '{}'::jsonb,
    0,
    now()
  );

  return query
  select
    m.id,
    m.r2_key,
    m.status,
    m.published,
    m.url,
    m.variants,
    'reserved'::text
  from public.media_assets m
  where m.id = v_asset_id;
end;
$$;

create or replace function public.finalize_media_upload(
  p_tenant uuid,
  p_asset uuid,
  p_url text,
  p_variants jsonb,
  p_published boolean
) returns table (
  asset_id uuid,
  status text,
  url text,
  variants jsonb,
  outcome text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.media_assets%rowtype;
begin
  perform private.assert_media_access(p_tenant, true);

  if p_url is null
     or p_url !~ '^https://[^[:space:]]+$'
     or not private.media_variants_valid(p_variants) then
    raise exception 'media_variants_invalid' using errcode = '22023';
  end if;
  if coalesce(p_published, false) then
    raise exception 'media_publication_requires_reference' using errcode = '42501';
  end if;

  select m.*
    into v_asset
    from public.media_assets m
   where m.id = p_asset
     and m.tenant_id = p_tenant
   for update;

  if not found then
    raise exception 'media_asset_not_found' using errcode = 'P0002';
  end if;

  if v_asset.status = 'ready' then
    if v_asset.url is distinct from p_url
       or v_asset.variants is distinct from p_variants then
      raise exception 'media_finalize_conflict' using errcode = '40001';
    end if;

    return query
    select v_asset.id, v_asset.status, v_asset.url, v_asset.variants, 'already_ready'::text;
    return;
  end if;

  if v_asset.status <> 'pending' then
    raise exception 'media_finalize_state_invalid' using errcode = '55000';
  end if;

  update public.media_assets m
     set url = p_url,
         variants = p_variants,
         status = 'ready',
         published = false,
         last_error = null,
         lifecycle_version = m.lifecycle_version + 1,
         updated_at = now()
   where m.id = v_asset.id;

  return query
  select m.id, m.status, m.url, m.variants, 'finalized'::text
    from public.media_assets m
   where m.id = v_asset.id;
end;
$$;

create or replace function public.cancel_media_upload(
  p_tenant uuid,
  p_asset uuid,
  p_error text,
  p_cleanup_required boolean
) returns table (
  asset_id uuid,
  status text,
  outcome text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.media_assets%rowtype;
  v_error text := left(coalesce(nullif(btrim(p_error), ''), 'media_upload_failed'), 200);
begin
  perform private.assert_media_access(p_tenant, false);

  select m.*
    into v_asset
    from public.media_assets m
   where m.id = p_asset
     and m.tenant_id = p_tenant
   for update;

  if not found then
    raise exception 'media_asset_not_found' using errcode = 'P0002';
  end if;
  if v_asset.status = 'deleted' then
    return query select v_asset.id, v_asset.status, 'already_deleted'::text;
    return;
  end if;
  if v_asset.status = 'delete_failed' and coalesce(p_cleanup_required, false) then
    return query select v_asset.id, v_asset.status, 'already_delete_failed'::text;
    return;
  end if;
  if v_asset.status <> 'pending' then
    raise exception 'media_cancel_state_invalid' using errcode = '55000';
  end if;

  if coalesce(p_cleanup_required, false) then
    update public.media_assets m
       set status = 'delete_failed',
           published = false,
           last_error = v_error,
           lifecycle_version = m.lifecycle_version + 1,
           updated_at = now()
     where m.id = v_asset.id;

    insert into private.media_cleanup_jobs (
      tenant_id,
      asset_id,
      r2_keys,
      status,
      attempt_count,
      available_at,
      last_error
    ) values (
      p_tenant,
      v_asset.id,
      array[v_asset.r2_key],
      'queued',
      0,
      now(),
      v_error
    )
    on conflict on constraint media_cleanup_jobs_asset_unique do update
       set r2_keys = excluded.r2_keys,
           status = 'queued',
           attempt_count = 0,
           available_at = now(),
           lease_token = null,
           lease_expires_at = null,
           last_error = excluded.last_error,
           updated_at = now();

    return query select v_asset.id, 'delete_failed'::text, 'cleanup_queued'::text;
    return;
  end if;

  update public.media_assets m
     set status = 'deleted',
         published = false,
         url = null,
         variants = '{}'::jsonb,
         last_error = v_error,
         deleted_at = now(),
         lifecycle_version = m.lifecycle_version + 1,
         updated_at = now()
   where m.id = v_asset.id;

  return query select v_asset.id, 'deleted'::text, 'cancelled'::text;
end;
$$;

-- A reference write and deletion serialize on the same media row. References may
-- point only at ready assets; publication is monotonic and starts only when the
-- owning content row is actually public.
create or replace function private.publish_referenced_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid;
  v_row jsonb := pg_catalog.to_jsonb(new);
  v_public boolean := true;
  v_arg integer := 1;
  v_status text;
  v_published boolean;
begin
  v_asset := nullif(v_row ->> tg_argv[0], '')::uuid;
  if v_asset is null then
    return new;
  end if;

  while v_arg + 1 < tg_nargs loop
    v_public := v_public
      and coalesce(v_row ->> tg_argv[v_arg], '') = tg_argv[v_arg + 1];
    v_arg := v_arg + 2;
  end loop;

  select m.status, m.published
    into v_status, v_published
    from public.media_assets m
   where m.id = v_asset
     and m.tenant_id = new.tenant_id
   for update;

  if not found or v_status <> 'ready' then
    raise exception 'media_reference_requires_ready' using errcode = '55000';
  end if;

  if v_public and not v_published then
    update public.media_assets m
       set published = true,
           lifecycle_version = m.lifecycle_version + 1,
           updated_at = now()
     where m.id = v_asset
       and m.tenant_id = new.tenant_id;
  end if;

  return new;
end;
$$;

revoke all on function private.publish_referenced_media()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_blog_posts_publish_media on public.blog_posts;
create trigger trg_blog_posts_publish_media
  before insert or update of cover_asset_id, status on public.blog_posts
  for each row execute function private.publish_referenced_media(
    'cover_asset_id',
    'status',
    'published'
  );

drop trigger if exists trg_content_slots_publish_media on public.content_slots;
create trigger trg_content_slots_publish_media
  before insert or update of asset_id on public.content_slots
  for each row execute function private.publish_referenced_media('asset_id');

drop trigger if exists trg_gallery_items_publish_media on public.gallery_items;
create trigger trg_gallery_items_publish_media
  before insert or update of asset_id, active on public.gallery_items
  for each row execute function private.publish_referenced_media(
    'asset_id',
    'active',
    'true'
  );

drop trigger if exists trg_shop_products_publish_media on public.shop_products;
create trigger trg_shop_products_publish_media
  before insert or update of image_asset_id, active on public.shop_products
  for each row execute function private.publish_referenced_media(
    'image_asset_id',
    'active',
    'true'
  );

drop trigger if exists trg_shop_product_variants_publish_media
  on public.shop_product_variants;
create trigger trg_shop_product_variants_publish_media
  before insert or update of image_asset_id, active on public.shop_product_variants
  for each row execute function private.publish_referenced_media(
    'image_asset_id',
    'active',
    'true'
  );

-- Historical storefront consumers store public URLs instead of asset UUIDs. Lock
-- any matching managed row before accepting the write, and publish only when that
-- consumer's own visibility columns say it is public. A URL with no media row is a
-- legacy/external URL and remains valid.
create or replace function private.guard_media_url_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := pg_catalog.to_jsonb(new);
  v_url text;
  v_public boolean := true;
  v_arg integer := 1;
  v_asset record;
begin
  v_url := nullif(pg_catalog.btrim(v_row ->> tg_argv[0]), '');
  if v_url is null then
    return new;
  end if;

  while v_arg + 1 < tg_nargs loop
    v_public := v_public
      and coalesce(v_row ->> tg_argv[v_arg], '') = tg_argv[v_arg + 1];
    v_arg := v_arg + 2;
  end loop;

  for v_asset in
    select m.id, m.status, m.published
      from public.media_assets m
     where m.tenant_id = new.tenant_id
       and m.url = v_url
     order by m.id
     for update
  loop
    if v_asset.status <> 'ready' then
      raise exception 'media_reference_requires_ready' using errcode = '55000';
    end if;
    if v_public and not v_asset.published then
      update public.media_assets m
         set published = true,
             lifecycle_version = m.lifecycle_version + 1,
             updated_at = now()
       where m.id = v_asset.id;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.guard_media_url_reference()
  from public, anon, authenticated, service_role;

create or replace function private.guard_media_json_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := pg_catalog.to_jsonb(new);
  v_document jsonb;
  v_public boolean := true;
  v_arg integer := 1;
  v_asset record;
begin
  v_document := v_row -> tg_argv[0];
  if v_document is null or v_document = 'null'::jsonb then
    return new;
  end if;

  while v_arg + 1 < tg_nargs loop
    v_public := v_public
      and coalesce(v_row ->> tg_argv[v_arg], '') = tg_argv[v_arg + 1];
    v_arg := v_arg + 2;
  end loop;

  for v_asset in
    select m.id, m.status, m.published
      from public.media_assets m
     where m.tenant_id = new.tenant_id
       and m.url is not null
       and pg_catalog.jsonb_path_exists(
         v_document,
         '$.** ? (@ == $url)',
         pg_catalog.jsonb_build_object('url', pg_catalog.to_jsonb(m.url))
       )
     order by m.id
     for update
  loop
    if v_asset.status <> 'ready' then
      raise exception 'media_reference_requires_ready' using errcode = '55000';
    end if;
    if v_public and not v_asset.published then
      update public.media_assets m
         set published = true,
             lifecycle_version = m.lifecycle_version + 1,
             updated_at = now()
       where m.id = v_asset.id;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.guard_media_json_references()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_staff_guard_media_url on public.staff;
create trigger trg_staff_guard_media_url
  before insert or update of avatar_url, active, show_on_site on public.staff
  for each row execute function private.guard_media_url_reference(
    'avatar_url',
    'active',
    'true',
    'show_on_site',
    'true'
  );

drop trigger if exists trg_services_guard_media_url on public.services;
create trigger trg_services_guard_media_url
  before insert or update of image_url, active on public.services
  for each row execute function private.guard_media_url_reference(
    'image_url',
    'active',
    'true'
  );

drop trigger if exists trg_tenant_settings_guard_media_json on public.tenant_settings;
create trigger trg_tenant_settings_guard_media_json
  before insert or update of branding on public.tenant_settings
  for each row execute function private.guard_media_json_references('branding');

drop trigger if exists trg_site_revisions_guard_media_json on public.site_revisions;
create trigger trg_site_revisions_guard_media_json
  before insert or update of snapshot, status on public.site_revisions
  for each row execute function private.guard_media_json_references(
    'snapshot',
    'status',
    'published'
  );

create or replace function public.request_media_delete(
  p_tenant uuid,
  p_asset uuid
) returns table (
  asset_id uuid,
  status text,
  outcome text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.media_assets%rowtype;
  v_retry boolean := false;
begin
  perform private.assert_media_access(p_tenant, true);

  select m.*
    into v_asset
    from public.media_assets m
   where m.id = p_asset
     and m.tenant_id = p_tenant
   for update;

  if not found then
    raise exception 'media_asset_not_found' using errcode = 'P0002';
  end if;
  if v_asset.status = 'deleted' then
    return query select v_asset.id, v_asset.status, 'already_deleted'::text;
    return;
  end if;
  if v_asset.status = 'deleting' then
    return query select v_asset.id, v_asset.status, 'already_deleting'::text;
    return;
  end if;

  if exists (
       select 1 from public.blog_posts b
        where b.tenant_id = p_tenant and b.cover_asset_id = p_asset
     )
     or exists (
       select 1 from public.content_slots c
        where c.tenant_id = p_tenant and c.asset_id = p_asset
     )
     or exists (
       select 1 from public.gallery_items g
        where g.tenant_id = p_tenant and g.asset_id = p_asset
     )
     or exists (
       select 1 from public.shop_products p
        where p.tenant_id = p_tenant and p.image_asset_id = p_asset
     )
     or exists (
       select 1 from public.shop_product_variants v
        where v.tenant_id = p_tenant and v.image_asset_id = p_asset
     )
     or (
       v_asset.url is not null
       and (
         exists (
           select 1 from public.staff s
            where s.tenant_id = p_tenant and s.avatar_url = v_asset.url
         )
         or exists (
           select 1 from public.services s
            where s.tenant_id = p_tenant and s.image_url = v_asset.url
         )
         or exists (
           select 1
             from public.tenant_settings ts
            where ts.tenant_id = p_tenant
              and pg_catalog.jsonb_path_exists(
                ts.branding,
                '$.** ? (@ == $url)',
                pg_catalog.jsonb_build_object(
                  'url',
                  pg_catalog.to_jsonb(v_asset.url)
                )
              )
         )
         or exists (
           select 1
             from public.site_revisions sr
            where sr.tenant_id = p_tenant
              and pg_catalog.jsonb_path_exists(
                sr.snapshot,
                '$.** ? (@ == $url)',
                pg_catalog.jsonb_build_object(
                  'url',
                  pg_catalog.to_jsonb(v_asset.url)
                )
              )
         )
       )
     ) then
    raise exception 'media_asset_in_use' using errcode = '23503';
  end if;

  v_retry := v_asset.status = 'delete_failed';

  update public.media_assets m
     set status = 'deleting',
         published = false,
         last_error = null,
         deleted_at = null,
         lifecycle_version = m.lifecycle_version + 1,
         updated_at = now()
   where m.id = v_asset.id;

  insert into private.media_cleanup_jobs (
    tenant_id,
    asset_id,
    r2_keys,
    status,
    attempt_count,
    available_at,
    lease_token,
    lease_expires_at,
    last_error
  ) values (
    p_tenant,
    v_asset.id,
    array[v_asset.r2_key],
    'queued',
    0,
    now(),
    null,
    null,
    null
  )
  on conflict on constraint media_cleanup_jobs_asset_unique do update
     set r2_keys = excluded.r2_keys,
         status = 'queued',
         attempt_count = 0,
         available_at = now(),
         lease_token = null,
         lease_expires_at = null,
         last_error = null,
         updated_at = now();

  return query
  select
    v_asset.id,
    'deleting'::text,
    case when v_retry then 'delete_retried' else 'delete_queued' end;
end;
$$;

create or replace function public.update_media_alt(
  p_tenant uuid,
  p_asset uuid,
  p_alt text
) returns table (
  asset_id uuid,
  outcome text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid;
begin
  perform private.assert_media_access(p_tenant, true);

  update public.media_assets m
     set alt = nullif(btrim(p_alt), ''),
         updated_at = now()
   where m.id = p_asset
     and m.tenant_id = p_tenant
     and m.status = 'ready'
  returning m.id into v_asset;

  if v_asset is null then
    raise exception 'media_asset_not_found' using errcode = 'P0002';
  end if;

  return query select v_asset, 'updated'::text;
end;
$$;

create or replace function public.claim_media_cleanup_jobs(
  p_limit integer,
  p_lease_seconds integer
) returns table (
  job_id uuid,
  tenant_id uuid,
  asset_id uuid,
  r2_keys text[],
  attempt integer,
  lease_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'media_cleanup_service_role_required' using errcode = '42501';
  end if;

  -- Recover a client that disappeared after reserving or after an uncertain R2
  -- response. The deterministic key makes delete safe even when no object exists.
  with stale as (
    select m.id
      from public.media_assets m
     where m.status = 'pending'
       and m.reserved_at <= now() - interval '30 minutes'
     order by m.reserved_at, m.id
     for update skip locked
     limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ),
  marked as (
    update public.media_assets m
       set status = 'delete_failed',
           published = false,
           last_error = 'media_upload_reservation_expired',
           lifecycle_version = m.lifecycle_version + 1,
           updated_at = now()
      from stale s
     where m.id = s.id
    returning m.id, m.tenant_id, m.r2_key
  )
  insert into private.media_cleanup_jobs (
    tenant_id,
    asset_id,
    r2_keys,
    status,
    attempt_count,
    available_at,
    last_error
  )
  select
    m.tenant_id,
    m.id,
    array[m.r2_key],
    'queued',
    0,
    now(),
    'media_upload_reservation_expired'
  from marked m
  on conflict on constraint media_cleanup_jobs_asset_unique do update
     set r2_keys = excluded.r2_keys,
         status = 'queued',
         attempt_count = 0,
         available_at = now(),
         lease_token = null,
         lease_expires_at = null,
         last_error = excluded.last_error,
         updated_at = now();

  -- Reclaim expired leases. Exhausted rows remain durable/manual-retryable.
  with expired as (
    update private.media_cleanup_jobs j
       set status = case
             when j.attempt_count >= j.max_attempts then 'failed'
             else 'queued'
           end,
           available_at = now(),
           lease_token = null,
           lease_expires_at = null,
           last_error = 'media_cleanup_lease_expired',
           updated_at = now()
     where j.status = 'processing'
       and j.lease_expires_at <= now()
    returning j.asset_id
  )
  update public.media_assets m
     set status = 'delete_failed',
         published = false,
         last_error = 'media_cleanup_lease_expired',
         updated_at = now()
    from expired e
   where m.id = e.asset_id
     and m.status <> 'deleted';

  return query
  with due as (
    select j.id
      from private.media_cleanup_jobs j
     where j.status = 'queued'
       and j.available_at <= now()
       and j.attempt_count < j.max_attempts
     order by j.available_at, j.created_at, j.id
     for update skip locked
     limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ),
  claimed as (
    update private.media_cleanup_jobs j
       set status = 'processing',
           attempt_count = j.attempt_count + 1,
           lease_token = gen_random_uuid(),
           lease_expires_at = now()
             + make_interval(
                 secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
               ),
           updated_at = now()
      from due
     where j.id = due.id
    returning j.*
  ),
  marked as (
    update public.media_assets m
       set status = 'deleting',
           published = false,
           last_error = null,
           updated_at = now()
      from claimed c
     where m.id = c.asset_id
       and m.tenant_id = c.tenant_id
       and m.status <> 'deleted'
    returning m.id
  )
  select
    c.id,
    c.tenant_id,
    c.asset_id,
    c.r2_keys,
    c.attempt_count,
    c.lease_token
  from claimed c
  where exists (select 1 from marked m where m.id = c.asset_id);
end;
$$;

create or replace function public.retry_media_cleanup_job(
  p_job uuid,
  p_lease_token uuid,
  p_error text,
  p_retry_after_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid;
  v_error text := left(coalesce(nullif(btrim(p_error), ''), 'media_cleanup_failed'), 200);
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'media_cleanup_service_role_required' using errcode = '42501';
  end if;

  update private.media_cleanup_jobs j
     set status = case
           when j.attempt_count >= j.max_attempts then 'failed'
           else 'queued'
         end,
         available_at = now()
           + make_interval(
               secs => least(greatest(coalesce(p_retry_after_seconds, 30), 0), 86400)
             ),
         lease_token = null,
         lease_expires_at = null,
         last_error = v_error,
         updated_at = now()
   where j.id = p_job
     and j.status = 'processing'
     and j.lease_token = p_lease_token
     and j.lease_expires_at > now()
  returning j.asset_id into v_asset;

  if v_asset is null then
    return false;
  end if;

  update public.media_assets m
     set status = 'delete_failed',
         published = false,
         last_error = v_error,
         lifecycle_version = m.lifecycle_version + 1,
         updated_at = now()
   where m.id = v_asset
     and m.status <> 'deleted';

  return true;
end;
$$;

create or replace function public.complete_media_cleanup_job(
  p_job uuid,
  p_lease_token uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'media_cleanup_service_role_required' using errcode = '42501';
  end if;

  update private.media_cleanup_jobs j
     set status = 'completed',
         lease_token = null,
         lease_expires_at = null,
         last_error = null,
         updated_at = now()
   where j.id = p_job
     and j.status = 'processing'
     and j.lease_token = p_lease_token
     and j.lease_expires_at > now()
  returning j.asset_id into v_asset;

  if v_asset is null then
    return false;
  end if;

  update public.media_assets m
     set status = 'deleted',
         published = false,
         variants = '{}'::jsonb,
         last_error = null,
         deleted_at = now(),
         lifecycle_version = m.lifecycle_version + 1,
         updated_at = now()
   where m.id = v_asset;

  return true;
end;
$$;

-- All client writes go through the lifecycle RPCs. Anonymous storefronts retain
-- legacy visibility only for rows explicitly backfilled/finalized ready+published.
revoke insert, update, delete on public.media_assets from anon, authenticated;
grant select on public.media_assets to anon, authenticated;

alter table public.media_assets enable row level security;
drop policy if exists media_assets_rls on public.media_assets;
drop policy if exists media_assets_public_read on public.media_assets;
drop policy if exists media_assets_authenticated_read on public.media_assets;

create policy media_assets_authenticated_read
on public.media_assets
for select
to authenticated
using (
  (status = 'ready' and published)
  or (
    tenant_id = (select private.tenant_id())
    and coalesce((select private.role_level()), 0) >= 6
    and (select private.has_organization_scope())
  )
  or (select private.can_access_tenant(tenant_id))
);

create policy media_assets_public_read
on public.media_assets
for select
to anon
using (status = 'ready' and published);

revoke all on function public.reserve_media_upload(uuid, text, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_media_upload(uuid, uuid, text, jsonb, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.cancel_media_upload(uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.request_media_delete(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_media_alt(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_media_cleanup_jobs(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.retry_media_cleanup_job(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_media_cleanup_job(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.reserve_media_upload(uuid, text, bigint, text)
  to authenticated;
grant execute on function public.finalize_media_upload(uuid, uuid, text, jsonb, boolean)
  to authenticated;
grant execute on function public.cancel_media_upload(uuid, uuid, text, boolean)
  to authenticated;
grant execute on function public.request_media_delete(uuid, uuid)
  to authenticated;
grant execute on function public.update_media_alt(uuid, uuid, text)
  to authenticated;
grant execute on function public.claim_media_cleanup_jobs(integer, integer)
  to service_role;
grant execute on function public.retry_media_cleanup_job(uuid, uuid, text, integer)
  to service_role;
grant execute on function public.complete_media_cleanup_job(uuid, uuid)
  to service_role;
