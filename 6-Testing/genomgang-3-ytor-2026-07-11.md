# Genomgångslista — de tre ytorna (audit 2026-07-11)

Prioritet: **P1** = trasigt/vilseledande (fixa först) · **P2** = halvfärdigt · **P3** = polish.
🔗 = kopplad till annan yta — ändra inte ena sidan utan att tänka på den andra.

---

## 1. SUPERBOOKING (superbooking.corevo.se) — din plattforms-yta

Vänsterpanelens huvudflikar: **Insyn** (Översikt, Fakturering, Slutkunder, Personal, Loggar) · **Kunder** (Kunder, Onboarda kund) · **Plattform** (Integrationer, Domäner, Roller, Inställningar).

### Huvudflik: Kunder → Onboarda kund (/salonger/ny) — DIN MISSTANKE STÄMMER
- [P1] **Studion är AVSTÄNGD i prod** (flaggan `ONBOARDING_STUDIO_ENABLED` är off) — i prod ser du gamla enkla formuläret, inte 12-stegs-studion. Det ensamt förklarar "helt pajad"-känslan.
- [P1] **Andra flaggan halverar den**: mall-galleriet/preview kräver även `SAJTBYGGARE_ENABLED`. Studio på + sajtbyggare av = Tema-steget visar bara 6 inbyggda teman fast texten lovar mallar.
- [P1] **Första skärmen är en dubblett av kundlistan** — klickar man "Onboarda kund" landar man på ännu en Kunder-lista med egen knapp innan wizarden ens startar.
- [P1] **Två döda stat-kort** på den skärmen ("Bokningar·mån", "Underlag·mån" = hårdkodade "—").
- [P2] **Steg 5 "Placera & ordna" är en tom stub** — gör ingenting, mitt i flödet.
- [P2] **Steg 6 "Modulinställningar" är läs-bara** — inga inputs.
- [P2] **Logo-uppladdning i Branding-steget är en placeholder** (ingen fil-input); hinten lovar även font-val som inte finns.
- [P2] **"Klicka & skriv direkt i previewen" är inte byggt** — previewen är låst (pointer-events none), texten lovar det ändå.
- [P2] **Går att lansera salong med noll tjänster** — live-gaten kräver bara namn+slug+tema.
- [P2] **Slug-krock upptäcks först vid Lansera** — ingen unikhetskoll under vägen.
- [P2] **Onboardingen fångar aldrig kontakt/adress/öppettider** — ny kund föds tom och måste kompletteras i kundkortet efteråt.
- 🔗 **Allt onboardingen gör finns rikare i kundkortet** (tjänster, moduler, ägar-invite, sidtext). Beslutfråga för genomgången: ska studion vara ett tunt "namn+slug+tema+ägare → resten i kundkortet", eller byggas färdig? Idag är den ett halvfärdigt mellanting.

### Huvudflik: Kunder → Kunder (/salonger, kundkortet /salonger/[id])
Underflikar i kundkortet: Översikt, Tjänster, Kunder, Personal, Sida, Integrationer, Drift — alla riktiga och wired ✓.
- [P2] Integrationer: **egen domän-fältet är disabled** (parkerad funktion som ändå syns).
- [P2] Integrationer: SMS-raden är statisk text, inte per-kund-status.
- [P3] 🔗 **Namn-krock i menyn**: "Slutkunder" (/kunder) och "Kunder" (/salonger) — din gamla IA-idé (tenants = Kunder, sortera per bransch) ligger kvar obyggd.

### Tvärgående (viktigast på hela superbooking)
- [P1] 🔗 **Sidtexten har TRE redigeringsytor**: onboarding-stegen, kundkortets Sida-flik och kundens /admin/sida skriver alla samma `settings.copy`/branding. Tre håll → risk att skriva över varandra. Genomgångsbeslut: en kanon-yta (SidaStudio) + onboarding skriver bara startvärden.

---

## 2. BOOKING (booking.corevo.se) — kundens admin (FreshCut)

Vänsterpanelens huvudflikar: **Din dag** (Översikt, Bokningar) · **Hantera** (Kunder, Tjänster, Personal, Platser, Scheman) · **Moduler** (gatade: Bildbibliotek, Webshop, Blogg, Offerter, Lojalitet, Presentkort) · **Din sida** (Redigera sidan, Inställningar).

Dashboard = riktig data hela vägen ✓ (inga fantom-siffror).

