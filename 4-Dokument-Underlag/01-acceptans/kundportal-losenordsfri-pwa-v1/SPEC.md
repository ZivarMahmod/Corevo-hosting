# SPEC.md — Skärm- och komponentindex (del 1 av 3)

**Produkt:** Kundportal, lösenordsfri PWA v1 (Corevo)
**Status:** BINDANDE. Spårar kraven i briefen `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md` (överordnad lag — vid konflikt vinner briefen, README §Överordnad lag).
**Omfattning del 1:** kanonordning och scope, produktprinciper, full IA/routetabell med route-för-route-kontrakt, navigation och breakpoints, fixturekontrakt (FreshCut, Nordverk), första besöket/bootstrap och no-JS, samt status- och actionmatrisen för startsida/historik/detalj.
**Del 2 och 3** täcker: komponentindexet skärm-för-skärm mot prototypfilerna, tillståndsgalleriets fullständiga state-register (brief §18), PWA-/offline-/installationsspårningen samt spårningstabellen krav-ID → prototyp/state → kontrollmetod som matar `ACCEPTANCE-MATRIX.md`.

---

## 1. Kanonordning och scope

### 1.1 Kanonordning (bindande läsordning vid konflikt)

1. **Briefen** `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md` — överordnad lag; där briefen låser en exakt sträng eller ett flöde gäller briefen.
2. **TOKENS.md** — tokenlagen; vinner över COMPONENTS.md vid värdekonflikt.
3. **COMPONENTS.md** — komponentkontrakten.
4. **COPY.md** — varje sträng är exakt; synonymer = FAIL.
5. **SPEC.md** (denna fil) — index och spårning; inför aldrig egna krav som strider mot 1–4.
6. Prototyperna (`Kundportal Passwordless Mobil.dc.html`, `Kundportal Passwordless Desktop.dc.html`, `Kundportal Passwordless States.dc.html`) — bevisytor, inte kanon för värden.
7. `FEATURE-MATRIX.md` och `ACCEPTANCE-MATRIX.md` — mekanisk avprickning (brief §29).

Inga andra filer är kanon. OLD-mappar och utkast utanför paketet ignoreras (README).

### 1.2 Scope NU (aktivt i v1, brief §3.1)

Säker öppning från bekräftelse-SMS/-mejl; företagsspecifik kundöversikt; kommande bokningar; historik (tidigare/avbokade/övriga); bokningsdetalj; avbokning med regelkontroll och dialog; kalenderexport (`.ics`); boka igen via tenantens publika `/boka`; visa/redigera namn; serverstyrd primär verifierad kontakt (`sms`|`email`); säkert kontaktbyte med dubbel PIN; enhetssessioner och utloggning; PIN-fria bokningsenheter med återkallelse; återhämtning vid utgången/förbrukad/felaktig länk; installerbar PWA (Android + iOS separat); hjälp; integritet; fel-/tom-/laddlägen; responsiv mobil/tablet/desktop; e-postfallback när SMS-gatewayen är otillgänglig.

### 1.3 Scope DOLT (förberett men helt inaktivt i v1, brief §3.2)

Globalt Corevo-kundkonto; `Mina företag`-hub; lösenord och social inloggning; pushnotiser; erbjudanden/marknadsföring; klippkort/poäng/lojalitet/rekommendationer; webshop i portalen; favoriter/favoritpersonal; ombokning inne i portalen; väntelista; kvitto/betalningshistorik; native-app.

**Inaktivt betyder:** ingen synlig knapp, ingen tom meny, ingen `kommer snart`-ruta, ingen halvaktiv route (brief §3.2; CP-NEG-07). Förbjuden copy är bindande via negativlistan CP-NEG-01–12. Befintlig kod bevaras och avgränsas — den raderas inte, men den syns aldrig i lanseringsytan (`LEGACY/BEVARAD` i `FEATURE-MATRIX.md`).

---

## 2. Produktprincip (brief §2 — får inte ändras)

1. **Bokningen sker på tenantens publika webbplats** (normalt dess `/boka`-flöde) — aldrig i portalhosten. Portalen bokar ALDRIG själv; `BookAgainButton` är alltid en utlänk till tenantens `publicRebookUrl` (COMPONENTS §13).
2. **PIN före bokning:** den valda kontaktkanalen verifieras med sexsiffrig engångskod (`PinVerificationForm`, steg 4 av 5, på tenanthosten) innan bokningen skapas på en ny/obetrodd enhet. SMS är normalläge; e-post är uttryckligt fallback när SMS-health säger att SMS inte kan användas. Fel eller utgången PIN skapar aldrig en bokning.
3. **Steg 5 ligger på tenanthosten:** bekräftelsesidan (`BookingStepFive`) renderas i tenantens bokningsflödesram — ingen portal-shell, ingen portal-nav. Persistens ("Bokningen är klar", CP-S5-01) och leverans (CP-S5-07–15) är två separata sanningar; felspåret "Bokningen kunde inte slutföras" (CP-S5-16–18) har egen layout.
4. **Meddelandelänken är dörren till portalen:** bekräftelse-SMS:et/-mejlet innehåller den personliga engångslänken `https://mina.corevo.se/oppna/[tenantSlug]#<token>` (brief §8.1). Första giltiga öppningen byter hemligheten mot en hostlåst enhetssession och tar bort token ur URL:en; därefter är adressen alltid tokenfri (`/mina` eller `/mina/bokningar/[id]`). Steg 5 länkar aldrig direkt in i portalen med sessionskrav — hänvisningen är CP-S5-03 ("Öppna länken i meddelandet…").
5. **Ingen login existerar:** ingen `Logga in`-knapp, ingen registrering, inget lösenord, ingen social inloggning (CP-NEG-01). Enda vägen in utan giltig session är `/aterhamta/[tenantSlug]` → `/verifiera/[tenantSlug]`. Utgången session leder ALLTID dit, aldrig till en login-vy (COMPONENTS §0.1).
6. **En session = exakt en tenant:** portalen är företagsspecifik i v1; ingen tenantväxlare, ingen företagslista (CP-NEG-02). Corevo äger säkerhetsramen (topbar), tenanten äger identiteten inne i innehållet (`TenantIdentityCard`).
7. **Generisk plattform:** orden är `företag`, `plats`, `tjänst`, `personal`, `bokning`. FreshCut är exempeldata — strukturen får inte kodas som frisörspecialfall (brief §2.11; fixturen Nordverk bevisar detta, §6 nedan).

---

## 3. IA — full routetabell

Hosten `mina.corevo.se` = portalhosten. Tenanthosten (t.ex. `freshcut.se`) bär bokningsflödets steg 1–5 och är utanför routetabellen (steg 4/5 spåras ändå i §4.12 eftersom komponenterna ingår i paketet).

| # | Route | Host | Session | Shell-variant | h1 (COPY-ID) |
|---|---|---|---|---|---|
| 1 | `/oppna/[tenantSlug]#<token>` | portal | ingen före utbyte | recovery (ingen nav) | Öppnar din bokning (CP-BOOT-01) |
| 2 | `/aterhamta/[tenantSlug]` | portal | ingen; rate-limitad | recovery | Kom åt dina bokningar (CP-REC-01) |
| 3 | `/verifiera/[tenantSlug]` | portal | challenge-cookie, ingen portaldata | recovery | Ange koden (CP-VER-01) |
| 4 | `/hjalp` | portal | ingen | recovery (publik, utan persondata) | Hjälp (CP-HELP-01) |
| 5 | `/mina` | portal | giltig portalsession | standard | [Företag] (CP-TID-01) |
| 6 | `/mina/historik` | portal | giltig portalsession | standard | Historik (CP-HIST-01) |
| 7 | `/mina/bokningar/[id]` | portal | giltig portalsession + ägarskap | standard (detaljläge i topbar) | [veckodag] [datum] · [tid] (CP-DET-03) |
| 8 | `/mina/profil` | portal | giltig portalsession | standard | Profil (CP-PROF-01) |
| 9 | `/mina/sakerhet` | portal | giltig portalsession | standard | Säkerhet och enheter (CP-SEC-01) |
| 10 | `/mina/installera` | portal | giltig portalsession | standard | Installera på hemskärmen (CP-INST-04) |
| 11 | `/mina/integritet` | portal | giltig portalsession | standard | Integritet (CP-PRIV-01) |

Nav-markering (COMPONENTS §3): `/mina` och `/mina/bokningar/[id]` → **Bokningar**; `/mina/historik` → **Historik**; `/mina/profil`, `/mina/sakerhet`, `/mina/installera`, `/mina/integritet` → **Profil**. Inga andra routes existerar i v1 — en route utanför tabellen = FAIL.

Dokumenttitel: mönstret `[Sidnamn] – [Företag]` (CP-SHELL-02) på alla portalsidor; detalj = "Bokning – [Företag]" (CP-DET-02), installera = "Installera – [Företag]" (CP-INST-01).

---

## 4. Route-för-route-kontrakt

Gemensamt för alla routes: `CustomerPortalShell` renderas exakt en gång (skip-länk CP-SHELL-01 först, `<header>` = `CustomerPortalTopbar`, exakt ett `<main id="huvudinnehall">`); fokus på `<main>`/h1 vid routebyte; `PrototypeFixtureControl` sist i DOM (endast prototyp, aldrig produkt). Obligatoriska states nedan refererar briefens §18-tabell.

### 4.1 `/oppna/[tenantSlug]#<token>` — bootstrap

- **Host/session:** portal; ingen session före utbyte. Fragmentet läses lokalt av JS och POST:as; det skickas aldrig i GET (brief §6.1).
- **h1:** CP-BOOT-01 "Öppnar din bokning".
- **Komponentordning (mobil = desktop, en smal centrerad yta):** CustomerPortalTopbar (`interactive=false`) → h1 → neutral spinner/skeleton (PortalSkeleton-mönstret, CP-SKEL-01) → brödtext CP-BOOT-02.
- **Primär CTA:** ingen i kontroll-läget (lyckat utbyte navigerar med `replace`, ingen egen copy). I fel-lägena: CP-BOOT-09/12 "Skicka ny kod" → `/aterhamta/[tenantSlug]`.
- **Sekundär CTA (fel-lägena):** CP-BOOT-13 "Till företagets bokningssida"; metarad CP-BOOT-14.
- **Data:** endast tenantSlug + token-fragment. Visar ALDRIG telefonnummer, kundnamn, bokningsdetaljer, token, tekniskt fel-ID eller falsk inloggningsknapp (brief §8.2).
- **Obligatoriska states:** kontrollerar länk; lyckad redirect; JavaScript saknas (CP-BOOT-03–07); ogiltig/utgången/återkallad länk (EN gemensam yta, CP-BOOT-10–14); förbrukad utan session (CP-BOOT-08–09); förbrukad med giltig session (öppnar rätt bokning direkt, ingen copy).

### 4.2 `/aterhamta/[tenantSlug]` — återhämtning

- **Host/session:** portal; ingen session; rate-limitad. Recovery-shell: topbar utan nav-element, ingen bottennav/vänsternav.
- **h1:** CP-REC-01 "Kom åt dina bokningar".
- **Komponentordning (alla lägen — recovery använder inte trekolumnslayouten; formuläryta max ~440px centrerad ≥768):** Topbar (`interactive=false`) → `RecoveryForm`: h1 → brödtext CP-REC-02 → label CP-REC-03 "Mobilnummer eller e-post" (ETT fält) → primär knapp → metarad CP-REC-07.
- **Primär CTA:** CP-REC-05 "Skicka kod" → lyckad submit navigerar till `/verifiera/[tenantSlug]`.
- **Sekundär CTA:** ingen. Ingen "logga in", inget "skapa konto", ingen tenantväxlare.
- **Data:** tenantnamn/logotyp ur publik tenantinfo via `[tenantSlug]` — inget mer. Inmatningen är en uppslagsnyckel; servern väljer alltid kanal och skickar endast till redan verifierad kanal. Träff och icke-träff ger exakt samma svar (CP-NEG-11).
- **Obligatoriska states:** default; klientvalidering CP-REC-04; pending CP-REC-06; nätverksfel CP-REC-08; cooldown CP-REC-09; max_attempts CP-REC-10; session-expired-inhopp med toast CP-REC-11.

### 4.3 `/verifiera/[tenantSlug]` — kodsteget (recovery)

- **Host/session:** portal; challenge-cookie, ingen portaldata. Recovery-shell.
- **h1:** CP-VER-01 "Ange koden".
- **Komponentordning:** Topbar (`interactive=false`) → `PinVerificationForm` (`mode="recovery"`): h1 → neutral kanalrad CP-VER-02 (alltid) + maskerad kanalrad CP-VER-03/04 endast när utskick faktiskt skett → kodfält CP-VER-05 "Engångskod" (ETT fält, `one-time-code`) → felrad → primär knapp → resend-rad.
- **Primär CTA:** CP-VER-06 "Verifiera"; `verified` (CP-VER-15) → portalsession + replace-navigering till `/mina`.
- **Sekundär CTA:** CP-VER-10 "Skicka ny kod" (resend_ready).
- **Data:** maskerad destination endast ur serverstate; koden ekas aldrig i klartext.
- **Obligatoriska states:** sending; sent SMS; sent e-post; invalid CP-VER-08; cooldown CP-VER-09; ny kod skickad CP-VER-11; expired CP-VER-12; max_attempts CP-VER-13; delivery_failed (kanalneutral) CP-VER-14; pending CP-VER-07; verified CP-VER-15.

### 4.4 `/hjalp` — hjälp (publik)

- **Host/session:** portal; ingen session; utan personuppgifter OCH utan tenantdata.
- **h1:** CP-HELP-01 "Hjälp".
- **Komponentordning:** Topbar (`interactive=false` utan session; standard-shell om sidan nås inifrån portalen via profilmenyn CP-PROF-13) → h1 → fyra stycken CP-HELP-02–05.
- **CTA:** inga knappar; ren textyta.
- **Data:** ingen. Inga placeholders med tenant- eller kunddata.
- **Obligatoriska states:** endast default (statisk sida).

### 4.5 `/mina` — startsidan (Bokningar)

