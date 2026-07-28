# Goal 88 — gemensam kundarbetsyta och sidmotor

Status: **Task 5 lokalt verifierad 2026-07-28**

Gren: `codex/launch-inventory-customer-design`
Produktion och produktionsdata: orörda

## Verifierat beteende

- Kundens `/admin/sida` och superadminens kundkort använder samma
  `SidaStudioV2`, snapshot, utkast, historik och revisionsactions.
- Den accepterade Goal 80-geometrin är kvar: inbäddad desktop-preview är
  `1360px`, mobil-preview `390px`, med samma split, sticky-offset och responsiva
  brytpunkt.
- Mallbyte är fail-closed. Tenant och partner får ingen mallväljare; endast
  root kan öppna den. Väljaren göms när sidstudion är dirty eller har utkast.
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
- Full webbsvit:
  `node node_modules/vitest/vitest.mjs run`
  — **373 filer / 2 890 tester gröna**.
- Redigera-sidan-kontrakt:
  `corepack pnpm exec playwright test
  e2e/acceptans/03-redigera-sidan-v2/03-redigera-sidan-v2.accept.spec.ts
  --grep='@contract'`
  — **5/5 gröna**.
- Typkontroll:
  `node node_modules/typescript/bin/tsc --noEmit`
  — **grön**.
- Lokal produktionsbuild:
  `node node_modules/next/dist/bin/next build`
  — **grön**, inklusive typkontroll och 11 statiska sidor.
- `git diff --check` — **grön**.

## Kända lokala verktygsblockerare

- `corepack pnpm test` stoppas före testerna när Turbo-paketjobben återgår till
  global pnpm 11 och försöker rensa `node_modules` utan TTY
  (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Webbscope kördes därför
  direkt och är helt grönt.
- Direkt ESLint startar inte eftersom den befintliga workspace-länken till
  `@next/eslint-plugin-next` saknas (`ERR_MODULE_NOT_FOUND`). Inga paket,
  lockfiler eller build approvals ändrades för att dölja miljöfelet.

## Manuell browserkontroll som återstår

Autentiserade `ACCEPT_*`-värden och en uttryckligt säker browsermiljö saknades,
så ingen okänd lokal `:3000` eller produktion öppnades.

1. Öppna samma syntetiska tenant i `/admin/sida` och i kundkortets Sida-flik.
   Kontrollera att samma utkast och historik visas på båda ytorna.
2. Kontrollera att root ser mallväljaren, medan partner och tenant inte gör det.
3. Förhandsvisa en annan mall, prova både behåll/använd mallinnehåll, avbryt och
   kontrollera att inget publiceras före ett uttryckligt publiceringsval.
