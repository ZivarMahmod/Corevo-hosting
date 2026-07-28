# Zivar Graph Studio - responsiv design

**Datum:** 2026-07-26
**Status:** Design vald, inväntar slutlig granskning före implementation
**Vald riktning:** A - grafkonsol
**Berörd app:** `5-Kod/apps/zivar-graph-studio/`

## Syfte

Zivar Graph Studio ska vara en arbetskarta för både Zivar och anslutna AI-agenter.
Grafen är huvudytan på alla skärmstorlekar. Mobilversionen ska inte vara en
förminskad desktop, och desktopversionen ska behålla sin nuvarande täta
trekolumnslayout.

Målet är att:

- göra hela grafen användbar på mobil, surfplatta och desktop;
- visa verkliga fil- och nodrelationer utan att dölja data;
- låta Codex och andra anslutna agenter använda samma lokala MCP utan att sidan
  behöver vara öppen;
- uppdatera kartan när Graphify-vakten hittar riktiga kodändringar;
- aldrig visa påhittad AI-aktivitet, tankar eller mätvärden.

## Källor och designmönster

Open Design ändras inte. Följande befintliga mönster återanvänds:

- **Worker Visualizer:** grafen är den primära arbetsytan och animation har
  informationsvärde.
- **Mobile Focus:** en huvuduppgift dominerar mobilvyn.
- **Message Center:** sidopaneler blir helskärmslager på små skärmar.
- **Live Dashboard:** tydliga brytpunkter i stället för att pressa ihop samma
  layout.

## Sanningskontrakt för AI-aktivitet

Aktivitetslagret är en loggvisualisering, inte en simulering.

1. En agentstråle visas endast för en verklig Studio-MCP-händelse med
   tidsstämpel, agentnamn och en nod eller fil som kan hittas i grafen.
2. Strålen tonas bort efter högst åtta sekunder. Ingen agent rör sig när den är
   inaktiv.
3. Vanliga terminalkommandon, filläsningar och Graphify-frågor syns inte
   automatiskt i den första versionen. De visas bara om verktyget samtidigt
   rapporterar en Studio-händelse.
4. Graphify-vaktens riktiga bakgrundsuppdateringar visas som **System**, aldrig
   som Codex eller en annan AI.
5. Aktiviteten får visa åtgärd, mål, status och tid. Den får inte visa dold
   tankegång, privata instruktioner, hemligheter eller kunddata.
6. Tokenantal och varaktighet visas endast när anroparen faktiskt har skickat
   värdena. Saknade värden märks inte som noll och uppskattas inte.
7. En annan AI syns endast om den är ansluten till samma Studio-MCP och skickar
   händelser under sitt eget agentnamn.

Automatisk spårning av exakt varje AI- och terminalanrop kräver ett separat
proxy- eller instrumenteringslager. Det ingår inte här eftersom en halvautomatisk
lösning skulle kunna ge en falsk bild.

## Responsiv struktur

### Desktop, minst 1180 px

- Behåll nuvarande tre kolumner: kontrollpanel, grafyta och informationspanel.
- Behåll minimap, full verktygsrad, alla filter och jämförelsevyer synliga.
- Grafytan får alltid återstående bredd och får aldrig kollapsa till noll.
- Nuvarande färger, täthet och arbetskänsla bevaras.

### Surfplatta, 721-1179 px

- Grafen använder hela arbetsytan.
- Kontroll- och informationspanelerna öppnas ovanpå grafen från respektive sida.
- Endast en panel är öppen åt gången.
- Väljaren A, B, Båda och Diff samt sökning finns kvar i den kompakta toppen.
- Panelerna stängs med stängknapp, Escape eller tryck utanför panelen.

### Mobil, högst 720 px

- Grafen fyller skärmen mellan en kompakt topp och en fast bottenrad.
- Toppen innehåller projektvy, anslutningsstatus och en kompakt sökingång.
- Bottenraden innehåller fyra tydliga verktyg: **Filter**, **Sök**, **Info** och
  **AI**.
- Varje verktyg öppnar en helskärmspanel. Grafen finns kvar bakom och återgår
  till samma position när panelen stängs.
- A, B, Båda och Diff ligger i en stabil segmenterad kontroll som ryms utan
  horisontell sidscroll.
- Minimap är dold som standard men kan slås på i Filter.
- Mobil i liggande läge använder samma mobilskal när pekaren är grov och höjden
  är låg.

Layouten använder `100dvh`, säkra mobilmarginaler och får inte skapa horisontell
sidscroll.

## Grafinteraktion

- Ett finger panorerar kartan.
- Två fingrar zoomar.
- Tryck på en nod väljer den och visar en smal informationsremsa ovanför
  bottenraden. Grafen täcks inte direkt.
