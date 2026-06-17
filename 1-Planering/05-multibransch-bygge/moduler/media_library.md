# Modul: Bildbibliotek (media_library)

> Status-källa: DB-sanning (`02-Arkitektur-sanning.md`) vinner över mockup. **LIVE i DB idag** — `media_assets`-tabell (0026) + RLS (0027) + modul-registrering med kvot (0028). Admin-UI (`MediaLibrary.tsx`) + upload-actions byggda i kod. **INFRA — ingen publik sektion** (`default_section_position = null`). Matar ALLA bild-slots (hero, blogg-cover, portfolio, meny, shop, content_slots) hos ALLA branscher. Följer princip 10: EN motor, ingen variant, ingen fork.

## 1. Kärna (universell)

Tenantens **bildarkiv** — alla uppladdade bilder lagras i Cloudflare R2 och registreras som rader i `media_assets`. Allt bildval någon annanstans i systemet (sajtbyggarens hero/sektioner, blogg-cover, portfolio, meny, shop-produkt) pekar hit. **Det är infrastruktur, inte en sektion på sajten.**

- **owns_tables (LIVE):** `media_assets` (DB-sanning §1.7 / 0026).
- **default_section_position:** `null` → **ingen sektion på sajten** (DB-sanning §1.7: "det är infrastruktur"). `infra: true` i cfg-data.
- **Kvot (LIVE):** `quota_bytes = 524288000` (**500 MB/tenant**), billing-hook `media_library.storage_gb` (DB-sanning §1.7 / 0028: `{"included_bytes":524288000,"quota_bytes":524288000,"billing":{"metric":"stored_gb","unit_price_hook":"media_library.storage_gb"}}`).
- **Lagring:** Cloudflare R2 (bucket `corevo-media`); rad i `media_assets` `{tenant_id, r2_key, url, type, size_bytes, width, height, content_hash, …}` (cfg-data `build` + 0026).
- **Roll i flödet:** text-slot → `content_slots.text_value`; bild-slot → fil till R2 → `media_assets`-rad → `content_slots.asset_id → media_assets.url` (DB-sanning §5). Detta är kopplingen som gör "klicka ruta i preview → ladda upp bild" möjlig.
- **variant_schema:** `{}` (ingen variant — infra är samma för alla; cfg-data `variants:{}`).
- **Två ansikten (MODULE_FACES):** besökare — "(ingen publik yta — infrastruktur)"; admin — "laddar upp och hanterar bildarkivet (500 MB kvot)".

## 2. Universal vs variant — beslut + axlar

**Beslut: EN media-modul, INGEN variant, INGEN bransch-skillnad.** Infrastruktur är per definition universell — en frisörs bild och en restaurangs bild lagras identiskt. Det enda som kan skilja är **kvot-storlek** (config/plan), inte beteende. Aldrig en bransch-fork (princip 10). `media_library` är "uttaget" som alla andra moduler pluggar in i.

### De fyra lagren applicerade på media_library (princip 10)

| Lager | Var | Media-exempel |
|---|---|---|
| 1. `variant_schema` | `modules.variant_schema` (LIVE) | `{}` — ingen variant. |
| 2. `verticals.rules` | `verticals.rules` | Inget — branschen påverkar inte lagring. |
| 3. `verticals.terminology` | `verticals.terminology` | "Bildbibliotek"/"Media"/"Bildarkiv" — bara ord. |
| 4. `tenant_modules.config` | `tenant_modules.config` (LIVE) | `quota_bytes` (default 500 MB) — kan höjas per plan/kund. Billing-hook `media_library.storage_gb`. Det är den ENDA per-tenant-axeln. |

### "Axlar" (egentligen config, inte varianter)

- **`quota_bytes`** — lagringstak per tenant (default 524288000 = 500 MB). Höjs per plan. Mätning: summa `media_assets.size_bytes` per tenant (0026: "speglas vid upload → kvot-mätning").
- **`billing.metric = stored_gb`**, hook `media_library.storage_gb` — överförbrukning fakturerbar (framtida billing).
- **Optimering** (format/storlek) — drift-val (Cloudflare Images/sharp), inte en bransch-variant. Se §6.

## 3. Per bransch — tabell (gäller alla branscher)

`media_library` är alltid tillgänglig som infra för ALLA branscher (alltid på, ingen publik yta). Skillnaden mellan branscher = bara HUR MYCKET bild de använder, inte modulens beteende.

| Bransch | variant-val | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Alla (frisör, barber, nagel, restaurang, café, florist, klinik, bilverkstad, cykel, hundsalong, optiker, tatuering, fotograf, skräddare, second hand, städ, låssmed, generell) | Ingen (infra) | Ingen publik sektion; admin-yta "Bildbibliotek" identisk överallt | Ladda upp → R2 → `media_assets`; matar hero/blogg/portfolio/meny/shop/content_slots | Varje sajt behöver bilder; centralt arkiv → en uppladdning återanvänds i flera slots; kvot skyddar kostnad |
| Bild-tunga (fotograf, tatuering, restaurang, second hand) | Ingen (men ev. högre `quota_bytes` via plan) | Samma UI | Samma | Fler/större bilder → kan slå i 500 MB → höj kvot via plan-config, inte via kod |

