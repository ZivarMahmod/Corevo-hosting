# 🔍 Kassasystem + bokningskonkurrenter — research 2026-06-07

**För:** Corevo Booking (~1200 kr/mån allt-i-ett). **Fråga:** vilka kassasystem kan vi plugga in via adaptern, vad tar konkurrenterna, var är luckan?
**Källäge:** webbsök 2026-06-07. ✅ = verifierat på leverantörens egen sida. ⚠️ = andrahandskälla eller "på begäran" — GISSA INTE vidare på dessa siffror.

---

## 🧾 DEL A — Kassasystem (svensk salongs-/småbutiksvärld)

### A1. Översikt per system

| System | Pris mjukvara/mån | Hårdvara | Öppet API? | Tredje part kan SKICKA order / få betalhändelser? | Kontrollenhet (Skatteverket) | Vanlig hos frisörer? |
|---|---|---|---|---|---|---|
| **ES Kassasystem / DinKassa** ([API-doc](https://eskassa.se/developer/)) | ⚠️ på begäran (paketpris via återförsäljare) | PC-kassa + kontrollenhet, paket | ✅ JA — REST, JSON, [dinkassa.se/api/docs](https://www.dinkassa.se/api/docs). Gratis för integratörer; **kassakunden betalar tilläggsavgift för API-koppling** | ✅ JA — API:t kan "create orders in the cash register" + läsa transaktioner. Sync varannan minut eller direkt efter köp (Pro+) | Fysisk kontrollenhet ingår i paket; anmäls via [eskassa.se-guide](https://eskassa.se/kunskapsportalen/anmalanskatteverket/) | ✅ Ja — rekommenderas för salonger av återförsäljare (Kassahuset). **Corevos kund #1 kör detta** |
| **Onslip** ([pris](https://www.onslip.com/pris-pa-kassasystem/), [API](https://developer.onslip360.com/)) | ✅ Bas ca 299 kr; Standard 529 kr (kampanj, ord. 829); Premium 829 kr (ord. 1229) | Surfplatta (egen funkar) el. allt-i-ett; kortterminal hyra fr. 165 kr/mån | ✅ JA — Onslip 360 API, SDK:er för TS/Java/PHP, OAuth2/Hawk, api@onslip.com | ✅ JA — full CRUD inkl. order; webhooks finns. Har egen [hälsa & skönhet-sida](https://www.onslip.com/halsa-och-skonhet/) | Kontrollenhet **ingår** i månadslicensen, molnbaserad | ✅ Ja — marknadsför sig mot salonger; 1300+ kunder |
| **Zettle by PayPal** (nu "PayPal POS") ([priser](https://www.zettle.com/se/priser), [API](https://developer.zettle.com/)) | ✅ Kassaregister 299 kr/mån (extra kassa 99 kr) | Reader fr. 249 kr; Terminal fr. 1999 kr (exkl. moms). 1,85 % per korttransaktion | ✅ JA — developer.zettle.com, OAuth, self-hosted eller partner-hosted appar | ⚠️ DELVIS — läsa köp/produkter/lager + prenumerera på köphändelser går; **skicka in order i kassan går INTE** (read-orienterat API) | Certifierat kassaregister med molnbaserad kontrollfunktion, godkänt av Skatteverket | ✅ Mycket vanlig hos små salonger (låg tröskel, ingen bindning) |
| **Sitoo** ([sitoo.com/se](https://www.sitoo.com/se/kassasystem/), [developer](https://developer.sitoo.com/)) | ⚠️ fr. ~298 kr/mån enl. [BusinessWith](https://businesswith.se/jamfor-system/sitoo-vs-joboffice/) — officiellt på begäran | iPad/enhet + tillbehör | ✅ JA — "API-first", öppen developer-portal med full doc | ✅ JA — order, produkter, lager, priser via API | Godkänt kassaregister, molnbaserat | ⚠️ Nej — retail/kedjor, overkill för enskild salong |
| **SumUp** ([avgifter](https://help.sumup.com/sv-SE/articles/4oI3qHHji2I2S9dyvRfec3-priser-avgifter)) | ✅ 0 kr/mån grundläge; kassapaket säljs via återförsäljare (⚠️ SE-pris för full POS oklart) | Läsare fr. 199–789 kr; 1,49 % per transaktion (0,79 % med Payments Plus) | ⚠️ DELVIS — globalt API finns (sumup.com/developers) men POS-delen i SE är grund | ⚠️ Betalhändelser via API går; order-push till kassan nej | Certifierat kassaregister-paket finns via återförsäljare | ⚠️ Viss spridning (billigast in) |
| **Trivec by Caspeco** ([caspeco.com](https://caspeco.com/produkt/trivec-kassa/)) | ⚠️ på begäran — prenumeration, skräddarsytt prisförslag | Leasing via partner | ⚠️ Integrationer finns (hotell, ekonomi, personal) men partnerstyrt, ej öppen self-service-portal | ⚠️ Via partneravtal | Ja, godkänt | ❌ Nej — restaurang/bar/hotell |
| **Caspeco (kärnprodukt)** ([caspeco.com](https://caspeco.com/)) | ⚠️ på begäran | — | ⚠️ partnerstyrt | ⚠️ | Ja | ❌ Nej — restaurangbransch |
| **Voady** ([kassa](https://www.voady.se/kassa/)) | ✅ Kassa Basic 139 kr/mån, Premium 349 kr/mån per kassaregister — **kräver Voady bokningssystem (minst "mini")** | Moln, egen enhet | ❌ Inget publikt API hittat — helhetsplattform, konkurrent snarare än integrationsmål | ❌ | Godkänt kassaregister ingår | ✅ JA — "av frisörer för frisörer", direkt konkurrent till Corevo |
| **Bokadirekt Kassa** (modul, [abonnemang](https://business.bokadirekt.se/abonnemang)) | ✅ 295 kr/mån som tillägg till Bokadirekt-abonnemang | — | ❌ Bara inom Bokadirekts egen plattform (de SÄLJER webhooks/API separat, se Del B) | ❌ | Certifierat, integrerat | ✅ JA — vanligaste kombon bokning+kassa hos frisörer |
| **EasyCashier** ([butikskassa](https://www.butikskassa.com/product/easycashier-kassaprogram-for-salong-och-butik)) | ⚠️ licens per 12 mån, pris via återförsäljare | PC-kassa | ⚠️ oklart — inget öppet API-doc hittat | ⚠️ | Fysisk kontrollenhet | ✅ Ja, salong/butik-profil |
| **"Winbag/Wibe"** | — | — | — | — | — | ❌ **Hittades inte** — finns sannolikt inte under det namnet. Närmast i salongssegmentet: Valei, Opensolution ([Kassahuset](https://www.kassahuset.se/kassasystem/)) |
| **Klarna-kopplade kassor** | — | — | — | — | — | ❌ Klarna har ingen egen salongs-POS i SE; Klarna är betalsätt i e-handel/checkout, inte kassaregister. Ej relevant som adapter-mål |

### A2. Kontrollenhet — det Corevo måste veta
- Krav: certifierat kassaregister + kontrollenhet (fysisk ELLER molnbaserad), anmält till [Skatteverket](https://www.skatteverket.se/foretag/drivaforetag/kassaregister.4.121b82f011a74172e5880005263.html).
- **Nya regler från 2027-01-01** (SKVFS 2021:17) moderniserar kraven; molnbaserade kontrollenheter (t.ex. [Infrasec CCU](https://www.infrasec.se/sv/ccu), CleanCash MultiUser) är godkända. Källa: [GeniusPay-genomgång](https://geniuspay.se/kassaregister-2027-nya-krav-molnbaserad-kontrollenhet/).
- 👉 Corevo ska INTE bli kassaregister själv — adaptern pratar med redan godkända kassor. Då ärver vi deras kontrollenhets-compliance. Bygger vi någonsin egen kassa = helt annat regelprojekt.

### A3. Slutsats Del A — integrationsordning

| Prio | System | Varför |
|---|---|---|
| 🥇 1 | **ES/DinKassa** | Öppet REST-API, kan både skicka order och läsa betalt, gratis för integratör, OCH kund #1 kör det redan. Bygg adaptern mot denna först = verklig kund som testpilot |
| 🥈 2 | **Onslip 360** | Bästa developer-upplevelsen (SDK:er, OAuth2, publika docs), kontrollenhet ingår, säljer aktivt mot salonger |
| 🥉 3 | **Zettle/PayPal POS** | Störst spridning hos småsalonger. MEN: bara läsa köp + betalhändelser, inte pusha order → adaptern får ett "read-only-läge" för Zettle-kunder |
| Senare | Sitoo | Tekniskt utmärkt API men fel kundsegment (retailkedjor) |
| ❌ Stängda/fel | Voady, Bokadirekt Kassa (slutna ekosystem = konkurrenter), Trivec/Caspeco (fel bransch, partnerstyrt), Klarna (ingen POS) |

**Arkitektur-bekräftelse:** rail-agnostisk adapter är rätt — tre första målen har tre olika auth-modeller (header-trio / OAuth2-Hawk / OAuth2) men samma domänbegrepp (order, rad, betalning, dagsavslut).

---

## 🥊 DEL B — Bokningskonkurrenter

### B1. Översikt per konkurrent

| Konkurrent | Månadspris | Provision/dolda avgifter | Vad kunden FÅR | Bindningstid | Vad kunder klagar på |
|---|---|---|---|---|---|
| **Bokadirekt** ([abonnemang](https://business.bokadirekt.se/abonnemang)) | ✅ Mini 295 / Plus 395 / Premium 695 kr (1 användare ingår). Moduler: Kassa +295, Journal +199/användare, **Webhooks +199, API-koppling +399** | Officiellt "ingen bokningsavgift"; transaktionsavgift vid extern betalleverantör (Stripe). ⚠️ [Frisörekonomi](https://frisorekonomi.se/jamforelse-bokadirekt-timma-bokamera/) uppger 3–5 % provision på marknadsplats-bokningar — ej bekräftat av Bokadirekt själva. SMS kostar extra | Profil i Sveriges största marknadsplats, kalender, app. INGEN egen hemsida, INGEN egen domän — kunden bygger Bokadirekts varumärke | Avtal förekommer (recensent: bunden till 2025 + 399 kr/mån terminalavgift) | [Trustpilot](https://se.trustpilot.com/review/www.bokadirekt.se): dålig support/kommunikation, krångligt UI, prishöjningar, säljare som låser in i avtal, presentkort som "brinner inne" |
| **Fresha** ([priser SE](https://www.fresha.com/sv/pricing)) | ✅ Frilansare 158,95 kr/mån; Team 105,95 kr/mån **per bokningsbar teammedlem** (4 pers ≈ 424 kr) | ✅ **Engångsavgift per NY kund från marknadsplatsen: 20 % av första besökets värde** (min-avgift gäller, [källa](https://www.fresha.com/help-center/knowledge-base/billing-and-fees/188-marketplace-new-client-fees)). Avgiften tas även om SALONGEN avbokar åt kunden. Kortbetalning via Fresha = transaktionsavgift. SMS/marknadsföring = tilläggsköp | Kalender, POS-funktion, marknadsplats, bokning via FB/IG/Google. INGEN egen hemsida/domän | ✅ Ingen bindning | [Trustpilot](https://www.trustpilot.com/review/fresha.com): 20 %-avgift debiterad för kunder som INTE kom via Fresha (bevis ignorerade), långsam support (telefonsupport kräver betalplan), tvång in i Freshas betalflöde |
| **Timma** ([pris](https://timma.se/pro/pricing)) | ✅ Grund 150 kr/mån; +SMS ≈ 328 kr; + kassa/bokföring ≈ 528 kr ([Frisörekonomi](https://frisorekonomi.se/jamforelse-bokadirekt-timma-bokamera/)) | SMS styckpris (0,80 kr/st bekräftelser) | Bokningssida (timma.se-undersida), kalender, kassakoppling. Ingen egen domän/hemsida | Månadsvis | Mindre marknadsplats-exponering än Bokadirekt; färre integrationer |
| **Boka.se / BokaMera** ([bokamera.se](https://bokamera.se/categories/online-tidsbokning-salonger)) | ✅ fr. 149 kr/kalender/mån vid 12-mån avtal (dyrare vid 1/3 mån) | Serviceavgift/bokningsavgift-modell finns ([support](https://boka.zendesk.com/hc/sv/articles/360022442212)) | Generiskt bokningssystem + API. Ingen salongsnisch, ingen hemsida | 1/3/12 mån | Generiskt — inte byggt för frisörflöden |
| **Wavy** ([get-wavy.com](https://get-wavy.com/)) | ✅ 229 kr/mån (SMS + support ingår). Kassa +129 kr/bolag, betalning +199 kr/bolag, startavgift 250 kr. Swish 2,50 kr/transaktion | Transaktionsavgifter på betalning | Bokning + kassa + betalning, salongsnischat. Ingen marknadsplats, ingen egen hemsida/domän | ✅ Ingen bindning | Litet bolag (supportrisk); "Weiv" som namn hittades inte — bolaget heter Wavy |
| **Salonized** | ⚠️ Ingen svensk närvaro hittad i sökningarna (NL-bolag) — ej reell SE-konkurrent idag | — | — | — | — |
| **Voady** ([voady.se](https://www.voady.se/)) | ✅ Kassa 139–349 kr/mån + bokningssystem (mini) — totalpris ⚠️ på begäran | Lönesystem m.m. som tillval | Bokning + kassa + lager + lön + hyrstol — närmast Corevo i "allt-i-ett"-tanke. Ingen marknadsplats, ingen kund-hemsida | ⚠️ oklart | Frisörnischat och omtyckt — den FARLIGASTE funktionella konkurrenten, men saknar hemsida/domän-benet |
| **"Ren hosting"** (one.com/Loopia + telefonbokning) | ✅ ~15–60 kr/mån för webb+domän | — | Hemsida + domän, NOLL bokning, NOLL kassa, NOLL SMS, NOLL no-show-skydd | — | Inte ett system — manuellt arbete, missade samtal = missade intäkter |

### B2. Vad kostar det EGENTLIGEN för en typisk salong (3 anställda, vill ha bokning+SMS+kassa+synlighet)?

| Aktör | Realistisk månadskostnad | Ingår hemsida + egen domän? |
|---|---|---|
| Bokadirekt | Plus 395 + kassa 295 + SMS-tillägg → **~700–900 kr/mån** (+ ev. marknadsplatsprovision + extra användare) | ❌ Nej |
| Fresha | 3 × 105,95 ≈ 318 kr → ser billigt ut, men **+20 % på varje ny marknadsplatskund** (en ny kund/vecka à 600 kr ≈ +480 kr/mån) + betalavgifter → **reellt 800–1500+ kr/mån** | ❌ Nej |
| Timma | **~528 kr/mån** komplett | ❌ Nej |
| Wavy | 229+129+199 ≈ **557 kr/mån** + transaktionsavgifter | ❌ Nej |
| Voady | ⚠️ på begäran, uppskattningsvis 400–800 kr/mån | ❌ Nej |
| **Corevo** | **1200 kr/mån fast** | ✅ JA — hemsida + egen domän + bokning + betalning + SMS, 0 provision |

### B3. Slutsats Del B — luckan och säljargumenten

**Luckan:** INGEN svensk konkurrent ger salongen en EGEN hemsida på EGEN domän. Alla bygger sitt eget varumärke (bokadirekt.se/…, fresha.com/…, timma.se/…) — salongens kundrelation och SEO ägs av plattformen. Corevo är ensam om white-label-benet, och 1200 kr ligger bara ~300–500 kr över vad en Bokadirekt-salong redan betalar idag — utan att den får någon hemsida för pengarna.

**Topp-3 säljargument (biter hårdast):**
1. 💸 **"0 kr provision — dina kunder är DINA."** Fresha tar 20 % av första besöket per ny kund (och debiterar enligt Trustpilot även fel); Bokadirekt tar enligt branschkällor 3–5 % på marknadsplats-bokningar. Corevo: noll.
2. 🌐 **"Egen hemsida på egen domän ingår."** Hos alla konkurrenter är salongen en undersida i någon annans varumärke. Google-träffen på "frisör + ort" går till salongen.se — inte till bokadirekt.se.
3. 🔓 **"Ingen inlåsning + flytt gratis."** Bokadirekt-recensioner vittnar om avtal och avgifter för att slippa ur; Bokadirekt tar dessutom 199–399 kr/mån EXTRA för webhooks/API (= data ut). Corevo: ingen bindning, vi flyttar din data åt dig.

**Funktioner konkurrenterna SAKNAR som Corevo har/lätt bygger:** egen domän white-label (ingen har), webhooks/API utan tilläggsavgift (Bokadirekt tar betalt), no-show-skydd med kortregistrering, kassasystem-adapter mot kundens BEFINTLIGA kassa (alla andra tvingar in i sin egen), per-tenant-togglar i stället för paketstege.

**Att respektera:** Bokadirekts marknadsplats-exponering är på riktigt värd pengar för NYA salonger — Corevos motdrag är SEO på salongens egen domän + att salongen kan behålla ett billigt Bokadirekt Mini-konto parallellt under övergången.

---

## ⚙️ DEL C — Kapacitetskoll (40 salonger på Supabase Pro + CF Workers)

**Svar: nej, inte ens i närheten av ett problem.**

Grov räkning: 40 salonger × ~25 bokningar/dag × ~4 händelser per bokning (skapad, påmind, betald, kassakvitto/webhook) ≈ **4 000 events/dag ≈ 0,05 req/s** i snitt, kanske 1–2 req/s i värsta rusningstopp.
- CF Workers betalplan inkluderar 10 M requests/mån — vi skulle använda ~120 000/mån = **~1 %**.
- Supabase Pro klarar hundratals skrivningar/sekund; 4 000 rader/dag är försumbart (~120 k rader/mån, MB-nivå lagring).
- Kassasystem-polling (DinKassa synkar varannan minut) för 40 kunder = 40 anrop/2 min = 0,3 req/s — trivialt.

Flaskhalsen vid tillväxt blir aldrig volymen utan **felhantering/retries i adaptern** (idempotens-nycklar på webhooks) — designfråga, inte kapacitetsfråga.

---

## 🎯 10-raders-summering
1. 🥇 Integrera först: **ES/DinKassa** — öppet REST-API, kan skicka order, kund #1 kör det redan.
2. 🥈 Sedan: **Onslip 360** — bästa dev-portalen (OAuth2, SDK:er), kontrollenhet ingår, säljer mot salonger.
3. 🥉 Sedan: **Zettle/PayPal POS** — störst spridning, men read-only (betalhändelser ja, order-push nej).
4. Stängda/fel mål: Voady, Bokadirekt Kassa, Trivec/Caspeco, Klarna. "Winbag/Wibe" existerar inte under det namnet.
5. Bokadirekts verkliga kostnad: **~700–900 kr/mån** (Plus 395 + kassa 295 + SMS + ev. provision) — och webhooks/API kostar 199–399 kr/mån EXTRA.
6. Freshas verkliga kostnad: ser ut som ~318 kr/mån (3 pers) men **20 % engångsavgift per ny marknadsplatskund** → reellt 800–1500+ kr/mån, plus Trustpilot-vittnesmål om feldebiteringar.
7. Ingen konkurrent ger **egen hemsida på egen domän** — det är Corevos lucka, och den är hel.
8. Starkaste tre argument: 0 provision · egen domän/hemsida ingår · ingen inlåsning + gratis flytt.
9. Farligaste funktionella konkurrent: **Voady** (frisörnischad allt-i-ett) — men även de saknar hemsida/domän-benet.
10. Kapacitet 40 salonger: ~4 000 events/dag = ~1 % av CF Workers-kvoten — stacken är aldrig flaskhalsen.
