# Goal 88 — gemensam kundarbetsyta och sidmotor

Status: **Goal 88 kodklar; final-head lokalt verifierad 2026-07-28**

Gren: `codex/launch-inventory-customer-design`
Produktion, previewdatabas och produktionsdata: orörda

## Verifierat beteende

- Kundens `/admin/sida` och superadminens kundkort använder samma
  `SidaStudioV2`, snapshot, utkast, historik och revisionsactions.
- Den accepterade Goal 80-geometrin är kvar: inbäddad desktop-preview är
  `1360px`, mobil-preview `390px`, med samma split, sticky-offset och responsiva
  brytpunkt.
- Mallbyte är fail-closed. Tenant och partner får ingen mallväljare; endast
  root kan öppna den. Väljaren göms när sidstudion är dirty eller har utkast.
- `ThemePicker` låser nu parent-editorn synkront redan vid submit och före
  server-await. Returnerat fel, throw och avmontering släpper direkt; success
  håller låset genom refresh tills måltemat observeras eller den theme-nycklade
  studion monteras om. Immediate ref blockerar samma-tick snapshot-,
  revisions-, navigation- och pick-race.
- Den lokala append-only migrationen
  `20260728021500_goal88_atomic_theme_switch.sql` delar tenant-radlås mellan
  mallbyte, draft-save och restore. Draftgrinden sker före text-vertical-CAS;
  settings-CAS, missing-row-låsning och kanonisk theme-jämförelse på både live-
  och snapshotsidan hindrar båda cross-session-låsordningarna.
- Mallens preview skickar samma `copy=keep|template` som publiceringen.
  Mallinnehåll replayas inte över en template-preview.
- Stale revisioner, samtidiga revisionsactions, bilduppladdning och
  restore/leave-flöden behåller de säkerhetslås som verifierades i Task 4.
- De gamla routade assembly-filerna `SidaStudio.tsx` och
  `SidaStudioLazy.tsx` är borttagna. `SidaStudio.module.css` finns kvar eftersom
  `BookingSettings.tsx` fortfarande använder den.
- Route-, manifest-, sanningscopy- och acceptanskontrakt läser nu den verkliga
  delade manifestfilen och kan inte längre passera genom hopslagen routekälla.

## Automatiska bevis

- Fokuserad route/layout/bridge/revision/role/editor-svit:
  `node node_modules/vitest/vitest.mjs run ...`
  — **19 filer / 136 tester gröna**.
- Fixrundans runtime-paritet för delad studio, rollgrind och närliggande
  kontrakt:
  `node node_modules/vitest/vitest.mjs run ...`
  — **8 filer / 44 tester gröna**. Lifecycle-testet kör samma snapshot,
  utkast och historik i fristående och inbäddad yta, jämför deras synliga
  revisionsstatus och verifierar att mallväljaren är fail-closed.
- Full webbsvit på final-head efter den atomiska mallfixen:
  `node node_modules/vitest/vitest.mjs run`
  — **376 filer / 2 909 tester gröna**.
- Atomisk mallfix på final-head:
  `node node_modules/vitest/vitest.mjs run
  components/platform/ThemePicker.test.tsx
  components/platform/SidaStudioV2.pick-lifecycle.test.tsx
  lib/platform/actions/theme.test.ts
  lib/platform/actions/site-revisions.test.ts
  lib/platform/theme-switch-atomic.contract.test.ts`
  — **5 filer / 44 tester gröna**.
- Redigera-sidan-kontrakt:
  `corepack pnpm exec playwright test
  e2e/acceptans/03-redigera-sidan-v2/03-redigera-sidan-v2.accept.spec.ts
  --grep='@contract'`
  — **5/5 gröna**.
- Isolerad autentiserad browserparitet på en egen unik lokal port och mot
  exakt preview-ref `cwnhpesrgolflkmyjbrm`:
  `corepack pnpm exec playwright test
  e2e/acceptans/03-redigera-sidan-v2/03-redigera-sidan-v2.accept.spec.ts
  --grep='03-B02'`
  — **1/1 grön**. Tenant-admin och root kördes i separata browser-contexts mot
  samma syntetiska demo-tenant. De visade samma revisionsstatus, tomma historik
  och restore-actions; tenant saknade `Mall`, medan en ren root-yta visade
  både `Mall` och `Mallkategori`.
- Typkontroll:
  `node node_modules/typescript/bin/tsc --noEmit`
  — **grön på final-head**.
- ESLint:
  `node node_modules/eslint/bin/eslint.js .`
  — **0 fel / 7 befintliga varningar på final-head**. Den enda nya Goal 88-varningen i
  Modalens fokusretur rättades och låstes med ett explicit unmount-test.
- Lokal produktionsbuild:
  `node node_modules/next/dist/bin/next build`
  — **grön på final-head**, inklusive typkontroll och 11 statiska sidor.
- `git diff --check` — **grön**.

## Lokal migration — ej applicerad

- **1 ny append-only migration:**
  `20260728021500_goal88_atomic_theme_switch.sql`.
- `supabase/tests/goal88_atomic_theme_switch_test.sql` bevisar root-only/grants,
  lockordning, befintligt draft före text-vertical-CAS, saknad settings-rad,
  settings-CAS, okänd raw theme-fallback på båda jämförelsesidor samt
  switch-first-reject för både save och restore.
- SQL-runtimefilen är skriven för att köras inom `BEGIN … ROLLBACK`, men har
  **inte körts i denna uppgift**, eftersom migrationen inte får appliceras på
  preview eller produktion här. Den är en uttrycklig releasekontroll.

## Känd lokal verktygsnotering

- `corepack pnpm test` stoppas före testerna när Turbo-paketjobben återgår till
  global pnpm 11 och försöker rensa `node_modules` utan TTY
  (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Webbscope kördes därför
  direkt och är helt grönt.
- Workspace-länkarna till de redan låsta ESLint-pluginpaketen saknades lokalt.
  Fem tillfälliga junctions till befintligt `.pnpm`-innehåll användes endast
  för verifieringen och togs bort efteråt. Inga paket, lockfiler eller build
  approvals ändrades.
