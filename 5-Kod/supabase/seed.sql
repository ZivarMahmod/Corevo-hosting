-- ============================================================================
-- Seed — 1 demo tenant (frisor1) + settings + admin + staff + 3 services.
-- Idempotent (safe to re-run). app_metadata.tenant_id is set directly on the
-- auth.users rows (belt-and-suspenders alongside the Custom Access Token Hook),
-- so RLS works end-to-end immediately.
-- ============================================================================

-- ── tenant ──
insert into public.tenants (id, slug, name)
values ('11111111-1111-1111-1111-111111111111', 'frisor1', 'Frisör Ett')
on conflict (slug) do nothing;

insert into public.tenant_domains (tenant_id, domain, is_primary, verified)
values ('11111111-1111-1111-1111-111111111111', 'frisor1.corevo.se', true, true)
on conflict (domain) do nothing;

insert into public.tenant_settings
  (tenant_id, payment_mode, branding, settings, service_fee_type, service_fee_value)
values (
  '11111111-1111-1111-1111-111111111111',
  'on_site',
  '{"color_primary":"#b5651d","font_body":"Inter","logo_url":"/demo-logo-frisor1.svg"}'::jsonb,
  -- G12: frisor1 opts INTO customer accounts (storefront login + /konto). frisor2 leaves it off.
  '{"layout":{"nav_variant":"A","hero_variant":"1"},"customer_accounts_enabled":true}'::jsonb,
  'fixed', 500
)
on conflict (tenant_id) do nothing;

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

-- ── staff (1, linked to the klippare user) ──
insert into public.staff (id, tenant_id, profile_id, title, active) values
  ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '33333333-0000-0000-0000-000000000002', 'Frisör', true)
on conflict (id) do nothing;

-- ── services (3) ──
insert into public.services
  (id, tenant_id, name, description, category, duration_min, price_cents, active) values
  ('55555555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Klippning', 'Herrklippning', 'Hår', 30, 39500, true),
  ('55555555-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Skäggtrim', 'Trim och rakning', 'Skägg', 15, 19500, true),
  ('55555555-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Klipp & Skägg', 'Paket', 'Paket', 45, 54500, true)
on conflict (id) do nothing;

-- ── staff_services (the staff member does all three) ──
insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002'),
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000003')
on conflict (staff_id, service_id) do nothing;

-- ── working_hours (Mon-Fri 09:00-17:00) ──
insert into public.working_hours (tenant_id, staff_id, weekday, start_time, end_time)
select '11111111-1111-1111-1111-111111111111',
       '44444444-0000-0000-0000-000000000001',
       d, time '09:00', time '17:00'
from generate_series(1, 5) as d
where not exists (
  select 1 from public.working_hours
  where staff_id = '44444444-0000-0000-0000-000000000001' and weekday = d
);

-- ============================================================================
-- Second demo tenant (frisor2) — for the G03 white-label DoD. Differs from
-- frisor1 on exactly the three theme axes + its own services:
--   · branding   → teal + serif (frisor1 = terracotta + Inter)
--   · layout     → nav_variant=B, hero_variant=2 (frisor1 = A / 1)
--   · custom_override → scoped CSS (frisor1 has none) — proves nivå-3 isolation.
-- Public site only needs tenant + settings + services (no auth/staff/roles).
-- ============================================================================
insert into public.tenants (id, slug, name)
values ('12121212-1212-1212-1212-121212121212', 'frisor2', 'Salong Två')
on conflict (slug) do nothing;

insert into public.tenant_domains (tenant_id, domain, is_primary, verified)
values ('12121212-1212-1212-1212-121212121212', 'frisor2.corevo.se', true, true)
on conflict (domain) do nothing;

insert into public.tenant_settings
  (tenant_id, payment_mode, branding, settings, service_fee_type, service_fee_value)
values (
  '12121212-1212-1212-1212-121212121212',
  'on_site',
  '{"color_primary":"#0f766e","color_bg":"#f5f3ee","color_fg":"#102a26","font_body":"Georgia, \"Times New Roman\", serif","logo_url":null}'::jsonb,
  -- nav_variant=B + hero_variant=2 (nivå 2) and a scoped custom_override (nivå 3).
  -- custom_override.css is wrapped by the app as [data-tenant="<id>"]{ … } (CSS nesting),
  -- so it physically cannot apply to any other tenant's subtree.
  '{"layout":{"nav_variant":"B","hero_variant":"2"},"custom_override":{"css":".hero{background:#0b132b;color:#ffffff} .hero h1{letter-spacing:.14em;text-transform:uppercase} .service-card{border-color:#0f766e}"}}'::jsonb,
  'fixed', 500
)
on conflict (tenant_id) do nothing;

-- ── frisor2 services (3, distinct from frisor1) ──
insert into public.services
  (id, tenant_id, name, description, category, duration_min, price_cents, active) values
  ('56565656-0000-0000-0000-000000000001', '12121212-1212-1212-1212-121212121212',
   'Färgning', 'Helfärg inkl. ton', 'Färg', 90, 129500, true),
  ('56565656-0000-0000-0000-000000000002', '12121212-1212-1212-1212-121212121212',
   'Klippning dam', 'Klippning och styling', 'Hår', 45, 64500, true),
  ('56565656-0000-0000-0000-000000000003', '12121212-1212-1212-1212-121212121212',
   'Föning', 'Tvätt och föning', 'Styling', 30, 34500, true)
on conflict (id) do nothing;

-- ============================================================================
-- Auth foundation + booking engine (M3) extras.
-- ============================================================================

-- ── global super_admin role (platform-wide, tenant_id NULL, level 8) ──
-- on conflict (id): a NULL tenant_id makes (tenant_id, name) non-unique, so we
-- key idempotency off the PK instead.
insert into public.roles (id, tenant_id, name, level)
values ('22222222-9999-9999-9999-000000000008', null, 'super_admin', 8)
on conflict (id) do nothing;

-- ── platform super-admin user (för roll-guard "når tvärs"-testet) ──
-- platform_admin baked into raw_app_meta_data so the JWT carries it even before
-- the Custom Access Token Hook is enabled in the Dashboard. tenant_id = frisor1
-- is just the home tenant; is_platform_admin() unlocks cross-tenant via RLS.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('33333333-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'platform@corevo.se',
   crypt('Demo!1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"tenant_id":"11111111-1111-1111-1111-111111111111","platform_admin":true}'::jsonb,
   '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.users (id, tenant_id, email, role_id, status) values
  ('33333333-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
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

-- ── locations (primary per tenant) + location_id backfill (migration 0005) ──
-- On a fresh local `supabase db reset` the 0005 migration runs before any tenant
-- exists (no-op), so the seed carries the equivalent location rows + backfill.
insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('77777777-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Frisör Ett', 'Europe/Stockholm', true),
  ('77777777-0000-0000-0000-000000000002', '12121212-1212-1212-1212-121212121212', 'Salong Två', 'Europe/Stockholm', true)
on conflict (id) do nothing;

update public.staff s set location_id = l.id
  from public.locations l
 where l.tenant_id = s.tenant_id and l.is_primary and s.location_id is null;
update public.services sv set location_id = l.id
  from public.locations l
 where l.tenant_id = sv.tenant_id and l.is_primary and sv.location_id is null;
update public.working_hours wh set location_id = l.id
  from public.locations l
 where l.tenant_id = wh.tenant_id and l.is_primary and wh.location_id is null;
