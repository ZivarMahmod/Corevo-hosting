-- Public, read-only motiontest tenant. The dedicated Worker accepts only GET/HEAD
-- and maps motiontest.corevo.se here instead of touching the real FreshCut tenant.
do $migration$
declare
  v_tenant uuid;
  v_location uuid;
  v_owner_role uuid;
  v_owner uuid := pg_catalog.gen_random_uuid();
  v_staff uuid;
begin
  if exists (select 1 from public.tenants where slug = 'freshcut-motiontest') then
    raise notice 'FreshCut Motiontest tenant already exists; skipping provisioning.';
    return;
  end if;

  insert into public.tenants (slug, name, status, plan, city, vertical_id)
  values (
    'freshcut-motiontest',
    'FreshCut Motiontest',
    'provisioning',
    'standard',
    'Linköping',
    'barbershop'
  )
  returning id into v_tenant;

  insert into public.tenant_settings (
    tenant_id,
    payment_mode,
    branding,
    settings,
    service_fee_type,
    service_fee_value,
    billing_model,
    setup_fee_cents,
    per_booking_fee_cents,
    flat_monthly_fee_cents,
    payments_enabled,
    country_code,
    locale,
    currency,
    default_timezone
  ) values (
    v_tenant,
    'on_site',
    '{}'::jsonb,
    $settings${
      "theme": "freshcut",
      "customer_portal": { "mode": "off" },
      "booking": {
        "variant": "inline",
        "provider": "external",
        "pickerMode": "calendar",
        "external_url": "https://www.bokadirekt.se/",
        "staffAvatars": "initialer",
        "external_cta_urls": {}
      },
      "contact": {
        "email": "info@freshcut.se",
        "phone": "073 876 71 44"
      }
    }$settings$::jsonb,
    'fixed',
    0,
    'per_booking',
    0,
    0,
    0,
    false,
    'SE',
    'sv-SE',
    'SEK',
    'Europe/Stockholm'
  );

  insert into public.locations (
    tenant_id,
    name,
    address,
    timezone,
    is_primary,
    active,
    slot_step_min,
    min_notice_min,
    max_advance_days
  ) values (
    v_tenant,
    'FreshCut Motiontest',
    'Bokhållaregatan 2, 582 24 Linköping',
    'Europe/Stockholm',
    true,
    true,
    15,
    0,
    365
  )
  returning id into v_location;

  insert into public.roles (tenant_id, name, level)
  values (v_tenant, 'salon_admin', 6)
  returning id into v_owner_role;

  insert into public.roles (tenant_id, name, level)
  values (v_tenant, 'staff', 3);

  -- Readiness requires an owner row and public.users is keyed to auth.users.
  -- Keep the internal identity permanently banned and without an auth provider.
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    banned_until,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    created_at,
    updated_at
  ) values (
    v_owner,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'motiontest-owner@corevo.invalid',
    '',
    null,
    'infinity',
    '{"provider":null,"providers":[]}'::jsonb,
    '{}'::jsonb,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    pg_catalog.now(),
    pg_catalog.now()
  );

  insert into public.users (
    id,
    tenant_id,
    email,
    full_name,
    role_id,
    status,
    access_scope,
    primary_location_id
  ) values (
    v_owner,
    v_tenant,
    'motiontest-owner@corevo.invalid',
    'Motiontest',
    v_owner_role,
    'active',
    'organization',
    v_location
  );

  insert into public.services (
    tenant_id,
    location_id,
    name,
    description,
    duration_min,
    price_cents,
    active,
    sort_order
  ) values
    (v_tenant, v_location, 'Herrklippning', 'Tvätt & styling ingår', 30, 36900, true, 0),
    (v_tenant, v_location, 'Herrklippning Student', 'Gäller vid uppvisande av giltig studenthandling.', 30, 32900, true, 1),
    (v_tenant, v_location, 'Herrklippning, långt skägg, varm handduk', 'Långt skägg', 45, 45900, true, 2),
    (v_tenant, v_location, 'Herrklippning kort skägg, varm handduk', 'Kort skägg', 30, 41900, true, 3),
    (v_tenant, v_location, 'Pensionärsklippning', null, 30, 32900, true, 4),
    (v_tenant, v_location, 'Barnklippning (upp till 8 år)', 'Upp till 8 år', 30, 29900, true, 5),
    (v_tenant, v_location, 'Skäggtrimning', null, 15, 22900, true, 6);

  insert into public.staff (
    tenant_id,
    location_id,
    title,
    short_name,
    active,
    show_on_site
  ) values (
    v_tenant,
    v_location,
    'Motiontest-frisör',
    'Test',
    false,
    false
  )
  returning id into v_staff;

  insert into public.staff_services (tenant_id, staff_id, service_id)
  select v_tenant, v_staff, s.id
  from public.services s
  where s.tenant_id = v_tenant and s.active;

  insert into public.working_hours (
    tenant_id,
    staff_id,
    location_id,
    weekday,
    start_time,
    end_time
  )
  select v_tenant, v_staff, v_location, weekday, time '09:00', time '17:00'
  from pg_catalog.generate_series(1, 5) as weekday;

  insert into public.location_opening_hours (
    tenant_id,
    location_id,
    weekday,
    start_time,
    end_time,
    source,
    confirmed_at,
    confirmed_by
  )
  select
    v_tenant,
    v_location,
    weekday,
    time '09:00',
    time '17:00',
    'confirmed',
    pg_catalog.now(),
    v_owner
  from pg_catalog.generate_series(1, 5) as weekday;

  update public.staff
  set active = true
  where id = v_staff;

  insert into public.tenant_modules (tenant_id, module_key, state)
  values (v_tenant, 'booking', 'live');

  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.publish_tenant(v_tenant);
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);
end;
$migration$;
