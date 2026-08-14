# FreshCut Motiontest — design- och produktionsspecifikation

Status: bindande produktionsspecifikation för isolerad staging
Datum: 2026-08-10
Målhost: `motiontest.corevo.se`
Källtenant: `freshcut`

## 1. Uppdrag och kvalitetsribba

Motiontest ska vara en separat FreshCut-releasekandidat med samma
grundläggande finish, djup och medvetna rörelsespråk som en starkt art-directad
MotionSites-sida. Resultatet får inte reduceras till en vanlig storefront med
parallax, en hero-video eller ett antal animationer ovanpå den befintliga sidan.
Miljön är staging, men kod, media, fallback, tillgänglighet och drift ska hålla
produktionskvalitet. Den får inte beskrivas eller avslutas som proof of concept.

Den centrala upplevelsen är:

> ENTER → PASS THE CHAIR → SEE THE CRAFT → DISCOVER THE RANGE → RETURN TO THE
> CUSTOMER → ARRIVE AT THE MIRROR → BOOK → REVEAL THE TEAM

Den filmiska resan är frivillig och kort. Besökaren ska kunna boka, se priser,
välja salong eller hoppa till tjänster direkt från första skärmen. Spegeln är
det visuella huvudnumret: när kameran landar där övergår spegeln till ett riktigt,
klickbart bokningsgränssnitt.

Den visuella nordstjärnan är **dokumentär och redaktionell FreshCut**: taktil
monokrom/sten, befintlig varm accent, hård men lugn typografisk hierarki och ett
dominerande motiv per bild. Ingen neon, glassmorphism, generisk svart-guld-
barbershop, svävande standardkort eller sci-fi-luxury får införas. Varje huvudbild
ska fungera som en färdig kampanjposter även när all rörelse är pausad.

### Produktpremiss och beslut

Den nuvarande FreshCut-sidan ger korrekt affärsinformation men skapar inte den
levande, lokala salongskänsla som ägaren vill använda för att skilja FreshCut från
en vanlig mall. Experimentet ska pröva om en kort frivillig hantverksresa ökar
besökarens lust och förtroende att boka utan att försämra tiden till tjänster,
priser, salongsinformation eller bokning.

Målgruppen för huvudresan är en lokal Linköpingsbesökare som snabbt söker
klippning eller skäggvård. Kvinnor, föräldrar och seniorer är sekundära segment
som ska känna sig tydligt inkluderade genom tjänsteutbud, riktig copy och separata
redaktionella motiv; huvudkunden får därför inte användas som enda representation.

Prototypens beslut är `adoptera`, `revidera` eller `avveckla`. Den adopteras bara
om FreshCut och Corevos produktägare kan slutföra bokningsuppgiften lika tydligt
som i den statiska varianten och samtidigt bedömer att den filmiska vägen tillför
ett tydligt varumärkesvärde. Misslyckas någon av dessa delar är utfallet revidering
eller avveckling, inte automatisk cutover.

Prioritetsordning:

1. bokningsklarhet;
2. tjänste- och prisklarhet;
3. prestanda;
4. mobil användbarhet;
5. filmisk fördjupning;
6. dekorativ visuell effekt.

## 2. Hårda gränser

- `freshcut.corevo.se` får inte deployas eller få ändrat beteende.
- Motionkoden utvecklas på en separat branch. Produktionsdeployen för
  `freshcut.corevo.se` får endast konsumera godkänd `main`; motiontest får en egen
  manuell workflow och ett eget Worker-namn.
- Prototypen körs på en separat Cloudflare Worker med exakt
  `motiontest.corevo.se` som enda Custom Domain.
- Produktionsworkern `bokningsplatformen`, dess cron, secrets och domäner får
  inte användas av prototypen.
- Samma Corevo-kodägare för tenantdata, tjänster, priser och externa
  bokningslänkar ska återanvändas. Ingen separat statisk kopia av FreshCut byggs.
- All viktig information är serverrenderad, semantisk HTML. Video är aldrig
  innehållskälla.
- Ingen helsides-scroll-hijacking, autoplay-ljud eller obligatorisk film.
- GSAP/ScrollTrigger är den enda tids- och scrollauktoriteten för den regisserade
  resan. UI-mikrorörelse får inte styra samma egenskaper.
- Ingen tung 3D eller WebGL i första versionen. Det får endast införas efter
  mätning och oberoende kritik som visar ett verkligt behov.
