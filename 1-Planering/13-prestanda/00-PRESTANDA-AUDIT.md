# Prestanda-audit av Corevo — vad renderas när, och vad kostar det

> **Skriven 2026-07-15.** Beställd av Zivar efter återkommande `exceededResources`-krascher på
> Cloudflare ("CPU overload") vid flikbyten och ~20 samtidiga användare.
>
> **Metod:** en workflow med **60 agenter**. Sju parallella läsare tog varsin yta av `5-Kod`
> (rot- och route-layouter, storefront-render, admin-render, data/DB-lagret, beroenden,
> klient-JS, död kod). **Varje fynd skickades till en skeptiker vars enda uppgift var att
> MOTBEVISA det** — läsa filen och leta efter varför påståendet var fel. Ett falskt fynd är
> dyrare än ett missat.
>
> **Resultat: 52 fynd. 45 höll. 7 föll.**
>
> Ingen kod ändrades i den här omgången. Detta är kartläggningen.

---

## Utgångsdata (mätt, inte antaget)

Sex dygns produktionstrafik, hämtad ur Cloudflares GraphQL-analytics:

| status | requests | CPU P50 | CPU P99 | CPU P999 |
|---|---|---|---|---|
| success | **16 499** | 13 ms | 549 ms | 934 ms |
| **exceededResources** | **69** | 10 ms | 60 ms | 60 ms |
| clientDisconnected | 101 | 109 ms | 805 ms | — |

**Läs den mittersta raden.** De kraschade requesterna brände 10–60 ms CPU. De **lyckade** brände
mer. Om taket vore CPU skulle det vara tvärtom.

### Slutsats: det är INTE CPU

`exceededResources` täcker också **minne** (128 MB per isolat) och startup-tid. Datan pekar på
minne. Det stämmer med symptomet: kraschen kommer när man **byter flik snabbt** — då startas nya
isolat medan de gamla lever.

Det är också därför uppgraderingen till Workers Paid inte ensam löser problemet. Den var rätt av
andra skäl (gratisplanens 3 MiB-tak tvingade fram minifiering och höll bygget på gränsen), men
**mer CPU-kvot köper ingenting när CPU inte är det som tar slut.**

### Och det är inte "för många saker i en deploy"

Zivars hypotes var att systemet borde delas upp på flera Workers. Det hjälper inte: **varje isolat
får sina 128 MB oavsett hur många workers du har.** Tre workers = tre isolat som var och en laddar
för mycket kod. Problemet är *vad som ligger i modulgrafen*, inte hur många grafer som finns.

---


# HANDLINGSPLAN — vad som renderas när, och vad vi gör åt det

## 1. SVARET PÅ DIN FRÅGA: vad renderas när?

**Först en sak som gäller ALLT:** rot-layouten (`5-Kod/apps/web/app/layout.tsx`) körs på varenda request i hela plattformen — kundens storefront, din admin, inloggningen, till och med 404-sidan. På rad 37-39 importerar den florist-, ekonomi- och salong-registryn. Den vill bara ha ut tre strängar med färgpaletter (som skrivs ut som `<style>` på rad 233-237). Men registryn importerar i sin tur alla 13 tema-filer, och varje tema-fil (t.ex. `components/storefront/layouts/florist/calytrix.theme.ts:2-13`) importerar sina LEVANDE React-komponenter: nav, footer, undersidor, kundvagn, kassa, presentkort.

Konsekvensen: hela storefront-sviten hänger i rot-layoutens graf. Det är därför `/login` — en sida med en e-postruta och ett lösenordsfält — laddar **13 stylesheets, 513 kB CSS** (mätt live på superbooking.corevo.se) varav ~400 kB är mall-CSS som en inloggningssida aldrig rör. Samma sak på varje admin-sida. Det är också därför 404-sidan drar hela tema-CSS:en (bevisat i den byggda `_not-found.html`).

Kommentaren i `florist/registry.ts:28` säger "INGEN React-import här". Det är sant om filen själv och falskt ett steg ner. Det är förmodligen precis därför det här har fått ligga.

**(a) En kund öppnar en storefront** (`bokning.corevo.se`, `florist.corevo.se`):

1. Middleware (`middleware.ts:133`) kör en Supabase-auth-koll först av allt. För en anonym besökare kostar det nästan ingenting; för en inloggad blir det en riktig nätverkstur innan något annat händer.
2. `app/(public)/layout.tsx` (force-dynamic, rad 30 — inget cachas som färdig HTML) hämtar tenanten och kör sedan **sju separata `await` efter varandra**: copy (78), moduler (88), tre wizard-anrop parallellt (102), personal-substantiv (113), primär-CTA (123), kommande kurser (156), teammedlemmar (184). De är alla oberoende — de behöver bara tenant-id:t — men de körs på rad efter rad, som ett vattenfall. De två sista ligger inne i menylänks-arrayen: vi hämtar **hela personallistan** för att avgöra om ordet "Team" ska stå i menyn.
3. Sedan kör `app/(public)/page.tsx` samma sak en gång till (copy, moduler) plus tjänster och teasers. Att visa 3 produkter på startsidan gör att vi hämtar 60 produkter + alla deras varianter, och hela bloggtexterna, och sedan `.slice(0, 3)` (`load-module-teasers.ts:23-33`).
4. Allt det ovan är cachat 5 minuter per kund (`unstable_cache`). Så på en varm cache är det inte DB-anrop — men det är fortfarande sju uppslag i rad. Var femte minut, eller när en isolat är kall, blir det ett riktigt seriellt vattenfall mot Supabase. **Det är där dina P99 549 ms / P999 934 ms bor.** Det är inte CPU.
5. Sidan renderar EN mall — men `components/storefront/layouts/index.ts:4-36` har statiskt kopplat in alla 16. Bilderna hämtas som råa `<img>` mot Unsplash i 1600 px bredd, utan `srcset`. Din mobilkund laddar desktop-bilder.

**(b) En frisör öppnar kalendern** (`/admin/bokningar`):

1. Middleware: auth-koll (en riktig rundtur, hon är inloggad).
2. `getCurrentUser` (`lib/auth/session.ts:29-56`) gör tre saker i rad: hämta användaren från Auth, sedan `users`-raden, sedan `roles`-raden. Roles är en pytteliten tabell som aldrig ändras och som vi läser om vid varje sidladdning.
3. `PortalShell` (`components/portal/PortalShell.tsx:68,87,121,158`) gör fyra DB-anrop till, **också i rad**: tenant, moduler, bransch, platser. Inget `Promise.all`.
4. Sedan gör själva sidan om delar av det: `lib/admin/tenant.ts:43-75` är inte React-`cache()`-wrappad, så tenanten, platserna och modulerna läses **en gång till** i samma render. Cirka 3-5 helt onödiga DB-anrop per admin-sidladdning.
5. Ingen `Suspense` finns någonstans i admin (0 träffar i hela `app/(admin)/`). Hela sidan väntar tills det långsammaste anropet är klart. Loading-skeletten som redan finns används bara vid navigering, inte vid render.
6. Klienten får: rot-layoutens 502 kB CSS + 542 kB JS, plus admin-layoutens 270 kB (varav ~216 kB är Supabase-klienten inkl. realtidsmotorn, indragen av `RealtimeBookings` som renderar `return null`), plus kalenderns egna 90 kB JS + 48 kB CSS. Kalenderns fyra draglådor (boknings-, ny bokning-, block-, avbokningslogg) laddas statiskt fast de bara syns när man klickar.
7. Och: `RealtimeBookings` sitter i LAYOUTEN. Varje gång någon bokar, gör **varje öppen back-office-flik i salongen** en full omrendering av hela sidan — även flikar som står på /admin/tjänster. Tre flikar öppna = tre fulla renders per bokning, var och en med hela auth- och skal-vattenfallet ovan.

---

## 2. DE TUNGA SAKERNA, rangordnade efter vinst/risk

### A. Modulgraf — vad som ligger i minnet i varje isolat

**A1. Klipp kanten `app/layout.tsx:37-39` → tema-registryn.** Detta är den enskilt viktigaste raden i hela genomgången. Rot-layouten behöver tre strängar; den drar in ~860 kB mall-källkod med komponenter, kundvagnar, kassor och bokningswizard. Kedjan är bevisad hela vägen: `layout.tsx` → `florist/registry.ts` → `calytrix.theme.ts` → `calytrix.chrome.tsx` → `BookCta` → `BookingProvider` → `BookingWizard` → `app/boka/actions.ts`. Och en andra: `calytrix.theme.ts` → `calytrix.checkout.tsx` → `useCheckout` → `app/butik/actions.ts` → Supabase-servern.

*Fixen:* dela varje tema-fil i två — ren data (nyckel, namn, palett, copy) utan en enda import, och komponent-bindningen separat. Registryn importerar bara data-halvan. `layouts.ts`, som redan finns och redan importerar komponenterna, tar den andra halvan. Sätt ett grep-test i CI så att regeln "ingen React i registryt" blir sann på riktigt istället för en kommentar.

*Vinst:* stor och på två axlar samtidigt — den löser B1 nedan (400 kB CSS bort från varje sida) i samma rörelse, och den tar bort hela storefronten ur admin/login/API-isolatens graf. **Risk: medel** (många filer rörs, men mekaniskt).

*Ärlighet:* jag lovar dig INTE att detta ensamt fixar `exceededResources`. Det är den bästa hypotesen — eager evaluering av hela mall-sviten vid varje kall isolat-start — men den är obevisad tills vi mätt efteråt. Fixen är rätt oavsett.

