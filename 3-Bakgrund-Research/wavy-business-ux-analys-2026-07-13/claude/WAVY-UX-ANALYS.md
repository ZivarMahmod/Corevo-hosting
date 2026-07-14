# Wavy Business — Djup UX- och systemanalys

**Datum:** 2026-07-13
**Analyserad av:** Claude (Cowork), på uppdrag av Zivar
**Underlag:** Live-genomgång av ett skarpt Wavy Business-konto (barbershop, 4 anställda, ~5 400 bokningar/år) med kundens uttryckliga tillstånd.
**Metod:** Interaktiv utforskning i webbläsaren, teknisk inspektion av sidan, testbokningar på datum efter 2027-01-01 (alla städade och verifierade borttagna), inga kunddata dokumenterade.

**Märkning i rapporten:**
- ✅ = verifierad observation (själv testad/sedd)
- 🔎 = rimlig slutsats utifrån observationer
- ⛔ = gick inte att testa säkert / kräver ytterligare tillstånd

---

## 1. Sammanfattning: varför Wavy upplevs enkelt

Wavy är enkelt av ett huvudskäl: **hela produkten är en enda skärm — kalendern.**

Allt en frisör gör under en arbetsdag (boka, flytta, avboka, blockera tid, hitta kund, se historik) sker direkt i kalendervyn, utan att någonsin navigera bort. Administration (tjänster, personal, öppettider) är bortflyttad till en inställningssektion man besöker någon gång i månaden.

De fem bärande besluten:

1. **En skärm, noll navigering för kärnjobbet.** Kalendern ÄR appen. Ingen meny, ingen dashboard, inga moduler.
2. **Behandling först, sedan tid.** Flödet börjar med *vad* kunden vill ha — då kan systemet visa exakt *var* det får plats ("Visa bokningsbar tid" ritar alla lediga luckor som klickbara chips). Felbokningar blir nästan omöjliga.
3. **En mekanism återanvänds för många behov.** "Blockera tid" täcker raster, frånvaro, avvikande arbetstider och stängda dagar. Ingen schemamodul, ingen frånvaromodul.
4. **Realtid utan spara-knappar.** Meteor/WebSocket gör att allt som görs syns direkt i kalendern (även på kollegors skärmar 🔎). Inga laddningssidor, inga "spara"-moment i det dagliga.
5. **Domänspråk, inte systemspråk.** Knappar som "+4 veckor", relativa etiketter ("+25 veckor"), stjärnan som visar om kunden valt en specifik frisör. Systemet tänker som en salong tänker.

Kombinationen ger extremt låg kognitiv belastning: inget att komma ihåg, inget att leta efter, inget att kunna i förväg.

---

## 2. Systemets informationsarkitektur

```
Wavy Business (business.itswavy.com)
│
├── KALENDERN (/calendar) ← startsida och 95 % av användningen
│   ├── Vänster ikonrad (3 ikoner, alltid synlig)
│   │   ├── ⚙ Inställningar
│   │   ├── 💬 Support-chatt (Intercom: bot + artiklar + människa)
│   │   └── 🗑 Raderade bokningar (ångra-vy, 30 dagar)
│   ├── "VÄLJ BEHANDLING"-panel (bokningens startpunkt)
│   ├── Personalrad (namn i egen signaturfont + färg = filter-toggles)
│   ├── Minikalender (oändlig scroll, relativa veckor, +4…+9-knappar, Idag)
│   └── Huvudyta: dagvy (kolumn per person) eller veckovy (7 dagar, personal överlagrad)
│
└── INSTÄLLNINGAR (8 flikar, besöks sällan)
    ├── Presentation   → kundappens utseende + SMS-avsändare (live-mockup)
    ├── Personal       → personaltabell (namn, färg, notiser, elev)
    ├── Behandlingar   → kategorier + tjänster (pris, längd, vem som utför)
    ├── Öppettider     → EN tabell för hela salongen + stängda dagar
    ├── Bokningsbarhet → hur kunder får självboka (3 nivåer + gränser)
    ├── Statistik      → 5 rapporter (frekvens, lojalitet, beläggning, SMS, pris)
    ├── Konton & säkerhet → inloggningsnummer, Zettle, CSV-export
    └── Om Wavy        → version, support, villkor, GDPR
```

**Navigationsdjup:** ✅ max 2 nivåer. Varje daglig funktion: 0–1 klick bort. Varje admin-funktion: 2 klick bort (⚙ → flik).

**Kunddata har ingen egen vy.** ✅ Kundsök/kundkort bor *inne i bokningsflödet* — där man faktiskt behöver dem. Det finns inget "kundregister" att administrera i vardagen (export finns under Konton & säkerhet).

---

## 3. Fullständig funktionskarta

