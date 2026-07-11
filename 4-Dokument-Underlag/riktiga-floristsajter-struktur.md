# Riktiga floristsajter — strukturell teardown (2026-07-11)

Underlag för de 13 florist-mallarna. Metod: `fetch` av HTML + länkade stylesheets (Squarespace `?format=json-pretty`, Shopify theme-CSS). Allt nedan är **citerat ur källan**, inte gissat.

| Sajt | Plattform | Affärsmodell | Kärnbevis |
|---|---|---|---|
| sadiesfloral.com | Squarespace 7.0 (legacy-mall) | Bespoke bröllop/event — INGEN kassa | startsidan = `typeName: "splash-page"` |
| tonicblooms.com | Shopify (custom tema, Vue) | Ren e-handel, same-day-leverans | `.prodCard` + `postal-code-checker` |
| hautefloral.com | Squarespace 7.0 (samma mall-familj, tung custom.css) | Lyx-event, lead-funnel — INGA priser | `custom.css` 7,8 KB, Cinzel + Pinyon Script |

---

## 1. Sadie's Couture Floral — "sajten är EN skärm"

**NAVIGATION.** Startsidan har **ingen `<header>` och ingen `<footer>` alls**. Navigationen är en `<ul>` *inuti* omslags-skärmen: `data-slice-type="navigation"` → Weddings · a la carte · corporate/social · contact. Fyra länkar, inget mer.
Undersidorna har en **helt annan** header: centrerad stapel — logotyp-bild → `site-address` (2400 North 2nd Street Suite 100 / Minneapolis, MN, 55411) → `site-phone` (651) 707-7689 → `site-tag-line` "Floral & Event Styling" → `<hr>` → `nav.main-nav`. Nav-raden är då: Weddings · Gallery · a la carte (mapp → about / Order Form / How To's) · corporate/social (mapp) · contact. Mappar = subnav via checkbox-toggle (`folder-toggle-box`), inte hover-mega-meny. Ej sticky.

**HERO.** Ingen hero i vanlig mening. Startsidan är en Squarespace **cover page**, slide-layout `profile-left-right-01`, `sqs-slide-layer full-width-height split-fifty`:
- Vänster 50 %: `content-gallery` med **7** `sqs-slice-gallery-item content-fill` — bröllopsfoton i helhöjd som växlar.
- Höger 50 %: centrerad stapel — ordbild-logga (2499×522 px), body-text `COUTURE FLORAL`, nav-listan, tre sociala ikoner (Instagram, Pinterest, Facebook).
Ingen rubrik-taggning alls (`data-slice-type="heading"` är `data-content-empty="true"`). **Ingen scroll. Inget flöde. En delad skärm.**

**SEKTIONSORDNING (start).** 1) delad skärm (foto | logga+tagline+nav+social). Slut. Det finns ingen sektion 2.

**PRODUKTKORT.** Existerar inte. Inga priser, ingen katalog, ingen kassa.

**HUR MAN HANDLAR.** Två vägar, båda formulär: `/a-la-carte-program` (3 × `<h3>`-stycken, 4 galleri-block, 12 bilder) → "Download Sadie's a la carte Program Guide" + "Order here" → `/a-la-carte-order-form` (Squarespace form-block). Fullservice-bröllop → `/contact` (form). **Noll klick till köp — för det finns inget köp.** Ingen leveransdatum-väljare, ingen ZIP, ingen same-day.

**PRISLISTA/TJÄNSTER.** Ingen prislista. Tjänster = löptext i `<h3>` (märkligt nog aldrig `<h1>`/`<h2>`): "Simply choose the size and quantity of your arrangements, share your color palette and a few photos for inspiration…". Villkoren är prosa, inte tabell: "specific flower varieties cannot be guaranteed", "all glassware and vessels are included in the arrangement price".

**SIDFOT.** Ett enda block: nyhetsbrev. `<h2>Be in the know with Sadie's.</h2>` + e-postfält + "Sign Up". Body-klassen är `hide-info-footer` — kontaktuppgifterna ligger i **headern**, inte i sidfoten.