- **Host/session:** portal; giltig portalsession.
- **h1:** tenantnamnet (CP-TID-01) inne i `TenantIdentityCard`.
- **Komponentordning mobil (0–767):** Topbar (profilknapp CP-TOP-03 höger) → `TenantIdentityCard` (logotyp/initialfallback max 48, namn, branschetikett CP-TID-02, Ring CP-TID-03, Hitta hit CP-TID-04, adress CP-TID-05, ursprung CP-TID-06) → `NextBookingCard` (etikett CP-HOME-01 "NÄSTA BOKNING", `BookingStatusChip`, datum/tid CP-HOME-02, tjänst CP-HOME-03, personal CP-HOME-04/05, plats CP-HOME-06, pris CP-HOME-07) → `UpcomingBookingList` under rubriken CP-HOME-12 "Fler kommande" (endast vid ≥2 kommande; COPY-ID:t styr rubriken) → `BookAgainButton` CP-HOME-11 → `InstallPromptCard` (ALLTID efter bokningsinnehållet, brief §10.4) → bottennav.
- **Komponentordning desktop (≥1024):** samma ordning i huvudkolumnen `--col-main`; högerkolumnen `--col-right` får bära företagskontakt/installation/hjälp-stöd (brief §7.3) utan att ändra DOM-ordningen; vänsternav i `--col-left`.
- **Primär CTA:** CP-HOME-08 "Visa bokningen" → `/mina/bokningar/[id]`. I tomläget: CP-HOME-17 "Boka ny tid" → tenantens `/boka`.
- **Sekundära CTA:er:** CP-HOME-09 "Lägg i kalender" (`CalendarDownloadButton`), CP-HOME-11 "Boka en tid till" (`BookAgainButton`), diskret destruktiv textknapp CP-HOME-10 "Avboka" endast när onlineavbokning är tillåten.
- **Data:** sessionens tenant-kontext + bokningslista. Pris aldrig fabricerat; saknade optionalfält döljs helt.
- **Obligatoriska states:** en kommande; flera kommande; ingen kommande (CP-HOME-14 + CP-HOME-15/16 + CP-HOME-17, ev. CP-HOME-18/19); pending/förfrågan (chip CP-STATUS-01); avbokad; laddar (skeleton); hämtningsfel CP-HOME-20/21/22; session-expired (shell-recovery); offline (CP-OFF-01–03).

### 4.6 `/mina/historik`

- **Host/session:** portal; giltig portalsession.
- **h1:** CP-HIST-01 "Historik".
- **Komponentordning (mobil och desktop — desktop i `--col-main`):** Topbar → (ev. `TenantIdentityCard`, samma kontrakt) → h1 → `BookingHistoryList` i tre sektioner i exakt ordning: CP-HIST-02 "Tidigare besök" (`completed`) → CP-HIST-03 "Avbokade bokningar" (`cancelled`) → CP-HIST-04 "Övriga bokningar" (`no_show`, väntande utfall, okänd). Rader = länkrader CP-HIST-05 med `BookingStatusChip`, nyast först; max 20 rader före paginering.
- **Primär CTA:** ingen (listnavigering till detalj är radens enda interaktion).
- **Sekundär CTA:** CP-HIST-07 "Visa fler" (laddar nästa 20; pending CP-HIST-08).
- **Data:** passerade bokningar; verklig status — inga statusar döljs eller skrivs om; pris endast om lagrat.
- **Obligatoriska states:** normal; tom CP-HIST-06; laddar fler CP-HIST-08; fel vid fler CP-HIST-09; fel vid första hämtningen CP-HIST-10/11; laddar (3 skeleton-rader).

### 4.7 `/mina/bokningar/[id]` — bokningsdetalj

- **Host/session:** portal; giltig portalsession + ägarskap. Topbaren visar synlig "Tillbaka" (CP-TOP-04) i stället för profilknappen.
- **h1:** CP-DET-03 "[veckodag] [datum] · [tid]" (mono).
- **Komponentordning (fast, COMPONENTS §10):** Tillbaka CP-DET-01 → `BookingStatusChip` → h1 → tjänst + längd → personal → plats/adress/telefon/kartlänk CP-DET-04 (från BOKNINGEN, aldrig tenantens centrala uppgifter) → pris → kundmeddelande under label CP-DET-05 → policy under label CP-DET-06 med CP-DET-07 → åtgärder sist. Desktop: i `--col-main`; ≥1248px får plats-blocket ligga i högerkolumnen utan att DOM-ordningen ändras.
- **Primär/sekundära CTA:er (aktiv bokning):** CP-DET-08 "Lägg i kalender", CP-DET-09 "Boka en tid till", destruktiv CP-DET-10 "Avboka bokningen" endast när tillåtet → öppnar `CancelBookingDialog`. Historisk bokning: CP-DET-11 "Boka igen" endast om tjänsten är publik; ingen avbokningsknapp.
- **Tillbakakontrakt (bindande):** från `/mina` → `/mina`; från `/mina/historik` → `/mina/historik`; direktinhopp (SMS/PWA/deep-link) → `/mina`. Avgörs av dokumenterad in-app-navigation, aldrig `document.referrer`.
- **Data:** route-param + sessionens datakontext; saknade optionalfält döljs helt med bevarad ordning.
- **Obligatoriska states:** aktiv; spärrad av policy (CP-DET-12–15); avbokad; completed; no-show; saknas/ej ägd — neutral ägarskaps-404 CP-DET-18 "Bokningen kunde inte visas" + CP-DET-19 (EXAKT samma yta för fel id, annan kunds bokning och fel tenant); hämtningsfel CP-DET-16/17; laddar; session-expired.

### 4.8 `/mina/profil`

- **Host/session:** portal; giltig portalsession.
- **h1:** CP-PROF-01 "Profil".
- **Komponentordning:** Topbar → h1 → `CustomerProfileCard`: uppgiftskort (h2 CP-PROF-02 "Mina uppgifter", förklaring CP-PROF-03, namnrad CP-PROF-04 + ghost CP-PROF-05 "Ändra", `VerifiedContactCard` CP-VC-01–08) → meny `<nav aria-label="Profilmeny">` (CP-PROF-08) med exakt sex poster i exakt ordning: CP-PROF-09 Mina uppgifter, CP-PROF-10 Säkerhet och enheter, CP-PROF-11 Installera på hemskärmen, CP-PROF-12 Integritet, CP-PROF-13 Hjälp, CP-PROF-14 Logga ut (`<button>` → `DestructiveActionDialog` `logout-current`). Desktop: i `--col-main`.
- **Primär CTA:** inga sidglobala; i namnredigering CP-NAME-03 "Spara" (sekundär CP-NAME-02 "Avbryt"). Kontaktkortets åtgärd är serverstyrd av faktiskt läge: CP-VC-06 "Byt telefonnummer", CP-VC-07 "Lägg till mobilnummer" eller CP-VC-08 "Byt e-post" → `ContactChangeFlow` (CP-CCF-01–41, dialog/sheet, ingen egen route).
- **Data:** namn + serverstyrd `verifiedContact` (`sms`|`email`); telefon får saknas. E-postverifierad kund utan telefon visar ingen tom telefonrad men visar CP-VC-07 "Lägg till mobilnummer". Efter godkänd SMS-PIN blir mobilen primär verifierad kanal och den tidigare verifierade e-posten ligger kvar maskerad som verifierad reservkontakt.
- **Obligatoriska states:** read-only; redigera namn; sparar CP-NAME-05; valideringsfel CP-NAME-04; sparfel CP-NAME-07; success-toast CP-NAME-06; uppgiftsfel CP-PROF-06/07 (menyn förblir funktionell); laddar; session-expired. Kontaktbytets samtliga states (start, step-up SMS/e-post, fel/utgången/maxförsök, otillgänglig kanal CP-CCF-08, ny destination, ny PIN, destinationskonflikt CP-CCF-29 för telefon eller CP-CCF-38 för e-post, atomiskt byte, åtgärdsspecifikt lyckat CP-CCF-30/36/37) spåras under denna route.

### 4.9 `/mina/sakerhet`

- **Host/session:** portal; giltig portalsession.
- **h1:** CP-SEC-01 "Säkerhet och enheter" + förklaring CP-SEC-02.
- **Komponentordning:** Topbar → h1 → `PortalSessionList` (h2 CP-SEC-03 "Inloggade enheter" — aldrig "Betrodda enheter", CP-NEG-12; aktuell session först med badge CP-SEC-06) → `BookingTrustList` (egen `<section>`, h2 CP-SEC-13 "PIN-fria bokningsenheter" + CP-SEC-14) — de två listorna slås aldrig ihop. Desktop: i `--col-main`.
- **Primära/destruktiva CTA:er:** per rad CP-SEC-07 "Logga ut" / CP-SEC-08 "Logga ut här" / CP-SEC-15 "Kräv PIN nästa gång"; samlingsknappar CP-SEC-09 (≥2 sessioner) och CP-SEC-16 (≥2 poster). Alla går via `DestructiveActionDialog` (variantmatris CP-DLG-01–15; gemensamma tillstånd CP-DLG-16–19).
- **Data:** portalsessioner (endast `mina.corevo.se`) respektive booking trusts (tenanthosten). Ingen IP, ingen platskolumn = bindande.
- **Obligatoriska states:** en portalsession; flera; PIN-fria enheter normal/tom CP-SEC-17; återkallningsdialoger; pending CP-DLG-17/18; lyckad CP-SEC-10/18; fel CP-SEC-11/12/19/20 + CP-DLG-19; bara aktuell kvar; utloggad-ytan CP-DLG-20–23 (efter `logout-current`, recovery-skal utan nav).

### 4.10 `/mina/installera`

- **Host/session:** portal; giltig portalsession. Dokumenttitel CP-INST-01.
- **h1:** CP-INST-04 `Installera på hemskärmen`. InstallPromptCard använder därefter CP-PWA-01 `Ha dina bokningar nära till hands` som h2.
- **Komponentordning:** Topbar → `InstallPromptCard` (`placement="page"`): rubrik + brödtext CP-PWA-02 → miljörätt CTA-block → ev. `IosInstallGuide` inline (CP-IOS-02–06, utan stängknapp i inline-läget).
- **Primär CTA per miljö:** Android/Chromium med fångad `beforeinstallprompt`: CP-PWA-03 "Lägg på hemskärmen"; Chromium utan event: ENDAST länken CP-PWA-05 "Så installerar du"; iOS Safari: CP-IOS-01 "Visa hur"; in-app-webbläsare: CP-APP-02 "Kopiera länken" (+ CP-APP-07 endast vid verifierat fungerande systemåtgärd).
- **Sekundär CTA:** ingen "Inte nu" på denna sida (stängs via navigation); sidan räknas ALDRIG som ett av de två automatiska erbjudandena och är alltid nåbar, även efter `dismissed_twice`.
- **Data:** ingen persondata; manifestet är Corevo-neutralt (`Mina bokningar · Corevo`, scope `/mina/`).
- **Obligatoriska states:** unsupported CP-INST-02; standalone CP-INST-03; Android eligible; offline CP-PWA-06; iOS-guide; in-app-webbläsare CP-APP-01–08.

### 4.11 `/mina/integritet`

- **Host/session:** portal; giltig portalsession.
- **h1:** CP-PRIV-01 "Integritet".
- **Komponentordning:** Topbar → h1 → fyra stycken CP-PRIV-02–05. Desktop: i `--col-main`.
- **CTA:** inga; ren textyta med datarättighetshänvisning till [Företag] (CP-PRIV-05).
- **Data:** endast `[Företag]`-placeholder ur sessionens tenant-kontext.
- **Obligatoriska states:** endast default (statisk sida i giltig session).

### 4.12 Tenanthostens steg 4/5 (utanför portal-IA:t men i paketet)

- **Steg 4:** `PinVerificationForm` (`mode="booking"`) i tenantens bokningsflödesram — rubrik CP-PIN-01, alla tillstånd CP-PIN-02–21 inkl. `slot_lost` (CP-PIN-18/19). Ingen portal-shell.
- **Steg 5:** `BookingStepFive` — huvudspår CP-S5-01–15 (persistens ≠ leverans), separat felspår CP-S5-16–18; primär `CalendarDownloadButton` (CP-S5-04), sekundär `BookAgainButton` (CP-S5-05). Nås aldrig utan genomförd PIN; direktinhopp utan flödesstate → flödets start.

---

## 5. Navigation och breakpoints (exakt)

| Läge | Spann | Topbar | Navigation |
|---|---|---|---|
| Mobil | 0–767px | 60px (`--topbar-h-mobile`), sticky, safe-area-top | Bottennav 60px + `env(safe-area-inset-bottom)`, fixed, `--surface-1`, 1px `--line-1` ovankant, `--shadow-bottom-nav` |
| Tablet | 768–1023px | 60px | Samma bottennav som mobil; innehåll max 760px centrerat |
| Desktop | ≥1024px | 56px (`--topbar-h-desktop`) | Vänsternav 232px (`--col-left`), sticky under topbaren; ingen bottennav |

- `CustomerPortalNavigation` renderar exakt tre poster i fast ordning: **Bokningar** (CP-NAV-02) → **Historik** (CP-NAV-03) → **Profil** (CP-NAV-04); `<nav aria-label="Huvudmeny">` (CP-NAV-01). Exakt en variant per viewport — aldrig båda.
- Bottennav: 3 lika kolumner, per post ikon 24 över label 12/18; träffyta = 1/3 av bredden × hela stapelhöjden (≥64×52px före safe-area, brief §7.1). Aktiv post: ikon + label `--positive` + `aria-current="page"` + viktökning — färg är aldrig enda signalen.
- Vänsternav: post-höjd ≥44px, ikon 24 + label 15/22 i rad, aktiv = bg `--surface-2` + 2px vänsterkant `--action`.
- Topbar mobil/tablet: COREVO (CP-TOP-01) + MINA BOKNINGAR (CP-TOP-02) vänster; profilknapp (CP-TOP-03) höger → `/mina/profil`; i detaljläge ersätts den av "Tillbaka" (CP-TOP-04). Desktop: förnamn/initialer + "Logga ut" (CP-TOP-05) höger. Tenantlogotyp i topbaren = FAIL.
- Ingen hamburgarmeny i v1. Desktop introducerar inga egna funktioner — samma kortordning, etiketter och actions som mobil.
- Layoutcontainrar: mobil gutters 16px (20px från ≥390px); tablet max 760px; desktop max 1248px = 232 + 680 + 288 + två gap à 24; vid 1024–1247px faller högerkolumnen under huvudkolumnen, vänsternav behålls.
- Acceptansviewports (bindande, TOKENS §8.2): **320×568, 390×844, 430×932, 768×1024, 1024×768, 1440×900** — ingen horisontell scroll, inga klippta kontroller, synligt fokus.

