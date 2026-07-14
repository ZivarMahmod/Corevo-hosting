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
-- Fixturen matchar e2e/helpers.ts: slug frisor1, admin@frisor1.se (salon_admin),
-- klippare@frisor1.se (staff), e2e-platform@corevo.se (super_admin).
-- Idempotent (on conflict do nothing) — kör om den fritt.

-- ── tenant ──
insert into public.tenants (id, slug, name)
values ('e2e00000-0000-0000-0000-000000000001', 'frisor1', 'Frisör Ett (E2E)')
on conflict (slug) do nothing;

insert into public.tenant_settings
  (tenant_id, payment_mode, branding, settings, service_fee_type, service_fee_value)
values (
  'e2e00000-0000-0000-0000-000000000001',
  'on_site',
  '{"color_primary":"#b5651d","font_body":"Inter"}'::jsonb,
  -- customer_accounts_enabled: booking.spec + cancel-rebook.spec loggar in som kund
  -- på storefronten. Utan den flaggan finns ingen /konto och specarna dör.
  '{"layout":{"nav_variant":"A","hero_variant":"1"},"customer_accounts_enabled":true}'::jsonb,
  'fixed', 500
)
on conflict (tenant_id) do nothing;

-- ── roller (tenant-lokala) ──
insert into public.roles (id, tenant_id, name, level) values
  ('e2e00000-0000-0000-0000-000000000061', 'e2e00000-0000-0000-0000-000000000001', 'salon_admin', 6),
  ('e2e00000-0000-0000-0000-000000000031', 'e2e00000-0000-0000-0000-000000000001', 'staff', 3)
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
   'authenticated', 'authenticated', 'admin@frisor1.se',
   crypt('__E2E_PASSWORD__', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"e2e00000-0000-0000-0000-000000000001","platform_admin":false}'::jsonb,
   '{}'::jsonb, now(), now()),
  ('e2e00000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'klippare@frisor1.se',
   crypt('__E2E_PASSWORD__', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"e2e00000-0000-0000-0000-000000000001","platform_admin":false}'::jsonb,
   '{}'::jsonb, now(), now()),
  -- OBS e2e-platform@corevo.se, INTE platform@corevo.se: en super_admin med ett
  -- engångslösenord ska aldrig kunna förväxlas med ett riktigt plattformskonto.
  ('e2e00000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-platform@corevo.se',
   crypt('__E2E_PASSWORD__', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"e2e00000-0000-0000-0000-000000000001","platform_admin":true}'::jsonb,
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
insert into public.users (id, tenant_id, email, role_id, status) values
  ('e2e00000-0000-0000-0000-0000000000a1', 'e2e00000-0000-0000-0000-000000000001',
   'admin@frisor1.se', 'e2e00000-0000-0000-0000-000000000061', 'active'),
  ('e2e00000-0000-0000-0000-0000000000a2', 'e2e00000-0000-0000-0000-000000000001',
   'klippare@frisor1.se', 'e2e00000-0000-0000-0000-000000000031', 'active'),
  ('e2e00000-0000-0000-0000-0000000000a3', 'e2e00000-0000-0000-0000-000000000001',
   'e2e-platform@corevo.se', 'e2e00000-0000-0000-0000-000000000088', 'active')
on conflict (id) do nothing;

-- ── plats ──
insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('e2e00000-0000-0000-0000-000000000071', 'e2e00000-0000-0000-0000-000000000001',
   'Frisör Ett', 'Europe/Stockholm', true)
on conflict (id) do nothing;

-- ── personal (kopplad till klippar-användaren) ──
insert into public.staff (id, tenant_id, profile_id, title, active, location_id) values
  ('e2e00000-0000-0000-0000-000000000041', 'e2e00000-0000-0000-0000-000000000001',
   'e2e00000-0000-0000-0000-0000000000a2', 'Frisör', true,
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