**Ingen bransch får en egen media-modul.** Behöver fotografen mer plats = högre `quota_bytes` (config), inte en fork (princip 10).

## 4. DB-form

**Status: LIVE** (0026 tabell, 0027 RLS, 0028 modul-register).

Tabell `public.media_assets` (minimal kanonisk, 0026; additivt utökad):

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL FK→`tenants` | (index `media_assets_tenant_id_idx`) |
| `r2_key` | text NOT NULL | nyckel i R2-bucketen (content-addressed) |
| `url` | text | publik/resolverad URL |
| `type` | text | t.ex. `image` |
| `size_bytes` | bigint NOT NULL default 0 | speglas vid upload → kvot-mätning |
| `width` | int | (additiv 0026) |
| `height` | int | (additiv 0026) |
| `content_hash` | text | dedupe/cache (additiv 0026) |
| `source` | text | ursprung (additiv 0026) |
| `library_item_id` | uuid | (additiv 0026) |
| `created_at`/`updated_at` | timestamptz | |

Refereras av: `content_slots.asset_id`, `blog_posts.cover_asset_id`, `shop_products.image_asset_id`, (NY) `portfolio_items.asset_id`, `menu_items.image_asset_id` — alla `on delete set null`.

**RLS (LIVE, 0027):**
- `media_assets_rls` (authenticated): tenant-scoped via `private.tenant_id()` + `is_platform_admin()`-bypass.
- `media_assets_public_read` (anon, FOR SELECT): anon storefront läser media-URL:er (publik white-label-sida) — bilderna måste vara läsbara för att sajten ska rendera. (Filen i R2 är publik via URL; raden anon-läsbar.)
- Grants: select till anon+authenticated; skriv till authenticated (admin).

**Modul-registrering (LIVE, 0028):** `modules`-rad `media_library`, `owns_tables=['media_assets']`, `default_config` med `included_bytes/quota_bytes=524288000` + billing-hook, `default_section_position = null`.

**LIVE vs NY:** allt = **LIVE**. Tabell, RLS, modul-register, kvot-config finns. Det som ligger UTANFÖR DB (och är delvis byggt/återstår): signed-upload mot R2, auto-optimering, hård kvot-enforcement (se §7).

## 5. Två ytor — (ingen storefront) + Admin

**Storefront:** **ingen publik sektion** (`default_section_position=null`, MODULE_FACES "ingen publik yta — infrastruktur"). Bilderna *syns* förstås publikt — men via ANDRA modulers slots (hero, blogg, portfolio…), aldrig som en egen "bildbibliotek-sektion".

**Admin (ägare):** `MediaLibrary.tsx` (LIVE, client) — upload-knapp (`uploadMediaAssets` → R2), kvot-mätare ("X av 500 MB använt", `formatBytes`/`usagePercent`), bild-grid (`repeat(auto-fill, minmax(150px,1fr))`), redigera alt-text (`updateMediaAlt`), radera (`deleteMediaAsset`), upload-drawer med flerfilsval (`MEDIA_ACCEPT`). Detta är även "bildväljaren" andra moduler öppnar (`ImagePicker` i BloggAdmin pekar mot `media_assets`). Källa: `lib/admin/media/actions`, `lib/admin/media/types` (`StorageUsage`, `usagePercent`). Mockup-koppling: Varumärke-ytan (surfaces-core) väljer hero/profilbild — den kopplingen landar i `media_assets` + `content_slots` (DB-sanning §5).

## 6. Verklighets-koll (bild-kvot + optimering — lätt att missa)

- **500 MB/tenant ryms lätt i R2:s ekonomi.** R2 standard: **$0,015/GB-månad lagring** och **fri egress (data transfer ut)** — fri-nivån är 10 GB-månad lagring + 1M Class A + 10M Class B-operationer/månad (källa §9). 500 MB = 0,5 GB → en tenant ligger under fri-nivån; 1000 tenanter ≈ 500 GB ≈ ~$7,50/månad lagring + operationer. **Egress är gratis** vilket är hela poängen med R2 för en bildtung white-label-sajt (inga bandbreddskostnader när besökare laddar bilder).
- **Kvoten måste enforcas vid upload, inte bara visas.** Summera `size_bytes` per tenant och blockera/varna före R2-put när `quota_bytes` skulle överskridas (0026: size speglas för mätning). Annars är 500 MB bara en siffra i UI:t.
- **Bilder MÅSTE optimeras** annars sprängs kvoten och laddtiden blir dålig. Cloudflare Images-transformationer: `format=auto` serverar AVIF/WebP automatiskt efter webbläsarstöd; `width`/`fit`/`quality` ger responsiva storlekar; `format=auto` är default för hostade bilder (källa §9). Alternativ: `sharp` vid upload (cfg-data `build` nämner "sharp/Cloudflare Images"). Lagra helst en optimerad master + generera storlekar on-the-fly.
- **`content_hash` möjliggör dedupe** — samma bild uppladdad två gånger behöver inte ta dubbel plats; använd hashen.
- **`on delete set null` överallt** — raderas en bild blir slots/cover/portfolio bildlösa men kraschar inte. Bygg UI som varnar "bilden används i X" före radering.
- **alt-text för tillgänglighet + SEO** — finns på `media_assets`; admin redigerar (`updateMediaAlt`).
- **R2-filen är publik via URL** men raden RLS-skyddad för skrivning — anon kan läsa URL (måste, för rendering), inte ändra arkivet.
- **Det som INTE finns i DB och behöver edge/worker** (DB-sanning §5/§8): signed-upload-endpoint mot R2 + auto-optimering. Allt DB-stöd (tabell, RLS, kvot) finns redan.