---

## 6. Fixturekontrakt (brief §28.1 — syntetiska, bindande)

Två helt separata tenantfixtures. De får ALDRIG visas som två företag i samma v1-session; växlingen sker endast via `PrototypeFixtureControl` (tydligt märkt prototypkontroll, aldrig produktfunktion eller säkerhetsmekanism). Ett fixturbyte är atomärt — data, namn, logotyp och färg byts i sin helhet; blandat läge existerar inte.

### 6.1 FreshCut (frisör — normalfallet)

| Fält | Värde |
|---|---|
| Bransch/`verticalLabel` | Frisörsalong (CP-TID-02) |
| Platser | EN plats |
| Verifierad kanal | SMS (maskerat mobilnummer, t.ex. `•••• •• 45 67`) |
| Personal | angiven med namn (CP-HOME-04) |
| Tjänst | normal tjänst (t.ex. Klippning) med fast pris (CP-HOME-07) |
| Bokningsursprung | "Du bokade via freshcut.se" (CP-TID-06) |
| Bevisar | huvudflödet: SMS-bootstrap, hero-kortet, avbokning, kalender, profil, säkerhet |

### 6.2 Nordverk Bilservice (bilverkstad — generalitetsbeviset)

| Fält | Värde |
|---|---|
| Bransch/`verticalLabel` | Bilverkstad |
| Platser | TVÅ platser: `Hälla` och `Erikslund` — plats i detalj/listor kommer alltid från BOKNINGEN, aldrig tenantens centrala adress |
| Verifierad kanal | e-post (fallbackkund), UTAN telefonnummer — endast e-postraden i `VerifiedContactCard`, ingen tom telefonrad; CP-VC-07 "Lägg till mobilnummer" startar det separata dubbelverifierade `add_phone`-flödet |
| Personal | ingen namngiven → "Valfri personal" (CP-HOME-05) |
| Tjänst | `Felsökning av motor och elektriskt system` (långt namn — radbryt/trunkering med fulltext tillgänglig, brief §21) |
| Pris | inget exakt pris → prisraden döljs helt (aldrig fabricerat) |
| Bevisar | generiska etiketter, långa tjänstenamn, e-postidentitet (kanalrader CP-PIN-06/07, CP-VER-04), flera platser, dolda optionalfält |

Nordverk ska visas minst i mobilprototypens detaljläge och i desktop-/state-galleriet. Alla namn, nummer och bokningar i båda fixtures är påhittade — inga credentials, ingen riktig kunddata (README §Data).

---

## 7. Första besöket — bootstrap och no-JS

### 7.1 Länkkontraktet (brief §8.1)

SMS-exempel: `FreshCut: Din tid för Skäggtrim är bokad ons 22 juli 11:00. Se och hantera bokningen: https://mina.corevo.se/oppna/freshcut#<hemlighet>`. Tenantnamnet står alltid i texten. Vid e-postfallback används samma URL i ett transaktionellt bekräftelsemejl — bootstrap, single-use, session och tenantgräns är identiska; copy säger `bekräftelsemejl` och maskerad e-postadress.

### 7.2 Bootstrapsekvensen (brief §8.2)

1. Sidan visar omedelbart Corevo-identitet + CP-BOOT-01/02 med neutral spinner/skeleton. Fragmentet ligger i `#` just för att länkscanners gör GET — det skickas aldrig till servern i GET.
2. JS läser fragmentet lokalt, gör explicit POST-utbyte och kör omedelbart `history.replaceState` innan annan navigation eller analytics startar.
3. Lyckat utbyte: säker hostlåst cookie sätts → fragmentet bort → `replace`-navigering till bokningen som skapade länken om den finns, annars `/mina`. Ingen välkomstkarusell.
4. Adressen är därefter alltid tokenfri.

### 7.3 Länklägen (sluten lista)

| Läge | Yta |
|---|---|
| Giltig, oanvänd | utbyte + replace (ingen copy) |
| Förbrukad + giltig session på enheten | rätt portal/bokning öppnas direkt utan ny PIN (ingen copy) |
| Förbrukad + ingen session | CP-BOOT-08 + primär CP-BOOT-09 "Skicka ny kod" |
| Utgången / felaktig / återkallad | EN gemensam yta: CP-BOOT-10/11 + CP-BOOT-12/13/14 — fallen skiljs aldrig åt |

Känd och okänd uppgift ger samma statuskod, responsform och copy; inga avsiktliga skillnader som möjliggör enumeration (brief §8.4).

### 7.4 No-JS (`<noscript>`, serverrenderad)

Rubrik CP-BOOT-03 "JavaScript behövs för att öppna den säkra länken", text CP-BOOT-04, tre fungerande länkar: CP-BOOT-05 "Få en ny kod" → `/aterhamta/[tenantSlug]`, CP-BOOT-06 "Till företagets bokningssida", CP-BOOT-07 "Hjälp" → `/hjalp`. Ingen persondata och ingen token återges.

---

## 8. Status- och actionmatris — startsida, historik, detalj (kanonisk, sluten)

All status renderas via `BookingStatusChip` — får inte återuppfinnas lokalt. Tid + status avgör tillsammans sektion; komponenten muterar aldrig bokningens status. Färg är aldrig enda bärare (text CP-STATUS-01–07 + distinkt ikonform per färgklass).

| Runtime-status | Chip (COPY-ID) | Färg | Sektion/placering | Tillåtna handlingar |
|---|---|---|---|---|
| `pending`, start i framtiden | Förfrågan mottagen (CP-STATUS-01) | `--warning` | kommande (`/mina`) | detalj (CP-HOME-08), kalender (CP-HOME-09/CP-DET-08), boka en tid till (CP-AGAIN-01), avboka endast om policy tillåter (CP-HOME-10/CP-DET-10) |
| `confirmed`, start i framtiden | Bekräftad (CP-STATUS-02) | `--positive` | kommande (`/mina`) | som ovan |
| `completed` | Genomförd (CP-STATUS-03) | `--positive` | Tidigare besök (CP-HIST-02) | detalj; Boka igen (CP-AGAIN-03/CP-DET-11) endast om tjänsten är publik |
| `cancelled` | Avbokad (CP-STATUS-04) | `--negative` | Avbokade bokningar (CP-HIST-03) | detalj; Boka igen om tjänsten är publik; ALDRIG avboka |
| `no_show` | Uteblev (CP-STATUS-05) | `--negative` | Övriga bokningar (CP-HIST-04) | detalj; ingen mutation |
| `pending`/`confirmed`, start passerad utan avslut | Väntar på avslut (CP-STATUS-06) | `--warning` | Övriga bokningar | detalj; ingen kundmutation |
| okänd/övrig | Status uppdateras (CP-STATUS-07) | `--warning` | Övriga/neutral fallback | detalj + företagskontakt; aldrig avbokning eller annan mutation |

Kompletterande actionregler:

- **Avbokning** sker uteslutande via `CancelBookingDialog` (CP-CAN-01–13): pending "Avbokar…" låser allt; redan avbokad = idempotent success (CP-CAN-13); policy ändrad under dialogen = ingen mutation + CP-CAN-11/12; spärrad avbokning i detaljen = CP-DET-12–15 (aldrig en död knapp).
- **Boka igen-labels** är en sluten lista (CP-AGAIN-01 "Boka en tid till" vid aktiv bokning, CP-AGAIN-02 "Boka ny tid" i tomläge, CP-AGAIN-03 "Boka igen" i historik/historisk detalj); målet är alltid tenantens faktiska publika `/boka`-URL, saknas den renderas knappen inte. Ombokning i portalen = FAIL (CP-NEG-08).
- **Kalenderexport** (`CalendarDownloadButton`): ägarskapskontrollerad serverbegäran (knapp, inte delbar länk); "Hämtar…" → CP-CAL-03/04; ägarskapsfel = exakt samma text som CP-CAL-04.
- **Ägarskaps-404** (CP-DET-18) och tomlägen (CP-HOME-14–19, CP-HIST-06) återanvänds exakt — ett tomläge lånar aldrig annan ytas copy och renderas först när hämtningen lyckats med noll poster; fel ≠ tomt.

---

# SPEC del 2 — Implementeringsindex

**Omfattning del 2:** implementeringsindexet: boknings-PIN steg 4 och tenant-hostade steg 5 med alla states och gatewaystatusar; de två hostlåsta trustkontexterna (portal bootstrap/session kontra booking trust); profil och exakt meny; `verifiedContact`-unionen; det dubbelverifierade kontaktbytet inkl. supportspärr och revocation; säkerhetssidans två listor och samtliga destruktiva dialoger; PWA-manifest/scope och installations-statemaskinen per miljö; det kundsynliga datakontraktet; komponent→route→COPY-ID-mappingen för alla 28 namngivna komponenter; accessibility-/responsiv acceptans; samt filkartan för implementation enligt briefens avsnitt 24. Del 2 inför inga nya routes, fält, states eller strängar — varje referens pekar på brief/TOKENS/COMPONENTS/COPY enligt kanonordningen §1.1.

---

## 9. Boknings-PIN — steg 4 av 5 (tenanthosten)

Komponent: `PinVerificationForm` (`mode="booking"`, COMPONENTS §14) i tenantens bokningsflödesram — ingen portal-shell, ingen portal-nav (§4.12). Kodfältet är ETT semantiskt input (`one-time-code`, label CP-PIN-02 "Engångskod"); flera inputs = FAIL. Rubrik CP-PIN-01 "Ange koden". Fel eller utgången PIN skapar aldrig en bokning (§2.2).

Fullständigt state-register (kanoniskt, slutet — brief §9.1/§18 "PIN bokning"; alla texter exakt ur COPY §10):

| State (brief §18) | COPY-ID | Kontrakt |
|---|---|---|
| skickar (`sending`) | CP-PIN-03 | Kanalrad "Skickar koden…" (`aria-live="polite"`); fält + Verifiera låsta. |
| skickad SMS (`sent_sms`) | CP-PIN-04 + CP-PIN-05 | Maskerad SMS-kanalrad + "Ändra mobilnummer"; autofokus på kodfältet. |
| skickad e-post (`sent_email`) | CP-PIN-06 + CP-PIN-07 | Maskerad e-postkanalrad + "Ändra e-post" (fallbackkund, bevisas av Nordverk §6.2). |
| Verifiera default/pending | CP-PIN-08 / CP-PIN-09 | "Verifiera" → "Verifierar…" (`aria-disabled`, fält låst). |
| fel kod (`invalid`) | CP-PIN-10 | "Fel kod. Du har [n] försök kvar." (`role="alert"`); värdet kvar, fokus åter i fältet. |
| cooldown | CP-PIN-11 | "Skicka ny kod om [00:ss]" (`aria-live="polite"`, ingen fokusstöld). |
| ny kod (`resend_ready` → omskick) | CP-PIN-12 + CP-PIN-13 | "Skicka ny kod" → "En ny kod har skickats." (ny kod ogiltigförklarar gammal). |
| utgången (`expired`) | CP-PIN-14 | "Koden har gått ut. Begär en ny kod."; Verifiera låst tills ny kod begärts. |
| maxförsök (`max_attempts`) | CP-PIN-15 | "För många försök. Begär en ny kod om [n] min."; challenge låst, ingen bokning. |
| leveransfel SMS | CP-PIN-16 | Kanalriktig felrad "SMS:et med koden kunde inte skickas. …". |
| leveransfel e-post | CP-PIN-17 | "Mejlet med koden kunde inte skickas. …". |
| tid förlorad (`slot_lost`) | CP-PIN-18 + CP-PIN-19 | Ersättningsyta "Tiden hann tyvärr bokas av någon annan." + "Välj en ny tid" — ingen kodinmatning kvar. Endast `mode="booking"`. |
| verifierad (`verified`) | CP-PIN-20 | "Verifierad" (`role="status"`) + automatisk vidaregång till steg 5. |
| nätverksfel vid Verifiera | CP-PIN-21 | "Koden kunde inte kontrolleras. Försök igen."; kod/fält återställs inte. |

Recovery-läget (`mode="recovery"` på `/verifiera/[tenantSlug]`) spåras i §4.3 med CP-VER-01–15 — identiskt kodkontrakt, egen COPY-serie. Fixturer: FreshCut bevisar SMS-spåret, Nordverk e-postspåret (§6).

## 10. Steg 5 av 5 — tenant-hostad bekräftelse (persistens ≠ leverans)

Komponent: `BookingStepFive` (COMPONENTS §15) på tenanthosten; nås aldrig utan genomförd PIN; direktinhopp utan flödesstate → flödets start. Persistens ("bokningen finns") och leverans ("bekräftelsen kom fram") är två separata sanningar — blandning av spåren = FAIL.

**Huvudspår (bokningen ÄR skapad):** h1 CP-S5-01 "Bokningen är klar" i ALLA leveranslägen; chip CP-S5-02 (Bekräftad/Förfrågan mottagen enligt §8-matrisen); hjälptext CP-S5-03; primär `CalendarDownloadButton` CP-S5-04; sekundär `BookAgainButton` CP-S5-05; stängåtgärd CP-S5-06.

| Gatewaystatus | COPY-ID | Statusrad |
|---|---|---|
| `gateway_persisted` (utskick köat) | CP-S5-07 | "Bokningen är klar. Bekräftelsen är på väg till [maskerad destination]." (`role="status"`) |
| `submitted` (överlämnat till operatör) | CP-S5-08 | "Bekräftelsen är skickad till [maskerad destination]" |
| `delivered` (leverans bekräftad) | CP-S5-09 | "Bekräftelse skickad till [maskerad destination]" |
| `delivery_failed` | CP-S5-10 + CP-S5-11/12/13 + CP-S5-14 | Felrad (`role="alert"`) + rate-limitad idempotent "Skicka bekräftelsen igen" (pending "Skickar…", cooldown "Du kan skicka igen om [n] s") + företagskontakt. Rubriken förblir "Bokningen är klar" — leveransfel gör ALDRIG bokningen osäker. |
| `unknown` (uppslag misslyckades) | CP-S5-15 | "Bokningen är klar. Vi kontrollerar leveransen av bekräftelsen." — ingen automatisk dubblettsändning, ingen retry-CTA. |

