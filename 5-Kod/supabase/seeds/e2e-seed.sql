-- ▸ FIL: supabase/seeds/e2e-seed.sql
--
-- E2E-FIXTUR — den engångs-tenant Playwright-sviten kör mot.
--
-- KÖRS ALDRIG FÖR HAND. Kör via scripts/e2e-db.mjs (seed | teardown), som byter ut
-- __E2E_PASSWORD__ mot ett engångslösenord ur miljön. Klistrar du in den här filen
-- rakt i SQL-editorn får du en super_admin med lösenordet "__E2E_PASSWORD__". Låt bli.
--
-- VARFÖR FIXA UUID:N: allt hänger på tenant-id:t e2e00000-…-000000000001, och varje
-- rad som inte hänger i tenanten (auth.users, den globala super_admin-rollen) har ett
-- e2e-prefix. Teardown kan därför radera EXAKT det här och inget annat — inga
-- efterlämnade rader i kundens databas. Se e2e-teardown.sql.
--
-- Fixturen matchar e2e/helpers.ts: slug frisor1, e2e-admin@frisor1.test
-- (salon_admin), e2e-staff@frisor1.test (staff), e2e-customer@frisor1.test
-- (kund), e2e-platform@corevo.se (super_admin).
-- Konfliktsäker, men en muterad testsuite ska alltid teardown:as före ny seed så
-- den fasta aktiva bokningen verkligen återställs.

-- ── tenant ──
insert into public.tenants (id, slug, name, status)
values ('e2e00000-0000-0000-0000-000000000001', 'frisor1', 'Frisör Ett (E2E)', 'provisioning')
on conflict (slug) do nothing;

insert into public.tenant_settings
  (tenant_id, payment_mode, branding, settings, service_fee_type, service_fee_value)
values (
  'e2e00000-0000-0000-0000-000000000001',
  'on_site',
  '{"color_primary":"#b5651d","font_body":"Inter"}'::jsonb,
  -- Legacy account mode: booking.spec + cancel-rebook.spec log in as a customer.
  -- på storefronten. Utan den flaggan finns ingen /konto och specarna dör.
  '{"layout":{"nav_variant":"A","hero_variant":"1"},"customer_portal":{"mode":"legacy_account"},"cancellation_cutoff_hours":24}'::jsonb,
  'fixed', 500
)
on conflict (tenant_id) do nothing;

-- ── aktiva moduler + en verklig storefrontprodukt ──
-- Den binära modulägaren har bara off/live; fixturen går samma off → live-väg.
insert into public.tenant_modules (tenant_id, module_key, state, config) values
  (
    'e2e00000-0000-0000-0000-000000000001',
    'booking',
    'off',
    '{}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'media_library',
    'off',
    '{"quota_bytes":524288000}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'offert',
    'off',
    '{"mode":"estimate_form","response_days":2}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'shop',
    'off',
    '{"fulfilment":"ship","currency":"SEK","payment_methods":["card"]}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'blogg',
    'off',
    '{}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'kurser',
    'off',
    '{}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'galleri',
    'off',
    '{}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'lojalitet',
    'off',
    '{}'::jsonb
  ),
  (
    'e2e00000-0000-0000-0000-000000000001',
    'presentkort',
    'off',
    '{}'::jsonb
  )
on conflict (tenant_id, module_key) do nothing;

update public.tenant_modules
   set state = 'live'
 where tenant_id = 'e2e00000-0000-0000-0000-000000000001'
   and module_key in (
     'booking', 'media_library', 'offert', 'shop', 'blogg', 'kurser', 'galleri',
     'lojalitet', 'presentkort'
   )
   and state = 'off';

insert into public.shop_products
  (id, tenant_id, name, description, price_cents, currency, stock, active, sort_order)
values (
  'e2e92000-0000-0000-0000-000000000001',
  'e2e00000-0000-0000-0000-000000000001',
  'Goal 92 testprodukt',
  'Tillfällig acceptansprodukt som försvinner med E2E-tenanten.',
  12900,
  'SEK',
  10,
  true,
  0
)
on conflict (id) do nothing;

