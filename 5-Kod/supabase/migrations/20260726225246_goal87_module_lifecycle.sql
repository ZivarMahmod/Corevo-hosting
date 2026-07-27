-- Goal 87 — one DB-owned module lifecycle, public gate and readiness source.
--
-- The migration deliberately does not seed tenant_modules. The catalog already
-- contains the nine approved modules; this migration verifies that invariant,
-- repairs the late loyalty preset drift, and fails rather than inventing data.

-- ── 1. Canonical catalog contract ────────────────────────────────────────────

update public.verticals
   set default_modules =
         (default_modules - 'loyalty')
         || pg_catalog.jsonb_build_object('lojalitet',
              coalesce(default_modules -> 'lojalitet', default_modules -> 'loyalty')
            )
 where default_modules ? 'loyalty';

do $$
declare
  v_modules constant text[] := array[
    'booking',
    'media_library',
    'shop',
    'offert',
    'blogg',
    'lojalitet',
    'presentkort',
    'kurser',
    'galleri'
  ]::text[];
begin
  if (
    select pg_catalog.count(*)
      from public.modules m
     where m.key = any(v_modules)
  ) <> pg_catalog.cardinality(v_modules) then
    raise exception 'goal87_module_catalog_incomplete' using errcode = '23514';
  end if;

  if exists (select 1 from public.modules m where m.key = 'loyalty') then
    raise exception 'goal87_noncanonical_loyalty_module' using errcode = '23514';
  end if;

  if exists (
    select 1
     from public.verticals v
      cross join lateral pg_catalog.jsonb_each_text(v.default_modules) preset(module_key, state)
     where not (preset.module_key = any(v_modules))
        or preset.state is null
        or preset.state not in ('off', 'draft', 'live', 'paused')
        or not exists (
          select 1 from public.modules m where m.key = preset.module_key
        )
  ) then
    raise exception 'goal87_invalid_vertical_module_preset' using errcode = '23514';
  end if;
end;
$$;

-- ── 2. Shared, fail-closed module resolvers ─────────────────────────────────

create or replace function private.module_state(p_tenant uuid, p_module text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select tm.state
        from public.tenant_modules tm
       where tm.tenant_id = p_tenant
         and tm.module_key = p_module
       limit 1
    ),
    case when p_module = 'booking' then 'live' else 'off' end
  )
$$;

