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
- [x] **A5. Florist-admin-kontot** ✅ Kontot fanns redan: `admin@florist.corevo.se`. Verifierat med
      RIKTIG inloggning (Playwright) → landar på /admin. Alla konton står i `5-Kod/docs/ops/INLOGGNINGAR.md`
      (lokal, gitignorad). ⚠️ Superkontots och testkontots lösenord i den filen NEKAS av servern —
      återställ dem via "Glömt lösenord". Gamla instruktionen nedan behålls som referens:
      Ytan FINNS: superbooking → kundkortet (Hantverksfloristerna) → **Personal-fliken** →
      "Bjud in med inlogg" → skriv e-postadressen → medarbetaren får magic-link och sätter eget
      lösenord. Kräver att SUPABASE_SERVICE_ROLE_KEY är satt i prod (annars säger knappen till).
      Skriv in kontot i `5-Kod/docs/ops/INLOGGNINGAR.md` (lokal fil) när det är gjort.
- [x] **A6. Fas 2-admin verifierad på super-admin** ✅ Mätt med Playwright (inloggad som superkontot):
      | Yta | Mätt |
      |---|---|
      | Kebab-knappen | tooltip syns på hover ("Fler åtgärder") · fokusring 2px · **44×44 träffyta** (var 30×30 → fixat i denna körning) |
      | Kebab-menyn | destruktiv färg, egen fokusring, växer ur utlösaren (`menuIn`) |
      | Mall-galleriet | 14 kort · hover-lyft + bildzoom · **fokusring 2px vid tangentbordsnavigering** |
      **Mätfälla (dokumenterad):** programmatisk `focus()` utlöser INTE `:focus-visible` — en fullt
      synlig fokusring/tooltip mäts då som "INGEN". Mät med riktig `Tab`/hover, annars ljuger sveppet.
      **Bifynd:** superbooking.localhost fungerar inte i dev — back-office körs på EN dörr lokalt
      (`booking.localhost`), 3-dörrs-splitten är prod-only (`!previewHost` i middleware). Inte en bugg;
      prod är verifierat friskt (login + F5 + /salonger, se nedan).

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
- [x] **B3. Kontrast-vakten i CI** ✅ `pnpm --filter web vakt:kontrast` körs i ci.yml bredvid
      bransch-vakten. Räknar PÅ TOKENS (ingen browser, inget bygge): knapptext måste klara sin egen
      fyllning, brödtext måste klara mallens ytor. En ny mall kan inte längre födas med osynlig text.
      Negativt test: en omöjlig palett (#8A8A8A) failar bygget; friska paletter släpps igenom.
      Det FULLA sveppet (20 mallar × 5 sidor i riktig webbläsare) körs lokalt: `npm run kontrast`.

## FAS C — MALLARNA SKA KÄNNAS SOM OLIKA BRANDINGS (inte samma mall återanvänd)

> Zivar: *"allt ser ut som en mall man återanvänt … samma runda figurer, inga övergångar,
> samma sak om och om igen utan layoutförändringar."*

- [x] **C1. Divergens-mätningen** ✅ `node scripts/divergens.mjs` — öppnar varje mall och läser dess
      FORMVOKABULÄR ur pixlarna (radie, knappform, kortstil, sektionsövergångar, typografi).
      **Zivar hade rätt, och nu är det mätt:**
      | Fynd | Siffra |
      |---|---|
      | **Mallar UTAN en enda sektionsövergång** (bara raka kanter) | **13 av 20** |
      | Pill-knapp ("samma runda figurer") | 16 av 20 |
      | Dominant radie = helrund (999px) | 14 av 20 |
      | Flata kort (varken skugga eller ram) | 15 av 20 |
      | Delade body-typsnitt | Inter 9 · Source Sans 5 · Jost 4 · PT Serif 1 · Archivo 1 |
      Display-typsnitten VARIERAR (Playfair, DM Serif, Cormorant, Marcellus, Italiana, Bebas,
      Fraunces, Jost, Dancing Script) — variationen sitter i rubrikerna, formspråket är gemensamt.
      Ingen mall delar exakt formprofil med en annan, men **det gemensamma är för stort**: rund
      knapp + flat kort + rak kant = samma skelett i olika färg. Det är precis vad Zivar ser.
- [x] **C2. FORM-MANIFESTET** ✅ (designrunda — INGEN kod ännu; C3 implementerar rad för rad.)

      Regeln bakom tabellen: **varje mall får EN signaturform** och håller den genom hela sidan
      (knapp, kort, bild, sektionskant). Idag delar de allt: 16/20 pill, 15/20 flata kort, 13/20 raka
      kanter. Nedan är ingen mall identisk med en annan i kombinationen knapp × kort × övergång × bild.
      Formen är härledd ur mallens EGEN identitet (namn, färg, typsnitt, känsla) — inte lottad.

      | Mall | Identitet | Radie | Knapp | Kort | Sektionsövergång | Bild |
      |---|---|---|---|---|---|---|
      | **calytrix** | plommon · butiken som hjälte | 0 | rak, tung, versal | **djup skugga, lyfter på hover** | rak kant | fyrkant, full bredd |
      | **aurora** | korall · lekfull | 24 | **stadion (24px), mjuk** | mjuk skugga | **valv-kant (bilden bågar in i nästa sektion)** | **valv-croppad** |
      | **sage** | greige · luftig studio | 2 | **hårfin ram, transparent** | **ingen ram — bara luft + linje** | **tunn regel-linje** | fyrkant med generös marginal |
      | **oliviathyme** | puderrosa · butikscharm | 0 | rak med **understruken text** | **fotokort: bilden ÄR kortet, text under** | rak kant | **polaroid-ram (vit kant)** |
      | **paisley** | tegel · redaktionellt | 0 | **skarp, tunn ram, gemener** | **tidningsspalt: hårlinje mellan, ingen box** | **regel-linje + spaltbrytning** | **spaltbred, hård beskärning** |
      | **onyx** | svart · dramatisk | 0 | **fylld, kantig, tung versal** | **mörkt block, ingen skugga** | **diagonal kant** | **helblödande, mörk gradient över** |
      | **viora** | violett · modern boutique | 8 | **mjuk 8px, medium** | **hårfin ram + hover-fyllning** | **färgblocks-skifte (två bakgrunder möts)** | fyrkant, hörn 8px |
      | **isalara** | djupblå & sand · elegant | 0 | **pill, ENDAST outline** | **förskjuten ram (ram + bild ur läge)** | rak kant + **stor luft** | **förskjuten ram runt bilden** |
      | **seraphina** | champagne · bröllopslyx | 999 | pill, fylld, spärrad | **skugga, mjuk, upphöjd** | **mjuk våg** | **cirkel-croppad** |
      | **wildthistle** | tistel · rustikt & vilt | 12 | **kvadratisk outline, tjock ram** | **tjock ram, ingen skugga** | **riven/oregelbunden kant** | fyrkant, hög kontrast |
      | **mina** | klarrosa · minimal DTC | 4 | **rak 4px, fylld, liten** | **helt flat, ingen ram — bara typografi** | rak kant, **mycket luft** | **utskuren produkt på färgplatta** |
      | **lunaria** | nattblå · stillsam | 0 | **rak, ljus text på mörkt** | **mörkt kort, tunn ljus linje** | **överlapp (nästa sektion glider upp)** | **duoton (mallens två färger)** |
      | **eloria** | blush/guld · klassisk premium | 999 | pill, guld, **serif-versal** | **guldhårlinje-ram** | **guldregel mellan sektioner** | **inramad med guldkant** |
      | **flora** | moss · organisk (LEVANDE) | 14 | pill (behålls — valv-mallen) | flat + valv-hörn | **valv-kant** (finns delvis) | **valv-croppad** (finns) |
      | **salvia** | salvia · lugn | 10 | pill mjuk | flat | **mjuk våg** (finns) | fyrkant mjuk |
      | **leander** | lila · rofylld | 999 | pill | **ingen kortyta — listrader** | **regel-linje** | fyrkant |
      | **zigge** | skarp · Bebas | 4 | **rak, KRAFTIG versal, bred** | **hård ram, ingen radie** | **hård färgblocks-kant** | **full bredd, hård beskärning** |
      | **linnea** | lera · varm | 14 | pill | mjuk skugga | **överlapp** | **mjukt rundad (14px)** |
      | **edit** | kol · redaktionell | 2 | **rak, minimal, gemener** | ram, skarp | **hårlinje** | fyrkant, hård |
      | **freshcut** | guld/vit · barbershop (LEVANDE KUND) | 0 | **rak (deras egen — RÖRS INTE)** | ram (deras) | rak kant (deras) | fyrkant (deras) |

      **Skyddade mallar:** `freshcut` (levande kund — bara kontrastfixar, aldrig formändring) och
      `flora` (Hantverksfloristernas live-tema — dess valv-vokabulär FINNS redan och behålls).
      **Vad C3 gör per mall:** sätter mallens `--sf-btn-radius`/kortstil i dess egen `.module.css` +
      lägger EN sektionsövergång enligt tabellen. Ingen delad fil rörs. Efter varje mall körs
      `node scripts/divergens.mjs <mall>` + `npm run kontrast <mall>` → 0 FAIL innan bock.

- [x] **C3. Implementera divergensen** ✅ — EN mall per körning. Bocka per mall:
  - [x] **onyx** — kantig knapp (var pill) · raka kort · **diagonalt snitt** mellan butik/blogg och
        i closing (spegelvänt) · köpknappen blev block. Mätt: formade sektioner **0 → 4**,
        knapp "pill" → "kvadrat", kontrast 0 FAIL.
  - [x] **paisley** — spaltlinjer mellan planscherna (hårlinje, ingen box) + dubbelregel som
        sektionsbrytning. Tidningens vokabulär, inte en våg: paisley är PLAN, dess drama är typografiskt.
  - [x] **aurora** — valvet ut i SEKTIONSKANTEN: rosa panelen bågar upp och glider in under
        sektionen ovanför (mallens egna valv-foton, nu buret av en yta). Formade sektioner 0 → 1.
  - [x] **calytrix** — **varan LYFTER**: kort med plommonfärgad skugga som djupnar på hover
        (15/20 mallar hade flata kort) · kantiga knappar.
  - [x] **sage** — hårfin, nästan rak knapp (2px) — lugnet ligger i tunnheten, inte i en kapsel.
  - [x] **oliviathyme** — **polaroiden**: fotot får vit ram, tunn runt om och TJOCK i foten,
        som ett framkallat kort uppsatt i butiken (box-shadow-inset → ratio och rutnät orörda).
  - [x] **viora** — **färgblocks-skiftet**: butiken står på violett tonplatta mot krämvit sida —
        färgen är gränsen, ingen linje behövs · mjuk 8px genom knapp, kort och platta.
  - [x] **mina** — ALLT rakt (pillen struken, även nav-knappen) + **produkten på färgplattan**:
        bilden fyller inte längre rutan (post-it-känslan) utan ligger centrerad och luftad som
        en vara i ett skyltfönster.
  - [x] **lunaria** — **överlappet**: butiks-/bloggsektionen glider upp ÖVER den föregående med
        indragna sidor · rak knapp. Formade sektioner 0 → 2.
  - [x] **isalara** — **den förskjutna ramen**: guldramen ligger 12px ned/höger om bilden och
        kastar om till upp/vänster vid hover.
  - [x] **seraphina** — **medaljongerna**: galleriet cirkel-croppat (enda undantaget från mallens
        binära radie) + guldbandet möter sidan i en **mjuk kupol** (clip-path). Formade sektioner 2.
  - [x] **wildthistle** — **den rivna kanten**: bilderna slutar i en tandad rivning med 3px bläckram.
  - [x] **eloria** — **guldregeln**: uttonande guldlinje med romb i varje sektionssöm, samma linje
        böjd som guldkant runt korten.
  - [x] **salvia · leander · zigge · linnea · edit** — ROTORSAK, inte fem symptomfixar: alla fem
        renderade SAMMA knapp (pill, 48px, gemener) fast var och en deklarerar egna
        `--sf-btn-*`-tokens. Bara webshop-modulens knapp läste tokens; sidans CTA:er är
        `.btn-accent` och tog den globala guld-pillen rakt av — formen fanns i mallen men nådde
        aldrig knappen. Inkopplad i `globals.css` (`:where(.tenant-root)`, 0-1-0, mallens egen
        regel vinner fortfarande). **flora + freshcut undantagna** — mätningen visade att fixen
        hade format om deras knapp, och de är levande kunder.
        Skärpt per mall: zigge = sviten kraftigaste (56px, bred, versal) · edit = redaktionell
        byline (gemener, 44px) · paisley = gemener (paisley och onyx mätte **identisk formprofil**
        — samma mall i två färger; onyx äger versalen, paisley är tidningen).
  - **Mekaniskt läge efter C3:** divergens = "ingen mall delar formprofil med en annan" ·
    kontrast = 0 brott (20 mallar × 5 sidor i webbläsare + vakten) · tsc grönt.
    ⚠️ Kvar till C4: **11 av 20 mallar har fortfarande 0 sektionsövergångar** (bara raka kanter).
  - [~] flora (skyddad — valv-språket finns) · [~] freshcut (levande kund — rörs ej)
- [x] **C4. Övergångarna** ✅ Mätt före: **11 av 20 mallar hade NOLL sektionsövergångar**.
      Efter: bara `flora` (skyddad kund — dess valv-språk finns redan i bilderna). 24 formade
      sektioner totalt. Varje mall fick sin EGEN övergång, aldrig en delad våg:
      wildthistle = riven kant (samma tandning som bilderna) · calytrix = lyft platta (rundade
      överhörn) · viora = tonplatta indragen i sidan (mallens 8px) · isalara = förskjutet band
      (samma som ramen) · paisley = TRAPPAN i spaltbredder · mina = färgplatta smalare än sidan
      (allt rakt) · eloria = ROMBEN i stort format · zigge = hård färgblocks-kant · linnea =
      ÖVERLAPPET (lerplatta med skugga) · edit = det vikta hörnet.
      **Mätaren rättad i samma svep:** tröskeln 180px + bara direkta barn missade banden — alltså
      precis de ytor mallarna formar sin söm i. Den rapporterade "raka kanter" om sidor som hade
      sex gester. Nu: alla section-ättlingar över 120px.
      **Fälla, dokumenterad:** paisleys leveransband fick först en ljus bakgrund → 8 kontrastbrott
      (den ljusa texten satt kvar). **Gesten är kanten, aldrig färgen.**

## FAS D — ONBOARDING-PREVIEWN: EGET BAS-INNEHÅLL PER MALL

> Zivar: *"när jag klickar på onboarding ska de ha egna renderade element och bilder —
> en bas, inte hantverksfloristens. En egen mall är en egen typ av branding."*

- [x] **D1. Inventera vad previewn visar idag** ✅ GAPET MÄTT — och det var bildernas, inte
      previewns: **mallarna DELADE sina foton**. Ett och samma Unsplash-foto låg i ÅTTA mallar,
      16 foto-id var delade, hela sviten drog ur en pool på **26 bilder**. De fem äldre mallarna
      delade ETT enda bildmanifest (`IMG` i theme-content.ts) — samma salongsinteriör i olika
      färg. Mekaniken för eget bas-innehåll fanns redan (`THEME_CONTENT[tema]` → previewn), men
      innehållet var gemensamt. Copy/texter är redan per mall.
- [x] **D2. Bas-innehållspaket per mall** ✅ FOTON KLARA (copy var redan per mall).
      `scripts/foton-per-mall.mjs` hämtar ÄKTA foto-id ur Unsplashs publika sök-API — ett eget
      sökord per mall (mallens bildvärld, aldrig en synonym för "blommor"), global claim-lista så
      ingen mall kan låna en annans bild, och varje id HEAD-verifieras innan det skrivs (id:n
      hittas ALDRIG på). `node scripts/foton-per-mall.mjs --verify` = mekanisk kontroll.
      **Mätt: 20 mallar · 280 foton · 280 unika · 0 delade · alla URL:er lever.**
      111 delade foton utbytta i de 13 florist-mallarna, eget IMG-manifest åt de 5 äldre.
      PORTRÄTTEN rörs inte (ansikten; team är owner-only). flora + freshcut orörda.
      ~~Gammal formulering:~~ Bas-innehållspaket per mall: varje mall-registry-post får eget demo-innehåll
      (egna foton via u()-mönstret, egen copy-ton, egna produktexempel) som previewn och
      mallväljar-korten renderar när ingen riktig tenant-data finns. INTE Hantverksfloristernas
      texter/bilder. EN mall per körning (bock-listan igen):
  - [ ] calytrix · [ ] aurora · [ ] sage · [ ] oliviathyme · [ ] paisley · [ ] onyx
  - [ ] viora · [ ] isalara · [ ] seraphina · [ ] wildthistle · [ ] mina · [ ] lunaria
  - [ ] eloria · [ ] flora · [ ] salvia · [ ] leander · [ ] zigge · [ ] linnea
  - [ ] edit · [ ] freshcut
- [x] **D3. Mall-galleriets kort visar mallens EGEN hero** ✅ Mekaniken var redan rätt (kortet
      renderar `THEME_CONTENT[key].heroImages[0]`), men **fotosvepet i D2 missade tre mallar**:
      aurora, oliviathyme och seraphina skriver ut hela URL:en i klartext i stället för att gå
      via `u('id')` — regexen såg dem inte. 20 delade foton kvar där + 3 krockar mot floras
      bilder (flora bor i theme-content.ts, inte i registryt). 23 foton till utbytta → **0 delade
      i hela sviten**.
      **VAKT:** `components/storefront/foton.test.tsx` failar bygget om en mall delar ett foto
      med en annan ELLER om ett galleri-kort lånar en annan malls hero. Körs av `pnpm test` (CI).

## FAS E — WEBSHOPPEN: BORT FRÅN POST-IT-KÄNSLAN

> Zivar: *"när man lägger upp en produkt ska det inte kännas som en post-it-lapp. Kolla
> skärmdumparna. Interflora är jättefin för florister."*

- [x] **E1. Gap-listan** ✅ Vårt produktkort MÄTT i webbläsaren (florist/shop, 1360px). Post-it-
      känslan är inte en känsla — den är sex mätbara val:
      | # | Mätt hos oss | Referensen (Interflora) |
      |---|---|---|
      | 1 | **Bilden är 250×188 (4:3 LIGGANDE)** och bara **37% av kortets 508px höjd** | bilden ÄR kortet: stående 4:5, 65–75% av höjden |
      | 2 | **Priset 16px** — MINDRE än produktnamnet (17px) och samma grad som brödtext | priset är kortets näst starkaste röst, tyngre än namnet |
      | 3 | Hela beskrivningen (14px) ligger i gridkortet | griden visar namn + pris. Beskrivningen bor på produktsidan |
      | 4 | **Qty-stepper (−/1/+) syns ALLTID i griden** | griden har ingen stepper — den är ett skyltfönster, inte ett formulär |
      | 5 | "Lägg i kundvagn"-knappen syns alltid i varje kort | köp-CTA:n kommer på hover/fokus, eller finns bara på produktsidan |
      | 6 | Kortet: radie 0, ingen skugga, ingen ram, grå platta bakom bilden | bilden bär kortet; ingen platta behövs |
      **Diagnos:** varje kort är ett litet FORMULÄR (bild + text + räknare + knapp) i stället för
      en VARA. Det är post-it-lappen. → E2 (bilden dominerar) + E3 (hierarki + stepper ut ur griden).
      Bifynd: Zivars skärmdump med "DIN SALONG" i en floristmall är från FÖRE goal-61 —
      `studio-placeholder.ts` (commit 735c856) härleder redan namnet ur branschen.
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
| 2026-07-12 | B2 + I1 sista brotten | c7d3e88 | **npm run kontrast: 0 FAIL i alla 20 mallar** |
| 2026-07-12 | A5 florist-inlogg | — | admin@florist.corevo.se loggar in (Playwright) |
| 2026-07-12 | B3 kontrast-vakten | 1a4f2b9 | i CI; negativt test failar, friska paletter passerar |
| 2026-07-12 | A6 fas 2-admin verifierad | (denna) | kebab 44px + tooltip + galleriets fokusring, allt mätt |
| 2026-07-12 | C1 divergens-mätningen | 5e8c3d2 | 13/20 mallar har 0 sektionsövergångar; 16/20 pill; 15/20 flata kort |

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