**TYPOGRAFI.** Google Fonts på cover-sidan: PT Serif, Playfair Display (700), PT Sans. Undersidor laddar Merriweather (300/700, kursiv). Mall-bas: `body{font-size:13px;line-height:1.6em}`, `h2{color:#262626}`, `h3{color:#222}`. Rubrikvikten bärs av **bilden** (ordbilds-loggan), inte av typsnittet.

**OMÖJLIG ATT FÖRVÄXLA:**
1. Startsidan är en **50/50-delad skärm utan scroll** — nav ligger *i* innehållet, inte ovanför det.
2. Sajten **byter header/footer** mellan start och undersidor (splash → klassisk stackad header).
3. Adress + telefon står **högst upp**; sidfoten är bara ett nyhetsbrev.

---

## 2. Tonic Blooms — "leveransmaskinen"

**NAVIGATION. Tre rader.**
- Rad 1: roterande annonsbanner (Swiper): "$9.99 daytime delivery is available Monday to Friday" / "$12.99 daytime delivery is available on Saturday". Alltså **pris på leverans, inte på blommor, är det första du ser.**
- Rad 2: `.header-nav{background:#fff;border-bottom:1px solid #efefef}`. `.nav-logo{position:absolute;left:0}` — logga vänster; `.nav-nav{display:inline-block}` i en `text-align:center`-wrapper — **nav centrerad**; `.nav-other{position:absolute;right:0}` — kundvagn/konto höger. Öppnar **mega-meny** (`.nav-dropdown`) med kolumnrubriker: "Shop" (12 länkar) och "Shop by occasion".
- Rad 3: `.mobile-nav-scroll-wrapper` — horisontellt scrollande chip-rad med **21** genvägar: Peonies · Valentine's · Mother's Day · Passover · Easter · Thanksgiving · Rosh Hashanah · In vase · **Under $80** · Birthday · Anniversary · Sympathy · Just because · Amaryllis · Anemones · Ranunculus · Roselilies · Roses · Tulips · On sale.
Kundvagnen är en **slideout** (`shopify-section-slideout-cart`, `<h4>Your Cart (${cart.item_count})</h4>`).

**HERO. Split, inte fullbleed.**
```css
.homeHero      { height: calc(100vh - 125px); margin: 0 auto 75px; }
.homeHero-image{ width:57%; position:absolute; right:0; object-fit:cover; }
.homeHero-info { width:35%; position:absolute; left:25px; top:50%; transform:translateY(-50%); }
.homeHero-title{ text-shadow:-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff; }
```
Foto till höger (57 %, klickbart → /pages/peonies), text till **vänster i eget fält** (35 %): `<h1 class="homeHero-title">` **43 px** — "Toronto flower delivery you can actually count on" — underrubrik "Making someone's day has never been easier", knapp "Shop all", och en **stats-rad**: 98 % 5-star reviews · 300 000+ days made. Vit text-shadow-kontur = texten får ligga på foto utan att bli oläslig.

**SEKTIONSORDNING (start), uppifrån:**
1. Annonsbanner (leveranspriser) → 2. Header + chip-rad → 3. Split-hero med stats → 4. Occasions-karusell (7 kort: anniversary, birthday, congratulations, get well, just because, sympathy, thank you — med hover-bild) → 5. "Tonic Blooms classics" (produkt-karusell) → 6. "Vase arrangements" → 7. "Hot summer designs" → 8. **"Toronto flower delivery zone"** (karta + leveransalternativ + adress-koll) → 9. Recensioner ("What our bloomers say", 19 namngivna) → 10-20. Redaktionella text+bild-band: "The best Toronto flower delivery experience!", "Toronto's most trusted flower delivery – here's why", "100% Happiness Guarantee", "Same-day flower delivery options and cutoffs", "Send flowers last-minute in Toronto in the downtown core", "Meet the Farmboy – our signature bouquet", "Refer a friend! Give $10 Get $10", "Order birthday flowers online in the GTA", "Ontario's best Mother's Day…", "Send fresh, long-lasting roses…", "Same-day flower delivery areas we serve" → 21. FAQ → 22. "Pick-up available at the downtown Toronto location" + Google Maps-iframe → 23. Sidfot.
Startsidan är alltså **kort först, SEO-prosa sen** — ~12 redaktionella band under produkterna.

