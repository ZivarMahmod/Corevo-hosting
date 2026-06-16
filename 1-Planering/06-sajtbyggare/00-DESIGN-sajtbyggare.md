# Design — Corevo Sajtbyggare (verktyget)

> **Status:** DESIGN / spec (brainstorm 2026-06-16). Ej byggd. Ingen kod skriven.
> **Del:** `1-Planering/06-sajtbyggare/` (ny del enligt CLAUDE.md-rytmen).
> **Bygger vidare på:** multibransch-motorn (`05-multibransch-bygge/`), mall-katalogen
> (`4-Dokument-Underlag/03-template-katalog/`), modul-lagret (`tenant_modules`, migr 0031–0037).
> **Författare:** Cowork (Claude), efter Zivars kravbild 2026-06-15/16.

---

## 0. Vad det här dokumentet är
En grundlig, klar förklaring av EXAKT vad sajtbyggaren ska kunna, hur den fungerar
tekniskt, och hur den hänger ihop med subdomäner och modulerna. Skrivet så att Zivar
— som inte sett en enda modul IRL än — förstår både vad han bygger och varför.

Det här är **specen**. Nästa steg efter godkännande = implementationsplan (skivor S1–S5).

---

## 1. Visionen i en mening
**En tenant (salong/restaurang/klinik…) väljer en färdig mall, ser den exakt som
originalet i en live-preview, och kan där byta text/font/färg/bilder, placera Corevo-
moduler (bokning, shop, blogg…) precis var de ska ligga, och bygga ut med egna sidor/
knappar — utan att vi hårdkodar en enda mall.**

Slutprodukten = kundens publika hemsida på deras egen subdomän, med riktig bokning inuti.

---

## 2. Vad verktyget ska kunna (hela kravlistan)
1. **Välj mall → exakt vendor-utseende.** Foody ser ut precis som Foody — alla sidor
   (Home / About Us / Products / Contact / …), all bild och text från mallen.
2. **Live-preview** som hela tiden visar EXAKT slutresultat (inkl. var moduler landar),
   så Zivar kan välja rätt mall och se hur det blir innan publicering.
3. **Redigera i preview:** klicka på text → ändra, byt font, byt färg, byt/ladda upp bild,
   flytta sektioner.
4. **Moduler som placerbara block.** Aktivera en modul → dra in den på vald plats → syns
   direkt i previewen.
5. **Bygg ut utöver mallen:** ny knapp, ny flik/sida, ny sektion.
6. **Bild-uppladdning + optimering** (rätt storlek/format, snabb laddning).
7. **Galleri:** bläddra ALLA mallar oavsett antal, välj/byt på en tenant när som helst.
8. **Skalar:** ny mall kräver INGEN ny render-kod (motorn är generell). MEN — ärligt — varje
   mall behöver ett **engångs-onboarding-jobb**: importera, markera vilka regioner som är
   redigerbara, koppla rätt slots, så kunden inte kan råka söndra layouten. Det är INTE noll.
   Spiken (S0) ska **mäta hur stort** det jobbet är per mall, så förväntan kalibreras (det är
   inte "välj mall → klart, noll jobb"). Ny bransch (t.ex. "klinik" med 1 mall) = data + det
   onboarding-jobbet. Verktyget möter mallarna oavsett antal, men varje mall har en startkostnad.

---

## 3. Modulerna — vad de ÄR IRL (för nyfikenheten)
Sju moduler finns i DB-tabellen `modules`. Sex syns på storefront, en är infrastruktur.
Var modul har ett livscykel-läge per tenant (`tenant_modules.state`):
**off** (aldrig aktiverad) → **draft** (aktiverad, ej publik än) → **live** (syns) →
**paused** (tillfälligt stängd, visar "stängt"-banner). Default: `booking:live`, resten `off`.

