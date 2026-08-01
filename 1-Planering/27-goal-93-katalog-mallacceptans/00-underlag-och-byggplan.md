# Goal 93 — katalog och mekanisk mallacceptans

Datum: 2026-07-29
Status: komplett byggunderlag, köat direkt efter låst Goal 92

## Forskningsslutsats

Goal 93 ska skapa ett litet versionerat katalogkontrakt och en mekanisk
validator. Det ska inte skapa en pluginmotor eller DB-lagrad React.

### Referenser

- [Backstage catalog](https://backstage.io/docs/features/software-catalog/descriptor-format/):
  version, kind, ägare, livscykel och schemavalidering.
- [Gutenberg block metadata](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/):
  manifest nära implementation, capabilities och explicita deprecations.
- [Storybook testing](https://storybook.js.org/docs/writing-tests): exekverbara
  fixtures, interaktion, visual och a11y. Mönstret återanvänds med befintlig
  Playwright; Storybook installeras inte.
- [Odoo](https://github.com/odoo/odoo): deklarerade addonberoenden och
  webbtemaaktivering. Pluginramverket kopieras inte.

Graphify-jämförelsen visar att Corevo redan har `catalog.ts`,
`verticals-shared.ts`, `tenant-modules.ts`, florist-/salongregister,
capabilitytyper och Goal 84-probe. Problemet är flera parallella sanningslistor,
inte frånvaro av katalogkod.

## Belagda gap

- Designmanifest, tema-/layoutregister, `COREVO_12_THEME_KEYS`, onboardinglistor
  och DB kan divergera.
- DB-migrationshistoriken saknar en full projektion av exakt Corevo 12.
- JSONB-kopplingar för default modules, templates och slots är svagt validerade.
- DB-skinvägen är parkerad och ska inte göras till generell renderer.
- Deprecation saknar `replacementKey`, valbarhet och fixturemigrering.
- Acceptansen är fragmenterad och bevisar inte alla tolv paket mekaniskt med
  visual/a11y/probe.

## Arkitekturbeslut

### Kodägd katalog

En katalogpost innehåller:

- `schemaVersion`, stabil `key`, `owner`;
- `status: active | deprecated | archived`;
- `replacementKey` när deprecated;
- verticals, capabilities och required modules;
- pages/module views och redigerbara slotfält;
- designmanifest/fixture;
- `selectable`.

`COREVO_12_THEME_KEYS` och onboardingval härleds från valbara katalogposter.

### DB som projektion

En append-only migration projekterar kända mallar, slots, moduler och
vertikalpresets. DB får välja och lagra kända nycklar men aldrig leverera
körbar kod eller aktivera en okänd/inkompatibel nyckel.

### En validator

Validatorn kräver:

- exakt mängdlikhet mellan designpaketets 12 nyvalbara nycklar, valbar
  kodkatalog och aktiva valbara DB-rader; legacy/deprecated räknas separat;
- giltiga vertical defaults, modules, slots, routes och capabilities;
- stödd manifestversion och inga orphan-/dubblettreferenser;
- att deklarerade editorfält faktiskt konsumeras;
- att deprecated är renderbar men inte valbar och har replacement.

### Acceptansmatris

Matrisen genereras från katalogen: varje mall × deklarerad route × 1360/390.
Modulens state-FSM bevisas centralt; varje mall bevisar bara sina slots och
specialvyer. Baselines kommer från designfacit och godkänns aldrig automatiskt.

## Genomförandeplan

### Task 1 — sammanför kodregistren

Utöka befintligt temakontrakt och härled nuvarande listor. Ingen ny dependency.
Lägg kontraktstester som misslyckas vid dubblett, okänd referens eller drift
mellan florist och salong.

### Task 2 — DB-projektion

Append-only migration för exakt 12 mallar, modulnycklar, vertikaler,
kontraktsversion och valbar/deprecated-status. Lägg constraints eller
valideringsfunktioner där JSONB/FK inte räcker.

### Task 3 — katalogvalidator och fixtures

Återanvänd befintliga Vitest-/Node-skript och Goal 84-probe. En genererad
fixturematris ersätter handskrivna parallella listor.

### Task 4 — mekanisk browseracceptans

Varje designpaket får sitt kanoniska `accept.spec.ts` och `probe.js` enligt
projektregeln. Kör strukturell, beteende-, pixel- och a11y-grind med 0 oväntat
skippade fall.

## Exakta implementation units

| Enhet | Befintlig fil | Nytt bevis |
|---|---|---|
| kodkatalog | `apps/web/lib/platform/catalog.ts`, `theme-palettes.ts`, florist-/salongregistren | `apps/web/lib/platform/catalog.contract.test.ts` |
| onboarding | `apps/web/components/platform/CreateTenantForm.tsx` och wizardkonsumenter | registerparitetstest |
| DB-projektion | `verticals`, `modules`, `templates`, `template_slots` | `supabase/tests/goal93_catalog_projection.sql` |
| manifestvalidator | designpaketets manifest och befintligt Goal 84-script | `apps/web/scripts/goal93-catalog-acceptance.mjs` |
| browser | befintliga preview/storefront-routes | per-paket `*.accept.spec.ts` och `probe.js` |

Verifiering från `5-Kod`: katalogvalidatorn, projektets SQL-testkommando,
`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` och hela
Goal 93-probet.

## Medvetet utanför Goal 93

- runtime-installation av tredjepartskod;
- hooks/extension API/sandbox/plugin discovery;
- DB-lagrad markup eller generell renderer;
- Storybook/Chromatic som ny dependency;
- automatisk baselineacceptans;
- full kartesisk modulmatris när samma FSM bevisas centralt.

## Bedömda förbättringar

| Förbättring | Grafstöd | Aktivera när |
|---|---|---|
| rikare katalogrelationer | Backstage visar typade ägare/depends-on/relationer | Corevo behöver söka eller visualisera beroenden utöver required modules |
| versionsmigrering per sparad blocktyp | Gutenberg visar manifest + deprecations + migrate | sparat tenantinnehåll får en faktisk inkompatibel kontraktsändring |
| dependency-installation | Odoo visar addonmanifest och install graph | avvisad tills Corevo kan installera kod separat; idag deployas en kodbas |
| generell blockeditor | Gutenberg visar kostnaden i parser, supports och editor-runtime | avvisad utan separat produktbeslut |

Goal 93 tar schema-, deprecation- och fixturemönstren men inte externa
plugin-/runtime-system.
