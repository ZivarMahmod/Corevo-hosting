# Modul: Blogg / Nyheter (blogg)

> Status-källa: DB-sanning (`02-Arkitektur-sanning.md`) vinner över mockup. **LIVE i DB idag** — `modules`-rad + `blog_posts`-tabell + RLS finns (migration `0034_blogg_module.sql`). Storefront-sektion, admin-CRUD och server-loader är **byggda i kod**. Default-position **`main`** — PUBLIK sektion. Gäller ALLA branscher (SEO/nyheter). Följer princip 10: EN motor, varianter via config, aldrig fork.

## 1. Kärna (universell)

En **inläggs-feed** publicerad på tenantens publika sida — nyheter, artiklar, säsongstips. EN modell (`blog_posts`) för alla branscher; presentationen styrs av en layout-variant.

- **owns_tables (LIVE):** `blog_posts` (DB-sanning §1.6 / 0034).
- **variant_schema.layout (LIVE):** enum `list` | `grid` | `featured`, default `grid`, param `posts_per_page` default 6 (0034 + DB-sanning §1.6).
- **Storefront:** publika inlägg där `status='published'` (anon-läsbar — men ENDAST publicerade; utkast/arkiverade läcker aldrig).
- **Admin:** skriv/redigera/publicera/arkivera (status-toggle); cover-bild ur `media_library`.
- **Default state:** `off` — opt-in. Super-admin flippar `off→draft` per kund (state-vakten i 0026 kräver platform_admin för den övergången). Storefront gatear på `tenant_modules.state='live'` (exakt som booking/shop/offert).
- **Ingen betal-hook** — blogg rör inga pengar (0034: "En blogg publicerar innehåll; det finns ingen rad, inget belopp"). Compliance trivialt.
- **Två ansikten (MODULE_FACES):** besökare — "läser publicerade inlägg"; admin — "skriver, redigerar och publicerar inlägg".

## 2. Universal vs variant — beslut + axlar

**Beslut: EN blogg-motor, tre presentations-varianter via `variant_schema.layout`** (0034). Skillnaden = hur inläggslistan presenteras = ren presentation (config) → VARIANT, aldrig fork. **`cfg-data.js` säger `variants: {}` men det är fel/förenklat — DB-sanningen + 0034 har den riktiga `layout`-varianten. DB vinner.** Inga bransch-specifika blogg-skillnader: blogg är samma feature för alla, branschen väljer bara default-layout + skin ger looken.

### De fyra lagren applicerade på blogg (princip 10)

| Lager | Var | Blogg-exempel |
|---|---|---|
| 1. `variant_schema.layout` (enum+params) | `modules.variant_schema` (LIVE) | `layout: list \| grid \| featured` (default `grid`); param `posts_per_page` (default 6, min 1). |
| 2. `verticals.rules` | `verticals.rules` (jsonb) | Ev. default-layout per bransch (kan välja `featured` för en magasins-känsla); inget hårt krav idag. |
| 3. `verticals.terminology` | `verticals.terminology` (jsonb) | "Blogg" / "Journal" / "Nyheter" — admin-ytan kallar den t.ex. "Journal" (surfaces-more). |
| 4. `tenant_modules.config` | `tenant_modules.config` (LIVE) | Per kund: `layout` + `posts_per_page`. Storefront läser detta för att veta hur sektionen renderas. |

### Variant-axlar (det som faktiskt skiljer) — alla = data

- **`layout`** — `list` (stapel: rubrik + ingress, renast), `grid` (kort i rutnät, default, samma rytm som shop-katalogen), `featured` (första inlägget stort + resten som lista under). Implementerat i `BloggSection.tsx` (`config.layout === 'list' | 'featured'` → annars grid; **ingen `if (bransch)`**).
- **`posts_per_page`** — paginering, default 6.
- **`status`** (per inlägg, inte variant) — `draft` / `published` / `archived`; bara `published` syns publikt.

## 3. Per bransch — tabell (gäller alla branscher)

Blogg är universell — samma feature överallt, default `off`, opt-in per kund. Tabellen visar att INGEN bransch får en egen blogg-variant i kod; skillnaden är bara vald `layout` + skin.