| Modul | Nyckel | Vad det är på sajten | Standard-plats |
|---|---|---|---|
| **Bokning** | `booking` | Kärnan. "Boka tid"-flöde: välj tjänst → tid → bekräftelse. Alltid live om inget annat sägs. | `main` |
| **Webshop** | `shop` | Produkter till salu (frakt/upphämtning). *Betal-rails PAUSADE (beslut 14.2)* → visar produkter, tar inga pengar än. | `main` |
| **Offert** | `offert` | "Begär offert"-formulär. Kund skickar förfrågan, salongen svarar (mål 2 dagar). Inga pengar. | `main` |
| **Blogg** | `blogg` | Inläggs-feed (grid, 6/sida). Nyheter/artiklar från salongen. | `main` |
| **Lojalitet** | `lojalitet` | "Bli stammis" — poäng/stämpel (mål 10 besök, 50 p/besök). Lockar återkommande kunder. | `main` |
| **Presentkort** | `presentkort` | Köp presentkort (digital, t.ex. 200/500/1000 kr). *Betal-rails PAUSADE* än. | `main` |
| **Bildbibliotek** | `media_library` | INFRA — ingen sektion på sajten. Tenantens bild-arkiv (500 MB kvot) som de andra modulerna + sajtbyggaren hämtar bilder från. | — (ingen) |

**Viktigt för sajtbyggaren:** varje modul är en **dynamisk React-sektion** (riktig DB-data,
bokningslogik osv) — INTE statisk HTML. Det är just därför verktyget behöver en bro mellan
den statiska mall-layouten och de levande modulerna (se §6).

---

## 4. Tre val vi gjorde (och varför)
- **Trohet vs skalning →** vi vill ha BÅDE exakt utseende OCH redigerbarhet OCH utbyggnad.
  Det = en **hemsidebyggare**, det mest ambitiösa alternativet. Accepterat av Zivar
  ("vi gör tunga stora jobb för att det ska bli precis som tänkt").
- **Bygg inte hjulet →** vi använder en **beprövad öppen-källkods-byggar-motor** i koden,
  inte en egen editor från noll. (Tool-val i §5.)
- **Samexistens, inte ersättning →** de 5 färdiga React-temana (Salvia/Leander/Zigge/
  Linnea/Edit) blir KVAR. En tenant väljer antingen "färdigt tema" (bokning redan inbyggd)
  ELLER "byggar-sajt" (importerad mall + editor). De 5 rörs inte → ingen regression på
  FreshCut/live.

---

## 5. Tool-val — vilken motor
**Primär kandidat: GrapesJS** (öppen källkod, MIT). En mogen visuell web-byggare som ger
mycket ur lådan:
- **Importerar HTML/CSS rakt av** → mallen ser ut som originalet.
- **Style Manager** → ändra font/färg/spacing visuellt.
- **Asset Manager** → ladda upp/byt bilder (vi kopplar mot R2).
- **Block Manager** → dra in block (knapp, sektion, sida — och våra Corevo-moduler).
- **Page Manager** (plugin) → fler-sidigt (About/Products/Contact …).
- **Live canvas** → WYSIWYG-redigering = previewen Zivar vill ha.
- Sparar allt som **data** (HTML + CSS + komponent-JSON) per tenant.

**Övervägt alternativ: Puck** (React-native page-builder, block = React-komponenter, JSON-output).
Puck importerar INTE befintlig vendor-HTML — man bygger av React-block. Vid första anblick
spräcker det krav #1 (exakt Foody). MEN: Zivar har uttryckligen godkänt **html→react-konvertering**.
Det öppnar en annan väg — **konvertera varje mall till React EN gång** (vid import), och då blir
ALLT nedströms (modul-injektion, ren redigering, utbyggnad) React-native. Den vägen kan få
"bron statisk↔dynamisk" (§6.1, den svåraste biten) att i princip **försvinna**, eftersom det
inte längre finns någon statisk HTML att väva in i — allt är React.
Tradeoff: GrapesJS = trogen import billig, men dynamisk-injektion svårare. Puck/React-konvertering
= injektion trivial, men import dyrare (konvertering per mall). **Vilken som är renast avgörs av
spiken (S0), inte på papper.** Tas in som det första spiken ska besvara.

