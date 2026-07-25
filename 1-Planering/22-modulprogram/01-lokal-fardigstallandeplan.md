# Lokal färdigställandeplan — Corevo Scope A

## Beslut

Corevo färdigställs som en generell flerbranschplattform på den samlade
branchen `codex/launch-inventory-customer-design`. Scope A omfattar svensk
pilot, dagens nio DB-seedade moduler och de gemensamma plattformsytorna.

Fordon, husdjur, inlämning, meny och andra roadmapmoduler byggs inte i detta
program. Deras framtida seam är redan `modules.variant_schema` och
`tenant_modules.config`; spekulativ kod behövs inte.

Produktion och Cloudflare lämnas orörda tills den lokala releasekandidaten är
grön och Zivar har gjort sin enda samlade acceptans.

## Lednings- och kvalitetsmodell

Varje byggpaket följer samma grind:

1. En byggare arbetar testdrivet i ett avgränsat filområde.
2. En oberoende granskare kontrollerar krav, säkerhet och regressioner.
3. En UX-/produktgranskare kontrollerar tomma lägen, fel, mobil och begriplighet
   när paketet ändrar en användaryta.
4. Huvudagenten integrerar endast när riktade tester är gröna.
5. Full test, typecheck, lint och build körs före lokal låsning.

Granskare får stoppa ett paket men får inte utöka scope med nya ramverk,
tabeller eller framtidsfunktioner. Befintliga primitives återanvänds.

## En modul har fyra ytor

| Yta | Ansvar |
|---|---|
| Superadmin | Aktivering, kommersiellt val, mall och livscykel |
| Kundadmin | Modulens verkliga konfiguration, data och dagliga arbete |
| Sidredigerare | Presentation, synlighet och länkning; aldrig affärslogik |
| Storefront | Samma publika loaders och actions som preview, fail-closed |

Modulens kod äger beteende, data och actions. Mallen äger endast placering och
utseende. Mallbyte får aldrig skriva över bokningar, produkter, artiklar,
presentkort, lojalitetsdata eller annan verksamhetsdata.

## Livscykelkontrakt

| State | Kundadmin | Publikt | Nya publika actions |
|---|---|---|---|
| `off` | Dold | Dold | Nekade |
| `draft` | Konfigurerbar | Dold | Nekade |
| `live` | Aktiv | Synlig | Tillåtna när readiness är grön |
| `paused` | Läsbar | Befintligt innehåll kan visas med pausläge | Nekade |

Superadmin äger `off → draft`. Behörig kundadmin äger `draft/live/paused`
inom modulens befintliga regler. Alla övergångar måste skyddas server-side och
i DB; UI är aldrig säkerhetsgrinden.

## Kanoniska tekniska beslut

- DB och en liten ren resolver är kanon för modulstate. Separata Supabase-klienter
  behålls eftersom deras RLS-kontexter skiljer sig.
- `modules.default_config` används när en modul aktiveras första gången.
- Publika loaders och mutationer kontrollerar modulstate och readiness.
- Superadmin och kundadmin ska använda SidaStudioV2 och `site_revisions`; den
  äldre direkt-skrivande SidaStudio-vägen pensioneras först efter paritetstest.
- Storefront och preview använder samma sections/loaders. Ingen separat
  previewmotor.
- V1 använder mallägda fasta slots. Ingen fri drag-and-drop-builder byggs.
- En liten React-fri metadatafil får beskriva modulens adminroute, publika route
  och tillåtna slots. Ingen generell pluginmotor eller JSON-schema-builder.
- Mallbyte bevarar nuvarande publicerat innehåll som standard. Valet att använda
  mallens exempelcopy är explicit. Verksamhetsdata påverkas aldrig.
- Nya `security definer`-funktioner ska ha tom `search_path`, schema-kvalificerade
  relationer och explicita revoke/grant.

## Dagens verkliga moduler

