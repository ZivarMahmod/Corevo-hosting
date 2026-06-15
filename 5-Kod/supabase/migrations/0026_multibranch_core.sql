-- ============================================================================
-- 0026 — Multi-bransch DB-grund · CORE TABLES (spår 1, 1-Planering/05-multibransch-bygge)
--
-- Bygger de RIKTIGA tabellerna bakom plattformsmotorn (konflikt 1 i 06-syntes:
-- jsonb-genväg ÖVERKÖRD). Håller de DELADE KONTRAKTEN i 00-plan-index.md ordagrant:
--   verticals(key,name,default_modules,default_template,terminology,rules)
--   modules(key,name,owns_tables,variant_schema,default_config,default_section_position)
--   tenant_modules(tenant_id,module_key,state,config)
--   templates(key,name,tags,tokens,sections,status)
--   content_slots / template_slots  (03-innehall-asset.md, ordagrant DDL)
--   tenants.vertical_id  (mjuk, mutabel, nullable FK → verticals.key)
--
-- RLS + policies ligger i 0027. Seed + backfill i 0028. users.tenant_id-skulden
-- i 0029 (VALBAR). Denna fil = bara DDL (tabeller/index/FK), allt idempotent.
--
-- NOTE — media_assets: 03-innehall-asset.md bygger PÅ "befintliga media_assets",
-- men tabellen finns INTE i migrationshistoriken (referens till DB-schema §2 som
-- aldrig migrerades). content_slots.asset_id måste peka någonstans → vi skapar en
-- MINIMAL kanonisk media_assets (create table if not exists) med de dokumenterade
-- kolumnerna + de additiva (width/height/content_hash/source/library_item_id) så
-- kontraktet håller och FK:n resolvar. Om ett annat spår senare äger media_assets
-- är denna create en no-op (if not exists) och kolumnerna additiva (build-once).
--
-- IDEMPOTENT: create table if not exists / add column if not exists / create index
-- if not exists. Säker att köra om. Build-once-never-delete (inget droppas här).
-- ============================================================================