**Separat felspår (ingen bokning skapades):** egen layout — CP-S5-16 "Bokningen kunde inte slutföras" + CP-S5-17 "Ingen bokning skapades." + CP-S5-18 "Tillbaka till lediga tider". Ingen sammanfattning, ingen kalender-CTA, ingen "klar"-formulering. "Försök igen"-vägen är idempotent mot serverns bokningsförsök (ett sent svarat lyckat försök dubbelbokas aldrig — servern svarar med befintlig bokning → huvudspåret).

Retry-mekaniken (JIT-mintning, idempotency key, reconciliation vid `submitted`/`unknown`) är serverns kontrakt per brief §25.2 — designen visar endast statusarna ovan.

## 11. Två hostlåsta trustkontexter (brief §23.1)

Hostlåsta cookies kan inte delas mellan tenantens domän och `mina.corevo.se` — därför exakt TVÅ serverlagrade, separata kontexter som aldrig blandas:

| Kontext | Host | Skapas | Används till | Syns i UI som | Återkallas via |
|---|---|---|---|---|---|
| **Portal session** | `mina.corevo.se` | bootstrap-utbytet `/oppna/[tenantSlug]#<token>` (§7) eller recovery `verified` (§4.3) | läsa/hantera EN tenantbunden kundrelation (`/mina*`) | `PortalSessionList` "Inloggade enheter" (CP-SEC-03) | CP-DLG `logout-*`; kontaktbyte (§14 nedan); serverrevocation |
| **Booking trust** | tenanthosten | betrodd-markering i tenantens bokningsflöde (steg 4) | slippa PIN vid FRAMTIDA bokning hos samma tenant | `BookingTrustList` "PIN-fria bokningsenheter" (CP-SEC-13) | CP-DLG `revoke-trust`/`revoke-all-trusts`; kontaktbyte |

Bindande gränser: utloggning på ena hosten lovar ALDRIG cookie-radering på den andra — men serveråterkallelse gör kvarvarande cookie ogiltig. Trust-återkallelse påverkar endast framtida PIN-krav på tenanthosten — aldrig portalsessionen, aldrig befintliga bokningar (CP-DLG-11/14 säger exakt detta). Bootstrapkontraktet (fragment läses lokalt, POST-utbyte, `history.replaceState`, tokenfri adress därefter) är låst i §7.2; lagringsmodellen (hashade tokens/hemligheter i `private.customer_portal_links/_sessions/_trusts/_challenges/_audit`) är serverns per brief §23.2 och renderas aldrig.

## 12. Profil `/mina/profil` — uppgiftskort och exakt meny

Komponent: `CustomerProfileCard` (COMPONENTS §17). h1 CP-PROF-01 "Profil"; uppgiftskort h2 CP-PROF-02 "Mina uppgifter" + förklaring CP-PROF-03; namnrad CP-PROF-04 + ghost CP-PROF-05 "Ändra"; därunder `VerifiedContactCard` (§13 nedan).

Menyn `<nav aria-label="Profilmeny">` (CP-PROF-08) — exakt SEX poster i exakt denna ordning, sluten lista (andra poster = FAIL):

| # | COPY-ID | Post | Mål |
|---|---|---|---|
| 1 | CP-PROF-09 | Mina uppgifter | `/mina/profil` (scroll+fokus till uppgiftskortet på sidan själv) |
| 2 | CP-PROF-10 | Säkerhet och enheter | `/mina/sakerhet` |
| 3 | CP-PROF-11 | Installera på hemskärmen | `/mina/installera` |
| 4 | CP-PROF-12 | Integritet | `/mina/integritet` |
| 5 | CP-PROF-13 | Hjälp | `/hjalp` |
| 6 | CP-PROF-14 | Logga ut | `<button>` (inte länk) → `DestructiveActionDialog` `logout-current` |

Namnredigering (inline): CP-NAME-01–07 — label "Namn", "Avbryt"/"Spara", validering 2–120 tecken (CP-NAME-04), pending "Sparar…" (CP-NAME-05), toast "Namnet är sparat." (CP-NAME-06), sparfel CP-NAME-07. Uppgiftsfel CP-PROF-06/07 lämnar menyn funktionell.

## 13. `verifiedContact` — serverstyrd union `sms | email`

Datakontrakt (brief §22, COMPONENTS §18 — bindande): `verifiedContact` är en diskriminerad union som SERVERN bestämmer — `{ channel: 'sms', maskedDestination }` ELLER `{ channel: 'email', maskedDestination }`, aldrig båda som primär. Klienten renderar exakt det servern anger och kan aldrig byta channel via en vanlig request — byte sker endast via §14.

Rendering i `VerifiedContactCard`: label CP-VC-01 "Verifierad kontakt", kanalord CP-VC-02 "SMS" / CP-VC-03 "E-post" och märke CP-VC-04 "Verifierad". Åtgärden är serverstyrd av den rad och det läge som faktiskt finns: CP-VC-06 "Byt telefonnummer" för primär mobil, CP-VC-07 "Lägg till mobilnummer" för e-postverifierad kund utan telefon och CP-VC-08 "Byt e-post" på en e-postrad som faktiskt finns. En sekundär kontakt som finns men inte är verifierad märks CP-VC-05 "Inte verifierad" och visas endast om den faktiskt finns.

**E-postkund utan telefon är ett fullständigt giltigt läge** (Nordverk-fixturen, §6.2): endast e-postraden renderas — ingen tom telefonrad och ingen platshållare — tillsammans med CP-VC-07 "Lägg till mobilnummer". När det separata `add_phone`-flödet är godkänt blir mobilen primär verifierad kanal och den tidigare verifierade e-posten ligger kvar som maskerad verifierad reservkontakt. Overifierad primärkontakt kan inte förekomma i giltig session. Halvbytt kontakt visas aldrig (change-pending = default oförändrat).

## 14. Dubbelverifierat kontaktbyte — `ContactChangeFlow`

Dialog/sheet ovanpå `/mina/profil` (ingen egen route); scrim-klick stänger inte; `Esc` = Avbryt utom under pending. Ram: stegindikator CP-CCF-01 "Steg [n] av 4" (steg 5 är kvitto), sekundär CP-CCF-02 "Avbryt" i steg 1–4. Sluten sekvens (COMPONENTS §19):

| Steg | Innehåll | COPY-ID |
|---|---|---|
| 1. Bekräfta identitet | Rubrik CP-CCF-03; koden går ALLTID till nuvarande primära kontakt (CP-CCF-04), aldrig till något kunden anger; varför-två-koder CP-CCF-05; "Skicka kod" CP-CCF-06 (pending CP-CCF-07; utskicksfel CP-CCF-09) | CP-CCF-03–09 |
| 2. Kod, nuvarande kontakt (step-up) | Kanalrader CP-CCF-10/11; kodkontraktet CP-CCF-12–14; invalid/expired/max_attempts CP-CCF-15–17; cooldown/omskick/leveransfel ärver exakt CP-PIN-11/12/13/16/17 | CP-CCF-10–17 |
| 3. Ny destination, kanal låst av startåtgärden | `change_phone`/`add_phone`: telefonfält CP-CCF-20 "Nytt mobilnummer" + landskod CP-CCF-33 och telefonvalidering CP-CCF-21. `change_email`: e-postfält CP-CCF-34 "Ny e-postadress" + e-postvalidering CP-CCF-35. Konsekvens-förhandsinfo CP-CCF-22; "Skicka kod" CP-CCF-23. Inget generiskt mobil/e-post-fält och ingen kanalhärledning ur fritext. | CP-CCF-20–23, CP-CCF-33–35 |
| 4. Kod, ny destination | Separat challenge, ny kod ≠ steg 2-koden: CP-CCF-24/25; fel-states CP-CCF-26–28; telefonkonflikt CP-CCF-29; e-postkonflikt CP-CCF-38; pending CP-CCF-14 täcker "atomiskt byte pågår"; dubbelsubmit ger aldrig dubbelbyte (idempotent) | CP-CCF-24–29, CP-CCF-38 |
| 5. Klart (kvitto) | `change_phone`: CP-CCF-30 "Telefonnumret är ändrat."; `add_phone`: CP-CCF-36 "Mobilnumret är tillagt."; `change_email`: CP-CCF-37 "Kontaktuppgiften är bytt.". Alla visar konsekvensrad CP-CCF-31 + "Stäng" CP-CCF-32; nya värdet syns i §13-kortet först EFTER stängning. | CP-CCF-30–32, CP-CCF-36–37 |

**Supportspärr (gammal kanal otillgänglig):** ingen self-service-väg och ingen alternativ verifiering. Steg 1 visar länken CP-CCF-08 "Jag kommer inte åt den här kontaktuppgiften" → neutral hjälpvy CP-CCF-39–41 med exakt förklaring CP-CCF-40 och en fungerande publik kontaktväg (CP-TID-03 Ring eller CP-DET-15 deras webbplats). **Destinationskonflikt:** åtgärdsspecifikt men relationsneutralt fel i steg 4 — telefonåtgärder använder CP-CCF-29 "Numret används redan. Kontakta [Företag] så hjälper de dig." och `change_email` använder CP-CCF-38 "Uppgiften kan inte användas. Kontakta [Företag]." Ingen variant får erbjuda merge eller avslöja den andra kundrelationens uppgifter (CP-NEG-11-principen). **Step-up-fönster:** max 10 min från godkänt steg 2 — därefter CP-CCF-18 "Sessionen för bytet har gått ut. Börja om." + CP-CCF-19 "Börja om".

**Revocation vid godkänt steg 4 (EN atomär serveroperation, ingen delordning får synas):** (1) primär `verifiedContact` byts; (2) alla utestående länkar/challenges till gamla kanalen återkallas; (3) ALLA booking trusts återkallas; (4) alla ANDRA portalsessioner loggas ut och den aktuella roteras (kunden förblir inloggad). Konsekvenstexten är exakt CP-CCF-22/31: "Dina andra inloggade enheter loggas ut och dina PIN-fria bokningsenheter återkallas."

## 15. Säkerhet `/mina/sakerhet` — två listor + alla destruktiva dialoger

h1 CP-SEC-01 + förklaring CP-SEC-02. TVÅ separata `<section>` som ALDRIG slås ihop (§4.9); ingen IP, ingen platskolumn i någon av dem (= FAIL):

1. **Inloggade enheter** (`PortalSessionList`, endast portalsessioner på `mina.corevo.se`): h2 CP-SEC-03 (aldrig "Betrodda enheter", CP-NEG-12); rader CP-SEC-04/05; aktuell först med badge CP-SEC-06; per-rad CP-SEC-07 "Logga ut" / CP-SEC-08 "Logga ut här"; samlingsknapp CP-SEC-09 (≥2 sessioner); success-annons CP-SEC-10; fel CP-SEC-11/12. Tomläge kan inte inträffa.
2. **PIN-fria bokningsenheter** (`BookingTrustList`, tenanthostens trusts): h2 CP-SEC-13 + förklaring CP-SEC-14; per-rad CP-SEC-15; samlingsknapp CP-SEC-16 (≥2 poster); tomläge CP-SEC-17 (ingen CTA — trust skapas endast i bokningsflödet); success-annons CP-SEC-18; fel CP-SEC-19/20.

Samtliga destruktiva åtgärder går via `DestructiveActionDialog` — variantmatrisen är sluten (fem varianter, andra = FAIL):

| Variant | Rubrik | Konsekvens | Destruktiv CTA | Utlösare |
|---|---|---|---|---|
| `logout-other` | CP-DLG-01 | CP-DLG-02 | CP-DLG-03 "Logga ut enheten" | CP-SEC-07 |
| `logout-all-others` | CP-DLG-04 | CP-DLG-05 | CP-DLG-06 "Logga ut alla andra" | CP-SEC-09 |
| `logout-current` | CP-DLG-07 | CP-DLG-08 | CP-DLG-09 "Logga ut" | CP-SEC-08; CP-PROF-14; CP-TOP-05 |
| `revoke-trust` | CP-DLG-10 | CP-DLG-11 | CP-DLG-12 "Kräv PIN nästa gång" | CP-SEC-15 |
| `revoke-all-trusts` | CP-DLG-13 | CP-DLG-14 | CP-DLG-15 "Kräv PIN på alla" | CP-SEC-16 |

Gemensamt: sekundär CP-DLG-16 "Avbryt"; pending CP-DLG-17 "Loggar ut…" / CP-DLG-18 "Återkallar…" (Avbryt + `Esc` låsta); failure CP-DLG-19 (dialogen kvar, inget ändrat); idempotens = redan utloggad/återkallad behandlas som success. Efter lyckad `logout-current`: hela vyn ersätts av utloggad-ytan i recovery-skalet — CP-DLG-20 "Du är utloggad" + primär CP-DLG-21 "Få en ny kod" → `/aterhamta/[tenantSlug]` + CP-DLG-22/23; ingen nav, inga andra CTA:er.

Avbokningens destruktiva dialog (`CancelBookingDialog`, CP-CAN-01–13) spåras i §8 — samma skalkontrakt, egen copy-serie.

## 16. PWA — manifest, scope och installations-statemaskin

**Manifest (bindande, COMPONENTS §23):** `name` = exakt "Mina bokningar · Corevo"; `short_name` = exakt "Mina bokningar"; `id`/`start_url`/`scope` = `/mina/`; `display: standalone`; Corevos neutrala appikon. Ingen persondata, tenantdata eller state-query — avvikelse = FAIL. Serveras via manifest-routen i filkartan (§20).

**Erbjudande-maskinen (sluten, per enhet — max TVÅ verkliga automatiska erbjudanden någonsin):** `unsupported` → `standalone` → `eligible` → `prompted_once` → `dismissed_once` → `prompted_twice` → `dismissed_twice` / `accepted` (COMPONENTS §23-matrisen). Räknaren följer enheten, nollställs aldrig vid utloggning; `/mina/installera` räknas aldrig och är alltid nåbar, även efter `dismissed_twice`. Kortet ligger ALLTID efter bokningsinnehållet på `/mina`.