### Kalendern (dagligt arbete)
| Funktion | Var | Status |
|---|---|---|
| Skapa bokning | VÄLJ BEHANDLING → tjänst → lucka → kund → BOKA | ✅ testad |
| Visa lediga tider för viss tjänst | Checkbox "Visa bokningsbar tid" | ✅ testad |
| Flytta bokning (tid) | Dra & släpp + bekräfta | ✅ testad |
| Flytta bokning (mellan personal) | Dra i sidled + bekräfta ("från John till Aziz") | ✅ testad |
| Avboka | Bokning → AVBOKA → JA | ✅ testad |
| Ångra avbokning | 🗑 → ÅTERSTÄLL (30 dagars logg) | ✅ sedd, ej testad återställning |
| Blockera tid (rast/frånvaro/avvikelse) | VÄLJ BEHANDLING → Blockera tid → lucka | ✅ testad |
| Återkommande blockering | Upprepning: dag/vardag/vecka/varannan/årligen | ✅ sedd |
| Hitta kund | Kundsteget i bokningsflödet, filter-vid-skrivning | ✅ testad |
| Skapa kund | Samma formulär som sök (3 fält, endast namn krävs) | ✅ testad |
| Redigera/dölja kund | Pennikon på kundkort → Dölj kund | ✅ testad |
| Spärra kund från självbokning | Kundkort: "Kunden får boka själv" av/på | ✅ sedd |
| Kundhistorik | Bokningsdialog: BESÖK (n) med pris, personal, källa, tidsstämpel | ✅ sedd |
| Anteckningar | 2 fält: kundinfo + besöksanteckning ("syns ej för kund") | ✅ sedd |
| SMS-logg per bokning | "SKICKADE SMS" i bokningsdialogen | ✅ sedd |
| Stjärnmärkning | Toggle i bokningsdialog (= kunden valde specifik frisör) | ✅ testad |
| Filtrera på personal | Klick på namn i personalraden | ✅ testad |
| Dag ↔ veckovy | Minikalender: klick datum = dag, klick veckorad = vecka | ✅ testad |
| Hoppa X veckor framåt | +4…+9-knappar (ombokningsmönstret "om 4 veckor?") | ✅ testad |

### Inställningar (sällan-arbete)
| Funktion | Status |
|---|---|
| Tjänster: pris, längd, vem som utför, kundbeskrivning, synlig i kundapp | ✅ sedd (rad-expansion) |
| Kategorier + drag-and-drop-sortering av tjänster | ✅ sedd |
| Personal: lägg till, färg, notisinställning, elevmarkering | ✅ sedd |
| Öppettider per veckodag + stängt + minsta framförhållning (minuter) | ✅ sedd |
| Självbokning: 3 nivåer, månader framåt (6), avbokningsgräns (1 dag) + automatisk påminnelse | ✅ sedd |
| Statistik: bokningsfrekvens, kundlojalitet, beläggningsgrad, SMS, prissättning | ✅ sedd |
| Inloggning via mobilnummer (lista över behöriga) | ✅ sedd |
| Zettle-kassaintegration (knapp "Anslut") | ✅ sedd, ⛔ ej testad (extern integration) |
| CSV-export av kundregister + bokningar | ✅ sedd, ⛔ ej klickad (laddar ner personuppgifter) |

### Finns INTE (verifierat frånvarande i UI)
- ❌ Återkommande **kund**bokningar (upprepning finns bara för blockeringar) ✅
- ❌ Flera behandlingar i samma bokning — kombinationer säljs som färdiga paket-tjänster ("Herrklippning + skägg + varm handduk") ✅
- ❌ Egen kassa/betalflöde i appen — betalning är helt delegerad till Zettle 🔎
- ❌ Resurser/behandlingsrum ✅
- ❌ Roller & behörigheter — alla inloggade ser och kan allt 🔎 (inget rollval någonstans)
- ❌ Sökbar kundregister-sida ✅

---

## 4. Genomgång av varje centralt arbetsflöde

### 4.1 Skapa bokning (befintlig kund)
**Startpunkt:** Kalendern, alltid.

1. Klick **VÄLJ BEHANDLING** → hela tjänstelistan fälls ut (kategori, namn, längd, pris — allt synligt direkt)
2. Klick på tjänst → panelen visar vald tjänst som "chip" + checkbox "Visa bokningsbar tid"
3. (Valfritt) Bocka i **Visa bokningsbar tid** → kalendern ritar varje ledig lucka som en klickbar tidschip per frisör, korrekt anpassad efter öppettider, blockeringar och tjänstens längd
4. Klick på lucka → bokningsdialog öppnas, **färgtonad i frisörens färg**, med tid/dag/tjänst redan satta
5. Klick på kund i listan (eller skriv för att filtrera — listan filtreras live från första tangenttryck)
6. Klick **BOKA** → dialogen stängs, bokningen ligger i kalendern direkt

