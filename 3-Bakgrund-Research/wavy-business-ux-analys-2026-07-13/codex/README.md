# Wavy Business — djup UX- och systemanalys

> **Beslutsstatus 2026-07-14:** Detta dokument är research och beskriver Wavy. Formuleringar om att arbetsytan bör vara startsidan är observationer/lärdomar från Wavy, inte längre Corevos produktbeslut. Corevos låsta målbild finns i `1-Planering/10-kundadmin-bokningsarbetsbord/`: Översikt är entrén och Kalender är det kompletta arbetsbordet ett klick bort.

**Datum:** 2026-07-13  
**Typ:** Konkurrentresearch / kunskapsunderlag  
**Status:** Skärmbildsanalys + sanitiserad livegranskning i inloggad Chrome  
**Produktperspektiv:** Wavy analyseras först fristående. Rekommendationerna sist är generella och ska inte läsas som en pixel- eller funktionskopia.

## Läs detta först

**Fördjupning 2026-07-13:** Den efterföljande livegranskningen, Corevo-jämförelsen och funktionsparitetsmatrisen finns i [`LIVE-ANALYS-OCH-FUNKTIONSPARITET.md`](LIVE-ANALYS-OCH-FUNKTIONSPARITET.md). Den filen ersätter de äldre formuleringarna nedan om att liveåtkomst saknades. Huvudrapporten bevaras som den ursprungliga, skärmbildsgrundade analysen så att evidensutvecklingen går att följa.

Den här rapporten bygger på uppdragstexten och samtliga sju relevanta Wavy-skärmbilder som skapades 20:31–20:42 den 13 juli 2026. Originalbilderna innehåller verkliga kundnamn och en verksamhets telefonnummer. De har därför **inte kopierats in i repot**. Källornas identitet och integritet finns i `KALLREGISTER.md` utan att personuppgifter återges.

Codex webbläsaryta hade ingen öppen flik och kunde inte ansluta till den redan inloggade Edge-sessionen. Ingen liveinteraktion, mutation, nätverksinspektion, formulärinmatning eller testbokning utfördes. Rapporten är därför medvetet strikt:

- **[V] Verifierad observation:** direkt synlig i en eller flera skärmbilder.
- **[S] Rimlig slutsats:** starkt stödd av det synliga gränssnittet, men inte interaktivt testad.
- **[EJ] Ej säkert testat:** arbetsflödet eller beteendet kan inte beläggas av materialet.
- **[T] Kräver ytterligare tillstånd/åtkomst:** kräver en ansluten, inloggad webbläsaryta och ibland ett säkert testscenario.

Klicktal anges bara när en före-/efterbild visar handlingen eller när start- och sluttillståndet är entydigt. Ett klicktal märkt **minst** är inte ett komplett flödestal.

## 1. Sammanfattning: varför Wavy upplevs enkelt

Wavys upplevda enkelhet kommer främst från att systemet reducerar salongens operativa vardag till en enda visuell modell: **en dag, en tidsaxel och en kolumn per medarbetare**. Användaren behöver inte översätta en lista till en kalender i huvudet. Kundbesök, behandling, start, slut, personal och luckor finns i samma blickfång. [V]

De viktigaste enkelhetsmekanismerna är:

1. **Kalendern är startsida och arbetsyta.** Den dominerar hela skärmen och konkurrerar inte med en omfattande huvudmeny. [V]
2. **Personalen är rumsligt stabil.** Varje medarbetare har en fast kolumn och en konsekvent färgfamilj. Det gör att användaren känner igen före läsning. [V]
3. **Bokningskort komprimerar rätt information.** Starttid, kund, behandling och sluttid ryms direkt i kortet. [V]
4. **Ledig tid är frånvaro av kort.** Användaren behöver inte tolka en separat tillgänglighetsstatus. [S]
5. **Blockerad tid skiljs från bokning med mönster.** Den behåller personalens färgidentitet men markeras med ränder och ordet “Blockerad”. [V]
6. **Skapa-flödet börjar med domänspråk.** En mycket stor “Välj behandling”-yta använder salongens faktiska arbetsobjekt, inte tekniska ord som “ny kalenderpost”. [V]
7. **Behandlingsvalet visar längd och pris innan nästa beslut.** Det minskar minnesarbete och felaktiga val. [V]
8. **Blockering ligger bredvid behandlingarna.** Frånvaro/rast hanteras som samma typ av kalenderläggning, inte som en separat administrationsresa. [V]
9. **Datumbyte är synligt och direkt.** Idag, närliggande datum, veckonummer och relativa veckor syns utan en modal kalender. [V]
10. **Administration är samlad och grunt kategoriserad.** Åtta stabila inställningsområden ligger i en permanent vänsterspalt. [V]
11. **Presentation har förhandsvisning bredvid fälten.** Kopplingen mellan inställning och kundresultat blir igenkännbar. [V]
12. **Hjälp är inbyggd i arbetsytan.** Fråga, sök och relevanta artiklar nås i en panel utan att lämna kalendern. [V]

