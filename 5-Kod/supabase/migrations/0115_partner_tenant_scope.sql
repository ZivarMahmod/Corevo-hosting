-- 0115 — DB-backed tenant scope for partner operators.
-- Root stays the only global operator. A partner sees and mutates only rows
-- whose tenant belongs to its live private.partner_id() scope.

begin;

-- Data that a partner may operate directly through the existing server actions.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'blog_posts',
    'content_slots',
    'customer_notes',
    'gallery_items',
    'locations',
    'loyalty_plans',
    'media_assets',
    'services',
    'shop_product_variants',
    'shop_products',
    'shop_shipping_options',
    'tenant_events',
    'tenant_modules',
    'working_hour_slots'
  ] loop
    execute pg_catalog.format(
      'drop policy if exists partner_scope_all on public.%I',
      v_table
    );
    execute pg_catalog.format(
      'create policy partner_scope_all on public.%I for all to authenticated '
      || 'using ((select private.can_access_tenant(tenant_id))) '
      || 'with check ((select private.can_access_tenant(tenant_id)))',
      v_table
    );
    execute pg_catalog.format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      v_table
    );
  end loop;
end
$$;

-- A partner may own several tenants, but rows are never movable between them.
-- RLS USING/WITH CHECK alone only proves that both endpoints are in scope; this
-- trigger preserves each row's original tenant and all of its child relations.
create or replace function private.guard_partner_tenant_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.partner_id()) is not null
     and new.tenant_id is distinct from old.tenant_id then
    raise exception 'partner_tenant_reassignment_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_partner_tenant_reassignment()
  from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'blog_posts',
    'content_slots',
    'customer_notes',
    'gallery_items',
    'locations',
    'loyalty_plans',
    'media_assets',
    'services',
    'shop_product_variants',
    'shop_products',
    'shop_shipping_options',
    'staff',
    'tenant_events',
    'tenant_modules',
    'tenant_settings',
    'shop_orders',
    'working_hour_slots'
  ] loop
    execute pg_catalog.format(
      'drop trigger if exists trg_partner_tenant_immutable on public.%I',
      v_table
    );
    execute pg_catalog.format(
      'create trigger trg_partner_tenant_immutable before update of tenant_id '
      || 'on public.%I for each row execute function private.guard_partner_tenant_reassignment()',
      v_table
    );
  end loop;
end
$$;

-- Variant/product ownership must agree independently of RLS on the variant row.
-- Otherwise a partner could bind an own-tenant variant to another tenant's
-- product UUID and leak/cascade across storefronts.
create or replace function private.guard_shop_catalog_tenant_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'shop_product_variants' and not exists (
    select 1 from public.shop_products p
    where p.id = (to_jsonb(new) ->> 'product_id')::uuid
      and p.tenant_id = new.tenant_id
  ) then
    raise exception 'shop_variant_product_tenant_mismatch' using errcode = '23514';
  end if;
  if new.image_asset_id is not null and not exists (
    select 1 from public.media_assets m
    where m.id = new.image_asset_id and m.tenant_id = new.tenant_id
  ) then
    raise exception 'shop_image_asset_tenant_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_shop_catalog_tenant_refs()
  from public, anon, authenticated;

drop trigger if exists trg_shop_variant_tenant_refs on public.shop_product_variants;
create trigger trg_shop_variant_tenant_refs
  before insert or update of tenant_id, product_id, image_asset_id
  on public.shop_product_variants
  for each row execute function private.guard_shop_catalog_tenant_refs();

drop trigger if exists trg_shop_product_tenant_refs on public.shop_products;
create trigger trg_shop_product_tenant_refs
  before insert or update of tenant_id, image_asset_id
  on public.shop_products
  for each row execute function private.guard_shop_catalog_tenant_refs();

-- Customer rows contain raw PII and identity bindings, so a partner never gets
-- direct table access. Initial lists use this masked read model; explicit reveal
-- stays in get_customer_contact's operational window and erasure keeps its
-- existing atomic RPC path.
drop policy if exists partner_scope_all on public.customers;
drop policy if exists customers_partner_scope on public.customers;