**PRODUKTKORT.**
```css
.prodCard              { width: calc((90% - 60px) / 3); margin-right:30px; scroll-snap-align:start; }
.prodCard-imageContainer { padding-top:122%; }        /* stående ~1:1.22 */
.prodCard-price        { font-size:14px; font-weight:700; color:#3c3660; }
.featProd-container    { overflow-x:auto; scroll-snap-type: x proximity; }
```
**3 per rad**, men i en **horisontell snap-karusell** med pilar (`.featProd-arrow--prev/--next`), inte ett statiskt rutnät. Varje kort: två `<img>` (primär + **hover-swap**), overlay-knapp "Add to cart" ovanpå bilden (+ separat mobil-knapp i info-blocket), titel, pris ("$94"), och en **`prodCard-status pill` = "Next availability: <datum>"** (Vue-bunden till `data-inventory-count` / `next_available_date`). Rea-pill i limegrönt `#dcf572`.

**HUR MAN HANDLAR.** **Ett klick** från startsidan: "Add to cart" direkt på kortet → slideout-kassa → checkout. Leveransdatum/-tid väljs **i kassan** ("Delivery options will be reflected when selecting delivery date and time during checkout"), men *tillgängligheten* exponeras redan på kortet via "Next availability"-pillen. Adresskontroll finns som egen widget:
> `<h3 class="h5">Not sure if we deliver to you?</h3>` "Enter your delivery address and we'll let you know." → `<input placeholder="Enter delivery address">` (Google Places-autocomplete, `onpaste="return false"`) + knapp "Check >".
Leveranslogik som pills: **Same-day** (bil-ikon, "Morning / Daytime / Evening") och **On Demand** (cykel-ikon, "Delivered within 2 hours"). Finstilt om cut-off → FAQ-sidan.

**PRISLISTA/TJÄNSTER.** Inga "tjänster". Priser bor på korten. Kategorierna är prisstyrda ("Under $80") och tillfällesstyrda ("Sympathy", "Just because").

**SIDFOT.** `.footer{background:linear-gradient(90deg,#e8e7f1 70%, #3c3660 70%)}` — **tvådelad fond**, ljuslila 70 % + mörklila 30 %. Flex-rad: logga, navlistor (Shop flowers · Give $10, get $10 · Delivery info · About us · Flower care · Contact · Careers · Holidays-dropdown med 10+ helger), samt nyhetsbrev "Stay in the know". Sidfoten **säljer** (referral, leveransinfo, helgkalender).

**TYPOGRAFI.** **Ett** typsnitt: `font-family:"Quicksand", sans-serif` överallt (rundad geometrisk sans). `.h1 43px` (mobil 24), `h2 36px/500` (mobil 18), `h3 32px`, `h4 24px`, body 14-16 px, `line-height:1.5`. Färg `#3c3660` (mörklila) på all typografi, `#8a28ca` på rea. Knapp: `padding:15px 55px; border-radius:0; border:2px solid #3c3660` — **rektangulär, ingen rundning**. Container `max-width:1250px`.

**OMÖJLIG ATT FÖRVÄXLA:**
1. **Leveransen är produkten** — annonsbanner med leveranspris, "Next availability"-pill per kort, adress-koll, same-day/2h-pills, leveranszons-karta.
2. **Split-hero 35/57** med text i eget fält bredvid fotot + social proof-siffror i heron.
3. Ett enda rundat sans-typsnitt (Quicksand), lila palett, **noll serif** — och en sidfot med färgdelad gradient.

---

## 3. Haute Floral — "det tryckta magasinet"

**NAVIGATION. Centrerad stapel, symmetrisk.** `body class="… stack-navigation"`.
```css
#header                          { width:70%; margin:0 auto; }
.canvas-style-normal #upper-logo { max-width:500px; margin:0 auto; padding-top:55px; }
.logo-image .logo img            { max-height:120px; }
.canvas-style-normal #topNav     { margin-top:60px; }
.main-nav                        { border-bottom:1px solid #b3b4b7; padding-bottom:15px; }
body #topNav ul>li>a             { font-size:.95em; letter-spacing:.15em; }
#topNav nav li:not(.filter)+li::before { content:'|'; padding-right:31px; }
```
Alltså: **vapen/ordbild-logga (max 120 px hög) centrerad**, under den en tagline injicerad med CSS (`#header.clear::after`, `font-family:'Pinyon Script', cursive; font-size:1.55em`), och därunder en centrerad nav vars punkter **separeras av bokstavliga `|`-tecken**, spärrad text (`letter-spacing:.15em`), avslutad med en tunn grå linje. Nav: About · Services · Gallery · FAQs & Forms · Blog · Contact. **Ingen kundvagn, ingen shop, ingen sticky.**