| Bransch | variant-val (layout) | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Frisör | `grid` (default) | Kort-rutnät, mallens tokens | Skriv tips/nyheter → publicera → syns publikt | SEO + engagemang; säsongstips driver bokning (frisör `opt: blogg`) |
| Barbershop | `grid`/`list` | Som ovan | Samma | Samma |
| Nagelstudio | `grid` | Som ovan | Samma | Nyheter/kampanjer |
| Restaurang | `grid`/`featured` | Magasins-känsla möjlig | Nyheter, event, säsongsmeny-noteringar | Event/nyheter (restaurang `opt: blogg`) |
| Café | `featured`/`grid` | Lyft senaste | Dagens-bak, nyheter | Café `opt: blogg` |
| Florist | `grid` | — | Säsong, skötselråd | Florist `opt: blogg` |
| Privatklinik | `list` | Rent, textigt | Hälsoartiklar, info | Förtroende via innehåll |
| Bilverkstad | `list`/`grid` | — | Däcktips, kampanjer | SEO |
| Cykelbutik | `grid` | — | Nyheter, service-tips | — |
| Optiker | `grid` | — | Synvård-artiklar | — |
| Tatuering | `grid`/`featured` | Visuellt | Studio-nyheter (galleri = `portfolio`) | Tatuering `opt`/ej i rec; portfolio bär bilderna |
| Fotograf | `featured` | Stora bilder | Senaste shoots, blogg | Fotograf `opt: blogg` |
| Skräddare | `list` | — | Hantverks-noteringar | — |
| Second hand | `grid` | — | Nya leveranser, fynd | Second hand `opt: blogg` |
| Städföretag | `list` | — | Städtips, info | — |
| Låssmed | `list` | — | Säkerhetstips | — |
| Generell | `grid` (default) | — | Valfritt | I `opt`-listan |

**Inga nya blogg-tabeller per bransch någonsin.** Vill en bransch ha en "magasin"-känsla = `layout=featured` + skin, inte en ny modul (princip 10).

## 4. DB-form

**Status: LIVE** (0034). Tabell `public.blog_posts`:

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid NOT NULL FK→`tenants` | on delete cascade |
| `title` | text NOT NULL | |
| `slug` | text | URL-slug |
| `excerpt` | text | ingress |
| `body` | text | markdown/plaintext |
| `cover_asset_id` | uuid FK→`media_assets` | on delete set null — cover ur media_library |
| `status` | text NOT NULL default `'draft'` | check in (`draft`,`published`,`archived`) |
| `published_at` | timestamptz | |
| `sort_order` | int NOT NULL default 0 | |
| `created_at` | timestamptz NOT NULL default now() | |
| `updated_at` | timestamptz | `trg_blog_posts_updated_at` → `set_updated_at` |

Index: `blog_posts_tenant_idx`, `blog_posts_tenant_status_idx`, `blog_posts_tenant_published_idx`.

**RLS (LIVE, publik — anon-läsbar men snävt):**
- `blog_posts_rls` (authenticated, FOR ALL): `using/with check (tenant_id = private.tenant_id() or private.is_platform_admin())` — admin ser/ändrar egna; platform_admin allt.
- `blog_posts_public_read` (anon, FOR SELECT): `using (status = 'published')` — **AVSIKTLIGT snävare än `shop_products`** (utkast/arkiverade får ALDRIG läcka). App-lagret filtrerar dessutom `tenant_id` (anon bär ingen tenant-claim). anon får INTE skriva.
- Grants: `select` till anon+authenticated; full CRUD till authenticated.

**FK:** `cover_asset_id → media_assets(id)` (cross-ref `media_library.md`).

**LIVE vs NY:** allt = **LIVE**. Modul-registrering, tabell, RLS, index, trigger finns i 0034. Inget nytt schema behövs.

## 5. Två ytor — Storefront (publik) + Admin

**Storefront (besökare):** `BloggSection.tsx` (LIVE, server component) — läser publicerade inlägg + variant via `loadBloggData` (anon-klient, `lib/storefront/blogg/load-blogg.ts`). Renderar `list` (stapel), `grid` (kort, default) eller `featured` (lead-inlägg stort + lista). `<section data-module="blogg" data-layout={config.layout}>`, eyebrow "— Blogg · {layout-label}". Token-stylad (`var(--color-*)`/`var(--font-*)`), samma approach som ShopSection/OffertSection. Tomt-läge när bloggen är på men saknar publicerade inlägg. Mockup-referens: `ModBlogg` (preview.jsx) visar 3-kolumns grid.

