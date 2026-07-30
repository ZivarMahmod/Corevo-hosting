-- Goal 90: contextual gallery accessibility, tenant-bound media and atomic order.
begin;

alter table public.gallery_items
  add column if not exists alt_override text,
  add column if not exists decorative boolean not null default false;

-- Preserve the best existing contextual text. A usage with no meaningful text is
-- explicitly decorative instead of inheriting an accidental global description.
update public.gallery_items g
   set alt_override = left(
         nullif(btrim(coalesce(g.caption, m.alt, '')), ''),
         500
       ),
       decorative = nullif(btrim(coalesce(g.caption, m.alt, '')), '') is null
  from public.media_assets m
 where g.asset_id = m.id;

alter table public.gallery_items
  drop constraint if exists gallery_items_accessibility_check,
  add constraint gallery_items_accessibility_check check (
    asset_id is null
    or (
      decorative
      and alt_override is null
    )
    or (
      not decorative
      and alt_override is not null
      and char_length(btrim(alt_override)) between 1 and 500
    )
  ),
  drop constraint if exists gallery_items_sort_order_check,
  add constraint gallery_items_sort_order_check check (sort_order >= 0);

create unique index if not exists media_assets_id_tenant_unique
  on public.media_assets (id, tenant_id);

-- Every use binds the asset id to the row's own tenant. RESTRICT keeps the file
-- until the editor has deliberately removed every use.
alter table public.blog_posts
  drop constraint if exists blog_posts_cover_asset_id_fkey,
  drop constraint if exists blog_posts_asset_tenant_fkey,
  add constraint blog_posts_asset_tenant_fkey
    foreign key (cover_asset_id, tenant_id)
    references public.media_assets (id, tenant_id)
    on delete restrict
    not valid;

alter table public.content_slots
  drop constraint if exists content_slots_asset_id_fkey,
  drop constraint if exists content_slots_asset_tenant_fkey,
  add constraint content_slots_asset_tenant_fkey
    foreign key (asset_id, tenant_id)
    references public.media_assets (id, tenant_id)
    on delete restrict
    not valid;

alter table public.gallery_items
  drop constraint if exists gallery_items_asset_id_fkey,
  drop constraint if exists gallery_items_asset_tenant_fkey,
  add constraint gallery_items_asset_tenant_fkey
    foreign key (asset_id, tenant_id)
    references public.media_assets (id, tenant_id)
    on delete restrict
    not valid;

alter table public.shop_products
  drop constraint if exists shop_products_image_asset_id_fkey,
  drop constraint if exists shop_products_asset_tenant_fkey,
  add constraint shop_products_asset_tenant_fkey
    foreign key (image_asset_id, tenant_id)
    references public.media_assets (id, tenant_id)
    on delete restrict
    not valid;

alter table public.shop_product_variants
  drop constraint if exists shop_product_variants_image_asset_id_fkey,
  drop constraint if exists shop_product_variants_asset_tenant_fkey,
  add constraint shop_product_variants_asset_tenant_fkey
    foreign key (image_asset_id, tenant_id)
    references public.media_assets (id, tenant_id)
    on delete restrict
    not valid;

alter table public.blog_posts
  validate constraint blog_posts_asset_tenant_fkey;
alter table public.content_slots
  validate constraint content_slots_asset_tenant_fkey;
alter table public.gallery_items
  validate constraint gallery_items_asset_tenant_fkey;
alter table public.shop_products
  validate constraint shop_products_asset_tenant_fkey;
alter table public.shop_product_variants
  validate constraint shop_product_variants_asset_tenant_fkey;

create index if not exists blog_posts_asset_tenant_idx
  on public.blog_posts (cover_asset_id, tenant_id)
  where cover_asset_id is not null;
create index if not exists content_slots_asset_tenant_idx
  on public.content_slots (asset_id, tenant_id)
  where asset_id is not null;
create index if not exists gallery_items_asset_tenant_idx
  on public.gallery_items (asset_id, tenant_id)
  where asset_id is not null;
create index if not exists shop_products_asset_tenant_idx
  on public.shop_products (image_asset_id, tenant_id)
  where image_asset_id is not null;
