# Kundbild per bransch — design för superbooking

> Mål: EN yta där Zivar ser och styr bransch-gemensamma inställningar (moduler, terminologi, modul-parametrar, default-tjänster, mallar) som gäller ALLA kunder i branschen — med tydligt arv ner till tenant-nivån.
> Datum: 2026-07-11 · Kodbas: `5-Kod/apps/web`

## 1. Vad som redan finns (kartläggning)

### 1.1 `verticals`-tabellen — bransch-raden finns redan och är rätt hem
`supabase/migrations/0026_multibranch_core.sql:57-66`:

| Kolumn | Innehåll idag |
|---|---|
| `key` (PK) | `frisör`, `barbershop`, `nagelstudio`, `restaurang`, `generell` (seed 0028 + 0030) |
| `name` | visningsnamn |
| `default_modules` jsonb | `{"booking":"live","loyalty":"draft","shop":"off"}` — preset-states |
| `default_template` | mjuk koppling → `templates.key` (zigge/linnea/leander/edit/salvia) |
| `terminology` jsonb | etikett-överlägg `{staff, service, unit, *_plural}` |
| `rules` jsonb | **tom `{}` överallt** — reserverad för bransch-regler/varianthints, aldrig konsumerad |

Alltså: tabellen ÄR redan "vertical_settings" — den saknar bara fält, skriv-UI och konsumtion av `rules`.

### 1.2 `tenant_modules` — per-kund modul-livscykel
`0026_multibranch_core.sql:140-153`: `(tenant_id, module_key, state off|draft|live|paused, config jsonb)`, unik per tenant+modul, state-vakt (off→draft endast super-admin, trigger rad 203-235). `modules`-katalogen (rad 70-79) bär `variant_schema`, `default_config`, `default_section_position` — dvs. modul-parametrar har redan ett schema-hem på katalognivå och ett värde-hem per tenant (`tenant_modules.config`). **Det som saknas är MELLANLAGRET: bransch-nivåns modul-config.**

### 1.3 `verticals-shared.ts` — terminologi-motorn
`lib/platform/verticals-shared.ts`:
- `resolveTerm` (rad 103-112): precedens **vertical-override → call-site-fallback → generisk default → key**. `termPlural` (rad 122-130) via explicit `<key>_plural`.
- `modulesForVertical` (rad 45-55): katalogmoduler annoterade med bransch-preset-state, booking golvas till `live`.
- Typerna `VerticalPreset`/`VerticalPresetData` (rad 16-37) är exakt den DTO en bransch-kundbild behöver — återanvänd.

### 1.4 Hur arvet fungerar IDAG — två olika mönster
1. **Terminologi = LIVE-ARV.** `lib/admin/tenant.ts:56-63` läser `verticals.terminology` vid VARJE admin-render via `tenants.vertical_id`. Ändrar Zivar branschens terminologi slår det direkt på alla kunder i branschen. Ingen tenant-override finns (tenanten kan bara byta bransch).
2. **Moduler = KOPIA-VID-ONBOARDING.** `lib/platform/actions/tenants.ts:123-128, 245-251` (`writeTenantVerticalAndModules`): wizardens val (prefyllt från `default_modules`) skrivs som `tenant_modules`-rader. Ändras branschens preset efteråt påverkas BARA nya kunder — befintliga behåller sin snapshot. Det är rätt (state-maskinen är per kund) men saknar en "applicera på befintliga"-handling.

### 1.5 Onboarding-presets
- `lib/platform/verticals.ts:66-104` `loadVerticalPresets()`: läser verticals + modules + aktiva templates grupperade på `tags.bransch` → wizardens steg "Välj bransch" / "Moduler" / "Temamall" (`app/(platform)/salonger/ny/page.tsx:4,18`).
- Onboarding-studion konsumerar samma data (`lib/platform/onboarding-studio/phases.ts:13`).
- **Default-tjänster finns INTE** — grep på `default_services`/seed-tjänster ger noll träffar; varje ny kund startar med tom tjänstelista.

### 1.6 Templates
`0026:82-92`: `templates.tags.bransch` = vertical-nyckel; 21 vendor-rader (import 0041, purge 0045/0047) men bara `STOREFRONT_THEMES` i `lib/tenant-data.ts` (salvia/leander/zigge/linnea/edit/freshcut) renderas. Taggningen finns alltså men ingen yta att SE/ÄNDRA vilka mallar en bransch exponerar.

### 1.7 `/salonger`-listan + nav + en bugg
- Sidebar: `components/portal/PortalSidebar.tsx:51-52` — "Kunder" → `/salonger`, "Onboarda kund" → `/salonger/ny`. Listan (`components/platform/SalongerClient.tsx`) visar/grupperar INTE bransch idag — trots IA-planen "kunder sorterade per bransch" (memory: corevo-ia-kunder-konsolidering).
- ⚠️ **Diskrepans:** kundkortet `app/(platform)/salonger/[id]/page.tsx:134-136,236` läser bransch ur `settings.vertical` (tenant_settings-jsonb), INTE ur `tenants.vertical_id` som är sanningskällan (0026:155-168) och det admin-terminologin styrs av. Kundbilds-arbetet ska normalisera detta till `vertical_id`.

## 2. Föreslagen datamodell

**Princip: `verticals` ÄR bransch-inställningstabellen — ingen ny `vertical_settings`.** En 1:1-sidotabell köper inget (ingen versionering krävs nu, RLS-yta dubbleras). Lägg kolumner + fyll den redan reserverade `rules`:

