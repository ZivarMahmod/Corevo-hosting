-- ============================================================================
-- 0001 — Core multi-tenant schema (Corevo Booking Platform · M9)
-- Scope = goal-02 table list (narrow). NOT the full 01-DB-schema superset.
-- Naming harmonized to goal-02: staff / staff_id, start_ts / end_ts.
-- ============================================================================
create extension if not exists pgcrypto;    -- gen_random_uuid()
create extension if not exists btree_gist;  -- EXCLUDE no-double-booking

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== CORE / TENANT =====
create table public.tenants (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  plan              text not null default 'standard',
  status            text not null default 'active',          -- active | suspended
  stripe_account_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create table public.tenant_domains (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  domain     text not null unique,
  is_primary boolean not null default false,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);
create index tenant_domains_tenant_id_idx on public.tenant_domains (tenant_id);

create table public.tenant_settings (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  payment_mode      text not null default 'on_site',         -- on_site | online | both | coming_soon
  branding          jsonb not null default '{}'::jsonb,      -- ADR 01 §3 lvl 1 (logo_url, color_primary, font_body)
  settings          jsonb not null default '{}'::jsonb,      -- ADR 01 §3 lvl 2/3 (layout variants, custom_override)
  service_fee_type  text not null default 'fixed'
                      check (service_fee_type in ('fixed', 'percent')),
  service_fee_value int  not null default 500,               -- öre (fixed) | procent-tal (percent)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz,
  unique (tenant_id)
);
create index tenant_settings_tenant_id_idx on public.tenant_settings (tenant_id);

-- ===== ROLES / USERS =====
create table public.roles (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id) on delete cascade,  -- null = global roll (platform/super admin)
  name       text not null,
  level      int  not null check (level between 1 and 8),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create index roles_tenant_id_idx on public.roles (tenant_id);

create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,  -- = auth.users.id (Supabase Auth)
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  email      text,
  phone      text,
  role_id    uuid references public.roles(id),
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index users_tenant_id_idx on public.users (tenant_id);

-- ===== STAFF / SERVICES =====
create table public.staff (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid references public.users(id),                -- linked employee user (optional)
  title      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index staff_tenant_id_idx on public.staff (tenant_id);

create table public.services (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  description  text,
  category     text,
  duration_min int  not null check (duration_min > 0),
  price_cents  int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create index services_tenant_id_idx on public.services (tenant_id);

create table public.staff_services (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (staff_id, service_id)
);
create index staff_services_tenant_id_idx on public.staff_services (tenant_id);

-- ===== WORKING HOURS / TIME OFF =====
create table public.working_hours (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);
create index working_hours_tenant_id_idx on public.working_hours (tenant_id);
create index working_hours_staff_id_idx on public.working_hours (staff_id);

create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  start_ts   timestamptz not null,
  end_ts     timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (end_ts > start_ts)
);
create index time_off_tenant_id_idx on public.time_off (tenant_id);
create index time_off_staff_id_idx on public.time_off (staff_id);

-- ===== BOOKINGS =====
create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  staff_id            uuid not null references public.staff(id),
  service_id          uuid not null references public.services(id),
  customer_profile_id uuid,                                   -- customers out of scope (goal-02): plain uuid, no FK
  start_ts            timestamptz not null,
  end_ts              timestamptz not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  price_cents         int,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  check (end_ts > start_ts)
);
create index bookings_tenant_id_idx on public.bookings (tenant_id);
create index bookings_tenant_start_idx on public.bookings (tenant_id, start_ts);
create index bookings_staff_start_idx on public.bookings (staff_id, start_ts);

-- DOUBLE-BOOKING GUARD (hard DB garantee): no staff member can hold two
-- overlapping active bookings. cancelled/no_show do not block.
alter table public.bookings
  add constraint no_double_booking
  exclude using gist (
    staff_id with =,
    tstzrange(start_ts, end_ts) with &&
  )
  where (status in ('pending', 'confirmed', 'completed'));

-- ===== PAYMENTS (never stores card data) =====
create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  booking_id               uuid not null references public.bookings(id) on delete cascade,
  stripe_payment_intent_id text,
  amount_cents             int  not null,
  currency                 text not null default 'sek',
  status                   text not null default 'pending'
                            check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz
);
create index payments_tenant_id_idx on public.payments (tenant_id);
create index payments_booking_id_idx on public.payments (booking_id);

-- ===== AUDIT LOG (append-only; see 0002 for the enforcement) =====
create table public.audit_log (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  actor_profile_id uuid,
  action           text not null,
  entity           text not null,
  entity_id        uuid,
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index audit_log_tenant_created_idx on public.audit_log (tenant_id, created_at);

-- ===== updated_at triggers =====
create trigger trg_tenants_updated         before update on public.tenants         for each row execute function public.set_updated_at();
create trigger trg_tenant_settings_updated before update on public.tenant_settings for each row execute function public.set_updated_at();
create trigger trg_users_updated           before update on public.users           for each row execute function public.set_updated_at();
create trigger trg_staff_updated           before update on public.staff           for each row execute function public.set_updated_at();
create trigger trg_services_updated        before update on public.services        for each row execute function public.set_updated_at();
create trigger trg_bookings_updated        before update on public.bookings        for each row execute function public.set_updated_at();
create trigger trg_payments_updated        before update on public.payments        for each row execute function public.set_updated_at();
