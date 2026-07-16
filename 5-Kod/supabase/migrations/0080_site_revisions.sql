-- 0080 — One private revision stream for the shared storefront editor.
-- Drafts never touch live storefront rows. Publishing takes the tenant lock and
-- applies only the site-owned whitelist in one transaction.

begin;

create table public.site_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  lock_version bigint not null default 1 check (lock_version > 0),
  source_revision_id uuid references public.site_revisions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index site_revisions_one_draft_per_tenant_idx
  on public.site_revisions (tenant_id)
  where (status = 'draft');
create index site_revisions_history_idx
  on public.site_revisions (tenant_id, published_at desc)
  where (status = 'published');

alter table public.site_revisions enable row level security;

revoke all on table public.site_revisions from public, anon, authenticated;
grant select on table public.site_revisions to authenticated;

create policy site_revisions_read on public.site_revisions
  for select
  to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.has_organization_scope())
    )
  );

create or replace function private.assert_site_revision_access(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (
    (select private.is_platform_admin())
    or (
      (select private.tenant_id()) = p_tenant
      and (select private.has_organization_scope())
    )
  ) then
    raise exception 'site_revision_scope_denied' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_site_revision_access(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.merge_site_owned_json(
  p_current jsonb,
  p_candidate jsonb,
  p_keys text[]
) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_current, '{}'::jsonb) || coalesce(
    (
      select jsonb_object_agg(item.key, item.value)
        from jsonb_each(coalesce(p_candidate, '{}'::jsonb)) item
       where item.key = any(p_keys)
    ),
    '{}'::jsonb
  )
$$;

revoke all on function private.merge_site_owned_json(jsonb,jsonb,text[])
  from public, anon, authenticated, service_role;

-- ECMAScript String.prototype.trim removes this exact WhiteSpace + LineTerminator
-- set. Keeping it in one immutable helper makes direct SQL RPC input use the same
-- canonical representation as the TypeScript boundary (plain btrim only removes U+0020).
create or replace function private.site_js_trim(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select btrim(
    p_value,
    chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32)
      || chr(160) || chr(5760)
      || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
      || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202)
      || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279)
  )
$$;

revoke all on function private.site_js_trim(text)
  from public, anon, authenticated, service_role;

create or replace function private.site_has_js_whitespace(p_value text)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select translate(
    p_value,
    chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32)
      || chr(160) || chr(5760)
      || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
      || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202)
      || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279),
    ''
  ) <> p_value
$$;

revoke all on function private.site_has_js_whitespace(text)
  from public, anon, authenticated, service_role;

-- Locale-independent twin of the TypeScript font allowlist. translate removes
-- every explicitly allowed character; an empty remainder is safe.
create or replace function private.site_font_is_safe(p_value text)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select translate(
    p_value,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,' || chr(39) || chr(34) || '()._-'
      || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32)
      || chr(160) || chr(5760)
      || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
      || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202)
      || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279),
    ''
  ) = ''
$$;

revoke all on function private.site_font_is_safe(text)
  from public, anon, authenticated, service_role;

