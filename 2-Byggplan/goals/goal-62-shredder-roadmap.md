# goal-62 — SHREDDER-RUNDAN: mall-identitet, exakta färger, uiverse-elementen

> **Zivars order 2026-07-12:** *"din plan shreddar du ner i så enkla uppgifter där det blir
> massa körningar men allt blir korrekt och du håller din kontext ren."*
>
> Detta dokument ÄR roadmapen. Zivar öppnar den och ser läget utan att fråga.
> Bocka `[x]` DIREKT när en punkt är verifierad klar — aldrig i förväg.

## ARBETSSÄTTET (LAG för varje körning)
1. **EN punkt = EN körning = EN commit = push.** Aldrig 10 samtidigt. Aldrig knappar+kundkort+blogg i samma svep.
2. Om samma sak gäller flera mallar/ställen med SAMMA syfte ("knappar ska bete sig enligt X")
   → då körs den punkten över alla ställen, men fortfarande som EN punkt, inget annat i lasten.
3. Deploy ofta — 1000 deploys är okej. Push så många gånger det behövs.
4. Varje körning avslutas med verifiering (mät, öppna sidan) INNAN bocken sätts.
5. Kontext hålls ren: en körning gör sitt, avslutar, nästa körning börjar från roadmapen.
6. Efter varje avbockad punkt: uppdatera denna fil i samma commit.

## PRINCIP: modulen beter sig per BRANSCH (Zivar 2026-07-12)
Samma modul, två branscher, två olika uppgifter/uttryck. Boka-modulen är "boka tid" hos
frisören men "beställ"/"skicka förfrågan"/"ansök" hos floristen/annan bransch — verb, flöde
och fält styrs av branschen (bransch-lagret `bransch-copy.ts` är rätt hem för verben; flödes-
varianter deklareras per bransch, inte hårdkodas per modul). Varje körning som rör en modul-yta
frågar först: "vad heter/gör detta i DENNA bransch?" — aldrig salongs-defaulten rakt av.
Inloggen: `5-Kod/docs/ops/INLOGGNINGAR.md` (LOKAL, gitignorad — Zivar fyller i superkontot).

## RAPPORT-FORMAT (Zivar 2026-07-12): inga paragrafer.
Efter varje körning: "A1 klar ✅ — kör A2." + bock i denna fil. Billigaste vägen alltid.
Advisor används flitigt under arbetet; context-mode/ctx-verktygen för tunga läsningar.

## Referenser (läses av körningen som behöver dem, inte alla)
- Zivars skärmdumpar: `4-Dokument-Underlag/skarmdumpar-bygg/` (rot + `goal-60-referenser/` +
  `goal-60-mall-granskning/`) — webshop-delar, kundvagnar, hur produktkort SKA se ut.
- Interflora.se = riktmärke för floristhandel (komponenter, produktbilder, kassa-känsla).
- uiverse-biblioteket: `4-Dokument-Underlag/uiverse-komponentbibliotek.md` (LOKAL, gitignorad).
  Anatomi lånas — aldrig deras kod (hex, transition:all, hover-only = viruset).
- Vektor-regeln (goal-59): mallen äger formen, modulen äger funktionen via `--sf-*`.
- 8-axel-checklistan: `3-Bakgrund-Research/riktiga-floristsajter-struktur.md`.

---

## FAS A — AKUT & STÄD (småpunkter, en i taget)

- [x] **A1. Deploya det som redan är pushat** ✅ v1.18.0 — CI grön; corevo.se + booking + superbooking + florist + freshcut alla 200.
- [x] **A2. Kundkonto-toggeln i kundkortet** ✅ Drift-fliken på superbooking (`setTenantCustomerAccounts`
      + `CustomerAccountsCard`). Reglaget fanns BARA i kundens egen admin — därför hittade Zivar det
      aldrig. Samma settings-nyckel, MERGE-skrivning, revalidate av kundens sajt. Av = inloggning +
      Mitt konto + /registrera släcks; gästbokning/gästköp orört.