Miljövarianter (kanoniska, blandning = FAIL):

| Miljö | Kort-copy | CTA-kontrakt |
|---|---|---|
| Android/Chromium med `beforeinstallprompt` | CP-PWA-01/02 | CP-PWA-03 "Lägg på hemskärmen" — native-prompten anropas ENDAST som direkt svar på klick; avböj CP-PWA-04 "Inte nu"; offline: CTA `aria-disabled` + CP-PWA-06. |
| Chromium utan event | CP-PWA-01/02 | ENDAST länken CP-PWA-05 "Så installerar du" — aldrig en knapp som låtsas installera. |
| iOS Safari | CP-PWA-01/02 | CP-IOS-01 "Visa hur" → `IosInstallGuide`: CP-IOS-02 rubrik + tre låsta iOS-ordagranna steg CP-IOS-03/04/05 + CP-IOS-06 + stäng CP-IOS-07 (utgår inline). |
| In-app-webbläsare | CP-APP-01 | CP-APP-02 "Kopiera länken" → CP-APP-03; steg CP-APP-04–06; CP-APP-07 "Öppna i Safari" ENDAST vid verifierat fungerande systemåtgärd; urklippsfel CP-APP-08. |
| `standalone` | — | Allt döljs på `/mina`; `/mina/installera` visar CP-INST-03 "Appen är installerad." |
| `unsupported` | — | Inget på `/mina`; `/mina/installera` visar CP-INST-02. |

**Sidan `/mina/installera`:** dokumenttitel CP-INST-01; exakt en h1 = **CP-INST-04 "Installera på hemskärmen"**; kortets rubrik CP-PWA-01 ligger därunder som h2; ingen "Inte nu" (§4.10). **Offline:** felytan CP-OFF-01–03 ERSÄTTER innehållet — ingen personlig data ur cache; statiskt skal får synas. Utgången session i standalone → återhämtningsvyn med toast CP-REC-11, aldrig vit skärm/loop/login.

## 17. Kundsynligt datakontrakt (brief §22 — designen får bara anta dessa fält)

| Entitet | Fält (`?` = optional → raden döljs helt, ingen platshållare) |
|---|---|
| **Företag** | `name`, `slug`, `logoUrl?`, `verticalLabel?`, `phone?`, `address?`, `mapUrl?`, `bookingOrigin`, `timezone`, `locale`, `defaultCountry`, `currency`, `cancellationCutoffHours` |
| **Kundrelation** | `displayName`, `verifiedContact` (union §13), `phoneMasked?`, `phoneVerified?`, `emailMasked?`, `emailVerified?`, `tenantId` (aldrig renderat), `customerId` (aldrig renderat) |
| **Bokning** | `id` (endast route, aldrig synlig säkerhet), `status`, `startTs`, `endTs`, `serviceName`, `durationMinutes?`, `staffTitle?`, `location?`, `priceCents?`, `priceLabel?`, `currency`, `customerVisibleNote?`, `canCancel`, `cancelDeadline?`, `publicRebookUrl?` |
| **Plats (`location`)** | null ELLER `{ name?, address?, phone?, mapUrl?, timezone }` — bokningskort/detalj använder ALLTID bokningens platsobjekt; företagshuvudet använder företagets centrala kontakt. Saknar `locations` publik telefon/kartlänk i aktuell DB krävs målmigration/adminfält innan knapparna aktiveras; annars döljs respektive action. |
| **Session/enhet** | `id` (aldrig synligt), `label`, `isCurrent`, `createdAt`, `lastSeenAt`, `revocable` |

Bindande regler: saknade optionalfält döljer sin rad med bevarad ordning; ingen fabricerad fallbackdata som ser verklig ut; pris aldrig fabricerat (Nordverk bevisar dold prisrad, §6.2); `publicRebookUrl` saknas → `BookAgainButton` renderas inte. Exponeringsreglerna i COPY §25 (inga UUID/tokens/PIN i klartext, alltid maskerade destinationer, opersonligt fel-ID) gäller varje rendering.

## 18. Komponent → route → COPY-ID (alla 28 namngivna komponenter)

Kompletterar COMPONENTS §28 med copy-spårning. En komponent utanför listan = FAIL (COMPONENTS §29).

| # | Komponent | Route/host | COPY-ID:n |
|---|---|---|---|
| 1 | CustomerPortalShell | portal: alla `/mina*` + recovery-routes | CP-SHELL-01/02 |
| 2 | CustomerPortalTopbar | portal: alla routes | CP-TOP-01–05 |
| 3 | CustomerPortalNavigation | portal: alla utom recovery | CP-NAV-01–04 |
| 4 | PrototypeFixtureControl | alla prototypsidor (ALDRIG produkt) | ingen CP-serie ("PROTOTYP"-copy är prototypmarkör, ej produktsträng) |
| 5 | TenantIdentityCard | `/mina` (+ `/mina/historik`) | CP-TID-01–07 |
| 6 | NextBookingCard | `/mina` | CP-HOME-01–11, 14–19, 20–22 |
| 7 | UpcomingBookingList | `/mina` | CP-HOME-12/13 |
| 8 | BookingHistoryList | `/mina/historik` | CP-HIST-01–11 |
| 9 | BookingStatusChip | inbäddad (§8-matrisen) | CP-STATUS-01–07 |
| 10 | BookingDetail | `/mina/bokningar/[id]` | CP-DET-01–19 |
| 11 | CancelBookingDialog | overlay på detalj | CP-CAN-01–13 |
| 12 | CalendarDownloadButton | detalj (portal) + steg 5 (tenant) | CP-CAL-01–04 |
| 13 | BookAgainButton | §6/§10/§15-värdytor | CP-AGAIN-01–03 |
| 14 | PinVerificationForm | tenanthost steg 4; `/verifiera/[tenantSlug]` | CP-PIN-01–21 (booking); CP-VER-01–15 (recovery) |
| 15 | BookingStepFive | tenanthost steg 5 | CP-S5-01–18 |
| 16 | RecoveryForm | `/aterhamta/[tenantSlug]` | CP-REC-01–11 |
| 17 | CustomerProfileCard | `/mina/profil` | CP-PROF-01–14, CP-NAME-01–07 |
| 18 | VerifiedContactCard | inuti CustomerProfileCard | CP-VC-01–08 |
| 19 | ContactChangeFlow | overlay på `/mina/profil` | CP-CCF-01–41 |
| 20 | PortalSessionList | `/mina/sakerhet` | CP-SEC-01–12 |
| 21 | BookingTrustList | `/mina/sakerhet` | CP-SEC-13–20 |
| 22 | DestructiveActionDialog | overlay `/mina/sakerhet` + `/mina/profil` | CP-DLG-01–23 |
| 23 | InstallPromptCard | `/mina` (auto) + `/mina/installera` (page) | CP-PWA-01–06, CP-APP-01–08, CP-IOS-01, CP-INST-01–04 |
| 24 | IosInstallGuide | sheet från §23; inline på `/mina/installera` | CP-IOS-02–07 |
| 25 | PortalEmptyState | inuti värdytor | CP-HOME-14–17, CP-HIST-06, CP-SEC-17 (register COPY §22.2) |
| 26 | PortalErrorState | inuti värdytor eller hela `<main>` | CP-ERR-01–05, CP-OFF-01–03, CP-DET-18 + fetch-ytnamnen CP-HOME-20/CP-HIST-10/CP-PROF-06/CP-SEC-11/19/CP-DET-16 |
| 27 | PortalSkeleton | inuti värdytor (loading) | CP-SKEL-01 |
| 28 | PortalBootstrap | `/oppna/[tenantSlug]#<token>` | CP-BOOT-01–14 |

Aria-/live-registret (CP-A11Y-01–05 + live-regionslistan) och negativlistan (CP-NEG-01–12) gäller tvärs alla rader.

## 19. Accessibility- och responsiv acceptans (brief §20/§21)

**Tillgänglighet (WCAG 2.2 AA minimum):** full tangentbordsnavigation i logisk DOM-ordning; skip-länk CP-SHELL-01 först; exakt en synlig h1 per vy med korrekt hierarki; status aldrig enbart färg (CP-STATUS + ikonform); ikonknappar med tillgängligt namn (CP-A11Y-registret); formfel via `aria-describedby`; bekräftelser `role="status"`/`aria-live="polite"` och fel `role="alert"` exakt enligt live-regionslistan i COPY §23 — aggressiv alert för icke-fel = FAIL; dialoger med `role="dialog"`, fokusfälla, `Esc` och fokusåtergång; begripliga datum för skärmläsare; pekytor ≥44×44px; 200 % zoom, landscape på liten mobil och textförstoring fungerar; `prefers-reduced-motion`, `prefers-contrast` och forced colors kontrolleras; skeletons `aria-hidden` med ETT statiskt textalternativ (CP-SKEL-01), noll live-spam.

**Responsivt (bindande viewports, §5):** 320×568, 390×844, 430×932, 768×1024, 1024×768, 1440×900. Vid alla bredder: ingen horisontell scroll; nästa bokning + primär handling synliga utan onödigt tomrum; bottennav täcker aldrig innehåll; dialog/sheet ryms med tangentbord öppet; långa företags-/tjänste-/personalnamn bryts eller trunkeras med fulltext tillgänglig (Nordverk-tjänsten är testfallet, §6.2); svenska datum och priser får plats; layouten fungerar utan logotyp och utan hero-bild.

## 20. Filkarta för implementation (exakt brief §24)

Designfasen ändrar INGEN produktkod — kartan nedan är målstrukturen som designspecens komponentnamn ska matcha mekaniskt (brief §24 ingress); prototyperna är statiska filer i detta paket. Feature-flaggning/samexistens med gamla `/konto` styrs av brief §26.

**Routes (brief §24.1):**

- `5-Kod/apps/web/app/(customer-portal)/(open)/oppna/[tenantSlug]/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/(open)/aterhamta/[tenantSlug]/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/(open)/verifiera/[tenantSlug]/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/(open)/hjalp/page.tsx`
- `5-Kod/apps/web/app/(customer-portal)/mina/layout.tsx` + `page.tsx`, `historik/page.tsx`, `bokningar/[id]/page.tsx`, `profil/page.tsx`, `sakerhet/page.tsx`, `installera/page.tsx`, `integritet/page.tsx`
- API: `app/api/customer-portal/exchange/route.ts`, `app/api/customer-portal/manifest/route.ts`, `app/api/customer-portal/bookings/[id]/calendar/route.ts`

**Domänlogik/DAL (brief §24.2):** `lib/customer-portal/session.ts`, `link.ts`, `data.ts`, `actions.ts`, `recovery.ts`, `origin.ts`; `customer_portal` klassificeras i `lib/tenant.ts` FÖRE generisk tenantklassificering (`lib/auth/host-routing.ts` är backoffice-only och äger inte denna host); sluggen `mina` reserveras med eget beslutsträd i `lib/customer-portal/host-routing.ts`.

**Hostfence (brief §24.2, bindande):** `middleware.ts` utökas med dubbelriktad fence — portalroutes och portal-API serveras ENDAST på portalhosten; `/admin`, `/personal`, `/platform`, storefront och vanliga loginroutes serveras ALDRIG där. Portalhost-env, fasta hostlistor, domän-/deployvalidatorer och `mina.corevo.se` som explicit återassertad Cloudflare-route läggs först efter driftgodkännande; hosttester för produktion, preview, tenant-subdomän, custom domain och alla backofficehosts.

**Komponenter (brief §24.3):** de 22 komponentnamnen ur brieflistan + de sex flödes-/verktygskomponenterna (COMPONENTS §29) i `5-Kod/apps/web/components/customer-portal/` med samlad CSS module eller dokumenterade delmoduler i samma mapp — samma namn i design och kod så jämförelsen blir mekanisk.

**Återanvändning (brief §24.4):** extrahera rena delar ur `lib/kund/format.ts` (efter auth-kontroll), `components/kund/AccountBookings.tsx`/`AccountHistory.tsx` (mönster, inte authkopplade props), `CancelButton.tsx` (serverbeteende säkras, UI enligt nya dialogen), ren ICS-logik (aldrig personal-DAL) och neutrala maskable PWA-ikoner. `public/kund-sw.js` återanvänds INTE; en eventuell v1-worker är separat, har scope `/mina/`, använder network-only för portalsidor och cachar endast opersonligt statiskt skal/offlinefallback. `RebookPanel.tsx` bevaras för gamla `/konto`. FÅR INTE återanvändas som säkerhetslager: `requirePortal('kund')`, Supabase Auth-session för kundkonton, `customer_profile_id` som ensam ägarskapskontroll, `/konto/koppla/[token]`-GET-konsumtion, service-role-queries utan atomiskt tenant-/customer-/sessionkontrakt.

## 21. Öppen säkerhetsblockerare (bindande före produktion)

**corevo-sms lagrar i dag meddelande-body i klartext (inkl. backuper).** Briefens leveranskedja (§25.2) kräver att transporten persistar recipient och body med autentiserad kryptering innan `gateway_persisted` bekräftas — så länge klartextlagring/okrypterade backuper finns får INGA riktiga PIN-koder eller portal-tokens skickas genom kedjan i produktion. Kryptering/redigering av body och backuper är därmed en hård blockerare för driftsättning av boknings-PIN (§9), portallänkarna (§7) och recovery-utskicken (§4.2–4.3).

Designfasen får mocka hela utskickskedjan (fixturdata, simulerade gatewaystatusar i §10-matrisen) — men designpaketet får ALDRIG markera PIN-/portalflödena som driftklara förrän blockeraren är åtgärdad och verifierad. Statusen spåras som öppen rad i `ACCEPTANCE-MATRIX.md`.

---

# SPEC del 3 — Prototypindex, flöden, state-täckning och design-done

**Omfattning del 3:** exakt skärminventarium för de tre prototypfilerna; klickbara huvudflöden som numrerade sekvenser; komplett state-täckningstabell för varje namngivet tillstånd i briefens §18; desktop/mobil-paritetsmatris; testviewport-matris; kraven på lokalt självbärande HTML; definition av design-done; samt den slutliga no-scope-leak-checklistan. Del 3 inför inga nya routes, komponenter, states eller strängar — allt refererar §1–§21 samt brief/TOKENS/COMPONENTS/COPY enligt kanonordningen §1.1.