insert into public.shop_product_variants
  (id, tenant_id, product_id, name, price_cents, currency, stock, reserved_qty, active, sort_order)
values (
  'e2e92000-0000-0000-0000-000000000002',
  'e2e00000-0000-0000-0000-000000000001',
  'e2e92000-0000-0000-0000-000000000001',
  'Standard',
  12900,
  'SEK',
  10,
  0,
  true,
  0
)
on conflict (id) do nothing;

-- ── roller (tenant-lokala) ──
insert into public.roles (id, tenant_id, name, level) values
  ('e2e00000-0000-0000-0000-000000000061', 'e2e00000-0000-0000-0000-000000000001', 'salon_admin', 6),
  ('e2e00000-0000-0000-0000-000000000031', 'e2e00000-0000-0000-0000-000000000001', 'staff', 3),
  ('e2e00000-0000-0000-0000-000000000021', 'e2e00000-0000-0000-0000-000000000001', 'kund', 2)
on conflict (tenant_id, name) do nothing;

-- ── global super_admin (tenant_id NULL → (tenant_id,name) är inte unik, PK bär idempotensen) ──
insert into public.roles (id, tenant_id, name, level)
values ('e2e00000-0000-0000-0000-000000000088', null, 'super_admin', 8)
on conflict (id) do nothing;