- [x] **A3. Sajtbyggar-resten** ✅ INGEN REST I KODEN. Grep över hela appen: ordet finns bara som
      DB-check-värde (`MediaRecordSource = branding|sajtbyggare`, migration 0053 — kräver migration
      för att döpa om, medvetet kvar) + tre historik-kommentarer. Live: `/sajtbyggare-spike/look` = 404
      på både florist och freshcut; `/admin/sajtbyggare` = bara host-routing-307 (samma som vilken
      icke-existerande rutt som helst). Det Zivar ser är **SidaStudio ("Redigera sidan")** — editorn
      som SKA finnas. Ingen rivning behövs.
- [x] **A4. Prestanda-spöket** ✅ MÄTT — inget segt i produktion. Live-tider: storefront 0.08–0.98 s,
      login 0.08–0.93 s, butik/kassa/varukorg 0.26–0.87 s. Kund-admin lokalt (dev-server, första
      kompilering inräknad): långsammast /admin/offerter 4.3 s, /admin/installningar 3.2 s, resten
      0.4–2.7 s — det är Next dev-kompilering, inte appen. Slutsats: segheten Zivar känner är
      antingen dev-servern eller en enskild SPARA-action → återkommer som egen punkt när vi kan
      peka ut vilken yta. Bifynd: **/butik = 404, rätt rutt är /shop** (svensk rutt saknas → E-fasen).
- [~] **A5. Florist-admin-kontot — VÄNTAR PÅ ZIVAR** (jag skapar aldrig konton/lösenord åt någon).
      Ytan FINNS: superbooking → kundkortet (Hantverksfloristerna) → **Personal-fliken** →
      "Bjud in med inlogg" → skriv e-postadressen → medarbetaren får magic-link och sätter eget
      lösenord. Kräver att SUPABASE_SERVICE_ROLE_KEY är satt i prod (annars säger knappen till).
      Skriv in kontot i `5-Kod/docs/ops/INLOGGNINGAR.md` (lokal fil) när det är gjort.
- [~] **A6. Verifiera fas 2-admin på superbooking — VÄNTAR PÅ SUPERKONTOT** (fyll i det i
      `INLOGGNINGAR.md`, lokal fil). Då mäts kebab-menyn + mall-galleriet med Playwright och
      goal-61 fas 2 kan bockas helt.

## FAS B — FÄRGERNA SKA VARA EXAKTA (texter göms av paletter idag)

> Zivar: *"många gånger syns inte vissa texter pga olika färger som är i vägen."*

- [ ] **B1. Bygg kontrast-roboten**: utöka `_sweep.mjs` — per mall (alla 20, via
      corevo-dev-theme-cookien), per sida (hem/butik/om/kontakt/boka), mät VARJE synlig
      textnod mot sin faktiska bakgrund (computed style, inte antagen token). Rapport:
      mall × sida × element × ratio. Allt under 4.5:1 (3:1 för stor text) = FAIL-lista.
- [ ] **B2. Fixa FAIL-listan mall för mall** — EN mall per körning, i mallens egen
      `.theme.ts`/`.module.css` (aldrig global fulfix). Bocka per mall:
  - [ ] calytrix · [ ] aurora · [ ] sage · [ ] oliviathyme · [ ] paisley · [ ] onyx
  - [ ] viora · [ ] isalara · [ ] seraphina · [ ] wildthistle · [ ] mina · [ ] lunaria
  - [ ] eloria · [ ] flora · [ ] salvia · [ ] leander · [ ] zigge · [ ] linnea
  - [ ] edit · [ ] freshcut
- [ ] **B3. Kontrast-roboten in i ritualen**: körs efter varje mall-ändring framåt
      (samma roll som `npm run vakt` för bransch-ord).