**Stöd-bibliotek vi tar in:**
- **`html-react-parser`** (eller likvärdig) — render-tid: gör sparad mall-HTML → React, och
  byter modul-markörer mot riktiga modul-komponenter (§6).
- **Bild-optimering** — `sharp` vid uppladdning, eller Cloudflare Images, → R2-bucket
  `corevo-media` (finns redan). Krav #6.
- **HTML-sanering** (t.ex. DOMPurify-motsvarighet server-side) — säkerhets-gräns mot XSS
  i vendor-/tenant-redigerad HTML (§9).

---

## 6. Hur det fungerar — hela pipelinen
### 6.1 Från mall till levande sajt (render-bron — kärnan)
> Diagrammet nedan visar **GrapesJS / HTML-som-data**-vägen. Vinner Puck/React-konvertering
> i S0 ser stegen lite annorlunda ut (mallen blir React vid import, ingen HTML att väva in),
> men slutmålet — trogen sajt på subdomän med levande moduler — är detsamma.
```
Vendor-mall (HTML/CSS/JS/bilder på disk)
        │  importeras EN gång till katalogen
        ▼
templates-rad + assets i R2            ← "Foody" som data, inte React-fil
        │  tenant väljer mallen
        ▼
GrapesJS-editor (i admin)              ← Zivar redigerar visuellt, ser live-preview
        │  sparar
        ▼
tenant-layout (HTML+CSS+JSON, per sida)   ← lagrad i DB per tenant
   innehåller modul-MARKÖRER: <corevo-module type="booking" pos="…">
        │  publish
        ▼
LIVE storefront-render (Next/React på Workers)
   html-react-parser läser layouten →
     • statisk chrome (hero/about/…) renderas troget (mallens egen CSS laddas)
     • varje <corevo-module>-markör BYTS mot den riktiga React-modulen
       (live bokning/shop/blogg, DB-data, modul-livscykel-grind)
        ▼
Kundens publika sajt på deras subdomän
```

**Det här är hela tricket:** mallens utseende = data (trogen), modulerna = riktiga React-
komponenter som vävs in vid render där markörerna sitter. Bygger på det som redan finns:
`modules.default_section_position` (var en modul defaultar) och modul-sektionerna i
`app/(public)/page.tsx` (ShopSection/OffertSection/BloggSection/…).

### 6.2 Redigerings-upplevelsen (vad Zivar gör)
1. Öppna en tenant i admin → "Sajtbyggare".
2. Välj mall ur **galleriet** (filtrerat på bransch, men alla synliga).
3. Editorn laddar mallen → exakt utseende i canvas.
4. Klicka text → skriv om. Markera → byt font/färg. Klicka bild → ladda upp/byt (→ R2, auto-optimeras).
5. Dra in en **modul** (Bokning/Shop/Blogg…) på vald plats → previewen visar exakt hur den landar.
6. Lägg till sida/flik/knapp vid behov (Block Manager / Page Manager).
7. **Förhandsgranska** (draft) → när nöjd: **Publicera** → live på subdomänen.

### 6.3 Draft vs Publicerat
- Editorn sparar en **draft-layout**. Storefront-hosten serverar **publicerad** layout.
- Preview renderar draft (samma render-väg som live, men opublicerad) → "exakt som det blir".
- Publicering = promota draft → publicerad + busta tenant-cachen (`tenant:<slug>`-tagg, finns redan).

---

## 7. Subdomäner & hosting — hur sajten serveras
**Dörr-modellen (finns redan, 3 dörrar):**
- `superbooking.corevo.se` → plattform/super-admin.
- `booking.corevo.se` → salongs-admin (HÄR bor sajtbyggaren — du redigerar bakom admin-dörren).
- `minbooking.corevo.se` → personal.