**Klick:** 5 (utan sökning). **Obligatoriska beslut:** 3 (tjänst, lucka, kund). **Tangenttryck:** 0.
**Standardvärden:** längd + pris från tjänsten, personal + tid från luckan, inga notiser utan telefonnummer.
**Automatiserat:** krockkontroll (bara lediga luckor visas), sluttid, prissättning, "Kundens första besök!"-flagga.

### 4.2 Skapa bokning (ny kund)
Steg 1–4 som ovan. I kundsteget: skriv förnamn (+ ev. efternamn, mobil) → **LÄGG TILL** → BOKA.
**Klick:** 6 + textinmatning. ✅ Endast namn krävs — mobilnummer är valfritt (märkt "används för att skicka SMS"). Sök och nyregistrering är **samma formulär**: får du ingen träff skriver du bara klart och trycker LÄGG TILL. Ingen separat "skapa kund"-sida existerar.

### 4.3 Flytta bokning
- **Inom samma frisör:** dra bokningen till ny tid → modal: "Vill du flytta bokningen till mån 04/1 kl 11:00?" → FLYTTA. ✅ **1 dragning + 1 klick.**
- **Till annan frisör:** dra i sidled → modalen säger uttryckligen "…från John till Aziz?" och spök-bokningen byter till mottagarens färg redan under dragningen. ✅
- AVBRYT återställer allt exakt. ✅
- Stjärnlogiken (avsnitt 7) talar om vilka bokningar som är "säkra" att flytta mellan frisörer.

### 4.4 Avboka
Klick på bokning → **AVBOKA** (nere till vänster, rödmarkerad) → "Vill du verkligen avboka?" → **JA, AVBOKA!** ✅ = 3 klick.
Avbokningen hamnar i **Raderade bokningar** (🗑-ikonen): datum, när, **vem** (Kunden/Salongen), tjänst, personal, kund — med **ÅTERSTÄLL-knapp per rad i 30 dagar**. ✅ Misstag är alltså billiga.

### 4.5 Blockera tid (rast, frånvaro, avvikande arbetstid)
1. VÄLJ BEHANDLING → **Blockera tid** (egen "Blockers"-kategori, 60 min default, märkt "ej bokningsbar av kund")
2. Klick i kalendern → dialog med SPARA/AVBRYT, beskrivning (default "Blockerad", syns ej för kund) och **Upprepning:** Ingen / Varje dag / Varje vardag / Varje vecka / Varannan vecka / Detta datum varje år ✅
3. SPARA. Blockeringen ritas med randigt mönster — omöjlig att förväxla med bokning. ✅

**Redigering av serie:** rubriken "ÄNDRA UPPREPNING — *från denna dag och framåt i tiden*" ✅ — elegant lösning på det klassiska "ändra hela serien eller bara denna?"-problemet: historiken lämnas alltid orörd.
**Radering:** RADERA DENNA → bekräftelse. ✅

### 4.6 Arbetstider
✅ Öppettider sätts **en gång för hela salongen** (en rad per veckodag + STÄNGT-kryss). Sidans egen text förklarar modellen: *"Avvikelser görs per person direkt i kalendern, på samma sätt som en bokning."* Personlig schemaläggning = återkommande blockeringar. Ingen schemamodul existerar.

### 4.7 Kassa/betalning
🔎 Ingen betalning sker i Wavy. Priset följer med bokningen (visas i historiken), och kassan är Zettle via integration (Konton & säkerhet + hjälpartikel "Zettle integration"). Wavy har valt bort hela kassadomänen.

### 4.8 Statistik
✅ 5 färdiga rapporter utan konfiguration: Bokningsfrekvens (per år, app-bokningar vs totalt), Kundlojalitet, Beläggningsgrad, SMS, Prissättning + fördelning av bokningar per timme på dygnet. Inga byggbara rapporter, inga filter — färdiga svar på salongens faktiska frågor.

---

## 5. Klick- och steganalys