Det viktiga är att enkelheten inte främst ser ut att komma från få funktioner. Den kommer från **låg navigationskostnad, stark rumslig stabilitet, domännära etiketter, synliga standardobjekt och kontextuellt framtagna val**. [S]

Samtidigt finns en viktig reservation: skärmbilderna visar ingången till flera flöden, inte deras fulla genomförande. Wavy kan vara mycket snabbt i förstasteget men ändå ha dold komplexitet efter behandlingsvalet. Det måste verifieras innan man tillskriver hela bokningsflödet samma enkelhet. [EJ]

## 2. Systemets informationsarkitektur

### 2.1 Operativ nivå

Kalendern på `/calendar` är systemets operativa nav. Följande lager är synliga samtidigt: [V]

- **global verktygslist** längst till vänster: kugghjul, pratbubbla och papperskorg;
- **primär handling**: “Välj behandling”;
- **personalöversikt**: fyra synliga medarbetare i en 2 × 2-yta;
- **datumkontroll**: “Idag”, närliggande dagar, veckonummer och relativa veckor;
- **dagrubrik**: veckodag, datum, år och veckonummer;
- **kalendergrid**: tidsaxel + personalkolumner;
- **hjälpwidget** längst ned till höger.

Informationshierarkin är tydligt prioriterad:

1. Vad ska göras? — välj behandling.
2. Vem arbetar? — personalnamn och färg.
3. När? — datumkontroll och tidsgrid.
4. Vad är redan planerat? — kort i kalendern.
5. Vad gör jag om jag fastnar? — hjälpwidget.

Detta är en **arbetsobjektcentrerad** snarare än modulcentrerad arkitektur. Kalenderposten är navet; behandling, kund och personal möts där. [S]

### 2.2 Administrativ nivå

Inställningar visas som en separat helsida med permanent vänsternavigation. Följande kategorier är verifierade: [V]

1. Presentation
2. Personal
3. Behandlingar
4. Öppettider
5. Bokningsbarhet
6. Statistik
7. Konton & säkerhet
8. Om Wavy

Det finns också:

- stängningskontroll uppe till vänster;
- global “Publicera ändringar”-kontroll uppe till höger;
- logga ut längst ned till vänster;
- supportwidget längst ned till höger. [V]

Arkitekturen separerar **dagligt arbete** från **sällanadministration**. Det håller kalendern fri från inställningsdetaljer, men gör kugghjulet till en kritisk brygga. [S]

### 2.3 Hjälpnivå

Hjälppanelen har tre bottenflikar: Hem, Meddelanden och Hjälp. Hem visar: [V]

- “Ställ en fråga”;
- sökfält;
- en kort lista med kontextuella ämnen;
- stängningskontroll.

Hjälpen fungerar som ett separat lager ovanpå aktuell vy, inte som en navigering bort från arbetet. [V]

## 3. Fullständig funktionskarta

### 3.1 Direkt verifierade funktioner

| Område | Synlig funktion | Evidens | Kommentar |
|---|---|---:|---|
| Kalender | Dagvy med tidsaxel | V | Minst 08:00–14:00 synligt |
| Kalender | En kolumn per personal | V | Fyra kolumner synliga |
| Kalender | Kundbokningar som tidsblock | V | Start/slut, behandling och kund syns |
| Kalender | Blockerad tid | V | Randigt kort + etikett |
| Kalender | Datumbyte | V | Idag + närliggande datum |
| Kalender | Veckonummer/relativ vecka | V | v.29, +1 v, +2 v |
| Kalender | Behandlingsväljare | V | Stor startyta + overlay |
| Behandlingar | Kategorigruppering | V | Exempelvis kategori för hår/skägg |
| Behandlingar | Längd och pris i lista | V | Visas under varje behandling |
| Behandlingar | Blockera tid som val | V | Egen grupp i samma overlay |
| Inställningar | Presentation | V | Aktiv kategori och redigeringsvy |
| Presentation | Mobil förhandsvisning | V | Telefonmockup bredvid fälten |
| Presentation | Bilduppladdning | V | “Ladda upp ny bild” |
| Presentation | SMS-avsändare | V | Eget avsnitt |
| Presentation | Synliga verksamhetsuppgifter | V | Namn, beskrivning, adressfält m.m. |
| Inställningar | Personal | V | Navigationspost |
| Inställningar | Behandlingar | V | Navigationspost |
| Inställningar | Öppettider | V | Navigationspost |
| Inställningar | Bokningsbarhet | V | Navigationspost |
| Inställningar | Statistik | V | Navigationspost |
| Inställningar | Konton & säkerhet | V | Navigationspost |
| Hjälp | Chatt/fråga | V | Inbyggd panel |
| Hjälp | Sök | V | Sökfält |
| Hjälp | Artikellista | V | Kontextuella ämnen |
| Konto | Logga ut | V | Tydlig kontroll |
| Publicering | Publicera ändringar | V | Inaktiv i oförändrat tillstånd |

