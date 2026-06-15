# Multi-bransch-bygge — planindex (ingång)

> Skapad 2026-06-15. Ingång till plattformsbygget. Paraply-arkitektur: `../01-arkitektur/multibransch-plattform-arkitektur.md` (§1–15, LÅST). Denna mapp = detaljplanering per spår, fylld av planeringsflottan.

## Låsta principer (sammanfattning — full text i §1–15)
- EN motor konfigurerad; **bransch = preset/etikett, INTE lås**. Valfri modul på valfri kund.
- Moduler à la carte, livscykel per kund `off→draft→live→paused` (`tenant_modules.state`). **Bara Zivar gör off→draft.**
- **Config-first:** bransch = data; beteendeskillnader = varianter i modulen (ej `if(bransch)`).
- **Skelett (moduler+DB) vs skin (mall).** Mallen anpassar sig till skelettet. Funktioner bor i modulen, ej mallen.
- **Mall→plattform = TOKEN + SEKTIONER** (ej rå-host, ej hel React-omskrivning).
- Build-once-never-delete. RLS: tenant-scoped → `private.tenant_id()`; katalog = plattform.
- Bilder i R2; bildbibliotek = betald toggle. Licens taggas per mall *(ej juridisk rådgivning)*.

## A → Ö (lager)
Super-admin (hub) → bransch-preset → moduler (toggle + variant) → tenant → skin (mall, token+sektion) → content-slots (R2-assets) → **storefront** (renderar live-moduler + skin + content) på `<slug>.boka.corevo.se` / egen domän.

## Delade kontrakt (ALLA spår håller dessa namn så de passar ihop)
- `verticals(key, name, default_modules[], default_template, terminology jsonb, rules jsonb)`
- `modules(key, name, owns_tables[], variant_schema jsonb, default_config jsonb)`
- `tenant_modules(tenant_id, module_key, state, config jsonb)` — bär livscykel + variant + pris-hook
- `templates(key, name, tags{bransch,typ,stil,licens,scope}, tokens{color,font,layout}, sections[])`
- `content_slots`: slot per template-sektion → binder `{asset | text | modul-data}`; assets i Cloudflare R2
- RLS: tenant-scoped → `private.tenant_id()`; `verticals/modules/templates` = super-admin write, tenant read

## Spår (fan-out — planeras parallellt av flottan)
1. `01-db-grund.md` — verticals, tenants.vertical_id, modules, tenant_modules, RLS, seed, migrationsplan.
2. `02-mall-skin-system.md` — token+sektion-konvertering, sektion↔modul, katalog-schema, licens-/kategoriserings-pipeline för ~112 mallar.
3. `03-innehall-asset.md` — content-slots (auto-detect + godkänn), R2-lagring, bildbibliotek-toggle + storage-billing-hook.
4. `04-superadmin-hub.md` — live-preview + slot-redigering på kundens skarpa sida, väg mot full sidbyggare.
5. `05-onboarding-storefront.md` — en wizard bransch-först (preset-driven), storefront renderar live-moduler + skin + content.

## Hårda regler
POS (`corevo.se`) rörs ALDRIG · build-once-never-delete · `staff`/`staff_id` · Supabase prod `clylvowtowbtotrahuad` · en goal i taget → verifiera → klart · **planering ≠ kod** (inga migrationer körs i denna fas).

## Nästa
Flottan fyller spår 1–5 → syntes → **A→Ö-visualisering** → per-bransch-planering.