| Uppgift | Klick | Tangenttryck | Beslut | Kommentar |
|---|---|---|---|---|
| Boka befintlig kund, idag | **5** | 0 | 3 | Tjänst → lucka → kund → BOKA |
| Boka befintlig kund, om 4 veckor | **6** | 0 | 4 | +4-knappen = 1 extra klick |
| Boka ny kund | 6 | ~15–25 | 3 | Namn räcker; mobil valfritt |
| Flytta bokning inom dag | **2** (1 drag + 1) | 0 | 1 | Bekräftelsemodal |
| Flytta till annan frisör | 2 | 0 | 1 | Modal namnger båda |
| Avboka | **3** | 0 | 1 | Med ångra i 30 dagar |
| Återställa avbokad | 2 | 0 | 1 | 🗑 → ÅTERSTÄLL |
| Blockera lunch varje dag | **4** | 0 | 2 | Inkl. upprepningsval |
| Byta dag som visas | 1 | 0 | 1 | Minikalender alltid synlig |
| Dag ↔ vecka | 1 | 0 | 1 | Datum vs veckorad |
| Filtrera en frisör | 1 | 0 | 1 | Klick på namnet |
| Se kunds historik | 1 | 0 | 0 | Klick på valfri bokning |
| Höja pris på tjänst | 4–5 | ~4 | 1 | ⚙ → Behandlingar → rad → fält (+ publicera) |

**Jämförpunkt:** branschtypiska system kräver ofta 8–15 klick och 2–4 sidbyten för en bokning. Wavys hela boknings­flöde sker i **ett** sammanhang utan sidbyte. 🔎

---

## 6. Komponent- och interaktionsmönster

✅ Observerade mönster:

- **En dialog, två steg, samma yta.** Bokningsdialogen byter innehåll (kundval → bekräftelse/detalj) i stället för att stapla nya fönster. Samma dialog används för både skapa och visa bokning — man lär sig EN yta.
- **Färg = person, överallt.** Varje frisör har egen färg + signaturtypsnitt. Bokningschips, dialoghuvuden, spökbilder vid drag, veckovyn — allt färgkodas konsekvent. Man ser på en tiondels sekund vems bokning något är.
- **Chips med tre informationsbitar:** starttid (hörnet), kund + tjänst (raden), sluttid (nederhörnet), stjärna (hörnet). Ingen övrig dekoration.
- **Randigt mönster = blockerad tid.** Textur (inte bara färg) skiljer blockeringar från bokningar — funkar även för färgblinda.
- **Bekräfta bara det oåterkalleliga.** Skapa bokning: ingen bekräftelse (lätt att ångra). Flytta/avboka/dölj: modal med exakt beskrivning av vad som händer ("…från John till Aziz?"). Rätt friktion på rätt ställe.
- **Flytande etiketter i formulär** (label glider upp när fält fylls), **filter-vid-skrivning** i kundsök.
- **Inline-förklaringar i vardagsspråk** i stället för hjälpikoner: "(syns ej för kund)", "används för att skicka SMS", "(Behandlingen är ej bokningsbar av kund)".
- **Draft/publish i inställningar:** PUBLICERA ÄNDRINGAR-knappen är inaktiv tills något ändrats — admin­ändringar är medvetna, kalenderändringar är omedelbara. Två olika mentala modeller för två olika risknivåer.
- **Intercom-widget** som enda hjälpsystem: bot, sökbara artiklar ("Så funkar Stjärnan", "Zettle integration", "GDPR-riktlinjer för frisörer") och mänsklig support i samma bubbla.

---

## 7. Kalenderns beteende och logik

- **Dagvy:** en kolumn per frisör, tidslinje 08:00→. **Veckovy:** 7 dagkolumner där alla frisörers bokningar överlagras (färgen bär identiteten). Helger/stängda dagar avtonade. ✅
- **Minikalendern är navigationsnavet:** oändligt scrollbar veckolista med *relativa* veckoetiketter ("v.29 **0 v**", "+1 v", "+25 v"). Klick på datum = dagvy; klick på veckoraden = veckovy. Månadsnamn visas som overlay medan man scrollar. ✅
- **"+4 … +9"-knapparna hoppar hela veckor** — exakt ombokningssamtalet "ses vi om 4 veckor?". Idag-knappen tar alltid hem en. ✅
- **Stjärnan** (verifierad via hjälpartikeln): kund som själv-bokat och **valt specifik frisör** får stjärna — då ser kunden vem som utför behandlingen. Ingen stjärna = kunden valde "Alla" → salongen kan **fritt flytta bokningen mellan frisörer** utan att kunden märker det. En boolean som kodar ombokningsfrihet. ✅
- **Bokningskälla + tidsstämpel** loggas på varje bokning ("Bokad på salongen, 2026-07-13 20:55:59" / avbokad av Kunden respektive Salongen) och relativ tid framåt ("+25 veckor"). ✅
- **Realtid:** Meteor DDP över WebSocket (status "connected" ✅). Datumbyten sker utan några nätverksanrop (prenumererad data finns redan i klienten) — därför känns navigeringen omedelbar. Inga spara-knappar, inga spinners i kärnflödet.
- **Snappning till 15 min** vid blockering (klick på 09:20-höjd gav 09:15). ✅

---

## 8. Formulär, standardvärden och automatisering

✅ Systemets formulär är minimala och förvalen aggressiva:

| Situation | Standardvärde |
|---|---|
| Ny bokning | Längd + pris från tjänsten; personal + starttid från luckan |
| Ny kund | Endast förnamn krävs; utan mobil ⇒ inga SMS ⇒ ofarligt default |
| Blockering | 60 min, beskrivning "Blockerad", upprepning "Ingen" |
| Självbokning | 6 månader framåt, avbokningsgräns 1 dag, påminnelse automatisk |
| Öppettider | Salongsgemensamma; "närmaste bokningsbara tid" 0 min |
| Ny bokning i kundapp 🔎 | Stjärnlogik sätts av kundens eget val av frisör |

**Automatiserat utan att fråga:** krockförhindring, sluttidsberäkning, prisberäkning, första-besök-flagga, SMS-påminnelse före avbokningsgränsen, besökshistorik, avbokningslogg, källspårning.

**Anmärkning:** inga obligatoriska fält utöver det absolut nödvändiga någonstans i det dagliga flödet. Systemet frågar aldrig efter data det inte behöver.

---

## 9. Felhantering och återställning

✅ Wavys strategi är **förhindra > varna > ångra**:

1. **Förhindra:** "Visa bokningsbar tid" gör dubbelbokningar nästan omöjliga; klick på tom yta utan vald behandling ger ingen tyst miss — VÄLJ BEHANDLING-panelen **blinkar blått** och pekar ut nästa steg; luckchips finns bara där tjänsten faktiskt får plats.
2. **Varna:** bekräftelsemodaler endast vid flytt, avbokning och döljning — alltid med konkret beskrivning av konsekvensen, aldrig generiskt "Är du säker?". Knappspråket är mänskligt: "NEJ VÄNTA AVBRYT!" / "JA, DÖLJ KUNDEN".
3. **Ångra:** Raderade bokningar-loggen (30 dagar, ÅTERSTÄLL per rad); kunder döljs i stället för raderas ("Bokningar och historik för kunden kommer inte att försvinna"); serieändringar gäller endast framåt i tiden.

**Svagheter:** ⛔ ingen Ctrl+Z; ✅ ingen ångra för genomförd flytt (får dras tillbaka manuellt); ✅ inga inline-valideringsmeddelanden observerade (formulären är för små för att behöva dem — men mobilnummerfältet visade heller ingen formatkontroll vid tomt värde, ej testat med felaktigt värde ⛔).

---

## 10. Mobil och responsiv UX

- ✅ Appen är en **PWA** (manifest + service worker) och distribueras även som iOS-app ("På Apple-enheter hämtar du appen Wavy Business i App Store" — Om Wavy). Android/desktop = Chrome/webben.
- ✅ CSS:en innehåller brytpunkter för 540/767/768/900/1023 px samt `prefers-reduced-motion` — gränssnittet är byggt för att vikas ner till mobil. 🔎 Kolumnerna staplas/filtreras per frisör på små skärmar (gick ej att verifiera: fönstret kunde inte krympas i den styrda sessionen ⛔).
- ✅ `user-scalable=no` i viewport — appen beter sig som en native-app (ingen pinch-zoom). Bra för app-känsla, dåligt för synsvaga (se §11).
- 🔎 Touch-först-design: stora tryckytor (bokningschips ~40 px höga, luckchips ännu större), drag & släpp, inga hover-beroenden i kärnflödet.

---

## 11. Tillgänglighet och tangentbordsanvändning

Här är Wavy **svagt** — enkelheten är mus/touch-enkelhet:

- ✅ Accessibility-trädet för kalendersidan är nästan tomt: 3 namnlösa knappar, en generisk "Calendar"-grid, inga landmärken (`nav`/`main`/ARIA-roller: 0).
- ✅ Tangentbordsnavigering fungerar inte i praktiken: efter 5 Tab-tryck landar fokus i minikalenderns scroll-div — med `outline: none`, så fokus syns inte. Bokningar kan inte nås eller öppnas med tangentbord.
- ✅ `user-scalable=no` blockerar zoom på mobil.
- ✅ Positivt: `prefers-reduced-motion` respekteras; blockeringar skiljs med mönster och inte bara färg; texten håller god kontrast i huvudflödena (ej systematiskt mätt ⛔).
- 🔎 För en frisörsalong är riskerna små i praktiken (touch-användning dominerar), men det är en juridisk exponering (EU:s tillgänglighetsdirektiv) och utestänger användare med funktionsnedsättning.

**Lärdom för oss:** kopiera INTE Wavys tillgänglighetsnivå — här kan vi vara bättre till låg kostnad (semantiska knappar, synligt fokus, Escape/Enter i dialoger).

---

## 12. Ponytail-analys — enkelt tack vare bra systemdesign