- Dubbeltryck fokuserar nodens grannskap.
- Nodflytt är ett uttryckligt verktygsläge på mobil så att panorering inte råkar
  flytta noder.
- Desktop behåller mus, hjulzoom och befintliga Ctrl-/Shift-gester.
- Mobilens kompakta grafverktyg visar tillbaka, anpassa vy och rotation.
  Zoomknappar, markering, automatisk rotation, export och övriga verktyg finns
  under en meny. Ingen funktion tas bort.
- Etikettmängden anpassas efter tillgänglig yta. Vald nod och relevanta grannar
  har alltid etikett; underliggande data och filter ändras inte.

## Liveuppdatering

1. Graphify-vakten upptäcker en verklig filändring och uppdaterar grafkällan.
2. Servern skickar en `refresh`-händelse med tid och projekt.
3. Den öppna klienten hämtar om aktuell graf och jämförelsedata.
4. Aktiv projektvy, filter, markering och kameraposition bevaras när noderna
   fortfarande finns.
5. Endast vid en större topologiförändring används en ny automatisk inpassning.
6. Misslyckad uppdatering lämnar föregående fungerande graf synlig och visar
   tydligt att den är föråldrad.

MCP-tjänsterna fortsätter fungera lokalt även när ingen webbsida är öppen.
Cloudflare Access på `graph.corevo.se` påverkar inte Codex lokala åtkomst via
`127.0.0.1`.

## Aktivitetstillstånd

- **Inaktiv:** ingen stråle, bara anslutningsstatus.
- **Fokus:** kort stråle till en verklig nod eller fil och en tidsstämplad rad i
  AI-panelen.
- **Vybyte:** verklig händelse i loggen; stråle endast om ett verkligt mål finns.
- **Ändring:** filen markeras när den finns i grafen.
- **Fel:** tydlig felhändelse utan att fabricera mål.
- **Systemuppdatering:** separat systemmarkör när grafvakten bygger om kartan.

## Tillgänglighet, prestanda och säkerhet

- Tryckytor är minst 44 x 44 px.
- Synlig tangentbordsfokus och full desktopnavigering med tangentbord.
- `prefers-reduced-motion` stänger av rotation, puls och strålanimation.
- Canvas skalas efter enhetens pixeltäthet utan att bli suddig.
- Grafberäkning körs inte om enbart för att en panel öppnas.
- Paneler låser fokus och återställer fokus när de stängs.
- Sökfältet ska fungera när mobiltangentbordet är öppet.
- Inga kundposter, hemligheter eller dold AI-text skrivs till aktivitetsloggen.
- Befintligt Cloudflare Access-skydd och serverns värd-/origin-kontroller
  bibehålls.

## Fel- och tomlägen

- Ingen grafkälla: visa vilket projekt som saknas och en tydlig omladdningsknapp.
- MCP frånkopplad: grafen är fortsatt användbar; AI-panelen visar frånkopplad.
- Föråldrad graf: senaste fungerande karta ligger kvar med senaste lyckade tid.
- Tom sökning eller noll träffar ändrar inte grafens filter permanent.
- Panel eller vy som inte kan laddas får ett lokalt fel, inte en tom svart sida.

## Kontroll före leverans

Följande storlekar verifieras i riktig webbläsare:

- 390 x 844 och 412 x 915, mobil stående;
- 844 x 390, mobil liggande;
- 768 x 1024 och 1024 x 768, surfplatta;
- 1440 x 900, desktop.

Kontroller:

- ingen horisontell sidscroll eller överlappning;
- grafytan är synlig och icke-tom i varje storlek;
- pan, nypzoom, nodval och uttrycklig nodflytt fungerar;
- Filter, Sök, Info och AI kan öppnas och stängas;
- A, B, Båda och Diff behåller rätt data;
- mobiltangentbord skymmer inte sökresultat eller stängknapp;
- en riktig `refresh` ritar om kartan utan att kasta bort användarens vy;
- en riktig MCP-händelse syns, en inaktiv agent gör det inte;
- reducerad rörelse respekteras;
- lokal åtkomst och Cloudflare Access-kontroller fortsätter fungera.

## Ingår inte

- automatisk avlyssning av alla terminal- eller Graphify-anrop;
- visning av en agents privata tankegång;
- ett nytt MCP-proxylager;
- ändringar i Open Design-källan;
- ny färgpalett, ny grafmotor eller nya beroenden;
- en separat förenklad mobilprodukt med färre funktioner.

## Godkännandekriterium

Arbetet är klart när grafen är huvudytan och fullt användbar på samtliga
teststorlekar, desktopens funktioner finns kvar, liveuppdatering fungerar, och
varje synlig AI- eller systemaktivitet kan spåras till en verklig händelse.