**A2. Gör mall-uppslaget lazy** (`layouts/index.ts:4-36`, `florist/layouts.ts:4-15`). En kund kör ett tema; vi länkar in alla 16. Byt `Record<Tema, Komponent>` mot `Record<Tema, () => import(...)>`. Samma fix behövs i `StorefrontPreview.tsx` i onboarding-studion — den är en KLIENT-komponent som drar alla 16 layouter + 27 CSS-moduler ner i webbläsaren. Det är den dyraste grenen och den var nästan osynlig.

*Ärlighet om skala:* på Cloudflare ligger allt i ett workerscript ändå — lazy import tar inte bort en enda byte från deploy-artefakten, den skjuter upp parse/eval. Vinsten är kallstart och minne per isolat, inte bundle-storlek. Den växer däremot linjärt med varje ny mall du bygger, så det är rätt att göra det nu vid 16 och inte vid 50. **Risk: medel.**

### B. Bytes till klienten

**B1. De 502 kB CSS i rot-layouten.** Mätt ur byggmanifestet: `/layout` = 13 stylesheets. Fyra av dem hör hemma där (tokens, globals, booking-global, portal-global ≈ 104 kB). **De övriga nio, ~398 kB, är mall-CSS** — kassa 66, solsalt 66, onyx 54, galleri 62, kurser 60. De länkas på /login, på varje admin-sida och på 404. Faller ut automatiskt av A1. Okomprimerat 398 kB; över tråden med brotli ~40-50 kB — men det är **nio extra render-blockerande stylesheet-requests på varje sidladdning i hela plattformen**, och det är den delen som märks.

**B2. `booking-global.css` och `portal-global.css` i rot-layouten** (`app/layout.tsx:42-43`). Back-office-CSS skickas till varje kundstorefront; bokningsflödets CSS till varje admin-sida. Flytta dem ner till respektive segment-layout. **Ärlig storlek: ~24 kB gzip, och det cachas efter första besöket.** Det är en liten sak. Gör den för att den är gratis, inte för att den är stor.

**B3. Supabase-klienten på varje admin-sida** (`app/(admin)/layout.tsx:5,42`, samma i personal- och platform-layouten). `RealtimeBookings` är en osynlig komponent (`return null`) som drar in hela Supabase-browserklienten inkl. realtidstransporten — ~200 kB okomprimerat / ~55-70 kB gzip — på varenda admin-sida, inklusive /admin/tjänster som inte har någon realtidsdata. *Den ska inte raderas* — den gör ett riktigt jobb (uppdaterar kalendern när någon bokar). Den ska laddas lazy (`next/dynamic`, `ssr:false`) och helst bara monteras på de sidor som visar bokningar. **Risk: låg.**

**B4. Kalenderns draglådor.** `CalendarBoard.tsx` importerar BookingDrawer, NewBookingDrawer, BlockDrawer, CancelledLog och CalendarHelp statiskt (rad 9-26) trots att de bara visas vid klick. Det finns **inte en enda `next/dynamic` i hela `components/admin/`**. ~40-50 kB bort från kalenderns initialladdning. **Risk: låg.**

**B5. Bilderna.** Ingen `next/image` (medvetet — remote-configen är fryst), 63 råa `<img>`, 23 mot Unsplash med fast bredd 1600 px (`bransch-copy.ts:37-38`), noll `srcset`, noll `sizes`. 15 av 28 storefront-bilder saknar `loading="lazy"`. Mobilkunden laddar 2-4x mer bytes än nödvändigt. Fixen är en liten hjälpare som genererar `srcset` från samma Unsplash-URL (`?w=480/800/1200/1600`) — ingen ändring av den frysta configen. **Risk: låg. Det här är det som kunden faktiskt känner på 4G.**

**B6. Font-@import:en** (`packages/ui/tokens.css:23`). Ett `@import` mot fonts.googleapis.com mitt i en stylesheet som rot-layouten laddar. Det är render-blockerande och upptäcks först efter att tokens.css laddats — en extra rundtur till en tredjepartsdomän på varje sidladdning, typiskt 100-300 ms på kall anslutning. Sex av de sju familjerna self-hostas redan av next/font i samma layout. **VARNING:** raden går inte bara att stryka — temana refererar familjerna med literala namn (`'Cormorant Garamond'`) medan next/font bara ger hashade namn bakom `--font-*`-variabler. Stryker du raden faller typografin i 13 mallar tyst till Georgia. Fixen kräver att tema-tokens (rad 201, 319, 389, 447) skrivs om till variablerna först, och att Bebas Neue läggs till i next/font. **Risk: låg om man gör om tokens först, hög om man bara raderar.**

**B7. 33 typsnittsfamiljer i rot-layouten** (`app/layout.tsx:2-35`). Låter dramatiskt. Det är det inte: `preload:false` fungerar, woff2-filerna hämtas lazy, och @font-face-CSS:en är **5,9 kB gzip**. De 2,7 MB i `.next/static/media` ligger på disk, de skickas aldrig. **Gör inget här förrän allt annat är gjort.**

### C. Per-request-arbete (CPU + DB) — det som ger dig svansen

**C1. Slå ihop storefront-layoutens vattenfall** (`app/(public)/layout.tsx:78-186`). Sju awaits i rad → ett `Promise.all`. De är alla oberoende. Rent mekaniskt. Och: sluta hämta hela personallistan och hela kurskalendern bara för att avgöra om en menylänk ska visas — det räcker med en `count`. **Risk: låg. Detta är den bästa vinst/risk-kvoten i hela listan.**

**C2. Wrappa `currentTenant()` i React `cache()`** (`lib/tenant-data.ts:395`). Den anropas minst fyra gånger per startsida (metadata, layout, page, LocationHours) och är inte dedupad. **Det är en rad kod.** Samma sak för `getTenantById`, `listLocations` och `getAdminModuleStates` på admin-sidan — de läses två gånger per request. *Obs:* `cache()` på `getAdminTenant` ensamt räcker inte, eftersom PortalShell läser tenanten via en helt annan funktion. Man måste wrappa på båda ställena.

**C3. `PortalShell` (rad 68, 87, 121, 158) och `getCurrentUser` (rad 29-56).** Tre + tre seriella nätverksturer innan sidans egen data ens börjar hämtas. Slå ihop PortalShells tre sista till ett `Promise.all`, och slå ihop roles-läsningen till en join på `users` (`users.select('tenant_id, roles(level, name)')`). Sparar en rundtur i hela back-office. **Risk: låg.**

**C4. `/admin/kunder` — den farligaste** (`lib/admin/data.ts:343-361`). Vi hämtar alla kunder MED hela deras bokningshistorik inbäddad, plus hela lojalitetsliggaren, in i ett 128 MB-isolat — för att räkna antal besök och poäng. Ingen paginering, ingen gräns. **Och samma sak händer på varje enskild kunds detaljsida** — vi drar hela kundlistan för att få fram EN kunds poäng. Vid 1000+ kunder blir det inte bara långsamt: PostgREST kapar svaret vid taket och siffrorna blir **tyst felaktiga**. Fix: aggregera i SQL (vy/RPC) + paginering.

**C5. `/admin/statistik`** (`lib/admin/stats.ts:429-446`). Hämtar alla bokningar 13-24 månader bakåt med joins, plus hela kundtabellen, utan gräns, och räknar i JS. `force-dynamic` → ingen cache, varje omladdning gör om allt. Samma profil som C4: minne, inte CPU. Det här är precis vad `exceededResources` ser ut som.

**C6. Realtidsförstärkningen** (`RealtimeBookings.tsx:46`). Se punkt (b)7 ovan. Gate på `document.visibilityState === 'visible'` — flikar som ingen tittar på ska inte rendera om.

*Ärlighet om C1-C3:* allt är `unstable_cache`-wrappat med 5 minuters TTL. Vid varm cache är det inte DB-anrop, det är cache-uppslag. Vinsten är därför inte "6 sparade DB-anrop per besök" — den är **att cache-miss-fönstren och kalla isolat slutar bli 500-900 ms**. Sälj det inte för dig själv som mer än det är.

---

## 3. DÖD KOD — med bevis

Fyra rester efter rivna admin-ytor, noll importörer i hela repot: `components/admin/BrandingForm.tsx` (18 kB), `StorefrontMediaForm.tsx` (17,5 kB), `StorefrontCopyForm.tsx` (3,5 kB), `OpenSiteLink.tsx` (0,8 kB). Varumärke-sidan är numera bara en redirect (`app/(admin)/admin/varumarke/page.tsx:8`). De enda träffarna på "BrandingForm" gäller `PlatformBrandingForm` — en annan komponent.

Två köp-UI-dubbletter: `components/storefront/ShopCta.tsx` och `components/storefront/shop/CartButton.tsx`. Koden säger det själv — `AddToCart.tsx:3`: "Ersätter den parkerade ShopCta", och `app/(public)/layout.tsx:236`: "CartButton-bollen är borttagen här".

`components/storefront/skin/SkinRenderer.tsx` — importeras bara av sin egen testfil. Datalagret under den (`lib/storefront/skin/`) är däremot LEVANDE och används av salvia-temat — rör det inte.

`html-react-parser` i `package.json:26` — prod-beroende, noll importer.

