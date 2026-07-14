# 03 — Inställningar och Redigera sidan

## Grundprincip

Användaren ska veta om den ändrar:

- hur verksamheten arbetar;
- hur bokning fungerar;
- vem som får göra vad;
- eller vad slutkunden ser på den publika sidan.

Wavy samlar mycket under Inställningar eftersom produkten är liten. Corevo ska behålla den grunda och igenkännbara kategoriseringen, men inte blanda sajtredigering med interna verksamhetsregler.

## Två tydliga hem

### Inställningar

Styr verksamhet, konto, bokningsregler, personal, notifieringar, integrationer och data.

### Redigera sidan

Styr den publika webbplatsens innehåll, bilder, layout, preview och publicering.

En uppgift ska ha ett hem. Om samma data behöver visas på två ställen ska ett ställe vara redigerbart och det andra länka dit.

## Inställningskategorier

### 1. Företag och profil

Intern verksamhetsidentitet och grunduppgifter:

- juridiskt/verksamhetsnamn;
- organisations- och faktureringsuppgifter när de behövs;
- tidszon och standardspråk;
- primär plats;
- intern kontaktperson;
- verksamhetsstatus.

Publika texter, hero-bilder och sidlayout redigeras inte här. En tydlig länk leder till Redigera sidan.

### 2. Personal och behörigheter

- personal/resurser;
- kontaktuppgifter;
- aktiva/inaktiva konton;
- roller och åtkomst;
- vilka tjänster respektive resurs kan utföra;
- notifieringspreferenser;
- inbjudan och borttagning av åtkomst.

Att ta bort kontoåtkomst får inte radera historiska bokningar eller personalhistorik.

### 3. Tjänster

- kategorier;
- namn och kundbeskrivning;
- standardlängd;
- pris;
- vilka resurser som utför tjänsten;
- publik bokningsbarhet;
- ordning;
- aktiv/inaktiv.

Branschpreset ger startinnehåll och ord. Motorn använder generella objekt.

### 4. Öppettider och schema

- verksamhetens basöppettider;
- personal-/resursschema;
- stängda dagar;
- avvikelser;
- frånvaro;
- koppling till kalenderblockeringar.

Grundschema ska inte tvinga användaren att skapa hundratals blockeringar. Snabba vardagsundantag ska samtidigt kunna göras direkt i kalendern.

### 5. Bokningsregler

- publik bokning på/av/pausad;
- vilka kundgrupper som får boka;
- hur långt fram bokning tillåts;
- minsta framförhållning;
- avbokningsgräns;
- standardlängd/slot-steg där relevant;
- godkännande eller direktbekräftelse;
- kundmeddelande när bokning är stängd.

Valen ska presenteras som begripliga verksamhetslägen, inte som råa tekniska flags.

### 6. Notiser och SMS

I första fasen:

- e-postbekräftelse;
- e-post vid ombokning/avbokning;
- e-postpåminnelse;
- tydlig avsändare och reply-to;
- historik/status där den finns.

I senare SMS-fas:

- SMS-avsändare;
- val per händelse och mottagare;
- användning i SMS-delar;
- uppskattad kostnad;
- budgetgräns;
- levererat/misslyckat;
- fakturaunderlag.

### 7. Betalningar och integrationer

- Stripe-/betalkoppling;
- betalstatus;
- externa kassor/integrationer;
- integrationshälsa;
- behöriga kopplingsåtgärder;
- tydlig varning när en publik betalväg inte är redo.

En inaktiv integration ska inte skapa steg i bokningsflödet.

### 8. Konto och säkerhet

- kontots e-post;
- lösenordsbyte;
- tvåfaktorsautentisering med TOTP;
- aktiva sessioner/enheter;
- logga ut andra enheter;
- säkerhetslogg;
- kontoåterställning;
- kontakt med support för låsta högriskändringar.

### 9. Data, export och integritet

- kund- och bokningsexport;
- datalagrings-/integritetsinformation;
- personuppgiftsbiträdesrelaterade dokument/länkar;
- begäran om rättelse/radering enligt plattformens policy;
- audit-/historikåtkomst enligt roll.

Riskfyllda exporter ska förklara innehåll och kräva tydlig handling.

## Statistik är inte en inställning

Wavy placerar Statistik i inställningsnavigationen. I Corevo ska insikter visas på Översikt eller i en egen Insikter-yta när behovet motiverar ett huvudval. Användaren ska inte gå till Inställningar för att läsa verksamhetsdata.

## Minsta möjliga konfiguration

### Förifylls vid onboarding

- branschterminologi;
- relevanta huvudfunktioner;
- standardtider och bokningsregler;
- förslag på tjänster;
- standardnotiser;
- mall/tema;
- rimliga säkra defaults.

### Visas progressivt

- avancerade bokningsregler;
- integrationer som inte är anslutna;
- SMS-detaljer innan SMS är aktiverat;
- flera platser innan kunden har fler än en;
- specialfält som endast gäller ett visst verksamhetsfall.

## Spara och publicera

Två mentala modeller ska hållas isär:

### Intern drift

Schema, personal, tjänster och regler sparas med tydlig serverbekräftelse. Om ändringen påverkar framtida bokningar ska konsekvensen beskrivas före spara.

### Publik sida

Sajtbyggaren skiljer mellan:

- sparat internt utkast;
- opublicerade ändringar;
- publicerat/live.

Det ska aldrig finnas en global “Publicera ändringar”-knapp som otydligt blandar interna inställningar med webbplatsinnehåll.

## Lokal navigation

Inställningskategorierna kan visas som en kompakt vänsterlista på desktop och som kategori-väljare på mobil. Den globala toppnavigationen ligger alltid kvar.

Varje kategori ska ha:

- tydlig rubrik och kort förklaring;
- nuvarande status;
- få primära handlingar;
- hjälp i direkt anslutning till svåra val;
- synligt sparresultat;
- inga dolda obligatoriska steg.
