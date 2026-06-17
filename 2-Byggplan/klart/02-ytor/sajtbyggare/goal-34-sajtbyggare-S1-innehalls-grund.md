# goal-34 — Sajtbyggare S1: innehålls-grund (redigerbara regioner + override-kaskad)
Thinking: ⚫ (datamodell som ALLT nedströms vilar på — override-kaskaden måste in NU, dyr att retrofitta. Inget editor-UI än.)

**Datum:** 2026-06-16
**Typ:** Autonom byggorder för Claude Code — körs via /goal. **Körs EFTER fix-33 (domän-fix).**
**Vad detta är:** Enda ingångspunkten. Läs den + **`1-Planering/06-sajtbyggare/01-INRIKTNING-LAST-visuell-innehalls-editor.md`** (den LÅSTA modellen) FÖRST, sen `00-DESIGN-sajtbyggare.md` (men inriktnings-doc:en går FÖRE den på editor-scopet).

**Design-kanon (LAG, promotat 2026-06-17):** `4-Dokument-Underlag/01-acceptans/` — lyft exakta px/hex/font härifrån. Modul→storefront-ritning för **S3** (rör ej denna S1): `1-Planering/06-sajtbyggare/02-RITNING-v3-moduler-storefront.md`.

## ⛔ Modellen är LÅST (Zivar bekräftade) — bygg INTE en page-builder
Sajtbyggaren = **visuell innehålls-editor**: man väljer en färdig mall och **klickar direkt på elementet** (bild → byt, text → skriv om, färg/font/logo → ändra) — live, på en FAST mall. Redigerbara regioner är **definierade av mallen**; kunden kan INTE bygga sidor/dra in block/söndra layouten. **INTE** GrapesJS/Puck-drag-drop. Editor-UI:t (klick-overlay + TipTap + R2-bildväljare) byggs i **S2** — **inte här**.

## Mål (S1 = grunden, inget UI)
Lägg datalagret som S2:s klick-editor vilar på:
1. **Redigerbara regioner per mall** — en deklarativ manifest: vilka regioner är redigerbara (hero-bild, rubrik, ingress, färg-tokens, logo…) + typ (bild/text/färg/font) + default ur temat.
2. **Override-kaskad Universal → Bransch → Kund** med härkomst (`standard` vs `modifierad (kund)`) — **inbyggd från start** (den tidskänsliga design-regeln).
3. **Markerad render** — storefronten renderar redigerbara regioner med `data-editable="hero.image"`-markörer (bygger på S0:s render-bro) så S2:s overlay kan haka på.
Bevisat på **EN** mall + EN tenant. Inget editor-UI.

## Lägeskoppling
Sajtbyggare **S1**. Bygger på: S0:s render-bro (`render-bridge.tsx`, bevisad), dagens per-tenant innehåll (Varumärke/Texter/Bilder — färg/font/logo + hero-texter + bilder, finns REDAN), `tenant_modules`, R2. Efter detta → S2 (editorn).

## Autonomi-regler
- Tekniska val själv; en commit per punkt; verifiera + pusha före nästa.
- Bygg via `C:\tmp\kod`. Gates före push: vitest · tsc 0 · lint 0 · opennext build · grep-guard ren.
- DB-ändringar bara via numrerad idempotent migration + RLS på ny tabell/kolumn + rollback.
- `packages/auth` FRYST. POS orörd. **De 5 React-temana + FreshCut rörs ALDRIG destruktivt.** Bakom flagga `SAJTBYGGARE_ENABLED` (av i prod).

## Beslut redan fattade — stanna inte
- **Återanvänd dagens innehålls-data** (färg/font/logo/hero-texter/bilder) — bygg INTE om den; lägg kaskaden + region-manifesten OVANPÅ.
- **Testmall = `salvia`** (har redan innehållsfält + är test-barbers tema) ELLER `restoran` (S0:s). Välj salvia om dess fält är renast; notera valet.
- **Editor-motor (S2, ej nu):** research-svar = lätt egen klick-overlay + **TipTap** (MIT, text) + egen R2-bildväljare, INTE GrapesJS. Se inriktnings-doc:en. S1 ska INTE låsa eller bygga detta — bara lämna `data-editable`-markörer + ren datamodell.
- **Provenance krävs:** varje redigerbar region vet om värdet är `standard` (ärvt) eller `modifierad` (kund-override).

## Steg
**F1 — Region-manifest.** Deklarera, för minst 1 mall, dess redigerbara regioner: nyckel (`hero.image`, `hero.title`, `color.primary`…), typ (image/text/color/font/logo), och default ur temat. En ren datastruktur (ingen UI).

**F2 — Override-kaskad + provenance (migration).** Innehåll resolvar **Universal → Bransch (vertical) → Kund (tenant)**. En tenant-override lägger sig ovanpå; resten ärvs. Varje fält bär härkomst (`standard`/`modifierad`). Idempotent migration + RLS + rollback. Återanvänd befintliga innehållskolumner där de finns; lägg kaskad-lagret ovanpå.

**F3 — Markerad render.** Storefronten (via render-bron) renderar de redigerbara regionerna med `data-editable="<nyckel>"` + nuvarande värde. Inga klick-handlers än (S2) — bara markörerna + rätt resolvat värde.

**F4 — Bevisa på 1 mall + 1 tenant.** För salvia/test-barber: innehållet resolvar genom kaskaden, renderar med `data-editable`-markörer, och en **kund-override** (t.ex. byt hero-rubrik) ger härkomst `modifierad` + syns i render — medan orörda fält är `standard` (ärvda). Bevis: DOM-utdrag (markörer) + query som visar provenance.

## Verifiering (Klar när)
- [ ] Region-manifest finns för ≥1 mall (regioner + typ + default), läsbart som data.
- [ ] Kaskad Universal→Bransch→Kund med provenance (`standard`/`modifierad`); migration idempotent + RLS + rollback.
- [ ] En kund-override → härkomst `modifierad` korrekt; orörda fält `standard`. Bevisat (query + render).
- [ ] Renderad storefront har `data-editable`-markörer på de redigerbara regionerna (verifierat i DOM på staging-yta).
- [ ] Befintlig branding/texts/images återanvänd, INTE ombyggd. FreshCut + 5 teman orörda. Inget editor-UI byggt.
- [ ] Flagga-gatad (av i prod = noll ny publik yta). Prod `corevo.se`/`booking.corevo.se` 200, 0 console-fel.
- [ ] Gates gröna; worker-version + rollback-id.

## Anti-patterns
- Bygg INTE editor-UI / klick-overlay / TipTap här — det är S2.
- Bygg INTE GrapesJS/Puck/page-builder. Ingen drag-drop.
- Rör INTE de 5 temana eller FreshCut destruktivt. Bygg via `C:\tmp\kod`.
- Skjut INTE upp override-kaskaden — den ÄR S1:s kärna.

## Rollback
Flagga av → noll yta. Migration drop-block. `git revert` + `wrangler rollback`.

## Rapportera
Vald testmall · region-manifest · kaskad + provenance-bevis · DOM-markör-bevis · vad som återanvändes vs nytt. Cowork/Nörden om-verifierar oberoende. Sen skrivs S2 (editorn).

## Versionshistorik
| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-16 | S1 omskriven mot LÅST inriktning (visuell innehålls-editor, ej page-builder). Datalager + override-kaskad + data-editable-markörer; inget UI. |