`CreateTenantForm.tsx` (48 kB) — `app/(platform)/salonger/ny/page.tsx:2-3` importerar både den och OnboardingStudio, och väljer med en flagga som är hårdkodad `true` i `wrangler.jsonc:57`. CreateTenantForm renderas aldrig i prod. Antingen riv den eller ladda den lazy — men den är också vägen som drar in hela florist-sviten i super-admin-klienten (den importerar `FLORIST_THEMES` för att rita färgrutor), så den ska bort ur den kedjan oavsett.

**BRUTAL ÄRLIGHET OM DÖD KOD:** allt det här ger dig **noll bytes och noll millisekunder**. En fil som ingen importerar hamnar aldrig i bundlen. Vinsten är att du och nästa utvecklare slipper undra vilken av två kundvagns-knappar som gäller. Gör det när du städar, inte när du optimerar.

---

## 4. VAD VI INTE SKA GÖRA

**Dela upp i fler Workers hjälper INTE.** Varje isolat får sina 128 MB oavsett hur många workers du har. Splittar du appen i tre workers får du tre isolat med 128 MB var som var och en fortfarande laddar för mycket kod. Problemet är vad som ligger i grafen, inte hur många grafer du har.

**Queues, Durable Objects och Containers löser inga problem du har.** Du har inget kö-problem, inget koordinerings-problem och inget långkörnings-problem. De skulle bara lägga till infrastruktur att felsöka.

**Uppgradera inte Workers-planen igen.** Taket är inte CPU — det vet vi: de requests som KRASCHADE brände 10-60 ms, de som LYCKADES brände mer (P99 549 ms). Mer CPU-kvot köper dig ingenting.

**Byt inte Supabase-SDK.** Det finns en frestelse att tree-shaka bort realtidsmotorn ur serverbundeln. Den är statiskt inbyggd i `@supabase/supabase-js` och går inte att ta bort utan att byta bibliotek — orimlig risk, ingen mätbar vinst. Serverkoden laddas men körs aldrig; ingen socket öppnas.

**Ta inte bort `force-dynamic`-raderna från de 23 admin-sidorna.** De är redundanta (layouten sätter det ändå), men att stryka dem ger **exakt noll** prestandavinst. Det verkliga problemet är att det inte finns en enda `Suspense` i admin.

**Radera inte font-`@import`:en rakt av.** Se B6 — det byter ett prestandafynd mot en tyst typografi-regression i 13 mallar.

**Rör inte `preload:false` på fonterna.** Den fungerar. Noll font-preloads live. Det är den ENDA saken i den här genomgången som redan är rätt gjord.

---

## 5. ORDNINGEN

**Steg 1 — dela tema-filerna i data och komponenter (A1).** Detta först, ensamt, och sedan mäter vi. Det är det enda som samtidigt attackerar minnet i isolatet (din `exceededResources`-hypotes) och de 400 kB CSS på varje sida. Allt annat i listan är mindre. Mät `/login` efteråt: den ska gå från 13 stylesheets till fyra. Om den inte gör det, stanna och ta reda på varför innan du går vidare.

**Steg 2 — de billiga vattenfallsfixarna (C1, C2, C3).** `Promise.all` i storefront-layouten, `cache()` på `currentTenant` och admin-läsarna, en join i `getCurrentUser`. Låg risk, mekaniskt, och det är där dina 549 ms bor. Mät P99 efteråt — nu har du för första gången en isolerad mätning av om vattenfallet faktiskt var svansen.

**Steg 3 — de två minnesbovarna (C4, C5).** `/admin/kunder` och `/admin/statistik` ska aggregera i Postgres, inte i ett 128 MB-isolat. C4 är dessutom en **korrekthetsbugg** som väntar på din första kund med 1000+ kunder — siffrorna blir tysta fel, inte ett felmeddelande. Om du bara har tid med en sak efter steg 1, gör den här.

**Steg 4 — klientvikten (B3, B4, B5).** Lazy-ladda Supabase-realtiden, lazy-ladda kalenderns draglådor, sätt `srcset` på bilderna. B5 är den enda i hela dokumentet som din **slutkund** märker direkt.

**Steg 5 — resten.** Lazy mall-uppslag (A2, inkl. StorefrontPreview), `Suspense` i admin, font-tokens + `@import` (B6, försiktigt), realtids-gating (C6), och till sist städa död kod.

**Steg 6 — mät om.** Kör 6 dagars produktionsdata igen och jämför `exceededResources`. Om siffran inte gått ner efter steg 1-3 har vi haft fel om orsaken, och då mäter vi minnet direkt istället för att gissa vidare.

Kort sagt: **en rad i `app/layout.tsx` bär det mesta av kostnaden, och ett vattenfall i `(public)/layout.tsx` bär det mesta av väntetiden.** Resten är städning.

---

## Vad som FÖLL i granskningen

Sju fynd underkändes av skeptikerna. De ska inte behandlas som problem — någon kommer annars att
"fixa" dem igen om ett halvår.

**"33 typsnittsfamiljer i rot-layouten"** lät katastrofalt. Det är det inte: `preload: false`
fungerar, woff2-filerna hämtas lazy, och @font-face-CSS:en är **5,9 kB gzip**. De 2,7 MB i
`.next/static/media` ligger på disk och skickas aldrig till någon. **Fonterna är det enda i hela
kodbasen som redan är rätt gjort.** Rör dem inte.

**De 23 `force-dynamic`-raderna i admin** är redundanta (layouten sätter det ändå), men att stryka
dem ger **exakt noll** prestandavinst. Det verkliga problemet på den ytan är att det inte finns en
enda `Suspense` i hela `app/(admin)/`.

**Supabase-realtidsmotorn i serverbundeln** går inte att tree-shaka bort — den är statiskt inbyggd
i `@supabase/supabase-js`. Serverkoden laddas men körs aldrig; ingen socket öppnas. Att byta
bibliotek för det vore orimlig risk utan mätbar vinst.

---

# BILAGA — samtliga fynd, med fil:rad

Grupperade efter **sorts kostnad**, för de kräver helt olika åtgärder:

- **Modulgraf** — kod som lastas och evalueras i *varje* isolat. Kostar minne. Misstänkt för `exceededResources`.
- **Per-request-arbete** — CPU och DB-rundturer. Kostar väntetid. Här bor P99 549 ms.
- **Bytes till klienten** — HTML, CSS, JS. Kostar laddningstid hos användaren.
- **Död kod** — kostar **noll bytes och noll millisekunder** (ingen importerar den → den hamnar aldrig i bundlen). Städa för klarhetens skull, inte för prestandan.



## MODULGRAF — kod som lastas i VARJE isolat (minne)

### `5-Kod/apps/web/components/storefront/layouts/florist/registry.ts:28 (+ salong/registry.ts, ekonomi/registry.ts)`

**Registry-docblocket påstår 'INGEN React-import här' — men registry importerar de 13 *.theme.ts-filerna, och VARJE theme-fil importerar 5–8 React-moduler (chrome/pages/modules/cart/checkout/product/presentkort-views). Ex: calytrix.theme.ts:2-13 importerar CalytrixNav/Footer, CalytrixOm/Tjanster/Kontakt, CalytrixProduct, CalytrixCart, CalytrixCheckout, CalytrixPresentkort — flera av dem 'use client'. Att röra registryt = att dra in HELA mall-sviten.**

- **Kostnad:** De komponenter theme.ts-filerna drar in: 363 555 bytes källkod (chrome+pages+modules+cart+checkout+product+presentkort-views). Detta är MEKANISMEN bakom det redan funna app/layout.tsx-problemet: app/layout.tsx:37-39 importerar FLORIST/EKONOMI/SALONG_THEME_CSS ur registryn, alltså ligger hela klientträdet i modulgrafen på VARJE request (även /login, /admin, /api).
- **Åtgärd:** Splitta varje tema i två filer: *.meta.ts (key, name, palette, content, caps, ownsCopy, orderPrefix — NOLL React-import) och *.theme.ts (chrome/pages/moduleViews, React). registry.ts importerar bara *.meta.ts. app/layout.tsx, theme-palettes, theme-capabilities, theme-content och mallväljaren läser meta-registryt. Regeln 'ingen React här' blir sann och verifierbar (ett grep-test i CI).
- **Risk:** lag

### `5-Kod/apps/web/components/storefront/layouts/florist/layouts.ts:4-15,53-54`

**layouts.ts importerar statiskt alla 9 florist-layouter OCH spreadar in FLORIST_THEMES + EKONOMI_THEMES + SALONG_THEMES (findTheme, rad 53-54). De tre små hjälpfunktionerna themeChrome/themePages/themeModuleViews/themeOrderPrefix importeras av ~20 publika sidor — app/(public)/layout.tsx:11, kontakt, om, tjanster, blogg, shop, shop/[id], kassa, varukorg, klubb, kurser, offert, presentkort, team, galleri, bekraftelse + alla salong-preview-rutter.**

- **Kostnad:** Varje publik undersida — även /kontakt som inte renderar en enda mall-layout — får hela mall-sviten i sin modulgraf: 738 671 bytes .ts/.tsx under layouts/ + 395 969 bytes CSS-moduler. Att hämta en sträng ('#' som orderprefix) kostar 13 teman.
- **Åtgärd:** Bryt ut chrome/pages/moduleViews/orderPrefix till ett uppslag som slår mot *.meta.ts + `next/dynamic`-referenser (eller en `Record<string, () => Promise<Comp>>`), så bara den valda tenantens mall dras in. Minst: flytta themeOrderPrefix/themeChrome-uppslaget till meta-registryt som inte importerar layouter.
- **Risk:** medel

