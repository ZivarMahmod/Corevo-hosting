# Goal 88 — gemensam kundarbetsyta och sidmotor

Status: **KLAR — lokalt verifierad 2026-07-28** på
`codex/launch-inventory-customer-design`.

## Mål

Gör `SidaStudioV2` till Corevos enda skrivande sidmotor för både kundadmin och
superadmin. Behåll Corevos typade formulär, tenantgränser och
`site_revisions`, men använd Open Designs beprövade principer för stabil
viewer-state, semantisk elementidentitet och tydlig host-auktoritet.

Detta är en produktionsduglig grund, inte en fristående ny editor och inte en
generell HTML/CSS-editor.

## Frysta beslut

- Kundadmin använder fortsatt `/admin/sida`.
- Superadmin använder kundkortets Sida-yta med
  `?kundflik=sida&flik=<editorflik>`.
- Båda ytorna monterar samma `SidaStudioV2`, samma manifestbyggare och samma
  revisionsactions.
- `SidaStudioV2` får `surface: 'standalone' | 'embedded'`.
- Embedded-ytan bevarar Goal 80 exakt:
  `minmax(400px, 1fr) minmax(480px, 1.15fr)`, `16px` gap,
  `align-items:start`, sticky preview `top:78px`,
  `height:calc(100vh - 220px)`, `min-height:420px` och enkolumn under
  `991px`.
- Kundflikar använder stabila URL-sluggar; ogiltig eller avstängd modulflik
  faller tillbaka till `oversikt`. Innerfliken använder befintliga manifest-ID:n
  i `flik`.
- Innerfliksbyte använder `router.replace` och bevarar övriga queryparametrar.
  Yttre kundflikar är riktiga länkar så befintlig dirty-guard kan fånga dem.
- Mallbyte visas endast för verklig `platformAdmin`, aldrig partner eller
  kundadmin. Osparade ändringar eller sparat utkast måste publiceras eller
  kastas före mallbyte.
- Modulaktivering stannar i Drift. Sida-manifestet länkar endast till verkliga
  adminytor: `/admin/offerter` för offert och `/admin/media` med etiketten
  Bildbibliotek för dagens galleri-/mediaingång.
- Ingen databasmigration och inget nytt bibliotek behövs.

## Task 1 — delat manifest och URL-kontrakt

1. Skriv först röda tester för ett React-fritt delat manifest, korrekta
   modulvägar och pathname-medveten editor-URL.
2. Flytta manifesttyperna och den rena manifestbyggaren ur
   `/admin/sida/page.tsx` till en gemensam källa som både routes och klienten
   kan importera.
3. Gör `siteEditorTabHref` pathname-medveten, bevara queryparametrar och använd
   `replace` för innerflik.
4. Gör `TenantDetailTabs` URL-styrd via `kundflik`, med riktiga länkar,
   kanoniska sluggar och säker fallback.

## Task 2 — samma V2 på kundadmin och superadmin

1. Skriv först röda route-/kontrakttester som kräver samma
   `SidaStudioV2Lazy` och manifest på båda ytorna.
2. Låt plattformens kundkort läsa befintlig revisionsstate, snapshot,
   historik, schema, moduler och vertikalcopy och skicka samma kontrakt som
   kundadmin.
3. Lägg till `standalone`/`embedded` utan att ändra kundadminens nuvarande
   fullskärmslayout eller Goal 80:s embedded-geometri.
4. Behåll plattformens mallväljare endast för root. Alternativ mallpreview
   använder befintliga `theme`/`copy`-queryparametrar; `copy=template` får inte
   skrivas över av den aktuella revisionssnapshoten.
5. Partners får revisionsåtkomst inom befintligt scope men ser ingen
   mallväljare.

## Task 3 — säkert “Välj på sidan”

1. Skriv först röda resolver- och bridge-tester för fältval, origin/window,
   CTA-blockering, Escape och okända fält.
2. Lägg till hostmeddelandet
   `{ source:'corevo-sida', type:'editor-pick-mode', enabled, fields }` och
   iframe-svaret
   `{ source:'corevo-sida', type:'editor-pick-field', field }`.
