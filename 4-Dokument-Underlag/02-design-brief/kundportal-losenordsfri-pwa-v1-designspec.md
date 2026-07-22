# Designspecifikation — lösenordsfri kundportal/PWA v1

**Status:** styrande brief till Claude Design/Fable 5
**Produkt:** Corevo, generell multi-branschplattform
**Primär yta:** `https://mina.corevo.se`
**Primär målgrupp:** en besökare som just bokat hos ett Corevo-anslutet företag
**Prioritet:** mobil först, fullvärdig desktop med samma informationsarkitektur
**Språk i första leveransen:** svenska, men all produkttext ska ligga så att fler språk kan läggas till
**Designkanon som ska respekteras:** befintliga kundportalprototyper i `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/05-kundportal/`

## 1. Uppdraget till Claude Design

Skapa ett komplett, interaktivt och implementationsbart acceptanspaket för Corevos nya lösenordsfria kundportal. Paketet ska visa den faktiska lanseringsprodukten, inte en vision och inte ett vanligt konto med e-post/lösenord.

Kunden ska uppleva samma enkelhet som i Wayvs bokningshantering: boka på företagets webbplats, få ett SMS, trycka på länken och omedelbart se rätt bokning. Corevo ska samtidigt vara tydligare, modernare, säkrare, mer tillgängligt och redo för fler branscher.

Claude Design får fatta visuella detaljbeslut inom tokens och kontrakt nedan, men får inte ändra produktflöde, informationshierarki, texter med säkerhetsbetydelse, aktiva/inaktiva funktioner eller routes. Inga döda knappar får finnas i prototypen.

## 2. Produktprinciper som inte får ändras

1. Bokningen sker på det anslutna företagets publika webbplats, normalt på dess `/boka`-flöde.
2. Ingen vanlig `Logga in`-knapp eller kontoregistrering ska krävas på företagets webbplats.
3. Den valda kontaktkanalen verifieras med sexsiffrig PIN innan den första bokningen färdigställs på en ny eller obetrodd enhet. SMS/mobil är normalläget; e-post är ett uttryckligt fallbackläge när SMS-health säger att SMS inte kan användas.
4. Bokningen skapas först efter godkänd PIN. Fel eller utgången PIN får aldrig skapa en bokning.
5. Bekräftelse-SMS:et innehåller den personliga länken till kundportalen.
6. Länken öppnar en separat Corevo-yta på `mina.corevo.se`; den öppnar inte ägaradmin, personaladmin eller det gamla lösenordskontot.
7. Första giltiga öppningen byter den hemliga engångslänken mot en säker, hostlåst enhetssession och tar bort hemligheten ur URL:en.
8. Efter utbytet är den synliga adressen alltid tokenfri, normalt `/mina` eller `/mina/bokningar/[id]`.
9. Portalen är företagsspecifik i v1. Kunden ser endast relationen och bokningarna hos företaget som länken avser.
10. Det framtida globala Corevo-kontot, `Mina företag`, erbjudanden, lojalitet och push bevaras arkitektoniskt men visas inte som aktiva funktioner i v1.
11. Produkten är generell. Använd orden `företag`, `plats`, `tjänst`, `personal` och `bokning` i generiska komponenter. FreshCut får användas som exempeldata i mocken, men strukturen får inte kodas som ett frisörspecialfall.

## 3. Vad som byggs nu och vad som hålls inaktivt

### 3.1 Aktivt i v1

- säker öppning från bekräftelse-SMS;
- företagsspecifik kundöversikt;
- kommande bokningar;
- tidigare, avbokade och övriga avslutade bokningar;
- bokningsdetalj;
- avbokning med regelkontroll och bekräftelsedialog;
- kalenderexport;
- boka igen på företagets publika bokningssida;
- visa och redigera namn;
- visa den serverstyrda primära verifierade kontakten (`sms` eller `email`) och endast de sekundära kontaktuppgifter som faktiskt finns;
- en serverstyrd verifierad kontaktidentitet av typen `sms` eller `email`;
- säkert byte eller tillägg av primär kontakt efter step-up-PIN till nuvarande primära kontakt och en separat PIN till den nya destinationen;
- enhetssessioner, aktuell enhet, logga ut och återkalla andra sessioner;
- återhämtning när länken är utgången, förbrukad eller felaktig;
- installerbar PWA med separat Android- och iPhone-hantering;
- hjälp, integritet och tydliga fel-/tom-/laddningslägen;
- responsiv mobil, tablet och desktop;
- e-postbaserad motsvarighet när bokningsflödet uttryckligen har fallit tillbaka till e-post därför att SMS-gatewayen är otillgänglig.

### 3.2 Förberett men helt dolt/inaktivt i v1

- globalt Corevo-kundkonto;
- `Mina företag`/`Mina ställen`-hub;
- lösenord, Google-, Apple- eller annan social inloggning;
- pushnotiser;
- erbjudanden och marknadsföring;
- klippkort, poäng, lojalitet och rekommendationer;
- webshopbeställningar i den här portalen;
- favoriter och favoritpersonal;
- ombokning inne i portalen;
- väntelista/`tidigare tid`;
- kvitto och betalningshistorik;
- riktig native-app.

Inaktivt betyder: ingen synlig knapp, tom meny, `kommer snart`-ruta eller halvaktiv route i lanseringsytan. Befintlig kod för funktionerna ska bevaras och avgränsas, inte raderas.

## 4. Förhållande till befintlig designkanon

Följande ska återanvändas från de tre befintliga kundportalprototyperna:

- mörk Corevo-identitet;
- neutral Corevo-ram runt företagets varumärke;
- Instrument Sans för produkttext och IBM Plex Mono för etiketter, tider och statusmetadata;
- tydlig `Nästa bokning`-hierarki;
- företagets identitet inuti kundytan, aldrig som säkerhetsgräns;
- mobil bottennavigation och desktopstruktur som känns som samma produkt;
- kort, statuschips, avbokningsdialog och installationsyta som visuella mönster.

Följande befintliga beteenden är uttryckligen ersatta i v1:

- gästläget med `Skapa konto`/`Logga in`;
- lösenordsbyte i profil;
- globala `Mina företag` som aktiv startsida;
- lojalitet, beställningar, push och marknadsföring som synliga v1-funktioner;
- konto-/claimflödet under `/konto/koppla/[token]` som kundens nya dörr;
- tokenkonsumtion i en vanlig GET-rendering.

Den gamla desktoplayoutens tvåkolumnsstruktur och gamla navigationsetiketter är också uttryckligen ersatta. Det som fortfarande är visuell kanon från det gamla desktopunderlaget är färg-/typidentitet, kortanatomi, dialogmönster och hierarkin Corevo-skal → företag → bokning. Den nya treområdesnavigationen i avsnitt 7 styr layouten.

## 5. Visuell grund

Claude Design ska börja i följande befintliga tokens och endast introducera en ny token om den dokumenteras i acceptanspaketet.

| Token | Värde | Användning |
|---|---:|---|
| `--bg` | `#121210` | appbakgrund |
| `--surface-1` | `#1C1C18` | primära kort, topp-/bottennav |
| `--surface-2` | `#25251F` | sekundära fält och informationsytor |
| `--surface-3` | `#2E2E28` | hover, avatar och valda kontroller |
| `--ink-1` | `#F0F0EA` | primär text |
| `--ink-2` | `#C8C8BD` | sekundär text |
| `--ink-3` | `#96968C` | metadata; får inte användas om kontrasten blir under AA för faktisk brödtext |
| `--line-1` | `#33332C` | diskreta linjer |
| `--line-2` | `#4A4A41` | starkare linjer/fokusnära avgränsning |
| `--action` | `#2F5F47` | primär knapp |
| `--action-hover` | `#3A7357` | hover/active |
| `--action-text` | `#E9F2EC` | text på primär knapp |
| `--positive` | `#9AC4A5` | bekräftat/aktivt |
| `--warning` | `#D6AC6A` | varning/policygräns |
| `--negative` | `#D68F85` | destruktiv handling/fel |

### 5.1 Typografi

- Rubriker och brödtext: `Instrument Sans`.
- Tider, statusetiketter, små överrubriker och teknisk metadata: `IBM Plex Mono`.
- Mobil sidrubrik: 24–28 px, vikt 700, radavstånd högst 1,15.
- Desktop sidrubrik: 30–36 px, vikt 700.
- Brödtext: minst 15 px mobil och 15–16 px desktop.
- Metadata: minst 12 px. Text som bär viktig information får aldrig vara 9–10 px trots att äldre mockar använder det.
- Systemets dynamiska textzoom till 200 % ska fungera utan överlappning eller bortklippning.