### `5-Kod/apps/web/components/storefront/layouts/index.ts:4-36`

**STOREFRONT_LAYOUTS är en statisk Record över ALLA 16 hem-layouter (7 lösa + FLORIST_LAYOUTS + EKONOMI_LAYOUTS + SALONG_LAYOUTS). app/(public)/page.tsx:35 slår upp exakt EN: `STOREFRONT_LAYOUTS[settings.theme]`. 15 av 16 laddas för att aldrig renderas.**

- **Kostnad:** Hela layouts-trädet (738 kB källa, 396 kB CSS-moduler) instansieras i isolatet för att rendera en mall. En tenant använder ~1/16 av det.
- **Åtgärd:** `const STOREFRONT_LAYOUTS: Record<StorefrontTheme, () => Promise<ComponentType>>` med `next/dynamic(() => import('./florist/CalytrixLayout'))` per nyckel. page.tsx gör `const Layout = STOREFRONT_LAYOUTS[settings.theme]` precis som förr — bara en lazy komponent. THEME_OWNS_MODULES (rad 46-51) ska läsa nyckel-listor ur meta-registryt, inte ur layouts.
- **Risk:** medel

### `5-Kod/apps/web/app/layout.tsx:36-38`

**Rot-layouten importerar florist/ekonomi/salong-registryn bara för att få ut palett-CSS (FLORIST_THEME_CSS m.fl.). Registry.ts importerar 22 st *.theme.ts, och VARJE theme-fil importerar sina React-komponenter (chrome/pages/modules/product/cart/checkout, t.ex. florist/calytrix.theme.ts:2-13). Hela mall-sviten hamnar därmed i rot-layoutens modulgraf.**

- **Kostnad:** components/storefront/layouts/ = 600 320 B .tsx + 395 969 B .css (mätt med find/awk) ≈ 996 kB källkod som laddas i VARJE isolat, på varje request (även /login, /admin, /api).
- **Åtgärd:** Bryt ut palett/CSS-strängen till en ren data-modul (t.ex. florist/palettes.ts) som INTE importerar theme-objekten. Rot-layouten importerar bara den. Themes/komponenter når då bara storefront-rutten.
- **Risk:** lag

### `5-Kod/apps/web/components/storefront/layouts/index.ts:4-14`

**Barrel-fil: STOREFRONT_LAYOUTS statiskt-importerar ALLA ~33 mall-layouter (7 handskrivna + FLORIST_LAYOUTS + EKONOMI_LAYOUTS + SALONG_LAYOUTS). Konsumenterna (app/(public)/page.tsx, app/salong-preview/[slug]/page.tsx, components/platform/onboarding-studio/StorefrontPreview.tsx) renderar exakt EN mall per request.**

- **Kostnad:** Hela ~996 kB mall-källkoden ligger i varje storefront-requests graf för att rendera 1 mall. /(public)/page = 501 kB JS + 270 kB CSS enligt app-build-manifest.
- **Åtgärd:** Byt eager-mappen mot per-nyckel next/dynamic (eller en lookup-map av () => import('./XLayout')) så bara den valda mallen laddas.
- **Risk:** medel

### `5-Kod/apps/web/.next/server/chunks/3051.js`

**Delad server-chunk = hela @supabase/supabase-js (GoTrueClient + RealtimeClient + storage + functions; 62 träffar på '@supabase', RealtimeClient 4). Den refereras av ~alla (admin)-sidor (grep: 20+ page.js) trots att server-rendern bara behöver postgrest+auth. Realtime behövs bara av components/realtime/RealtimeBookings (klientkomponent).**

- **Kostnad:** 735 788 B ominifierad chunk i varje admin-isolat.
- **Åtgärd:** Verifiera om server-vägen kan gå via @supabase/ssr + postgrest utan realtime-klienten; annars säkerställ att RealtimeBookings är den enda som drar in realtime (client-only chunk).
- **Risk:** hog

### `5-Kod/apps/web/middleware.ts:24`

**Middleware (kör på VARJE request före sidan) importerar updateSession → @corevo/auth createServerSupabase, plus custom-domain-uppslag och route-tabeller. Byggd middleware är stor.**

- **Kostnad:** .next/server/middleware.js = 330 828 B — laddas i varje isolat före sidan, ovanpå sidans egen graf.
- **Åtgärd:** Mät vad som dominerar middleware.js (troligen supabase-klienten); om sessionsuppdateringen kan göras med en ren cookie-/JWT-läsning slipper man dra in hela auth-klienten i middleware-isolatet.
- **Risk:** hog

### `app/layout.tsx:37-39`

**ROT-layouten importerar florist/ekonomi/salong-registryn. Registryn importerar *.theme.ts, och varje *.theme.ts bär LIVE React-komponentreferenser (.chrome/.pages/.modules/.cart/.checkout) — inte bara palett-data. Hela storefronten dras därför in i varje isolat, även för /login, /admin och API-rutter.**

- **Kostnad:** Uppmätt transitiv stängning från app/layout.tsx: 154 filer / 1 451 kB källkod. Innehåller BookingWizard.tsx (56.8 kB), app/boka/actions.ts (21.9 kB), app/butik/actions.ts (24.3 kB), lib/supabase/server.ts, lib/notifications/booking.ts, presentkort-views.tsx (27.4 kB). Bevisad kedja: app/layout.tsx -> florist/registry.ts -> calytrix.theme.ts -> calytrix.chrome.tsx -> brand/BookCta.tsx -> BookingProvider.tsx -> BookingDrawer.tsx -> booking/BookingWizard.tsx -> app/boka/actions.ts. Andra kedjan: calytrix.theme.ts -> calytrix.checkout.tsx -> shop/useCheckout.ts -> app/butik/actions.ts -> lib/supabase/server.ts. Detta är den enda kanten som behöver klippas — den förklarar både minnet/startup-tiden (exceededResources) och CSS-lasset i fynd 2.
- **Åtgärd:** Dela varje *.theme.ts i TVÅ filer: ren data (key/name/palette/content/caps — noll imports) och komponent-bindningen (chrome/pages/modules/cart/checkout). registry.ts importerar bara data-halvan; layouts.ts (som redan finns och redan importerar komponenterna) importerar komponent-halvan. Rot-layouten behöver bara paletten för sina <style>-block. Ännu bättre: generera tema-CSS:en till en statisk .css vid build och låt roten inte importera registryn alls.
- **Risk:** medel

### `app/(public)/layout.tsx:11`

**themeChrome importeras från florist/layouts.ts, som statiskt importerar ALLA 9 florist-*Layout.tsx plus ekonomi- och salong-registryn. En tenant som kör ETT tema laddar alla 13 mallars komponentträd i sitt isolat.**

- **Kostnad:** components/storefront/layouts/ = 1.1 MB totalt; florist-grenen ensam 723 kB. Kvarstår som kostnad för (public) även efter fix 1 (som bara räddar roten/back-office). Themeväljaren är en ren runtime-nyckel — inget kräver statisk länkning.
- **Åtgärd:** Byt FLORIST_LAYOUTS/themeChrome-uppslagen till next/dynamic per tema-nyckel, så bara den tenantens mall laddas. Registryt är redan uppdelat i data (registry.ts) och komponenter (layouts.ts) — det är layouts.ts som ska bli lat.
- **Risk:** medel

### `apps/web/app/(platform)/salonger/ny/page.tsx:2-3`

**Sidan importerar STATISKT både CreateTenantForm (48 kB) och OnboardingStudio (components/platform/onboarding-studio = 148 kB + lib/platform/onboarding-studio = 56 kB) och väljer med en runtime-flagga. Flaggan ONBOARDING_STUDIO_ENABLED='true' i wrangler.jsonc:57 → CreateTenantForm renderas ALDRIG i prod, men ligger i modulgrafen. (Vore flaggan av vore studion död istället.) Minst en av dem är alltid död kod.**

- **Kostnad:** CreateTenantForm 48 kB källa död i prod; hela paret ~250 kB källa i samma route-chunk
- **Åtgärd:** Ladda den ej valda vägen med next/dynamic (eller riv CreateTenantForm helt, flaggan är på i prod och i .env.local)
- **Risk:** lag

### `apps/web/components/storefront/layouts/index.ts:5-15`

**Registryt slår ihop 7 hand-teman (salvia/leander/zigge/linnea/edit/flora/freshcut) + FLORIST_LAYOUTS (9) + SALONG_LAYOUTS (3) + EKONOMI_LAYOUTS (1) = 20 hem-layouter, plus varje temas .chrome/.pages/.modules-filer. Produktionen har enligt DB-purgen EN tenant (freshcut) → 19 av 20 layouter kan aldrig rendera, men alla ligger i modulgrafen (florist 884 kB + salong 253 kB + ekonomi 77 kB källa).**

- **Kostnad:** ~1.2 MB temakällkod laddas i varje isolat för att rendera ett (1) tema
- **Åtgärd:** Byt STOREFRONT_LAYOUTS till lazy per nyckel (next/dynamic per tema) så bara det valda temat hamnar i request-chunken
- **Risk:** medel


## PER-REQUEST-ARBETE — CPU och DB (svansen)

### `5-Kod/apps/web/middleware.ts:133 → lib/supabase/middleware.ts:36`

