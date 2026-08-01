-- Goal 84 preview-only FreshCut fixture.
-- Direct or pooled branch DATABASE URLs are accepted; Supavisor session and
-- transaction modes are allowed. This one-statement script rejects any nonempty
-- incoming request context (role, claims or subject), then establishes trusted
-- direct-maintenance semantics with an empty role and valid claims. The caller
-- MUST first validate the exact branch host/user and allowed preview ref
-- cwnhpesrgolflkmyjbrm, and reject production ref clylvowtowbtotrahuad. Hosted
-- project refs are not discoverable from SQL, so this file does not pretend to
-- verify one in-database.
do $goal84_freshcut$
declare
  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_existing_slug text;
  v_location uuid;
  v_settings jsonb;
  v_service_ids uuid[] := array[
    '55555555-0000-0000-0000-000000000001'::uuid,
    '55555555-0000-0000-0000-000000000004'::uuid,
    '55555555-0000-0000-0000-000000000003'::uuid,
    '55555555-0000-0000-0000-000000000005'::uuid,
    '55555555-0000-0000-0000-000000000006'::uuid,
    '55555555-0000-0000-0000-000000000007'::uuid,
    '55555555-0000-0000-0000-000000000002'::uuid
  ];
begin
  if nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '') is not null
     or nullif(pg_catalog.current_setting('request.jwt.claims', true), '') is not null
     or nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '') is not null then
    raise exception 'goal84_preview_requires_claim_free_connection';
  end if;

  -- Supavisor can reuse a backend whose custom claims GUC is the empty string.
  -- Keep the legacy empty maintenance role, but give JSON-casting helpers a valid
  -- object before any tenant-owned write. Never install an empty claims string.
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  select t.slug
    into v_existing_slug
    from public.tenants t
   where t.id = v_tenant
   for update;
  if not found or v_existing_slug not in ('demo', 'freshcut') then
    raise exception 'goal84_preview_tenant_identity_guard';
  end if;

  if exists (
    select 1
      from public.tenants t
     where t.slug = 'freshcut'
       and t.id <> v_tenant
  ) then
    raise exception 'goal84_preview_freshcut_slug_collision';
  end if;

  if not exists (
    select 1
      from public.verticals v
     where v.key = 'frisör'
  ) then
    raise exception 'goal84_preview_vertical_missing';
  end if;

  select ts.settings
    into v_settings
    from public.tenant_settings ts
   where ts.tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'goal84_preview_tenant_settings_missing';
  end if;
  if pg_catalog.jsonb_typeof(v_settings) <> 'object' then
    raise exception 'goal84_preview_tenant_settings_invalid';
  end if;

  select l.id
    into v_location
    from public.locations l
   where l.tenant_id = v_tenant
     and l.is_primary = true
     and l.active = true
   order by l.created_at, l.id
   limit 1
   for update;
  if v_location is null then
    raise exception 'goal84_preview_primary_location_missing';
  end if;

  if exists (
    select 1
      from public.services s
     where s.id = any (v_service_ids)
       and s.tenant_id <> v_tenant
  ) then
    raise exception 'goal84_preview_service_tenant_collision';
  end if;

  -- Tenant-owned maintenance stays under the normalized empty-role context so
  -- provisioning fixtures retain the trusted direct-connection lifecycle bypass.
  update public.tenant_settings ts
     set settings =
       coalesce(ts.settings, '{}'::jsonb)
       || pg_catalog.jsonb_build_object(
         'theme', 'freshcut',
         'booking',
           case
             when pg_catalog.jsonb_typeof(ts.settings -> 'booking') = 'object'
               then ts.settings -> 'booking'
             else '{}'::jsonb
           end
           || pg_catalog.jsonb_build_object(
             'external_url', 'https://www.bokadirekt.se/'
           ),
         'contact',
           case
             when pg_catalog.jsonb_typeof(ts.settings -> 'contact') = 'object'
               then ts.settings -> 'contact'
             else '{}'::jsonb
           end
           || pg_catalog.jsonb_build_object(
             'email', 'info@freshcut.se',
             'phone', '073 876 71 44'
           ),
         'social',
           case
             when pg_catalog.jsonb_typeof(ts.settings -> 'social') = 'object'
               then ts.settings -> 'social'
             else '{}'::jsonb
           end
           || pg_catalog.jsonb_build_object(
             'instagram', 'https://instagram.com/freshcut.lkpg'
           )
       )
   where ts.tenant_id = v_tenant;

  insert into public.tenant_modules (tenant_id, module_key, state)
  values (v_tenant, 'booking', 'off')
  on conflict (tenant_id, module_key) do update
    set state = excluded.state;

  update public.locations l
     set name = 'FreshCut',
         address = 'Bokhållaregatan 2, 582 24 Linköping',
         timezone = 'Europe/Stockholm'
   where l.id = v_location
     and l.tenant_id = v_tenant;

  insert into public.services as services (
    id, tenant_id, location_id, name, category, duration_min, price_cents, active
  ) values
    ('55555555-0000-0000-0000-000000000001', v_tenant, v_location, 'Herrklippning',                                      'Hår och skägg', 30, 36900, true),
    ('55555555-0000-0000-0000-000000000004', v_tenant, v_location, 'Herrklippning Student',                              'Hår och skägg', 30, 32900, true),
    ('55555555-0000-0000-0000-000000000003', v_tenant, v_location, 'Herrklippning + skägg + varm handduk (långt skägg)', 'Hår och skägg', 45, 45900, true),
    ('55555555-0000-0000-0000-000000000005', v_tenant, v_location, 'Herrklippning + skägg + varm handduk (kort skägg)',  'Hår och skägg', 45, 41900, true),
    ('55555555-0000-0000-0000-000000000006', v_tenant, v_location, 'Pensionärklippning',                                 'Hår och skägg', 30, 32900, true),
    ('55555555-0000-0000-0000-000000000007', v_tenant, v_location, 'Barnklippning',                                      'Hår och skägg', 25, 29900, true),
    ('55555555-0000-0000-0000-000000000002', v_tenant, v_location, 'Skäggtrim',                                          'Hår och skägg', 15, 22900, true)
  on conflict (id) do update set
    location_id = excluded.location_id,
    name = excluded.name,
    category = excluded.category,
    duration_min = excluded.duration_min,
    price_cents = excluded.price_cents,
    active = excluded.active
  where services.tenant_id = excluded.tenant_id;

  -- Protected tenant fields require an explicit, valid service-role request.
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

  update public.tenants t
     set slug = 'freshcut',
         name = 'FreshCut',
         status = 'active',
         vertical_id = 'frisör'
   where t.id = v_tenant;

  if not exists (
    select 1
      from public.tenants t
     where t.id = v_tenant
       and t.slug = 'freshcut'
       and t.name = 'FreshCut'
       and t.status = 'active'
       and t.vertical_id = 'frisör'
  ) then
    raise exception 'goal84_preview_assert_tenant';
  end if;

  if (select pg_catalog.count(*)
        from public.tenant_modules tm
       where tm.tenant_id = v_tenant
         and tm.module_key = 'booking') <> 1
     or not exists (
       select 1
         from public.tenant_modules tm
        where tm.tenant_id = v_tenant
          and tm.module_key = 'booking'
          and tm.state = 'off'
     ) then
    raise exception 'goal84_preview_assert_booking_module';
  end if;

  if not exists (
    select 1
      from public.tenant_settings ts
     where ts.tenant_id = v_tenant
       and ts.settings ->> 'theme' = 'freshcut'
       and ts.settings #>> '{booking,external_url}' = 'https://www.bokadirekt.se/'
       and ts.settings #>> '{contact,email}' = 'info@freshcut.se'
       and ts.settings #>> '{contact,phone}' = '073 876 71 44'
       and ts.settings #>> '{social,instagram}' = 'https://instagram.com/freshcut.lkpg'
  ) then
    raise exception 'goal84_preview_assert_settings';
  end if;

  if not exists (
    select 1
      from public.locations l
     where l.id = v_location
       and l.tenant_id = v_tenant
       and l.is_primary = true
       and l.active = true
       and l.name = 'FreshCut'
       and l.address = 'Bokhållaregatan 2, 582 24 Linköping'
       and l.timezone = 'Europe/Stockholm'
  ) then
    raise exception 'goal84_preview_assert_location';
  end if;

  if exists (
    with expected (id, name, category, duration_min, price_cents) as (
      values
        ('55555555-0000-0000-0000-000000000001'::uuid, 'Herrklippning',                                      'Hår och skägg', 30, 36900),
        ('55555555-0000-0000-0000-000000000004'::uuid, 'Herrklippning Student',                              'Hår och skägg', 30, 32900),
        ('55555555-0000-0000-0000-000000000003'::uuid, 'Herrklippning + skägg + varm handduk (långt skägg)', 'Hår och skägg', 45, 45900),
        ('55555555-0000-0000-0000-000000000005'::uuid, 'Herrklippning + skägg + varm handduk (kort skägg)',  'Hår och skägg', 45, 41900),
        ('55555555-0000-0000-0000-000000000006'::uuid, 'Pensionärklippning',                                 'Hår och skägg', 30, 32900),
        ('55555555-0000-0000-0000-000000000007'::uuid, 'Barnklippning',                                      'Hår och skägg', 25, 29900),
        ('55555555-0000-0000-0000-000000000002'::uuid, 'Skäggtrim',                                          'Hår och skägg', 15, 22900)
    )
    select 1
      from expected e
      left join public.services s on s.id = e.id
     where s.id is null
        or s.tenant_id is distinct from v_tenant
        or s.location_id is distinct from v_location
        or s.name is distinct from e.name
        or s.category is distinct from e.category
        or s.duration_min is distinct from e.duration_min
        or s.price_cents is distinct from e.price_cents
        or s.active is distinct from true
  ) or (
    select pg_catalog.count(*)
      from public.services s
     where s.id = any (v_service_ids)
       and s.tenant_id = v_tenant
  ) <> 7 then
    raise exception 'goal84_preview_assert_services';
  end if;
end
$goal84_freshcut$;