create index if not exists shop_product_variants_asset_tenant_idx
  on public.shop_product_variants (image_asset_id, tenant_id)
  where image_asset_id is not null;

-- Normalize legacy ties once before making the per-tenant order unique.
with ranked as (
  select
    g.id,
    row_number() over (
      partition by g.tenant_id
      order by g.sort_order, g.created_at, g.id
    ) - 1 as position
  from public.gallery_items g
)
update public.gallery_items g
   set sort_order = ranked.position
  from ranked
 where ranked.id = g.id;

alter table public.gallery_items
  drop constraint if exists gallery_items_tenant_sort_unique,
  add constraint gallery_items_tenant_sort_unique
    unique (tenant_id, sort_order)
    deferrable initially immediate;

create or replace function private.guard_goal90_gallery_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     and current_user not in ('postgres', 'supabase_admin') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('gallery-order:' || new.tenant_id::text, 0)
    );
    select coalesce(max(g.sort_order), -1) + 1
      into new.sort_order
      from public.gallery_items g
     where g.tenant_id = new.tenant_id;
  elsif tg_op = 'UPDATE'
        and new.sort_order is distinct from old.sort_order
        and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'gallery_order_is_db_owned' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_goal90_gallery_order()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_goal90_gallery_order on public.gallery_items;
create trigger trg_goal90_gallery_order
  before insert or update of sort_order on public.gallery_items
  for each row execute function private.guard_goal90_gallery_order();

create or replace function public.reorder_gallery_items(
  p_tenant uuid,
  p_ids uuid[]
) returns table (
  outcome text,
  item_count integer
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
  v_current uuid[];
  v_count integer;
begin
  if v_uid is null
     or not (
       (
         v_tenant = p_tenant
         and coalesce(v_level, 0) >= 6
         and (select private.has_organization_scope())
       )
       or coalesce(v_external_scope, false)
     )
     or not exists (
       select 1 from public.tenants t
        where t.id = p_tenant and t.status = 'active'
     ) then
    raise exception 'gallery_reorder_access_denied' using errcode = '42501';
  end if;

  if (select private.module_state(p_tenant, 'galleri')) not in ('draft', 'live') then
    raise exception 'gallery_module_read_only' using errcode = '55000';
  end if;
  if p_ids is null then
    raise exception 'gallery_reorder_incomplete' using errcode = '22023';
  end if;

  perform 1
    from public.gallery_items g
   where g.tenant_id = p_tenant
   order by g.id
   for update;

  select
    coalesce(array_agg(g.id order by g.sort_order, g.id), '{}'::uuid[]),
    count(*)::integer
    into v_current, v_count
    from public.gallery_items g
   where g.tenant_id = p_tenant;

  if cardinality(p_ids) <> v_count
     or cardinality(p_ids) <> (
       select count(distinct requested.id)
         from unnest(p_ids) as requested(id)
     )
     or exists (
       select 1
         from unnest(p_ids) as requested(id)
        where not exists (
          select 1
            from public.gallery_items g
           where g.id = requested.id
             and g.tenant_id = p_tenant
        )
     ) then
    raise exception 'gallery_reorder_incomplete' using errcode = '22023';
  end if;

  if v_current = p_ids then
    return query select 'already_set'::text, v_count;
    return;
  end if;

  set constraints public.gallery_items_tenant_sort_unique deferred;
  update public.gallery_items g
     set sort_order = requested.position::integer - 1
    from unnest(p_ids) with ordinality as requested(id, position)
   where g.id = requested.id
     and g.tenant_id = p_tenant;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    v_uid,
    'gallery_items.reordered',
    'gallery_items',
    p_tenant,
    jsonb_build_object('item_count', v_count)
  );

  return query select 'changed'::text, v_count;
end;
$$;

revoke all on function public.reorder_gallery_items(uuid, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.reorder_gallery_items(uuid, uuid[])
  to authenticated;

comment on function public.reorder_gallery_items(uuid, uuid[]) is
  'Goal 90: complete-set, tenant-locked and audited gallery reorder.';

commit;