**Filförkortningar (bindande):** `MOBIL` = `Kundportal Passwordless Mobil.dc.html`; `DESKTOP` = `Kundportal Passwordless Desktop.dc.html`; `STATES` = `Kundportal Passwordless States.dc.html`.

**Selektorkonvention (bindande för alla tre filerna):** varje skärmyta bär `data-screen="<skärm-id>"`; varje verifierbart tillstånd bär `data-state="<state-id>"` på skärm­ytans rotelement. Acceptansprobe adresserar alltid `[data-screen="…"][data-state="…"]` — ett tillstånd utan träffbar selektor = FAIL. Skärm-id:n och state-id:n nedan är slutna listor.

---

## 22. Exakt skärminventarium per prototypfil

### 22.1 `MOBIL` — interaktiv mobilprototyp (viewportram 390×844 som standard)

Sluten lista — en skärm utanför tabellen = FAIL; en saknad skärm = FAIL.

| # | `data-screen` | Route/yta (§3–§4) | Shell | Innehåll |
|---|---|---|---|---|
| 1 | `bootstrap` | `/oppna/[tenantSlug]#<token>` (§4.1) | recovery, ingen nav | CP-BOOT-01/02 + PortalSkeleton |
| 2 | `aterhamta` | `/aterhamta/[tenantSlug]` (§4.2) | recovery | RecoveryForm CP-REC-01–07 |
| 3 | `verifiera` | `/verifiera/[tenantSlug]` (§4.3) | recovery | PinVerificationForm `mode="recovery"` |
| 4 | `hjalp` | `/hjalp` (§4.4) | recovery/standard | CP-HELP-01–05 |
| 5 | `mina` | `/mina` (§4.5) | standard + bottennav | TenantIdentityCard, NextBookingCard, UpcomingBookingList, BookAgainButton, InstallPromptCard |
| 6 | `historik` | `/mina/historik` (§4.6) | standard + bottennav | BookingHistoryList, tre sektioner CP-HIST-02/03/04 |
| 7 | `detalj` | `/mina/bokningar/[id]` (§4.7) | standard, topbar i detaljläge (CP-TOP-04) | BookingDetail + CancelBookingDialog-overlay |
| 8 | `profil` | `/mina/profil` (§4.8) | standard + bottennav | CustomerProfileCard, VerifiedContactCard, ContactChangeFlow-overlay |
| 9 | `sakerhet` | `/mina/sakerhet` (§4.9) | standard + bottennav | PortalSessionList, BookingTrustList, DestructiveActionDialog-overlay |
| 10 | `installera` | `/mina/installera` (§4.10) | standard + bottennav | InstallPromptCard `placement="page"`, IosInstallGuide inline |
| 11 | `integritet` | `/mina/integritet` (§4.11) | standard + bottennav | CP-PRIV-01–05 |
| 12 | `steg4-pin` | tenanthost steg 4 (§9) | tenantens bokningsflödesram, INGEN portal-shell | PinVerificationForm `mode="booking"` |
| 13 | `steg5` | tenanthost steg 5 (§10) | tenantens bokningsflödesram | BookingStepFive, huvudspår + felspår |
| 14 | `utloggad` | efter `logout-current` (§15) | recovery, ingen nav | CP-DLG-20–23 |

`PrototypeFixtureControl` renderas sist i DOM på varje skärm (§4 ingress) — tydligt märkt "PROTOTYP", aldrig del av skärmens innehållsyta. Nordverk visas minst i `detalj` (§6.2-fältkraven).

### 22.2 `DESKTOP` — interaktiv desktopprototyp (viewportram 1440×900 som standard)

Identisk skärmlista som `MOBIL` (`data-screen` 1–14, samma id:n) — men renderad enligt §5-desktopreglerna: topbar 56px med CP-TOP-05, vänsternav 232px (`--col-left`), huvudkolumn 680px, högerkolumn 288px, ingen bottennav. Recovery-/tenantskärmar (`bootstrap`, `aterhamta`, `verifiera`, `utloggad`, `steg4-pin`, `steg5`) använder ALDRIG trekolumnslayouten (§4.2). Skärmar med högerkolumnstöd: `mina` (företagskontakt/installation/hjälp, §4.5), `detalj` (plats-block ≥1248px, §4.7) — DOM-ordningen identisk med mobil. Inga skärmar tillkommer, inga utgår.

### 22.3 `STATES` — tillståndsgalleri

Galleriet visar varje rad i §24-tabellen som en separat, statiskt renderad yta grupperad per briefens §18-område, i briefens ordning: **Bootstrap → Länk → PIN bokning → Steg 5 → Återhämtning → Portal → Bokningar → Historik → Detalj → Avbokning → Kalender → Profil → Kontaktbyte → Säkerhet → PWA**. Varje yta bär `data-screen` + `data-state` enligt §24 och en synlig etikett `[Område] — [tillstånd]` (galleri-metatext, ej produktcopy). Fixtur per yta enligt §24:s komponentkolumn; e-postspåren (CP-PIN-06/07, CP-VER-04, `verifiedContact: email`) visas med Nordverk (§6.2).

---

## 23. Klickbara huvudflöden (numrerade sekvenser, bindande)

Varje flöde ska vara klickbart i `MOBIL` och `DESKTOP` (samma steg, §25). "→" = användarens klick/inmatning; simulerade serversvar styrs av prototypens interna state, aldrig nätverk (§27).

**F1. Bootstrap → detalj (huvudvägen in):**
1. `bootstrap` visar CP-BOOT-01/02 + skeleton → 2. simulerat lyckat utbyte → 3. `replace`-navigering till `detalj` för bokningen som skapade länken (adressraden i prototypen visas tokenfri, §7.2) → 4. "Tillbaka" (CP-DET-01) → `mina`.

**F2. Navigering (tre poster, §5):**
1. `mina` → 2. bottennav/vänsternav **Historik** (CP-NAV-03) → `historik` → 3. **Profil** (CP-NAV-04) → `profil` → 4. **Bokningar** (CP-NAV-02) → `mina`. Aktiv post markeras per §5; fokus flyttas till `<main>`/h1 vid varje byte.

**F3. Avbokning — lyckad:**
1. `detalj` (aktiv, `canCancel`) → 2. CP-DET-10 "Avboka bokningen" → CancelBookingDialog (CP-CAN-01–05) → 3. destruktiv CTA → pending "Avbokar…" (allt låst) → 4. lyckad: dialog stängs, chip → Avbokad (CP-STATUS-04), success-annons, avboka-knappen borta.

**F4. Avbokning — misslyckad:**
1–3 som F3 → 4a. nätverksfel: dialogen kvar, felrad `role="alert"`, "Din bokning är oförändrad." (CP-CAN-serien) → försök igen möjligt; ELLER 4b. policy ändrad under dialogen: ingen mutation + CP-CAN-11/12; ELLER 4c. redan avbokad: idempotent success (CP-CAN-13).

**F5. Kalenderexport:**
1. `detalj` → 2. CP-DET-08 "Lägg i kalender" → pending "Hämtar…" → 3a. lyckad CP-CAL-03; 3b. fel CP-CAL-04 (ägarskapsfel = exakt samma text, §8).

**F6. Profil — namnredigering:**
1. `profil` → 2. CP-PROF-05 "Ändra" → inline-redigering CP-NAME-01 → 3. ogiltigt värde → CP-NAME-04; giltigt → CP-NAME-03 "Spara" → pending CP-NAME-05 → 4. toast CP-NAME-06; ELLER CP-NAME-02 "Avbryt" → oförändrat.

**F7. Dubbelverifierat kontaktbyte (§14):**
1. `profil` → en av de serverstyrda åtgärderna CP-VC-06 `change_phone`, CP-VC-07 `add_phone` eller CP-VC-08 `change_email` → 2. steg 1 CP-CCF-03–06 → 3. steg 2 step-up-kod (CP-CCF-10–17) → 4. steg 3 kanalbunden ny destination: telefon CP-CCF-20/21/33 eller e-post CP-CCF-34/35, gemensamt CP-CCF-22/23 → 5. steg 4 ny kod CP-CCF-24–28 → 6. åtgärdsspecifikt kvitto CP-CCF-30 eller CP-CCF-36/37 + CP-CCF-31/32 → 7. "Stäng" → §13-kortet visar nya värdet FÖRST nu. Efter `add_phone` är mobilen primär och tidigare verifierad e-post maskerad reservkontakt. Avvikelsegrenar i galleri: CP-CCF-08 (kanal ej åtkomlig), CP-CCF-29 (telefonkonflikt), CP-CCF-38 (e-postkonflikt), CP-CCF-18/19 (step-up-fönster ute).

**F8. Session-/trust-återkallelse (§15):**
1. `sakerhet` → 2. CP-SEC-07 → dialog `logout-other` → destruktiv CTA → pending CP-DLG-17 → raden borta + CP-SEC-10 → 3. CP-SEC-15 → dialog `revoke-trust` → CP-DLG-12 → pending CP-DLG-18 → posten borta + CP-SEC-18 → 4. CP-SEC-08 "Logga ut här" → dialog `logout-current` → CP-DLG-09 → `utloggad`-ytan (CP-DLG-20–23) → 5. CP-DLG-21 "Få en ny kod" → `aterhamta`.

**F9. Android-installation:**
1. `mina` med InstallPromptCard (`eligible`) → 2. CP-PWA-03 "Lägg på hemskärmen" → simulerad native-prompt ENDAST som svar på klicket → 3a. accepterad → `accepted` (kortet borta); 3b. CP-PWA-04 "Inte nu" → `dismissed_once` (§16-maskinen).

**F10. iOS/in-app:**
1. `installera` (iOS Safari-fixtur) → 2. CP-IOS-01 "Visa hur" → IosInstallGuide inline CP-IOS-02–06 → 3. fixturbyte till in-app-webbläsare → CP-APP-01 + CP-APP-02 "Kopiera länken" → CP-APP-03 + steg CP-APP-04–06.

**F11. Återhämtning:**
1. `aterhamta` → 2. inmatning + CP-REC-05 "Skicka kod" → pending CP-REC-06 → 3. `verifiera` — neutral kanalrad CP-VER-02, sedan maskerad rad CP-VER-03 (FreshCut/SMS) eller CP-VER-04 (Nordverk/e-post) → 4. kod + CP-VER-06 "Verifiera" → pending CP-VER-07 → 5. `verified` CP-VER-15 → replace-navigering till `mina`.

**F12. Tenanthost PIN → steg 5 (§9–§10):**
1. `steg4-pin` `sending` CP-PIN-03 → 2. `sent_sms` CP-PIN-04/05 (fixturbyte: `sent_email` CP-PIN-06/07) → 3. fel kod CP-PIN-10 → rätt kod → pending CP-PIN-09 → 4. `verified` CP-PIN-20 → automatisk vidaregång → 5. `steg5` huvudspår CP-S5-01–09 → CP-S5-04 "Lägg i kalender" och CP-S5-05 klickbara → 6. avvikelsegrenar i galleri: `delivery_failed` (CP-S5-10–14), `unknown` (CP-S5-15), felspåret CP-S5-16–18, `slot_lost` (CP-PIN-18/19).

**F13. Fixturväxling:**
1. valfri skärm → 2. `PrototypeFixtureControl` → växla FreshCut ↔ Nordverk → 3. atomärt byte (§6): namn, logotyp, bransch, kanal, personal, tjänst, pris och platser byts i sin helhet — blandat läge = FAIL → 4. `detalj` med Nordverk bevisar: e-postkanal, "Valfri personal", långt tjänstenamn, dold prisrad, plats ur BOKNINGEN.

---

## 24. Komplett state-täckningstabell (brief §18 — varje rad = en yta i `STATES`)

Kolumner: **State-ID** (slutet register, återanvänds i `ACCEPTANCE-MATRIX.md`) · **Fil + selektor** · **Komponent** (§18-listan) · **COPY-ID** · **Förväntad interaktion**. Selektor = `[data-screen][data-state]` (§22 ingress). "MOBIL/DESKTOP + STATES" betyder att tillståndet dessutom är nåbart i flödesprototyperna; alla rader finns ALLTID i `STATES`.

### 24.1 Bootstrap (`data-screen="bootstrap"`)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-BOOT-01 | STATES + MOBIL/DESKTOP; `[data-screen="bootstrap"][data-state="checking"]` | PortalBootstrap + PortalSkeleton | CP-BOOT-01/02, CP-SKEL-01 | Ingen interaktion; neutral spinner/skeleton; ingen CTA (§4.1) |
| ST-BOOT-02 | STATES + MOBIL/DESKTOP (F1); `…[data-state="redirect"]` | PortalBootstrap | ingen egen copy | Simulerad `replace`-navigering till detalj/`/mina`; tokenfri adress (§7.2) |
| ST-BOOT-03 | STATES; `…[data-state="no_js"]` | PortalBootstrap `<noscript>` | CP-BOOT-03–07 | Tre fungerande länkar: ny kod / bokningssida / hjälp (§7.4) |

### 24.2 Länk (`data-screen="bootstrap"`, §7.3-lägena)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-LINK-01 | STATES; `…[data-state="invalid"]` | PortalBootstrap | CP-BOOT-10–14 | EN gemensam yta; primär CP-BOOT-12 → `aterhamta`; sekundär CP-BOOT-13 |
| ST-LINK-02 | STATES; `…[data-state="expired"]` | PortalBootstrap | CP-BOOT-10–14 | EXAKT samma yta som ST-LINK-01 — fallen skiljs aldrig åt (§7.3) |
| ST-LINK-03 | STATES; `…[data-state="used_with_session"]` | PortalBootstrap | ingen copy | Öppnar rätt bokning direkt utan ny PIN (§4.1) |
| ST-LINK-04 | STATES; `…[data-state="used_no_session"]` | PortalBootstrap | CP-BOOT-08/09 | Primär CP-BOOT-09 "Skicka ny kod" → `aterhamta` |
| ST-LINK-05 | STATES; `…[data-state="revoked"]` | PortalBootstrap | CP-BOOT-10–14 | EXAKT samma yta som ST-LINK-01/02 |