### 5.2 Form, rytm och rörelse

- Bassteg för spacing: 4 px. Vanliga avstånd: 8, 12, 16, 20, 24 och 32 px.
- Kort: 14–16 px hörnradie, 1 px kant. Ingen dekorativ glassmorphism.
- Kontroller: minst 44 × 44 px, helst 48 px på mobil.
- Primär knapp: minst 48 px hög, tydlig text, aldrig endast ikon.
- Fokus: synlig 2 px fokusram med minst 3:1 kontrast mot både kontroll och omgivning.
- Animationer: 120–200 ms för diskreta tillstånd. Respektera `prefers-reduced-motion` och använd då ingen förflyttningsanimation.
- Destruktiva handlingar ska inte ligga direkt intill primär CTA utan tydlig separation.

## 6. Informationsarkitektur och routes

### 6.1 Publika/bootstrap-routes

| Route | Syfte | Session |
|---|---|---|
| `/oppna/[tenantSlug]#<token>` | neutral laddningssida som läser fragmentet lokalt och POST:ar det för utbyte | ingen före utbyte |
| `/aterhamta/[tenantSlug]` | ett fält `Mobilnummer eller e-post`; servern väljer endast en redan verifierad kanal för relationen och svarar neutralt | ingen; rate-limitad |
| `/verifiera/[tenantSlug]` | matar in sexsiffrig kod från den servervalda SMS- eller e-postkanalen | challenge-cookie, ingen portaldata |
| `/hjalp` | generell hjälp utan personuppgifter | ingen |

Fragmentet används därför att länkscanners och förhandsvisningar gör GET-anrop. Fragmentet skickas inte till servern i GET. JavaScript gör ett explicit POST-utbyte och kör omedelbart `history.replaceState` innan annan navigation eller analytics får starta.

### 6.2 Skyddade routes

| Route | Mobil vy | Desktop vy |
|---|---|---|
| `/mina` | Hem/Bokningar | översikt i huvudkolumn |
| `/mina/historik` | Historik | historik i huvudkolumn |
| `/mina/bokningar/[id]` | fullskärmsdetalj med tillbaka | detaljsida/bred detaljpanel med korrekt URL |
| `/mina/profil` | Profil | profil i huvudkolumn |
| `/mina/sakerhet` | Säkerhet och enheter | säkerhet i huvudkolumn |
| `/mina/installera` | installationshjälp | installationshjälp |
| `/mina/integritet` | kort integritetsförklaring och datarättigheter | samma innehåll |

Alla skyddade routes kräver en giltig kundportalsession. Saknas session visas inte en generisk inloggning. Användaren förs till en återhämtningsvy som förklarar att den säkra länken finns i bokningsbekräftelsen.

## 7. Navigation

### 7.1 Mobil, bredd under 768 px

Fast toppfält:

- vänster: neutral textlogotyp `COREVO`;
- under/vid logotypen: `MINA BOKNINGAR` i mono;
- höger: cirkulär profilknapp med initialer eller neutral personikon;
- profilknappen går alltid till `/mina/profil`, samma mål som bottennavets `Profil`;
- företagets logotyp ska inte ersätta Corevos säkerhetsidentitet i toppfältet.

Fast bottennavigation med safe-area:

1. `Bokningar` — kalenderikon;
2. `Historik` — klocka/historikikon;
3. `Profil` — personikon.

Krav:

- varje navmål minst 64 px brett och 52 px högt före safe-area;
- aktivt mål har text, ikon och tydlig positiv markering; färg är inte enda signalen;
- detaljsidor visar en riktig `Tillbaka`-knapp i toppfältet och bevarar webbläsarens historik;
- Androids systemtillbaka och webbläsarens tillbaka ska ge samma logiska resultat;
- ingen hamburgarmeny i v1.

### 7.2 Tablet, 768–1023 px

- samma tre informationsområden;
- toppfältet kvar;
- mobilens fasta bottennavigation behålls till och med 1023 px;
- innehåll max 760 px och centrerat;
- dialoger kan vara centrerade, men mobilnära bottom sheet är tillåtet i stående läge.

### 7.3 Desktop, minst 1024 px

- global toppbar 56 px: `COREVO · MINA BOKNINGAR`, kundens förnamn/initialer och en diskret `Logga ut`-åtgärd;
- innehåll max 1248 px (`232 + 680 + 288 + 2 × 24`);
- vänster navigationskolumn cirka 220–240 px med `Bokningar`, `Historik`, `Profil`;
- huvudkolumn 640–720 px;
- höger stödkolumn 260–320 px för företagskontakt, installation och hjälp när innehållet motiverar den;
- vid 1024–1247 px faller högerkolumnen under huvudkolumnen;
- samma kortordning, etiketter och actions som mobil. Desktop får inte introducera egna funktioner.

## 8. Första öppningen från SMS eller e-post

### 8.1 SMS-textens länkkontrakt

Exempel:

`FreshCut: Din tid för Skäggtrim är bokad ons 22 juli 11:00. Se och hantera bokningen: https://mina.corevo.se/oppna/freshcut#<hemlighet>`

Avsändarnamnet styrs av notifierings-/gatewaylagret och är inte en del av portalens autentisering. Tenantnamnet ska också finnas i texten så att kunden förstår sammanhanget även om ett gemensamt Corevo Sender ID används.

När bokningen verifierades via e-post används samma portal-URL i ett transaktionellt bekräftelsemejl. Bootstrap, single-use, session och tenantgräns är identiska. UI-copy säger `bekräftelsemejl` och visar en maskerad e-postadress i stället för telefon.

### 8.2 Bootstrapskärm

Visa omedelbart:

- Corevo-identitet;
- neutral spinner/skeleton;
- rubrik `Öppnar din bokning`;
- text `Vi kontrollerar länken säkert. Det tar oftast bara ett ögonblick.`

Visa aldrig:

- telefonnummer;
- kundnamn;
- bokningsdetaljer;
- token eller tekniskt fel-ID;
- falsk `Logga in`-knapp.

När utbytet lyckas:

1. säker cookie sätts;
2. fragmentet tas bort;
3. användaren navigeras med `replace` till den bokning som skapade länken om den fortfarande finns, annars till `/mina`;
4. första värdefulla sidan visar innehållet direkt utan välkomstkarusell.

Om JavaScript är avstängt kan fragmentet inte utbytas. Serverrenderad `<noscript>` visar rubriken `JavaScript behövs för att öppna den säkra länken`, texten `Aktivera JavaScript och ladda om sidan, eller be om en ny kod. Inga bokningsuppgifter har visats.` samt fungerande länkar till `/aterhamta/[tenantSlug]`, tenantens publika bokningssida och `/hjalp`. Ingen persondata eller token återges.

### 8.3 Giltig men redan förbrukad länk

- Finns en giltig session på samma enhet: öppna rätt portal/bokning utan ny PIN.
- Saknas session: visa `Länken har redan öppnats på en annan enhet` och primärknappen `Skicka ny kod`.
- Kunden får inte veta om något annat telefonnummer eller kundkonto finns.

### 8.4 Utgången/felaktig länk

Visa:

- rubrik `Länken kan inte användas`;
- neutral förklaring som täcker felaktig, utgången och återkallad länk;
- primärknapp `Skicka ny kod`;
- sekundär länk `Till företagets bokningssida`;
- hjälptext om att kontakta företaget om den verifierade kontaktuppgiften har bytts.

Känd och okänd uppgift ska ge samma statuskod, responsform och copy samt en likvärdig serverväg. Svaret returneras innan asynkron leverans. Perfekt identisk nätverkstid utlovas inte, men avsiktliga skillnader som möjliggör enumeration får inte införas.

## 9. PIN och betrodd enhet

### 9.1 PIN i det publika bokningsflödet

PIN-vyn ligger kvar som steg 4 av 5 i bokningsdialogen. Den ska ha dessa exakta tillstånd:

| Tillstånd | UI och tillåtna handlingar |
|---|---|
| `sending` | låst primärknapp, spinner, ingen dubbelklicksmöjlighet |
| `sent` | sex separata visuella positioner men ett semantiskt inputfält, maskerad verifieringsdestination, `Ändra mobilnummer` eller `Ändra e-post` |
| `invalid` | inlinefel, kvarvarande försök, fokus tillbaka till kodfältet |
| `cooldown` | `Skicka ny kod om 00:xx`; kontrollen är inaktiv tills tiden gått |
| `resend_ready` | `Skicka ny kod`; ny kod ogiltigförklarar gammal |
| `expired` | `Koden har gått ut`; begär ny kod om tidsreservationen finns kvar |
| `max_attempts` | challenge låst; starta ny challenge, ingen bokning |
| `delivery_failed` | kanalriktig text; prova igen, ändra kontakt eller starta ett nytt uttryckligt fallbackflöde |
| `slot_lost` | förklara att tiden hann tas och gå tillbaka till lediga tider |
| `verified` | bokningen färdigställs en gång; därefter bekräftelsesteg |

Inputkrav: `inputmode="numeric"`, `autocomplete="one-time-code"`, klistra in hela koden, automatisk men inte för tidig submit efter sex siffror, skärmläsaretext och tydlig felannonsering.

PIN-digest är aldrig en vanlig hash. Den ska följa det befintliga kontraktet i `lib/booking/verification.ts`: HMAC-SHA-256 med separat minst 32-byte versionshanterad serverpepper och domänseparation. MAC-underlaget binder alltid `tenant`, `purpose`, challenge-id, aktuell session när sådan finns, kanal och en serverberäknad kontakt-digest. För en befintlig relation binds den dessutom till `customer/relation-id`. För en helt ny kund, där relationen skapas först efter PIN, används i stället ett subject-binding av typen `new_contact` med `tenant + channel + HMAC-SHA-256(identityPepper, normalizedDestination)`; rå destination ingår aldrig i lagrad challenge. Giltighet är fem minuter, högst fem felaktiga försök och 30 sekunders cooldown före omskick.

### 9.2 Steg 5 — bokningsbekräftelse på företagshosten

Efter godkänd PIN stannar kunden i den publika bokningsdialogen och ser ett tenant-brandat steg 5. Det är inte kundportalen och kräver ingen portalcookie.

Normal vy:

- rubrik `Bokningen är klar`;
- faktisk status: `Bekräftad` eller `Förfrågan mottagen`;
- datum, tid, tjänst, personal/valfri personal, faktisk plats och pris om det finns;
- `Bekräftelse skickad till [maskerad destination]`;
- hjälptext `Öppna länken i meddelandet för att se och hantera bokningen.`;
- primär CTA `Lägg i kalender`;
- sekundär CTA `Boka en tid till` till tenantens bokningsstart;
- `Stäng` stänger overlayn eller går till tenantens startsida på fristående `/boka`.

Leveranslägen efter att bokningen verkligen har skapats:

- `gateway_persisted`: gatewayen har tagit emot jobbet i sin krypterade, beständiga kö; `Bokningen är klar. Bekräftelsen är på väg till [maskerad destination].`;
- `submitted`: modemet/e-posttransporten har accepterat submit; normaltexten ovan får använda `Bekräftelsen är skickad till [maskerad destination]`;
- `delivered`: verklig leveransrapport finns; samma normaltext, ingen extra framgång får krävas av UI;
- `delivery_failed`: `Bokningen är klar, men bekräftelsen kunde inte levereras.` + verklig, rate-limitad och idempotent CTA `Skicka bekräftelsen igen` + företagskontakt;
- `unknown`: `Bokningen är klar. Vi kontrollerar leveransen av bekräftelsen.`; ingen automatisk dubblettsändning;
- ingen text i dessa lägen får påstå att bokningen saknas.

Om PIN/finalisering misslyckades innan bokningen skapades visas en separat felvy: rubrik `Bokningen kunde inte slutföras`, text `Ingen bokning skapades.` och primär CTA `Tillbaka till lediga tider`. Detta state får aldrig återanvända lyckad-bokningslayout.

### 9.3 PIN-fri bokningsenhet