*Lins: "det bästa systemet är det som aldrig byggdes". Vad har Wavy låtit bli att bygga — och vunnit på?*

| Byggdes aldrig | Ersattes av | Effekt |
|---|---|---|
| Modulnavigering/dashboard | Kalendern som enda skärm | Noll navigationskostnad |
| Schemamodul per anställd | EN öppettidstabell + blockeringar i kalendern | En mekanism, fyra behov (rast/frånvaro/avvikelse/stängt) |
| Frånvaro-/rastmodul | Samma blockeringar | — |
| Multi-behandlingsväljare | Kombo-tjänster som egna rader ("Klippning + skägg") | Bokningsflödet förblir 1 val |
| Kundregister-modul | Sök/skapa/redigera inne i bokningsflödet | Kunddata finns där den används |
| Roller & behörigheter | Lista med inloggningsnummer | Onboarding av ny personal = 1 rad |
| Egen kassa | Zettle-integration | Slipper hela betal-/kvitto-/momsdomänen |
| Ombokningsregler/regelmotor | Stjärnan (1 boolean: valde kunden specifik frisör?) | Flyttfrihet kodad i minsta möjliga data |
| Rapportbyggare | 5 färdiga rapporter | Svarar på salongens frågor utan konfiguration |
| Hård radering + papperskorgshantering | Soft delete överallt (dölj kund, 30-dagars ångralogg) | Misstag billiga, GDPR-historik intakt |
| Bekräftelsedialog på ALLT | Bekräfta endast oåterkalleligt | Snabbhet där det är säkert, friktion där det behövs |

**Genvägar som fungerar utmärkt:** ✅ +N-veckor-knapparna, relativa veckoetiketter, "boka utan telefonnummer", färg-som-identitet, 15-minuters snappning.

**Kärninsikten:** Wavy har konsekvent valt att **koda verksamhetens vanligaste fall rakt av** och låta ovanliga fall lösas manuellt (eller inte alls) — i stället för att bygga generella motorer. Det är därför varje flöde är 3–6 klick.

---

## 13. Ponytail-debt-analys — ser enkelt ut men har inbyggda tak

*Lins: vilka av förenklingarna är medvetna skulder som förfaller när verksamheten växer?*

| Skuld | Tak — när förfaller den? | Allvar |
|---|---|---|
| Ingen rollstyrning: alla inloggade ser statistik, priser, kan ändra allt | Fler än ~5–10 anställda, kedjor, anställda som slutar i osämja | 🔴 Hög |
| En salongsgemensam öppettidstabell | Deltidare/roterande scheman ⇒ allt måste skötas som blocker-disciplin manuellt | 🟡 Medel |
| Inga återkommande kundbokningar | Stamkunds-salonger (var 4:e vecka) får boka om manuellt varje gång — mildrat av +4v-knappen | 🟡 Medel |
| Kombotjänster som SKU:er | Salonger med många kombinationsbara tjänster (färg × längd × behandling) ⇒ tjänstelistan exploderar. Funkar för barbershop med 7 tjänster | 🟡 Medel |
| Veckovyn överlagrar all personal | Blir oläslig vid >5–6 anställda | 🟡 Medel |
| En salong per konto 🔎 | Multisalong/kedja kräver flera konton utan samlad vy | 🟡 Medel |
| Meteor 2.2.4 (2021) som grund | Legacy-ramverk; rekryterings- och underhållsskuld — men osynlig för användaren | 🟢 Låg (för dem) |
| Tillgänglighet bortprioriterad (§11) | Juridiskt krav (EAA), offentliga upphandlingar | 🔴 Hög på sikt |
| AM/PM-inkonsekvens: dialoghuvudet visar "10:00 AM … 12:30 AM" (fel sluttid-visning ✅) och Öppettider visar AM/PM i övrigt svensk 24h-app | Kosmetisk bugg, skadar förtroende marginellt | 🟢 Låg |
| Ingen betalkoppling till bokning (pris ≠ betalt belopp) | Salonger som vill ha bokning→kassa→bokföring i ett | 🟡 Medel |

**Slutsats:** skulderna är *väl valda* för målgruppen (små salonger, 1–6 stolar). Nästan alla tak ligger bortom deras kärnkunds storlek. Det är disciplinerad ponytail — inte slarv. Men det visar också exakt var ett konkurrerande system kan differentiera sig utan att förlora enkelheten (roller, återkommande bokningar, multi-salong).

---

## 14. Systemets främsta styrkor