### 24.3 PIN bokning (`data-screen="steg4-pin"`, §9)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-PIN-01 | STATES + MOBIL/DESKTOP (F12); `[data-screen="steg4-pin"][data-state="sending"]` | PinVerificationForm (booking) | CP-PIN-03 | `aria-live="polite"`; fält + Verifiera låsta |
| ST-PIN-02 | STATES + F12; `…[data-state="sent_sms"]` | PinVerificationForm | CP-PIN-04/05 | Autofokus i kodfältet; "Ändra mobilnummer"-länk |
| ST-PIN-03 | STATES + F13; `…[data-state="sent_email"]` | PinVerificationForm | CP-PIN-06/07 | Nordverk-fixtur; maskerad e-postrad |
| ST-PIN-04 | STATES + F12; `…[data-state="invalid"]` | PinVerificationForm | CP-PIN-10 | `role="alert"`; värdet kvar; fokus åter i fältet |
| ST-PIN-05 | STATES; `…[data-state="cooldown"]` | PinVerificationForm | CP-PIN-11 | Nedräkning `aria-live="polite"`; ingen fokusstöld |
| ST-PIN-06 | STATES; `…[data-state="resend_ready"]` | PinVerificationForm | CP-PIN-12/13 | "Skicka ny kod" → bekräftelse; gammal kod ogiltig |
| ST-PIN-07 | STATES; `…[data-state="expired"]` | PinVerificationForm | CP-PIN-14 | Verifiera låst tills ny kod begärts |
| ST-PIN-08 | STATES; `…[data-state="max_attempts"]` | PinVerificationForm | CP-PIN-15 | Challenge låst; ingen bokning skapas |
| ST-PIN-09 | STATES; `…[data-state="delivery_failed"]` | PinVerificationForm | CP-PIN-16 (SMS) / CP-PIN-17 (e-post) | Kanalriktig felrad; omskick möjligt |
| ST-PIN-10 | STATES; `…[data-state="slot_lost"]` | PinVerificationForm | CP-PIN-18/19 | Ersättningsyta; "Välj en ny tid"; ingen kodinmatning kvar |
| ST-PIN-11 | STATES + F12; `…[data-state="verified"]` | PinVerificationForm | CP-PIN-20 | `role="status"`; automatisk vidaregång till steg 5 |

### 24.4 Steg 5 (`data-screen="steg5"`, §10)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-S5-01 | STATES + F12; `[data-screen="steg5"][data-state="delivered"]` | BookingStepFive | CP-S5-01–06, CP-S5-08/09 | Kalender-CTA (CP-S5-04) + BookAgainButton (CP-S5-05) klickbara |
| ST-S5-02 | STATES; `…[data-state="gateway_persisted"]` | BookingStepFive | CP-S5-01–07 | `role="status"`; rubriken förblir "Bokningen är klar" |
| ST-S5-03 | STATES; `…[data-state="delivery_failed"]` | BookingStepFive | CP-S5-01–06, CP-S5-10–14 | Felrad `role="alert"` + idempotent "Skicka bekräftelsen igen" (pending/cooldown) |
| ST-S5-04 | STATES; `…[data-state="failed"]` | BookingStepFive (felspår) | CP-S5-16–18 | Egen layout; ingen sammanfattning, ingen kalender-CTA, ingen "klar"-formulering |

### 24.5 Återhämtning (`data-screen="aterhamta"` / `"verifiera"`, §4.2–§4.3)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-REC-01 | STATES + F11; `[data-screen="aterhamta"][data-state="default"]` | RecoveryForm | CP-REC-01–05, CP-REC-07 | ETT fält; klientvalidering CP-REC-04 vid ogiltig inmatning |
| ST-REC-02 | STATES + F11; `[data-screen="verifiera"][data-state="sent_sms"]` | PinVerificationForm (recovery) | CP-VER-01/02/03/05 | Servervald SMS-kanal; maskerad rad endast efter utskick |
| ST-REC-03 | STATES + F13; `[data-screen="verifiera"][data-state="sent_email"]` | PinVerificationForm | CP-VER-01/02/04/05 | Servervald e-postkanal (Nordverk) |
| ST-REC-04 | STATES + F11; `[data-screen="aterhamta"][data-state="pending"]` | RecoveryForm | CP-REC-06 | "Skickar…"; knapp låst |
| ST-REC-05 | STATES; `[data-screen="verifiera"][data-state="sending"]` | PinVerificationForm | CP-VER-02 | Kod skickas; fält låsta |
| ST-REC-06 | STATES; `[data-screen="verifiera"][data-state="invalid"]` | PinVerificationForm | CP-VER-08 | `role="alert"`; fokus åter i fältet |
| ST-REC-07 | STATES; `[data-screen="verifiera"][data-state="cooldown"]` | PinVerificationForm | CP-VER-09 | Nedräkning; jfr ST-PIN-05 |
| ST-REC-08 | STATES; `[data-screen="verifiera"][data-state="expired"]` | PinVerificationForm | CP-VER-12 | Ny kod krävs |
| ST-REC-09 | STATES; `[data-screen="verifiera"][data-state="max_attempts"]` | PinVerificationForm | CP-VER-13 | Challenge låst; jfr CP-REC-10 på `aterhamta` |
| ST-REC-10 | STATES; `[data-screen="verifiera"][data-state="delivery_failed"]` | PinVerificationForm | CP-VER-14 | Kanalneutral felrad (§4.3) |
| ST-REC-11 | STATES + F11; `[data-screen="verifiera"][data-state="verified"]` | PinVerificationForm | CP-VER-15 | Portalsession + replace till `/mina` |

### 24.6 Portal (skal-tillstånd, `data-screen="mina"` om ej annat anges)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-PORT-01 | STATES; `[data-screen="mina"][data-state="loading"]` | PortalSkeleton | CP-SKEL-01 | Skeletons `aria-hidden`, ETT statiskt textalternativ, noll live-spam |
| ST-PORT-02 | STATES + MOBIL/DESKTOP; `…[data-state="normal"]` | CustomerPortalShell m.fl. | §4.5-serien | Fullt interaktiv startsida |
| ST-PORT-03 | STATES; `…[data-state="session_expired"]` | CustomerPortalShell → recovery | CP-REC-11 | ALLTID till `aterhamta` med toast — aldrig login-vy (§2.5) |
| ST-PORT-04 | STATES; `…[data-state="server_error"]` | PortalErrorState | CP-ERR-01–05 | Felyta i `<main>`; retry-CTA; inga databastermer |
| ST-PORT-05 | STATES; `…[data-state="offline"]` | PortalErrorState | CP-OFF-01–03 | Ersätter innehållet; ingen personlig cache-data (§16) |

### 24.7 Bokningar (`data-screen="mina"`, §4.5)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-HOME-01 | STATES + MOBIL/DESKTOP; `…[data-state="one_upcoming"]` | NextBookingCard | CP-HOME-01–11 | CP-HOME-08 → detalj; kalender; avboka endast om tillåtet |
| ST-HOME-02 | STATES; `…[data-state="many_upcoming"]` | NextBookingCard + UpcomingBookingList | + CP-HOME-12/13 | "Fler kommande" endast vid ≥2; rader → detalj |
| ST-HOME-03 | STATES; `…[data-state="empty"]` | PortalEmptyState | CP-HOME-14–19 | CP-HOME-17 "Boka ny tid" → tenantens `/boka` |
| ST-HOME-04 | STATES; `…[data-state="pending_request"]` | BookingStatusChip | CP-STATUS-01 | Chip `--warning`; handlingar enligt §8-matrisen |
| ST-HOME-05 | STATES; `…[data-state="cancelled"]` | BookingStatusChip | CP-STATUS-04 | Chip `--negative`; ALDRIG avboka-knapp |

### 24.8 Historik (`data-screen="historik"`, §4.6)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-HIST-01 | STATES + MOBIL/DESKTOP; `…[data-state="normal"]` | BookingHistoryList | CP-HIST-01–05 | Tre sektioner i exakt ordning; rader → detalj |
| ST-HIST-02 | STATES; `…[data-state="empty"]` | PortalEmptyState | CP-HIST-06 | Enbart tomtext; inget lånat tomläge (§8) |
| ST-HIST-03 | STATES; `…[data-state="loading_more"]` | BookingHistoryList | CP-HIST-07/08 | "Visa fler" → pending; max 20 rader per sida |
| ST-HIST-04 | STATES; `…[data-state="more_failed"]` | BookingHistoryList + PortalErrorState | CP-HIST-09 | Fel vid fler; lista intakt; retry |

### 24.9 Detalj (`data-screen="detalj"`, §4.7)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-DET-01 | STATES + MOBIL/DESKTOP; `…[data-state="active"]` | BookingDetail | CP-DET-01–10 | Kalender, Boka en tid till, Avboka (dialog) |
| ST-DET-02 | STATES; `…[data-state="policy_blocked"]` | BookingDetail | CP-DET-12–15 | Spärrförklaring — aldrig en död knapp (§8) |
| ST-DET-03 | STATES; `…[data-state="cancelled"]` | BookingDetail + chip | CP-STATUS-04, CP-DET-11 | Boka igen om tjänsten publik; ingen avbokning |
| ST-DET-04 | STATES; `…[data-state="completed"]` | BookingDetail + chip | CP-STATUS-03, CP-DET-11 | Historisk vy; Boka igen om publik |
| ST-DET-05 | STATES; `…[data-state="no_show"]` | BookingDetail + chip | CP-STATUS-05 | Ingen mutation |
| ST-DET-06 | STATES; `…[data-state="not_found"]` | PortalErrorState | CP-DET-18/19 | Neutral ägarskaps-404 — EXAKT samma yta för fel id/annan kund/fel tenant |

### 24.10 Avbokning (`CancelBookingDialog` som overlay på `detalj`)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-CAN-01 | STATES + F3; `[data-screen="detalj"][data-state="cancel_dialog"]` | CancelBookingDialog | CP-CAN-01–05 | `role="dialog"`, fokusfälla, `Esc` = Avbryt |
| ST-CAN-02 | STATES + F3; `…[data-state="cancel_pending"]` | CancelBookingDialog | CP-CAN-serien "Avbokar…" | Allt låst inkl. Avbryt/`Esc` |
| ST-CAN-03 | STATES + F3; `…[data-state="cancel_success"]` | CancelBookingDialog → detalj | CP-STATUS-04 | Dialog stängs; chip uppdaterad; success-annons `role="status"` |
| ST-CAN-04 | STATES + F4; `…[data-state="cancel_network_error"]` | CancelBookingDialog | CP-CAN-felserie | Dialog kvar; "Din bokning är oförändrad."; retry |
| ST-CAN-05 | STATES + F4; `…[data-state="cancel_policy_changed"]` | CancelBookingDialog | CP-CAN-11/12 | Ingen mutation; förklaring |
| ST-CAN-06 | STATES + F4; `…[data-state="cancel_already"]` | CancelBookingDialog | CP-CAN-13 | Idempotent success |

### 24.11 Kalender (`CalendarDownloadButton` i `detalj` och `steg5`)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-CAL-01 | STATES + F5; `[data-screen="detalj"][data-state="calendar_pending"]` | CalendarDownloadButton | CP-CAL-01/02 "Hämtar…" | Knapp låst under hämtning |
| ST-CAL-02 | STATES + F5; `…[data-state="calendar_success"]` | CalendarDownloadButton | CP-CAL-03 | Simulerad `.ics`-nedladdning; `role="status"` |
| ST-CAL-03 | STATES + F5; `…[data-state="calendar_error"]` | CalendarDownloadButton | CP-CAL-04 | Ägarskapsfel = exakt samma text (§8) |

### 24.12 Profil (`data-screen="profil"`, §12)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-PROF-01 | STATES + MOBIL/DESKTOP; `…[data-state="readonly"]` | CustomerProfileCard + VerifiedContactCard | CP-PROF-01–14, CP-VC-01–08 | Sex menyposter i exakt ordning; CP-PROF-14 = `<button>` |
| ST-PROF-02 | STATES + F6; `…[data-state="edit_name"]` | CustomerProfileCard | CP-NAME-01–03 | Inline-fält; Avbryt/Spara |
| ST-PROF-03 | STATES + F6; `…[data-state="saving"]` | CustomerProfileCard | CP-NAME-05 | "Sparar…"; fält låst |
| ST-PROF-04 | STATES + F6; `…[data-state="name_invalid"]` | CustomerProfileCard | CP-NAME-04 | 2–120 tecken; `aria-describedby` |
| ST-PROF-05 | STATES; `…[data-state="save_error"]` | CustomerProfileCard | CP-NAME-07 | Felrad; värdet kvar; menyn funktionell |

### 24.13 Kontaktbyte (`ContactChangeFlow` som overlay på `profil`, §14)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-CCF-01 | STATES + F7; `[data-screen="profil"][data-state="ccf_start"]` | ContactChangeFlow steg 1 | CP-CCF-01–06 | Kod ALLTID till nuvarande kontakt; scrim stänger inte |
| ST-CCF-02 | STATES + F7; `…[data-state="ccf_stepup_sms"]` | ContactChangeFlow steg 2 | CP-CCF-10, CP-CCF-12–14 | Step-up till aktuell SMS-kontakt (FreshCut) |
| ST-CCF-03 | STATES + F13; `…[data-state="ccf_stepup_email"]` | ContactChangeFlow steg 2 | CP-CCF-11, CP-CCF-12–14 | Step-up till aktuell e-postkontakt (Nordverk) |
| ST-CCF-04 | STATES; `…[data-state="ccf_stepup_error"]` | ContactChangeFlow steg 2 | CP-CCF-15/16/17 | invalid/expired/max_attempts; cooldown/omskick ärver CP-PIN-11/12/13 |
| ST-CCF-05 | STATES + F7; `…[data-state="ccf_channel_unavailable"]` | ContactChangeFlow | CP-CCF-08, CP-CCF-39–41, CP-TID-03/CP-DET-15 | Klickbar länk till neutral hjälpvy med exakt en publik kontaktväg; ingen alternativ verifiering |
| ST-CCF-06 | STATES + F7; `…[data-state="ccf_new_destination"]` | ContactChangeFlow steg 3 | CP-CCF-20–23, CP-CCF-33–35 | Exakt ett kanalbundet fält; startåtgärden avgör telefon/e-post; konsekvensinfo CP-CCF-22; ingen kanalhärledning ur fritext |
| ST-CCF-07 | STATES + F7; `…[data-state="ccf_new_pin_sent"]` | ContactChangeFlow steg 4 | CP-CCF-24/25 | Separat challenge; ny kod ≠ steg 2-koden |
| ST-CCF-08 | STATES; `…[data-state="ccf_new_pin_error"]` | ContactChangeFlow steg 4 | CP-CCF-26–28 | fel/utgången/maxförsök på nya destinationen |
| ST-CCF-09 | STATES; `…[data-state="ccf_conflict"]` | ContactChangeFlow steg 4 | CP-CCF-29/38 | Åtgärdsspecifikt telefon-/e-postfel utan merge eller avslöjande av annan kundrelation |
| ST-CCF-10 | STATES; `…[data-state="ccf_switching"]` | ContactChangeFlow | CP-CCF-14 | Atomiskt byte pågår; dubbelsubmit idempotent |
| ST-CCF-11 | STATES + F7; `…[data-state="ccf_done"]` | ContactChangeFlow steg 5 | CP-CCF-30–32 | Kvitto + konsekvensrad; nya värdet i kortet EFTER stängning |