-- ── 0. media_assets (CMS/media-bas, 03 §3) — minimal kanonisk, additiv ──────
create table if not exists public.media_assets (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  r2_key          text not null,                       -- nyckel i R2-bucketen (content-addressed, 03 §3.1)
  url             text not null,                       -- publik CDN-URL storefront läser direkt
  type            text not null default 'image',       -- image | logo | gallery | video (utbyggbart)
  alt             text,
  size_bytes      bigint not null default 0,           -- speglas vid upload → kvot-mätning (03 §4.3)
  -- additiva kolumner (03 §3, build-once):
  width           int,
  height          int,
  content_hash    text,
  source          text not null default 'upload'       -- upload | library | stock
                    check (source in ('upload','library','stock')),
  library_item_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
-- om tabellen redan fanns (annat spår): se till att additiva kolumner finns.
alter table public.media_assets add column if not exists width           int;
alter table public.media_assets add column if not exists height          int;
alter table public.media_assets add column if not exists content_hash    text;
alter table public.media_assets add column if not exists source          text;
alter table public.media_assets add column if not exists library_item_id uuid;
create index if not exists media_assets_tenant_id_idx on public.media_assets (tenant_id);

-- ── 1. verticals (bransch-preset, KATALOG — plattform-ägd, ej tenant-scopad) ─
-- Bransch = preset/etikett, INTE lås (00-plan-index). key = stabil bransch-nyckel.
create table if not exists public.verticals (
  key              text primary key,                   -- 'frisör' | 'barbershop' | 'nagelstudio' | 'restaurang' | 'generell'
  name             text not null,                      -- visningsnamn
  default_modules  jsonb not null default '{}'::jsonb, -- { "booking":"live", "loyalty":"draft", "shop":"off" } (preset-states)
  default_template text,                               -- mall-nyckel (→ templates.key, mjuk koppling)
  terminology      jsonb not null default '{}'::jsonb, -- { "staff":"Stylist", "service":"Klippning" } (etikett-överlägg)
  rules            jsonb not null default '{}'::jsonb, -- bransch-regler/varianthints (config-first, ej if(bransch))
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

-- ── 2. modules (modul-katalog — plattform-ägd, ej tenant-scopad) ────────────
create table if not exists public.modules (
  key                      text primary key,           -- 'booking' | 'loyalty' | 'shop' | 'media_library' ...
  name                     text not null,
  owns_tables              jsonb not null default '[]'::jsonb,  -- ["bookings","services",...] tabeller modulen äger
  variant_schema           jsonb not null default '{}'::jsonb,  -- schema för config-varianter (beteende = data)
  default_config           jsonb not null default '{}'::jsonb,  -- default-config vid aktivering
  default_section_position text,                                -- 06-syntes konflikt 3: var moduls fallback-komponent injiceras
  created_at               timestamptz not null default now(),
  updated_at               timestamptz
);

-- ── 3. templates (mall-katalog: token+sektion — plattform-ägd, tenant LÄSER aktiva) ─
-- Kontrakt 00: templates(key,name,tags{bransch,typ,stil,licens,scope},tokens{color,font,layout},sections[])
create table if not exists public.templates (
  key        text primary key,                         -- 'salvia' ...
  name       text not null,
  tags       jsonb not null default '{}'::jsonb,       -- { bransch, typ, stil, licens, scope } (02-mall-skin)
  tokens     jsonb not null default '{}'::jsonb,       -- { color, font, layout } → CSS-variabler
  sections   jsonb not null default '[]'::jsonb,       -- [ { key, ... } ] sektionsordning; varje sektion deklarerar slots
  status     text not null default 'draft'             -- draft | active | archived (RLS tenant-read filtrerar status='active')
               check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ── 4. template_slots (mall-nivå slot-DEKLARATION — super-admin write / tenant read) ─
-- 03-innehall-asset.md §1.2, ordagrant kontrakt.
create table if not exists public.template_slots (
  id                uuid primary key default gen_random_uuid(),
  template_key      text not null references public.templates(key) on delete cascade,
  section_key       text not null,                     -- vilken sektion i templates.sections[]
  slot_key          text not null,                     -- stabil nyckel, t.ex. 'team.member.0.photo'
  label             text not null,                     -- mänsklig etikett i super-admin
  kind              text not null
                      check (kind in ('asset','text','module')),
  asset_role        text,                              -- 'image' | 'logo' | 'gallery' | 'video'
  aspect_hint       text,                              -- '16:9' | '1:1' | '4:5'
  module_key        text,                              -- vid kind='module' (matchar modules.key)
  module_view       text,                              -- t.ex. 'service_list' | 'booking_cta'
  repeatable        boolean not null default false,    -- team/galleri
  sort_order        int not null default 0,
  default_kind      text,                              -- mallens stock-default
  default_text      text,
  default_asset_key text,                              -- R2-key till mallens stockbild (plattform-ägd)
  unique (template_key, slot_key)
);
create index if not exists template_slots_template_idx on public.template_slots (template_key);

-- ── 5. content_slots (tenant-nivå slot-VÄRDE — RLS via private.tenant_id()) ──
-- 03-innehall-asset.md §1.3, ordagrant kontrakt. asset_id → media_assets(id).
create table if not exists public.content_slots (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  template_key text not null,                          -- vilken mall kunden kör (matchar tenant_settings.settings.theme)
  slot_key     text not null,                          -- = template_slots.slot_key
  kind         text not null
                 check (kind in ('asset','text','module')),
  -- exakt EN av nedan är satt beroende på kind:
  asset_id     uuid references public.media_assets(id) on delete set null,  -- kind='asset'
  text_value   jsonb,                                  -- kind='text': { format:'plain'|'rich', value:'…' }
  module_ref   jsonb,                                  -- kind='module': { module_key, view, params }
  updated_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  unique (tenant_id, template_key, slot_key)
);
create index if not exists content_slots_tenant_template_idx on public.content_slots (tenant_id, template_key);

-- ── 6. tenant_modules (per-kund modul-livscykel + variant + pris-hook) ──────
-- state-maskin off→draft→live→paused. BARA super-admin gör off→draft (00-plan-index,
-- enforced i 0027 via WITH CHECK + en guard-trigger). config bär variant + billing-hook.
create table if not exists public.tenant_modules (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  module_key   text not null references public.modules(key) on delete restrict,
  state        text not null default 'off'
                 check (state in ('off','draft','live','paused')),
  config       jsonb not null default '{}'::jsonb,
  activated_at timestamptz,                            -- sätts första gången state lämnar 'off'
  updated_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (tenant_id, module_key)
);
create index if not exists tenant_modules_tenant_idx on public.tenant_modules (tenant_id);
create index if not exists tenant_modules_module_idx on public.tenant_modules (module_key);

-- ── 7. tenants.vertical_id (mjuk default, mutabel, nullable FK → verticals.key) ─
-- Nullable med avsikt: backfill (0028) sätter värdet; ny tenant utan vertical = NULL
-- tills onboarding väljer bransch. on delete set null = bransch-rad får tas bort
-- utan att slå sönder tenants (build-once: vi tar dock aldrig bort branscher).
alter table public.tenants add column if not exists vertical_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_vertical_id_fkey'
  ) then
    alter table public.tenants
      add constraint tenants_vertical_id_fkey
      foreign key (vertical_id) references public.verticals(key) on delete set null;
  end if;
end $$;
create index if not exists tenants_vertical_id_idx on public.tenants (vertical_id);

-- ── 8. updated_at-triggers (befintlig public.set_updated_at från 0001) ──────
-- Idempotent: drop if exists → create. Speglar 0001-mönstret.
do $$
declare
  t text;
begin
  foreach t in array array[
    'media_assets','verticals','modules','templates','content_slots','tenant_modules'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I;', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I '
      || 'for each row execute function public.set_updated_at();', t
    );
  end loop;
end $$;

-- ── 9. tenant_modules state-övergångsvakt (off→draft endast super-admin) ────
-- 00-plan-index LÅST: "Bara Zivar gör off→draft." Regeln görs HÅRD i DB: en
-- INSERT/UPDATE som flyttar state FRÅN 'off' (modul-AKTIVERING) tillåts BARA av
-- super-admin. "Super-admin" = någon av:
--   (a) platform_admin-claim i JWT  → private.is_platform_admin()
--   (b) service_role                → backend/Edge med service-key (bypassar RLS)
--   (c) DIREKT DB-kontext utan PostgREST-request → migration / seed / cron / psql
--       (request.jwt.claims saknas helt). Sådan åtkomst är redan privilegierad
--       (kräver DB-credentials) → seed-migrationen (0028) får sätta booking:live.
-- En vanlig tenant-admin går ALLTID via PostgREST med en JWT som bär tenant_id men
-- INTE platform_admin → blockeras här. Övriga övergångar (draft↔live↔paused) styrs
-- av RLS (0027). activated_at stämplas vid första aktiveringen.
create or replace function public.tenant_modules_state_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claims   text    := current_setting('request.jwt.claims', true);
  no_request boolean := (v_claims is null or v_claims = '');   -- direkt DB/migration/cron
  is_admin   boolean := coalesce(private.is_platform_admin(), false);
  is_service boolean := coalesce(nullif(v_claims, '')::jsonb ->> 'role', '') = 'service_role'
                        or current_user = 'service_role';
begin
  -- Aktivering = state lämnar 'off' (INSERT med state<>'off', eller UPDATE off→annat).
  if (tg_op = 'INSERT' and new.state <> 'off')
     or (tg_op = 'UPDATE' and old.state = 'off' and new.state <> 'off') then
    if not (no_request or is_admin or is_service) then
      raise exception
        'off->% (modul-aktivering) kräver super-admin (platform_admin/service_role)', new.state
        using errcode = '42501';
    end if;
    if new.activated_at is null then
      new.activated_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tenant_modules_state_guard on public.tenant_modules;
create trigger trg_tenant_modules_state_guard
  before insert or update on public.tenant_modules
  for each row execute function public.tenant_modules_state_guard();