```sql
-- 00XX_vertical_kundbild.sql
alter table public.verticals
  add column if not exists default_services jsonb not null default '[]'::jsonb,
  -- [{ name, duration_min, price_sek, category? }] — SEED-mall, kopieras vid onboarding
  add column if not exists module_params jsonb not null default '{}'::jsonb;
  -- { "<module_key>": { ...params } } — bransch-nivåns modul-config (live-arv, se §4)
```

- `default_modules`, `default_template`, `terminology` — finns redan, får bara skriv-UI.
- `rules` lämnas för framtida bransch-regler (avbokningsfönster etc.) — konflatera inte med `module_params`.
- Mallar per bransch styrs där de redan bor: `templates.tags.bransch` (ingen ny join-tabell; UI:t patchar tags-jsonb).
- Tenant-override av terminologi: **ingen ny kolumn** — läggs i `tenant_settings.settings.terminology` (jsonb finns redan) och vävs in i resolven (§4).
- RLS: verticals har redan SELECT-open till authenticated (`0027`); write-policy för platform_admin behöver verifieras/adderas i samma migration.

## 3. UI-placering

**Ny huvudflik "Branscher" i platform-sidebaren** (`PortalSidebar.tsx` role="platform", mellan "Kunder" och "Integrationer"):

- `/branscher` — listvy: en rad per vertical med kund-antal, modul-preset-chips, default-mall, terminologi-sammanfattning.
- `/branscher/[key]` — **kundbilden**, samma kompakta `<details>`-mönster som kundkortet (memory: corevo-kundkort-buildout):
  1. **Terminologi** — nyckel/värde-editor (staff/service/unit + `*_plural`), live-arv-varning: "gäller direkt för N kunder".
  2. **Moduler** — preset-state per katalogmodul (återanvänd `modulesForVertical`); knapp "Applicera på befintliga kunder" (bulk-upsert `tenant_modules`, respekterar state-vakten — höjer aldrig off→draft utan super-admin-context, vilket detta är).
  3. **Modul-parametrar** — formulär genererat från `modules.variant_schema`, värden → `verticals.module_params[module_key]`.
  4. **Default-tjänster** — redigerbar lista → `verticals.default_services`; seedas till `services` vid onboarding (steg i `writeTenantVerticalAndModules`-flödet, `lib/platform/actions/tenants.ts:245`).
  5. **Mallar** — templates där `tags.bransch = key` + defaultmall-väljare; freshcut-temat FREDAT (visas aldrig som valbar bransch-mall).
  6. **Kunder i branschen** — tenants med `vertical_id = key`, länkar till `/salonger/[id]`.

Alternativet "under Kunder" förkastas: bransch-inställningar är katalog-nivå (plattform-ägda), inte kund-nivå — och Zivars IA-vision vill tvärtom att /salonger-listan GRUPPERAS per bransch och länkar UPP till `/branscher/[key]`-rubriken.

## 4. Arv & override — tre lager, tre mönster

| Inställning | Bransch-ändring träffar befintliga kunder? | Resolve |
|---|---|---|
| Terminologi | **JA, live** (dagens beteende, `lib/admin/tenant.ts:56-63`) | `tenant_settings.settings.terminology` → `verticals.terminology` → `TERMINOLOGY_DEFAULTS` — utöka `resolveTerm`-kedjan med tenant-lagret överst |
| Modul-parametrar | **JA, live** — läses vid render: `tenant_modules.config[param]` ?? `verticals.module_params[module_key][param]` ?? `modules.default_config[param]` | tenant sätter bara det den avviker på; tomt `config` = följer branschen automatiskt |
| Modul-STATE | **NEJ** — kopia vid onboarding (state-maskin per kund, `0026:140`) + explicit bulk-knapp "applicera nu" | tenant_modules är sanningen; preset är bara prefill |
| Default-tjänster | **NEJ** — ren seed vid onboarding, aldrig retroaktiv (kunder äger sina tjänster) | — |
| Default-mall | **NEJ** — prefill i wizard/studio | — |

Regeln i klartext: **etiketter & parametrar ärvs live (tomt = följ branschen); entiteter (moduler-states, tjänster) kopieras och ägs sedan av kunden.** Det matchar exakt de två mönster koden redan etablerat.

## 5. Rekommenderad byggordning
1. **Fix + synlighet (ingen migration):** normalisera kundkortets bransch-läsning till `tenants.vertical_id` (`app/(platform)/salonger/[id]/page.tsx:134`), visa bransch-badge + gruppering i `/salonger`-listan (`SalongerClient.tsx`).
2. **`/branscher` + `/branscher/[key]` read-only:** ny sidebar-post, återanvänd `loadVerticalPresets`-mönstret; visa allt i §3 utan skriv.
3. **Skriv-UI för befintliga fält:** terminologi, `default_modules`, `default_template` → server actions mot `verticals` (verifiera/addera platform_admin-write-RLS).
4. **Migration `default_services` + `module_params`** + seed-steg i onboarding (`lib/platform/actions/tenants.ts` efter rad 251) + default-tjänst-editor i kundbilden.
5. **3-lagers resolve:** tenant-terminologi-override i `tenant_settings.settings.terminology` + utökad `resolveTerm`; modul-param-resolven i modulernas render-vägar.
6. **Bulk-apply moduler** ("applicera preset på N befintliga kunder") med dry-run-diff innan skriv.
7. **Mall-taggnings-UI** (`templates.tags.bransch`-patch) — sist; lågt värde tills fler renderbara teman finns än STOREFRONT_THEMES.