**HERO.** Fullbredds-**bildspel** (`sqs-gallery-block-slideshow`) med **8** slides, `content-fill` + `.color-overlay` per slide. **Ingen text, ingen rubrik, ingen knapp i heron.** Bilden får tala; först under heron kommer ord.

**SEKTIONSORDNING (start), uppifrån:**
1. 8-bilders bildspel → 2. **Citat-block** (versal, spärrad Playfair, centrerat, med 2 px linjer ovan/under via `blockquote::before/::after`) → 3. rad med **3 klickbara bildbrickor** → `/about`, `/services`, `/faqs` (12-kolumnsrad, `sqs-col-2`) → 4. `<h1>Get to Know Your Florist</h1>` → 5. **kvadratiskt galleri-rutnät, 4 per rad** (`sqs-gallery-aspect-ratio-square sqs-gallery-thumbnails-per-row-4`) → 6. bild-slider → 7. `<h1>latest features & publications</h1>` (press-logo-slider) → 8. Instagram-feed → sidfot.
Startsidan är en **portfölj/redaktionell uppslagssida** — bilder, citat, press. Noll produkter.

**PRODUKTKORT.** Finns inte. Närmaste motsvarighet = de 3 bildbrickorna (about/services/faqs) och galleriets kvadrater.

**HUR MAN HANDLAR/BOKAR.** Rent lead-flöde: kontaktformulär + "new client questionnaire" (nedladdningsbara formulär på `/faqs`) → konsultation → offert → **retainer 25 %** av kontraktet, resterande **21 dagar** före eventet. Citerat ur FAQ: *"You may send an inquiry through our contact form and fill out a new client questionnaire (found below) and we will get in touch."* · *"Our retainer is 25% of the initial contract, with the remaining balance due (21) days before your wedding/event date."* · *"DO YOU HAVE A MINIMUM BUDGET? A: No, we do not!"* · *"All delivery, setup, and teardown is included in the proposal already."* Ingen kassa, inget leveransdatum, ingen ZIP, ingen same-day.

**PRISLISTA/TJÄNSTER.** `/services` = **tre långa redaktionella sektioner**, alla i gemener som `<h1>`: **weddings** · **social & occasions** · **corporate**. Ren prosa + bilder, **inga priser, inga paket, ingen tabell**. Villkoren ligger istället som Q/A på `/faqs`.

**SIDFOT.** Instagram-feed (`<h3>Join us on Instagram</h3>` / `<h3>@hautefloral</h3>`) + sociala ikoner. Kontaktuppgifterna är **injicerade via CSS**:
```css
#footer.clear::after{content:"Luxury Florist based out of Dallas, Texas specializing in \A Weddings, Social Events, Special Occassions & Corporate floral. \A \A 214.578.6046 | info@hautefloral.com \A 2431 Shorecrest Drive, Ste D9, DALLAS, TX 75235";
  font-family:'Pinyon Script',cursive; font-size:1.55em; text-align:center;}
```
`#footerBlock{width:70%;margin:0 auto}` och `#footerBlock .col~.col{border-left:1px solid #b3b4b7}` — kolumner åtskilda av hårlinjer.

**TYPOGRAFI. Fyra familjer.** `Cinzel` (versal-romersk display, laddad via Squarespace-fonts) · `Merriweather` (300) · `Playfair Display` (bröd: `body{font-family:"Playfair Display",serif;color:#727272;font-size:16px}`, `p{line-height:1.8em}`) · `Pinyon Script` (kursiv accent i header/footer). `h2{font-size:1.9em}` (~30 px), `#footer h2 1.6em`, `#footer h3 1.2em` versalt med `letter-spacing:1px`. Rubriker skrivs **medvetet i gemener** ("weddings", "frequently asked questions") medan citat och sidfot är **versala och spärrade**. Grått, aldrig svart: `#727272` / `#636568` / linjer `#b3b4b7`.

