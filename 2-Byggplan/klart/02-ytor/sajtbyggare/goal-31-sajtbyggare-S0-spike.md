# goal-31 — Sajtbyggare S0: SPIKE (bevisa render-bron + välj motor)
Thinking: ⚫ (ny arkitektur-grund som avgör HELA sajtbyggar-spåret · bygg bakom flagga · noll prod-regression · Zivar-OK för spike-deploy till intern/preview-yta)

**Datum:** 2026-06-16
**Typ:** Autonom byggorder för Claude Code — körs via /goal.
**Vad detta är:** Enda ingångspunkten för körningen. Läs den här filen + spec:en (nedan) FÖRST.

## Mål
Bevisa — eller motbevisa — det enda antagande som hela sajtbyggaren vilar på: att en **importerad vendor-mallsida** kan renderas troget på **riktiga Workers/OpenNext-deploy-vägen** med en **riktig Corevo-modul (`booking`, async server-komponent) invävd vid en markör**. Samtidigt: bygg GrapesJS och Puck/React-konvertering tunt nog för att **välja motor på bevis, inte på papper**. Utfallet avgör om/hur S1–S5 skrivs. Inget i S1–S5 planeras förrän S0 är grön.

## Lägeskoppling
Skiva **S0** i `1-Planering/06-sajtbyggare/00-DESIGN-sajtbyggare.md` (§10). Grinden för att resten av sajtbyggaren ens ska planeras. Bygger på: multibransch-motorn (live), `tenant_modules`, modul-sektionerna i `app/(public)/page.tsx`, R2-bucket `corevo-media`. Ligger EFTER Fas A (deploy+login, klar) i `2-Byggplan/ROADMAP-bryt-loopen-2026-06-15.md`.

## Läs FÖRST (gissa inte — spec:en är detaljerad)
1. `1-Planering/06-sajtbyggare/00-DESIGN-sajtbyggare.md` — hela spec:en, särskilt §5 (motorval), §6 (render-bron), §9 (risker), §10 (S0).
2. Verifiera nuläget innan kod: finns mallen `restoran` i `templates` + dess `booking.html`-källa? Var defaultar `booking`-modulen (`modules.default_section_position`)? Hur renderas `BookingSection`/modul-sektionerna idag i `app/(public)/`?

## Utgångsläge (verifierat 2026-06-16, bekräfta på maskinen)
- Multibransch-motorn LIVE (goal-30). Tenant **Test Barber** aktiv (`test-barber.corevo.se` via CF Custom Domain), 7 moduler. FreshCut + de 5 React-temana (Salvia/Leander/Zigge/Linnea/Edit) orörda och live.
- Ingen sajtbyggare finns — noll editor-kod, noll import-pipeline.
- Bygg kraschar i repo-roten (ö-path → opennext ENOENT) → bygg ENDAST via `C:\tmp\kod`.
- `*.boka.corevo.se`-certet är blockat (CF Free). S0 publicerar därför INTE på en publik tenant-storefront — den bevisas på preview-/flagg-gatad yta.

## Autonomi-regler
- Claude Code fattar alla tekniska val själv — fråga aldrig droppvis.
- En commit per punkt (F1…F5); verifiera + pusha före nästa.
- Allt via kod/CLI — aldrig manuell dashboard.
- Bygg ENDAST via `C:\tmp\kod` (`robocopy … /XD node_modules .next .open-next .git .turbo /XF .env.local`). Gates före varje push: `pnpm --filter @corevo/web test` (vitest) · `typecheck` 0 · `lint` 0 · opennext/next build PASS · grep-guard ren (ingen `localhost:3000`, ingen `*.corevo.se`-route-läcka). Failar en gate → deploya INTE, rapportera.
- DB-ändringar (om nödvändigt) bara via numrerade, idempotenta migrationer med rollback + RLS på ny tabell. S0 ska helst klara sig utan schema — om en draft-tabell behövs, minimal + bakom samma flagga.
- `packages/auth` FRYST (G02). POS/`root`/`corevo.se` orörd. DAL-fence intakt. De 5 temana + FreshCut rörs ALDRIG.
- Genuint mänskliga steg (t.ex. köpa CF ACM) batchas — blockerar aldrig bygget.