## 7. Status idag vs bygg

**Idag (LIVE + byggt):** `media_assets` + RLS + modul-register + kvot-config (0026/0027/0028). Admin-UI `MediaLibrary.tsx` (upload/kvot-mätare/grid/alt/radera) + `ImagePicker` som andra moduler använder + upload-actions. `live:true`, `infra:true`.

**Återstår / finslip:**
1. **Signed-upload mot R2** (edge/worker) — säker direktuppladdning (DB-sanning §5 "(a) signed-upload-endpoint mot R2").
2. **Auto-optimering** — sharp vid upload eller Cloudflare Images-transform (format=auto/width/quality) för responsiva, små bilder.
3. **Hård kvot-enforcement** vid upload (summa `size_bytes` vs `quota_bytes`) — inte bara visning.
4. **Dedupe via `content_hash`**.
5. **"Används i"-varning** före radering (skydda slots/cover som pekar på bilden).
6. **content_slots-skrivning** för bild-slots i preview (DB-sanning §5 "(b) UPSERT-logik mot content_slots") — kopplar sajtbyggarens "klicka ruta → ladda bild" mot arkivet.

## 8. Öppna beslut för Zivar

1. **Optimerings-väg:** Cloudflare Images (transform via URL, fri-tier-villkor) vs `sharp` vid upload vs båda? Påverkar kostnad + komplexitet.
2. **Kvot-enforcement-policy:** hård block vid 500 MB, eller mjuk (varna + tillåt + fakturera överförbrukning via `storage_gb`-hook)? Billing-hooken antyder överförbruknings-modell.
3. **Plan-baserad kvot:** ska `quota_bytes` höjas automatiskt per plan (standard/pro) eller manuellt per kund? (Bild-tunga branscher slår i taket först.)
4. **R2-upload:** signed URL (klient→R2 direkt) vs proxy via Worker (mer kontroll, kan optimera on-ingest)?
5. **Variant-storlekar:** spara flera storlekar vid upload (thumb/medium/full) eller generera on-the-fly via Cloudflare Images? On-the-fly sparar lagring (bra för kvot).
6. **Dedupe på/av** via `content_hash` (sparar kvot men delad bild mellan slots kräver "används i"-koll vid radering).

## 9. Källor

- DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.7 (media_library INFRA, `default_section_position=null`, kvot 500 MB, R2, billing-hook), §5 (text/bild-slot-flöde → content_slots/media_assets, signed-upload + content_slots-UPSERT återstår), §8 (R2-upload utanför DB).
- LIVE migrations: `5-Kod/supabase/migrations/0026_multibranch_core.sql` (`media_assets`-tabell + kolumner + index), `0027_multibranch_rls.sql` (RLS tenant-scoped + anon-read), `0028_multibranch_seed_backfill.sql` (modul-register + `quota_bytes=524288000` + billing `media_library.storage_gb`).
- LIVE kod: `5-Kod/apps/web/components/admin/MediaLibrary.tsx` (upload/kvot-mätare/grid/alt/radera), `lib/admin/media/actions` (`uploadMediaAssets`/`deleteMediaAsset`/`updateMediaAlt`), `lib/admin/media/types` (`StorageUsage`/`usagePercent`/`formatBytes`); `components/admin/BloggAdmin.tsx` (`ImagePicker` mot media_assets).
- Mockup/config: `super-admin/cfg-data.js` (`MODULES.media_library` `infra:true`/`defaultPos:null`, `MODULE_FACES.media_library`), `kund-admin/surfaces-core.jsx` (`Varumarke` använder media_assets för hero/profilbild).
- Verklighet (R2-ekonomi): Cloudflare R2 pricing — $0,015/GB-mån standard, fri egress, fri-nivå 10 GB-mån (developers.cloudflare.com/r2/pricing).
- Verklighet (bild-optimering): Cloudflare Images transform — `format=auto` (AVIF/WebP), `width`/`fit`/`quality` (developers.cloudflare.com/images/transform-images, .../transform-via-url).
- Princip: `10-arkitekturprincip-universal-vs-variant.md`; backlog: `09-modul-bransch-spec-backlog.md`.
- Cross-ref: matar `moduler/blogg.md` (cover), `moduler/portfolio.md` (galleri), `moduler/meny.md` (rätt-bild).