**OMÖJLIG ATT FÖRVÄXLA:**
1. **Symmetrisk, centrerad krön-header med `|`-separerad, spärrad nav** och skriv-typsnitt som tagline — 70 % sidbredd, inget klibbar.
2. **Textlöst 8-bilders bildspel** + citat-block med linjer = magasinsuppslag, inte butik.
3. **Priser existerar inte** — hela affären är retainer/offert, och tjänsterna är tre essäer i gemener.

---

# SYNTES — de 8 axlarna där riktiga floristsajter faktiskt skiljer sig

Checklista för mall-bygget. Varje mall ska ta ett **medvetet ställningstagande på varje axel** — och två mallar får aldrig ha samma vektor.

1. **Headerns arkitektur.** Centrerad stapel (logga över nav, Haute) · logga-vänster + centrerad nav + ikoner-höger (Tonic) · **ingen header alls** — nav lever inne i innehållet (Sadie's). Antal rader: 1, 2 eller 3 (utility-/kampanjrad + navrad + chip-rad). Sticky eller inte. Mappar/dropdown vs mega-meny med kolumnrubriker vs platt.
2. **Herons typ.** Textlöst bildspel (Haute) · split med text i eget fält bredvid fotot (Tonic, 35/57) · delad skärm utan scroll där heron ÄR sajten (Sadie's) · fullbleed foto med överlagd text · typografisk platta. Följdfråga: ligger rubriken **i** bilden eller **bredvid**? Finns h1 överhuvudtaget?
3. **Var affären bor.** Kort med "Köp"-knapp (Tonic: 1 klick) · formulär/offert (Sadie's) · retainer + konsultation (Haute: 0 klick, betalvillkor i FAQ). Detta avgör om mallen behöver kassa, kalender eller bara ett formulär.
4. **Hur leveranslogiken exponeras.** Osynlig (event-florister) ↔ maximalt exponerad (Tonic: kampanjbanner med leveranspris, "Next availability"-pill per kort, adress-koll med autocomplete, same-day/2h-pills, leveranszons-karta, cut-off-sektion). Axeln har minst tre lägen: ingen · leveransinfo som sektion · leverans som genomgående UI-lager.
5. **Produktens form.** Inga produkter (portfölj) · galleri-rutnät i kvadrat 4/rad (Haute) · horisontell snap-karusell 3/rad med hover-bildbyte, pris, badge och overlay-köpknapp (Tonic, bildratio 122 % stående). Bestäm: ratio (1:1 / 4:5 / 1:1.22), antal per rad, badge-typ, hover-beteende, pris synligt eller ej.
6. **Mängden redaktionellt innehåll under vecket.** Noll (Sadie's: skärmen är hela sidan) · portfölj/citat/press (Haute: bildspel → citat → brickor → galleri → press → IG) · ~12 SEO-prosaband efter produkterna (Tonic). Detta styr sektionsantalet: 1 · 6-8 · 20+.
7. **Typografiskt system.** En rundad sans för allt (Tonic: Quicksand, h1 43 / h2 36 / body 14-16, rektangulära knappar utan radie) ↔ fyra familjer med rollfördelning (Haute: Cinzel display + Playfair bröd + Merriweather + Pinyon Script som accent; gemena rubriker, versala spärrade citat, grått #727272 i stället för svart). Bestäm: antal familjer, versal vs gemen rubrikstil, spärrning, knappradie, rubrik-px.
8. **Vad sidfoten bär.** Bara nyhetsbrev, kontakten sitter i headern (Sadie's) · social feed + kontakt som dekorativ typografi (Haute, ::after i skrivstil, kolumner med hårlinjer) · **hela affären**: navlistor, referral, leveransinfo, helgkalender, nyhetsbrev, färgdelad gradient-fond (Tonic). Axeln: dekorativ · informativ · kommersiell.

**Regel som faller ut:** olikhet skapas inte av palett utan av *var elementen ligger, hur många av dem det finns och vad som är sajtens första löfte* — foto (Haute), leverans (Tonic) eller varumärkesnamnet självt (Sadie's).
