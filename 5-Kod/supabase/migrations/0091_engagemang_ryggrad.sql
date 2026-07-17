-- 0091_engagemang_ryggrad.sql
-- Plan 014 + 015 (engagemangsmotorn, datalagret): per-kund-samtycke, EN
-- kommunikationsledger och push-prenumerationer. Bara datamodell + RLS —
-- inga marknadsutskick tänds här (plan 003-juridiken gäller före sändning).
--
--   customer_notification_prefs — per-kund kanaler + marknadsförings-samtycke.
--     Defaults: transaktionellt PÅ (email), marknadsföring AV (opt-in, GDPR),
--     sms AV för konto-kunder (SMS får aldrig väljas automatiskt åt en app-kund;
--     gäster utan rad behåller dagens SMS-fallback i routern).
--   notifications_outbox — ledgern: varför/kanal/samtycke/leverans/kostnad.
--     Raderas aldrig; status uppdateras queued→sent→delivered/failed/skipped.
--     Basen för frekvenstak, SMS-kostnadsdashboard och retry (plan 012/017/020).
--   push_subscriptions — Web Push-prenumerationer (VAPID). Döda endpoints
--     revocas (410/404), raderas vid GDPR-erase.

-- ── customer_notification_prefs ─────────────────────────────────────────────
create table public.customer_notification_prefs (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  push_enabled boolean not null default false,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  preferred_channel text check (preferred_channel in ('push','email','sms')),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_source text,
  want_reminders boolean not null default true,
  want_offers boolean not null default false,
  want_open_slots boolean not null default false,
  want_recommendations boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_notification_prefs_tenant_idx
  on public.customer_notification_prefs (tenant_id);

alter table public.customer_notification_prefs enable row level security;

-- Kunden läser/skriver SIN rad; personal (nivå >= 3) läser inom tenanten;
-- ägare (nivå >= 6) får skriva (t.ex. registrera muntligt samtycke).
create policy notification_prefs_read on public.customer_notification_prefs
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
    )
    or exists (
      select 1 from public.customers c
       where c.id = customer_id and c.auth_user_id = (select auth.uid())
    )
  );

create policy notification_prefs_write on public.customer_notification_prefs
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or exists (
      select 1 from public.customers c
       where c.id = customer_id and c.auth_user_id = (select auth.uid())
    )
  )
  with check (
    (select private.is_platform_admin())
    or (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or exists (
      select 1 from public.customers c
       where c.id = customer_id and c.auth_user_id = (select auth.uid())
    )
  );

-- ── notifications_outbox ────────────────────────────────────────────────────
create table public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  event_type text not null,
  category text not null check (category in ('transactional','marketing')),
  chosen_channel text check (chosen_channel in ('push','email','sms')),
  fallback_channel text check (fallback_channel in ('push','email','sms')),
  consent_state jsonb,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','failed','skipped')),
  skip_reason text,
  cost_ore integer,
  provider_ref text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz
);

-- Frekvenstak-frågan: "marknadsföring till kund X senaste N dagar".
create index notifications_outbox_freq_idx
  on public.notifications_outbox (tenant_id, customer_id, category, created_at desc);
-- Retry-läsningen (plan 012): billig partial-scan över köade rader.
create index notifications_outbox_queued_idx
  on public.notifications_outbox (created_at)
  where status = 'queued';

alter table public.notifications_outbox enable row level security;

-- Personal läser sin tenants ledger. ALL skrivning går via service-role
-- (sändarna) — klientroller får aldrig insert/update/delete (ledger-integritet).
create policy notifications_outbox_read on public.notifications_outbox
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 3)
  );

-- ── push_subscriptions ──────────────────────────────────────────────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index push_subscriptions_customer_idx
  on public.push_subscriptions (customer_id) where revoked_at is null;

alter table public.push_subscriptions enable row level security;

-- Kunden äger sina prenumerationer; sändning läser via service-role.
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or exists (
      select 1 from public.customers c
       where c.id = customer_id and c.auth_user_id = (select auth.uid())
    )
  )
  with check (
    (select private.is_platform_admin())
    or exists (
      select 1 from public.customers c
       where c.id = customer_id and c.auth_user_id = (select auth.uid())
    )
  );