revoke all on function private.module_state(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.module_public_readable(p_tenant uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tenants t
     where t.id = p_tenant
       and t.status = 'active'
  )
  and private.module_state(p_tenant, p_module) in ('live', 'paused')
$$;

revoke all on function private.module_public_readable(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.module_public_readable(uuid, text) to anon;

create or replace function private.module_readiness_missing(p_tenant uuid, p_module text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Goal 87 does not invent Goal 90–92 product requirements. Booking retains
  -- the existing launch blockers; non-live modules cannot receive an action
  -- and therefore do not need those blockers evaluated.
  if p_module = 'booking'
     and private.module_state(p_tenant, p_module) = 'live' then
    return private.tenant_launch_missing(p_tenant);
  end if;

  return '{}'::text[];
end;
$$;

revoke all on function private.module_readiness_missing(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.module_public_action_allowed(p_tenant uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tenants t
     where t.id = p_tenant
       and t.status = 'active'
  )
  and private.module_state(p_tenant, p_module) = 'live'
  and pg_catalog.cardinality(
        private.module_readiness_missing(p_tenant, p_module)
      ) = 0
$$;

revoke all on function private.module_public_action_allowed(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.guard_offert_public_intake_goal87()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_maintenance boolean :=
    session_user in ('postgres', 'supabase_admin')
    and coalesce((select auth.role()), '') = '';
begin
  -- SQL migrations/tests retain their trusted fixture seam. Every API request
  -- (currently the server-only service_role intake) must pass the DB-owned gate.
  if not v_maintenance
     and not private.module_public_action_allowed(new.tenant_id, 'offert') then
    raise exception 'module_public_action_denied' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_offert_public_intake_goal87()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_offert_public_intake_goal87
  on public.offert_requests;
create trigger trg_offert_public_intake_goal87
  before insert on public.offert_requests
  for each row execute function private.guard_offert_public_intake_goal87();

create or replace function public.tenant_module_readiness(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_modules constant text[] := array[
    'booking',
    'media_library',
    'shop',
    'offert',
    'blogg',
    'lojalitet',
    'presentkort',
    'kurser',
    'galleri'
  ]::text[];
  v_module text;
  v_state text;
  v_missing text[];
  v_status text;
  v_result jsonb := '{}'::jsonb;
  v_ready boolean := true;
  v_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_customer_admin boolean := false;
begin
  v_customer_admin :=
    (select auth.uid()) is not null
    and (select private.tenant_id()) = p_tenant
    and coalesce((select private.has_organization_scope()), false);

  if not v_service
     and not coalesce((select private.can_access_tenant(p_tenant)), false)
     and not v_customer_admin then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  select t.status
    into v_status
    from public.tenants t
   where t.id = p_tenant;
  if not found then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  v_ready := v_status = 'active';

  foreach v_module in array v_modules
  loop
    v_state := private.module_state(p_tenant, v_module);
    v_missing := private.module_readiness_missing(p_tenant, v_module);

    if v_state = 'live'
       and not private.module_public_action_allowed(p_tenant, v_module) then
      v_ready := false;
    end if;

    v_result := v_result || pg_catalog.jsonb_build_object(
      v_module,
      pg_catalog.jsonb_build_object(
        'state', v_state,
        'missing', pg_catalog.to_jsonb(v_missing),
        'public_readable',
          private.module_public_readable(p_tenant, v_module),
        'public_action_allowed',
          private.module_public_action_allowed(p_tenant, v_module)
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'ready', v_ready,
    'tenant_status', v_status,
    'modules', v_result
  );
end;
$$;

revoke all on function public.tenant_module_readiness(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.tenant_module_readiness(uuid)
  to authenticated, service_role;

-- ── 3. Central tenant_modules state/identity/default guard ──────────────────

create or replace function public.tenant_modules_state_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_no_request boolean :=
    session_user in ('postgres', 'supabase_admin')
    and coalesce((select auth.role()), '') = '';
  v_service boolean := coalesce(nullif(v_claims, '')::jsonb ->> 'role', '') = 'service_role';
  v_operator boolean := false;
  v_customer_admin boolean := false;
  v_active boolean := false;
  v_default_config jsonb;
begin
  if tg_op = 'DELETE' then
    -- A direct row delete would turn explicit booking=off back into the legacy
    -- missing-row live default. Keep tenant teardown working: an FK cascade
    -- reaches this trigger only after its parent tenant row has disappeared.
    if exists (
      select 1 from public.tenants t where t.id = old.tenant_id
    ) then
      raise exception 'tenant_module_delete_forbidden' using errcode = '23514';
    end if;
    return old;
  end if;

  v_operator :=
    coalesce((select private.is_platform_admin()), false)
    or coalesce(
      (select private.partner_id()) is not null
      and (select private.can_access_tenant(new.tenant_id)),
      false
    );

  v_customer_admin :=
    (select auth.uid()) is not null
    and (select private.tenant_id()) = new.tenant_id
    and coalesce((select private.has_organization_scope()), false);

  select exists (
    select 1
      from public.tenants t
     where t.id = new.tenant_id
       and t.status = 'active'
  ) into v_active;

  if not (v_no_request or v_operator) and not v_active then
    raise exception 'inactive_tenant_module_mutation' using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if not (v_no_request or v_operator or v_service or v_customer_admin) then
      raise exception 'tenant_module_access_denied' using errcode = '42501';
    end if;
    if new.state <> 'off' then
      raise exception 'tenant_module_insert_must_start_off' using errcode = '23514';
    end if;
    if new.activated_at is not null then
      raise exception 'tenant_module_activation_metadata_is_db_owned'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.module_key is distinct from old.module_key
     or new.created_at is distinct from old.created_at then
    raise exception 'tenant_module_identity_is_immutable' using errcode = '23514';
  end if;

  -- A caller may never forge, clear or move activated_at. The guard itself
  -- stamps the first legal off→draft transition below.
  if new.activated_at is distinct from old.activated_at then
    raise exception 'tenant_module_activation_metadata_is_immutable'
      using errcode = '23514';
  end if;

  if not (v_no_request or v_operator or v_service or v_customer_admin) then
    raise exception 'tenant_module_access_denied' using errcode = '42501';
  end if;

  if new.state = old.state then
    if new.config is distinct from old.config
       and old.state not in ('draft', 'live')
       and not (v_no_request or v_operator) then
      raise exception 'tenant_module_config_not_writable_in_state'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if not (
    (old.state = 'off' and new.state = 'draft')
    or (old.state = 'draft' and new.state = 'live')
    or (old.state = 'live' and new.state = 'paused')
    or (old.state = 'paused' and new.state = 'live')
    or (old.state in ('draft', 'live') and new.state = 'off')
  ) then
    raise exception 'illegal_tenant_module_state_transition'
      using errcode = '23514',
            detail = old.state || '->' || new.state;
  end if;

  if (old.state = 'off' and new.state = 'draft')
     or (old.state in ('draft', 'live') and new.state = 'off') then
    if not (v_no_request or v_operator) then
      raise exception 'platform_operator_required' using errcode = '42501';
    end if;
  elsif not (v_no_request or v_operator or v_customer_admin) then
    -- service_role is not a human entitlement authority.
    raise exception 'module_state_operator_required' using errcode = '42501';
  end if;

  if not (
       old.state = 'off'
       and new.state = 'draft'
       and old.activated_at is null
     )
     and new.config is distinct from old.config then
    raise exception 'module_state_change_must_preserve_config'
      using errcode = '23514';
  end if;

  if old.state = 'off' and new.state = 'draft'
     and old.activated_at is null then
    select m.default_config
      into v_default_config
      from public.modules m
     where m.key = new.module_key;
    if not found then
      raise exception 'unknown_module' using errcode = '23503';
    end if;

    new.config := v_default_config || new.config;
    new.activated_at := pg_catalog.now();
  end if;

  return new;
end;
$$;

revoke all on function public.tenant_modules_state_guard()
  from public, anon, authenticated, service_role;

-- The existing BEFORE INSERT OR UPDATE trigger keeps its OID dependency on the
-- replaced function. Recreate it explicitly so a partially drifted preview is
-- repaired as part of the same transaction.
drop trigger if exists trg_tenant_modules_state_guard on public.tenant_modules;
create trigger trg_tenant_modules_state_guard
  before insert or update or delete on public.tenant_modules
  for each row execute function public.tenant_modules_state_guard();

-- ── 4. Module-state gates on every currently public module-owned read ───────

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon
  using (
    active = true
    and exists (
      select 1 from public.tenants t
       where t.id = services.tenant_id and t.status = 'active'
    )
    and (select private.module_public_readable(services.tenant_id, 'booking'))
  );

drop policy if exists locations_public_read on public.locations;
create policy locations_public_read on public.locations
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
       where t.id = locations.tenant_id and t.status = 'active'
    )
    and (select private.module_public_readable(locations.tenant_id, 'booking'))
  );

drop policy if exists staff_public_read on public.staff;
create policy staff_public_read on public.staff
  for select to anon
  using (
    active = true
    and exists (
      select 1 from public.tenants t
       where t.id = staff.tenant_id and t.status = 'active'
    )
    and (select private.module_public_readable(staff.tenant_id, 'booking'))
  );

drop policy if exists staff_services_public_read on public.staff_services;
create policy staff_services_public_read on public.staff_services
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
       where t.id = staff_services.tenant_id and t.status = 'active'
    )
    and (select private.module_public_readable(staff_services.tenant_id, 'booking'))
  );

drop policy if exists working_hours_public_read on public.working_hours;
create policy working_hours_public_read on public.working_hours
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
       where t.id = working_hours.tenant_id and t.status = 'active'
    )
    and (select private.module_public_readable(working_hours.tenant_id, 'booking'))
  );

drop policy if exists working_hour_slots_public_read on public.working_hour_slots;
create policy working_hour_slots_public_read on public.working_hour_slots
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
       where t.id = working_hour_slots.tenant_id and t.status = 'active'
    )
    and (select private.module_public_readable(working_hour_slots.tenant_id, 'booking'))
  );