1. **En-skärms-arkitekturen** — noll navigering i vardagen.
2. **Behandling-först-flödet** med "Visa bokningsbar tid" — gör rätt sak till den enda möjliga.
3. **5-klicks-bokning, 0 tangenttryck** för befintlig kund.
4. **Drag & släpp-flytt med exakt bekräftelse** — snabbaste tänkbara ombokning.
5. **Blockeringar som universalmekanism** för all icke-bokningsbar tid, med upprepning och "endast framåt"-serieändring.
6. **Stjärnan** — genial minimal kodning av "får vi flytta den här?".
7. **30-dagars ångralogg med vem/när/varför** — trygghet utan friktion.
8. **Realtidssynk utan spara-knappar** — systemstatus alltid = verklighet.
9. **Färg + typsnitt som personidentitet** genom hela systemet.
10. **Domänspråk och mänsklig copy** ("+4 veckor", "syns ej för kund", "NEJ VÄNTA AVBRYT!").
11. **Aggressiva, ofarliga defaults** — namn räcker för att boka.
12. **Rätt friktion på rätt plats** — bekräfta bara det oåterkalleliga; publicera-modell endast i admin.

## 15. Systemets främsta svagheter

1. **Tillgänglighet nära noll** (tangentbord, skärmläsare, zoom-blockering). ✅
2. **Ingen rollstyrning** — allt eller inget för alla inloggade. 🔎
3. **Inga återkommande kundbokningar.** ✅
4. **En behandling per bokning** — paketexplosion väntar större salonger. ✅
5. **AM/PM-buggen** i bokningsdialogens huvud + tidsformats-inkonsekvens. ✅
6. **Kundsök kräver påbörjat bokningsflöde** — att bara slå upp ett telefonnummer går inte utan att låtsas boka. ✅
7. **Statistiken är låst** — inga datumintervall eller filter per frisör (såvitt observerat ✅).
8. **Veckovyn skalar dåligt** med antal anställda. ✅
9. **Ingen koppling bokning→betalning** — priset är information, inte transaktion. 🔎
10. **Åldrande teknisk grund** (Meteor 2.2.4). ✅

---

## 16. Generella UX-principer vi kan ta med oss

1. **Optimera för frekvens:** det som görs 50 ggr/dag får kosta max 5 klick; det som görs 1 gång/månad får gömmas bakom kugghjulet.
2. **Låt arbetsytan vara appen** — moduler och dashboards är för administratörer, inte operatörer.
3. **Börja flödet med användarens intention** (vad kunden vill ha), låt systemet räkna ut resten (var det får plats).
4. **Visa bara giltiga val** (luckchips) i stället för att validera ogiltiga efteråt.
5. **En mekanism för många behov** slår en modul per behov.
6. **Recognition over recall överallt:** listor med allt synligt (pris+tid), färger, ingen dold funktionalitet bakom högerklick/hover.
7. **Gör misstag billiga i stället för omöjliga:** soft delete + ångralogg > varningsdialoger på allt.
8. **Bekräftelse ska beskriva konsekvensen konkret**, aldrig "Är du säker?".
9. **Koda domänens vanligaste rörelser som knappar** ("+4 veckor").
10. **Minsta möjliga datamodell för verkliga beslut** (stjärnan = 1 bit som styr ombokningsfrihet).
11. **Skilj på omedelbar värld (drift) och publicerad värld (admin)** — olika spar-modeller för olika risk.
12. **Prata användarens språk i UI-copy**, inklusive det som INTE händer ("syns ej för kund").
13. **Defaults ska vara ofarliga** — kunna bokas utan telefonnummer = ingen oavsiktlig SMS.
14. **Realtid tar bort en hel klass av UI** (spara-knappar, refresh, "senast uppdaterad").
15. **Relativ tid slår absolut tid** i schemaläggningsdomäner ("+25 veckor" > "2027-01-04").

---

## 17. Rekommendationer för ett ännu enklare salongssystem

*Nu — och först nu — jämförelsen med vårt eget bygge. Behåll Wavys kärna, fixa deras skulder:*

1. **Kopiera arkitekturen:** kalendern som enda skärm, admin bakom kugghjul. Om vårt system har fler toppnivåval än "kalender + inställningar" för frisören — skär bort.
2. **Kopiera bokningsflödet exakt:** behandling → (visa lediga) → lucka → kund → boka. Mät oss mot 5 klick / 0 tangenttryck. Varje extra steg måste förtjäna sin plats.
3. **Sök-och-skapa-kund i ETT formulär**, endast namn obligatoriskt.
4. **Blockeringar som universalmekanism** med upprepning + "endast framåt"-ändring — bygg ingen schemamodul förrän en kund med roterande scheman betalar för den.
5. **Inför stjärn-motsvarigheten** (kundens frisörval = flyttbarhetsflagga) — löjligt billig, enormt värdefull.
6. **30-dagars ångralogg** med vem/när/källa + återställ-knapp.
7. **Slå Wavy där de är svaga (differentiering):**
   - enkel rollstyrning (ägare/anställd — mer behövs inte initialt)
   - återkommande kundbokningar ("boka om var 4:e vecka" som ett klick i bekräftelsesteget)
   - kundsök direkt i kalendern (utan att starta bokningsflöde)
   - flera behandlingar i samma bokning som *tillägg* (checkbox "lägg till skäggtrim +15 min") i stället för SKU-explosion
   - grundläggande tangentbord + skärmläsarstöd (billigt nu, dyrt sen)
   - konsekvent 24h-tid (och undvik deras AM/PM-bugg)