### 3.2 Indikerade men inte funktionellt verifierade områden

| Område | Vad som indikeras | Status |
|---|---|---:|
| Ändra bokning | Kalenderkort verkar interaktiva | EJ |
| Flytta bokning | Gridformen talar för direktmanipulation eller dialog | EJ |
| Radera/avboka | Papperskorg finns globalt | EJ; dess semantik är oklar |
| Favorit/stjärna | Stjärnikon visas på vissa bokningar | EJ; betydelsen är okänd |
| Kundregister | Kundnamn finns i bokningskort | EJ; ingen kundvy visad |
| Roller | Konton & säkerhet samt Personal antyder kontohantering | EJ |
| Notifieringar | SMS-avsändare och hjälpartiklar antyder SMS-flöden | EJ |
| Kassa/betalning | Inget säkert synligt bevis i materialet | EJ |
| Återkommande bokning | Ingen synlig kontroll | EJ |
| Flera behandlingar | Ingen synlig bekräftelse efter första valet | EJ |
| Resurser/rum | Ingen resursvy synlig | EJ |
| Veckovy | Veckonummer syns, men inte en faktisk veckovy | EJ |
| Mobil Business-app | Om Wavy anger Apple-app och webb/Android | V för distribution, EJ för UX |

### 3.3 Saknas i materialet och får inte antas

- kassaflöde, betalning och återbetalning;
- kundsökning, kundskapande och kundhistorik;
- anteckningar;
- återkommande bokningar;
- flera behandlingar i samma besök;
- drag-and-drop;
- avbokningsorsaker och notifieringsval;
- personalroller och behörighetsmatris;
- rapportinnehåll och export;
- laddnings-, tom-, fel- och offline-tillstånd;
- tangentbordsgenvägar;
- faktisk mobil responsivitet;
- teknisk semantik, DOM och ARIA.

## 4. Centrala arbetsflöden

### 4.1 Påbörja ny bokning

**Startpunkt:** kalendern.  
**Verifierad sekvens:** klick på “Välj behandling” → behandlingsoverlay öppnas. [V]  
**Verifierad klickkostnad:** 1 klick till valytan.  
**Obligatoriskt beslut hittills:** välj mellan blockering och en behandling.  
**Synliga beslutsdata:** kategori, behandlingsnamn, längd och pris. [V]

Systemet gör följande rätt:

- visar få kategorier men flera konkreta val;
- placerar längd och pris direkt vid valet;
- använder stor klickyta och högt placerad primär handling;
- låter kalenderkontexten ligga kvar bakom overlayn;
- undviker ett tomt formulär som första steg.

**Okänt efter behandlingsvalet:** kund, personal, datum, starttid, notifiering, anteckning, flera behandlingar, bokningssummering och spara. [EJ]

**Risk:** den stora overlayn täcker större delen av kalendern. Om användaren behöver jämföra luckor under behandlingsvalet tvingas hen minnas mer än nödvändigt. [V/S]

### 4.2 Blockera tid

**Startpunkt:** behandlingsoverlayn.  
**Verifierad kontroll:** “Blockera tid” i en separat, röd grupp. [V]  
**Klickkostnad:** minst 2 klick från kalendern: öppna väljaren + välj blockering.  
**Automatisering som kan antas:** blockering behandlas som ett kalenderobjekt och visas med samma tidsgeometri som bokningar. [S]

Styrkan är att blockering använder samma mentala modell som behandling: välj typ, välj tid, lägg i kalendern. Det minskar behovet av en separat frånvaromodul för vardagliga pauser. [S]

Okänt: standardlängd, orsak, upprepning, hela dagen, påverkan på onlinebokning och notifieringar. [EJ]

### 4.3 Läsa dagens beläggning

**Startpunkt:** kalendern.  
**Klickkostnad:** 0. [V]  
**Obligatoriska beslut:** 0 för att se nuläget.  

Användaren kan direkt bedöma:

- vem som arbetar;
- vem som är bokad;
- behandlingens ungefärliga karaktär;
- start- och sluttider;
- luckor;
- blockerad tid;
- skillnad mellan personal genom färg och kolumn. [V]

Detta är rapportens starkaste belägg för enkelhet: den vanligaste frågan “vad händer idag?” kräver ingen navigering. [S]

### 4.4 Byta datum

**Startpunkt:** datumkontrollen ovanför kalendern.  
**Verifierade alternativ:** Idag och flera närliggande datum; veckor och relativa veckor visas. [V]  
**Klickkostnad:** sannolikt 1 klick för synligt datum, men inte interaktivt verifierat. [S]

Styrkor:

- “Idag” är alltid dominant;
- helger/inaktiva dagar har svagare kontrast;
- veckonummer och relativ vecka ger både kalender- och verksamhetsorientering;
- en nedåtkontroll antyder utökad datumväljare. [V/S]

Svaghet: små datum och svag kontrast kan vara svåra under stress eller på liten skärm. [V/S]

### 4.5 Öppna inställningar

**Startpunkt:** kugghjulsikon i kalenderns vänsterlist.  
**Slutläge som syns:** inställningssida med permanent vänsternavigation.  
**Klickkostnad:** sannolikt 1 klick, men ingen före-/eftersekvens bevisar handlingen. [S]

Väl inne i inställningar kräver byte mellan de åtta synliga huvudområdena sannolikt ett klick och ingen menyexpansion. [S]

### 4.6 Redigera kundpresentation

**Startpunkt:** Inställningar → Presentation. [V]  
**Synliga steg/objekt:** redigera SMS-avsändare, synliga uppgifter eller bild; granska telefonförhandsvisning; publicera ändringar. [V]

Styrkor:

- “Presentation” använder verksamhetsspråk;
- förhandsvisningen visar konsekvensen i samma vy;
- publicering separerar redigering från live-läge;
- publiceringsknappen är nedtonad utan osparade ändringar, vilket kommunicerar status. [V/S]

Svagheter:

- lång sida och stora vertikala avstånd kan kräva mycket scroll;
- fältens etiketter och hjälptext är visuellt svaga;
- telefonmockupen visar endast en smal kundyta och kan ge falsk trygghet om responsivitet;
- ett globalt publiceringssteg kan skapa osäkerhet om autosparning kontra utkast. [V/S]

### 4.7 Söka hjälp

**Startpunkt:** pratbubbla i vänsterlist eller blå hjälpwidget. [V]  
**Verifierad sekvens:** stängd widget → öppen panel ovanpå kalender/inställningar. [V]  
**Klickkostnad:** 1 klick för att öppna panelen.  

Användaren kan därefter välja att ställa fråga, söka eller öppna en artikel. [V]

Styrkan är låg kontextväxlingskostnad. Svagheten är att panelen täcker en stor del av den aktiva ytan och att det finns två visuella ingångar till hjälp vars inbördes skillnad är oklar. [V/S]

### 4.8 Övriga efterfrågade flöden

Följande flöden kan inte beskrivas sanningsenligt med exakt stegordning från de sju bilderna: flytta/ändra/avboka bokning, hitta/skapa kund, återkommande bokning, flera behandlingar, välja personal efter behandlingsval, arbetstider, frånvaro, tjänsteändring, kassa, kundhistorik, anteckningar, resurser, notifieringar, rapporter och roller. [EJ]

De ska testas i nästa säkra session enligt testmatrisen i avsnitt 19, inte fyllas ut med antaganden.

## 5. Klick- och steganalys

| Uppgift | Verifierade klick | Verifierade beslut | Status |
|---|---:|---:|---|
| Se dagens beläggning | 0 | 0 | V |
| Se kund, behandling, start och slut i bokning | 0 | 0 | V |
| Skilja bokad från blockerad tid | 0 | 0 | V, men färg/mönster måste tolkas |
| Öppna behandlingsväljare | 1 | 0 | V |
| Nå “Blockera tid” | 1 till valytan | 1 synligt val | V; spara ej testat |
| Öppna hjälp | 1 | 0 | V |
| Byta till synligt datum | EJ | 1 | Kräver liveverifiering |
| Gå till inställningar | EJ | 0 | Sannolikt 1 klick |
| Byta inställningskategori | EJ | 1 | Sannolikt 1 klick |
| Ändra presentation och publicera | EJ | flera | Kräver säker testsession |
| Skapa komplett bokning | EJ | EJ | Kräver testbokning efter 2027-01-01 |
| Flytta/ändra/avboka | EJ | EJ | Kräver testpost |

Den objektiva slutsatsen är att **orienteringskostnaden** är mycket låg, medan **transaktionskostnaden** ännu inte kan mätas komplett. Det är en viktig skillnad: skärmbilderna bevisar en enkel kalender och enkel flödesingång, inte automatiskt ett enkelt slutförande. [V/S]

## 6. Komponent- och interaktionsmönster

### 6.1 Tidsblock som primär komponent

Kortens höjd motsvarar varaktighet. Starttid ligger uppe till vänster, sluttid nere till höger, och huvudraden visar kund + behandling. Detta utnyttjar kalendergeometri i stället för extra metadata. [V]

### 6.2 Personalfärg som navigationssystem

Varje medarbetare har en egen färgfamilj som återkommer i namn och bokningskort. Färgen fungerar både som identitet och som gruppering. [V]

Fördel: snabb preattentiv avläsning.  
Risk: färg blir informationsbärande och kan fallera för färgblindhet, låg kontrast eller när antalet medarbetare växer. [S]

### 6.3 Mönster för tillstånd