## FAS C — MALLARNA SKA KÄNNAS SOM OLIKA BRANDINGS (inte samma mall återanvänd)

> Zivar: *"allt ser ut som en mall man återanvänt … samma runda figurer, inga övergångar,
> samma sak om och om igen utan layoutförändringar."*

- [ ] **C1. Divergens-mätningen**: screenshot per mall (hem + butik), mät formvokabulären
      mekaniskt: border-radius-fördelning, knappform (pill/kvadrat/skuren), kortstil
      (skugga/ram/flat), sektionsövergångar (rak kant/våg/diagonal/överlapp), typografi-par.
      Två mallar med samma profil = FAIL. Rapport-tabell in i denna fil.
- [ ] **C2. Form-manifest per mall**: varje mall får ett uttalat formspråk i sin `.theme.ts`
      (radius-skala, knappform, kortstil, övergångstyp, bildbehandling). Skrivs FÖRST som
      13+7 raders tabell här i dokumentet (en design-runda), sen implementeras.
- [ ] **C3. Implementera divergensen** — EN mall per körning (samma bock-lista som B2).
      Per mall: egna sektionsövergångar (inte rak kant överallt), egen knapp-/kortform,
      egna hover-uttryck. Ingen delad "rund figur" över alla.
- [ ] **C4. Övergångarna**: sektionsbyten ska ha medvetna övergångar där mallens manifest
      säger det (våg, färgblock-skifte, diagonal, foto-bleed) — aldrig 13 × rak kant.

## FAS D — ONBOARDING-PREVIEWN: EGET BAS-INNEHÅLL PER MALL

> Zivar: *"när jag klickar på onboarding ska de ha egna renderade element och bilder —
> en bas, inte hantverksfloristens. En egen mall är en egen typ av branding."*

- [ ] **D1. Inventera vad previewn visar idag** (studions StorefrontPreview: vems innehåll,
      vems foton, per mall). Dokumentera gapet här.
- [ ] **D2. Bas-innehållspaket per mall**: varje mall-registry-post får eget demo-innehåll
      (egna foton via u()-mönstret, egen copy-ton, egna produktexempel) som previewn och
      mallväljar-korten renderar när ingen riktig tenant-data finns. INTE Hantverksfloristernas
      texter/bilder. EN mall per körning (bock-listan igen):
  - [ ] calytrix · [ ] aurora · [ ] sage · [ ] oliviathyme · [ ] paisley · [ ] onyx
  - [ ] viora · [ ] isalara · [ ] seraphina · [ ] wildthistle · [ ] mina · [ ] lunaria
  - [ ] eloria · [ ] flora · [ ] salvia · [ ] leander · [ ] zigge · [ ] linnea
  - [ ] edit · [ ] freshcut
- [ ] **D3. Mall-galleriets kort visar mallens EGEN hero** (finns delvis) — verifiera att
      ingen mall lånar en annans foto, byt de som gör.

## FAS E — WEBSHOPPEN: BORT FRÅN POST-IT-KÄNSLAN

> Zivar: *"när man lägger upp en produkt ska det inte kännas som en post-it-lapp. Kolla
> skärmdumparna. Interflora är jättefin för florister."*

- [ ] **E1. Läs referenserna**: gå igenom `skarmdumpar-bygg/` (webshop-delarna, kundvagnarna)
      + Interfloras produktkort/kassa. Skriv 10-punkters gap-lista här (vad deras kort har
      som våra saknar: bildformat, luft, prisplacering, hover, badge-språk).
- [ ] **E2. Produktbilderna**: generisk bildbehandling — produktfoton ska kännas fristående
      (ingen "lapp på en bakgrund"). Per mall bestäms uttrycket (skuren mot bakgrundsfärg,
      mjuk skugga, ram) i form-manifestet från C2. EN körning för bild-standarden.
- [ ] **E3. Produktkortet** (delade `shop/`-komponenter, mallens tokens styr): pris-hierarki,
      luft, hover-lagret (finns) — lyft till referens-nivån. EN körning.