### 24.14 Säkerhet (`data-screen="sakerhet"`, §15)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-SEC-01 | STATES; `…[data-state="one_session"]` | PortalSessionList | CP-SEC-03–06, CP-SEC-08 | Endast aktuell med badge; ingen samlingsknapp |
| ST-SEC-02 | STATES + MOBIL/DESKTOP; `…[data-state="many_sessions"]` | PortalSessionList | + CP-SEC-07, CP-SEC-09 | Aktuell först; per-rad + samlingsknapp (≥2) |
| ST-SEC-03 | STATES; `…[data-state="trusts"]` | BookingTrustList | CP-SEC-13–16 (tom: CP-SEC-17) | Egen `<section>`; slås aldrig ihop med sessionslistan |
| ST-SEC-04 | STATES + F8; `…[data-state="revoke_dialog"]` | DestructiveActionDialog | CP-DLG-01–15 (variantmatrisen §15) | Fem varianter; sekundär CP-DLG-16 |
| ST-SEC-05 | STATES + F8; `…[data-state="revoke_pending"]` | DestructiveActionDialog | CP-DLG-17/18 | Avbryt + `Esc` låsta |
| ST-SEC-06 | STATES + F8; `…[data-state="revoke_success"]` | listorna | CP-SEC-10/18 | Rad/post borta; annons `role="status"`; idempotens |
| ST-SEC-07 | STATES; `…[data-state="revoke_error"]` | DestructiveActionDialog | CP-DLG-19, CP-SEC-11/12/19/20 | Dialog kvar; inget ändrat |
| ST-SEC-08 | STATES; `…[data-state="only_current"]` | PortalSessionList | CP-SEC-03–06 | Bara aktuell kvar efter `logout-all-others`; samlingsknapp borta |

### 24.15 PWA (`data-screen="mina"` / `"installera"`, §16)

| State-ID | Fil + selektor | Komponent | COPY-ID | Förväntad interaktion |
|---|---|---|---|---|
| ST-PWA-01 | STATES; `[data-screen="installera"][data-state="unsupported"]` | InstallPromptCard (page) | CP-INST-02 | Inget kort på `/mina`; sidan förklarar |
| ST-PWA-02 | STATES + F9; `[data-screen="mina"][data-state="pwa_eligible"]` | InstallPromptCard (auto) | CP-PWA-01–03 | Kortet ALLTID efter bokningsinnehållet |
| ST-PWA-03 | STATES + F9; `…[data-state="pwa_prompted"]` | InstallPromptCard | CP-PWA-03 | Native-prompt ENDAST som direkt svar på klick |
| ST-PWA-04 | STATES + F9; `…[data-state="pwa_dismissed_once"]` | InstallPromptCard | CP-PWA-04 | Räknare per enhet; nollställs aldrig vid utloggning |
| ST-PWA-05 | STATES; `…[data-state="pwa_prompted_twice"]` | InstallPromptCard | CP-PWA-01–04 | Andra/sista automatiska erbjudandet |
| ST-PWA-06 | STATES; `…[data-state="pwa_dismissed_twice"]` | — | ingen | Inget kort på `/mina`; `/mina/installera` alltid nåbar |
| ST-PWA-07 | STATES; `…[data-state="pwa_accepted"]` | — | ingen | Kortet borta permanent |
| ST-PWA-08 | STATES + F10; `[data-screen="installera"][data-state="ios_guide"]` | IosInstallGuide | CP-IOS-01–07 | Tre låsta iOS-ordagranna steg; inline utan stängknapp |
| ST-PWA-09 | STATES + F10; `[data-screen="installera"][data-state="in_app"]` | InstallPromptCard | CP-APP-01–08 | "Kopiera länken"; CP-APP-07 endast vid verifierad systemåtgärd |
| ST-PWA-10 | STATES; `[data-screen="installera"][data-state="standalone"]` | InstallPromptCard (page) | CP-INST-03 | Allt dolt på `/mina`; "Appen är installerad." |

Registret är slutet: 15 områden, samtliga tillstånd ur briefens §18-tabell. Ett tillstånd i briefen utan rad här — eller en rad här utan yta i `STATES` — = FAIL.

---

## 25. Desktop/mobil-paritetsmatris (desktop får INGEN extra funktion)

Bindande princip (§5): desktop introducerar inga egna funktioner — samma kortordning, etiketter och actions som mobil. Enda tillåtna skillnaderna är de i tabellen; allt annat som skiljer = FAIL.

| Dimension | Mobil (0–767) | Desktop (≥1024) | Funktionsskillnad? |
|---|---|---|---|
| Navigation | Bottennav 60px, 3 poster | Vänsternav 232px, SAMMA 3 poster | NEJ — identiska mål/etiketter/ordning |
| Topbar | 60px; profilknapp CP-TOP-03 (detalj: CP-TOP-04) | 56px; förnamn/initialer + CP-TOP-05 "Logga ut" | NEJ — CP-TOP-05 öppnar samma `logout-current`-dialog som CP-PROF-14 |
| Layout | En kolumn, gutters 16/20px | 232+680+288, gap 24 | NEJ — högerkolumnen får endast omplacera befintligt innehåll (§4.5/§4.7), DOM-ordning identisk |
| Dialoger/sheets | Bottom sheet-varianter | Centrerad dialog | NEJ — samma copy, steg och states |
| Skip-länk | CP-SHELL-01 först | CP-SHELL-01 först | NEJ |
| Hamburgarmeny | finns inte | finns inte | — (CP-NEG; §5) |
| Kortordning `/mina` | §4.5-ordningen | SAMMA ordning i `--col-main` | NEJ |
| Recovery-/tenantskärmar | smal centrerad yta | SAMMA smala yta (max ~440px), aldrig trekolumn | NEJ |
| Fixturväxling | PrototypeFixtureControl sist i DOM | identisk | NEJ |

Paritetskontroll i granskningen: för varje `data-screen` (§22.1) ska mängden interaktiva element (knappar, länkar, fält) i `DESKTOP` vara EXAKT samma mängd COPY-ID:n som i `MOBIL`, plus/minus endast CP-TOP-03/04 ↔ CP-TOP-05 enligt raden ovan.

## 26. Testviewport-matris (bindande, TOKENS §8.2 / brief §21)

| Viewport | Enhetsklass | Nav | Layout | Särskild kontroll |
|---|---|---|---|---|
| 320×568 | minsta mobil | bottennav | 1 kolumn, gutters 16px | Ingen h-scroll; Nordverks långa tjänstenamn bryts; landscape-krav §19 |
| 390×844 | standardmobil | bottennav | 1 kolumn, gutters 20px | MOBIL-prototypens standardram; safe-area topp/botten |
| 430×932 | stor mobil | bottennav | 1 kolumn, gutters 20px | Träffytor ≥1/3-bredd × stapelhöjd (§5); dialog + tangentbord ryms |
| 768×1024 | tablet | bottennav (samma som mobil) | innehåll max 760px centrerat | INGEN vänsternav under 1024; bottennav täcker aldrig innehåll |
| 1024×768 | liten desktop | vänsternav 232px, ingen bottennav | högerkolumnen faller UNDER huvudkolumnen (§5) | Brytpunktsbytet exakt vid 1024; topbar 56px |
| 1440×900 | desktop | vänsternav 232px | full trekolumn 232+680+288 + två gap à 24, max 1248px | DESKTOP-prototypens standardram; skip-länk + fokusringar synliga |

Vid samtliga sex: ingen horisontell scroll, inga klippta kontroller, synligt fokus (TOKENS-fokusvärdena), nästa bokning + primär handling synliga utan onödigt tomrum, svenska datum/priser får plats, layout fungerar utan logotyp och hero-bild (§19).

## 27. Lokalt självbärande HTML (bindande för alla tre `.dc.html`)

1. Öppnas lokalt direkt i webbläsaren (dubbelklick/`Ctrl+O`) — ingen server, inget nätverk, ingen build (README §Öppna prototyperna).
2. All CSS och JS inline i respektive fil; tokens ur TOKENS.md återgivna som CSS-variabler i filens `<style>`.
3. All ikonografi = **inline SVG** (husets stroke-språk); inga ikonfonter, inga spritefiler, inga `<img>` mot externa källor. Logotyper/foton = inline SVG-platshållare eller data-URI.
4. **Noll externa resursberoenden:** inga CDN-importer, inga `@import`, ingen extern font (lokal font-stack per TOKENS), inga analytics/trackers, inga fetch/XHR — initial laddning och all intern state-simulering ger noll requests utöver själva filen. Avsiktliga produktlänkar (`tel:`, karta, `publicRebookUrl` och no-JS-länkarna i §7.4) får lämna filen först efter verkligt användarklick.
5. **Inga brutna imports/referenser:** varje resursbärande `src`/`url()`/stylesheet-import är inline eller data-URI; interna prototyplänkar pekar på ankare/states i samma fil. Avsiktliga produktlänkar ska ha en syntetisk men strukturellt giltig mål-URL och får aldrig användas som resursimport. En 404:ande resursreferens = FAIL.
6. Simulerade serversvar (PIN-utfall, gatewaystatusar, fel) drivs av prototypens interna state + `PrototypeFixtureControl` — aldrig av riktiga anrop.
7. Ingen riktig kunddata, inga credentials, inga produktionshemligheter (README §Data); alla tokens/koder i prototyperna är uppenbart syntetiska.

## 28. Definition av design-done

Designleveransen är klar när, i denna ordning:

1. **Alla tio kanoniska filer** finns och är interna konsistenta enligt kanonordningen §1.1: `README.md`, `SPEC.md`, `MOBIL`, `DESKTOP`, `STATES`, `TOKENS.md`, `COMPONENTS.md`, `COPY.md`, `FEATURE-MATRIX.md`, `ACCEPTANCE-MATRIX.md`.
2. `STATES` täcker VARJE rad i §24 (97 state-ytor över 15 områden) med träffbar `[data-screen][data-state]`-selektor; `MOBIL`/`DESKTOP` täcker alla tretton flöden F1–F13 (§23) och paritetsmatrisen §25 håller.
3. En **oberoende granskning** enligt briefens avsnitt 29 prickar av `ACCEPTANCE-MATRIX.md` mekaniskt och ger **0 blockerare** — inklusive den öppna säkerhetsblockeraren §21 som spårad öppen rad (den blockerar PRODUKTION, inte designacceptansen, men får aldrig döljas).
4. FÖRST efter 0 blockerare: krav-ID:n och exakta visuella värden förs över till `5-Kod/e2e/acceptans/kundportal-losenordsfri-pwa-v1/` (`*.accept.spec.ts` + `probe.js`), och implementation får påbörjas.
5. **Produktkod är FÖRBJUDEN före godkännandet** (README §Implementation; §20 ingress): designfasen ändrar ingen fil under `5-Kod/` — inga routes, komponenter, migrationer eller flaggor. Implementationen får därefter inte märkas klar förrän `accept.spec.ts` + `probe.js` båda ger mekaniskt `0 FAIL`.

## 29. Final no-scope-leak-checklista

Prickas av mot ALLA tre prototypfilerna + de sju md-filerna innan granskningen beställs. Ett enda JA = blockerare.

- [ ] Finns någon route utanför §3-tabellen (11 portalroutes) + tenanthostens steg 4/5? (§3: route utanför tabellen = FAIL)
- [ ] Finns någon komponent utanför 28-listan i §18? (COMPONENTS §29)
- [ ] Finns någon sträng som inte är ett COPY-ID ur COPY.md (utöver galleri-metatext och "PROTOTYP"-markören)? (§1.1: synonymer = FAIL)
- [ ] Syns något ur DOLT-scopet §1.3 — konto/hub/lösenord/social login/push/erbjudanden/lojalitet/webshop/favoriter/ombokning/väntelista/kvitton/native-app — ens som "kommer snart" eller tom meny? (CP-NEG-07)
- [ ] Finns någon "Logga in"-knapp, registrering eller login-vy? (CP-NEG-01; §2.5)
- [ ] Finns tenantväxlare eller företagslista i en session? (CP-NEG-02; §2.6)
- [ ] Bokar portalen själv någonstans — eller finns ombokning inne i portalen? (§2.1; CP-NEG-08)
- [ ] Visas token, PIN i klartext, UUID, IP, platskolumn, omaskad destination eller stack trace någonstans? (COPY §25; §15; §17)
- [ ] Säger någon yta "Betrodda enheter"? (CP-NEG-12)
- [ ] Avslöjar recovery/kontaktbyte om en uppgift existerar (olika svar för träff/icke-träff)? (CP-NEG-11; §14)
- [ ] Har `DESKTOP` någon funktion, knapp eller menypost som `MOBIL` saknar (utöver CP-TOP-05-raden i §25)?
- [ ] Är `PrototypeFixtureControl` renderad så att den kan tolkas som produktfunktion eller säkerhetsmekanism? (§6)
- [ ] Laddar någon prototypfil något externt (font, CDN, bild, script, fetch)? (§27)
- [ ] Finns någon ändring i `5-Kod/` eller annan produktkod från designfasen? (§28.5)
- [ ] Markerar paketet PIN-/portalflödena som driftklara trots öppen §21-blockerare?

---

SPEC KOMPLETT — 3 av 3