create or replace function public.platform_customer_safe_rows(
  p_tenant uuid default null,
  p_customer uuid default null,
  p_query text default null,
  p_limit integer default 1000
) returns table (
  id uuid,
  tenant_id uuid,
  full_name text,
  display_name text,
  name_hidden boolean,
  status text,
  last_seen_at timestamptz,
  first_seen_at timestamptz,
  auth_user_id uuid,
  masked_email text,
  masked_phone text,
  has_email boolean,
  has_phone boolean,
  tenant_slug text,
  tenant_name text,
  visits bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(pg_catalog.btrim(p_query), '');
begin
  if not (select private.has_platform_access()) then
    raise exception 'platform_operator_required' using errcode = '42501';
  end if;
  if p_tenant is not null and not (select private.can_access_tenant(p_tenant)) then
    raise exception 'platform_customer_scope_denied' using errcode = '42501';
  end if;
  if p_limit not between 1 and 1000 then
    raise exception 'platform_customer_limit_invalid' using errcode = '22023';
  end if;

  return query
  select
    c.id,
    c.tenant_id,
    c.full_name,
    c.display_name,
    c.name_hidden,
    c.status,
    c.last_seen_at,
    c.first_seen_at,
    c.auth_user_id,
    case when nullif(c.email, '') is null then '—' else '•••••@•••' end,
    case
      when nullif(c.phone, '') is null then '—'
      when pg_catalog.length(c.phone) <= 4 then '••••'
      else pg_catalog.substr(c.phone, 1, 4) || ' •• •• ••'
    end,
    nullif(c.email, '') is not null,
    nullif(c.phone, '') is not null,
    t.slug,
    t.name,
    (select pg_catalog.count(*) from public.bookings b where b.customer_id = c.id)
  from public.customers c
  join public.tenants t on t.id = c.tenant_id
  where ((select private.is_platform_admin()) or t.partner_id = (select private.partner_id()))
    and (p_tenant is null or c.tenant_id = p_tenant)
    and (p_customer is null or c.id = p_customer)
    and (
      v_query is null
      or c.full_name ilike '%' || v_query || '%'
      or c.display_name ilike '%' || v_query || '%'
      or c.email ilike '%' || v_query || '%'
    )
  order by c.last_seen_at desc nulls last, c.id
  limit p_limit;
end;
$$;
revoke all on function public.platform_customer_safe_rows(uuid, uuid, text, integer)
  from public, anon;
grant execute on function public.platform_customer_safe_rows(uuid, uuid, text, integer)
  to authenticated;

create or replace function public.platform_create_customer(
  p_tenant uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := pg_catalog.btrim(p_full_name);
  v_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  v_phone text := nullif(pg_catalog.btrim(p_phone), '');
  v_id uuid;
begin
  if (select auth.uid()) is null
     or not (select private.can_access_tenant(p_tenant))
     or not exists (
       select 1 from public.tenants t where t.id = p_tenant and t.status = 'active'
     ) then
    raise exception 'platform_customer_scope_denied' using errcode = '42501';
  end if;
  if pg_catalog.length(v_name) not between 1 and 120
     or pg_catalog.length(v_email) > 254
     or (v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
     or pg_catalog.length(v_phone) > 40 then
    raise exception 'platform_customer_input_invalid' using errcode = '22023';
  end if;

  insert into public.customers (
    tenant_id, full_name, display_name, email, phone, status
  ) values (
    p_tenant, v_name, v_name, v_email, v_phone, 'active'
  ) returning customers.id into v_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant, (select auth.uid()), 'tenant.customer_create', 'customers', v_id,
    jsonb_build_object('source', 'platform')
  );
  return v_id;
end;
$$;
revoke all on function public.platform_create_customer(uuid, text, text, text)
  from public, anon;
grant execute on function public.platform_create_customer(uuid, text, text, text)
  to authenticated;

-- `users` is deliberately excluded from the broad full-DML loop. Since RLS
-- cannot restrict changed columns, restoring table-level UPDATE here would let
-- a signed-in user replace role_id on their own row. Partners may read and
-- provision tenant profiles, but role/status changes go through the narrow,
-- audited RPC below. The historical phone-only direct update remains intact.
drop policy if exists users_partner_read on public.users;
create policy users_partner_read on public.users
  for select to authenticated
  using ((select private.can_access_tenant(tenant_id)));

drop policy if exists users_partner_insert on public.users;
create policy users_partner_insert on public.users
  for insert to authenticated
  with check (
    (select private.partner_id()) is not null
    and (select private.can_access_tenant(tenant_id))
    and exists (
      select 1
      from public.roles r
      where r.id = role_id
        and r.tenant_id = users.tenant_id
        and r.level between 1 and 6
    )
  );

grant select, insert on table public.users to authenticated;
revoke update on table public.users from authenticated;
grant update (phone) on table public.users to authenticated;

create or replace function public.partner_update_tenant_user(
  p_tenant uuid,
  p_user uuid,
  p_role uuid,
  p_status text,
  p_access_scope text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_level integer;
begin
  if (select auth.uid()) is null
     or not (select private.can_access_tenant(p_tenant)) then
    raise exception 'partner_user_scope_denied' using errcode = '42501';
  end if;
  if p_status not in ('active', 'inactive')
     or p_access_scope not in ('organization', 'locations') then
    raise exception 'partner_user_input_invalid' using errcode = '22023';
  end if;

  select r.level into v_role_level
  from public.roles r
  where r.id = p_role
    and r.tenant_id = p_tenant;
  if v_role_level is null or v_role_level not between 1 and 6 then
    raise exception 'partner_user_role_denied' using errcode = '42501';
  end if;

  update public.users u
  set role_id = p_role,
      status = p_status,
      access_scope = p_access_scope,
      updated_at = now()
  where u.id = p_user
    and u.tenant_id = p_tenant;
  if not found then
    raise exception 'partner_user_missing' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'partner.user_update',
    'users',
    p_user,
    jsonb_build_object(
      'role_id', p_role,
      'role_level', v_role_level,
      'status', p_status,
      'access_scope', p_access_scope
    )
  );
end;
$$;
revoke all on function public.partner_update_tenant_user(uuid, uuid, uuid, text, text)
  from public, anon;
grant execute on function public.partner_update_tenant_user(uuid, uuid, uuid, text, text)
  to authenticated;

-- Existing active tenants need the normal staff role before a partner takes
-- over; future onboarding creates it before activation.
insert into public.roles (tenant_id, name, level)
select t.id, 'staff', 3
from public.tenants t
where not exists (
  select 1 from public.roles r
  where r.tenant_id = t.id and r.name = 'staff' and r.level = 3
);

-- Partner onboarding creates only the two fixed tenant-local roles for its own
-- still-provisioning tenant. Global roles and later role mutation stay root-only.
drop policy if exists roles_partner_provisioning_insert on public.roles;
create policy roles_partner_provisioning_insert on public.roles
  for insert to authenticated
  with check (
    (select private.partner_id()) is not null
    and tenant_id is not null
    and (
      (level = 6 and name = 'salon_admin')
      or (level = 3 and name = 'staff')
    )
    and (select private.can_access_tenant(tenant_id))
    and exists (
      select 1 from public.tenants t
      where t.id = roles.tenant_id
        and t.status = 'provisioning'
    )
  );
grant insert on table public.roles to authenticated;

-- Staff is build-once/soft-delete. Partners may operate own rows, but no
-- authenticated operator gets hard-delete back. The final 0081 management
-- trigger is widened only for a DB-proven partner scope.
drop policy if exists partner_scope_all on public.staff;
drop policy if exists staff_partner_read on public.staff;
drop policy if exists staff_partner_insert on public.staff;
drop policy if exists staff_partner_update on public.staff;
create policy staff_partner_read on public.staff
  for select to authenticated
  using ((select private.can_access_tenant(tenant_id)));
create policy staff_partner_insert on public.staff
  for insert to authenticated
  with check ((select private.can_access_tenant(tenant_id)));
create policy staff_partner_update on public.staff
  for update to authenticated
  using ((select private.can_access_tenant(tenant_id)))
  with check ((select private.can_access_tenant(tenant_id)));
grant select, insert, update on table public.staff to authenticated;

create or replace function private.guard_staff_management_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_location uuid := case when tg_op <> 'INSERT' then old.location_id else null end;
  v_new_location uuid := case when tg_op <> 'DELETE' then new.location_id else null end;
  v_old_tenant uuid := case when tg_op <> 'INSERT' then old.tenant_id else null end;
  v_new_tenant uuid := case when tg_op <> 'DELETE' then new.tenant_id else null end;
  v_session_tenant uuid := (select private.tenant_id());
  v_partner uuid := (select private.partner_id());
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin')
     or (select private.is_platform_admin()) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if (select auth.uid()) is null then
    raise exception 'staff_admin_required' using errcode = '42501';
  end if;
  if v_partner is not null
     and (v_old_tenant is null or (select private.can_access_tenant(v_old_tenant)))
     and (v_new_tenant is null or (select private.can_access_tenant(v_new_tenant))) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if (select private.has_organization_scope())
     and (v_old_tenant is null or v_old_tenant = v_session_tenant)
     and (v_new_tenant is null or v_new_tenant = v_session_tenant) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if (v_old_location is not null and not (select private.is_location_admin(v_old_location)))
     or (v_new_location is not null and not (select private.is_location_admin(v_new_location)))
     or (v_old_location is null and v_new_location is null) then
    raise exception 'staff_admin_required' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_staff_management_permission()
  from public, anon, authenticated;

-- Location membership rows are replace-only: SELECT/INSERT/DELETE, never UPDATE.
-- The fence preserves all 0076 role/location validation and adds an exact partner
-- branch without trusting JWT metadata.
drop policy if exists partner_scope_all on public.user_location_access;
drop policy if exists user_location_access_partner_read on public.user_location_access;
drop policy if exists user_location_access_partner_insert on public.user_location_access;
drop policy if exists user_location_access_partner_delete on public.user_location_access;
create policy user_location_access_partner_read on public.user_location_access
  for select to authenticated
  using ((select private.can_access_tenant(tenant_id)));
create policy user_location_access_partner_insert on public.user_location_access
  for insert to authenticated
  with check ((select private.can_access_tenant(tenant_id)));
create policy user_location_access_partner_delete on public.user_location_access
  for delete to authenticated
  using ((select private.can_access_tenant(tenant_id)));
revoke update on table public.user_location_access from authenticated;
grant select, insert, delete on table public.user_location_access to authenticated;

create or replace function private.guard_user_location_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid := (select private.partner_id());
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    if (select auth.uid()) is null then
      raise exception 'location_access_actor_required' using errcode = '42501';
    end if;
    if v_partner is not null then
      if not (select private.can_access_tenant(new.tenant_id)) then
        raise exception 'partner_location_access_scope_denied' using errcode = '42501';
      end if;
    else
      if new.user_id = (select auth.uid()) then
        raise exception 'location_access_self_grant_forbidden' using errcode = '42501';
      end if;
      if not (select private.has_organization_scope()) then
        raise exception 'owner_required' using errcode = '42501';
      end if;
    end if;
    new.created_by := (select auth.uid());
  end if;

  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = new.user_id
      and u.tenant_id = new.tenant_id
      and u.status = 'active'
      and u.access_scope = 'locations'
      and r.tenant_id = u.tenant_id
      and r.level >= 6
  ) or not exists (
    select 1 from public.locations l
    where l.id = new.location_id
      and l.tenant_id = new.tenant_id
      and l.active = true
  ) then
    raise exception 'invalid_location_access_membership' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_user_location_access()
  from public, anon, authenticated;

-- Platform replace operations must be one DB transaction. Otherwise the deferred
-- staff-readiness invariant observes the intermediate DELETE and rejects an active
-- staff member before the replacement INSERT can happen.
create or replace function public.platform_replace_staff_services(
  p_tenant uuid,
  p_staff uuid,
  p_service_ids uuid[] default '{}'::uuid[]
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service_ids uuid[] := coalesce(p_service_ids, '{}'::uuid[]);
  v_count integer;
begin
  if (select auth.uid()) is null or not (select private.can_access_tenant(p_tenant)) then
    raise exception 'platform_staff_scope_denied' using errcode = '42501';
  end if;
  if cardinality(v_service_ids) > 500
     or not exists (select 1 from public.staff s where s.id = p_staff and s.tenant_id = p_tenant)
     or exists (
       select 1
       from unnest(v_service_ids) requested(id)
       left join public.services s on s.id = requested.id and s.tenant_id = p_tenant
       where s.id is null
     ) then
    raise exception 'platform_staff_services_invalid' using errcode = '22023';
  end if;

  delete from public.staff_services ss
  where ss.tenant_id = p_tenant and ss.staff_id = p_staff;
  insert into public.staff_services (tenant_id, staff_id, service_id)
  select p_tenant, p_staff, requested.id
  from (select distinct unnest(v_service_ids) as id) requested;
  get diagnostics v_count = row_count;

  insert into public.audit_log (tenant_id, actor_profile_id, action, entity, entity_id, meta)
  values (
    p_tenant, (select auth.uid()), 'tenant.service_staff_set', 'staff', p_staff,
    jsonb_build_object('services', v_count, 'source', 'platform')
  );
  return v_count;
end;
$$;
revoke all on function public.platform_replace_staff_services(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.platform_replace_staff_services(uuid, uuid, uuid[])
  to authenticated;

create or replace function public.platform_replace_service_staff(
  p_tenant uuid,
  p_service uuid,
  p_staff_ids uuid[] default '{}'::uuid[]
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_ids uuid[] := coalesce(p_staff_ids, '{}'::uuid[]);
  v_count integer;
begin
  if (select auth.uid()) is null or not (select private.can_access_tenant(p_tenant)) then
    raise exception 'platform_service_scope_denied' using errcode = '42501';
  end if;
  if cardinality(v_staff_ids) > 500
     or not exists (select 1 from public.services s where s.id = p_service and s.tenant_id = p_tenant)
     or exists (
       select 1
       from unnest(v_staff_ids) requested(id)
       left join public.staff s on s.id = requested.id and s.tenant_id = p_tenant
       where s.id is null
     ) then
    raise exception 'platform_service_staff_invalid' using errcode = '22023';
  end if;

  delete from public.staff_services ss
  where ss.tenant_id = p_tenant and ss.service_id = p_service;
  insert into public.staff_services (tenant_id, staff_id, service_id)
  select p_tenant, requested.id, p_service
  from (select distinct unnest(v_staff_ids) as id) requested;
  get diagnostics v_count = row_count;

  insert into public.audit_log (tenant_id, actor_profile_id, action, entity, entity_id, meta)
  values (
    p_tenant, (select auth.uid()), 'tenant.service_staff_set', 'services', p_service,
    jsonb_build_object('staff', v_count, 'source', 'platform')
  );
  return v_count;
end;
$$;
revoke all on function public.platform_replace_service_staff(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.platform_replace_service_staff(uuid, uuid, uuid[])
  to authenticated;

create or replace function public.platform_replace_staff_schedule(
  p_tenant uuid,
  p_staff uuid,
  p_rows jsonb default '[]'::jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
  v_location uuid;
  v_count integer;
begin
  if (select auth.uid()) is null or not (select private.can_access_tenant(p_tenant)) then
    raise exception 'platform_staff_scope_denied' using errcode = '42501';
  end if;
  if jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) > 7 then
    raise exception 'platform_staff_schedule_invalid' using errcode = '22023';
  end if;
  select s.location_id into v_location
  from public.staff s
  where s.id = p_staff and s.tenant_id = p_tenant;
  if not found then
    raise exception 'platform_staff_schedule_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(v_rows) row_data(weekday integer, start_time text, end_time text)
    where row_data.weekday is null
       or row_data.weekday not between 0 and 6
       or row_data.start_time is null
       or row_data.end_time is null
       or row_data.start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or row_data.end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or row_data.end_time <= row_data.start_time
  ) or (
    select count(*) <> count(distinct row_data.weekday)
    from jsonb_to_recordset(v_rows) row_data(weekday integer)
  ) then
    raise exception 'platform_staff_schedule_invalid' using errcode = '22023';
  end if;

  delete from public.working_hours wh
  where wh.tenant_id = p_tenant and wh.staff_id = p_staff;
  insert into public.working_hours (
    tenant_id, staff_id, weekday, start_time, end_time, location_id
  )
  select
    p_tenant, p_staff, row_data.weekday,
    row_data.start_time::time, row_data.end_time::time, v_location
  from jsonb_to_recordset(v_rows) row_data(weekday integer, start_time text, end_time text);
  get diagnostics v_count = row_count;

  insert into public.audit_log (tenant_id, actor_profile_id, action, entity, entity_id, meta)
  values (
    p_tenant, (select auth.uid()), 'tenant.staff_schedule', 'staff', p_staff,
    jsonb_build_object('days', v_count, 'source', 'platform')
  );
  return v_count;
end;
$$;
revoke all on function public.platform_replace_staff_schedule(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.platform_replace_staff_schedule(uuid, uuid, jsonb)
  to authenticated;

drop policy if exists partner_scope_all on public.staff_services;
drop policy if exists staff_services_partner_read on public.staff_services;
create policy staff_services_partner_read on public.staff_services
  for select to authenticated
  using ((select private.can_access_tenant(tenant_id)));
grant select on table public.staff_services to authenticated;

drop policy if exists partner_scope_all on public.working_hours;
drop policy if exists working_hours_partner_read on public.working_hours;
create policy working_hours_partner_read on public.working_hours
  for select to authenticated
  using ((select private.can_access_tenant(tenant_id)));
grant select on table public.working_hours to authenticated;

-- Raw delivery rows include payloads, consent state, lease internals and Web Push
-- secrets. Partners consume only the purpose-built safe projections below.
drop policy if exists partner_scope_all on public.notifications_outbox;
drop policy if exists partner_scope_read on public.notifications_outbox;
drop policy if exists partner_scope_all on public.push_subscriptions;
drop policy if exists partner_scope_read on public.push_subscriptions;
drop policy if exists partner_scope_all on public.slot_holds;
drop policy if exists partner_scope_read on public.slot_holds;

-- Ledgers, delivery data and relationship state are inspectable but keep their
-- existing domain-specific mutation paths (RPCs/triggers/service workers).
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'audit_log',
    'booking_status_history',
    'bookings',
    'contact_messages',
    'customer_favorites',
    'customer_notification_prefs',
    'event_registrations',
    'gift_cards',
    'location_closures',
    'location_opening_hours',
    'loyalty_ledger',
    'loyalty_members',
    'offert_requests',
    'payment_disputes',
    'payments',
    'roles',
    'shop_orders',
    'shop_order_items',
    'site_revisions',
    'tenant_member_permissions',
    'tenant_domains',
    'time_off'
  ] loop
    execute pg_catalog.format(
      'drop policy if exists partner_scope_all on public.%I',
      v_table
    );
    execute pg_catalog.format(
      'drop policy if exists partner_scope_read on public.%I',
      v_table
    );
    execute pg_catalog.format(
      'create policy partner_scope_read on public.%I for select to authenticated '
      || 'using ((select private.can_access_tenant(tenant_id)))',
      v_table
    );
    execute pg_catalog.format(
      'grant select on table public.%I to authenticated',
      v_table
    );
  end loop;
end
$$;

-- Settings are a singleton configuration record. Partners may create/update it
-- for own tenants, but cannot delete and recreate the row to reset guarded
-- billing/payment fields or erase configuration history.
drop policy if exists partner_scope_all on public.tenant_settings;
drop policy if exists tenant_settings_partner_write on public.tenant_settings;
drop policy if exists tenant_settings_partner_read on public.tenant_settings;
drop policy if exists tenant_settings_partner_insert on public.tenant_settings;
drop policy if exists tenant_settings_partner_update on public.tenant_settings;
create policy tenant_settings_partner_read on public.tenant_settings
  for select to authenticated
  using ((select private.can_access_tenant(tenant_id)));
create policy tenant_settings_partner_insert on public.tenant_settings
  for insert to authenticated
  with check ((select private.can_access_tenant(tenant_id)));
create policy tenant_settings_partner_update on public.tenant_settings
  for update to authenticated
  using ((select private.can_access_tenant(tenant_id)))
  with check ((select private.can_access_tenant(tenant_id)));
grant select, insert, update on table public.tenant_settings to authenticated;

-- A partner may run the same manual fulfilment FSM as a tenant owner. The
-- existing shop-order trigger permits only status/tracking fields and rejects
-- payment, totals, customer snapshot and stock-latch mutations.
drop policy if exists shop_orders_partner_update on public.shop_orders;
create policy shop_orders_partner_update on public.shop_orders
  for update to authenticated
  using ((select private.can_access_tenant(tenant_id)))
  with check ((select private.can_access_tenant(tenant_id)));
grant update on table public.shop_orders to authenticated;

-- Inventory reservations are machine-owned even though operators may edit the
-- rest of a product variant/event. Checkout SECURITY DEFINER RPCs run as their
-- privileged owner; direct authenticated DML cannot forge held stock/capacity.
create or replace function private.guard_partner_inventory_counters()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role')
     or coalesce((select auth.role()), '') = 'service_role'
     or (select private.is_platform_admin()) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'INSERT' and coalesce(new.reserved_qty, 0) <> 0 then
    raise exception 'inventory_reservation_is_machine_owned' using errcode = '42501';
  elsif tg_op = 'UPDATE' and new.reserved_qty is distinct from old.reserved_qty then
    raise exception 'inventory_reservation_is_machine_owned' using errcode = '42501';
  elsif tg_op = 'DELETE' then
    if coalesce(old.reserved_qty, 0) <> 0 then
      raise exception 'inventory_has_active_reservations' using errcode = '23503';
    end if;
    if tg_table_name = 'shop_product_variants' and exists (
      select 1
      from public.shop_order_items oi
      join public.shop_orders so on so.id = oi.order_id
      where oi.variant_id = old.id
        and so.status in ('reserved', 'awaiting_payment')
    ) then
      raise exception 'inventory_has_active_order_hold' using errcode = '23503';
    end if;
    if tg_table_name = 'tenant_events' and (
      exists (select 1 from public.shop_order_items oi where oi.event_id = old.id)
      or exists (
        select 1 from public.event_registrations er
        where er.event_id = old.id and er.status = 'confirmed'
      )
    ) then
      raise exception 'event_has_registration_history' using errcode = '23503';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_partner_inventory_counters() from public;

drop trigger if exists trg_shop_variant_reserved_guard on public.shop_product_variants;
create trigger trg_shop_variant_reserved_guard
  before insert or update of reserved_qty on public.shop_product_variants
  for each row execute function private.guard_partner_inventory_counters();
drop trigger if exists trg_shop_variant_delete_guard on public.shop_product_variants;
create trigger trg_shop_variant_delete_guard
  before delete on public.shop_product_variants
  for each row execute function private.guard_partner_inventory_counters();

drop trigger if exists trg_tenant_event_reserved_guard on public.tenant_events;
create trigger trg_tenant_event_reserved_guard
  before insert or update of reserved_qty on public.tenant_events
  for each row execute function private.guard_partner_inventory_counters();
drop trigger if exists trg_tenant_event_delete_guard on public.tenant_events;
create trigger trg_tenant_event_delete_guard
  before delete on public.tenant_events
  for each row execute function private.guard_partner_inventory_counters();

-- Reuse the validated location schedule RPC for root/partner operators. The
-- legacy tenant-owner/location-manager branch remains byte-for-byte equivalent.
create or replace function private.require_location_admin(p_location uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tenant uuid;
begin
  select l.tenant_id into v_tenant
  from public.locations l
  where l.id = p_location and l.active = true;
  if v_tenant is null then
    raise exception 'location_admin_required' using errcode = '42501';
  end if;
  if (select private.can_access_tenant(v_tenant)) then
    return v_tenant;
  end if;
  if v_tenant is distinct from (select private.tenant_id())
     or not (
       (select private.is_location_admin(p_location))
       or (
         (select private.has_admin_area_permission('scheman'))
         and (select private.can_access_location(p_location))
       )
     ) then
    raise exception 'location_admin_required' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;
revoke all on function private.require_location_admin(uuid) from public, anon, authenticated;

-- Inbox state is the only mutable contact-message field in platform UI. Keep
-- anonymous intake service-only and perform the state transition + audit in one
-- scoped transaction for root, partner and tenant owner alike.
create or replace function public.platform_set_contact_message_status(
  p_tenant uuid,
  p_message uuid,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (
       (select private.can_access_tenant(p_tenant))
       or (
         (select private.tenant_id()) = p_tenant
         and (select private.has_organization_scope())
       )
     ) then
    raise exception 'contact_message_scope_denied' using errcode = '42501';
  end if;
  if p_status not in ('new', 'read', 'archived') then
    raise exception 'contact_message_status_invalid' using errcode = '22023';
  end if;

  update public.contact_messages cm
  set status = p_status
  where cm.id = p_message
    and cm.tenant_id = p_tenant;
  if not found then
    raise exception 'contact_message_missing' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'tenant.contact',
    'contact_messages',
    p_message,
    jsonb_build_object('contact_message', p_status)
  );
  return true;
end;
$$;
revoke all on function public.platform_set_contact_message_status(uuid, uuid, text)
  from public, anon;
grant execute on function public.platform_set_contact_message_status(uuid, uuid, text)
  to authenticated;

-- The snapshot editor's SECURITY DEFINER RPCs share one access assertion. Keep
-- the existing tenant-admin branch and add the DB-authoritative platform scope.
create or replace function private.assert_site_revision_access(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (
    (select private.can_access_tenant(p_tenant))
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

-- Communication detail reader. Partner filters are applied inside the SECURITY
-- DEFINER body; UI filters can only narrow that result further.
create or replace function public.platform_outbox_rows(
  p_tenant uuid default null,
  p_channel text default null,
  p_status text default null,
  p_category text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  event_type text,
  category text,
  chosen_channel text,
  status text,
  cost_ore integer,
  skip_reason text,
  provider_ref text,
  created_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_global boolean := (select private.is_platform_admin());
  v_partner uuid := (select private.partner_id());
begin
  if not v_global and v_partner is null then
    raise exception 'platform_operator_required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 250 then
    raise exception 'platform_outbox_limit_invalid' using errcode = '22023';
  end if;
  if p_tenant is not null and (
    not (select private.can_access_tenant(p_tenant))
    or not exists (
      select 1 from public.tenants t where t.id = p_tenant and t.status <> 'deleted'
    )
  ) then
    raise exception 'platform_outbox_tenant_invalid' using errcode = '22023';
  end if;
  if p_channel is not null and (
    p_channel = '' or p_channel <> btrim(p_channel) or length(p_channel) > 100
  ) then
    raise exception 'platform_outbox_channel_invalid' using errcode = '22023';
  end if;
  if p_status is not null and (
    p_status = '' or p_status <> btrim(p_status) or length(p_status) > 100
  ) then
    raise exception 'platform_outbox_status_invalid' using errcode = '22023';
  end if;
  if p_category is not null and (
    p_category = '' or p_category <> btrim(p_category) or length(p_category) > 100
  ) then
    raise exception 'platform_outbox_category_invalid' using errcode = '22023';
  end if;

  return query
  select
    o.id, o.tenant_id, t.slug, t.name, o.event_type, o.category,
    o.chosen_channel, o.status, o.cost_ore, o.skip_reason, o.provider_ref,
    o.created_at, o.sent_at, o.delivered_at
  from public.notifications_outbox o
  join public.tenants t on t.id = o.tenant_id
  where t.status <> 'deleted'
    and (v_global or t.partner_id = v_partner)
    and (p_tenant is null or o.tenant_id = p_tenant)
    and (p_channel is null or o.chosen_channel = p_channel)
    and (p_status is null or o.status = p_status)
    and (p_category is null or o.category = p_category)
  order by o.created_at desc, o.id desc
  limit p_limit;
end;
$$;
revoke all on function public.platform_outbox_rows(uuid, text, text, text, integer)
  from public, anon;
grant execute on function public.platform_outbox_rows(uuid, text, text, text, integer)
  to authenticated, service_role;

create or replace function public.platform_outbox_summary()
returns table (
  tenant_id uuid,
  slug text,
  name text,
  sent_30d bigint,
  failed_30d bigint,
  skipped_30d bigint,
  sms_cost_ore_30d bigint,
  customers_total bigint,
  prefs_rows bigint,
  push_subs_active bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_global boolean := (select private.is_platform_admin());
  v_partner uuid := (select private.partner_id());
begin
  if not v_global and v_partner is null then
    raise exception 'platform_operator_required' using errcode = '42501';
  end if;

  return query
  with scoped_tenants as (
    select t.id, t.slug, t.name
    from public.tenants t
    where t.status <> 'deleted'
      and (v_global or t.partner_id = v_partner)
  ), recent_outbox as (
    select
      o.tenant_id,
      pg_catalog.count(*) filter (where o.status in ('sent', 'delivered')) as sent_30d,
      pg_catalog.count(*) filter (where o.status = 'failed') as failed_30d,
      pg_catalog.count(*) filter (where o.status = 'skipped') as skipped_30d,
      coalesce(
        pg_catalog.sum(o.cost_ore) filter (
          where o.chosen_channel = 'sms' and o.status <> 'simulated'
        ),
        0::bigint
      ) as sms_cost_ore_30d
    from public.notifications_outbox o
    join scoped_tenants st on st.id = o.tenant_id
    where o.created_at > pg_catalog.now() - interval '30 days'
    group by o.tenant_id
  ), active_customer_totals as (
    select c.tenant_id, pg_catalog.count(*) as customers_total
    from public.customers c
    join scoped_tenants st on st.id = c.tenant_id
    where c.status = 'active'
    group by c.tenant_id
  ), active_customer_prefs as (
    select c.tenant_id, pg_catalog.count(*) as prefs_rows
    from public.customers c
    join scoped_tenants st on st.id = c.tenant_id
    join public.customer_notification_prefs p
      on p.customer_id = c.id and p.tenant_id = c.tenant_id
    where c.status = 'active'
    group by c.tenant_id
  ), active_push_customers as (
    select c.tenant_id, pg_catalog.count(distinct c.id) as push_subs_active
    from public.customers c
    join scoped_tenants st on st.id = c.tenant_id
    join public.push_subscriptions s
      on s.customer_id = c.id and s.tenant_id = c.tenant_id and s.revoked_at is null
    where c.status = 'active'
    group by c.tenant_id
  )
  select
    t.id,
    t.slug,
    t.name,
    coalesce(o.sent_30d, 0::bigint),
    coalesce(o.failed_30d, 0::bigint),
    coalesce(o.skipped_30d, 0::bigint),
    coalesce(o.sms_cost_ore_30d, 0::bigint),
    coalesce(c.customers_total, 0::bigint),
    coalesce(p.prefs_rows, 0::bigint),
    coalesce(s.push_subs_active, 0::bigint)
  from scoped_tenants t
  left join recent_outbox o on o.tenant_id = t.id
  left join active_customer_totals c on c.tenant_id = t.id
  left join active_customer_prefs p on p.tenant_id = t.id
  left join active_push_customers s on s.tenant_id = t.id
  order by t.name;
end;
$$;
revoke all on function public.platform_outbox_summary() from public, anon;
grant execute on function public.platform_outbox_summary() to authenticated, service_role;

-- Partner gets queue health for its own tenants, never global scheduler/cron
-- internals. Root keeps the full heartbeat result and the separate cron RPC.
create or replace function public.platform_drift_health(
  p_tenant uuid default null
)
returns table (
  tenant_id uuid,
  routing_count bigint,
  queued_count bigint,
  attempting_count bigint,
  delivery_started_count bigint,
  stalled_count bigint,
  failed_24h_count bigint,
  oldest_ready_at timestamptz,
  scheduler_name text,
  scheduler_last_status text,
  scheduler_last_started_at timestamptz,
  scheduler_last_succeeded_at timestamptz,
  scheduler_last_failed_at timestamptz,
  scheduler_last_error_code text,
  scheduler_updated_at timestamptz,
  scheduler_age_seconds integer,
  scheduler_healthy boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_global boolean := (select private.is_platform_admin());
  v_partner uuid := (select private.partner_id());
begin
  if not v_global and v_partner is null then
    raise exception 'platform_operator_required' using errcode = '42501';
  end if;
  if p_tenant is not null and (
    not (select private.can_access_tenant(p_tenant))
    or not exists (
      select 1 from public.tenants t where t.id = p_tenant and t.status <> 'deleted'
    )
  ) then
    raise exception 'platform_drift_tenant_invalid' using errcode = '22023';
  end if;

  return query
  with queue as (
    select
      count(*) filter (where o.status = 'routing')::bigint as routing_count,
      count(*) filter (where o.status = 'queued')::bigint as queued_count,
      count(*) filter (where o.status = 'attempting')::bigint as attempting_count,
      count(*) filter (where o.status = 'delivery_started')::bigint as delivery_started_count,
      count(*) filter (
        where (o.status = 'routing' and o.updated_at <= now() - interval '15 minutes')
           or (o.status = 'attempting' and (o.lease_expires_at is null or o.lease_expires_at <= now()))
           or (o.status = 'delivery_started' and o.updated_at <= now() - interval '15 minutes')
      )::bigint as stalled_count,
      count(*) filter (where o.status = 'failed')::bigint as failed_24h_count,
      min(o.available_at) filter (
        where o.status = 'queued' and o.available_at <= now()
      ) as oldest_ready_at
    from public.notifications_outbox o
    join public.tenants t on t.id = o.tenant_id
    where (v_global or t.partner_id = v_partner)
      and (p_tenant is null or o.tenant_id = p_tenant)
      and (
        o.status in ('routing', 'queued', 'attempting', 'delivery_started')
        or (o.status = 'failed' and o.updated_at > now() - interval '24 hours')
      )
  ), heartbeat as (
    select h.*
    from private.scheduler_heartbeats h
    where v_global and h.scheduler_name = 'cloudflare-reminders-primary'
    limit 1
  )
  select
    p_tenant,
    q.routing_count,
    q.queued_count,
    q.attempting_count,
    q.delivery_started_count,
    q.stalled_count,
    q.failed_24h_count,
    q.oldest_ready_at,
    h.scheduler_name,
    h.last_status,
    h.last_started_at,
    h.last_succeeded_at,
    h.last_failed_at,
    h.last_error_code,
    h.updated_at,
    case when h.last_succeeded_at is null then null else
      greatest(0, floor(extract(epoch from (now() - h.last_succeeded_at))))::integer
    end,
    case when not v_global then null else coalesce(
      h.last_succeeded_at >= now() - interval '35 minutes'
      and (h.last_failed_at is null or h.last_failed_at <= h.last_succeeded_at),
      false
    ) end
  from queue q
  left join heartbeat h on true;
end;
$$;
revoke all on function public.platform_drift_health(uuid) from public, anon;
grant execute on function public.platform_drift_health(uuid) to authenticated, service_role;

-- The legacy owner-field trigger predates partners and otherwise blocks the
-- provisioning -> active transition plus pause/resume actions. A partner may
-- change status and vertical only inside its fixed tenant scope; global identity,
-- plan and Stripe fields stay root-only.
create or replace function private.guard_tenants_owner_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_root boolean := (select private.is_platform_admin());
  v_partner_scope boolean :=
    (select private.partner_id()) is not null
    and (select private.can_access_tenant(old.id))
    and new.partner_id is not distinct from old.partner_id;
  v_partner_vertical_allowed boolean :=
    v_partner_scope
    and old.status = 'provisioning'
    and new.status = 'provisioning';
begin
  if not v_service and not v_root and (
    new.id is distinct from old.id
    or new.slug is distinct from old.slug
    or new.plan is distinct from old.plan
    or (new.status is distinct from old.status and not v_partner_scope)
    or new.partner_id is distinct from old.partner_id
    or new.stripe_account_id is distinct from old.stripe_account_id
    or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
    or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
    or new.stripe_details_submitted is distinct from old.stripe_details_submitted
    or (new.vertical_id is distinct from old.vertical_id and not v_partner_vertical_allowed)
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'platform_tenant_fields_are_read_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_tenants_owner_fields() from public;

-- Direct Data API inserts must have the same root-owned defaults as onboarding.
-- The authenticated partner may choose only normal presentation fields; identity,
-- lifecycle, plan and payment readiness are rewritten to safe DB-owned values.
create or replace function private.guard_partner_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid := (select private.partner_id());
begin
  if v_partner is null then
    return new;
  end if;
  if new.partner_id is distinct from v_partner then
    raise exception 'partner_tenant_insert_scope_forbidden' using errcode = '42501';
  end if;

  new.id := gen_random_uuid();
  new.partner_id := v_partner;
  new.plan := 'standard';
  new.status := 'provisioning';
  new.stripe_account_id := null;
  new.stripe_charges_enabled := false;
  new.stripe_payouts_enabled := false;
  new.stripe_details_submitted := false;
  new.vertical_id := null;
  new.created_at := now();
  new.updated_at := null;
  return new;
end;
$$;
revoke all on function private.guard_partner_tenant_insert()
  from public, anon, authenticated;

drop trigger if exists trg_partner_tenant_insert_guard on public.tenants;
create trigger trg_partner_tenant_insert_guard
  before insert on public.tenants
  for each row execute function private.guard_partner_tenant_insert();

-- A partner is the platform operator for its own tenants. It may activate the
-- modules it sells there, while tenant owners/staff remain subject to the legacy
-- off->live platform fence.
create or replace function public.tenant_modules_state_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  no_request boolean := (v_claims is null or v_claims = '');
  is_admin boolean := coalesce((select private.is_platform_admin()), false);
  is_partner boolean := coalesce(
    (select private.partner_id()) is not null
    and (select private.can_access_tenant(new.tenant_id)),
    false
  );
  is_service boolean := coalesce(nullif(v_claims, '')::jsonb ->> 'role', '') = 'service_role'
                        or current_user = 'service_role';
begin
  if (tg_op = 'INSERT' and new.state <> 'off')
     or (tg_op = 'UPDATE' and old.state = 'off' and new.state <> 'off') then
    if not (no_request or is_admin or is_partner or is_service) then
      raise exception
        'off->% (modul-aktivering) kräver plattformsbehörighet', new.state
        using errcode = '42501';
    end if;
    if new.activated_at is null then
      new.activated_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Billing writes stay behind a narrow RPC. Direct Data API writes by a partner
-- must not toggle Corevo service-fee/payment fields or bypass amount validation.
create or replace function private.guard_tenant_settings_billing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_privileged boolean :=
    current_user in ('postgres', 'service_role')
    or coalesce((select auth.role()), '') = 'service_role'
    or (select private.is_platform_admin());
begin
  if not v_privileged then
    if tg_op = 'INSERT' and (
      new.billing_model is distinct from 'per_booking'
      or new.service_fee_type is distinct from 'fixed'
      or new.service_fee_value is distinct from 500
      or new.setup_fee_cents is distinct from 0
      or new.per_booking_fee_cents is distinct from 0
      or new.flat_monthly_fee_cents is distinct from 0
      or new.payments_enabled is distinct from false
    ) then
      raise exception 'platform_billing_fields_are_read_only' using errcode = '42501';
    elsif tg_op = 'UPDATE' and (
      new.billing_model is distinct from old.billing_model
      or new.service_fee_type is distinct from old.service_fee_type
      or new.service_fee_value is distinct from old.service_fee_value
      or new.setup_fee_cents is distinct from old.setup_fee_cents
      or new.per_booking_fee_cents is distinct from old.per_booking_fee_cents
      or new.flat_monthly_fee_cents is distinct from old.flat_monthly_fee_cents
      or new.payments_enabled is distinct from old.payments_enabled
    ) then
      raise exception 'platform_billing_fields_are_read_only' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_tenant_settings_billing() from public;

create or replace function public.platform_save_tenant_billing(
  p_tenant uuid,
  p_billing_model text,
  p_setup_fee_cents integer,
  p_per_booking_fee_cents integer,
  p_flat_monthly_fee_cents integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (select private.can_access_tenant(p_tenant)) then
    raise exception 'platform_billing_scope_denied' using errcode = '42501';
  end if;
  if p_billing_model not in ('per_booking', 'flat_monthly')
     or p_setup_fee_cents not between 0 and 100000000
     or p_per_booking_fee_cents not between 0 and 100000000
     or p_flat_monthly_fee_cents not between 0 and 100000000 then
    raise exception 'platform_billing_input_invalid' using errcode = '22023';
  end if;

  update public.tenant_settings ts
  set billing_model = p_billing_model,
      setup_fee_cents = p_setup_fee_cents,
      per_booking_fee_cents = p_per_booking_fee_cents,
      flat_monthly_fee_cents = p_flat_monthly_fee_cents,
      updated_at = now()
  where ts.tenant_id = p_tenant;
  if not found then
    raise exception 'platform_billing_tenant_missing' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'tenant.billing',
    'tenant_settings',
    p_tenant,
    jsonb_build_object('billing_model', p_billing_model)
  );
end;
$$;
revoke all on function public.platform_save_tenant_billing(uuid, text, integer, integer, integer)
  from public, anon;
grant execute on function public.platform_save_tenant_billing(uuid, text, integer, integer, integer)
  to authenticated;

-- Partner mutations use the existing append-only audit table. Bind every row
-- to both the verified actor and an own tenant; no update/delete policy exists.
drop policy if exists audit_log_partner_insert on public.audit_log;
create policy audit_log_partner_insert on public.audit_log
  for insert to authenticated
  with check (
    (select private.partner_id()) is not null
    and (select private.can_access_tenant(tenant_id))
    and actor_profile_id = (select auth.uid())
  );
grant insert on table public.audit_log to authenticated;

-- The customer-contact RPC remains window-gated but recognizes a partner only
-- for customers inside private.can_access_tenant(). Raw JWT hints never suffice.
create or replace function public.get_customer_contact(
  p_customer uuid,
  p_before_h int default 720,
  p_after_h int default 24
) returns table (
  display_name text,
  full_name text,
  email text,
  phone text,
  pii_visible boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_before_h constant int := 720;
  v_after_h constant int := 24;
  v_tenant uuid := (select private.tenant_id());
  v_uid uuid := (select auth.uid());
  v_level int := (select private.role_level());
  v_platform boolean := (select private.is_platform_admin());
  v_partner boolean := (select private.partner_id()) is not null;
  v_org_scope boolean := (select private.has_organization_scope());
  v_row public.customers%rowtype;
  v_customer_self boolean := false;
  v_staff_allowed boolean := false;
  v_partner_allowed boolean := false;
  v_in_window boolean := false;
begin
  if v_uid is null or (v_tenant is null and not v_platform and not v_partner) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.customers c where c.id = p_customer;
  if v_row.id is null then return; end if;

  v_partner_allowed := v_partner and (select private.can_access_tenant(v_row.tenant_id));
  v_customer_self :=
    v_row.tenant_id = v_tenant
    and coalesce(v_row.auth_user_id = v_uid, false);
  v_staff_allowed :=
    v_row.tenant_id = v_tenant
    and v_level >= 3
    and (v_org_scope or (select private.can_access_customer(p_customer)));

  if not coalesce(v_platform or v_partner_allowed or v_customer_self or v_staff_allowed, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_customer_self then
    v_in_window := true;
  else
    select exists (
      select 1
      from public.bookings b
      where b.tenant_id = v_row.tenant_id
        and b.customer_id = p_customer
        and b.status in ('pending', 'confirmed', 'completed')
        and b.start_ts between (now() - make_interval(hours => v_before_h))
                           and (now() + make_interval(hours => v_after_h))
        and (
          v_platform
          or v_partner_allowed
          or v_org_scope
          or (v_level >= 3 and (select private.can_access_location(b.location_id)))
        )
    ) into v_in_window;
  end if;

  display_name := case
    when v_row.name_hidden then nullif(left(btrim(coalesce(v_row.full_name, '')), 1), '')
    else coalesce(nullif(btrim(v_row.display_name), ''), nullif(btrim(v_row.full_name), ''))
  end;
  pii_visible := v_in_window;
  full_name := case when v_in_window and not v_row.name_hidden then v_row.full_name else null end;
  email := case when v_in_window then v_row.email else null end;
  phone := case when v_in_window then v_row.phone else null end;
  return next;
end;
$$;
revoke all on function public.get_customer_contact(uuid, int, int)
  from public, anon, authenticated, service_role;
grant execute on function public.get_customer_contact(uuid, int, int) to authenticated;

commit;