drop policy if exists location_opening_hours_public_read
  on public.location_opening_hours;
create policy location_opening_hours_public_read
  on public.location_opening_hours
  for select to anon
  using (
    confirmed_at is not null
    and exists (
      select 1
        from public.locations l
        join public.tenants t on t.id = l.tenant_id and t.status = 'active'
       where l.id = location_opening_hours.location_id
         and l.tenant_id = location_opening_hours.tenant_id
         and l.active = true
    )
    and (
      select private.module_public_readable(
        location_opening_hours.tenant_id,
        'booking'
      )
    )
  );

drop policy if exists shop_products_public_read on public.shop_products;
create policy shop_products_public_read on public.shop_products
  for select to anon
  using (
    (select private.module_public_readable(shop_products.tenant_id, 'shop'))
  );

drop policy if exists shop_variants_public_read on public.shop_product_variants;
create policy shop_variants_public_read on public.shop_product_variants
  for select to anon
  using (
    (select private.module_public_readable(shop_product_variants.tenant_id, 'shop'))
  );

drop policy if exists shop_shipping_options_public_read
  on public.shop_shipping_options;
create policy shop_shipping_options_public_read
  on public.shop_shipping_options
  for select to anon
  using (
    active = true
    and (
      select private.module_public_readable(
        shop_shipping_options.tenant_id,
        'shop'
      )
    )
  );

drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select to anon
  using (
    status = 'published'
    and (select private.module_public_readable(blog_posts.tenant_id, 'blogg'))
  );

drop policy if exists loyalty_plans_public_read on public.loyalty_plans;
create policy loyalty_plans_public_read on public.loyalty_plans
  for select to anon
  using (
    active = true
    and (
      select private.module_public_readable(
        loyalty_plans.tenant_id,
        'lojalitet'
      )
    )
  );

drop policy if exists tenant_events_public_read on public.tenant_events;
create policy tenant_events_public_read on public.tenant_events
  for select to anon
  using (
    (select private.module_public_readable(tenant_events.tenant_id, 'kurser'))
  );

drop policy if exists gallery_items_public_read on public.gallery_items;
create policy gallery_items_public_read on public.gallery_items
  for select to anon
  using (
    active = true
    and (select private.module_public_readable(gallery_items.tenant_id, 'galleri'))
  );

-- ── 5. DB-boundary action gates ─────────────────────────────────────────────
--
-- Keep the latest RPC implementations byte-for-byte by moving their existing
-- function objects behind private names. The public signatures become narrow
-- wrappers that resolve the real tenant, apply the shared action decision, and
-- only then delegate to the preserved implementation.

alter function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, uuid, text, text, text, uuid, uuid
) set schema private;
alter function private.create_public_booking(
  text, uuid, uuid, timestamptz, text, uuid, text, text, text, uuid, uuid
) rename to create_public_booking_goal87_impl;

revoke all on function private.create_public_booking_goal87_impl(
  text, uuid, uuid, timestamptz, text, uuid, text, text, text, uuid, uuid
) from public, anon, authenticated, service_role;

create or replace function public.create_public_booking(
  p_tenant_slug text,
  p_service uuid,
  p_staff uuid,
  p_start timestamptz,
  p_note text default null,
  p_customer uuid default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_location uuid default null,
  p_request_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_uid uuid := auth.uid();
  v_existing uuid;
begin
  -- Preserve the legacy identity/past fences and idempotency order. A retry of
  -- an already-created booking is not a new public action, so it remains
  -- retrievable after the module is paused or turned off.
  if v_uid is null then
    if p_customer is not null then
      raise exception 'forbidden_customer' using errcode = '42501';
    end if;
  elsif p_customer is not null and p_customer <> v_uid then
    raise exception 'forbidden_customer' using errcode = '42501';
  end if;

  if p_start < (pg_catalog.now() - interval '2 minutes') then
    raise exception 'start_in_past' using errcode = 'P0001';
  end if;

  select t.id
    into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';

  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  if p_request_id is not null then
    select b.id
      into v_existing
      from public.bookings b
     where b.tenant_id = v_tenant
       and b.request_id = p_request_id;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  if not private.module_public_action_allowed(v_tenant, 'booking') then
    raise exception 'module_public_action_denied' using errcode = '55000';
  end if;

  return private.create_public_booking_goal87_impl(
    p_tenant_slug,
    p_service,
    p_staff,
    p_start,
    p_note,
    p_customer,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_location,
    p_request_id
  );
end;
$$;

revoke all on function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, uuid, text, text, text, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, uuid, text, text, text, uuid, uuid
) to authenticated;

