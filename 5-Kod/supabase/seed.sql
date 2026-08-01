-- ============================================================================
-- Seed — ONE demo salon (G13 go-live). Tenant "Frisör Demo", slug `demo`,
-- host demo.corevo.se, customer accounts ON. + 3 login accounts (all Demo!1234):
--   platform@corevo.se   super_admin (level 8)  -> booking.corevo.se back-office
--   admin@frisor1.se     salon_admin (level 6)  -> demo back-office
--   klippare@frisor1.se  staff       (level 3)  -> personalvy
-- (The admin/klippare email domain is historical; kept so seed == cloud accounts.)
--
-- app_metadata.tenant_id is baked onto the auth.users rows (belt-and-suspenders
-- alongside the Custom Access Token Hook) so RLS works end-to-end immediately.
-- Idempotent (safe to re-run).
-- ============================================================================

-- ── tenant ──
insert into public.tenants (id, slug, name, status)
values ('11111111-1111-1111-1111-111111111111', 'demo', 'Frisör Demo', 'provisioning')
on conflict (slug) do nothing;

insert into public.tenant_domains (tenant_id, domain, is_primary, verified)
values ('11111111-1111-1111-1111-111111111111', 'demo.corevo.se', true, true)
on conflict (domain) do nothing;

insert into public.tenant_settings
  (tenant_id, payment_mode, branding, settings, service_fee_type, service_fee_value)
values (
  '11111111-1111-1111-1111-111111111111',
  'on_site',
  '{"color_primary":"#b5651d","font_body":"Inter","logo_url":"/demo-logo-frisor1.svg"}'::jsonb,
  -- G12: demo opts INTO customer accounts (storefront login + /konto).
  '{"layout":{"nav_variant":"A","hero_variant":"1"},"customer_accounts_enabled":true}'::jsonb,
  'fixed', 500
)
on conflict (tenant_id) do nothing;

-- ── location + confirmed opening hours ──
-- Migrations run before seed data, so readiness dependencies must be seeded
-- explicitly before a staff row can be activated.
insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('77777777-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Frisör Demo', 'Europe/Stockholm', true)
on conflict (id) do nothing;

insert into public.location_opening_hours
  (tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at)
select
  '11111111-1111-1111-1111-111111111111',
  '77777777-0000-0000-0000-000000000001',
  d, time '09:00', time '17:00', 'confirmed', now()
from generate_series(1, 5) as d
on conflict (location_id, weekday, start_time, end_time) do nothing;

-- ── roles ──
insert into public.roles (id, tenant_id, name, level) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'salon_admin', 6),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'staff', 3)
on conflict (tenant_id, name) do nothing;

-- ── auth.users (Supabase Auth). tenant_id baked into raw_app_meta_data. ──
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@frisor1.se',
   crypt('Demo!1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"11111111-1111-1111-1111-111111111111","platform_admin":false}'::jsonb,
   '{}'::jsonb, now(), now()),
  ('33333333-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'klippare@frisor1.se',
   crypt('Demo!1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"11111111-1111-1111-1111-111111111111","platform_admin":false}'::jsonb,
   '{}'::jsonb, now(), now())
on conflict (id) do nothing;

-- ── public.users (id = auth.users.id) ──
insert into public.users (id, tenant_id, email, role_id, status) values
  ('33333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'admin@frisor1.se', '22222222-0000-0000-0000-000000000001', 'active'),
  ('33333333-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'klippare@frisor1.se', '22222222-0000-0000-0000-000000000002', 'active')
on conflict (id) do nothing;

-- ── staff draft (linked to the klippare user) ──
insert into public.staff (id, tenant_id, location_id, profile_id, title, active) values
  ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '77777777-0000-0000-0000-000000000001',
   '33333333-0000-0000-0000-000000000002', 'Frisör', false)
on conflict (id) do nothing;

-- ── services (3) ──
insert into public.services
  (id, tenant_id, location_id, name, description, category, duration_min, price_cents, active) values
  ('55555555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '77777777-0000-0000-0000-000000000001', 'Klippning', 'Herrklippning', 'Hår', 30, 39500, true),
  ('55555555-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   '77777777-0000-0000-0000-000000000001', 'Skäggtrim', 'Trim och rakning', 'Skägg', 15, 19500, true),
  ('55555555-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   '77777777-0000-0000-0000-000000000001', 'Klipp & Skägg', 'Paket', 'Paket', 45, 54500, true)
on conflict (id) do nothing;

-- ── staff_services (the staff member does all three) ──
insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002'),
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000003')
on conflict (staff_id, service_id) do nothing;

-- ── working_hours (Mon-Fri 09:00-17:00) ──
insert into public.working_hours (tenant_id, staff_id, location_id, weekday, start_time, end_time)
select '11111111-1111-1111-1111-111111111111',
       '44444444-0000-0000-0000-000000000001',
       '77777777-0000-0000-0000-000000000001',
       d, time '09:00', time '17:00'
from generate_series(1, 5) as d
where not exists (
  select 1 from public.working_hours
  where staff_id = '44444444-0000-0000-0000-000000000001' and weekday = d
);

-- Activate only after the location, confirmed opening hours, services and
-- working hours satisfy the database readiness invariant.
update public.staff
   set active = true
 where id = '44444444-0000-0000-0000-000000000001';

-- ============================================================================
-- Platform super-admin (cross-tenant back-office on booking.corevo.se).
-- ============================================================================

-- ── global super_admin role (platform-wide, tenant_id NULL, level 8) ──
-- on conflict (id): a NULL tenant_id makes (tenant_id, name) non-unique, so we
-- key idempotency off the PK instead.
insert into public.roles (id, tenant_id, name, level)
values ('22222222-9999-9999-9999-000000000008', null, 'super_admin', 8)
on conflict (id) do nothing;

-- platform_admin baked into raw_app_meta_data so the JWT carries it even before
-- the Custom Access Token Hook is enabled in the Dashboard. Goal 76 / 0114:
-- a super_admin identity is global and therefore has tenant_id NULL.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('33333333-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'platform@corevo.se',
   crypt('Demo!1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":null,"platform_admin":true}'::jsonb,
   '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.users (id, tenant_id, email, role_id, status) values
  ('33333333-0000-0000-0000-000000000003', null,
   'platform@corevo.se', '22222222-9999-9999-9999-000000000008', 'active')
on conflict (id) do nothing;

-- GoTrue scans these token columns into Go strings and chokes on NULL
-- ("Database error querying schema" / "converting NULL to string"). When seeding
-- auth.users by hand they must be '' not NULL. Normalise after the inserts.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where id in (
  '33333333-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002',
  '33333333-0000-0000-0000-000000000003'
);

-- Publish only after settings, primary location and active owner exist. This
-- exercises the same DB-owned Goal 76 gate as the application.
update public.tenants
   set status = 'active'
 where id = '11111111-1111-1111-1111-111111111111';
