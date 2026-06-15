-- ============================================================================
-- 0034 — Blogg-modul · REGISTER + TABELL + RLS (multi-bransch spår 5)
--
-- Registrerar EN modul `blogg` i public.modules — EN modul med VARIANTER
-- (config, ej fork), EXAKT samma mönster som webshop- (0031/0032) och offert-
-- modulen (0033) per LÅST beslut 14.5 (CONFIG-FIRST) + §15 (skelett vs skin):
-- presentations-skillnader = varianter inuti modulen, aldrig `if (bransch)` i
-- motorn. Branschens preset väljer default-variant. (Plan: 07-maxad-byggplan.md
-- #6 "… + offert + blogg".)
--
-- VARIANTER (variant_schema.layout.enum) — hur inläggslistan presenteras:
--   'list'     — stapel av inlägg (rubrik + ingress), enklast/renast.
--   'grid'     — kort i rutnät (default; samma rytm som shop-katalogen).
--   'featured' — första inlägget stort + resten som lista under.
--
-- INGEN BETAL-HOOK (till skillnad från shop/offert): Blogg rör inga pengar →
-- ingen betal-hook. En blogg publicerar innehåll; det finns ingen rad, inget
-- belopp och ingen provider att koppla. Compliance: rör inga pengar → trivialt.
--
-- LIVSCYKEL (§4): modulen seedas INTE per tenant här. blogg = opt-in;
-- super-admin flippar off→draft per kund (state-vakten i 0026 §9 kräver
-- platform_admin för off→draft). Storefronten gatear på tenant_modules.state
-- ='live' (EXAKT som booking + shop + offert).
--
-- owns_tables = tabellen 0034 skapar (modulen äger den; gatad av state).
-- default_section_position = var modulens fallback-sektion injiceras i storefront
-- — 'main', som booking/shop/offert, så skinnet kan placera blogg-sektionen.
--
-- RLS-MÖNSTER taget ORDAGRANT ur 0033 (som i sin tur tog det ur 0032/0027):
--   tenant-scoped:  using/with check (tenant_id = (select private.tenant_id())
--                                     or (select private.is_platform_admin()))
--   anon storefront-READ: publik storefront får LÄSA inlägg — men ENDAST
--     publicerade (status = 'published'). Detta är AVSIKTLIGT snävare än
--     shop_products (som är anon-läsbar för alla aktiva rader): utkast/arkiverade
--     inlägg får ALDRIG läcka till publiken. App-lagret filtrerar dessutom på
--     tenant_id (anon bär ingen tenant-claim). anon får INTE skriva.
--   private.tenant_id() / private.is_platform_admin() / public.set_updated_at()
--     definieras i 0002/0004/0001 — vi återanvänder dem, skapar inga nya helpers.
--
-- IDEMPOTENT: insert ... on conflict (key) do update (register) + create table
-- if not exists / create index if not exists / drop policy if exists → create.
-- Build-once-never-delete (inget droppas). Säker att köra om.
--
-- ⚠ APPLICERA INTE automatiskt mot prod. Granska → kör manuellt när godkänd.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════
-- 1. REGISTER — EN modul `blogg` i public.modules (varianter via config)
-- ════════════════════════════════════════════════════════════════════════
insert into public.modules
  (key, name, owns_tables, variant_schema, default_config, default_section_position)
values (
  'blogg',
  'Blogg',
  -- Tabell modulen äger (skapas nedan). Gatad av tenant_modules.state.
  '["blog_posts"]'::jsonb,
  -- variant_schema: deklarerar blogg-varianterna (presentation = data). Super-admin/
  -- onboarding läser detta för att visa val; storefronten läser
  -- tenant_modules.config.layout för att veta hur blogg-sektionen ska renderas.
  '{
    "layout": {
      "type": "enum",
      "enum": ["list", "grid", "featured"],
      "default": "grid",
      "labels": {
        "list": "Lista",
        "grid": "Rutnät",
        "featured": "Utvald + lista"
      },
      "params": {
        "posts_per_page": { "type": "int", "default": 6, "min": 1 }
      }
    }
  }'::jsonb,
  -- default_config: vald variant + dess parametrar. INGEN betal-hook (blogg rör
  -- inga pengar, till skillnad från shop/offert). Sätts vid aktivering (off→draft);
  -- branschens preset kan skriva över layout.
  '{
    "layout": "grid",
    "posts_per_page": 6
  }'::jsonb,
  'main'
)
on conflict (key) do update
  set name                     = excluded.name,
      owns_tables              = excluded.owns_tables,
      variant_schema           = excluded.variant_schema,
      default_config           = excluded.default_config,
      default_section_position = excluded.default_section_position,
      updated_at               = now();