- [ ] **E4. Varukorgs-sidan**: jämför mot skärmdumparna — radlayout, kvantitet, summering,
      tom-läge. EN körning.
- [ ] **E5. Kassan**: fältgruppering, steg-känsla, trust-rad — mot referenserna. EN körning.
- [ ] **E6. Kundvagns-ikonen/badgen i nav** per mall (mallens uttryck, inte en generisk). EN körning.

## FAS F — UIVERSE-ELEMENTEN SOM SAKNAS (det Zivar tjatat om)

> En elementtyp åt gången, över alla ställen med samma syfte. Anatomi ur biblioteket,
> uttryck ur mallens tokens.

- [ ] **F1. Sociala knappar** (Instagram/Facebook/TikTok): idag textlänkar/enkla ikoner i
      footer — ge dem uiverse-anatomi (ikon-knappar med hover-liv), per mall-uttryck.
- [ ] **F2. Formulär-stilarna**: kontaktformulär + offertformulär — input-anatomi
      (label-float eller tydlig label, fokus-liv, validerings-uttryck). Storefront-sidan.
- [ ] **F3. Checkboxar/radios**: storefront-formulärens kryssrutor (samtycke, val) —
      riktig anatomi i stället för OS-default.
- [ ] **F4. Qty-steppern** i butiken: uiverse-anatomi (finns funktionellt — ge den liv).
- [ ] **F5. Badges/chips** (slutsåld, nyhet, kategori): enhetlig anatomi, mallens färger.
- [ ] **F6. Bokningsflödets knappar/kort** (hör ihop med fas H — bara storefront-delen här).
- [ ] **F7. Loader/skeletons** på butikssidor (bildladdning) — inte tomma hål.

## FAS G — KUND-ADMIN (goal-61 fas 3)
- [ ] G1. Tooltips + fil-knapp + rad-knappar — verifiera att fas 2-primitiverna slår igenom
      (mycket är delat, troligen gratis — mät, bocka).
- [ ] G2. Kebab-/kontextmenyer där rader har åtgärder.
- [ ] G3. Toggle-utseendet (PillToggle-svepet över ShopAdmin/BloggAdmin/KursAdmin — mät).
- [ ] G4. Fil-drop-kort för bilduppladdningarna (media, varumärke).
- **Ingen v*-tagg i denna fas förrän Zivar säger "deploy".**

## FAS H — BOKNINGSFLÖDET (goal-61 fas 4)
- [ ] H1. Inventera bokningsstegen (widget-varianterna wizard/compact) — gap-lista här.
- [ ] H2. Steg-indikator + knappanatomi. EN körning.
- [ ] H3. Tid-/personalvalets kort-anatomi. EN körning.
- [ ] H4. Bekräftelse-payoff (samma ritade bock som webshopen). EN körning.

## FAS I — FRESHCUT (goal-61 fas 5, sist, minsta diff)
- [ ] I1. Closing-bandet 2.73:1 → fix + mät.
- [ ] I2. Nav-CTA 2.73:1 → fix + mät.
- [ ] I3. Piller-vs-fyrkant-motsägelsen → fix + mät.

---

## LOGG (senaste överst — körningen skriver EN rad när den bockar)
| Datum | Punkt | Commit | Verifierad hur |
|---|---|---|---|
| 2026-07-12 | A1 deploy | v1.18.0 | CI success; corevo.se/booking/superbooking/florist/freshcut = 200 |
| 2026-07-12 | A2 kundkonto-toggel | 0d0c1b0 | tsc 0, vitest 778/778 |
| 2026-07-12 | A3 sajtbyggar-rest | — | grep = 0 rester; live-rutter 404/307 = död |
| 2026-07-12 | A4 prestanda | — | live 0.08–0.98 s alla ytor; dev-kompilering var "segheten" |
