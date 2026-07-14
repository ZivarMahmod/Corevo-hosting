# 06 — Byggordning och acceptans

## Varför ordningen är viktig

Kund-adminens gamla och nya visuella skal är olika. Om kalenderfunktionerna först byggs i det gamla skalet och adminen därefter designas om skapas dubbelarbete, fler regressioner och två parallella komponentmönster.

Därför byggs den permanenta ramen före den stora bokningsytan.

## Beslutad ordning

### Steg 0 — exakt designunderlag

Före UI-kod tas ett Codex Design-underlag fram i `4-Dokument-Underlag/01-acceptans/` eller annan av AGENTS tillåten underlagsmapp enligt uppdragets form.

Underlaget ska visa minst:

- kund-adminens desktopskal;
- responsivt skal;
- Översikt;
- toppnavigation och alla tillstånd;
- Kalender i normal, tom, tät och feltillstånd;
- bokningsdrawer för skapa och befintlig bokning;
- Inställningars lokala navigation;
- Redigera sidan-ingången;
- laddar, tomt, fel, sparar och sparat.

När paketet finns gäller AGENTS-regeln: exakt kopia, inga improviserade värden och mekanisk 0-FAIL-verifiering.

### Steg 1 — adminskal och Översikt

Bygg den gemensamma visuella grunden:

- ljus toppnavigation;
- verksamhetsidentitet;
- de fem huvudvalen;
- konto-/profilmeny;
- platsväljare där relevant;
- responsiv navigation;
- ny Översikt i samma exakta design;
- befintlig tenantisolering och behörighet kvar.

Befintliga admin-sidor kan tillfälligt renderas inuti det nya skalet, men ingen sida får ha två globala navigationssystem samtidigt.

### Steg 2 — kalenderarbetsbordets dataläge

Förena befintliga bokningsdata, lediga tider, personal/resurser, platser och blockeringar i en tidsgeometrisk dagvy.

Först bevisas:

- korrekt tidszon;
- start/slut och varaktighet;
- stabil resursordning;
- krockskydd;
- platsfilter;
- tomma och täta dagar;
- uppdatering mellan två sessioner.

### Steg 3 — gemensam bokningsdrawer

Bygg samma yta för:

- skapa bokning;
- hitta/skapa kund;
- öppna bokning;
- ändra;
- flytta;
- avboka;
- historik;
- notifieringskonsekvens.

Detta stänger Corevos viktigaste funktionsgap mot Wavy: vanlig adminbokning och full rättelse i samma arbetsyta.

### Steg 4 — blockeringar och schemaundantag

- skapa blockering från kalendern;
- enkel och återkommande blockering;
- denna/framtida instanser;
- borttagning med historik;
- koppling till basöppettider och schema.

### Steg 5 — Inställningar och Redigera sidan

- nytt inställningsskal;
- mappa befintliga funktioner till de nio kategorierna;
- ta bort duplicerad sajtdata;
- tydliga statusar för intern spara respektive publik publicering;
- behåll sajtbyggaren som Redigera sidan.

### Steg 6 — inloggning och sessionspolish

- verifiera beständig session;
- säker retur efter login;
- lösenords- och sessionshantering;
- TOTP-flöde enligt separat säkerhetsgoal om det inte redan är komplett;
- inget SMS-beroende.

### Steg 7 — SMS som separat senare del

SMS får ett eget beslut/goal efter att kalender, e-post och faktureringshook är stabila. Det ska inte blockera kund-adminens redesign eller bokningsparitet.

## Acceptans per yta

### Adminskal

- Visuellt exakt mot godkänt designpaket.
- Kund-admin och superadmin tillhör tydligt samma produktfamilj.
- Kund-admin visar aldrig superadminfunktioner.
- Ingen mörkgrön global sidebar finns kvar.
- Aktiv huvudyta är tydligt markerad.
- Navigation fungerar med tangentbord och mobil.

### Översikt

- Dagens bokningar och nästa kunder bygger på verklig data.
- Kalender nås med en tydlig handling.
- Döda modulkort visas inte.
- Varningar leder till en konkret lösning.
- Översikten innehåller inte en andra full kalender.

### Kalender

- Ett klick från Översikt öppnar dagens arbetsbord.
- Ingen mellanliggande bokningsdashboard.
- Personal/resurser, tid, bokning och blockering visas korrekt.
- Bokning kan skapas från synlig kontext.
- Befintlig och ny kund hanteras i samma flöde.
- Bokning kan ändras, flyttas och avbokas utan sidbyte.
- Blockering kan skapas utan separat schemavy.
- Konflikt, notifiering och serverstatus är explicita.
- Tangentbord, 200 procent zoom och reduced motion fungerar.

### Inställningar

- Varje inställning har ett enda hem.
- De nio kategorierna är begripliga och grunda.
- Publik sajtredigering dupliceras inte.
- Spara/publicera har separata och korrekta statusar.
- Avancerade fält stör inte grunduppgiften.

### Inloggning och notiser

- E-post/lösenord fungerar utan SMS.
- Giltig session består mellan sidbyten och normal återöppning.
- Notisens kanal syns före bokningen sparas.
- Bokning och notis har separata statusar.
- Personalbokning kan skapas med endast namn.
- Publik bokning kräver minst en kontaktväg.

## Wavy-migreringstest

En Wavy-van användare ska utan utbildning kunna:

1. hitta dagens bokningar;
2. boka en befintlig kund;
3. boka en ny kund;
4. flytta en bokning till annan tid/resurs;
5. avboka och förstå notifieringskonsekvensen;
6. blockera en tid;
7. ändra en tjänst eller öppettid;
8. hitta Konto och säkerhet;
9. öppna Redigera sidan.

Testet mäter:

- tid till uppgift;
- antal meningsfulla beslut;
- fel;
- behov av hjälp;
- förmåga att återhämta sig från fel;
- om användaren förstår vad som skickas till kunden.

## Mekanisk verifiering

Varje senare goal ska ange:

- exakta acceptansspecar från designpaketet;
- tester för auth/tenantgränser;
- enhetstester för tidszon, luckor och konflikter;
- integrationstester för skapa/flytta/avboka/blockera;
- webbläsartest för kärnresorna;
- tillgänglighetskontroll;
- oberoende verifierare för designen;
- Zivars manuella testlista i `6-Testing/`.

“Klar” betyder inte att sidan ser ungefär rätt ut eller att kod har skrivits. Klar betyder att funktionen är mekaniskt verifierad, användartestad och placerad i rätt klart-kategori enligt AGENTS.

## Nästa dokumentsteg

1. Zivar granskar och godkänner denna mapp.
2. Ett exakt visuellt designunderlag tas fram.
3. Designunderlaget granskas och låses.
4. En detaljerad implementationplan skrivs.
5. Första goal skapas för adminskal + Översikt.

Ingen kod ska byggas från denna högnivåtext utan det exakta designunderlaget.