**updateSession() kör supabase.auth.getUser() på VARJE request som matchar matchern (allt utom statiska filer) — även publika storefront-sidor, /api och sitemap/robots. Har requesten auth-cookies blir det en nätverks-rundtur till Supabase Auth (/auth/v1/user) INNAN någon routing/render börjar.**

- **Kostnad:** 1 extra Supabase-rundtur per inloggad request, seriellt före allt annat; på admin-ytan ligger den ovanpå de 3 i getCurrentUser (totalt 4 seriella auth-anrop innan sidans data ens börjar hämtas). Bidrar direkt till P99 549ms / P999 934ms.
- **Åtgärd:** Kör updateSession bara när det behövs: (a) hoppa över när ingen sb-*-cookie finns i request.cookies (då returnerar getUser ändå null), och (b) på tenant-host + icke-skyddad path. Behåll den för PROTECTED_PREFIXES + platform/superadmin/staff-hosts.
- **Risk:** medel

### `5-Kod/apps/web/lib/auth/session.ts:29-56`

**getCurrentUser gör TRE seriella rundturer: auth.getUser(), sedan select på users, sedan select på roles (roles är en pytteliten statisk uppslagstabell som läses om på varje request).**

- **Kostnad:** 3 seriella DB/Auth-anrop per admin-/personal-/platform-render (React cache() dedupar bara inom samma render, inte över requests). ~3 av de 3.7 subrequests/request på back-office-ytorna.
- **Åtgärd:** Slå ihop till EN query: .from('users').select('tenant_id, role_id, roles(level, name)') → 1 anrop i stället för 2. Cacha roles-tabellen i modulscope/unstable_cache (den ändras aldrig). Återanvänd användaren middleware redan hämtade i stället för en andra getUser().
- **Risk:** lag

### `5-Kod/apps/web/lib/tenant-data.ts:395 (currentTenant)`

**currentTenant() är INTE React-cache()-dedupad. Den anropas minst 4 gånger per storefront-startsida: app/(public)/layout.tsx:33 (generateMetadata), :60 (layout), app/(public)/page.tsx:23, components/storefront/sections.tsx:160 (LocationHours). Varje anrop går genom getTenantBySlug → egen unstable_cache-uppslagning.**

- **Kostnad:** 4× cache-uppslag (varje = en läsning mot OpenNext incremental cache = subrequest) för EXAKT samma bundle; vid cache-miss 4× fem DB-queries (tenants, tenant_settings, staff, locations, working_hours = 20 queries).
- **Åtgärd:** Wrappa currentTenant (och getTenantBySlug) i React `cache()` — samma mönster som getCurrentUser redan använder. En rad, ingen beteendeändring.
- **Risk:** lag

### `5-Kod/apps/web/app/(public)/layout.tsx:88-186`

**Storefront-layouten kör ~11 separata cachade laddare per sidladdning, och de i navLinks-arrayen (rad 152 loadUpcomingEvents, rad 178 loadTeamMembers) är `await` INNE i en array-literal → strikt seriella. loadUpcomingEvents + loadTeamMembers hämtar FULLA datamängder (alla kommande event + alla synliga medarbetare) bara för att avgöra om en meny-LÄNK ska visas — på varje sida i storefronten.**

- **Kostnad:** getTenantModuleStates + getWizardServices (3 queries internt: staff, staff_services, working_hours) + getWizardLocations + getBookingPrefs + resolveStaffNoun + getTenantCopy + resolvePrimaryCta + loadUpcomingEvents (2 queries) + loadTeamMembers = ~11 cache-uppslag / ~14 DB-queries vid miss, varav minst 2 seriella i navLinks.
- **Åtgärd:** Slå ihop till EN cachad 'storefront-chrome'-bundle per (tenant, slug) med ETT unstable_cache-lager; låt nav-länkarna gatas på billiga booleans (count/exists) i stället för fulla listor; Promise.all runt allt som blir kvar.
- **Risk:** medel

### `5-Kod/apps/web/lib/tenant-data.ts:333 + components/storefront/tenant-copy.ts:45 + components/storefront/wizard-services.ts:133`

**Samma tenant_settings-RAD läses av tre olika funktioner med tre olika cache-nycklar per request (getTenantBySlug select('*'), getTenantCopy, getBookingPrefs). Samma sak för verticals-raden: staff-noun.ts:39 och primary-cta.ts:31 läser samma rad var för sig. Och tenant_modules läses av tenant-modules.ts:80, load-kurser.ts:36 OCH igen via load-module-teasers.ts:19 i page.tsx.**

- **Kostnad:** 3 queries för en rad (tenant_settings), 2 för en rad (verticals), 3 för en rad (tenant_modules) — 8 anrop där 3 räcker. getTenantBySlug hämtar redan HELA settings-raden, så copy/booking-prefs finns redan i minnet.
- **Åtgärd:** Läs copy/booking-prefs ur den bundle getTenantBySlug redan returnerar (parseSettings har raden). Slå ihop staff-noun + primary-cta till en verticals-läsning. Skicka moduleStates som prop till loadLayoutModuleTeasers i stället för att hämta om.
- **Risk:** lag

### `5-Kod/apps/web/lib/admin/data.ts:343-361`

**listCustomers hämtar customers med embedded `bookings(start_ts, status)` — dvs HELA bokningshistoriken för varje kund — bara för att räkna antal besök och sista besök. Direkt efter hämtas HELA loyalty_ledger för tenanten (alla rader någonsin) och summeras i JS. Ingen paginering, ingen LIMIT.**

- **Kostnad:** Obegränsat växande svar: en salong med 2 000 kunder × 10 bokningar = 20 000 embeddade rader + hela ledgern, deserialiseras i isolatet (128 MB-taket) på varje laddning av /admin/kunder. Detta är den mest sannolika minnes-/tid-boven bakom exceededResources på admin-ytan.
- **Åtgärd:** Ersätt med en SQL-vy/RPC som returnerar en rad per kund (visits, last_visit, points-saldo aggregerat i Postgres) + paginering på listan.
- **Risk:** medel

### `5-Kod/apps/web/app/(public)/page.tsx:37-72`

**Startsidan gör en seriell vattenfalls-kedja: getTenantCopy (redan hämtad i layouten, rad 79 där) → loadTenantSkin → getServices → loadLayoutModuleTeasers (som i sin tur hämtar getTenantModuleStates igen, redan hämtad i layouten rad 88). Inga Promise.all.**

- **Kostnad:** 4 seriella laddningar ovanpå layoutens ~11, varav 2 är rena dubbletter av vad layouten redan hämtat i samma request.
- **Åtgärd:** Lyft copy + moduleStates till en request-scopad (React cache()) loader som både layout och page läser; Promise.all på det som är kvar (skin + services + teasers).
- **Risk:** lag

### `5-Kod/apps/web/app/(public)/layout.tsx:78,88,102,113,123,156`

**Den publika layouten (kör på VARJE storefront-sida) gör sex SEKVENTIELLA await-block efter currentTenant(): getTenantCopy → getTenantModuleStates → Promise.all([getWizardServices, getWizardLocations, getBookingPrefs]) → resolveStaffNoun → resolvePrimaryCta → loadUpcomingEvents. Bokningswizardens tjänster/platser/prefs och kommande kurser laddas även på /kontakt, /blogg, /varukorg.**

- **Kostnad:** ≥6 seriella rundor innan chrome kan renderas, ovanpå page.tsx som därefter kör currentTenant + getTenantCopy + getServices + loadLayoutModuleTeasers (som i sin tur gör getTenantModuleStates + loadShopData + loadBloggData). Detta är den troliga källan till P99 549 ms / P999 934 ms — vattenfall, inte CPU.
- **Åtgärd:** Slå ihop de oberoende anropen till EN Promise.all (copy, moduleStates, staffNoun, primaryCta beror inte på varandra). Ladda wizard-data + upcomingEvents bara när bokningsdrawern faktiskt kan öppnas (lazy via route-handler / on-demand i klienten) i stället för på varje sidladdning.
- **Risk:** medel

### `5-Kod/apps/web/components/storefront/layouts/load-module-teasers.ts:23-33`

**loadShopData och loadBloggData hämtar hela listorna (shop: `.limit(PRODUCT_LIMIT)` + en extra variant-query; blogg: `.limit(config.postsPerPage)` med body-kolumnen inkluderad) — och sedan tar koden `.slice(0, 3)`.**

- **Kostnad:** 2–3 DB-queries + hela produkt-/inläggs-payloaden (inkl. blog_posts.body, load-blogg.ts:57) dras in på hemsidan för att visa 3 teasers.
- **Åtgärd:** Egna teaser-loaders med `.limit(3)` och smal select (blogg utan `body`, shop utan varianter). Behåll cache-taggen `tenant:<slug>`.
- **Risk:** lag

### `5-Kod/apps/web/lib/tenant-data.ts:326-336,369-372`

**getTenantBySlug gör `select('*')` på både `tenants` och `tenant_settings`; getServices gör `select('*')` på `services`. Dessutom två extra queries inuti samma loader (loadStaffTeam, loadLocation) — fyra seriella DB-rundor bakom en enda currentTenant().**

- **Kostnad:** 4 seriella queries + hela rader (tenant_settings innehåller hela branding/copy-JSON:en). Cachat 300 s via unstable_cache, men varje cache-miss = 4 rundor i serie innan något kan renderas.
- **Åtgärd:** Kör loadStaffTeam och loadLocation i Promise.all (de är oberoende). Byt `select('*')` mot explicita kolumn-listor.
- **Risk:** lag

