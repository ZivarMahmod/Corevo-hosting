do $$
declare
  t text;
begin
  if not has_table_privilege('authenticated', 'public.bookings', 'SELECT')
     or not has_table_privilege('authenticated', 'public.bookings', 'INSERT') then
    raise exception 'authenticated_booking_grants_missing';
  end if;
  if has_table_privilege('authenticated', 'public.bookings', 'UPDATE,DELETE') then
    raise exception 'authenticated_booking_mutation_grants_too_broad';
  end if;
  if not has_table_privilege('authenticated', 'public.customers', 'SELECT')
     or not has_table_privilege('authenticated', 'public.customers', 'INSERT')
     or not has_table_privilege('authenticated', 'public.customers', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.customers', 'DELETE') then
    raise exception 'authenticated_customer_grants_missing';
  end if;
  if not has_table_privilege('authenticated', 'public.notifications_outbox', 'SELECT')
     or has_table_privilege('authenticated', 'public.notifications_outbox', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated_outbox_grants_wrong';
  end if;
  if not has_table_privilege('authenticated', 'public.site_revisions', 'SELECT')
     or has_table_privilege('authenticated', 'public.site_revisions', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated_site_revision_grants_wrong';
  end if;
  if not has_table_privilege('authenticated', 'public.slot_holds', 'SELECT')
     or has_table_privilege('authenticated', 'public.slot_holds', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated_slot_hold_grants_wrong';
  end if;

  if not has_column_privilege('anon', 'public.tenants', 'slug', 'SELECT')
     or has_column_privilege('anon', 'public.tenants', 'stripe_account_id', 'SELECT') then
    raise exception 'anon_tenant_columns_wrong';
  end if;
  if not has_column_privilege('anon', 'public.tenant_settings', 'settings', 'SELECT')
     or has_column_privilege('anon', 'public.tenant_settings', 'service_fee_value', 'SELECT') then
    raise exception 'anon_tenant_setting_columns_wrong';
  end if;

  foreach t in array array[
    'blog_posts', 'content_slots', 'gallery_items', 'location_opening_hours',
    'locations', 'loyalty_plans', 'media_assets', 'modules', 'services',
    'shop_product_variants', 'shop_products', 'shop_shipping_options',
    'site_content_vertical_defaults', 'staff', 'staff_services',
    'template_slots', 'templates', 'tenant_events', 'tenant_modules',
    'verticals', 'working_hour_slots', 'working_hours'
  ] loop
    if not has_table_privilege('anon', format('public.%I', t), 'SELECT') then
      raise exception 'anon_storefront_select_missing_%', t;
    end if;
  end loop;

  foreach t in array array[
    'bookings', 'customers', 'notifications_outbox', 'site_revisions',
    'slot_holds', 'staff', 'services', 'tenant_settings', 'tenants'
  ] loop
    if has_table_privilege('anon', format('public.%I', t), 'INSERT,UPDATE,DELETE') then
      raise exception 'anon_mutation_grant_present_%', t;
    end if;
  end loop;

  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    if not (
      select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = t
    ) then
      raise exception 'public_table_without_rls_%', t;
    end if;
    if not has_table_privilege('service_role', format('public.%I', t), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', t), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', t), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', t), 'DELETE') then
      raise exception 'service_role_grants_missing_%', t;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.location_opening_hours', 'SELECT')
     or has_table_privilege('authenticated', 'public.location_opening_hours', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated_opening_hour_grants_wrong';
  end if;
  if not has_table_privilege('authenticated', 'public.time_off', 'SELECT')
     or has_table_privilege('authenticated', 'public.time_off', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated_time_off_grants_wrong';
  end if;
  if not has_column_privilege('authenticated', 'public.users', 'phone', 'UPDATE')
     or has_column_privilege('authenticated', 'public.users', 'email', 'UPDATE') then
    raise exception 'authenticated_user_update_columns_wrong';
  end if;
end
$$;