**Tenant-storefronts (kundens publika sajt):**
- Wildcard `*.boka.corevo.se` (goal-28) → `freshcut.boka.corevo.se`, `klinikx.boka.corevo.se` …
- ELLER kund-egen domän (Custom Domain) senare.
- Middleware resolvar tenant per host → `currentTenant()` → rätt tenants layout/moduler.

**Sajtbyggaren i den modellen:**
- Du **redigerar** på admin-dörren (`booking.corevo.se`), vald tenant.
- Previewen renderar tenantens storefront (draft) i en **iframe** — exakt det publikens host visar.
- **Publicera** → `<slug>.boka.corevo.se` serverar nya layouten.

> 🔴 **Beroende/blockare (befintlig, ej ny):** `*.boka.corevo.se`-certet är BLOCKAT
> (Cloudflare Free-plan, kräver ACM ~$10/mån — se [[corevo-goal28-wildcard-boka]]).
> Sajtbyggaren går att bygga + testa lokalt och via preview-route utan certet, men
> **publik live-demo på en boka-subdomän kräver att certet löses**. Alternativ för
> tidig demo: en `<slug>.corevo.se` Custom Domain (som demo/freshcut historiskt).

---

## 8. Data-modell (skiss)
- **`templates`** (finns, 27 rader) — katalog-rad per mall: `key`, `name`, `tags.bransch`,
  + NYTT: pekare till importerade assets (HTML/CSS/bilder i R2), default-tokens.
- **`template_pages`** (NYTT) — en rad per mall-sida (index/about/…): namn, ordning, HTML/CSS-källa.
- **tenant-layout** (NYTT, t.ex. `tenant_site_pages`) — per tenant + sida: redigerad HTML/CSS/
  JSON (draft + publicerad), inkl. modul-markörer.
- **`tenant_modules`** (finns) — vilka moduler som är live/draft/paused för tenanten.
- **`media_assets`** (finns) — tenantens uppladdade bilder (R2), `media_library`-modulen.
- **`content_slots` / `template_slots`** (finns, 249 slots) — kan återanvändas för
  fält-nivå-innehåll, ELLER ersättas av den friare GrapesJS-layouten. **Öppen fråga (§11).**

---

## 9. Risker, gränser, säkerhet
- **Dynamiskt-i-statiskt** (svåraste biten) — markör-bron (§6.1) är **FÖRESLAGEN, inte bevisad**.
  De riktiga modulerna (`ShopSection` m.fl.) är **async server-komponenter** som läser DB. Att
  väva in en async RSC vid en markör via `html-react-parser` — på **Workers/OpenNext-runtimen**
  (inte bara localhost — det är just där ö-path/opennext bitit förr) — är ANTAGANDET hela bygget
  vilar på. Måste spikas FÖRST (S0), annars är S1/S2 bortkastat arbete om bron inte håller.
- **XSS/sanering** — vendor- och tenant-redigerad HTML renderas → MÅSTE saneras server-side
  innan render. Hård säkerhets-gräns. Tenant-CSS scopas redan under `[data-tenant]` (finns).
- **Licens per mall** — vendor-mallar för betalande kunder kräver licens-koll per källa
  (KATALOG.md flaggade detta). Hanteras i S5 innan en mall blir publikt valbar.
- **Betal-rails PAUSADE** (beslut 14.2) — shop/offert/presentkort visar UI men rör inga
  pengar. Sajtbyggaren placerar modulerna; betalning aktiveras separat senare.