### `5-Kod/apps/web/components/portal/PortalShell.tsx:68,87,121,158`

**Admin-layoutens skal gör fyra DB-round-trips i SERIE (await efter await), inte parallellt: currentTenant()/getTenantById (68-71) → getAdminModuleStates (87) → verticals-läsning med egen createClient (121-127) → listLocations (158). Ingen Promise.all, trots att modules/verticals/locations bara beror på tenant-id:t.**

- **Kostnad:** 3 seriella DB-anrop som kunde vara 1 parallell omgång, i skalet, på VARJE admin-request. Ovanpå getCurrentUser (lib/auth/session.ts:29-56) som redan är 3 seriella round-trips (auth.getUser → users → roles). => ~6 seriella RTT innan sidans egen data ens börjar hämtas.
- **Åtgärd:** Hämta tenant först, kör sedan Promise.all([getAdminModuleStates, verticals, listLocations]). Slå ihop roles-läsningen i getCurrentUser till en join på users (users.select('tenant_id, roles(level,name)')) — sparar en RTT på varje request i hela appen.
- **Risk:** lag

### `5-Kod/apps/web/lib/admin/tenant.ts:43-75`

**getAdminTenant/loadAdminTenantById är INTE React-cache()-wrappad (till skillnad från getCurrentUser). PortalShell har redan läst tenant + verticals i layouten; varje sida läser dem EN GÅNG TILL i samma render. Samma sak för locations (PortalShell:158 vs app/(admin)/admin/bokningar/page.tsx:67) och för moduler (PortalShell:87 vs app/(admin)/admin/page.tsx:46).**

- **Kostnad:** Dubbla läsningar per admin-request: tenants x2, locations x2, verticals x2, tenant_modules x2 (på översikten). ~4 helt onödiga DB-anrop per sidladdning.
- **Åtgärd:** Wrappa loadAdminTenantById, getAdminModuleStates och listLocations i React `cache()` — samma mönster som getCurrentUser redan använder. Nollrisk, dedupar direkt inom en render.
- **Risk:** lag

### `5-Kod/apps/web/lib/admin/stats.ts:429-446`

**getStats hämtar ALLA bokningar 13+ månader tillbaka (med embeddade services/staff-joins) OCH hela customers-tabellen utan gräns, in i isolatet, och aggregerar i JS (aggregateStats).**

- **Kostnad:** Obegränsat radantal → obegränsat minne i ett 128 MB-isolat. Detta är precis den profil som ger 'exceededResources' utan hög CPU. En kund med 20k bokningar + 5k kunder drar tiotals MB JSON per request. /admin/statistik är force-dynamic → ingen cache, varje reload gör om det.
- **Åtgärd:** Gör aggregeringen i SQL (Postgres RPC / vy med date_trunc + sum), returnera aggregat i stället för rader. Minst: `select id` bort från customers → count, och begränsa bokningsfönstret.
- **Risk:** medel

### `5-Kod/apps/web/app/(admin)/layout.tsx:7 + alla 23 admin-page.tsx`