- Prototypen är `noindex` tills den uttryckligen godkänts för indexering.
- Den första versionen är publik men oindexerad så att den kan granskas från
  telefon. Endast redan publikt eller uttryckligen godkänt material får visas där.
  Om icke-publikt eller identifierbart kundmaterial senare behöver förhandsvisas
  ska hosten först skyddas med en uttryckligt godkänd Access-policy.
- Salong två presenteras i riktig UI och får inte blandas in i den filmade
  interiören. En enda salong är den kanoniska filmiska miljön tills båda har ett
  lika starkt och rättighetsgodkänt referenspaket.

## 3. Datakällor och preliminär prototypdata

### Verifierad Corevo-data

Sju aktiva tjänster läses från den riktiga FreshCut-tenanten:

- Herrklippning — 30 min — 369 kr
- Herrklippning Student — 30 min — 329 kr
- Herrklippning, långt skägg, varm handduk — 45 min — 459 kr
- Herrklippning, kort skägg, varm handduk — 30 min — 419 kr
- Pensionärsklippning — 30 min — 329 kr
- Barnklippning, upp till 8 år — 30 min — 299 kr
- Skäggtrimning — 15 min — 229 kr

Verifierad primär adress är Bokhållaregatan 2, 582 24 Linköping. Corevo har två
aktiva platsobjekt, men plats två innehåller fortfarande testdata i databasen.

### Ägarbekräftad prototypdata

Följande data finns endast i motiontest och får aldrig skrivas till
produktionsdatabasen:

- visningsnamn: FreshCut Sankt Larsgatan;
- adress: Sankt Larsgatan 17, Linköping;
- samma sju grundtjänster som Bokhållaregatan;
- Damklippning — 399 kr;
- Dam student — 349 kr;
- Dam pensionär — 329 kr.

Varje preliminär post märks internt med `provenance: "prototype"`. Den får inte
ges ett falskt produktions-id eller blandas in i bokningsmotorns `Service[]`.
En enda motiontest-resolver sammanställer verifierad data och prototypdata.
När riktiga rader finns tas motsvarande prototypdata bort i samma ändring.

Öppettider, personal, telefon och platsspecifika Bokadirekt-länkar för salong två
får inte hittas på. Nuvarande globala Bokadirekt-länk återanvänds endast där den
är sanningsenlig; gränssnittet måste annars ange att en platsspecifik länk saknas.

## 4. Första skärmen

Första viewporten ska fungera även om all motion är pausad eller misslyckas.

Den innehåller:

- FreshCut-logotyp/ordmärke;
- rubriken `Rent snitt. Ingen krångel.`;
- en kort, lokal och mänsklig beskrivning;
- primär `Boka nu`;
- `Se tjänster & priser`;
- `Välj salong`;
- `Upplev FreshCut`;
- tre populära tjänster med riktiga priser;
- `Två salonger i Linköping` med båda adresserna;
- en persistent men kompakt mobil-CTA.

De fyra vägarna har entydiga destinationer:

1. `Boka via Bokadirekt` använder den externa URL som redan är sparad för
   FreshCut, utan att påstå att den är platsspecifik;
2. `Se tjänster & priser` går direkt till den vanliga tjänstelistan;
3. `Välj salong` går till de två salongskorten;
4. `Upplev FreshCut` startar den korta filmiska progressionen.

Sankt Larsgatan kommuniceras som den andra prototypsalongen men ingår inte som ett
bokningsbart val eller konverteringsbevis förrän en riktig destinationslänk har
sparats. Den visar `Bokningslänk kommer` och får aldrig ärva en länk som kan peka
på fel verksamhet. När båda platserna har verifierade länkar kan den primära
CTA:n först öppna salongsvalet.

Desktop använder ett tydligt text- och konverteringsfält till vänster och en
levande salongströskel till höger. Mobil använder en egen komposition i en
kolumn, inte en beskuren desktopvy. Tre priser ska vara läsbara redan vid
320 × 800 utan intern scroll.

## 5. Filmisk koreografi

Kamerans språk är:

> CENTRUM → FRAMÅT → VÄNSTER → HÖGER → CENTRUM → VID SIDAN AV SPEGELN

Den sticky scenen är `100svh`. Den kontrollerade resan är 120vh, vilket ger en
wrapper på ungefär 220svh. Hårt testtak är 150vh kontrollerad progression.
Scrollen förblir vanlig webbläsarscroll utan snap eller hijacking.