Solida kort betyder bokningar och randiga kort betyder blockerad tid. Detta är bättre än enbart färg, eftersom mönstret skapar en andra kanal. [V]

### 6.4 Overlay för val

Behandlingsväljaren vecklar ut sig över kalendern men lämnar delar av bakgrunden synliga. Den är inte en liten modal; den fungerar som ett tillfälligt arbetslager. [V]

Fördel: många tjänster kan visas utan ny sida.  
Nackdel: kalenderkontext skyms, långa namn trunkeras och den stora tomma ytan antyder svag responsiv användning av bredden. [V/S]

### 6.5 Permanent kategorinavigation i administration

Vänsterspalten ger recognition rather than recall. Aktiv kategori markeras med grå bakgrund. Den kräver ingen hamburgermeny på desktop. [V]

### 6.6 Direkt förhandsvisning

Telefonmockupen är en tydlig “ändring → konsekvens”-koppling. Den minskar risken att administratören behöver öppna kundappen separat för varje justering. [V/S]

### 6.7 Kontextuell supportpanel

Hjälpwidgeten återanvänder ett modernt panelmönster med sök, artiklar, meddelanden och chatt. Den är igenkännbar men visuellt mer modern än resten av produkten, vilket skapar ett designsystembrott. [V/S]

## 7. Kalenderns beteende och logik

### Verifierad logik

- Tiden löper vertikalt. [V]
- Personal löper horisontellt. [V]
- Bokningshöjd motsvarar tidslängd. [V]
- Halvtimmar och kvartstider stöds; synliga poster börjar bland annat på :15 och :30. [V]
- Exakt sluttid visas även när blocket är kort. [V]
- Samma personalfärg återkommer i rubrik och kort. [V]
- Blockeringar kan ha olika längd och följer samma tidsaxel. [V]
- Dagrubriken är global och ligger ovanför personalkolumnerna. [V]

### Sannolik domänmodell

Det visuella beteendet indikerar minst följande objekt: [S]

- verksamhet/salong;
- personal;
- behandling med pris och varaktighet;
- bokning med start/slut, kund, behandling och personal;
- blockering med start/slut och personal;
- öppettid/bokningsbarhet;
- publicerad kundpresentation.

Det går inte att avgöra om kalendern använder separata “frånvaro”, “rast” och “blockering”-objekt eller en gemensam blockeringstyp. [EJ]

### Skalningsfrågor

- Fyra personal får god bredd på stor desktop. Vid åtta eller fler uppstår sannolikt horisontell trängsel eller scroll. [S]
- Färger är tydliga för fyra personer men svårare att särskilja i stora team. [S]
- Mycket korta bokningar riskerar textöverlapp. [S]
- Täta dagar blir informationsrika men behåller samtidigt värdefull överblick. [V/S]

## 8. Formulär, standardvärden och automatisering

### Direkt synligt

- Behandlingslistan visar pris och varaktighet utan att användaren öppnar varje post. [V]
- Publicera-knappen har ett inaktivt tillstånd när inga ändringar verkar finnas. [V/S]
- SMS-avsändare har en synlig begränsnings-/hjälptext. [V]
- Presentationen visar en omedelbar eller åtminstone samlokaliserad förhandsvisning. [V]

### Troliga automatiseringar att verifiera

- behandling väljer standardlängd och pris;
- personalfärg tilldelas kalenderposten;
- sluttid beräknas från start + varaktighet;
- blockerad tid hindrar bokningsbarhet;
- kundpresentation använder synliga uppgifter i kundappen;
- publiceringsknappen aktiveras vid smutsigt formulär.

Alla dessa är rimliga men inte bevisade av stillbilder. [S]

### UX-princip

Bra standardvärden gör ett system enkelt först när de är **synliga, förutsägbara och lätta att överstyra**. Wavy visar de två första delarna genom pris/längd nära behandlingen; överstyrning måste testas. [S/EJ]

## 9. Felhantering och återställning

Inga felmeddelanden, valideringsfel, nätverksfel, konflikter eller ångra-kontroller syns. [EJ]

Följande måste verifieras innan systemet kan bedömas som säkert enkelt:

- dubbelbokningsvarning;
- bokning utanför arbetstid;
- obligatoriska kundfält;
- ogiltigt telefonnummer/mejl;
- konflikt vid flytt;
- osparade inställningar;
- publiceringsfel;
- offline/nätverksbortfall;
- avbokningens ångra- eller bekräftelsesteg;
- skillnad mellan radera, avboka och no-show;
- notifieringskonsekvenser före bekräftelse.

Det globala papperskorgsverktyget är särskilt riskfyllt om det saknar kontext och tydlig bekräftelse. Dess faktiska funktion får inte antas. [V/EJ]

## 10. Mobil och responsiv UX

### Verifierat

- Wavy anger stöd via webbläsare på dator/Android och en särskild Apple-app. [V]
- Presentationen innehåller en telefonförhandsvisning av kundytan. [V]
- Kalenderbilderna är från bred desktop. [V]

