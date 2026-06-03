-- seed-freshcut.sql — VÅG 3 FreshCut baseline reconcile (goal-15).
--
-- IDEMPOTENT: re-running converges to the same state (UPDATE-in-place + UPSERT on
-- fixed seed ids; primary location resolved dynamically). NEVER deletes a booking.
-- Run as a DATA script (mcp execute_sql / psql), NOT a migration. The destructive
-- purge (4 junk tenants + FreshCut's test bookings/customers) runs SEPARATELY and
-- BEFORE this, from a postgres owner session — see docs/ops/vag3-rollback.md.
--
-- Source: 2-Byggplan/goals/freshcut-seed-data.md. REAL data: name, address, phone,
-- 7 services (real öre + durations), real opening hours, real taglines. The salvia
-- THEME drives colours + default imagery (branding cleared — 'temat ska driva', the
-- documented 'ser likadant ut' trap). PLACEHOLDER: staff names, hero/about copy.
set search_path = public;

do $$
declare
  v_tenant   uuid := '11111111-1111-1111-1111-111111111111';
  v_location uuid;
  v_staff1   uuid := '44444444-0000-0000-0000-000000000001';
  v_staff2   uuid := '44444444-0000-0000-0000-000000000002';
  v_service_ids uuid[] := array[
    '55555555-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000004',
    '55555555-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000005',
    '55555555-0000-0000-0000-000000000006', '55555555-0000-0000-0000-000000000007',
    '55555555-0000-0000-0000-000000000002'
  ];
begin
  -- primary location id has drifted from the seed default on the live DB → resolve it.
  select id into v_location from public.locations
   where tenant_id = v_tenant and is_primary order by created_at limit 1;
  if v_location is null then raise exception 'freshcut has no primary location'; end if;

  -- 1) Tenant + primary location identity.
  update public.tenants set name = 'FreshCut' where id = v_tenant;
  update public.locations
     set name = 'FreshCut', address = 'Bokhållaregatan 2, 582 24 Linköping', timezone = 'Europe/Stockholm'
   where id = v_location and tenant_id = v_tenant;

  -- 2) Services — UPSERT the 7 brief rows on fixed ids (reuse the 3 existing, add 4),
  --    then DEACTIVATE any other freshcut service not in the set (build-once-never-
  --    delete: a service with history is hidden, never DELETEd).
  insert into public.services (id, tenant_id, location_id, name, category, duration_min, price_cents, active) values
    ('55555555-0000-0000-0000-000000000001', v_tenant, v_location, 'Herrklippning',                                       'Hår och skägg', 30, 36900, true),
    ('55555555-0000-0000-0000-000000000004', v_tenant, v_location, 'Herrklippning Student',                               'Hår och skägg', 30, 32900, true),
    ('55555555-0000-0000-0000-000000000003', v_tenant, v_location, 'Herrklippning + skägg + varm handduk (långt skägg)',  'Hår och skägg', 45, 45900, true),
    ('55555555-0000-0000-0000-000000000005', v_tenant, v_location, 'Herrklippning + skägg + varm handduk (kort skägg)',   'Hår och skägg', 45, 41900, true),
    ('55555555-0000-0000-0000-000000000006', v_tenant, v_location, 'Pensionärklippning',                                  'Hår och skägg', 30, 32900, true),
    ('55555555-0000-0000-0000-000000000007', v_tenant, v_location, 'Barnklippning',                                       'Hår och skägg', 25, 29900, true),
    ('55555555-0000-0000-0000-000000000002', v_tenant, v_location, 'Skäggtrim',                                           'Hår och skägg', 15, 22900, true)
  on conflict (id) do update set
    name = excluded.name, category = excluded.category, duration_min = excluded.duration_min,
    price_cents = excluded.price_cents, active = true, location_id = excluded.location_id;

  update public.services set active = false
   where tenant_id = v_tenant and id <> all(v_service_ids);

  -- 3) Staff (placeholder names; keep profile_id login links intact).
  update public.staff set title = 'Barberare 1', active = true where id = v_staff1 and tenant_id = v_tenant;
  update public.staff set title = 'Barberare 2', active = true where id = v_staff2 and tenant_id = v_tenant;

  -- 4) staff_services — BOTH barbers do ALL 7 services (brief typo 01-06 fixed;
  --    omitting Skäggtrim would ship it unbookable). Drop stale links to non-brief
  --    services, then idempotently add the full grid.
  delete from public.staff_services
   where tenant_id = v_tenant and service_id <> all(v_service_ids);
  insert into public.staff_services (tenant_id, staff_id, service_id)
  select v_tenant, s.staff_id, sv
    from (values (v_staff1),(v_staff2)) s(staff_id)
    cross join unnest(v_service_ids) sv
  on conflict (staff_id, service_id) do nothing;

  -- 5) Working hours — replace with the brief schedule, PER barber. working_hours is
  --    editable config (no append-only guard) → a clean replace is correct.
  delete from public.working_hours where tenant_id = v_tenant;
  insert into public.working_hours (tenant_id, staff_id, location_id, weekday, start_time, end_time)
  select v_tenant, s.staff_id, v_location, d.weekday, d.start_time, d.end_time
    from (values (v_staff1),(v_staff2)) s(staff_id)
    cross join (values
      (1, '10:00'::time, '18:00'::time),
      (2, '10:00'::time, '18:00'::time),
      (3, '10:00'::time, '18:00'::time),
      (4, '10:00'::time, '18:00'::time),
      (5, '10:00'::time, '19:00'::time),
      (6, '10:00'::time, '16:00'::time)
    ) d(weekday, start_time, end_time);

  -- 6) tenant_settings — CLEAR branding (strips the 4 inline hex + Zivar's §4.3 test
  --    media: team/hero/gallery/about/closing/logo/font) so the SALVIA theme + its
  --    default imagery drive. Keep theme/layout/toggles; set the real phone + copy.
  update public.tenant_settings set
    branding = '{}'::jsonb,
    settings = jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(settings, '{}'::jsonb), '{theme}', '"salvia"', true),
        '{contact}', jsonb_build_object('email', null, 'phone', '073-876 71 44'), true
      ),
      '{copy}', jsonb_build_object(
        'heroEyebrow', 'Barbershop i Linköping',
        'heroTitle',   'Grymma barberare. Skönt mottagen.',
        'heroLede',    'En barbershop i centrala Linköping. Herrklippning och skägg av barberare som gör dig nöjd varje gång.',
        'aboutCopy',   'FreshCut är en barbershop i hjärtat av Linköping. Våra barberare har många år bakom stolen och kan herrhår — från ren snagg till klippning med skägg. Vi håller en trevlig, avslappnad miljö och slutar inte förrän du är nöjd.',
        'tagline',     'Gör dig alltid nöjd',
        'italic',      'Trevlig miljö · Grymma barberare · Gör dig alltid nöjd'
      ), true
    )
  where tenant_id = v_tenant;
end $$;