**Admin (ägare):** `BloggAdmin.tsx` (LIVE, client) — lista över inlägg med status-badge (publicerad=success, utkast/arkiverad=neutral), status-toggle (draft↔published via hidden input), skapa/redigera/radera, cover-bild via `ImagePicker` mot `media_assets`. Visar aktiv `layout`-variant. Mockup-referens: `Blogg`-yta i surfaces-more ("Journal / Inlägg på din sida", NB "Tändes för att du aktiverade Blogg").

## 6. Verklighets-koll (vad som lätt missas)

- **anon-read är SNÄVARE än shop med flit.** `blog_posts_public_read` släpper bara `status='published'`. Utkast/arkiverade får inte läcka. Storefront-loadern (`load-blogg.ts`) sätter dessutom `.eq('status','published')` + `.eq('tenant_id', …)` i app-lagret — RLS är defense-in-depth, app-lagret gör tenant-isoleringen (anon bär ingen tenant-claim). **Detta dubbel-skydd måste finnas i varje nytt anon-läsande modul** (samma mönster som portfolio/meny ärver).
- **Cover-bild ägs av `media_library`, inte blogg.** `cover_asset_id → media_assets`, `on delete set null` (raderas bilden blir inlägget bildlöst, kraschar inte). Samma 500 MB-kvot (cross-ref `media_library.md`).
- **`cfg-data.js variants:{}` är vilseledande** — den riktiga `layout`-varianten finns i DB/0034. Bygg/dokumentera mot DB, inte mockupen (DB-sanning grundregel).
- **Variant utan `if (bransch)`** — `BloggSection` växlar BARA på `config.layout`. Det är referens-mönstret för alla variant-moduler (portfolio/meny ska göra likadant).
- **Slug-unikhet** — `slug` saknar unique-constraint idag; om publika URL:er `/blogg/<slug>` används, säkra unikhet per tenant (öppet, §8).
- **SEO** — `published_at`, `excerpt`, cover → meta/OG-taggar; värt att koppla för det är hela syftet (SEO + engagemang).

## 7. Status idag vs bygg

**Idag (LIVE + byggt):** modul registrerad (0034), `blog_posts` + RLS + index, storefront-sektion (3 layouter), admin-CRUD (status-toggle + ImagePicker), server-loader med anon-isolering. `live:true`. **Fungerar end-to-end** för en tenant med bloggen på.

**Återstår / finslip:**
1. `slug`-unikhet + publika `/blogg/<slug>`-detaljsidor (om enskild-inlägg-vy önskas).
2. `posts_per_page`-paginering i storefront (config finns; UI-paginering verifiera).
3. SEO-meta/OG ur inlägg.
4. Ev. RSS/kategorier/taggar (om efterfrågat — annars håll enkelt).
5. Verifiera att layout-växling + tomt-läge är 0-FAIL mot acceptans (design-trohet).

## 8. Öppna beslut för Zivar

1. **Enskilda inläggssidor?** Bara feed-sektion (idag) eller `/blogg/<slug>` detaljsidor (kräver slug-unikhet + route)?
2. **Kategorier/taggar** på inlägg — bygga eller hålla blogg enkel (rubrik/ingress/body/cover)?
3. **Default-layout per bransch** via `verticals.rules` (t.ex. fotograf→`featured`) eller alltid `grid` tills kund ändrar?
4. **Rätta `cfg-data.js variants:{}`** så super-admin-UI visar layout-valet (DB har det; mockupen ljuger).
5. **RSS-flöde** — relevant för SEO/prenumeration eller överkurs nu?

## 9. Källor

- DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.6 (blogg LIVE, layout-varianter, anon-read endast published), §4.2 (anon SELECT `blog_posts` published).
- LIVE migration: `5-Kod/supabase/migrations/0034_blogg_module.sql` (modul-register, `blog_posts`, RLS, index, trigger).
- LIVE kod: `5-Kod/apps/web/components/storefront/BloggSection.tsx` (3 layouter, variant-driven), `components/admin/BloggAdmin.tsx` (CRUD + status-toggle + ImagePicker), `lib/storefront/blogg/load-blogg.ts` (anon-loader + app-lager tenant-isolering).
- Mockup/config: `super-admin/cfg-data.js` (`MODULES.blogg` — OBS `variants:{}` fel, DB vinner; `MODULE_FACES.blogg`), `super-admin/preview.jsx` (`ModBlogg`), `kund-admin/surfaces-more.jsx` (`Blogg`/"Journal"-admin).
- Princip: `10-arkitekturprincip-universal-vs-variant.md`; backlog: `09-modul-bransch-spec-backlog.md`.
- Cross-ref: `moduler/media_library.md` (cover-bild + kvot).