Efter en lyckad PIN får företagets egen host sätta cookien `__Host-corevo-booking-trust`. Den är `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, saknar `Domain`, innehåller en publik post-id + minst 256-bitars slumphemlighet och motsvarar en serverlagrad tenant- och kundbunden trust-post där endast hemlighetens hash lagras. Inaktivitetsgränsen är 180 dagar och absolut max 365 dagar.

På nästa bokning hos samma företag och samma browser:

- namn och den verifierade SMS- eller e-postkontakten kan förifyllas;
- UI visar `Verifierat mobilnummer` eller `Verifierad e-post`;
- kunden kan boka utan ny PIN så länge trusten är giltig och riskreglerna inte kräver ny kontroll;
- `Använd en annan kontaktuppgift` bryter trustflödet och kräver ny PIN;
- andra tenants får aldrig läsa eller återanvända trusten.

Ny browser, inkognitoläge, raderade cookies, återkallad enhet, riskhändelse eller passerad giltighet kräver ny PIN. Telefon-/primärkontaktbyte och GDPR-radering återkallar alla sådana trusts.

### 9.4 Kundportalsession

SMS- eller e-postlänkens utbyte skapar en separat session på `mina.corevo.se`. Den får inte vara en Supabase Auth-login och får inte ge någon roll i backoffice.

- hostlåst cookie `__Host-corevo-portal` med `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` och inget `Domain`;
- 180 dagars inaktivitetsgräns, högst 365 dagar absolut;
- roterbar sessionshemlighet, endast hash i databasen;
- uppdatera `last_seen_at` högst periodiskt, inte vid varje asset-request;
- step-up-PIN via den nuvarande serverstyrda verifieringskanalen krävs för kontaktbyte och andra känsliga identitetsåtgärder; kontaktbyte kräver dessutom separat PIN till den nya destinationen. Återhämtning använder en egen purpose-bunden challenge;
- varje dataread och mutation kontrollerar session, tenant, customer och objektägarskap server-side.

## 10. Vy: Bokningar `/mina`

### 10.1 Företagshuvud

Överst i innehållet, efter Corevo-skalet:

- företagets logotyp eller säker initialfallback;
- företagsnamn;
- verksamhetstyp och ort om data finns;
- `Ring` som riktig `tel:`-länk;
- `Hitta hit` endast om adress/kartlänk finns;
- ingen full hero-bild i v1 — bokningen ska synas ovanför vikningen på normal mobil.

### 10.2 Nästa bokning

Det första kortet när en aktiv bokning finns:

- etikett `NÄSTA BOKNING`;
- veckodag, datum och klockslag i lokal tidszon;
- tjänstens namn;
- längd om känd;
- personalens publika titel/namn eller `Valfri personal`;
- plats/adress;
- pris eller prisintervall om det finns; visa aldrig fabricerat pris;
- statuschip `Bekräftad` eller `Förfrågan mottagen`;
- primär CTA `Visa bokningen`;
- sekundär CTA `Lägg i kalender`;
- diskret destruktiv textknapp `Avboka` endast när onlineavbokning är tillåten.

Om flera kommande bokningar finns visas nästa stort och resterande i en kompakt lista under rubriken `Fler kommande`.

### 10.3 Boka igen/ny tid

Under kommande bokningar:

- sekundär knapp `Boka en tid till` när en aktiv bokning finns; `Visa bokningen` förblir sidans primära handling;
- `Boka ny tid` när ingen aktiv bokning finns;
- länken går till tenantens faktiska publika `/boka`-URL;
- knappen öppnar inte en kopia av bokningsmotorn på `mina.corevo.se`;
- företags-, tjänst- och personalval får förifyllas bara med publika, fortfarande giltiga parametrar;
- om ett gammalt val inte längre är bokningsbart startar bokningsflödet på närmaste giltiga steg och förklarar varför.

### 10.4 Installationskort

Installationskortet får visas efter bokningsinnehållet, aldrig före det. Se avsnitt 17.

### 10.5 Tomläge

När inga kommande bokningar finns:

- rubrik `Ingen kommande bokning`;
- text anpassad efter om historik finns;
- primärknapp `Boka ny tid`;
- senaste relevanta genomförda bokning kan visas som `Boka igen` om tjänsten fortfarande är publik;
- inga konfettibilder eller tomma dashboards.

## 11. Vy: Historik `/mina/historik`

Sektionerna visas i denna ordning:

1. `Tidigare besök` — status `completed`;
2. `Avbokade bokningar` — status `cancelled`;
3. `Övriga bokningar` — exempelvis `no_show` eller väntande utfall.

Varje rad visar:

- tjänst;
- lokalt datum;
- personal om känd;
- företag/plats om företaget har flera platser;
- verklig status;
- pris endast om lagrat;
- `Boka igen` endast för en tjänst som fortfarande kan bokas publikt.

Historik ska vara paginerad eller cursorladdad; första vyn visar högst 20 rader. `Visa fler` är en riktig knapp med laddningstillstånd. Filter och sök ingår inte i v1.

Tomläge: `Du har inga tidigare bokningar hos [företag] ännu.`

### 11.1 Status- och actionmatris

| Runtime-status | Svensk etikett | Placering | Tillåtna handlingar |
|---|---|---|---|
| `pending`, start i framtiden | Förfrågan mottagen | kommande | detalj, kalender, boka ny tid, avboka endast om policy tillåter |
| `confirmed`, start i framtiden | Bekräftad | kommande | detalj, kalender, boka ny tid, avboka endast om policy tillåter |
| `completed` | Genomförd | tidigare besök | detalj, boka igen om tjänsten är publik |
| `cancelled` | Avbokad | avbokade | detalj, boka igen om tjänsten är publik |
| `no_show` | Uteblev | övriga | detalj; ingen mutation |
| `pending`/`confirmed`, start passerad men ej avslutad av företaget | Väntar på avslut | övriga | detalj; ingen kundmutation |
| okänd status | Status uppdateras | övriga/neutral fallback | detalj och företagskontakt; aldrig avbokning eller annan mutation |

Tid och status avgör tillsammans sektion. Färg är aldrig enda statusbärare.

## 12. Vy: Bokningsdetalj `/mina/bokningar/[id]`

Informationsordning:

1. tillbaka till `Bokningar` eller `Historik` beroende på navigationsursprung;
2. status;
3. datum och tid;
4. tjänst och längd;
5. personal;
6. plats, adress, telefon och kartlänk;
7. pris/prisintervall;
8. kundens eget bokningsmeddelande om ett sådant faktiskt finns och är kundsynligt;
9. avbokningspolicy och exakt sista kostnadsfria tidpunkt;
10. actions.

Actions för aktiv bokning:

- `Lägg i kalender`;
- `Boka en tid till`;
- `Avboka bokningen` om tillåtet;
- om spärrad och plats/företag har publik telefon: `Den här bokningen kan inte längre avbokas online. Ring [företag] på [nummer].`;
- om spärrad och publik telefon saknas: `Den här bokningen kan inte längre avbokas online. Kontakta [företag] via deras webbplats.` med fungerande publik kontaktlänk.

Actions för historisk bokning:

- `Boka igen` om fortfarande möjligt;
- ingen avbokningsknapp;
- ingen falsk kvittolänk.

Felaktigt eller ej ägt boknings-ID ska ge samma neutrala 404-vy: `Bokningen kunde inte visas`. Det får aldrig avslöjas att en annan kunds bokning finns.

Tillbakakontrakt:

- från `/mina` går synlig och logisk tillbaka till `/mina`;
- från `/mina/historik` går den till `/mina/historik`;
- från direkt SMS-/e-postlänk, PWA-start eller annan deep link är fallback alltid `/mina`;
- system-/browser-back används när ett verifierat internt ursprung finns, annars ersätter den synliga tillbakaåtgärden historiken med fallbacken så att användaren inte fastnar på bootstrap eller lämnar appen oväntat.

## 13. Avbokningsflöde

`Avboka` öppnar ett bottom sheet på mobil och en centrerad dialog på desktop.

Dialoginnehåll:

- rubrik `Avboka bokningen?`;
- datum, tid, tjänst och företag;
- exakt policytext;
- sekundärknapp `Behåll bokningen`;
- destruktiv knapp `Ja, avboka`;
- stängknapp med tillgängligt namn;
- fokusfälla, Escape-stöd på desktop och fokus tillbaka till utlösande knapp.

Under mutation:

- destruktiv knapp blir `Avbokar…` och låses;
- dubbelinskick ska vara omöjligt och servermutationen idempotent;
- vid lyckat svar uppdateras detalj och listor till `Avbokad`, med bekräftelse `Bokningen är avbokad. [Företag] har fått besked.`;
- vid nätverks-/serverfel ligger dialogen kvar med ett inlinefel och `Försök igen`;
- om policyn passerades under dialogen visas den nya policystatusen och ingen mutation görs;
- en redan avbokad bokning behandlas som lyckat, inte som tekniskt fel.

## 14. Kalenderexport

- Primär implementation är en `.ics`-hämtning från en session- och ägarskapskontrollerad route.
- Knappen heter `Lägg i kalender`, inte `Hämta kalender-länk`.
- Mobil får öppna systemets väljare när operativsystemet gör det.
- Vid lyckad hämtning visas diskret `Kalenderfilen är klar`.
- Vid fel visas `Kalenderfilen kunde inte skapas. Försök igen.`
- ICS innehåller företag, tjänst, lokala tider med korrekt tidszon, adress och publik kontakt. Den innehåller aldrig intern kundnotering, intern personalnotering, token eller person-ID.

## 15. Vy: Profil `/mina/profil`

Överst:

- rubrik `Mina uppgifter`;
- förklaringen `Uppgifterna gäller hos [företag].`;
- namn;
- den serverstyrda primära verifierade kontakten: `Verifierat mobilnummer` eller `Verifierad e-post`;
- annan valfri, verifierad eller overifierad kontakt bara om den faktiskt finns;
- ingen tom telefonrad för en e-postverifierad kund.

Under uppgiftskortet finns en exakt meny. Varje rad har ikon, etikett, chevron, minst 44 px tryckyta och följande riktiga mål:

1. `Mina uppgifter` → `/mina/profil` och fokus till uppgiftskortet;
2. `Säkerhet och enheter` → `/mina/sakerhet`;
3. `Installera på hemskärmen` → `/mina/installera`;
4. `Integritet` → `/mina/integritet`;
5. `Hjälp` → `/hjalp`;
6. `Logga ut` → öppnar den definierade logoutdialogen i avsnitt 16.

### 15.1 Redigera namn

- öppnas inline eller i tydlig separat redigeringsvy;
- ett fält `Namn`;
- `Spara` och `Avbryt`;
- 2–120 tecken efter trimning;
- servervalidering och optimistiskt UI endast om rollback är korrekt;
- framgång annonseras med `Namnet är sparat`.

### 15.2 Byta eller lägga till mobilnummer

1. tryck `Byt telefonnummer`;
2. visa varför dubbel verifiering krävs;
3. skicka en step-up-PIN till relationens nuvarande primära `verifiedContact` och verifiera den; godkännandet gäller endast detta kontaktbyte i högst tio minuter;
4. skriv nytt nummer med landskodsväljare/normalisering;
5. skicka en separat sexsiffrig PIN till det nya numret;
6. verifiera den nya PIN-koden mot en annan challenge och ett annat purpose;
7. uppdatera relationen atomiskt först när båda bevisen är giltiga och oanvända;
8. återkalla alla gamla portal-länkar, recovery-/kontaktbyteschallenges, PIN-fria bokningstrusts och alla andra portalsessioner;
9. rotera aktuell portalsession först efter lyckad dubbel verifiering;
10. visa `Telefonnumret är ändrat` eller `Mobilnumret är tillagt`.

För en e-postverifierad kund heter handlingen `Lägg till mobilnummer`. Godkänd SMS-PIN gör mobilen till primär verifierad kanal; den tidigare verifierade e-posten får ligga kvar som verifierad reservkontakt. Ingen relation slås ihop automatiskt.

Om numret redan är kopplat till en annan kundrelation hos samma tenant ska v1 inte slå ihop automatiskt. Visa `Numret används redan. Kontakta [företag] så hjälper de dig.` utan att avslöja den andra relationens uppgifter.

Om kunden inte längre kommer åt den nuvarande primära kanalen visas länken `Jag kommer inte åt den här kontaktuppgiften`. Den leder till en neutral hjälpvy som säger `Av säkerhetsskäl kan du inte byta kontaktuppgift själv utan kod till din nuvarande kontakt. Kontakta [företag] för manuell kontroll.` med företagets publika kontaktväg. Ingen reservadress, ny destination, personalsession eller uppladdad handling får ensam kringgå dubbelverifieringen i v1; ett framtida supportåterställningsflöde kräver separat säkerhetsbeslut och auditkontrakt.

### 15.3 E-post

- för en SMS-verifierad kund är e-post valfri och visas som `Verifierad` eller `Inte verifierad`;
- för en e-postverifierad fallbackkund är e-posten primär och får aldrig beskrivas som valfri;
- `Byt e-post` kräver först samma step-up-PIN till nuvarande primära `verifiedContact` och använder därefter en separat challenge med PIN till den nya adressen;
- först när båda PIN-bevisen är godkända uppdateras primär e-post atomiskt och samma credentials som vid ett telefonbyte återkallas;
- ny eller ändrad e-post blir aldrig primär före verifiering;
- om en destination redan hör till en annan tenantbunden kundrelation sker ingen automatisk merge och ingen information om den andra relationen visas.

## 16. Vy: Säkerhet `/mina/sakerhet`

Visa en kort förklaring: `Du använder inget lösenord. Din verifierade mobil eller e-post och dina enhetssessioner skyddar bokningarna.`

### 16.1 Inloggade enheter

Detta är endast kundportalsessioner på `mina.corevo.se`. Listan heter `Inloggade enheter`, aldrig det tvetydiga `Betrodda enheter`.

- begriplig enhet/browser, exempel `Chrome på Android`;
- `Den här enheten`-chip;
- skapad datum;
- senast aktiv;
- `Logga ut` per annan session;
- `Logga ut alla andra enheter`;
- inga exakta IP-adresser i standardvyn;
- en grov plats får bara visas om den är tillförlitlig och har tydligt integritetssyfte.

### 16.2 PIN-fria bokningsenheter

En separat sektion visar serverlagrade booking-trusts för aktuell tenant/customer:

- begriplig browser/enhet, skapad och senast använd;
- text `Den här enheten kan boka hos [företag] utan ny PIN tills trusten går ut eller återkallas.`;
- `Kräv PIN nästa gång` per post;
- `Kräv PIN på alla enheter` för alla booking-trusts;
- återkallning gör varje kvarvarande tenant-cookie ogiltig server-side men loggar inte ut portalen.

### 16.3 Destruktiva sessionstillstånd

`Logga ut annan enhet`, `Logga ut alla andra enheter`, `Logga ut på den här enheten`, `Kräv PIN nästa gång` och `Kräv PIN på alla enheter` har var sin bekräftelsedialog/bottom sheet med:

- tydlig rubrik och exakt konsekvens;
- `Avbryt` + en specifik destruktiv knapp;
- pendingtext och låst dubbelinskick;
- lyckad inlinebekräftelse;
- feltext som säger att ingen session/trust ändrades;
- idempotent servermutation.

`Logga ut på den här enheten` återkallar serverposten först och rensar därefter cookien. Efteråt visas `Du är utloggad`, primär CTA `Få en ny kod` till `/aterhamta/[tenantSlug]` och sekundär text `En giltig, oanvänd bokningslänk kan också öppna Mina bokningar.`

Det ska framgå att utloggning från `mina.corevo.se` inte raderar bokningen och inte avbokar tiden.

## 17. PWA-installation

### 17.1 Manifest och identitet

- `name`: `Mina bokningar · Corevo`;
- `short_name`: `Mina bokningar`;
- `id`: `/mina/`;
- `start_url`: `/mina/`;
- `scope`: `/mina/`;
- `display`: `standalone`;
- neutral Corevo-ikon, aldrig tenant- eller personunik ikon;
- inga tokens, tenant-ID:n, kund-ID:n, namn, telefonnummer eller boknings-ID:n i manifestet;
- personligt innehåll får inte precachas eller lagras i en publik app-cache;
- nuvarande `public/kund-sw.js` återanvänds inte. En eventuell v1-worker har scope `/mina/`, använder network-only för portalsidor och får endast cacha opersonligt statiskt skal/offlinefallback. Bootstrap, återhämtning, API-svar och personlig data ligger utanför dess cache.

### 17.2 Tillståndsmaskin

`unsupported` → ingen installation visas.
`eligible` → installationskort får visas efter att bokningen är synlig.
`prompted_once` → första riktiga erbjudandet visas.
`dismissed_once` → kunden valde `Inte nu` första gången; nytt automatiskt erbjudande får ske först vid ett senare separat besök.
`prompted_twice` → andra och sista erbjudandet visas.
`dismissed_twice` → andra erbjudandet avböjdes; dölj automatiska erbjudanden permanent på enheten.
`accepted` → invänta/registrera installerat läge.
`standalone` → visa aldrig installationsfrågan.

Räknaren ökar endast när ett riktigt erbjudande har renderats. Andra visningen får tidigast ske vid ett senare besök, aldrig direkt efter att kunden tryckt `Inte nu`. Att användaren avvisar Androids native prompt räknas som den visning som öppnade prompten: första native-avslag → `dismissed_once`, andra → `dismissed_twice`. State lagras lokalt utan personuppgifter.

### 17.3 Android/Chromium

- fånga `beforeinstallprompt`;
- visa installationskort: `Ha dina bokningar nära till hands` + `Lägg på hemskärmen` + `Inte nu`;
- först efter knapptryck anropas browserprompten;
- hantera accepterat och avvisat svar;
- om eventet saknas visas endast länken `Så installerar du`, inte en knapp som låtsas installera.

### 17.4 iPhone/iPad Safari

Webbplatsen kan inte installera sig själv. Knappen heter därför `Visa hur`.

Instruktionssheet:

1. `Tryck på Dela` med korrekt Safari-delikon;
2. `Välj Lägg till på hemskärmen`;
3. `Tryck på Lägg till`;
4. `Klart — Mina bokningar finns på hemskärmen.`

Visa inte instruktionen i en in-app-browser som saknar rätt Safari-meny. Visa då `Öppna sidan i Safari för att lägga till den på hemskärmen`, en fungerande knapp `Kopiera länken` och tre steg: `1. Kopiera länken. 2. Öppna Safari. 3. Klistra in länken i adressfältet.` Visa `Öppna i Safari` endast när aktuell browser exponerar en verifierat fungerande systemåtgärd.

### 17.5 Installerat läge

- respektera safe-area;
- ingen browserberoende tillbaka-knapp får saknas;
- sessionen fungerar identiskt i browser och standalone;
- utgången session i PWA visar återhämtningsvyn, inte vit skärm eller redirect-loop;
- offline visar ett neutralt statiskt fel `Du är offline. Anslut till internet för att se aktuella bokningar.`; gammal personlig bokningsdata får inte visas från cache.

## 18. Alla obligatoriska tillstånd

Claude Design ska visa ett separat, verifierbart skärmläge för varje namngivet tillstånd i varje rad.

| Område | Tillstånd |
|---|---|
| Bootstrap | kontrollerar länk, lyckad redirect, JavaScript saknas |
| Länk | ogiltig, utgången, redan använd med session, redan använd utan session, återkallad |
| PIN bokning | skickar, skickad SMS, skickad e-post, fel kod, cooldown, ny kod, utgången, maxförsök, leveransfel, tid förlorad, verifierad |
| Steg 5 bekräftelse | bokning skapad + skickad, bokning skapad + leverans köad, bokning skapad + leveransfel, ingen bokning skapad |
| Återhämtning | mobil/e-postinput, servervald SMS-kanal, servervald e-postkanal, skickar kod, kod skickad, fel kod, cooldown, utgången kod, maxförsök, leveransfel, lyckad |
| Portal | laddar, normal, session utgången, serverfel, offline |
| Bokningar | en kommande, flera kommande, ingen kommande, pending/förfrågan, avbokad |
| Historik | normal, tom, laddar fler, fel vid fler |
| Detalj | aktiv, spärrad av policy, avbokad, completed, no-show, saknas/ej ägd |
| Avbokning | dialog, skickar, lyckad, nätverksfel, policy ändrad, redan avbokad |
| Kalender | hämtar, lyckad, fel |
| Profil | read-only, redigera namn, sparar, valideringsfel, sparfel |
| Kontaktbyte | start, step-up skickas till aktuell SMS-kontakt, step-up skickas till aktuell e-postkontakt, step-up fel/utgången/maxförsök, aktuell kanal inte åtkomlig, ny destination, ny PIN skickad, ny PIN fel/utgången/maxförsök, destinationskonflikt, atomiskt byte pågår, lyckad |
| Säkerhet | en portalsession, flera portalsessioner, PIN-fria bokningsenheter, återkallningsdialoger, pending, lyckad, fel, bara aktuell kvar |
| PWA | unsupported, Android eligible, Android prompt, dismissed_once, andra/sista, dismissed_twice, accepted, iOS guide, in-app-browser, standalone |

## 19. Felmeddelanden och tonalitet

- Skriv vad som hände, vad kunden kan göra och om bokningen påverkades.
- Skriv aldrig `Något gick fel` ensamt.
- Exponera aldrig databastermer, UUID, stack trace, provider eller rått API-fel.
- Ett kopierbart kort fel-ID får visas efter stödtext, exempel `Felkod: CP-7F3K`, men får inte innehålla persondata.
- Säkerhetsfel ska vara medvetet neutrala.
- Bekräfta när bokningen inte skapades: `Ingen bokning skapades.`
- Bekräfta när en misslyckad portalåtgärd inte ändrade tiden: `Din bokning är oförändrad.`

## 20. Tillgänglighet

- WCAG 2.2 AA är miniminivå.
- Full tangentbordsnavigation i logisk DOM-ordning.
- Skip link på desktop.
- En synlig `h1` per vy och korrekt rubrikhierarki.
- Status får aldrig uttryckas enbart med färg.
- Ikonknappar kräver tillgängligt namn och tooltip där betydelsen annars är oklar.
- Formfel kopplas med `aria-describedby`; felsammanfattning fokuseras vid submit med flera fel.
- Dynamiska bekräftelser använder lämplig `aria-live`, inte aggressiv alert för allt.
- Dialoger har semantisk dialogroll, fokusfälla, Escape och korrekt fokusåtergång.
- Datum får läsas begripligt av skärmläsare; visuella förkortningar ska ha full tillgänglig text.
- Minsta pekyta 44 × 44 px.
- Zoom 200 %, landscape på liten mobil och textförstoring ska fungera.
- `prefers-reduced-motion`, `prefers-contrast` och forced colors ska kontrolleras.
- Skeletons ska vara dolda eller begripligt märkta för hjälpmedel och får inte ge ständig liveannonsering.

## 21. Responsiv acceptans

Designpaketet ska visa och verifiera minst:

- 320 × 568;
- 390 × 844;
- 430 × 932;
- 768 × 1024;
- 1024 × 768;
- 1440 × 900.

Krav vid alla bredder:

- ingen horisontell scroll;
- nästa bokning och primär handling syns utan onödigt tomrum;
- bottennav täcker aldrig innehåll;
- dialog/bottom sheet ryms med tangentbord öppet;
- långa företags-, tjänste- och personalnamn bryts eller trunkeras med fulltext tillgänglig;
- svenska datum och priser får plats;
- layouten fungerar utan logotyp och utan hero-bild.

## 22. Datakontrakt för designens komponenter

Designen får bara anta följande kundsynliga fält:

### Företag

`name`, `slug`, `logoUrl?`, `verticalLabel?`, `phone?`, `address?`, `mapUrl?`, `bookingOrigin`, `timezone`, `locale`, `defaultCountry`, `currency`, `cancellationCutoffHours`.

### Kundrelation

`displayName`, `verifiedContact`, `phoneMasked?`, `phoneVerified?`, `emailMasked?`, `emailVerified?`, `tenantId` (aldrig renderat), `customerId` (aldrig renderat).

`verifiedContact` är en diskriminerad union som servern bestämmer:

- `{ channel: 'sms', maskedDestination: string }`; eller
- `{ channel: 'email', maskedDestination: string }`.

Klienten får inte byta channel på en befintlig relation genom en vanlig request. Saknad telefon är ett fullständigt giltigt e-postfallbackläge.

### Bokning

`id` (endast route, aldrig som synlig säkerhet), `status`, `startTs`, `endTs`, `serviceName`, `durationMinutes?`, `staffTitle?`, `location?`, `priceCents?`, `priceLabel?`, `currency`, `customerVisibleNote?`, `canCancel`, `cancelDeadline?`, `publicRebookUrl?`.

`location` är antingen null eller `{ name?: string, address?: string, phone?: string, mapUrl?: string, timezone: string }`. Bokningskort/detalj använder alltid bokningens platsobjekt. Företagshuvudet använder företagets centrala kontakt. Om `locations` saknar publik telefon/kartlänk i aktuell DB krävs målmigration/adminfält innan designens knappar får aktiveras; annars döljs respektive action.

### Session/enhet

`id` (aldrig synligt), `label`, `isCurrent`, `createdAt`, `lastSeenAt`, `revocable`.

Saknade optionalfält döljer sin rad. Designen får inte hitta på fallbackdata som ser verklig ut.

## 23. Teknisk arkitektur som designen ska stödja

### 23.1 Två separata trustkontexter

Det går inte att dela hostlåsta cookies mellan kundens egen domän och `mina.corevo.se`. Lösningen har därför två serverlagrade, separata trustkontexter:

1. **Booking trust** på företagets host — används endast för att slippa PIN vid framtida bokning hos samma tenant.
2. **Portal session** på `mina.corevo.se` — används endast för att läsa och hantera rätt tenantbunden kundrelation.

Designen får inte lova att en `Logga ut` på den ena hosten magiskt raderar cookie på den andra. Serveråterkallelse gör dock en kvarvarande cookie ogiltig.

### 23.2 Föreslagna privata tabeller

- `private.customer_portal_links`: hashad engångstoken, outbox/link-intent, tenant, customer, ursprungsbokning, purpose, pepper/key-version, utgång, consumed/revoked.
- `private.customer_portal_sessions`: publik session-id, hashad hemlighet, tenant, customer, created/last-seen/absolute-expiry/revoked, begriplig UA-label.
- `private.customer_booking_trusts`: hashad trusthemlighet, tenant, customer, created/last-seen/expiry/revoked.
- `private.customer_portal_challenges`: återhämtnings-/kontaktbyteschallenge med tenant, subject-type (`existing_relation` eller `new_contact`), customer när relation finns, subject-/kontakt-digest, separat purpose, aktuell session när sådan finns, kanal, HMAC-PIN, pepper-version, attempts, cooldown, expiry och consumed. En challenge kan aldrig återanvändas mellan recovery, step-up av aktuell kontakt och verifiering av ny destination.
- `private.customer_portal_audit`: session created/revoked, recovery, phone change, cancellation; inga råa tokens eller PIN-koder.

Alla tabeller ligger i `private`, saknar direkt grants till `anon`/`authenticated` och skrubbas/återkallas vid GDPR-radering.

### 23.3 Atomiska DB-funktioner

- skapa portal-link just-in-time från ett outbox/link-intent och återkalla äldre ej använda länkar för samma purpose;
- konsumera portal-link + skapa session i samma transaktion;
- verifiera session + returnera tenant-/customer-snapshot;
- verifiera session + returnera en bokning som kunden äger;
- verifiera session + avboka ägd aktiv bokning med policy- och idempotenskontroll;
- starta/verifiera återhämtningschallenge;
- verifiera ny SMS- eller e-postdestination + uppdatera eller returnera säker konflikt;
- återkalla session(er);
- scrubba portalartefakter vid kundradering.

Alla security-definer-funktioner ska ha låst `search_path`, explicita schema-prefix och återkallad standard-execute.

## 24. API-, modul- och filkarta för implementation

Detta är målstrukturen. Claude Design ska namnge komponenterna på samma sätt i sin spec så att design och kod kan jämföras mekaniskt.

### 24.1 Routes

- `5-Kod/apps/web/app/(customer-portal)/(open)/oppna/[tenantSlug]/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/(open)/aterhamta/[tenantSlug]/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/(open)/verifiera/[tenantSlug]/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/(open)/hjalp/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/layout.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/historik/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/bokningar/[id]/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/profil/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/sakerhet/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/installera/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/integritet/page.tsx`
- `5-Kod/apps/web/app/api/customer-portal/exchange/route.ts`
- `5-Kod/apps/web/app/api/customer-portal/manifest/route.ts`
- `5-Kod/apps/web/app/api/customer-portal/bookings/[id]/calendar/route.ts`

### 24.2 Domänlogik och DAL

- `5-Kod/apps/web/lib/customer-portal/session.ts`
- `5-Kod/apps/web/lib/customer-portal/link.ts`
- `5-Kod/apps/web/lib/customer-portal/data.ts`
- `5-Kod/apps/web/lib/customer-portal/actions.ts`
- `5-Kod/apps/web/lib/customer-portal/recovery.ts`
- `5-Kod/apps/web/lib/customer-portal/origin.ts`
- lägg `customer_portal` i `5-Kod/apps/web/lib/tenant.ts` före generisk tenantklassificering; `lib/auth/host-routing.ts` är backoffice-only och ska inte äga denna host;
- reservera sluggen `mina` och lägg ett separat rent beslutsträd i `5-Kod/apps/web/lib/customer-portal/host-routing.ts`;
- utöka `5-Kod/apps/web/middleware.ts` med dubbelriktad fence: portalroutes och portal-API endast på portalhosten; `/admin`, `/personal`, `/platform`, storefront och vanliga loginroutes serveras aldrig där;
- lägg portalhost-env, fasta hostlistor, domän-/deployvalidatorer och `mina.corevo.se` som explicit återassertad Cloudflare-route först efter driftgodkännande;
- lägg hosttester för produktion, preview, tenant-subdomän, custom domain och alla backofficehosts.

### 24.3 Komponenter

- `CustomerPortalShell`
- `CustomerPortalTopbar`
- `CustomerPortalNavigation`
- `TenantIdentityCard`
- `NextBookingCard`
- `UpcomingBookingList`
- `BookingHistoryList`
- `BookingStatusChip`
- `BookingDetail`
- `CancelBookingDialog`
- `CalendarDownloadButton`
- `BookAgainButton`
- `CustomerProfileCard`
- `VerifiedContactCard`
- `ContactChangeFlow`
- `PortalSessionList`
- `BookingTrustList`
- `InstallPromptCard`
- `IosInstallGuide`
- `PortalEmptyState`
- `PortalErrorState`
- `PortalSkeleton`

Placering: `5-Kod/apps/web/components/customer-portal/` och en samlad CSS module eller tydligt dokumenterade delmoduler i samma mapp.

### 24.4 Återanvändning

Återanvänd eller extrahera rena delar från:

- `lib/kund/format.ts` — datum/pris/status efter kontroll att funktionerna inte kräver auth;
- `components/kund/AccountBookings.tsx` — informationsmönster, inte dess authkopplade props/aktioner;
- `components/kund/AccountHistory.tsx` — statusuppdelning;
- `components/kund/CancelButton.tsx` — serverbeteende ska säkras men UI byggas enligt nya dialogen;
- `components/kund/RebookPanel.tsx` — ska bevaras för gamla `/konto`, inte aktiveras i nya v1;
- `lib/personal/calendar.ts` eller befintlig kalenderbyggare — endast ren ICS-logik, aldrig personal-DAL;
- befintliga PWA-ikoner endast om de är neutrala och uppfyller maskable-krav;
- `public/kund-sw.js` återanvänds inte. Om installation kräver en v1-worker byggs en separat portalworker med scope `/mina/`, network-only för portalsidor och cache endast för opersonligt statiskt skal/offlinefallback; personlig portaldata får aldrig cachelagras.

Följande ska inte återanvändas som säkerhetslager:

- `requirePortal('kund')`;
- Supabase Auth-session för vanliga kundkonton;
- `customer_profile_id` som ensam ägarskapskontroll;
- nuvarande `/konto/koppla/[token]`-GET-konsumtion;
- service-role-queries utan ett atomiskt tenant-/customer-/sessionkontrakt.

## 25. Koppling till bokningsflöde och notifieringar

### 25.1 Vid PIN-verifierad bokning

Den atomiska bokningsfinaliseringen ska:

1. verifiera challenge och slot hold;
2. skapa/återanvända rätt tenantbunden `customers.id`;
3. skapa bokningen exakt en gång;
4. skapa booking trust för företagshosten;
5. köa ett portal-link-intent och bokningsbekräftelsen i samma affärstransaktion genom den befintliga outboxen; ingen rå portal-token skapas eller lagras i bokningstransaktionen;
6. låta den claimade dispatchern mynta portallänken just-in-time enligt avsnitt 25.2;
7. aldrig prioritera det gamla kontoclaimflödet framför portal-länken.

### 25.2 Retry-säker just-in-time-mintning

När dispatchern har claimat exakt outboxrad:

1. generera minst 256 bit slump i serverminne;
2. lagra endast digest + tenant + customer + booking + outbox/link-intent + purpose + keyversion + expiry;
3. materialisera den fulla SMS-/e-posttexten i processminne;
4. lämna texten med en stabil idempotency key till den valda transportens autentiserade endpoint;
5. kräva att transporten först persistar recipient och body med autentiserad kryptering och svarar `gateway_persisted` med ett opersonligt jobb-id;
6. rensa processreferensen efter transportanropet.

Länken är single-use. Den gäller till det senare av 30 dagar efter mintning och 30 dagar efter bokningens start, men aldrig längre än 400 dagar efter mintning. Ny JIT-mintning för samma intent återkallar äldre ej bevisat levererade länkar innan den nya blir giltig.

Retryreglerna är exakta:

- transportens beständiga kö äger retries efter `gateway_persisted`; samma krypterade body och idempotency key används, Corevo myntar inte en ny länk;
- om gatewayen bekräftat avvisning före persistence återkallas just myntad länk och en ny claim får mynta en ny;
- vid timeout med oklar persistence frågar dispatchern gatewayen med idempotency key innan någon ny send tillåts;
- vid `submitted` eller `unknown` sker ingen automatisk ny SMS-/e-postsend; reconciliation avgör status för att undvika dubbletter;
- en uttrycklig, rate-limitad användarretry efter terminalt `delivery_failed` skapar ett nytt delivery-intent, återkallar tidigare oanvänd länk och myntar en ny vid dispatch.

Corevos outbox skiljer alltså på `claimed`, `gateway_persisted`, `submitted`, `delivered`, `delivery_failed` och `unknown`. Ett HTTP 2xx från gatewayen betyder inte automatiskt `delivered`.

### 25.3 `booking-delivery.ts`

Nuvarande val `accountClaimUrl ?? manageUrl` ska ersättas av ett explicit leveranskontrakt. I lösenordsfri v1 är portal-länken den primära bokningshanteringslänken. Det gamla account-claimet genereras inte när v1-flaggan är aktiv.

Tenantens publika origin används för `Boka igen`; den ska inte valideras som om `mina.corevo.se` vore en tenantdomän. Portalorigin och tenant booking-origin är två separata, allowlistade värden.

### 25.4 SMS nere — e-postfallback

Om gateway-health redan före kontaktsteget visar att SMS inte kan levereras:

- bokningssteget ber om e-post i stället för telefon;
- koden skickas direkt via e-post, inte efter 15 minuter;
- samma slot-hold- och verifieringsregler gäller;
- bekräftelselänken går till samma portal;
- UI säger tydligt `SMS är tillfälligt otillgängligt. Vi skickar kod och bekräftelse via e-post.`

Om SMS faller efter att kunden valt telefon ska kunden få ett aktivt val att försöka igen eller byta till e-post. Ingen bokning skapas utan verifiering och ingen hemlig PIN visas i UI/logg.

E-postfallbacken skapar en e-postverifierad tenantbunden kundrelation med `verifiedContact.channel = 'email'`; telefon får saknas helt. Återhämtning till en befintlig relation väljer endast en kanal som redan är verifierad server-side. Kunden får inte skriva in en ny e-postadress och därigenom flytta en befintlig SMS-identitet. En ny telefon läggs senare till genom det separata kontaktbytesflödet i avsnitt 15.2, med både step-up-bevis och PIN till den nya destinationen — aldrig genom automatisk merge.

## 26. Feature flags och samexistens med gammal portal

Använd ett explicit läge, inte flera oberoende booleans som kan göra båda flödena aktiva:

- `off` — ingen kundportal;
- `legacy_account` — befintlig `/konto` och account claim;
- `passwordless_tenant` — nya `mina.corevo.se`-flödet;
- `global_account` — reserverat, får inte aktiveras i v1.

Regler:

- kanonisk lagring är `tenant_settings.settings.customer_portal.mode`;
- befintliga tenants backfillas explicit till `legacy_account`; saknat eller okänt värde failar stängt och genererar ingen ny portal-link;
- exakt ett läge per tenant;
- `passwordless_tenant` genererar aldrig vanlig signup-/claim-CTA;
- gamla routes och komponenter ligger kvar och har regressionstester;
- inga publika navigationer ska länka till fel portal;
- framtida datamigration mellan tenantportal och global identitet kräver eget beslut och egen migration.

## 27. Säkerhets- och integritetskrav

- portal-token lagras endast som digest i Corevos primära DB/outbox. PIN lagras som keyed HMAC enligt avsnitt 9.1, inte som vanlig hash;
- rå token/PIN får aldrig hamna i query string, Corevos primära DB/outbox, analytics, error tracker, accesslogg, manifest eller service worker-cache;
- transporten får bara hålla full SMS-body krypterad medan jobbet kräver leverans. Nuvarande `corevo-sms` med `message TEXT` i klartext är en produktionsblockerare för PIN/portal-link tills recipient, body och kundnamn skyddas med autentiserad envelope encryption (minst AES-256-GCM, unik nonce, key-version, nyckel utanför SQLite/backuper), full body döljs från list-API/UI/loggar och body irreversibelt redigeras direkt efter terminal leverans/fel/utgång. Backuper innehåller endast ciphertext, har åtkomstkontroll och dokumenterad gallring;
- PIN-body får aldrig finnas kvar efter challenge-expiry; portal-link-body får aldrig finnas kvar efter terminalt transportutfall. Metadata/idempotency/providerstatus får behållas enligt separat retention utan body;
- bootstrap och samtliga andra routes på portalhosten använder portalhost-specifik strikt CSP utan tredjepartsscript eller tenant-spårpixlar, `Referrer-Policy: no-referrer` och korrekt `Cache-Control`; hela hosten, inte bara `/oppna`, omfattas;
- alla portalsidor med persondata: `Cache-Control: private, no-store`;
- mutationer är POST/server actions med Origin-/CSRF-kontroll;
- rate limits per tenant, destination, IP-riskband och challenge;
- constant-shape/neutral återhämtningsrespons för att motverka kund-/telefonenumerering;
- sessionrotation efter återverifiering och telefonbyte;
- tenant- och customer-ID tas från verifierad session, aldrig från klientens val;
- boknings-ID måste alltid kontrolleras mot båda;
- intern personalnotering, allergier, interna tags och adminmetadata får aldrig skickas till klienten;
- databasens service-role får endast användas bakom minimala DAL/RPC-kontrakt;
- auditlogg ska kunna visa säkerhetshändelse utan att lagra innehållet i SMS/PIN/token;
- GDPR-radering återkallar/scrubbar länkar, challenges, trusts och sessioner.

## 28. Acceptanskriterier för Claude Designs leverans

Designpaketet under `4-Dokument-Underlag/01-acceptans/kundportal-losenordsfri-pwa-v1/` ska innehålla:

1. `README.md` — hur paketet öppnas och vilka filer som är kanon;
2. `SPEC.md` — skärm- och komponentindex som spårar varje krav i denna brief;
3. `Kundportal Passwordless Mobil.dc.html` — interaktiv mobilprototyp;
4. `Kundportal Passwordless Desktop.dc.html` — interaktiv desktopprototyp;
5. `Kundportal Passwordless States.dc.html` — obligatorisk tillståndsgalleri;
6. `TOKENS.md` — exakta färger, typsnitt, spacing, radier, shadows, breakpoints och fokusvärden;
7. `COMPONENTS.md` — exakt komponentanatomi, variants och interaktioner;
8. `COPY.md` — all svensk UI-text och feltext;
9. `FEATURE-MATRIX.md` — varje funktion markerad `NU`, `FÖRBEREDD/DOLD` eller `LEGACY/BEVARAD` och spårad till briefavsnitt;
10. `ACCEPTANCE-MATRIX.md` — unika krav-ID:n, berörd prototyp/state, exakt kontrollmetod och resultatkolumn för oberoende granskning;
11. inga externa imports, CDN:er, bilder, scripts eller resurser som riskerar att försvinna. HTML-prototyperna ska vara självbärande med inline CSS/JS eller relativa filer i samma paket. Typsnitt får i prototypen använda dokumenterad lokal font-stack utan nätverksanrop; produktionen ska självhosta kanoniska fonter via befintlig Next-fontlösning;
12. inga produktionscredentials, riktiga kunduppgifter eller verkliga bokningar.

### 28.1 Obligatoriska, syntetiska fixtures

Designen testas med två helt separata tenantfixtures. De får aldrig visas som två företag i samma v1-session:

1. **FreshCut** — frisör, en plats, SMS-verifierad kund, personal angiven, normal tjänst och fast pris.
2. **Nordverk Bilservice** — bilverkstad, två platser (`Hälla` och `Erikslund`), e-postverifierad fallbackkund utan telefon, tjänsten `Felsökning av motor och elektriskt system`, ingen namngiven personal och inget exakt pris.

Nordverk ska visas minst i mobilprototypens detaljläge och i desktop/state-galleriet. Syftet är att mekaniskt bevisa generiska etiketter, långa tjänstenamn, e-postidentitet, flera platser och optionalfält. Fixtureväxling är endast en tydligt märkt prototypkontroll i designpaketet och får inte beskrivas som en produktfunktion eller säkerhetsmekanism.

Prototyperna ska vara klickbara för:

- SMS-bootstrap till bokningsdetalj;
- mobil nav mellan bokningar, historik och profil;
- bokningsdetalj;
- avbokningsdialog med fel och lyckat läge;
- kalenderresultat;
- redigera namn;
- telefonbyte med PIN och konflikt;
- enhetslista och logout;
- Android-installation;
- iPhone-instruktion;
- utgången länk och återhämtning;
- tomläge och offline.

Före produktimplementation ska krav-ID:n och exakta visuella värden från det godkända paketet föras över till `5-Kod/e2e/acceptans/kundportal-losenordsfri-pwa-v1/kundportal-losenordsfri-pwa-v1.accept.spec.ts` och `5-Kod/e2e/acceptans/kundportal-losenordsfri-pwa-v1/probe.js`. Implementation får inte märkas klar förrän båda ger mekaniskt `0 FAIL` på de beslutade viewporterna.

## 29. Mekanisk granskningsmatris före implementation

Designen får inte godkännas förrän en oberoende granskare kan svara ja på allt:

- [ ] Ingen vanlig kundlogin eller registrering syns i v1.
- [ ] Bokningen sker på tenantens webbplats, inte i portalhosten.
- [ ] SMS-länken landar i en tokenfri portal efter bootstrap.
- [ ] Mobilens nästa bokning och viktigaste CTA syns snabbt.
- [ ] Alla aktiva knappar har definierat serverbeteende.
- [ ] Alla obligatoriska tillstånd i avsnitt 18 finns.
- [ ] Global hub, lojalitet, push, erbjudanden och webshop är dolda.
- [ ] Företagets branding är tydlig men Corevos säkerhetsidentitet är stabil.
- [ ] Designen fungerar för andra branscher än frisör.
- [ ] Android och iPhone har tekniskt korrekta, separata flöden.
- [ ] PWA-manifestet är helt opersonligt.
- [ ] Inga interna ID:n/tokens/PIN syns i mock eller copy.
- [ ] Alla destruktiva handlingar har dialog, pending, success och failure.
- [ ] Alla 404/ägarskapsfel är neutrala.
- [ ] Touch, tangentbord, fokus, kontrast och 200 % zoom är specificerade.
- [ ] Mobil, tablet och desktop är samma produkt.
- [ ] Legacyflödet är bevarat men inte blandat med v1.
- [ ] FreshCut och Nordverk bevisar att lösningen är branschneutral utan att blandas i samma tenantsession.
- [ ] `FEATURE-MATRIX.md` och `ACCEPTANCE-MATRIX.md` spårar alla krav utan brutna referenser.

## 30. Definition av färdig design

Designfasen är färdig först när:

- alla filer i avsnitt 28 finns;
- prototyperna kan köras helt lokalt utan nätverk eller trasiga imports;
- varje skärm har exakta mått/tokens, inte formuleringar som `ungefär` eller `som tidigare`;
- varje CTA är spårad till route/action eller uttryckligen dold;
- state-galleriet täcker säkerhet, datafel, nätverksfel och tomlägen;
- en oberoende granskning mot avsnitt 29 har noll blockerande avvikelser;
- den mekaniska acceptansmappningen till framtida `*.accept.spec.ts` och `probe.js` är entydig;
- först därefter får implementationen börja.