- **Mallens egna JS = del av "exakt look", inte en fotnot.** Foody-hjälten i skärmdumpen har
  prev/next-pilar → en carousel → jQuery-beroende. "Exakt utseende" inkluderar att den rör sig.
  Att ladda godtycklig per-mall-jQuery in i en React/Next-sida är genuint stökigt (hydration,
  versions-krockar, dubbel-init). **Explicit beslut krävs** (ett av spikens utfall): (a) ladda
  vendor-JS isolerat, (b) ersätt interaktiva bitar med React-ekvivalenter vid import, eller
  (c) S1 = statisk (ingen vendor-JS) och rörelse senare. Lastbärande på huvudlöftet — får inte
  glidas förbi.
- **Prestanda** — parse+render på Workers; cache per tenant (finns).
- **packages/auth FRYST, POS/root orörd, DAL-fence** — sajtbyggaren rör INGET av detta.

---

## 10. Decomposition — skivor (byggs i ordning, en i taget)
**Risk-ordnat:** den svåraste, mest osäkra biten (bron statisk↔dynamisk + tool-val) spikas
FÖRST, som en tunn vertikal skiva genom hela stacken. Annars riskerar S1/S2 bli bortkastade
om antagandet inte håller.

| Skiva | Levererar | Bevisar / besvarar |
|---|---|---|
| **S0 — SPIKE (bron + tool-val)** ⭐ | EN importerad vendor-sida renderad på **riktiga Workers/OpenNext-deploy-vägen** (ej bara localhost), med EN riktig Corevo-modul (`booking`, async RSC) invävd vid en markör, som ser korrekt ut. + GrapesJS embeddas i admin och round-trippar (import→edit→save→identisk render). | (1) Håller markör-bron på Workers? (2) GrapesJS vs Puck/React-konvertering — vilken är renast? (3) **Mät per-mall-onboarding-jobbet.** (4) Beslut vendor-JS. Wegg-kast-risken retireras INNAN plan skrivs. |
| **S1 — Trogen import (skala)** | Importera mall(ar) ordentligt som data; fler-sidig tenant-sajt, exakt utseende. Bygger på det S0 bevisade. | Trohet via data i skala. |
| **S2 — Editor (preview)** | Vald motor i admin: ändra text/font/färg/bild, flytta sektioner, spara draft, publicera. | Redigerings-upplevelsen. |
| **S3 — Moduler + utbyggnad** | Alla Corevo-moduler som block; lägg till sida/knapp/sektion. | Att modulerna hittar sin plats. |
| **S4 — Galleri** | Bläddra ALLA mallar, välj/byt på en tenant när som helst. | Skalan + valfriheten. |
| **S5 — Drift** | Bild-optimering→R2, licens-koll per mall, rensa placeholder-text, fler mallar. | Produktionsmognad. |

Varje skiva = egen goal i `2-Byggplan/goals/` → verifieras → `_klart/` (CLAUDE.md-rytmen).
**S0 spikas och plan för resten skrivs INTE förrän S0:s utfall är känt.**

---

## 11. Öppna frågor (S0-spiken besvarar #1, #4 + tool-valet; #2/#3 beslutas innan S1)
1. **Innehålls-modell:** behåller vi de fält-baserade `content_slots` (249 finns) ELLER
   låter GrapesJS-layouten (fri HTML) vara enda sanningen? (Lutar åt: GrapesJS-layout som
   primär, slots utfasas — men S1 avgör.)
2. **Första mallen att importera** för S1: `restoran` (har redan `booking.html`) eller `foody`?
3. **Tidig demo-host:** vänta på boka-certet, eller sätt upp en `<slug>.corevo.se` Custom
   Domain för att kunna visa publikt under bygget?
4. **Mallens JS** — ta in vendor-JS rakt av i S1, eller bara HTML/CSS först (statiskt) och
   JS i S3?

---

## 12. Vad som INTE ingår (YAGNI)
- Egen editor från grunden (vi använder en beprövad motor — GrapesJS eller Puck, avgörs av S0).
- Att importera alla ~100 mallar direkt (S1 = en mall; fler i S5, datadrivet).
- Aktivera betalningar (separat spår, rails pausade).
- Röra de 5 färdiga temana eller FreshCut.
