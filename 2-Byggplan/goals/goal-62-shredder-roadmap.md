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

- [x] **B1. Kontrast-roboten** ✅ `npm run kontrast` (`scripts/kontrast.mjs`). Öppnar alla 20 mallar ×
      5 sidor, mäter varje synlig textnod mot den bakgrund den FAKTISKT ligger på (foto-text
      flaggas, ljugs inte om). **RESULTAT: 151 riktiga kontrastbrott.** Två systemfel = 81 av dem:
      1. **`btn-accent`-texten följer inte accentfärgens ljushet** — mörk text på mörk accent,
         1.2–1.7:1, i **12 mallar** ("Beställ blommor", "Boka tid", "Lägg i kundvagn"). Zivars
         "texten syns inte" — här är den.
      2. **Accentguldet (#b59775) används som TEXT på ljus botten** — eyebrows, priser, sifferled,
         "Besök oss": 2.38–2.75:1 i 4+ mallar. Accentfärg ≠ textfärg.
      Övrigt: freshcut 39, linnea 31, leander 23 brott (egna körningar i B2).
- [x] **B2a. SYSTEMFEL 1: knapptexten** ✅ **0 btn-accent-brott kvar i alla 20 mallar** (151 → 95 totalt).
      TRE rotorsaker, alla mekaniskt bevisade:
      1. `.tenant-root a { color: inherit }` (specificitet 0-1-1) slog ut `.btn-accent` (0-1-0) →
         varje CTA som är en LÄNK fick sidans brödtextfärg. Knappar (`<button>`) drabbades aldrig —
         därför såg felet slumpmässigt ut. Fix: `.tenant-root a.btn-accent` tar tillbaka sin ink.
      2. `accentForeground()` GISSADE på upplevd ljushet (tröskel 0.6) → onyx korall fick vit text
         (2.83:1) fast mörk ink ger 5.4:1. Nu MÄTS båda kandidaterna med WCAG och bästa vinner.
      3. Florist-mallarnas genererade CSS satte aldrig `--color-accent-fg` → alla 13 ärvde ett
         globalt vitt. Nu räknas den ur mallens egen primary. FreshCut fick sin (guld → mörk ink,
         2.75 → 5.64:1). Linneas lera kunde ingen textfärg rädda (vit 4.25, ink 3.64) → fyllningen
         fördjupades minimalt (#B0693F → #A9653C) → 4.55:1.
- [x] **B2b. SYSTEMFEL 2: accent-som-text** ✅ **95 → 9 brott.** Ny token `--color-primary-ink`:
      mallens egen primärfärg, mörkad tills den klarar 4.5:1 mot mallens MÖRKASTE ljusa yta
      (accent-soft, inte den vita — mäts den mot vitt faller texten igenom på tonade sektioner).
      Räknas i florist-generatorn, inskriven i de 7 fasta mallarna. 44 delade regler (eyebrow,
      pris, sifferled, adress, telefon, subhero-rubrik) läser den nu i stället för `--color-primary`.
      **Ytorna behåller sin färg** — bara texten flyttade. FreshCuts guld: 2.38 → 4.67:1.
- [x] **B2. Resten av FAIL-listan** ✅ **0 KONTRASTBROTT I ALLA 20 MALLAR** (`npm run kontrast`).
      Sista rotorsaken var samma regel en gång till: `.tenant-root a { color: inherit }` (0-1-1)
      slog ut ALLA knappklasser som satt på en länk — seraphinas "Begär offert" 2.24:1, wildthistles
      band-CTA 2.21:1, elorias 2.45:1 — medan samma knapp som `<button>` var perfekt. Nu
      `:where(.tenant-root) :where(a)` (specificitet 0): oklassade länkar ärver som förut, men en
      klass som säger något om färg vinner alltid. Köpknappens fallback går via den räknade
      `--color-accent-fg` (lunarias mörkblå knapp: 1.2 → godkänd). Mallarnas bock-lista nedan är
      därmed avklarad i klump — inget per-mall-arbete återstod.
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
| 2026-07-12 | B1 kontrast-roboten | 6a1f7ae | 20 mallar × 5 sidor uppmätta → 151 riktiga brott, 2 systemfel |
| 2026-07-12 | B2a knapptexten | 8f2e0c1 | npm run kontrast: 0 btn-accent-brott i alla 20 mallar (151→95) |
| 2026-07-12 | B2b accent-som-text | 4c9a2f1 | npm run kontrast: 95 → 9 brott; 16 av 20 mallar rena |
| 2026-07-12 | B2 + I1 sista brotten | (denna) | **npm run kontrast: 0 FAIL i alla 20 mallar** |

---

## SESSIONSLOGG 2026-07-12 (Fable 5 → Opus 4.8)

**Klart denna session:** A1 (deploy v1.18.0) · A2 (kundkonto-toggeln i kundkortet) · A3 (sajtbyggar-rest
= 0) · A4 (prestanda: inget segt i prod) · B1 (kontrast-roboten) · B2a · B2b · B2 · I1 —
**151 → 0 kontrastbrott i alla 20 mallar.**
**Deployer:** v1.18.0 · v1.19.0 · v1.20.0 · v1.21.0 (alla CI-gröna, alla hostar 200).
**Väntar på Zivar:** A5 (florist-ägarens inlogg — bjuds in i kundkortets Personal-flik) ·
A6 (superkontot i `INLOGGNINGAR.md` så super-admin-ytan kan mätas).

**Nästa punkt att köra:** B3 (kontrast-roboten in i ritualen) → sedan FAS C (mall-identiteten:
divergens-mätning → form-manifest → egna sektionsövergångar per mall).

### Token-användning
Sessionen har inte haft någon exakt token-räknare exponerad för mig — jag kan inte skriva ut en
siffra jag har mätt, och tänker inte hitta på en. Det som ÄR mätbart och sant om kostnaden:
- **Störst besparing:** kontrast-roboten (`npm run kontrast`). Den ersatte det som annars hade
  blivit 20 mallar × 5 sidor × manuell ögongranskning + skärmdumpar in i kontexten. I stället
  kom ETT tal per mall tillbaka (`onyx OK`, `flora 5 FAIL`) och detaljerna stannade i en JSON-fil
  på disk. Samma teknik gjorde att tre systemfel kunde hittas på minuter i stället för att gissas.
- **Näst störst:** att fixa ROTORSAKEN i stället för symptomen. Ett `:where()` i globals.css tog
  bort 61 + 4 brott på en gång; per-mall-fixar hade krävt 20 körningar och 20 gånger så mycket
  läsning.
- **Dyraste momentet:** de tre gångerna kontrast-roboten mätte FEL (klampad punkt utanför vyn,
  foto bakom text) och hela sveppet fick köras om. Läxan står i skriptets kommentarer så nästa
  körning slipper betala den igen.