alter function public.reserve_shop_order(text, jsonb, text, text, integer)
  set schema private;
alter function private.reserve_shop_order(text, jsonb, text, text, integer)
  rename to reserve_shop_order_goal87_impl;

revoke all on function private.reserve_shop_order_goal87_impl(
  text, jsonb, text, text, integer
) from public, anon, authenticated, service_role;

create or replace function public.reserve_shop_order(
  p_tenant_slug text,
  p_items jsonb,
  p_fulfilment text default 'ship',
  p_token text default null,
  p_ttl_min integer default 30
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  -- Preserve the existing cheap input-error order before the module lookup.
  if p_token is null or pg_catalog.btrim(p_token) = '' then
    raise exception 'missing_token' using errcode = '22023';
  end if;
  if p_ttl_min is null or p_ttl_min <= 0 or p_ttl_min > 240 then
    raise exception 'bad_ttl' using errcode = '22023';
  end if;
  if p_fulfilment not in ('ship', 'pickup_within_days', 'order_in_then_pickup') then
    raise exception 'bad_fulfilment' using errcode = '22023';
  end if;
  if p_items is null
     or pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = '22023';
  end if;

  select t.id
    into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';

  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  if not private.module_public_action_allowed(v_tenant, 'shop') then
    raise exception 'module_public_action_denied' using errcode = '55000';
  end if;

  return private.reserve_shop_order_goal87_impl(
    p_tenant_slug,
    p_items,
    p_fulfilment,
    p_token,
    p_ttl_min
  );
end;
$$;

revoke all on function public.reserve_shop_order(text, jsonb, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_shop_order(text, jsonb, text, text, integer)
  to service_role;

alter function public.confirm_shop_order(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, text
) set schema private;
alter function private.confirm_shop_order(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, text
) rename to confirm_shop_order_goal87_impl;

revoke all on function private.confirm_shop_order_goal87_impl(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, text
) from public, anon, authenticated, service_role;

create or replace function public.confirm_shop_order(
  p_order_id uuid,
  p_token text,
  p_customer uuid default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_ship_address text default null,
  p_pickup_location uuid default null,
  p_note text default null,
  p_shipping_option uuid default null,
  p_payment_method text default null
) returns table (order_id uuid, requires_payment boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_tenant uuid;
begin
  -- The token fence remains ahead of the module decision so an order id never
  -- becomes a tenant/module-state oracle. The row lock is retained by the
  -- transaction while the preserved implementation locks it again.
  select o.*
    into v_order
    from public.shop_orders o
   where o.id = p_order_id
   for update;
  if v_order.id is null then
    raise exception 'unknown_order' using errcode = 'P0002';
  end if;
  if p_token is null
     or v_order.session_token is null
     or v_order.session_token <> p_token then
    raise exception 'forbidden_order' using errcode = '42501';
  end if;
  if v_order.status <> 'reserved' then
    raise exception 'order_not_reservable' using errcode = 'P0001';
  end if;
  if v_order.expires_at is not null and v_order.expires_at < pg_catalog.now() then
    raise exception 'order_expired' using errcode = 'P0001';
  end if;

  v_tenant := v_order.tenant_id;
  if not private.module_public_action_allowed(v_tenant, 'shop') then
    raise exception 'module_public_action_denied' using errcode = '55000';
  end if;

  return query
    select *
      from private.confirm_shop_order_goal87_impl(
        p_order_id,
        p_token,
        p_customer,
        p_guest_name,
        p_guest_email,
        p_guest_phone,
        p_ship_address,
        p_pickup_location,
        p_note,
        p_shipping_option,
        p_payment_method
      );
end;
$$;

revoke all on function public.confirm_shop_order(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.confirm_shop_order(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, text
) to anon, authenticated, service_role;