Upplevelsen har åtta explicita scener men tre visuella ankarkompositioner som
måste godkännas som statiska keyframes på både desktop och mobil innan betald
media produceras:

1. **Threshold** — en dominant entré/tröskel med stor negativ yta för affärs-UI;
2. **Craft** — händer, verktyg och samma huvudkund i ett fokuserat hantverksmotiv;
3. **Mirror** — ett stabilt resultat i spegeln med boknings-UI bredvid eller under,
   aldrig som ett generiskt glaskort ovanpå håret.

Scenerna delar samma rum, DOM och rörelseauktoritet. De är inte fristående
videor, layouter eller konkurrerande UI-världar.

| Progress | Scen | Innehåll och rörelse |
| --- | --- | --- |
| 0–12 % | Hero / threshold | Stabil entré. Bokning, tre riktiga priser, två salonger och alla direkta vägar finns innan media är redo. |
| 12–28 % | Entrance | Miljön rör sig fram genom dörröppningen. Kort copy: `Kliv in.` |
| 28–43 % | Chair | Kameran går vänster. Huvudkunden sätter sig, cape landar och frisören kommer in från höger. |
| 43–60 % | Craft | Kontrollerad båge åt höger. Händer, verktyg och samma huvudkund visar hantverket i framåtspelade beats. |
| 60–76 % | Service range | Separata korrekta motiv för ung, barn, dam, senior och skägg visas i rumsligt integrerade paneler. |
| 76–88 % | Return | Servicepanelerna löses upp och kompositionen återgår tydligt till samma huvudkund. |
| 88–95 % | Mirror result | Kameran centrerar sig. Resultatet landar stabilt och den riktiga bokningsytan blir huvudfokus. |
| 95–100 % | Team / about | Kameran rör sig mot sidan av spegeln, team/Om oss blir synligt och scenen släpper till vanlig dokumentroll. |

Mänsklig handling spelas framåt när ett checkpoint aktiveras. Vid uppscrollning
används stabila start-/slutbilder, crossfades och rumslig rörelse. Video reverseras
inte så att människor eller klippning går baklänges.

Varje scen har ett stabilt, namngivet checkpoint. Den kompakta navigationen kan
visuellt gruppera dem som `Entré · Hantverket · Resultatet · Om oss`, men alla
åtta destinationer är direkt adresserbara. `Hoppa till resultat`, `Se tjänster`,
`Boka nu` och `Fortsätt till Om oss` finns där de behövs. Snabb scroll eller ett
direkt hopp får aldrig tvinga användaren att vänta på tidigare klipp.

Kontrollen är en namngiven in-page-navigation. Aktivt checkpoint exponeras med
`aria-current="step"`; ett hopp flyttar fokus till en märkt destinationsrubrik;
och en tangentbordsmanövrerbar paus/fortsätt-kontroll stoppar checkpoint-triggad
media och dekorativ rörelse utan att blockera vanlig scroll eller CTA:er.

## 6. Spegeln som bokningsgränssnitt

Spegeln byggs som ett kontrollerat montage, inte som en genererad fysisk
reflektion:

- verklig/referensgrundad spegelram och salongsmiljö;
- separat slutbild av huvudkunden maskad i spegelytan;
- återhållen glare, ljus och djup;
- all text, priser och interaktion som riktig DOM.

Desktop visar spegel/resultat på vänster del och en strukturerad bokningspanel på
höger del. Panelen ligger inte ovanpå frisyren. Den innehåller salongsväljare, populära tjänster, kategorier,
priser, tidslängd, Bokadirekt-CTA och `Visa alla tjänster`.

Mobil visar tre tjänster direkt. Hela tjänstelistan öppnas i ett native-liknande,
tillgängligt accordion-mönster i dokumentflödet. Expansion får inte skapa en egen
scrollcontainer; tangentbordsfokus stannar på sammanfattningen och sidans vanliga
scrollägare förblir dokumentet.

## 7. Sidan efter spegeln

Efter spegeln minskar rörelseintensiteten och normal scroll tar över:

1. Tjänster och priser
2. Två salonger
3. Resultat/galleri
4. Om FreshCut
5. Kontakt
6. Avslutande bokningsyta

Rörelsen här är begränsad till välregisserade reveals, hover/focus-respons och
små djupförskjutningar. Varje viktig sektion har en ny bokningsmöjlighet.

## 8. Teknisk rörelsemodell

Kanonisk ägarhiearki:

1. `FreshCutMotionSceneMap` äger de åtta scenernas intervall, stabila tillstånd,
   kamera, lager, media, mobilgrupp, reduced-motion och fallback.