**`export const dynamic = 'force-dynamic'` står på layouten OCH på var enda sida (blogg:10, bokningar:31, kunder:13, tjanster:8, ... 23 st). Ingen enda admin-sida använder Suspense eller streaming — grep på 'Suspense' i app/(admin)/** ger noll träffar. Hela sidan blockeras tills den långsammaste läsningen är klar.**

- **Kostnad:** Layouten är redan force-dynamic, så raden på varje sida är redundant. Effekten: TTFB = summan av auth-kedjan (3 RTT) + skalets kedja (3 RTT) + sidans data. Uppmätt P99 549 ms / P999 934 ms är konsistent med en seriell kedja, inte med CPU.
- **Åtgärd:** Streama skalet: rendera PortalShell/Topnav direkt och lägg sidans datatunga del i <Suspense> med loading.tsx-skelettet som fallback (de finns redan: bokningar/loading.tsx, statistik/loading.tsx m.fl. — de används bara vid navigering, inte vid render).
- **Risk:** medel

### `5-Kod/apps/web/components/realtime/RealtimeBookings.tsx:46`

**Vid varje skrivning mot bookings eller time_off i tenanten kör varje öppen admin-flik router.refresh() → en full force-dynamic server-render av hela sidan, inklusive hela auth- och skal-vattenfallet ovan.**

- **Kostnad:** Arbetsförstärkning: N öppna flikar (receptionens iPad + ägarens dator + personalens telefoner) x hela render-kedjan per bokning. På en salong med 3 flikar öppna = 3 fulla renders per bokning, var och en ~6 seriella DB-RTT + sidans Promise.all. Detta är en trolig källa till minnestoppar/exceededResources i vardagens burst.
- **Åtgärd:** Debouncen (500 ms) finns men refreshar hela trädet. Begränsa filtret till den plats/dag som visas, och överväg att bara refresha när fliken är synlig (document.visibilityState === 'visible').
- **Risk:** lag

### `app/(public)/layout.tsx:78-188`

**Storefront-layouten gör 7 SEKVENTIELLA await-punkter efter att tenanten är hämtad — getTenantCopy (78), getTenantModuleStates (88), Promise.all med 3 st (102), resolveStaffNoun (113), resolvePrimaryCta (123), loadUpcomingEvents (156), loadTeamMembers (184). Alla sju är oberoende givet `tenant`, men körs som ett vattenfall.**

- **Kostnad:** 7 serieställda I/O-hopp på VARJE storefront-sidvisning (/, /om, /kontakt, /shop, /blogg …). Varje anrop är unstable_cache-inpackat, vilket på Workers är en cache-API/KV-läsning — cachen tar bort DB-anropet, inte round-trippen. 7 serie-hopp i stället för 1 parallellt förklarar svansen (P99 549 ms / P999 934 ms) bättre än CPU gör.
- **Åtgärd:** Slå ihop de sju till EN Promise.all direkt efter `currentTenant()`. Rent mekaniskt — inga anrop beror på varandras svar, bara på `tenant.id`/`tenant.slug`/`tenant.vertical_id`.
- **Risk:** lag

### `app/(public)/layout.tsx:156,184`

**loadUpcomingEvents() och loadTeamMembers() anropas inne i navLinks-arrayens spread — enbart för att avgöra OM en menylänk ska finnas. Två extra datalager-läsningar per sidvisning, på varenda storefront-sida, för två booleans.**

- **Kostnad:** 2 av de 7 serie-hoppen ovan; de sitter dessutom mitt i en array-literal där de garanterat inte kan parallelliseras med varandra. Kostar två cache/DB-round-trips per request för 2 bitar information.
- **Åtgärd:** Lyft presence-flaggorna (has_events, has_team) in i den redan cachade tenant-bundlen eller i getTenantModuleStates — en cachad rad i stället för två separata listladdningar. Menyn behöver antalet > 0, inte raderna.
- **Risk:** lag

### `apps/web/app/(public)/page.tsx:47-52 → lib/storefront/skin/load-skin.ts:36-73`

**För theme='salvia' körs loadTenantSkin på VARJE storefront-request: 1 query mot templates, sedan 3 parallella queries (template_slots, content_slots, media_assets). Prod har 0 content_slots (kommentaren i page.tsx:32 säger det själv) → resultatet kastas alltid (hasTenantContent=false).**

- **Kostnad:** 1 DB-anrop (om templates saknar salvia-raden) upp till 4 DB-anrop per salvia-sidvisning, alltid utan effekt
- **Åtgärd:** Gate på en billig check (t.ex. inget anrop alls tills content_slots faktiskt används), eller ta bort salvia-grenen
- **Risk:** medel


## BYTES TILL KLIENTEN

### `5-Kod/apps/web/components/platform/CreateTenantForm.tsx:1,19`

**Filen är 'use client' (rad 1) och importerar `FLORIST_THEMES` från layouts/florist/registry (rad 19) för att rita preview-kort. Via registry → *.theme.ts → chrome/pages/modules/cart/checkout hamnar hela florist-storefrontens implementation i super-adminens KLIENT-bundle.**

- **Kostnad:** ~363 kB komponentkälla (varav presentkort-views.tsx 28 kB, calytrix.checkout.tsx 16 kB, ateljevinter.forms.tsx 13 kB — alla 'use client') dras potentiellt in i en admin-sidas JS för att visa färgswatchar. Samma väg gäller lib/platform/theme-palettes.ts och theme-capabilities.ts som importerar registryn och konsumeras av flera admin-ytor.
- **Åtgärd:** Importera från *.meta.ts-registryt (fyndet ovan). Swatcharna behöver bara key/name/desc/palette — noll React.
- **Risk:** lag

### `5-Kod/apps/web/app/layout.tsx:37-39`

**Rot-layouten importerar florist/ekonomi/salong-registryn statiskt. Det drar inte bara in mall-JS — det drar in mallarnas .module.css i ROT-layoutens CSS-bundle, som varje admin-sida (och /login, och storefronten) laddar.**

- **Kostnad:** Mätt ur .next/app-build-manifest.json: /layout har 502 kB CSS i 13 filer. Innehållet är bevisligen storefront-teman: 33a7490 = kassa_*, 69e6fdea = solsalt_*, 584a2ae = onyx_*, e4af8a6 = galleri-section_*, 225cabb = kurser_*. Egna admin-CSS:en (portal-global+globals+tokens) är bara ~114 kB av källan. => ~340-380 kB CSS som adminen aldrig använder, på varje admin-sida. Plus 542 kB JS i samma rot-layout.
- **Åtgärd:** Flytta tema-registryn ur rot-layouten. Låt bara storefront-segmentets layout importera dem (eller lazy/dynamic per tema). Rot-layouten ska inte känna till en enda mall.
- **Risk:** medel

### `5-Kod/apps/web/app/(admin)/layout.tsx:5,40`

**RealtimeBookings ('use client', components/realtime/RealtimeBookings.tsx:1) renderas i admin-layouten och drar in hela @supabase/supabase-js (GoTrue + Realtime/phoenix-socket) i admin-layoutens klient-bundle. Komponenten renderar `return null` — den är osynlig.**

- **Kostnad:** Admin-layoutens EGNA chunkar (utöver rot-layouten): 270 kB JS. Av dem är chunk 4848 (160 kB) + 75504863 (58 kB) = 218 kB supabase-klient (verifierat: 'GoTrueClient'/'realtime' i chunkinnehållet). Betalas på VARJE admin-sida, även /admin/tjanster som inte har någon realtidsdata.
- **Åtgärd:** next/dynamic({ ssr:false }) på RealtimeBookings, och montera den bara i de rutter som faktiskt visar bokningar (kalender/översikt/scheman) i stället för i layouten.
- **Risk:** lag

### `5-Kod/apps/web/components/admin/*.tsx`

**38 av 40 filer i components/admin/ är 'use client' — bara AdminSkeleton och OpenSiteLink är server. Adminen är i praktiken en klient-app renderad genom RSC. CalendarBoard.tsx = 1356 rader / 52.7 kB källa, StaffRoster 1217 rader / 44 kB, SlotManager 933 rader / 31 kB, ShopAdmin 39 kB.**

- **Kostnad:** Uppmätt egen (icke-delad) klient-JS per rutt: /admin/bokningar 90 kB JS + 48 kB CSS (CalendarBoard + 4 drawers + calendar.module.css 38 kB), /admin/scheman 73 kB + 24 kB, /admin/sida/redigera 347 kB (SidaStudio), /admin/installningar/konto 277 kB. Ovanpå rot-layoutens 542 kB JS + 502 kB CSS och admin-layoutens 270 kB.
- **Åtgärd:** CalendarBoard laddar BookingDrawer/NewBookingDrawer/BlockDrawer/CancelledLog/CalendarHelp statiskt (rad 9-26) trots att de bara visas när man öppnar dem — gör dem next/dynamic. Samma för SlotManager/ShopAdmin-modaler. Enkel vinst: ~40-50 kB bort från kalenderns initialladdning.
- **Risk:** lag

### `5-Kod/apps/web/app/layout.tsx:38-40`

**Rot-layouten importerar florist/ekonomi/salong-registryn; alla 13 tema-CSS-moduler dras in i rot-layoutens CSS-entry → VARJE sida länkar 13 stylesheets.**

- **Kostnad:** Mätt i .next/app-build-manifest.json: /layout = 13 CSS-filer, 502 kB okomprimerat (kurser 60, galleri 62, kassa 66, solsalt 66, onyx 54, snitt 21, portal 36 …). Bevisat i byggd HTML: .next/server/app/_not-found.html innehåller 13 <link rel="stylesheet"> — även 404-sidan drar hela tema-CSS:en.
- **Åtgärd:** Ta bort FLORIST/EKONOMI/SALONG_THEME_CSS-importerna ur rot-layouten. Flytta tema-CSS till storefront-segmentets layout (app/(public)/layout.tsx eller [slug]) och gör mall-valet dynamiskt (next/dynamic per tema-nyckel) så bara den valda mallens CSS länkas.
- **Risk:** medel

### `5-Kod/apps/web/app/layout.tsx:38-40 → .next/static/chunks/1987-a811487f6a1d48a9.js`

**Samma registry-import gör att alla 13 tema-layouter (som är 'use client') hamnar i rot-layoutens KLIENT-bundle. /login och /admin laddar ner mall-JS de aldrig renderar.**

- **Kostnad:** chunk 1987 = 56 kB (innehåller onyx_/snitt_/solsalt_-klassnamn, 116-146 träffar per tema) + chunk 64 = 79 kB, båda i /layout-manifestet. Rot-layoutens JS totalt 542 kB okomprimerat.
- **Åtgärd:** Byt registryns statiska import mot en lazy map (next/dynamic / lazy import per tema-slug). Då försvinner både klient-chunken och CSS:en från rot-entryn.
- **Risk:** medel

### `5-Kod/packages/ui/tokens.css:23`

**@import url('https://fonts.googleapis.com/css2?family=Playfair+Display…Inter…Cormorant…Bebas…Jost…Archivo…DM+Serif') mitt i tokens.css, som rot-layouten importerar. CSS-@import = render-blockerande, upptäcks först EFTER att stylesheeten laddats (extra RTT till tredjepart), och det finns 0 preconnect/dns-prefetch i hela app/ (grep: 0 träffar; byggd HTML: 0 preconnect).**

- **Kostnad:** 7 familjer, dubbelladdade — Playfair, Inter, Cormorant Garamond, Jost, Archivo, DM Serif Display self-hostas REDAN av next/font i app/layout.tsx. Rader ur Google-CSS:en ligger dessutom i den 36 kB stora 6ab7f45e…css som varje sida länkar.
- **Åtgärd:** Radera @import-raden. Familjerna finns redan som next/font-varsen; peka --font-*-varsen på dem. Om något tema faktiskt behöver Bebas Neue → lägg till den i next/font-listan istället.
- **Risk:** lag

### `5-Kod/apps/web/app/layout.tsx:2-35`

**33 next/font/google-familjer deklareras i ROT-layouten. Alla @font-face-regler (för alla 33) emitteras i en CSS-fil som länkas på varje sida — inklusive /login, /admin, /api-felsidor.**

- **Kostnad:** .next/static/media = 130 woff2-filer / 2,74 MB. @font-face-blocket ligger i static/css/80b58b7982be5314.css = 62 kB, i /layout-manifestet. (Själva woff2:orna hämtas lazy per använt tecken, men 62 kB @font-face-CSS + parse betalas alltid.)
- **Åtgärd:** Behåll bara Corevo-familjen (Playfair + Inter, ev. Source Sans) i rot-layouten. Flytta tema-specifika familjer till respektive tema-modul/segment-layout så de bara deklareras när temat renderas.
- **Risk:** medel

### `5-Kod/apps/web/components/storefront/bransch-copy.ts:37-38 (+ alla *.theme.ts, 23 Unsplash-URL:er)`

**next/image används INTE någonstans (0 importer av 'next/image' i app/ + components/). 63 råa <img> pekar rakt på images.unsplash.com med fast bredd (u(id, w=1600), enskilda w=1920/1200). Ingen srcset, inga sizes (grep 'srcSet|sizes=' i components/storefront: 0 träffar).**

- **Kostnad:** Varje storefront-besökare på mobil laddar 1600–1920 px breda hero-/galleri-JPEG:ar (q=80) — typiskt 200–400 kB per bild, flera per sida. Bara 7 av 28 storefront-<img> har loading=lazy → resten hämtas eagerly.
- **Åtgärd:** Utan att röra remote-image-configen: bygg en liten hjälpare som genererar srcSet från Unsplash-URL:en (samma ?w=-param i 480/800/1200/1600) + sizes, sätt loading="lazy" + decoding="async" på allt utom hero, och width/height för att döda CLS.
- **Risk:** lag

### `5-Kod/apps/web/app/(admin)/layout.tsx:5,42 (samma i app/(personal)/layout.tsx:4,27 och app/(platform)/layout.tsx:3,17)`

**RealtimeBookings (client) importerar @supabase/supabase-js i layouten → hela supabase-klienten inkl. realtime-transporten hamnar i klient-bundlen för ALLA admin-/personal-/plattform-sidor.**

- **Kostnad:** static/chunks/4848-*.js = 159 kB + 75504863-*.js = 57 kB → 216 kB okomprimerat extra JS på varje frisör-inloggad sida. (Manifestet visar exakt 5 rutter som drar dem: (admin)/layout, (personal)/layout, (platform)/layout, valkommen, installningar/konto.)
- **Åtgärd:** Ladda RealtimeBookings via next/dynamic({ ssr:false }) — eller ännu hellre bara på de sidor som faktiskt visar bokningar (kalender/dashboard) istället för i layouten.
- **Risk:** lag

### `5-Kod/apps/web/app/(platform)/salonger/[id]/page.tsx (och /salonger/ny, /branscher/[key], /admin/sida/redigera)`

**Tyngsta admin-rutterna. Kundkortet drar 31 chunk-/CSS-filer.**

- **Kostnad:** Ur app-build-manifest: /salonger/[id] = 1573 kB, /salonger/ny = 1552 kB, /branscher/[key] = 1298 kB, /admin/sida/redigera = 1262 kB okomprimerat (JS+CSS). Ca 1,04 MB av det är rot-layoutens delade last (502 kB CSS + 542 kB JS) — dvs största delen försvinner om fynd 1, 2 och 6 fixas.
- **Åtgärd:** Fixa rot-layouten först (fynd 1+2+6) och mät om; det som återstår per rutt är den faktiska sidkoden.
- **Risk:** lag

### `5-Kod/apps/web/app/layout.tsx:36-38`

**Samma rot: eftersom mall-komponenterna ligger i layoutens graf, blir deras CSS-moduler LAYOUT-CSS. Next länkar då hela mall-svitens stilar på varje sida i appen.**

- **Kostnad:** /layout drar 13 stylesheets = 502 kB CSS (mätt ur .next/app-build-manifest.json + filstorlekar): 33a749=66 kB (kassa/checkout), 69e6fd=66 kB (solsalt), 584a2a=54 kB (onyx), 80b58b=61 kB, e4af8a=62 kB … Alla länkas på /login och varje /admin-sida.
- **Åtgärd:** Samma fix som ovan (palett-modul utan komponenter). Verifiera efteråt att /layout bara har tokens+globals+booking/portal-CSS.
- **Risk:** lag

### `5-Kod/packages/ui/tokens.css:23`

**tokens.css (importerad i rot-layouten, layout.tsx:39) inleds med @import url('https://fonts.googleapis.com/css2?...') för Playfair Display, Inter, Cormorant Garamond, Bebas Neue, Jost, Archivo, DM Serif — familjer som ALLA (utom Bebas) redan self-hostas av next/font i samma fil (layout.tsx:50-115). Ett @import i ett <link>-stylesheet är en render-blockerande extra rundtur till en tredjepartsdomän.**

- **Kostnad:** 1 extra render-blockerande cross-origin request + ~35 kB CSS-fil (6ab7f45e) på varje sidladdning; dubbla font-källor för 6 familjer ovanpå 130 lokala woff2-filer / 2,7 MB i .next/static/media.
- **Åtgärd:** Ta bort @import-raden; ladda Bebas Neue via next/font som de andra 33 familjerna. Behåll CSP-raden.
- **Risk:** lag

### `5-Kod/apps/web/app/layout.tsx:9-34`

**33 next/font/google-familjer instansieras i rot-layouten och alla 33 CSS-variabler sätts på <html> (layout.tsx className). Bygg-tidsgenererad @font-face-CSS för samtliga hamnar i rot-CSS:en oavsett vilken sida som renderas; preload:false stoppar bara <link rel=preload>, inte CSS-vikten.**

- **Kostnad:** 130 fontfiler / 2,7 MB i .next/static/media; alla familjers font-face-regler i rot-CSS på varje sida.
- **Åtgärd:** Flytta mall-specifika familjer (florist/ekonomi/salong-sviterna) till storefront-layouten ((public)/layout.tsx + salong-preview) i stället för rot-layouten. Back-office behöver Playfair/Inter/Source Sans.
- **Risk:** medel

### `app/layout.tsx:37-39`

**Samma import, andra axeln: eftersom tema-komponenterna ligger i rot-layoutens modulgraf hissar Next in deras *.module.css i rot-layoutens CSS-payload — som per definition gäller ALLA rutter. En inloggningssida levererar florist-storefrontens designsystem.**

- **Kostnad:** Mätt live mot https://superbooking.corevo.se/login: 11 stylesheets, 512 937 bytes okomprimerad CSS, mot 29 kB HTML. Identifierade bundles: calytrix.module.css (67.9 kB), solsalt (67.8 kB), onyx (55.8 kB), storefront.module.css (64.9 kB + 35.9 kB), booking-global (65.3 kB) m.fl. Uppskattningsvis ~450 av 513 kB är storefront-/tema-/boknings-CSS som en /login aldrig använder. (Typsnitten är däremot OSKYLDIGA: 0 font-preloads och ~1 @font-face totalt — preload:false fungerar. Rör dem inte.)
- **Åtgärd:** Faller ut automatiskt av fix 1: när tema-komponenterna inte längre är nåbara från roten följer deras .module.css med ner till (public)-grenen där de hör hemma.
- **Risk:** lag

### `app/layout.tsx:42-43`

**booking-global.css och portal-global.css importeras i ROT-layouten. Back-office-CSS skickas därmed till varje publik storefront, och bokningsflödets CSS till varje admin-sida. Ingen av dem används av mer än en gren.**

- **Kostnad:** portal-global.css = 54.8 kB, booking-global.css = 46.5 kB råa (101 kB tillsammans). Ingår i de 513 kB som /login mäter ovan; portal-global åker dessutom med på varje kund-storefront.
- **Åtgärd:** Flytta portal-global.css till (admin)/(personal)/(platform)-layouterna (alla tre kör PortalShell) och booking-global.css till boka/layout.tsx + (public)/layout.tsx. Roten behåller tokens.css + globals.css.
- **Risk:** lag

### `app/layout.tsx:233-237`

**De tre <style>-blocken (FLORIST/EKONOMI/SALONG_THEME_CSS) hamnar i <head> på VARJE rutt — inklusive /admin, /login och personal-portalen, som aldrig sätter data-theme och därför aldrig matchar ett enda block.**

- **Kostnad:** Redan uppmätt: 7.3 kB inline på /login. Poängen som saknades: av 13 palett-block används HÖGST ETT ens på en riktig storefront — de övriga 12 är döda selektorer i varje HTML-svar plattformen skickar.
- **Åtgärd:** Flytta de tre <style>-blocken ner till de rötter som faktiskt sätter data-theme ((public), boka, konto, studions preview), och emittera bara blocket för `settings.theme` — de har redan tenanten i handen. Roten emitterar noll.
- **Risk:** lag


## DÖD KOD

### `5-Kod/apps/web/components/storefront/skin/SkinRenderer.tsx:27`

**SkinRenderer refereras bara av sin egen test (SkinRenderer.test.tsx) — kommentaren i app/(public)/page.tsx:32 säger själv att den är PARKERAD och aldrig renderat en tenant. Samtidigt kör page.tsx:49-61 fortfarande loadTenantSkin + applySkinOverlay + SALVIA_REGION_MANIFEST för varje salvia-tenant.**

- **Kostnad:** lib/storefront/skin/ = 58 182 bytes i grafen; salvia-grenen kostar 1 extra DB-runda per request på ett datalager där prod enligt kommentaren har 0 content_slots.
- **Åtgärd:** Ta bort SkinRenderer.tsx + dess test. Gata salvia-skin-anropet bakom en flagga (eller ta bort det tills marriage-slicen landar) så det inte kostar en DB-runda per salvia-request.
- **Risk:** lag

### `5-Kod/apps/web/package.json:26`

**html-react-parser (^6.1.3) står som prod-beroende men importeras inte en enda gång i app/, lib/ eller components/ (grep: 0 träffar).**

- **Kostnad:** 0 B i bundlen (tree-shakas bort) — men den installeras och skapar falskt intryck av att HTML parsas i runtime. Ren städning.
- **Åtgärd:** pnpm remove html-react-parser i apps/web.
- **Risk:** lag

### `apps/web/components/storefront/skin/SkinRenderer.tsx:1 (2.9 kB) + lib/storefront/skin/* (92 kB)`

**Skin-renderaren är PARKAD — enda träffen på 'SkinRenderer' utanför filen själv är en KOMMENTAR i app/(public)/page.tsx:32. Ingen importerar komponenten. Datalagret runt den (load-skin/overlay/resolve/salvia-manifest) lever bara för salvia-temat.**

- **Kostnad:** SkinRenderer 2.9 kB helt oimporterad; skin-mappen 92 kB varav bara load-skin/overlay/salvia-manifest används (av ett tema)
- **Åtgärd:** Radera SkinRenderer.tsx + testen; behåll datalagret enligt beslut
- **Risk:** lag

### `apps/web/components/admin/BrandingForm.tsx (18 kB), StorefrontMediaForm.tsx (17.5 kB), StorefrontCopyForm.tsx (3.5 kB), OpenSiteLink.tsx (0.8 kB)`

**Rester efter rivna admin-/sajtbyggar-ytor. grep över hela app/lib/components ger NOLL importörer (enda 'BrandingForm'-träffarna gäller PlatformBrandingForm, en annan komponent). Varumärke-sidan är numera en redirect (app/(admin)/admin/varumarke/page.tsx:8).**

- **Kostnad:** ~40 kB källa, 4 filer, 0 importörer
- **Åtgärd:** Radera de fyra filerna
- **Risk:** lag

### `apps/web/components/storefront/ShopCta.tsx (2.6 kB), components/storefront/shop/CartButton.tsx (1.0 kB)`

**Dubblett-implementationer som ersatts: AddToCart.tsx:3 säger 'Ersätter den parkerade ShopCta', och app/(public)/layout.tsx:236 säger 'CartButton-bollen är borttagen här — korgen bor i naven'. Ingen fil importerar någon av dem.**

- **Kostnad:** 3.6 kB, 0 importörer, två parallella köp-UI-spår
- **Åtgärd:** Radera ShopCta.tsx och shop/CartButton.tsx
- **Risk:** lag

### `apps/web/lib/auth/mfa.ts (1.5 kB), lib/custom-domain.ts (2.2 kB), lib/supabase/middleware.ts (1.7 kB), components/personal/DeleteRowButton.tsx (1.3 kB), components/brand/ServiceList.tsx (1.4 kB)`

**Oanvända lib-/komponentfiler: ingen import någonstans i app/lib/components. DeleteRowButton är dessutom duplicerad av den co-locatade DeleteAbsenceButton.tsx ('Mirrors the shared DeleteRowButton'), och domän-logiken lever i lib/cloudflare/custom-hostnames.ts + lib/platform/actions/domains.ts.**

- **Kostnad:** ~8 kB, 5 filer, 0 importörer
- **Åtgärd:** Radera; om mfa.ts är planerad framtid, flytta till en gren/mapp utanför modulgrafen
- **Risk:** lag