### Ej verifierat

- hur personalkolumner kollapsar eller scrollar på mobil;
- om “Välj behandling” blir en fast knapp;
- om behandlingsoverlayn blir helskärm;
- touchstorlekar och drag-and-drop;
- om hjälppanelen blockerar hela skärmen;
- portrait/landscape;
- Apple-appens navigationsmodell;
- Android-webbens prestanda och installation.

Den stora desktopbredden är central för den observerade enkelheten. Det är inte säkert att samma informationsdensitet kan behållas på mobil utan en annan modell, exempelvis en personal i taget. [S]

## 11. Tillgänglighet och tangentbordsanvändning

### Visuella risker

- flera texter har låg kontrast mot vit/ljus bakgrund;
- personalnamn använder dekorativ skrivstil;
- ikonlisten saknar synliga textetiketter;
- färg är en stark identitetsbärare;
- små kursiva sluttider kan vara svårlästa;
- nedtonade datum och publiceringskontroll kan bli för svaga;
- stjärnans innebörd framgår inte;
- hjälpwidgeten kan skapa fokusfälla eller dölja innehåll. [V/S]

### Positiva signaler

- blockering skiljs med både text och mönster, inte bara färg;
- bokningskort visar tider i text;
- inställningsnavigationen använder fullständiga ord;
- stora ytor finns för primär handling och publicering. [V]

### Ej testbart från bilder

- semantisk HTML;
- rubrikordning;
- labels och accessible names;
- tabbordning;
- Escape för overlay/panel;
- fokusåterställning;
- skärmläsaruppläsning av kalender;
- tangentbordsbokning;
- zoom 200–400 procent;
- reduced motion;
- live regions för status och fel.

Ingen tillgänglighetsbedömning ska därför kallas godkänd enbart utifrån detta material. [EJ]

## 12. Ponytail-analys

De namngivna `/ponytail`-verktygen fanns inte installerade i denna Codex-session. Analysen använder därför en tydligt deklarerad operativ tolkning: **vilken kort, välkammad användarväg bär merparten av vardagsvärdet, och vilka delar hålls utanför den vägen?**

### Den korta “ponytail”-vägen

Kalender → välj behandling → välj konkret tjänst → fortsätt bokning. För blockering: kalender → välj behandling → blockera tid. [V för de två första stegen, EJ för resten]

Det som gör vägen kort:

- ett synligt startobjekt;
- vardagsspråk;
- behandling före tekniska bokningsfält;
- pris/längd före val;
- personal och luckor redan i bakgrunden;
- frånvaro modelleras nära bokningar;
- inget dashboardmellansteg.

### Det som hålls utanför kärnvägen

Personal, tjänstekatalog, öppettider, bokningsbarhet, statistik, säkerhet och presentation ligger i inställningar. [V]

Det är en sund separation så länge dagliga undantag kan lösas i kalendern. Om personalbyte, prisöverskrivning eller flera behandlingar kräver resor in i inställningar bryts modellen; detta måste testas. [EJ]

### Centrala frisörobjekt nära till hands

- behandling;
- personal;
- tid/lucka;
- kundbesök;
- blockering;
- hjälp. [V]

Kundhistorik, anteckningar och betalstatus syns inte och kan därför vara antingen klokt progressivt dolda eller för långt bort. [EJ]

## 13. Ponytail-debt-analys

Här används “debt” som skillnaden mellan **upplevd omedelbar enkelhet** och den komplexitet som sannolikt skjuts till senare steg, större verksamheter eller ovanliga situationer.

### Skuldindikationer

1. **Färgskuld:** personalidentitet är mycket färgburen och skalar dåligt till stora team eller färgvariationer. [S]
2. **Overlay-skuld:** det snabba behandlingsvalet täcker kalendern och kan göra nästa beslut mer minneskrävande. [V/S]
3. **Ikonskuld:** tre oetiketterade globala ikoner sparar plats men flyttar kostnad till inlärning och felrisk. [V/S]
4. **Täthetsskuld:** kalendern är effektiv på stor skärm men kan bli svår på mobil och vid många medarbetare. [S]
5. **Trunkeringsskuld:** längre behandlingsnamn kapas redan i den breda overlayn. [V]
6. **Tillgänglighetsskuld:** låg kontrast, små tider och skrivstilsnamn prioriterar estetik/kompakthet. [V/S]
7. **Dubbel hjälpingång:** vänsterikon och flytande widget kan vara två system med överlappande ansvar. [V/S]
8. **Designsystemsömmar:** supportpanelen har ett annat visuellt språk än kärnprodukten. [V/S]
9. **Publiceringsskuld:** en global publiceringsmodell är enkel när den fungerar men kan dölja vilka ändringar som är osparade, utkastade eller live. [S]
10. **Domänskuld:** “Blockera tid” kan fungera för rast, frånvaro och resurshinder men riskerar att tappa orsak, rapportering och återkommande regler. [S]
11. **Informationsskuld:** kundnamn i kalendern ger hastighet men ökar integritetsrisken på delade skärmar. [V/S]
12. **Plattformsskuld:** separata användningsråd för Apple-app respektive webb/Android kan innebära paritets- och supportkostnad. [V/S]