2. En enda `FreshCutMotionExperience`-klientö äger aktuell scen, riktning,
   checkpoint och paus.
3. En enda GSAP-tidslinje med en ScrollTrigger äger normaliserad scrollprogress,
   primär DOM-koreografi och kameravärden.
4. `FreshCutMotionMediaController` tar härledda scenkommandon från samma ägare.
   Den spelar mänskliga klipp framåt på sceninträde, söker inte kontinuerligt på
   scroll och skapar ingen egen scroll- eller rAF-loop.
5. Serverrenderad affärs-UI är riktig DOM och skickas som innehåll till klientön.
   Tjänster, priser, platser och bokningslänkar får inte kopieras till motionstate.

Den gamla trestegskontrollern och dess manuella scroll/rAF/observer-logik ersätts
i samma cutover. GSAP får inte läggas som wrapper ovanpå den. CSS sticky,
perspektiv, masker och 2.5D används för rummet; ScrollTrigger är tidsauktoritet.
R3F/Three.js, r3f-scroll-rig, Theatre.js, Lenis och post-processing ingår inte
utan ett dokumenterat visuellt behov, mätning och ny oberoende granskning.

Samma DOM-element ska flyttas eller omformas mellan hero och spegel när visuell
kontinuitet krävs. Dubbletter får inte användas för att fejka samma CTA,
salongsväljare eller populärtjänstpanel i den filmiska scenen.

Scenmanifestet och den tekniska motion mapen är tillsammans enda ägare för:

- progressintervall;
- desktop- och mobilposter;
- desktop- och mobilvideo;
- safe zones;
- crop/focal point;
- mediaformat;
- rättighetsstatus;
- fallback;
- preload-prioritet.

Manifestet anger dessutom framåt-/bakåt-inträde, stabil start/slutbild,
mediafel, lågdata, timeout, desktop- och mobilbeteende samt verifieringsstatus.

## 9. Mobil, reduced motion och fel

Brytpunkter följer innehållets struktur:

- `320–767 px`: mobilregi i en kolumn och 80–100vh progression;
- `768–1023 px`: samma tre mobil-/tabletillstånd, men med två kolumner där
  innehållet faktiskt ryms; ingen full desktopkamera;
- `1024 px och uppåt`: full desktopkomposition och 120vh progression.

Orientering ändrar inte informationsordningen. En landscape-telefon under 768 px
förblir mobilregi, med kortare bildyta och samma direkta bokningsvägar.

Mobil regisseras som tre grupper som härleds från samma scenkarta:

1. Enter
2. Craft
3. Result / Team

Progressionen är cirka 80–100vh, med mindre parallax, färre samtidiga lager och
lägre mediavikt. Entré och spegel prioriteras för dedikerad 9:16-behandling om
desktopmaterial inte kan beskäras trovärdigt.

`prefers-reduced-motion`, data saver, långsam anslutning, mediefel och partiell
JavaScript-funktion ska ge en komplett statisk sida med samma
tjänster, priser, salonger och CTA:er. Ingen information eller bokning får gå
förlorad.

## 10. Media- och rättighetsgräns

Nuvarande publika FreshCut-material räcker som moodboard och tillfälliga
processbilder men bevisar inte en sammanhängande entré–stol–spegel-rutt.

Innan något kundmaterial laddas upp till Higgsfield krävs:

- källa och datum;
- ägare/fotograf;
- återanvändningsrätt;
- tillstånd för AI-transformation;
- information om identifierbart ansikte;
- modellmedgivande där det krävs;
- särskild försiktighet för barn.

Dessutom gäller ett obligatoriskt dataskyddsgate: endast minsta nödvändiga,
rättighetsgodkända material får laddas upp i en åtkomstbegränsad workspace med
namngivna operatörer. Identifierbara barnbilder får inte användas. Leverantörens
villkor och inställningar för träning/återanvändning, retention och radering ska
verifieras före uppladdning, och input, output samt jobbloggar ska ha ett fastställt
gallringsdatum och verifierad radering.

Den kostnadsfria previsualiseringen får använda repoägda platshållare. De får
inte automatiskt behandlas som godkända Higgsfield-referenser.

Ett slutligt referenspaket bör innehålla 4–5 sammanhängande motiv från samma
kanoniska salong: entré, väg mot stol, händer/verktyg, behandling och spegel.
Om underlaget saknas minskas kamerarörelsen; planlösning eller interiör hittas
inte på.