## Beslut som redan är fattade — stanna inte för dessa
- **Test-mall = `restoran`** (har redan `booking.html` enligt spec). Saknas den → välj `foody` och notera bytet.
- **Test-modul = `booking`** (async RSC, riktig DB-data) — den svåraste injektionen, så den bevisar mest.
- **Bygg bakom flagga `SAJTBYGGARE_ENABLED`** (av i prod = noll publik yta). Av default.
- **Editorn bor bakom admin-dörren** (`booking.corevo.se`, vald tenant) — aldrig publik.
- **Spike-deploy går till preview-/flagg-gatad yta, ALDRIG en publik tenant-storefront** (cert-väggen). Räcker för att bevisa Workers-runtimen.
- **Motorval avgörs i S0, inte på papper:** bygg BÅDA tunt — GrapesJS (HTML-import) OCH en Puck/React-konvertering-skiss — och jämför. Zivars regel: använd beprövad OSS, porta in koden, uppfinn inte hjulet.
- **De 5 temana ersätts inte** — sajtbyggaren är ett parallellt val per tenant ("färdigt tema" ELLER "byggar-sajt").
- **Språkgräns för automation (Zivar 2026-06-16):** Python = offline-verktyg (parsa mallar, bilder, audits, checks). Node/TS = checks som känner modul-registret + **ALL render-logik**. 🔴 Render-vägen kör på Workers → **Python kan inte köra där**; försök aldrig lägga render-logik i Python. Se `1-Planering/06-sajtbyggare/AUTOMATION-scripts.md`.

## Steg — S0 = en tunn vertikal skiva genom hela stacken
**F1 — Render-bron, minimal (kärnan).** Importera EN `restoran`-sida (HTML/CSS/bilder) som data. Rendera den på den riktiga Workers/OpenNext-deploy-vägen (bygg via `C:\tmp\kod` → deploy till preview/flagg-yta). Lägg en markör `<corevo-module type="booking" pos="…">` i layouten → väv in den RIKTIGA `booking`-server-komponenten vid markören via `html-react-parser` (eller likvärdig). Den ska rendera med riktig DB-data, 0 console-fel, och sidan ska se trogen ut mot originalet (mallens egen CSS laddad, scopad under `[data-tenant]`).

**F2 — Motor-jämförelse.** (a) Embedda **GrapesJS** i admin (bakom flaggan): importera samma `restoran`-sida → redigera en text/bild → spara → rendera → bekräfta round-trip (import→edit→save→identisk render). (b) Skissa **Puck/React-konvertering** tunt: konvertera samma sida till React-block, väv in samma `booking`-modul. Jämför: trogen import vs ren modul-injektion vs underhåll.

**F3 — Mät per-mall-onboarding-jobbet.** Tidsuppskatta handjobbet för att ta in EN mall ordentligt: importera, markera redigerbara regioner, koppla modul-slots så kunden inte kan söndra layouten. Konkret siffra per mall (spec §2.8 — "det är INTE noll").

**F4 — Vendor-JS-beslut.** `restoran`-mallens egen JS (carousel/jQuery m.m.) ingår i "exakt utseende". Bestäm + dokumentera: (a) ladda vendor-JS isolerat, (b) ersätt interaktiva bitar med React vid import, eller (c) S1 statiskt + rörelse senare. Lastbärande — glid inte förbi.

**F5 — Sanerings-gräns.** Vendor-/tenant-HTML saneras server-side före render (XSS-gräns, spec §9). Skissa var gränsen sitter + vilket bibliotek.