-- ── auth.users ──
-- tenant_id bakas in i raw_app_meta_data (bälte + hängslen vid sidan av Custom Access
-- Token Hook) så RLS håller från första requesten.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('e2e00000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-admin@frisor1.test',
   crypt('__E2E_PASSWORD__', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"e2e00000-0000-0000-0000-000000000001","platform_admin":false}'::jsonb,
   '{}'::jsonb, now(), now()),
  ('e2e00000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-staff@frisor1.test',
   crypt('__E2E_PASSWORD__', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"e2e00000-0000-0000-0000-000000000001","platform_admin":false}'::jsonb,
   '{}'::jsonb, now(), now()),
  ('e2e00000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-customer@frisor1.test',
   crypt('__E2E_PASSWORD__', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"e2e00000-0000-0000-0000-000000000001","platform_admin":false}'::jsonb,
   '{"full_name":"Eira Testkund"}'::jsonb, now(), now()),
  -- OBS e2e-platform@corevo.se, INTE platform@corevo.se: en super_admin med ett
  -- engångslösenord ska aldrig kunna förväxlas med ett riktigt plattformskonto.
  ('e2e00000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-platform@corevo.se',
   crypt('__E2E_PASSWORD__', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":null,"platform_admin":true}'::jsonb,
   '{}'::jsonb, now(), now())
on conflict (id) do nothing;

-- GoTrue läser token-kolumnerna som Go-strängar och kraschar på NULL
-- ("converting NULL to string"). Handseedade auth.users måste ha '' — inte NULL.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where id::text like 'e2e00000%';

-- ── public.users ──
-- Ägaren måste ha organisationsscope. Standardvärdet "locations" är avsiktligt
-- fail-closed och får därför inte läsa tenantens privata moduldata.
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  ('e2e00000-0000-0000-0000-0000000000a1', 'e2e00000-0000-0000-0000-000000000001',
   'e2e-admin@frisor1.test', 'e2e00000-0000-0000-0000-000000000061', 'active', 'organization'),
  ('e2e00000-0000-0000-0000-0000000000a2', 'e2e00000-0000-0000-0000-000000000001',
   'e2e-staff@frisor1.test', 'e2e00000-0000-0000-0000-000000000031', 'active', 'locations'),
  ('e2e00000-0000-0000-0000-0000000000a4', 'e2e00000-0000-0000-0000-000000000001',
   'e2e-customer@frisor1.test', 'e2e00000-0000-0000-0000-000000000021', 'active', 'locations'),
  ('e2e00000-0000-0000-0000-0000000000a3', null,
   'e2e-platform@corevo.se', 'e2e00000-0000-0000-0000-000000000088', 'active', 'locations')
on conflict (id) do nothing;

-- ── plats ──
insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('e2e00000-0000-0000-0000-000000000071', 'e2e00000-0000-0000-0000-000000000001',
   'Frisör Ett', 'Europe/Stockholm', true)
on conflict (id) do nothing;

insert into public.location_opening_hours
  (tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at)
select
  'e2e00000-0000-0000-0000-000000000001',
  'e2e00000-0000-0000-0000-000000000071',
  d,
  time '09:00',
  time '17:00',
  'confirmed',
  now()
from generate_series(1, 5) as d
on conflict (location_id, weekday, start_time, end_time) do nothing;

-- ── personal (kopplad till klippar-användaren) ──
insert into public.staff (id, tenant_id, profile_id, title, active, location_id) values
  ('e2e00000-0000-0000-0000-000000000041', 'e2e00000-0000-0000-0000-000000000001',
   'e2e00000-0000-0000-0000-0000000000a2', 'Frisör', false,
   'e2e00000-0000-0000-0000-000000000071')
on conflict (id) do nothing;

-- ── tjänster ──
insert into public.services
  (id, tenant_id, name, description, category, duration_min, price_cents, active, location_id) values
  ('e2e00000-0000-0000-0000-000000000051', 'e2e00000-0000-0000-0000-000000000001',
   'Klippning', 'Herrklippning', 'Hår', 30, 39500, true, 'e2e00000-0000-0000-0000-000000000071'),
  ('e2e00000-0000-0000-0000-000000000052', 'e2e00000-0000-0000-0000-000000000001',
   'Skäggtrim', 'Trim och rakning', 'Skägg', 15, 19500, true, 'e2e00000-0000-0000-0000-000000000071'),
  ('e2e00000-0000-0000-0000-000000000053', 'e2e00000-0000-0000-0000-000000000001',
   'Klipp & Skägg', 'Paket', 'Paket', 45, 54500, true, 'e2e00000-0000-0000-0000-000000000071')
on conflict (id) do nothing;

insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('e2e00000-0000-0000-0000-000000000001', 'e2e00000-0000-0000-0000-000000000041', 'e2e00000-0000-0000-0000-000000000051'),
  ('e2e00000-0000-0000-0000-000000000001', 'e2e00000-0000-0000-0000-000000000041', 'e2e00000-0000-0000-0000-000000000052'),
  ('e2e00000-0000-0000-0000-000000000001', 'e2e00000-0000-0000-0000-000000000041', 'e2e00000-0000-0000-0000-000000000053')
on conflict (staff_id, service_id) do nothing;

-- ── arbetstider (mån–fre 09–17) ──
insert into public.working_hours (tenant_id, staff_id, weekday, start_time, end_time, location_id)
select 'e2e00000-0000-0000-0000-000000000001',
       'e2e00000-0000-0000-0000-000000000041',
       d, time '09:00', time '17:00',
       'e2e00000-0000-0000-0000-000000000071'
from generate_series(1, 5) as d
where not exists (
  select 1 from public.working_hours
  where staff_id = 'e2e00000-0000-0000-0000-000000000041' and weekday = d
);

-- ── bokbara starttider (working_hour_slots) ──
-- DEN HÄR SAKNADES och sviten hittade det: `working_hours` säger NÄR någon JOBBAR;
-- `working_hour_slots` säger vilka starttider som går att BOKA. Den publika bokningen
-- läser den senare. Utan slots är kalendern öppen men bokningssidan tom — precis vad
-- e2e-felet sa: "No available slot in the 14-day window".
-- En rad per bokbar starttid: mån–fre, 09:00–16:45, var 15:e minut (= 32 st/dag, 160 totalt).
insert into public.working_hour_slots (tenant_id, staff_id, location_id, weekday, start_time, active)
select 'e2e00000-0000-0000-0000-000000000001',
       'e2e00000-0000-0000-0000-000000000041',
       'e2e00000-0000-0000-0000-000000000071',
       d,
       (time '09:00' + (n || ' minutes')::interval)::time,
       true
from generate_series(1, 5) as d
cross join generate_series(0, 465, 15) as n   -- 09:00 → 16:45
where not exists (
  select 1 from public.working_hour_slots
  where staff_id = 'e2e00000-0000-0000-0000-000000000041'
    and weekday = d
    and start_time = (time '09:00' + (n || ' minutes')::interval)::time
);

-- Aktivering sker först när plats, tjänstkoppling och öppettider finns.
update public.staff
   set active = true
 where id = 'e2e00000-0000-0000-0000-000000000041';

-- Publish only through the Goal 76 readiness boundary.
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', false);
select public.publish_tenant('e2e00000-0000-0000-0000-000000000001');

-- ── deterministisk kundrelation + aktiv självservicebokning ──
-- Två genomförda besök bär historiken. Den aktiva tiden ligger minst tre
-- kalenderdagar fram och alltid mån–fre, alltså utanför tenantens 24 h-spärr men
-- inom ombokningsväljarens 14 dagar.
insert into public.customers (
  id, tenant_id, auth_user_id, display_name, full_name, email, phone,
  first_seen_at, last_seen_at
) values (
  'e2e00000-0000-0000-0000-000000000101',
  'e2e00000-0000-0000-0000-000000000001',
  'e2e00000-0000-0000-0000-0000000000a4',
  'Eira Testkund',
  'Eira Testkund',
  'e2e-customer@frisor1.test',
  '+46700000004',
  now() - interval '30 days',
  now()
)
on conflict (id) do nothing;

insert into public.customer_favorites (id, tenant_id, customer_id, kind, staff_id)
values (
  'e2e00000-0000-0000-0000-000000000102',
  'e2e00000-0000-0000-0000-000000000001',
  'e2e00000-0000-0000-0000-000000000101',
  'staff',
  'e2e00000-0000-0000-0000-000000000041'
)
on conflict (id) do nothing;

insert into public.customer_notes (
  id, tenant_id, customer_id, location_id, preferences, internal_note, created_by
) values (
  'e2e00000-0000-0000-0000-000000000103',
  'e2e00000-0000-0000-0000-000000000001',
  'e2e00000-0000-0000-0000-000000000101',
  'e2e00000-0000-0000-0000-000000000071',
  array['kort på sidorna'],
  'E2E internt: använd sax vid tinningarna',
  'e2e00000-0000-0000-0000-0000000000a2'
)
on conflict (id) do nothing;

with local_today as (
  select (now() at time zone 'Europe/Stockholm')::date as day
), fixture_days as (
  select
    (
      select day - offset_days
      from local_today, generate_series(1, 7) as offset_days
      where extract(isodow from day - offset_days) between 1 and 5
      order by offset_days
      limit 1
    ) as recent_day,
    (
      select day + offset_days
      from local_today, generate_series(3, 9) as offset_days
      where extract(isodow from day + offset_days) between 1 and 5
      order by offset_days
      limit 1
    ) as future_day
), fixture_times as (
  select
    (recent_day + time '10:00') at time zone 'Europe/Stockholm' as recent_start,
    (recent_day - 7 + time '10:00') at time zone 'Europe/Stockholm' as older_start,
    (future_day + time '10:00') at time zone 'Europe/Stockholm' as future_start
  from fixture_days
)
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_profile_id, customer_id,
  start_ts, end_ts, status, price_cents
)
select
  booking.id,
  'e2e00000-0000-0000-0000-000000000001',
  'e2e00000-0000-0000-0000-000000000071',
  'e2e00000-0000-0000-0000-000000000041',
  'e2e00000-0000-0000-0000-000000000051',
  'e2e00000-0000-0000-0000-0000000000a4',
  'e2e00000-0000-0000-0000-000000000101',
  booking.start_ts,
  booking.start_ts + interval '30 minutes',
  booking.status,
  39500
from fixture_times
cross join lateral (
  values
    ('e2e00000-0000-0000-0000-000000000111'::uuid, older_start, 'completed'),
    ('e2e00000-0000-0000-0000-000000000112'::uuid, recent_start, 'completed'),
    ('e2e00000-0000-0000-0000-000000000113'::uuid, future_start, 'confirmed')
) as booking(id, start_ts, status)
on conflict (id) do nothing;

select pg_catalog.set_config('request.jwt.claim.role', '', false);
select pg_catalog.set_config('request.jwt.claims', '', false);