## 11. Higgsfield-workflow och kreditstyrning

Verifierat saldo vid designstart är 1 010 krediter. Ingen unlimited-generation
är aktiv.

- Målnivå: högst 60 %, alltså 606 krediter.
- Hård gräns: högst 65 %, alltså 656,5 krediter utan nytt godkännande.
- Minst cirka 35 % reserveras.
- Ett output per shot och generation.
- Ljud av.
- 720p för första utkast.
- 1080p endast för utvalda slutklipp.
- Inga automatiska alternativ eller batchar.
- Ingen 4K utan mätbart behov.

Produktionsordning:

1. Slutför previsualisering utan kreditkostnad.
2. Lås scrollängd, safe zones och storyboard.
3. Genomför fyra oberoende förgenereringsgranskningar: motion/kreativ,
   conversion/UX, frontendarkitektur samt prestanda/tillgänglighet.
4. Rätta samtliga kritiska fel.
5. Låt Corevos produktägare prova den statiska första skärmen, tjänstevägen,
   salongsinformationen och spegelbokningen. Lågkostnadsutkast är `go` endast om
   den filmiska vägen ger tydligt mervärde utan sämre bokningsförståelse. Minst en
   FreshCut-representant ska godkänna upplevelsen innan slutkvalitetsmedia beställs
   eller någon produktions-cutover diskuteras.
6. Kontrollera aktuell modellkatalog och kostnad på nytt.
7. Välj rätt Higgsfield-workspace uttryckligen.
8. Ladda upp endast rättighetsgodkända referenser.
9. Generera först en 720p-kandidat för `Client sits/barber enters` och en för
   `Craft/transformation`; detta är kontinuitetsprovet.
10. Kontrollera saldo och ledger efter varje jobb.
11. Granska de två tillsammans. Beställ entrance- och mirror-klipp endast om
    kontinuitet, autenticitet och komposition har passerat.
12. Granska därefter alla fyra tillsammans innan någon slutkvalitet beställs.
13. Generera endast accepterade slutklipp i 1080p.

Primära klipp:

- A: Threshold/entrance — 3–5 sekunder
- B: Client sits/barber enters — 4–5 sekunder
- C: Craft/transformation — 5–7 sekunder
- D: Final result/mirror input — 4–5 sekunder

Sekundära kundkategorier använder först godkända stillbilder, masker och 2.5D.
Full video beställs endast när en stillbild inte kan ge avsedd effekt.

Ett shot underkänns före kreditköp om den statiska keyframen kunde tillhöra vilken
barbershop som helst efter ett logotypbyte, om verklig salongsgeometri saknas, om
UI-safe-zonen inte är bevisad eller om start- och slutbild inte matchar nästa shot.

## 12. Agentworkflow och oberoende kritik

Skapande roller:

- filmisk/motion-regissör;
- konverterings- och UX-designer;
- teknisk motionarkitekt;
- huvudagent som sammanför och implementerar.

Före betald generation och efter varje komplett integreringsloop granskar fyra
andra agenter:

- Reviewer A: kreativ riktning, berättelse, kontinuitet och spegelpayoff;
- Reviewer B: bokning, priser, salongsval, skip-vägar och mobil;
- Reviewer C: frontendarkitektur, en enda rörelseauktoritet, cleanup, dataägarskap
  och underhållbarhet;
- Reviewer D: prestanda, tillgänglighet, reduced motion, mediafel och mobil.

Varje granskare måste lämna pass/fail per område, kritiska fel, högriskantaganden,
onödig komplexitet och obligatoriska ändringar. `Looks good` accepteras inte.

Efter integrering körs en ny oberoende granskningsomgång mot den fungerande
prototypen. Agenter som skapade lösningen får inte vara dess enda granskare.

## 13. Isolerad drift

Rekommenderad väg är samma OpenNext-app men en separat Worker-konfiguration,
exempelvis `freshcut-motiontest`, med:

- exakt `motiontest.corevo.se` som enda route;
- ingen cron;
- ingen service-role-, Stripe-, Cloudflare-skriv-, mejl- eller SMS-secret;
- endast publik Supabase-läsning;
- egen statisk asset-binding;
- explicit motiontest-host/experience-markör;
- fail-closed bindning till tenant `freshcut`: klienten kan inte överstyra tenant
  eller experience via host, header, query eller path;