-- ════════════════════════════════════════════════════════════════════════
-- 2. TABELL — blog_posts (ett inlägg/rad/tenant; variant-agnostiskt)
--    Lagrar EN modell för alla tre layouter (config-first). Layouten påverkar
--    bara presentationen i storefront, aldrig raden. Ingen fork per variant.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  title           text not null,
  slug            text,
  excerpt         text,
  body            text,                                -- markdown/plaintext inläggstext
  cover_asset_id  uuid references public.media_assets(id) on delete set null,
  status          text not null default 'draft'
                    check (status in ('draft','published','archived')),
  published_at    timestamptz,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create index if not exists blog_posts_tenant_idx on public.blog_posts (tenant_id);
create index if not exists blog_posts_tenant_status_idx on public.blog_posts (tenant_id, status);
create index if not exists blog_posts_tenant_published_idx on public.blog_posts (tenant_id, published_at);

-- updated_at-trigger (befintlig public.set_updated_at från 0001).
do $$
begin
  drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
  create trigger trg_blog_posts_updated_at before update on public.blog_posts
    for each row execute function public.set_updated_at();
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS — tenant-scoped via private.tenant_id() + is_platform_admin()-bypass
--    (mönster ordagrant ur 0033). anon får LÄSA inlägg — men ENDAST publicerade
--    (snävare än shop_products med flit: utkast får aldrig läcka).
-- ════════════════════════════════════════════════════════════════════════

-- grants: PostgREST exponerar bara public. anon får SELECT för publik storefront-
-- läsning (RLS gatar raden till status='published'; app-lagret filtrerar tenant).
-- authenticated får full CRUD (RLS scopar till egen tenant / admin).
grant select on public.blog_posts to anon, authenticated;
grant select, insert, update, delete on public.blog_posts to authenticated;

alter table public.blog_posts enable row level security;
drop policy if exists blog_posts_rls         on public.blog_posts;
drop policy if exists blog_posts_public_read on public.blog_posts;
-- tenant-scoped write/read för inloggade (admin ser/ändrar egna; platform_admin allt).
create policy blog_posts_rls on public.blog_posts
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- anon storefront får LÄSA — men ENDAST publicerade inlägg. AVSIKTLIGT snävare än
-- shop_products: utkast/arkiverade inlägg får ALDRIG läcka till publiken. App-lagret
-- filtrerar dessutom på tenant_id (anon bär ingen tenant-claim; jfr 0004/0033).
create policy blog_posts_public_read on public.blog_posts
  for select to anon
  using (status = 'published');

-- Sanity (no-op): bekräfta att modulen registrerats + tabellen finns med RLS på.
do $$
declare
  v_layout jsonb;
  v_count  int;
begin
  select variant_schema -> 'layout' -> 'enum'
    into v_layout
    from public.modules where key = 'blogg';
  select count(*) into v_count
    from pg_tables
   where schemaname = 'public' and tablename = 'blog_posts';
  raise notice 'blogg-modul registrerad: layout-varianter=% · tabell blog_posts=%/1 (RLS via private.tenant_id())',
    coalesce(v_layout::text, '(saknas)'), v_count;
end $$;