-- The public RPCs are callable without the web action, so storefront-facing
-- branding receives the same strict shape check at the database boundary.
create or replace function private.assert_site_snapshot_branding(p_snapshot jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_branding jsonb := p_snapshot -> 'branding';
  v_key text;
  v_item jsonb;
begin
  if v_branding is null or jsonb_typeof(v_branding) <> 'object' then
    raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(v_branding) key
     where key <> all(array[
       'color_primary', 'color_bg', 'color_fg', 'color_accent',
       'font_body', 'font_display', 'logo_url', 'hero_images', 'gallery_images',
       'about_image', 'closing_image', 'stats'
     ])
  ) then
    raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
  end if;

  foreach v_key in array array['color_primary', 'color_bg', 'color_fg', 'color_accent'] loop
    if v_branding ? v_key and jsonb_typeof(v_branding -> v_key) <> 'null' and (
      jsonb_typeof(v_branding -> v_key) <> 'string'
      or (v_branding ->> v_key) <> private.site_js_trim(v_branding ->> v_key)
      or (v_branding ->> v_key) !~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'
    ) then
      raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
    end if;
  end loop;

  foreach v_key in array array['font_body', 'font_display'] loop
    if v_branding ? v_key and jsonb_typeof(v_branding -> v_key) <> 'null' and (
      jsonb_typeof(v_branding -> v_key) <> 'string'
      or length(private.site_js_trim(v_branding ->> v_key)) not between 1 and 240
      or (v_branding ->> v_key) <> private.site_js_trim(v_branding ->> v_key)
      or not private.site_font_is_safe(v_branding ->> v_key)
    ) then
      raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
    end if;
  end loop;

  foreach v_key in array array['logo_url', 'about_image', 'closing_image'] loop
    if v_branding ? v_key and jsonb_typeof(v_branding -> v_key) <> 'null' and (
      jsonb_typeof(v_branding -> v_key) <> 'string'
      or length(v_branding ->> v_key) not between 1 and 2048
      or (v_branding ->> v_key) <> private.site_js_trim(v_branding ->> v_key)
      or (v_branding ->> v_key) !~* '^(https?://|/)'
    ) then
      raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
    end if;
  end loop;

  foreach v_key in array array['hero_images', 'gallery_images'] loop
    if v_branding ? v_key and jsonb_typeof(v_branding -> v_key) <> 'null' then
      if jsonb_typeof(v_branding -> v_key) <> 'array' then
        raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
      end if;
      if jsonb_array_length(v_branding -> v_key) > 30 then
        raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
      end if;
      for v_item in select value from jsonb_array_elements(v_branding -> v_key) loop
        if jsonb_typeof(v_item) <> 'string'
           or length(v_item #>> '{}') not between 1 and 2048
           or (v_item #>> '{}') <> private.site_js_trim(v_item #>> '{}')
           or (v_item #>> '{}') !~* '^(https?://|/)' then
          raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
        end if;
      end loop;
    end if;
  end loop;

  if v_branding ? 'stats' and jsonb_typeof(v_branding -> 'stats') <> 'null' then
    if jsonb_typeof(v_branding -> 'stats') <> 'array' then
      raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
    end if;
    if jsonb_array_length(v_branding -> 'stats') > 12 then
      raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_branding -> 'stats') loop
      if jsonb_typeof(v_item) <> 'array' then
        raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
      end if;
      if jsonb_array_length(v_item) <> 2
         or jsonb_typeof(v_item -> 0) <> 'string'
         or jsonb_typeof(v_item -> 1) <> 'string'
         or length(private.site_js_trim(v_item ->> 0)) not between 1 and 120
         or length(private.site_js_trim(v_item ->> 1)) not between 1 and 120
         or (v_item ->> 0) <> private.site_js_trim(v_item ->> 0)
         or (v_item ->> 1) <> private.site_js_trim(v_item ->> 1) then
        raise exception 'site_snapshot_branding_invalid' using errcode = '22023';
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function private.assert_site_snapshot_branding(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.assert_site_snapshot(p_snapshot jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_tenant jsonb := p_snapshot -> 'tenant';
  v_settings jsonb := p_snapshot -> 'settings';
  v_location jsonb := p_snapshot -> 'location';
  v_value jsonb;
  v_item jsonb;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
     or v_tenant is null or jsonb_typeof(v_tenant) <> 'object'
     or v_settings is null or jsonb_typeof(v_settings) <> 'object'
     or v_location is null or jsonb_typeof(v_location) <> 'object'
     or not (v_tenant ? 'name')
     or not (v_settings ?& array['copy', 'theme', 'contact', 'social', 'map', 'opening_hours', 'seo', 'booking']) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_snapshot) key
     where key <> all(array['tenant', 'settings', 'branding', 'location'])
  ) or exists (
    select 1 from jsonb_object_keys(v_tenant) key where key <> 'name'
  ) or exists (
    select 1 from jsonb_object_keys(v_settings) key
     where key <> all(array['copy', 'theme', 'contact', 'social', 'map', 'opening_hours', 'seo', 'booking'])
  ) or exists (
    select 1 from jsonb_object_keys(v_location) key where key <> 'address'
  ) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(v_tenant -> 'name') <> 'string'
     or length(private.site_js_trim(v_tenant ->> 'name')) not between 1 and 200
     or (v_tenant ->> 'name') <> private.site_js_trim(v_tenant ->> 'name')
     or jsonb_typeof(v_settings -> 'theme') <> 'string'
     or length(private.site_js_trim(v_settings ->> 'theme')) not between 1 and 64
     or (v_settings ->> 'theme') <> private.site_js_trim(v_settings ->> 'theme') then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;

  v_value := v_settings -> 'copy';
  if v_value is null or jsonb_typeof(v_value) <> 'object' then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(v_value) item
     where item.key <> all(array[
       'heroEyebrow', 'heroTitle', 'heroLede', 'aboutCopy', 'aboutCopyHome', 'tagline',
       'italic', 'aboutTitle', 'homeSecondTitle', 'whyTitle', 'whySub', 'whyBody',
       'servicesEyebrow', 'servicesTitle', 'servicesIntro', 'teamEyebrow', 'teamTitle',
       'teamLead', 'closingEyebrow', 'closingTitle', 'closingLede', 'contactEyebrow',
       'contactTitle', 'pillar1Title', 'pillar1Body', 'pillar1Link', 'pillar2Title',
       'pillar2Body', 'pillar2Link', 'pillar3Title', 'pillar3Body', 'pillar3Link',
       'shopEyebrow', 'shopTitle', 'shopCta', 'blogEyebrow', 'blogTitle', 'blogCta',
       'giftEyebrow', 'giftLede', 'giftCta', 'homeGalleryEyebrow', 'galleryEyebrow',
       'findEyebrow', 'clubEyebrow', 'clubTitle', 'clubLede', 'clubCta', 'clubNote',
       'galleryTitle', 'galleryLede'
     ])
       or jsonb_typeof(item.value) <> 'string'
       or length(private.site_js_trim(item.value #>> '{}')) not between 1 and 4000
       or (item.value #>> '{}') <> private.site_js_trim(item.value #>> '{}')
  ) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;

  v_value := v_settings -> 'contact';
  if v_value is null or jsonb_typeof(v_value) <> 'object' then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if not (v_value ?& array['email', 'phone'])
     or exists (select 1 from jsonb_object_keys(v_value) key where key <> all(array['email', 'phone'])) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(v_value -> 'email') not in ('null', 'string')
     or (jsonb_typeof(v_value -> 'email') = 'string' and (
       length(private.site_js_trim(v_value ->> 'email')) not between 1 and 200
       or (v_value ->> 'email') <> private.site_js_trim(v_value ->> 'email')
       or private.site_has_js_whitespace(v_value ->> 'email')
       or (v_value ->> 'email') !~ '^[^@]+@[^@]+\.[^@]+$'
     ))
     or jsonb_typeof(v_value -> 'phone') not in ('null', 'string')
     or (jsonb_typeof(v_value -> 'phone') = 'string' and (
       length(private.site_js_trim(v_value ->> 'phone')) not between 1 and 320
       or (v_value ->> 'phone') <> private.site_js_trim(v_value ->> 'phone')
     )) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;

  v_value := v_settings -> 'social';
  if v_value is null or jsonb_typeof(v_value) <> 'object' then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if not (v_value ?& array['instagram', 'facebook', 'tiktok'])
     or exists (select 1 from jsonb_object_keys(v_value) key where key <> all(array['instagram', 'facebook', 'tiktok'])) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(v_value) item
     where jsonb_typeof(item.value) not in ('null', 'string')
        or (jsonb_typeof(item.value) = 'string' and (
          length(private.site_js_trim(item.value #>> '{}')) not between 1 and 300
          or (item.value #>> '{}') <> private.site_js_trim(item.value #>> '{}')
          or private.site_has_js_whitespace(item.value #>> '{}')
          or (item.value #>> '{}') !~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([/?#].*)?$'
        ))
  ) then raise exception 'site_snapshot_invalid' using errcode = '22023'; end if;

  v_value := v_settings -> 'map';
  if v_value is not null and jsonb_typeof(v_value) <> 'null' then
    if jsonb_typeof(v_value) <> 'object' then
      raise exception 'site_snapshot_invalid' using errcode = '22023';
    end if;
    if not (v_value ?& array['lat', 'lon'])
       or exists (select 1 from jsonb_object_keys(v_value) key where key <> all(array['lat', 'lon']))
       or jsonb_typeof(v_value -> 'lat') <> 'number'
       or jsonb_typeof(v_value -> 'lon') <> 'number' then
      raise exception 'site_snapshot_invalid' using errcode = '22023';
    end if;
    if (v_value ->> 'lat')::numeric not between -90 and 90
       or (v_value ->> 'lon')::numeric not between -180 and 180 then
      raise exception 'site_snapshot_invalid' using errcode = '22023';
    end if;
  end if;

  v_value := v_settings -> 'opening_hours';
  if v_value is not null and jsonb_typeof(v_value) <> 'null' then
    if jsonb_typeof(v_value) <> 'array' then
      raise exception 'site_snapshot_invalid' using errcode = '22023';
    end if;
    if jsonb_array_length(v_value) not between 1 and 31 then
      raise exception 'site_snapshot_invalid' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_value) loop
      if jsonb_typeof(v_item) <> 'object' then
        raise exception 'site_snapshot_invalid' using errcode = '22023';
      end if;
      if not (v_item ?& array['day', 'time'])
         or exists (select 1 from jsonb_object_keys(v_item) key where key <> all(array['day', 'time']))
         or jsonb_typeof(v_item -> 'day') <> 'string'
         or jsonb_typeof(v_item -> 'time') <> 'string'
         or length(private.site_js_trim(v_item ->> 'day')) not between 1 and 40
         or length(private.site_js_trim(v_item ->> 'time')) not between 1 and 80
         or (v_item ->> 'day') <> private.site_js_trim(v_item ->> 'day')
         or (v_item ->> 'time') <> private.site_js_trim(v_item ->> 'time') then
        raise exception 'site_snapshot_invalid' using errcode = '22023';
      end if;
    end loop;
  end if;

  v_value := v_settings -> 'seo';
  if v_value is null or jsonb_typeof(v_value) <> 'object' then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if not (v_value ?& array['title', 'description'])
     or exists (select 1 from jsonb_object_keys(v_value) key where key <> all(array['title', 'description'])) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(v_value) item
     where jsonb_typeof(item.value) not in ('null', 'string')
        or (item.key = 'title' and jsonb_typeof(item.value) = 'string' and (
          length(private.site_js_trim(item.value #>> '{}')) not between 1 and 200
          or (item.value #>> '{}') <> private.site_js_trim(item.value #>> '{}')
        ))
        or (item.key = 'description' and jsonb_typeof(item.value) = 'string' and (
          length(private.site_js_trim(item.value #>> '{}')) not between 1 and 500
          or (item.value #>> '{}') <> private.site_js_trim(item.value #>> '{}')
        ))
  ) then raise exception 'site_snapshot_invalid' using errcode = '22023'; end if;

  v_value := v_settings -> 'booking';
  if v_value is null or jsonb_typeof(v_value) <> 'object' then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;
  if not (v_value ?& array['variant', 'pickerMode', 'staffAvatars'])
     or exists (select 1 from jsonb_object_keys(v_value) key where key <> all(array['variant', 'pickerMode', 'staffAvatars']))
     or jsonb_typeof(v_value -> 'variant') <> 'string'
     or jsonb_typeof(v_value -> 'pickerMode') <> 'string'
     or jsonb_typeof(v_value -> 'staffAvatars') <> 'string'
     or v_value ->> 'variant' not in ('wizard', 'drawer', 'compact', 'inline')
     or v_value ->> 'pickerMode' not in ('calendar', 'strip')
     or v_value ->> 'staffAvatars' not in ('initialer', 'foto', 'namn') then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;

  if not (v_location ? 'address')
     or jsonb_typeof(v_location -> 'address') not in ('null', 'string')
     or (jsonb_typeof(v_location -> 'address') = 'string' and (
       length(private.site_js_trim(v_location ->> 'address')) not between 1 and 500
       or (v_location ->> 'address') <> private.site_js_trim(v_location ->> 'address')
     )) then
    raise exception 'site_snapshot_invalid' using errcode = '22023';
  end if;

  perform private.assert_site_snapshot_branding(p_snapshot);
end;
$$;

revoke all on function private.assert_site_snapshot(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_published_site_revision_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'published' then
    raise exception 'published_site_revision_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_published_site_revision_immutable()
  from public, anon, authenticated, service_role;

create trigger trg_site_revisions_immutable
  before update or delete on public.site_revisions
  for each row execute function private.enforce_published_site_revision_immutable();

create or replace function public.save_site_draft(
  p_tenant uuid,
  p_snapshot jsonb,
  p_expected_lock_version bigint default null
) returns table (revision_id uuid, lock_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision_id uuid;
  v_lock_version bigint;
begin
  perform private.assert_site_revision_access(p_tenant);
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'site_snapshot_must_be_object' using errcode = '22023';
  end if;
  perform private.assert_site_snapshot(p_snapshot);

  -- Serialise first-draft creation as well as later writes for this tenant.
  perform 1 from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'site_revision_tenant_missing' using errcode = 'P0002';
  end if;

  select sr.id, sr.lock_version
    into v_revision_id, v_lock_version
    from public.site_revisions sr
   where sr.tenant_id = p_tenant and sr.status = 'draft'
   for update;

  if v_revision_id is null then
    if p_expected_lock_version is not null then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    insert into public.site_revisions as sr (
      tenant_id, status, snapshot, lock_version, created_by, updated_by
    ) values (
      p_tenant, 'draft', p_snapshot, 1, (select auth.uid()), (select auth.uid())
    )
    returning sr.id, sr.lock_version into v_revision_id, v_lock_version;
  else
    if p_expected_lock_version is null or p_expected_lock_version <> v_lock_version then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    update public.site_revisions sr
       set snapshot = p_snapshot,
           lock_version = sr.lock_version + 1,
           source_revision_id = null,
           updated_by = (select auth.uid()),
           updated_at = now()
     where sr.id = v_revision_id
    returning sr.lock_version into v_lock_version;
  end if;

  return query select v_revision_id, v_lock_version;
end;
$$;

revoke all on function public.save_site_draft(uuid,jsonb,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.save_site_draft(uuid,jsonb,bigint)
  to authenticated;

create or replace function public.discard_site_draft(
  p_tenant uuid,
  p_expected_lock_version bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision_id uuid;
  v_lock_version bigint;
begin
  perform private.assert_site_revision_access(p_tenant);
  perform 1 from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'site_revision_tenant_missing' using errcode = 'P0002';
  end if;

  select sr.id, sr.lock_version
    into v_revision_id, v_lock_version
    from public.site_revisions sr
   where sr.tenant_id = p_tenant and sr.status = 'draft'
   for update;
  if v_revision_id is null then
    return null;
  end if;
  if p_expected_lock_version is null or p_expected_lock_version <> v_lock_version then
    raise exception 'site_revision_conflict' using errcode = '40001';
  end if;

  delete from public.site_revisions sr
   where sr.id = v_revision_id and sr.status = 'draft';
  return v_revision_id;
end;
$$;

revoke all on function public.discard_site_draft(uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.discard_site_draft(uuid,bigint)
  to authenticated;

create or replace function public.restore_site_revision(
  p_tenant uuid,
  p_source_revision_id uuid,
  p_expected_lock_version bigint default null
) returns table (revision_id uuid, lock_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_revision_id uuid;
  v_lock_version bigint;
begin
  perform private.assert_site_revision_access(p_tenant);
  perform 1 from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'site_revision_tenant_missing' using errcode = 'P0002';
  end if;

  select sr.snapshot
    into v_snapshot
    from public.site_revisions sr
   where sr.id = p_source_revision_id
     and sr.tenant_id = p_tenant
     and sr.status = 'published';
  if v_snapshot is null then
    raise exception 'published_site_revision_missing' using errcode = 'P0002';
  end if;

  select sr.id, sr.lock_version
    into v_revision_id, v_lock_version
    from public.site_revisions sr
   where sr.tenant_id = p_tenant and sr.status = 'draft'
   for update;

  if v_revision_id is null then
    if p_expected_lock_version is not null then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    insert into public.site_revisions as sr (
      tenant_id, status, snapshot, lock_version, source_revision_id, created_by, updated_by
    ) values (
      p_tenant, 'draft', v_snapshot, 1, p_source_revision_id,
      (select auth.uid()), (select auth.uid())
    )
    returning sr.id, sr.lock_version into v_revision_id, v_lock_version;
  else
    if p_expected_lock_version is null or p_expected_lock_version <> v_lock_version then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    update public.site_revisions sr
       set snapshot = v_snapshot,
           lock_version = sr.lock_version + 1,
           source_revision_id = p_source_revision_id,
           updated_by = (select auth.uid()),
           updated_at = now()
     where sr.id = v_revision_id
    returning sr.lock_version into v_lock_version;
  end if;

  return query select v_revision_id, v_lock_version;
end;
$$;

revoke all on function public.restore_site_revision(uuid,uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_site_revision(uuid,uuid,bigint)
  to authenticated;

create or replace function public.publish_site_draft(
  p_tenant uuid,
  p_expected_lock_version bigint
) returns table (revision_id uuid, lock_version bigint, snapshot jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision_id uuid;
  v_lock_version bigint;
  v_snapshot jsonb;
  v_settings jsonb;
  v_branding jsonb;
  v_settings_patch jsonb := '{}'::jsonb;
  v_branding_patch jsonb := '{}'::jsonb;
  v_booking jsonb;
  v_name text;
  v_address text;
begin
  perform private.assert_site_revision_access(p_tenant);
  perform 1 from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'site_revision_tenant_missing' using errcode = 'P0002';
  end if;

  select sr.id, sr.lock_version, sr.snapshot
    into v_revision_id, v_lock_version, v_snapshot
    from public.site_revisions sr
   where sr.tenant_id = p_tenant and sr.status = 'draft'
   for update;
  if v_revision_id is null then
    raise exception 'site_draft_missing' using errcode = 'P0002';
  end if;
  if p_expected_lock_version is null or p_expected_lock_version <> v_lock_version then
    raise exception 'site_revision_conflict' using errcode = '40001';
  end if;
  perform private.assert_site_snapshot(v_snapshot);

  v_settings := coalesce(v_snapshot -> 'settings', '{}'::jsonb);
  v_branding := coalesce(v_snapshot -> 'branding', '{}'::jsonb);
  if jsonb_typeof(v_settings) <> 'object' or jsonb_typeof(v_branding) <> 'object' then
    raise exception 'site_snapshot_sections_must_be_objects' using errcode = '22023';
  end if;

  -- Settings whitelist. Operational/customer-account keys are deliberately absent.
  v_settings_patch := private.merge_site_owned_json(
    '{}'::jsonb,
    v_settings,
    array['copy', 'contact', 'social', 'map', 'opening_hours', 'seo']
  );

  -- The editor snapshot uses the exact nested keys consumed by the live readers.
  -- Only these three keys are site-owned; any other live booking keys survive below.
  if v_settings ? 'booking' then
    v_booking := v_settings -> 'booking';
    if jsonb_typeof(v_booking) <> 'object' then
      raise exception 'site_booking_must_be_object' using errcode = '22023';
    end if;
    v_settings_patch := v_settings_patch || jsonb_build_object(
      'booking',
      private.merge_site_owned_json(
        '{}'::jsonb,
        v_booking,
        array['variant', 'pickerMode', 'staffAvatars']
      )
    );
  end if;

  v_branding_patch := private.merge_site_owned_json(
    '{}'::jsonb,
    v_branding,
    array[
      'color_primary', 'color_bg', 'color_fg', 'color_accent',
      'font_body', 'font_display', 'logo_url', 'hero_images', 'gallery_images',
      'about_image', 'closing_image', 'stats'
    ]
  );

  if v_snapshot #> '{tenant}' is not null then
    v_name := nullif(private.site_js_trim(v_snapshot #>> '{tenant,name}'), '');
    if v_name is null then
      raise exception 'site_name_required' using errcode = '22023';
    end if;
    update public.tenants t set name = v_name where t.id = p_tenant;
  end if;

  insert into public.tenant_settings (tenant_id, settings, branding)
  values (p_tenant, v_settings_patch, v_branding_patch)
  on conflict (tenant_id) do update
    set settings = (
          (
            coalesce(tenant_settings.settings, '{}'::jsonb)
              - 'copy' - 'contact' - 'social' - 'map'
              - 'opening_hours' - 'seo' - 'booking'
          )
          || (excluded.settings - 'booking')
        ) || jsonb_build_object(
            'booking',
            (
              coalesce(tenant_settings.settings -> 'booking', '{}'::jsonb)
                - 'variant' - 'pickerMode' - 'staffAvatars'
            )
              || coalesce(excluded.settings -> 'booking', '{}'::jsonb)
          ),
        branding = (
          coalesce(tenant_settings.branding, '{}'::jsonb)
            - 'color_primary' - 'color_bg' - 'color_fg' - 'color_accent'
            - 'font_body' - 'font_display' - 'logo_url' - 'hero_images'
            - 'gallery_images' - 'about_image' - 'closing_image' - 'stats'
        ) || excluded.branding;

  if v_snapshot #> '{location}' is not null then
    v_address := nullif(private.site_js_trim(v_snapshot #>> '{location,address}'), '');
    update public.locations l
       set address = v_address
     where l.tenant_id = p_tenant and l.is_primary = true;
    if not found and v_address is not null then
      insert into public.locations (tenant_id, name, address, is_primary)
      values (p_tenant, v_name, v_address, true);
    end if;
  end if;

  update public.site_revisions sr
     set status = 'published',
         lock_version = sr.lock_version + 1,
         published_by = (select auth.uid()),
         published_at = now(),
         updated_by = (select auth.uid()),
         updated_at = now()
   where sr.id = v_revision_id and sr.status = 'draft'
  returning sr.lock_version into v_lock_version;

  return query select v_revision_id, v_lock_version, v_snapshot;
end;
$$;

revoke all on function public.publish_site_draft(uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_site_draft(uuid,bigint)
  to authenticated;

comment on table public.site_revisions is
  'Private storefront editor drafts and immutable publication history; live storefronts never read this table.';
comment on function public.publish_site_draft(uuid,bigint) is
  'Atomically publishes the site-owned snapshot whitelist after tenant scope and optimistic-lock checks.';

commit;