Detta är inte belägg för dålig intern teknik. Det är observerbara UX-kompromisser som bör stressas i en fortsatt analys.

## 14. Systemets främsta styrkor

1. Omedelbar nulägesbild utan klick.
2. Kalendern speglar verksamhetens verkliga arbetsmodell.
3. Personalens rumsliga stabilitet.
4. Hög informationsdensitet utan tabellkänsla.
5. Start- och sluttid syns i kortet.
6. Behandling är primärt språk och primär handling.
7. Pris och längd visas före val.
8. Blockering integreras i samma arbetsyta.
9. Datumkontroll ger både närhet och veckoorientering.
10. Administration är grunt och stabilt kategoriserad.
11. Förhandsvisning finns bredvid presentationsinställningar.
12. Publicering har ett synligt statusläge.
13. Support nås utan att lämna arbetskontext.
14. Blockering använder både text och mönster.
15. Gränssnittet undviker dashboardbrus i operativt läge.

## 15. Systemets främsta svagheter

1. Behandlingsoverlayn skymmer den kalender som behövs för tidsbeslut.
2. Ikonmenyn är svår att upptäcka och tolka.
3. Färg bär för mycket semantik.
4. Kontrast och liten typografi ser otillräckliga ut på flera ställen.
5. Dekorativt typsnitt minskar läsbarheten för personal.
6. Långa behandlingsnamn trunkeras utan synlig alternativ presentation.
7. Hjälppanelen blockerar arbetsytan kraftigt.
8. Två hjälpingångar skapar oklarhet.
9. Den administrativa sidan använder stora ytor ineffektivt.
10. Mobilupplevelsen går inte att härleda från desktopmodellen.
11. “Papperskorg” som global ikon kan signalera farlig handling utan kontext.
12. Stjärnikonens betydelse är inte självklar.
13. Ingen synlig ångra-, autospara- eller konfliktstatus i materialet.
14. Kunddata exponeras direkt i tät kalender på potentiellt delad skärm.
15. Designen mellan kärnsystem och supportwidget är inkonsekvent.

## 16. Generella UX-principer att använda

1. **Gör den vanligaste frågan svarbar utan klick.**
2. **Låt arbetsytan vara startsidan, inte en sammanfattningsdashboard.**
3. **Modellera verksamhetens substantiv, inte systemets tabeller.**
4. **Använd geometri som data:** läge och höjd kan kommunicera tid.
5. **Behåll stabila rumsliga positioner för återkommande aktörer.**
6. **Visa konsekvensbärande metadata före beslut.**
7. **Börja med ett konkret val, inte ett långt tomt formulär.**
8. **Låt undantag använda samma mentala modell som normalfallet.**
9. **Separera daglig drift från sällaninställningar.**
10. **Visa hjälp i kontext men låt den inte ta över arbetet.**
11. **Använd fler än en visuell kanal för tillstånd.**
12. **Gör standardvärden synliga och förutsägbara.**
13. **Förhandsvisa publicerade resultat nära redigeringen.**
14. **Bevara bakgrundskontext när ett delbeslut tas.**
15. **Mät komplett transaktion, inte bara första klicket.**
16. **Optimera för rättelse lika mycket som skapande.**
17. **Designa täthet för stress, inte för demonstrationsbilder.**
18. **Skala identitetsmodellen bortom färg.**
19. **Etikettera riskfyllda och sällsynta ikoner.**
20. **Gör systemstatus explicit: sparat, utkast, publicerat, skickat.**

## 17. Rekommendationer för ett ännu enklare salongssystem

Följande rekommendationer är härledda efter den fristående Wavy-analysen:

### Prioritet A — vardagsflödet

- Behåll kalendern som primär arbetsyta och visa “vad händer nu/nästa?” utan navigering.
- Låt ett klick i en ledig cell förfylla datum, tid och personal; visa sedan behandlingar i en smal sidopanel så luckan förblir synlig.
- Låt behandlingsval förfylla längd och pris men visa båda som tydliga, redigerbara standarder.
- Stöd “senast använda” och kontextsortering utan att gömma full katalog.
- Gör flera behandlingar till en additiv rad, inte ett nytt separat flöde.
- Gör blockering, rast och frånvaro till nära handlingar med gemensam motor men tydlig orsak.

### Prioritet B — fel och rättelse

- Klick på egen test-/bokningspost ska öppna en tydlig detaljpanel med Ändra, Flytta, Avboka och Historik.
- Förhandsvisa alltid notifieringskonsekvens innan spara: “SMS skickas” eller “inga meddelanden skickas”.
- Lägg ångra för flytt/avbokning där domänregler tillåter det.
- Visa konflikt i kalendern innan slutlig spara, inte efter.
- Skilj tydligt på avbokning, radering och no-show.