| Modul | Programbeslut |
|---|---|
| `booking` | Behåll motorn; lås onboarding, readiness och full produktkedja i Goal 84 |
| `media_library` | Gör kvot serverägd och verkställd, inte endast visad |
| `shop` | Lås capability/readiness och neka varje commerce-action när rail saknas |
| `offert` | Behåll dagens intake/offertflöde; lova inte automatisk prisberäkning |
| `blogg` | Lås kundadmin, preview och storefrontkontrakt |
| `lojalitet` | Bygg riktig inlösen; gate:a betalda nivåer bakom betalningscapability |
| `presentkort` | Gör inlösen atomisk och ge plattformen nödvändig arbetsyta |
| `kurser` | Lås befintligt flöde och lägg atomiskt runtimebevis |
| `galleri` | Lägg riktig kundadminroute och ta bort död `/admin/moduler`-väg |

## Exekveringsordning före Zivars test

### Goal 84 — komplett onboarding till första bokning

Stänger en sammanhängande riktig kedja från kundskapande till verifierad
bokning och avbokning mot Supabase-preview. Detaljer finns i den aktiva
goal-filen.

### Goal 87 — modulstate, readiness och DB-säkerhet

- använd `default_config` vid första aktivering;
- stärk DB-vakten för förbjudna stateövergångar;
- module-state-gate:a publika policies/loaders/actions;
- gör readiness modulmedveten;
- uppdatera genererade DB-typer och kontrakt;
- rätta katalogdrift som `loyalty`/`lojalitet` och saknade seedrader.

### Goal 88 — en kundarbetsyta och en sidmotor

- låt superadmin och kundadmin använda SidaStudioV2/revisioner;
- behåll superadminens smala mall- och aktiveringsansvar;
- gör respektive moduls kundadminingång nåbar;
- ta bort den äldre skrivvägen först när paritet och migrationstest är gröna.

### Goal 89 — storefront, preview och mallslots

- en gemensam React-fri module-surface-katalog;
- samma loaders/sections för preview och publikt;
- fasta mallslots med säker fallback när en mall saknar specialvy;
- kompatibilitetsdiff före publicering;
- mallbyte bevarar verkligt innehåll och all verksamhetsdata.

### Goal 90 — innehållsmoduler

Lås `blogg`, `kurser` och `galleri` end-to-end inklusive kundadmin, preview,
storefront, mobil/tomt/fel/paused och nödvändiga atomiska runtimeprov.

### Goal 91 — presentkort och lojalitet

Lås atomisk presentkortsinlösen, lojalitetsinlösen, audit och capability-grindar.
Ingen betald nivå får marknadsföras som fungerande utan en fungerande
betalningsrail.

### Goal 92 — media, offert och webshop

Verkställ mediakvot server-side, lås offertens verkliga intakeflöde och gör
webshopens capability/readiness/action-grindar konsekventa. Återanvänd den
befintliga betalnings- och refundinfrastrukturen.

### Goal 93 — katalog och mekanisk mallacceptans

Synka vertikaler, modulnycklar och de tolv Corevo-mallarna med DB. Varje
designpaket måste nå mekaniskt noll fel med sitt acceptanstest och probe;
ögonmått räcker inte.

### Goal 85 — fail-closed lokal releaseövning

Kör migration-, grants/RLS-, host-, scheduler-, rollback-, CI- och
deploykontrakt utan produktionsdeploy.

### Goal 86 — Zivars enda samlade localhostacceptans

Zivar testar den lokala releasekandidaten en gång. Fel blir en avgränsad fix
med regressionstest; inget nytt sidoprojekt öppnas under acceptansen.

## Stoppregler

- Ett goal måste vara lokalt låst innan nästa börjar.
- En röd säkerhets-, dataförlust-, betalnings- eller migrationskontroll stoppar
  ordningen.
- Tillfälliga testgenvägar får inte gå runt produktens skrivvägar.
- Direkt DB-läsning får användas som efterbevis; direkt DB-skrivning får endast
  användas för ett uttalat negativt guardrailprov.
- Extern previewdeploy används först när ett krav faktiskt kräver extern host,
  callback eller mobil åtkomst. Localhost startas just-in-time för browsertest.