8. **Delegera betalningar** (Zettle/Stripe Terminal) — bygg ingen kassa.
9. **Realtidssynk från dag 1** (Supabase Realtime ger oss detta nästan gratis) — det är förutsättningen för "inga spara-knappar".
10. **Färdiga rapporter, ingen rapportbyggare** — men lägg till datumintervall + per-frisör-filter som Wavy saknar.

---

## 18. De 20 viktigaste lärdomarna, prioriterade

1. Hela produkten = kalendern. Ingen annan startsida.
2. Bokning: behandling först, tid sedan, kund sist — 5 klick totalt.
3. Visa bara lediga, giltiga luckor — förhindra fel i stället för att felmeddela.
4. Sök och skapa kund i samma formulär; endast namn krävs.
5. Drag & släpp för flytt, med konsekvensbeskrivande bekräftelse.
6. Blockeringar (med upprepning) ersätter schema-, rast- och frånvaromoduler.
7. Serieändringar gäller endast framåt — historik röres aldrig.
8. Stjärnan: kundens frisörval lagrat som flyttbarhetsflagga.
9. Soft delete + 30 dagars återställbar logg i stället för varningar överallt.
10. Bekräfta endast oåterkalleliga handlingar, alltid med konkret text.
11. Färg + typsnitt som personidentitet i varje vy och dialog.
12. Relativa veckor ("+4 v") och veckohopp-knappar — salonger tänker i veckor.
13. Realtid utan spara-knappar i driften; utkast/publicera i admin.
14. Ofarliga defaults: inga obligatoriska fält som kan orsaka sidoeffekter (SMS).
15. Anteckningar med tydlig sekretessmärkning: "(syns ej för kund)".
16. Full spårbarhet per bokning: källa, tidsstämpel, SMS-logg, vem som avbokade.
17. Kombo-tjänster som paket funkar för små menyer — planera för tillägg innan menyn växer.
18. Självbokningens gränser som tre begripliga reglage (nivå, horisont, avbokningsgräns).
19. Support inbyggd i produkten (chatt + artiklar) i stället för manual.
20. Enkelhet = det som INTE byggdes. Varje ny modul måste bevisa att den inte kan vara en blockering, en flagga eller en färdig rapport i stället.

---

## Bilaga A — Teknisk profil (observerad)

- **Stack:** Meteor 2.2.4 + React, DDP/WebSocket-realtid, PWA (manifest + service worker), Intercom för support. ✅
- **Rendering:** ren DOM (0 canvas), ~570 div/199 knappar på kalendersidan, virtualiserad scroll i minikalendern. ✅
- **Responsivt:** brytpunkter 540/767/768/900/1023 px, `prefers-reduced-motion`. ✅
- **Off:** semantiska landmärken 0, fokusmarkering avstängd, `user-scalable=no`. ✅

## Bilaga B — Testposter (skapade och städade)

| Post | Skapad | Städad | Verifierad |
|---|---|---|---|
| Kund "Zztest Testbokning Claude" (utan mobilnr) | ✅ | Dold via "Dölj kund" | ✅ sökning ger 0 träffar |
| Bokning Herrklippning, John, 2027-01-04 10:00 (flyttad till 11:00 som test) | ✅ | Avbokad | ✅ borta ur kalendern (ligger i avbokningsloggen, systemets normala beteende) |
| Blockering, Hilal, 2027-01-04 09:15–10:15 | ✅ | Raderad | ✅ borta ur kalendern |

Inga SMS/notiser kunde utlösas (kunden saknade telefonnummer). Inga befintliga kunddata ändrades, exporterades eller dokumenterades. Kundens app lämnades i dagens vy.

## Bilaga C — Ej testat / kräver ytterligare tillstånd

- Kundappens bokningsflöde ur kundens perspektiv (eget konto krävs)
- Zettle-integrationens faktiska flöde (extern koppling)
- CSV-exporten (laddar ner personuppgifter)
- SMS-innehåll och påminnelseutformning (kräver riktigt telefonnummer)
- Återställning från Raderade bokningar (fanns bara skarpa poster i loggen)
- Mobil-layouten live (fönstret kunde inte förminskas i styrd session; app-läge på iOS)
- Beteende vid samtidig redigering från två enheter