### Huvudflik: Din dag → Bokningar
- [P1] **Skapa bokning är gömd/splittrad**: huvudsidan Bokningar kan inte skapa något — alla CTA:er skickar ut till publika sajten — medan Bokningsvyn (kiosken) är enda stället med drop-in. En ägare som tar en telefonbokning måste gissa sig till kiosken. Fix-idé: samma 2-tryck-bokning även på Bokningar-sidan.

### Huvudflik: Hantera → Personal + Scheman
- [P2] 🔗 **Bokningsbarheten skrivs nu från två ställen** (Personal-drawern och Scheman-kortet "Kan bokas" — medvetet efter din begäran, men bör sägas högt på genomgången: samma data, två dörrar).
- [P2] **Att göra en ny medarbetare bokningsbar är fortfarande 2 sidor + schemalås**: skapa i Personal → tjänster+aktiv → Scheman → "Lås upp" → tider. Kan komprimeras till en guidad följd.

### Huvudflik: Din sida → Redigera sidan
- [P2] **Ledtext på Tjänster-fliken pratar super-adminspråk** ("kundkortets Tjänster-flik") — salongsägaren har inget kundkort. Delad komponent, fel ord för rollen.
- [P2] 🔗 **Kontaktuppgifter redigeras på två ställen** (Sida→Kontakt och Inställningar) utan korshänvisning — tredje stället är ditt kundkort.
- [P3] 🔗 **Öppettider = två begrepp** (publika öppettider i Sida vs bokningsbara tider i Scheman). Texten förklarar nu, men värt att visa kunden.
- [P2] **/admin/sajtbyggare är en vilande konkurrerande sido-editor** (flaggad av, utanför nav) — radera eller medvetet parkera, annars två sanningar om den slås på.

### Huvudflik: Din sida → Inställningar
- [P2] **Död toggle "Drop in eller boka online — kopplas på snart"** — ärligt märkt men halvfärdig.

### Moduler
- [P3] Offerter visar intern config-sträng ("Variant: …") för ägaren.

---

## 3. MINBOOKING (minbooking.corevo.se) — frisörens yta

Vänsterpanelens flikar: **Idag** (/personal) · **Mitt schema** (/personal/arbetstider) · **Frånvaro** (/personal/franvaro). Klientkort + PII-flödet är komplett och robust ✓. Dag-bläddring + hemskärms-app nybyggt ✓.

### Globalt
- [P1] **Frisören heter sin e-postadress överallt** — sidebar/avatar/eyebrow visar e-postens första del ("klippare"), aldrig namnet från staff-raden. Genomgående irritation i en app man har i fickan.
- [P2] Eyebrow-texten svarar olika på "vem är jag" på de tre sidorna.

### Idag
- [P1] 🔗 **Walk-in-formuläret matchar inte kioskens 2-tryck-flöde**: ingen förvald tjänst, tiden knappas in för hand som datum+klockslag, ingen visning av lediga luckor. Kioskens DropIn-mönster (tryck ledig tid → boka) borde återanvändas här.
- [P3] Ledtexten "tryck på en kund för att minnas…" gäller inte gäster/walk-ins (inget klientkort att öppna).

### Mitt schema
- [P1] **"Vecka …"-knappen är död** — ser ut som veckobläddring, gör ingenting.
- [P1] **7-kolumners rutnät på telefon** — oläsbart smalt i hemskärms-appen; behöver mobil-lista.
- [P2] Read-only utan att säga det — ingen text om att admin äger tiderna.
- [P3] "Ledig"-etiketten betyder arbetsfönster, läses som "ledig lucka".

### Frånvaro
- [P2] "Skicka anmälan" antyder godkännande-flöde som inte finns (sparas direkt).
- [P3] datetime-local för hel semestervecka — klumpigt på mobil, datum-väljare räcker.

### Saknas för frisören
- [P2] **Vecka-som-lista** ("mina bokningar kommande vecka" scrollbar) — finns inte, bara dag-för-dag.
- [P2] **Notiser** — appen uppdaterar tyst; ny bokning/avbokning syns inte om appen är stängd (PWA-push är nästa naturliga steg).

---

## Föreslagen genomgångsordning
1. **Onboarding-beslutet** (superbooking): flaggorna + tunt-eller-fullt + döda stegen — störst röra, styr resten.
2. **En sanning för sidtexten** (alla tre skriv-ytorna) — arkitekturbeslut innan mer byggs på Sida.
3. **Frisör-P1:orna** (namn istället för e-post, död Vecka-knapp, mobil-schema, walk-in 2-tryck) — appen är nu i frisörens ficka, dessa syns varje dag.
4. **Skapa bokning i admin** (telefonbokning utan att gå via kiosken).
5. P2-städning per yta (döda toggles, ledtexter, dubbelvägar).