3. Parent skickar en allowlist från aktivt manifest plus de fasta
   Allmänt/Kontakt/Bokning-/bildfälten. Iframen skickar endast semantisk
   fältnyckel; ingen DOM-path, selector eller HTML.
4. Stabil markör prioriteras, befintlig skannad
   `data-corevo-editor-field` får användas endast när nyckeln finns i
   allowlisten.
5. Ett lyckat klick väljer rätt tab/kort, avslutar väljläget, öppnar panelen,
   scrollar och fokuserar kontrollen. Aktiv tab vinner vid dubbletter, annars
   manifestordning. Indexerade bildfält fokuserar rätt rad.
6. Hover byter aldrig formulär. Escape, tabbyte och avmontering avbryter.
   Oredigerbar yta gör ingen navigation eller mutation. Normala previewlänkar
   fungerar oförändrat när läget är av.
7. Samma iframe förblir monterad vid panel-, enhets- och väljlägesbyten.

## Task 4 — skrivlås, konflikt och återställningssäkerhet

1. Skriv först röda tester som reproducerar inmatning under save/publish,
   dubbelåtgärd, revisionskonflikt och dirty restore.
2. Inför ett enda action-mutex med namngivet busy-läge för save, publish,
   discard och restore. Lås muterande formulärkontroller med native
   `fieldset disabled`, pausa tab-/elementval och exponera `aria-busy`.
3. Använd actions befintliga `conflict`-flagga. Vid konflikt behålls lokala
   värden, fler skrivningar blockeras och endast ett uttryckligt
   “Ladda om senaste” får kasta lokal state.
4. Bekräfta både historisk återställning och återställning till publicerad
   version när lokala ändringar annars skulle försvinna.
5. Återanvänd portalens tillgängliga `Modal` för lämna-/återställningsdialoger,
   inklusive Escape, fokusfälla och fokusåterställning.

## Task 5 — paritet, pensionering och låsbevis

1. Kör route-, layout-, bridge-, revisions-, roll- och browserparitet för båda
   ytorna.
2. När pariteten är grön: ta bort de gamla routade assembly-filerna
   `SidaStudio.tsx` och `SidaStudioLazy.tsx`. Behåll delad CSS och leaf-kod som
   fortfarande har verkliga callers.
3. Verifiera att kundadmin och superadmin ser samma utkast/historik, att stale
   skrivning aldrig skriver över, att mallbyte är root-only och att
   tenant/partner-scope är fail-closed.
4. Kör fokuserade tester, hela `pnpm test`, `pnpm typecheck`, `pnpm lint`,
   `pnpm build` och `git diff --check`.
5. Kör oberoende spec-/kodreview, uppdatera Graphify och skriv utfört
   testprotokoll i `6-Testing/`.

## Verifiering

- Samma revisionsägda `SidaStudioV2`, manifest, snapshot, utkast och historik
  är runtime- och browserverifierade i kundadmin och superadmin.
- Root-only mallbyte är fail-closed för tenant och partner samt dolt vid dirty
  state eller befintligt utkast.
- Semantiskt fältval, bilduppladdning, konfliktläge, restore, leave och
  browser-back har deterministiska livscykeltester.
- De två äldre routade assembly-filerna är borttagna; delad CSS och verkliga
  leaf-callers är kvar.
- Slutbevis: 373 testfiler/2 892 tester, autentiserad read-only browserparitet,
  typecheck, ESLint 0 fel/7 befintliga varningar, produktionsbuild och
  oberoende uppgiftsreview är gröna.
- Produktion, produktionsdata, deploy, migrationer, paket och lockfiler är
  orörda. Fullt protokoll:
  `6-Testing/goal-88-gemensam-kundarbetsyta-sidmotor-testlista.md`.

## Utanför målet

- Fri HTML/CSS-redigering, lagerpanel och generell style inspector.
- DOM-pathfallback, fem-iframespool och filsystemsversioner.
- Realtime-samarbete och lokal/global undo/redo.
- Goal 89:s gemensamma storefront-/mallslots.
- Goal 90–92:s modulunika produktkedjor.
- Goal 93:s fulla mekaniska markörtäckning för samtliga mallar.
- Produktionsmigration, deploy eller produktionsdata.
