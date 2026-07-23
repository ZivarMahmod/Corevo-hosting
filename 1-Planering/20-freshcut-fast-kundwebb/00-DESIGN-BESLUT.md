# Goal 79 — FreshCut som fast kundwebbplats

**Designstatus:** Godkänd av Zivar genom den uttryckliga källan
`https://freshcut-salong.honeybo.chatgpt.site/` och ordern att bygga in den som
FreshCuts fasta kundmall. Källsidan är kanon; Corevo ska inte improvisera en ny
visuell riktning.

## En mening

Den befintliga, dolda `freshcut`-mallen ersätts med den nya svart/grå
FreshCut-sidan, men alla verkliga priser, tjänster, kontaktuppgifter,
kundinställningar och bokningslänkar fortsätter komma från Corevos data.

## Vald lösning

Tre vägar bedömdes:

1. Lägga den nya sidan som fristående statisk HTML. Det ger snabb pixelträff men
   tappar kundadmin, tjänstedata, modulgrindar och framtida blogg/webshop.
2. Skapa ännu en generell mall i mallväljaren. Det riskerar att FreshCuts
   kundspecifika copy och bilder börjar erbjudas andra kunder.
3. **Ersätta den befintliga kundlåsta `freshcut`-renderaren.** Formen kopieras
   från källsidan och funktionspunkterna kopplas till befintliga Corevo-kontrakt.

Alternativ 3 är valt. `freshcut` förblir dold för nya kunder och påverkar ingen
annan mall.

## Visuell kanon

- Färger: `#171918` svart, `#232625` mjuk svart, `#d8d6cf` varmvit,
  `#c5c2ba` papper, `#a78f6d` signal/guld och `#575a57` sekundär text.
- Typografi: Source Sans 3 för rubrik, brödtext och utility; Playfair finns kvar
  i temats kontrakt men den godkända versionen använder den inte synligt.
- Form: raka hörn, tunna linjer, versala mikrolabels, stora kondenserade
  rubrikblock och svartvita barberarbilder.
- Struktur: toppremsa → kundägd nav → bildhero → tre populära behandlingar →
  full prislista → resultatgalleri → salong → stor boknings-CTA → kontakt →
  kundägd sidfot.
- Responsivitet: samma brytpunkter som källan, `1120px` och `780px`, inklusive
  fast mobil-CTA.
- Rörelse: endast källans korta hoverförflyttningar och bildzoom. Allt nollas
  vid `prefers-reduced-motion`.

## Funktionskontrakt

- Alla bokningsknappar byggs med `BookCta` eller `Bookable`. De får därför exakt
  den externa HTTPS-länk som kunden sparat när `booking=off`, och Corevos motor
  om modulen senare slås på.
- Tjänstenamn, priser och tider hämtas från `services`; ingen prislista
  hårdkodas i renderaren.
- Kontakt, adress och sociala länkar hämtas från tenantinställningarna.
  FreshCut-värden är bara kundens seed/default, inte globala hårdkodningar.
- Hero- och galleribilder har FreshCut-defaults men kundens uppladdade media
  fortsätter vinna via `resolveThemeContent`.
- Sida-redigeringens befintliga copyfält fortsätter vinna över mallens defaults.
- Framtida aktiverade moduler behåller plattformens funktion och kan läggas till
  utan att FreshCut behöver konverteras till en generell mall.
- Kundadmin, superadmin och andra moduler rörs inte av att bokning är av.

## Data och drift

- Ingen produktionsdata ändras i Goal 79.
- Den syntetiska tenant som används på `localhost:3100` får FreshCut-tema,
  `booking=off`, extern HTTPS-länk och FreshCut-kontakt endast på
  Supabase-previewbranchen `localhost-acceptance`.
- Bildassets kopieras in under
  `5-Kod/apps/web/public/images/freshcut/`; den färdiga sidan får inte bero på
  att ChatGPT Sites fortsätter hosta källan.

## Fel- och tomlägen

- Saknad extern länk gör bokningsytorna inerta enligt Goal 78; de får aldrig gå
  till en död `/boka`.
- Saknad tjänst visar en kort, ärlig tomtext i prislistan.
- Saknad kontaktuppgift utelämnar bara den raden.
- Saknad uppladdad bild använder den lokala FreshCut-defaulten.

## Acceptans

- Desktop och mobil jämförs mekaniskt mot källsidan.
- Extern länk, ny flik och `noopener noreferrer` verifieras i webbläsare.
- Alla sju previewtjänster visar verkligt namn, tid och pris.
- `freshcut` syns inte i den generella mallväljaren.
- Riktade tester, typecheck, lint och lokal browseracceptans är gröna.