**F6 — Verifierings-script (automation, offline).** Bygg `5-Kod/scripts/verify_render` (Python eller Node — offline, kör ALDRIG i Workern) som tar den deployade spike-URL:en och **automatiskt** assertar: sidan renderar (titel + hero), `<corevo-module type="booking">` faktiskt renderade (riktig data-markör i DOM), 0 console-/HTTP-fel, och en grov trohets-jämförelse mot originalmallen. Detta är mönstret "deploya → script bevisar att det blev rätt" som återanvänds i varje skiva (se `1-Planering/06-sajtbyggare/AUTOMATION-scripts.md`).

## Verifiering (Klar när — kontraktet, objektivt verifierbart)
- [ ] 1 importerad `restoran`-sida renderar på en **DEPLOYAD Workers-yta** (URL noterad i rapporten), trogen mot originalet (titel + hero + mallens CSS), 0 console-fel.
- [ ] `<corevo-module type="booking">` vid markör → den **riktiga** `booking`-server-komponenten renderar med DB-data på samma deployade yta (ej bara localhost). Bevis: skärmdump + vilken tenant/data.
- [ ] **GrapesJS** round-trippar i admin: import→edit (text+bild)→save→render identisk. Bevis: skärmdump eller test.
- [ ] **Puck/React-vägen** skissad tillräckligt för en motiverad jämförelse (kort PoC eller dokumenterad bedömning med kod-exempel).
- [ ] **RAPPORT-fil** `1-Planering/06-sajtbyggare/S0-UTFALL.md`: (1) motorval GrapesJS vs Puck + motivering, (2) per-mall-jobb-uppskattning (siffra), (3) vendor-JS-beslut, (4) håller bron på Workers? ja/nej + bevis.
- [ ] **`5-Kod/scripts/verify_render`** finns + kör grönt mot den deployade spike-URL:en (asserterar titel/hero + invävd booking-markör + 0 fel). Körs offline, ej i Workern.
- [ ] Flaggan `SAJTBYGGARE_ENABLED` finns; **av = noll ny publik yta**. Verifierat: `corevo.se` POS orörd (200), FreshCut storefront orörd, de 5 temana orörda, `booking.corevo.se/login` 200 + 0 console-fel.
- [ ] Gates gröna (vitest/typecheck/lint/opennext build/grep-guard). Worker-version + rollback-id noterade.

## Anti-patterns
- Välj ALDRIG motor på papper — S0:s hela poäng är att bevisa båda på Workers-runtimen.
- Bevisa ALDRIG bron bara på localhost — det är just Workers/OpenNext (ö-path/opennext) som bitit förr.
- Rör ALDRIG `packages/auth`, POS/`corevo.se`, DAL-fence, de 5 temana, FreshCut.
- Bygg ALDRIG i repo-roten — bara `C:\tmp\kod`.
- Publicera ALDRIG på en publik tenant-storefront (cert-väggen) — preview/flagg-yta räcker för S0.
- Slå ALDRIG på `SAJTBYGGARE_ENABLED` i prod i denna goal.
- Deploya ALDRIG om en gate failar.

## Rollback
- Flagga av (`SAJTBYGGARE_ENABLED=false`) → noll ny yta direkt.
- Kod: `git revert` av S0-commits + redeploy. `wrangler rollback <föregående-id> --config 5-Kod/apps/web/wrangler.jsonc`.
- Ev. draft-tabell: drop-block i migrationens rollback.

## Rapportera
Svara på S0:s fyra frågor med bevis: (1) håller markör-bron på Workers? (2) GrapesJS vs Puck — vilken är renast + varför? (3) per-mall-onboarding-jobb (konkret siffra)? (4) vendor-JS-beslut? + reko: hur S1 ska skrivas givet utfallet. Cowork/Nörden gör oberoende live-verifiering efteråt — lita ej på "klart".

## Versionshistorik
| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-16 | Första S0-spike-briefen (Cowork). Skiva S0 ur sajtbyggar-spec:en, körbar för Code. S1–S5 skrivs EFTER S0:s utfall. |