### Prioritet C — kognitiv och visuell skalning

- Kombinera färg med initial/avatar, namn och valbar personalfilter.
- Ersätt dekorativa kritiska etiketter med hög-läsbar typografi.
- Etikettera globala ikoner vid hover/fokus och i kompakt permanent text där risken är hög.
- Använd sidopaneler framför jättelika overlays när bakgrundskontexten behövs.
- Låt mobil visa en personal eller ett teamurval i taget och behåll snabb växling.

### Prioritet D — systemstatus och administration

- Visa “Sparat”, “Opublicerade ändringar” och “Publicerat” som separata statusar.
- Låt förhandsvisning kunna växla mellan mobil, desktop och bokningsflöde.
- Håll administrationsnavigeringen grund men lägg sök/kommandopalett för sällaninställningar.
- Gör hjälp kontextuell till aktuell panel och öppna den i en mindre, flyttbar yta.

## 18. De 20 viktigaste lärdomarna, prioriterade

1. Kalendern ska vara arbetsbordet, inte en modul bakom en dashboard.
2. Dagens beläggning ska förstås utan klick.
3. Ett bokningsflöde bör börja i den kontext användaren redan ser.
4. Behandling, längd och pris ska presenteras tillsammans.
5. Personal bör ha stabil position över tid.
6. Ledig tid ska vara visuellt självklar.
7. Blockeringar ska ligga nära bokningar men ha ett eget tillståndsspråk.
8. Mät både orienteringskostnad och full transaktionskostnad.
9. Förifyll datum, tid och personal från den klickade kalendercellen.
10. Behåll kalendern synlig under behandlingsvalet.
11. Gör rättelse, flytt och avbokning lika enkla som skapande.
12. Visa notifieringskonsekvens före spara.
13. Färg får förstärka identitet men aldrig vara enda bärare.
14. Globala riskikoner behöver text och tydlig kontext.
15. Standardvärden måste vara synliga och möjliga att överstyra.
16. Administration ska vara grund och separerad från drift.
17. Förhandsvisning minskar glappet mellan inställning och kundresultat.
18. Support i kontext är värdefull men får inte dölja arbetet.
19. Desktopdensitet måste få en egen mobil modell, inte bara krympas.
20. Enkelhet ska verifieras i fel-, återställnings- och tillväxtfallen — inte bara happy path.

## 19. Säker fortsatt testmatris

För att slutföra uppdraget krävs en inloggad Wavy-flik i Codex in-app-browsern eller annan uttryckligen stödd, synlig webbläsaryta. Edge-sessionen var inte åtkomlig från denna körning.

### Läs-only först

1. Inventera kalenderkontroller och vyval utan att klicka på befintliga bokningar.
2. Öppna varje inställningskategori och dokumentera fält, standardstatus och hjälptext utan ändringar.
3. Kontrollera DOM-semantik, formulärlabels, ARIA, tabbordning och fokus.
4. Testa responsivitet genom viewportändring utan att spara något.
5. Observera laddnings- och tomtillstånd genom säker navigation, inte nätverksstörning.

### Testpost endast om nödvändigt

- Datum efter 2027-01-01.
- Tydligt fiktivt namn.
- Inget riktigt telefonnummer eller mejl.
- Notifieringar explicit avstängda före spara.
- Logga testpostens exakta tid, personal och skapandeögonblick.
- Testa skapande, flera behandlingar, flytt, ändring och avbokning endast på denna post.
- Radera endast den egna testposten efter verifiering.

### Arbetsflödesprotokoll per test

För varje flöde ska nästa revision fylla i:

- startpunkt;
- varje klick/tangenttryckning;
- obligatoriska kontra frivilliga beslut;
- förifyllda värden;
- automatisk beräkning;
- validering och fel;
- spara-/notifieringskonsekvens;
- backa/ångra;
- tid till färdig uppgift;
- desktop + mobil;
- ny användare + stressad receptionist + ägare + frisör.

## 20. Slutsats och evidensgräns

Det här materialet räcker för en stark slutsats om **varför kalendern och ingången till bokning upplevs enkla**: Wavy håller användaren i en stabil, domännära och informationsrik arbetsyta där dagens viktigaste frågor besvaras direkt. Det räcker också för att identifiera konkreta risker i tillgänglighet, skalning, overlays och ikonsemantik.

Det räcker däremot inte för att bedöma hela systemets effektivitet eller ange exakta klicktal för kompletta arbetsflöden. Den djupa liveanalysen av bokning, rättelse, kund, kassa, roller, rapporter, responsivitet och teknisk semantik återstår. Att markera detta är inte ett hål i rapporten utan en nödvändig del av dess tillförlitlighet.