- endast prototypens publika startsida och nödvändiga statiska/runtime-assets är
  tillåtna på hosten; auth-, admin-, API- och andra storefront-routes nekas;
- negativa kontraktstest för fel host, vilseledande suffix, tenantöverstyrning och
  nekade paths;
- dry-run som vägrar fel Worker eller extra host.

Produktionens deployscript får inte användas. Före och efter deploy verifieras
vilken Worker som äger `motiontest.corevo.se` respektive `freshcut.corevo.se`.

Motiontest är en tidsbegränsad experimentyta med Zivar/Corevos produktägare som
beslutsägare. Senast 30 dagar efter FreshCuts dokumenterade granskning ska beslutet
`adoptera`, `revidera` eller `avveckla` registreras. Utan ett uttryckligt
cutoverbeslut får prototypen aldrig bli FreshCuts produktionsyta; domänen stängs
efter separat operatörsgodkännande och koden kan då arkiveras eller raderas enligt
beslutet.

## 14. Verifiering och godkännandekrav

Minst följande ska verifieras:

- unit-/kontraktstest för hostisolering och dataproveniens;
- boknings-CTA:er och externa länkar;
- alla åtta scener, checkpoint-navigering och skip-vägar;
- scrollprogression under 150vh;
- ingen omvänd mänsklig video;
- mediafel och statisk fallback;
- reduced motion och data saver;
- tangentbord, fokus, semantiska rubriker och kontrollnamn;
- 320, 360, 375, 390, 412, 430, 768, 1024 och 1440 px;
- ingen horisontell overflow;
- ingen intern scrollruta på mobil;
- desktop- och mobilkomposition i Chromium, Firefox och WebKit;
- Android- och iPhone-profiler, slow network, mediefel, WebGL av och 200 % zoom;
- skärmbild vid varje checkpoint samt komplett desktop- och mobilinspelning;
- inget minnesläckage eller återkommande nedladdning efter upprepade in-/utträden;
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`;
- inga nya console errors eller warnings;
- mål: LCP ≤ 2,5 s, INP < 200 ms och CLS < 0,1 på representativ miljö;
- `freshcut.corevo.se` pekar på samma Worker/release före och efter.

Visuell godkännandetröskel:

- noll kritiska eller större fel från motion-, konverterings-, arkitektur- och
  prestanda/tillgänglighetsgranskare;
- minst 4/5 på berättelse, komposition, typografi, kontinuitet, mobil och polish;
- 5/5 på boknings- och tjänsteklarhet;
- högst ett dominant rörelsemotiv per checkpoint;
- första viewporten förstås inom tre sekunder på 320, 390 och 1440 px med media
  avstängd.

Prototypen är inte klar förrän den sparade bokningsvägen, priser, sanningsenlig
information om två salonger, skip-vägar,
spegelpayoff, mobil, reduced motion och mediafel fungerar utan att den filmiska
delen blir ett hinder.

## 15. Leverabler

Följande ska behållas som spårbara artefakter:

1. käll- och rättighetsmanifest;
2. kanoniskt salongsreferenspaket;
3. storyboard/contact sheet;
4. teknisk motion map med en rad per scen;
5. shot-by-shot promptbibliotek;
6. Higgsfield-ledger;
7. accepted/rejected-logg;
8. desktop- och mobilmedia;
9. posters och fallbacks;
10. kodade webbvarianter;
11. prestanda-, tillgänglighets- och bokningsrapporter;
12. båda oberoende granskningsomgångarna;
13. slutlig implementations- och deploysammanfattning.

Lagringskontraktet är fail-closed: endast sanerade manifest, prompts och godkända
publika outputs får ligga i repot eller publik asset-binding. Råa referenser,
modellmedgivanden, rättighetsbevis och konto-/kreditunderlag ska ligga i godkänd
åtkomstbegränsad lagring, aldrig i Git, loggar eller publik asset-binding. Varje
artefaktklass ska ha namngiven ägare, minsta behörighet, retention och verifierad
radering innan slutlig mediaproduktion startar.

## 16. Senare databyte utan ombyggnad

Följande kan bytas efter att upplevelsen fungerar:

- slutliga damtjänster, priser och längder;
- korrekt platsnamn och postnummer;
- öppettider;
- platsspecifika Bokadirekt-länkar;
- verkliga bilder för båda salongerna;
- slutlig About-copy.

Bytet sker i motiontest-resolvern eller den riktiga Corevo-datakällan, inte genom
nya komponentlager. När riktig data finns raderas motsvarande prototypdata.
