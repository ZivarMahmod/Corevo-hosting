# ACCEPTANCE-MATRIX — Kundportal lösenordsfri PWA v1

> ⛔ **Regel:** Ingen rad får sättas till `PASS` innan kontrollen faktiskt är KÖRD och en **bevislänk** (skärmdump, grep-utdrag, DOM-dump eller filhänvisning) finns antecknad i statuskolumnen. `EJ KÖRD` är enda tillåtna startvärdet. Granskaren är oberoende — inte paketets författare.

**Metodförkortningar:** `FIL` = fil-/kataloginspektion · `GREP` = textsökning i angiven fil · `DOM` = öppna prototypen lokalt i webbläsare och inspektera DOM/render · `VIEW` = DOM i angiven viewport (devtools device toolbar) · `DOK` = läsning/korsläsning av dokument.

## Del A av 3

### A1. Paketets integritet (README §"tio kanoniska filer", brief §28)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-001 | Paketet innehåller exakt 10 kanoniska filer i README:s ordning | README.md §"tio kanoniska filer" | `4-Dokument-Underlag/01-acceptans/kundportal-losenordsfri-pwa-v1/` (katalog) | — | FIL | Exakt: README.md, SPEC.md, Mobil.dc.html, Desktop.dc.html, States.dc.html, TOKENS.md, COMPONENTS.md, COPY.md, FEATURE-MATRIX.md, ACCEPTANCE-MATRIX.md — inga andra filer | EJ KÖRD |
| ACC-A-002 | Mobilprototypen är self-contained: all CSS/JS inline, lokal font-stack, inga automatiska nätverksanrop | README.md §"Öppna prototyperna"; SPEC §27 | `Kundportal Passwordless Mobil.dc.html` | — | GREP+NÄTVERK | 0 `<link rel="stylesheet" href>`, 0 `<script src>`, 0 `@import`, 0 `url(http`, 0 fetch/XHR/analytics; initial laddning och intern state-simulering = 0 nätverksrequests. Endast avsiktliga produktlänkar får ha `http(s):` och navigera efter användarklick | EJ KÖRD |
| ACC-A-003 | Desktopprototypen är self-contained enligt samma kriterium | README.md §"Öppna prototyperna"; SPEC §27 | `Kundportal Passwordless Desktop.dc.html` | — | GREP+NÄTVERK | Samma som ACC-A-002 | EJ KÖRD |
| ACC-A-004 | Statesgalleriet är self-contained enligt samma kriterium | README.md §"Öppna prototyperna"; SPEC §27 | `Kundportal Passwordless States.dc.html` | — | GREP+NÄTVERK | Samma som ACC-A-002; galleriets visade URL-exempel får inte laddas automatiskt | EJ KÖRD |
| ACC-A-005 | Prototyperna öppnas offline utan server och renderar felfritt | README.md §"Öppna prototyperna" | Alla tre `.dc.html`, konsolen | — | DOM | Öppning via `file://` med nätverk avstängt: 0 konsolfel, 0 misslyckade nätverksanrop | EJ KÖRD |
| ACC-A-006 | Inga credentials, produktionshemligheter eller riktig kunddata i någon paketfil | README.md §"Data"; brief §28 | Alla 10 filer | — | GREP | 0 träffar på riktiga nycklar/tokens (`sk_`, `eyJ`, `supabase.co`-nycklar), riktiga personnummer/telefonnummer; alla kund-/tenantdata syntetiska | EJ KÖRD |
| ACC-A-007 | README anger granskningsordning README → SPEC → TOKENS → COMPONENTS → COPY → prototyper → matriser | README.md §"Rekommenderad granskningsordning" | `README.md` | — | DOK | Ordningen finns uttryckligen och matchar paketets faktiska filer | EJ KÖRD |

### A2. Kanonordning (README §"Överordnad lag"; SPEC §1.1)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-008 | Designbriefen är överordnad lag; konfliktordning brief > TOKENS > COMPONENTS > COPY > SPEC | README.md §"Överordnad lag"; SPEC.md §1.1 | `README.md`; `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md` | — | DOK | Ordningen uttryckt i README/SPEC; stickprov 5 värden (färg, radie, copy-ID, breakpoint, route) visar 0 konflikter mellan nivåerna | EJ KÖRD |
| ACC-A-009 | SPEC inför inga egna routes/fält/states/strängar utöver briefen | SPEC.md §8 (del 2-ingress) | `SPEC.md` hela | — | DOK | Varje route, state och COPY-ID i SPEC spårbar till brief/TOKENS/COMPONENTS/COPY | EJ KÖRD |

### A3. NU/DOLT/LEGACY + negativlistan (brief §3.2; FEATURE-MATRIX; CP-NEG-01–12)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-010 | Varje funktion i FEATURE-MATRIX har status `NU`, `FÖRBEREDD/DOLD` eller `LEGACY/BEVARAD` med briefavsnitt | FEATURE-MATRIX.md; brief §3 | `FEATURE-MATRIX.md` alla rader | — | DOK | 0 rader utan status eller utan briefreferens | EJ KÖRD |
| ACC-A-011 | Ingen login-/signup-/lösenordsyta i någon prototyp | Brief §3.2; CP-NEG | Alla `.dc.html` | — | GREP+DOM | 0 login-/signup-formulär, 0 "skapa konto", 0 `type="password"`; den mandatstyrda neutrala säkerhetstexten "Du använder inget lösenord" är tillåten, liksom utloggningsknapp CP-TOP-05/CP-PROF-14 | EJ KÖRD |
| ACC-A-012 | Ingen social login (Google/Apple/Facebook/BankID-knappar) | Brief §3.2; CP-NEG | Alla `.dc.html` | — | GREP | 0 träffar på social-login-knappar/ikoner | EJ KÖRD |
| ACC-A-013 | Inget "Mina företag" / global hub över flera tenants | Brief §3.2; SPEC §6 | Alla `.dc.html`; `COPY.md` | — | GREP+DOM | 0 UI som listar/växlar mellan flera företag i samma session (endast märkt `PrototypeFixtureControl`) | EJ KÖRD |
| ACC-A-014 | Ingen push-, erbjudande-, lojalitets- eller webshopyta | Brief §3.2; CP-NEG | Alla `.dc.html`; `COPY.md` | — | GREP | 0 träffar på "push", "notiser aktivera", "erbjudande", "poäng", "lojalitet", "varukorg", "webshop" i UI-text | EJ KÖRD |
| ACC-A-015 | Ingen "kommer snart"-ruta, tom meny eller halvaktiv route | Brief §3.2 (CP-NEG-07); SPEC §2 | Alla `.dc.html` | — | GREP+DOM | 0 träffar på "kommer snart"/"snart här"; inga disablade navposter eller tomma menyer | EJ KÖRD |
| ACC-A-016 | Legacy `/konto` bevaras i kod men är helt frånvarande i lanseringsytan | SPEC §2; FEATURE-MATRIX (`LEGACY/BEVARAD`) | `FEATURE-MATRIX.md`; alla `.dc.html` | — | DOK+GREP | FEATURE-MATRIX markerar `/konto` som `LEGACY/BEVARAD`; 0 länkar/nav/copy till `/konto` i prototyperna | EJ KÖRD |

### A4. Routes + hostseparation (SPEC §3, §7.2, §11; brief §8.1, §23.1)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-017 | Routetabellen på portalhosten `mina.corevo.se` är exakt: `/oppna/[tenantSlug]`, `/mina`, `/mina/bokningar/[id]`, `/mina/historik`, `/mina/profil`, `/mina/sakerhet`, `/mina/installera`, `/mina/integritet` + recovery-routes enligt SPEC §3 — inga andra | SPEC.md §3 | `SPEC.md` §3-tabell; prototypernas route-etiketter | — | DOK+DOM | Varje route i prototypen finns i tabellen; route utanför tabellen = FAIL | EJ KÖRD |
| ACC-A-018 | Tenanthosten bär bokningsflödets steg 1–5; portalen bokar aldrig själv | SPEC.md §2 princip 1, §4.12 | `.dc.html` steg 4/5-vyer; `BookAgainButton` | — | DOM | Steg 4/5 renderas i tenantram utan portal-shell/nav; "Boka igen" är utlänk till `publicRebookUrl` | EJ KÖRD |
| ACC-A-019 | Engångslänken har formen `https://mina.corevo.se/oppna/[tenantSlug]#<token>`; efter utbyte är adressen alltid tokenfri | Brief §8.1; SPEC §7.2 | `.dc.html` bootstrap-vy; `SPEC.md` §7.2 | — | DOM+DOK | Fragment läses lokalt, POST-utbyte, `history.replaceState`, `replace`-navigering till bokning eller `/mina`; ingen token i synlig URL efteråt | EJ KÖRD |
| ACC-A-020 | Host-fence: portalsession (mina.corevo.se) och booking trust (tenanthost) är två separata hostlåsta kontexter | SPEC.md §11; brief §23.1 | `SPEC.md` §11-tabell; `.dc.html` säkerhetssidan | — | DOK+DOM | Två separata listor (portalsessioner resp. "PIN-fria bokningsenheter"); utloggning på ena hosten lovar aldrig cookie-radering på den andra | EJ KÖRD |
| ACC-A-021 | Steg 5 länkar aldrig direkt in i portalen med sessionskrav — endast hänvisning "Öppna länken i meddelandet…" (CP-S5-03) | SPEC.md §2 princip 4, §10 | `.dc.html` steg 5-vy | — | DOM+GREP | Ingen `<a href>` från steg 5 till `/mina*`; CP-S5-03-copyn ordagrann enligt COPY.md | EJ KÖRD |
| ACC-A-022 | Tillbaka/deep link: `/mina/bokningar/[id]` nås direkt via djuplänk; "Tillbaka" (CP-TOP-04) leder till `/mina`; fokus flyttas till `<main>`/h1 vid routebyte | SPEC.md §3, §4 (gemensamt) | `.dc.html` detaljvy, topbarens tillbaka-knapp | 390×844 | DOM | Djupinhopp renderar full vy; tillbaka-knapp ersätter profilknappen i detaljläge; fokus verifierat på h1/`<main id="huvudinnehall">` | EJ KÖRD |

### A5. Corevo-topbar vs tenantkort (SPEC §5; brief §7)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-023 | Topbaren är Corevos: COREVO (CP-TOP-01) + MINA BOKNINGAR (CP-TOP-02); tenantlogotyp i topbaren = FAIL | SPEC.md §5 | `.dc.html` `<header>`/`CustomerPortalTopbar` | 390×844 + 1440×900 | DOM | Endast Corevo-märke i topbaren i båda fixtures; ingen tenantlogga/-färg där | EJ KÖRD |
| ACC-A-024 | Tenantens identitet (namn, logotyp, färg) bärs i tenantkortet/innehållet — aldrig i shell/nav | SPEC.md §4, §6 | `.dc.html` startsidans tenantkort | 390×844 | DOM | Fixturbyte FreshCut↔Nordverk byter kortets identitet men lämnar topbar+nav oförändrade | EJ KÖRD |
| ACC-A-025 | Topbar mobil/tablet: profilknapp (CP-TOP-03) höger → `/mina/profil`; desktop: förnamn/initialer + "Logga ut" (CP-TOP-05) | SPEC.md §5 | `.dc.html` topbar | 390×844 vs 1440×900 | VIEW | Mobil visar profilknapp, ingen "Logga ut" i topbar; desktop visar namn + Logga ut | EJ KÖRD |

### A6. Navigation + breakpoints (SPEC §5; TOKENS §8)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-026 | Exakt tre navposter i fast ordning: Bokningar → Historik → Profil, i `<nav aria-label="Huvudmeny">` (CP-NAV-01–04) | SPEC.md §5 | `.dc.html` `CustomerPortalNavigation` | 390×844 | DOM | Exakt 3 poster, rätt ordning, rätt aria-label; ingen hamburgare | EJ KÖRD |
| ACC-A-027 | Mobil 0–767px: bottennav 60px + `env(safe-area-inset-bottom)`, fixed, topbar 60px sticky | SPEC.md §5-tabell; TOKENS §8 | `.dc.html` bottennav-CSS | 320×568 + 390×844 | VIEW | Bottennav enligt spec; topbar `--topbar-h-mobile: 60px` | EJ KÖRD |
| ACC-A-028 | Tablet 768–1023px: samma bottennav som mobil; innehåll max 760px centrerat | SPEC.md §5-tabell | `.dc.html` | 768×1024 | VIEW | Bottennav kvar; container `--container-tablet: 760px` centrerad | EJ KÖRD |
| ACC-A-029 | Desktop ≥1024px: vänsternav 232px sticky, topbar 56px, ingen bottennav; exakt EN navvariant per viewport | SPEC.md §5-tabell | `.dc.html` | 1024×768 + 1440×900 | VIEW | Vänsternav `--col-left: 232px`; bottennav frånvarande i DOM eller `display:none`; aldrig båda synliga | EJ KÖRD |
| ACC-A-030 | Aktiv navpost: `aria-current="page"` + färg `--positive` + viktökning — färg aldrig enda signalen; desktopnav: aktiv = bg `--surface-2` + 2px vänsterkant `--action` | SPEC.md §5 | `.dc.html` aktiv navpost | 390×844 + 1440×900 | DOM | Attribut + dubbel signal verifierade i båda varianterna | EJ KÖRD |
| ACC-A-031 | Layoutcontainrar: gutter 16px (20px ≥390px); desktop max 1248px = 232+680+288+2×24; 1024–1247px: högerkolumn faller under huvudkolumn | SPEC.md §5; TOKENS §8 | `.dc.html` layout-CSS | 320×568, 390×844, 1100×800, 1440×900 | VIEW | Uppmätta värden matchar tokens exakt | EJ KÖRD |
| ACC-A-032 | Alla sex acceptansviewports renderar utan brott: 320×568, 390×844, 430×932, 768×1024, 1024×768, 1440×900 | SPEC.md §5; TOKENS §8.2 | Alla `.dc.html`, alla huvudvyer | alla sex | VIEW | Ingen horisontell scroll, inga klippta kontroller, synligt fokus i varje viewport | EJ KÖRD |

### A7. Fixtures FreshCut/Nordverk (SPEC §6; brief §28.1)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-033 | FreshCut (frisör, SMS, en plats) och Nordverk Bilservice (bilverkstad, e-post utan telefonnummer, två platser Hälla/Erikslund) är helt separata — aldrig två företag i samma session | SPEC.md §6.1–6.2 | `.dc.html` `PrototypeFixtureControl` + datalager | 390×844 | DOM | Fixturbyte är atomärt (data+namn+logotyp+färg byts i sin helhet); blandat läge existerar inte; växlaren tydligt märkt som prototypkontroll och sist i DOM | EJ KÖRD |
| ACC-A-034 | Nordverk: plats i detalj/listor kommer från BOKNINGEN, aldrig tenantens centrala adress; ingen tom telefonrad; "Lägg till mobilnummer" startar separat dubbelverifierat flöde | SPEC.md §6.2 | `.dc.html` Nordverk-fixture, detaljvy + `VerifiedContactCard` | 390×844 | DOM | Rätt plats per bokning; endast e-postrad i kontaktkortet + CP-VC-07; inget fabricerat telefonfält | EJ KÖRD |
| ACC-A-035 | Generiska etiketter: branschbegrepp kommer från `verticalLabel`/bokningsdata — inga hårdkodade frisörord i Nordverk-läget | SPEC.md §6; brief §28.1 | `.dc.html` i Nordverk-fixture; `COPY.md` | 390×844 | GREP+DOM | 0 träffar på "salong", "klippning", "frisör" i UI när Nordverk-fixturen är aktiv | EJ KÖRD |

### A8. Tokenkontroller (TOKENS §1–§8)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-A-036 | Alla färger/typo/spacing/radier konsumeras via CSS custom properties; hårdkodat hex/px som redan finns som token = FAIL | TOKENS.md §1 (rad 11) | Alla `.dc.html` `<style>` | — | GREP | Stickprov 20 deklarationer: värden refererar `var(--…)`; inga dubbletthex | EJ KÖRD |
| ACC-A-037 | Typografiskala exakt: h1 28/32 (36/40 desktop), h2 22/28, h3 18/24, body 16/24, compact 15/22, meta 12/18 | TOKENS.md §3 | `.dc.html` computed styles på h1/h2/h3/body-text | 390×844 + 1440×900 | DOM | Uppmätta px-värden matchar tokens exakt | EJ KÖRD |
| ACC-A-038 | Spacing enbart på 4-bas-skalan (4/8/12/16/20/24/32/40/48/64); radier exakt: field 10, card 16, dialog 18, pill 999 | TOKENS.md §4, §5 | `.dc.html` marginaler/padding/border-radius, stickprov 10 element | 390×844 | DOM | 0 värden utanför skalan; radier matchar per elementtyp | EJ KÖRD |
| ACC-A-039 | Fokus: synlig ring 2px med offset 3px på VARJE interaktiv kontroll; touch: träffyta ≥44px (`--tap-min`), primärknapp ≥48px | TOKENS.md §1 (`--focus-ring-*`, `--tap-min`, `--button-primary-h`) | `.dc.html` alla knappar/länkar/inputs, tab-genomgång | 390×844 | DOM | Tab genom hela startsida+detalj+profil: 0 kontroller utan synlig fokusring; 0 kontroller <44px; primär CTA ≥48px | EJ KÖRD |
| ACC-A-040 | Safe area respekteras (`env(safe-area-inset-top/bottom)` i topbar/bottennav) och ingen horisontell scroll i någon huvudvy | SPEC.md §5; TOKENS §8 | `.dc.html` topbar/bottennav-CSS; `document.documentElement.scrollWidth` | 320×568 + 430×932 | VIEW | `env()`-anropen finns; `scrollWidth <= innerWidth` i alla huvudvyer | EJ KÖRD |

---

## Del B av 3 — Produktflöden och states

> Filförkortningar (README:s kanoniska namn): `MOBIL` = `Kundportal Passwordless Mobil.dc.html` · `DESKTOP` = `Kundportal Passwordless Desktop.dc.html` · `STATES` = `Kundportal Passwordless States.dc.html`. Selektorer = `[data-screen][data-state]` enligt SPEC §22/§24. F-nummer = klickflöden SPEC §23.

### B1. Bootstrap, länk och no-JS (SPEC §7, §24.1–24.2)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-001 | Bootstrap `checking`: neutral spinner/skeleton, ingen CTA; `redirect` (F1): simulerad `replace` till detalj/`/mina`, tokenfri adress | SPEC §7.2, §24.1 (ST-BOOT-01/02) | STATES + MOBIL/DESKTOP; `[data-screen="bootstrap"][data-state="checking"]` och `…[data-state="redirect"]` | 390×844 | DOM | PortalBootstrap + PortalSkeleton; CP-BOOT-01/02 + CP-SKEL-01; efter redirect syns ingen `#<token>` i adressraden | EJ KÖRD |
| ACC-B-002 | No-JS-läget serverrenderar tre fungerande länkar: ny kod / bokningssida / hjälp | SPEC §7.4, §24.1 (ST-BOOT-03) | STATES; `[data-screen="bootstrap"][data-state="no_js"]` | — | DOM+GREP | PortalBootstrap `<noscript>`; CP-BOOT-03–07 ordagrant enligt COPY.md; tre `<a href>` | EJ KÖRD |
| ACC-B-003 | `invalid`/`expired`/`revoked` renderar EN och EXAKT samma yta — fallen skiljs aldrig åt | SPEC §7.3, §24.2 (ST-LINK-01/02/05) | STATES; `[data-screen="bootstrap"][data-state="invalid"]`, `…="expired"`, `…="revoked"` | — | DOM | Identisk DOM för alla tre; CP-BOOT-10–14; primär CP-BOOT-12 → `aterhamta`, sekundär CP-BOOT-13 | EJ KÖRD |
| ACC-B-004 | Använd länk: `used_with_session` öppnar rätt bokning direkt utan ny PIN; `used_no_session` visar primär "Skicka ny kod" → `aterhamta` | SPEC §4.1, §7.3, §24.2 (ST-LINK-03/04) | STATES; `[data-screen="bootstrap"][data-state="used_with_session"]` och `…="used_no_session"` | — | DOM | Utan copy + simulerad navigering till detaljvyn resp. CP-BOOT-08/09 med primärknapp till recovery-ytan | EJ KÖRD |

### B2. Startsidan `/mina` (SPEC §4.5, §24.7)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-006 | En kommande bokning: NextBookingCard med detalj-, kalender- och (policytillåten) avboka-åtgärd | SPEC §24.7 (ST-HOME-01) | STATES + MOBIL/DESKTOP; `[data-screen="mina"][data-state="one_upcoming"]` | 390×844 | DOM | CP-HOME-01–11; CP-HOME-08 → detalj; avboka endast om policy tillåter | EJ KÖRD |
| ACC-B-007 | Flera kommande: "Fler kommande"-listan renderas ENDAST vid ≥2; rader → detalj | SPEC §24.7 (ST-HOME-02) | STATES; `[data-screen="mina"][data-state="many_upcoming"]` | — | DOM | NextBookingCard + UpcomingBookingList; CP-HOME-12/13 frånvarande i `one_upcoming` | EJ KÖRD |
| ACC-B-008 | Tomläge: egen copy + "Boka ny tid" → tenantens publika `/boka`; inget lånat tomläge | SPEC §8, §24.7 (ST-HOME-03) | STATES; `[data-screen="mina"][data-state="empty"]` | — | DOM+GREP | PortalEmptyState; CP-HOME-14–19; CP-HOME-17 länkar till tenant-URL (CP-AGAIN-02-label) | EJ KÖRD |
| ACC-B-009 | Startsidans chip-lägen: `pending_request` (varning) och `cancelled` (negativ, ALDRIG avboka-knapp) | SPEC §8, §24.7 (ST-HOME-04/05) | STATES; `[data-screen="mina"][data-state="pending_request"]` och `…="cancelled"` | — | DOM | BookingStatusChip CP-STATUS-01 `--warning` resp. CP-STATUS-04 `--negative`; 0 avboka-CTA i cancelled | EJ KÖRD |

### B3. Historik + pagination (SPEC §4.6, §24.8)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-010 | Historik normal: tre sektioner i exakt ordning (Tidigare besök / Avbokade / Övriga); rader → detalj | SPEC §24.8 (ST-HIST-01) | STATES + MOBIL/DESKTOP; `[data-screen="historik"][data-state="normal"]` | 390×844 | DOM | BookingHistoryList; CP-HIST-01–05; sektionsordningen exakt | EJ KÖRD |
| ACC-B-011 | Historik tom: enbart CP-HIST-06, inget lånat tomläge; fel ≠ tomt | SPEC §8, §24.8 (ST-HIST-02) | STATES; `[data-screen="historik"][data-state="empty"]` | — | DOM | PortalEmptyState med endast CP-HIST-06 | EJ KÖRD |
| ACC-B-012 | Pagination: "Visa fler" → pending, max 20 rader/sida; fel vid fler lämnar listan intakt + retry | SPEC §24.8 (ST-HIST-03/04) | STATES; `[data-screen="historik"][data-state="loading_more"]` och `…="more_failed"` | — | DOM | CP-HIST-07/08 resp. CP-HIST-09; befintliga rader kvar i felläget | EJ KÖRD |

### B4. Status-/actionmatrisen (SPEC §8 — kanonisk, sluten)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-013 | Alla sju statuschips renderas via BookingStatusChip med exakt text CP-STATUS-01–07 och rätt färgklass; färg aldrig enda bärare (text + ikonform) | SPEC §8-tabellen | STATES; chip-instanser under `[data-screen="mina"]`/`"historik"`/`"detalj"` | — | DOM+GREP | 7 chips, exakta COPY-strängar, `--warning`/`--positive`/`--negative` per tabellen; distinkt ikon per färgklass | EJ KÖRD |
| ACC-B-014 | Handlingsregler per status: avboka aldrig på `completed`/`cancelled`/`no_show`; "Väntar på avslut" och "Status uppdateras" = ingen kundmutation | SPEC §8-tabellen | STATES + MOBIL; alla detalj-/listvyer per status | — | DOM | Endast tillåtna handlingar per rad i §8; 0 döda/förbjudna knappar | EJ KÖRD |
| ACC-B-015 | Boka igen-labels är en sluten lista: CP-AGAIN-01 (aktiv), CP-AGAIN-02 (tomläge), CP-AGAIN-03 (historik); mål = tenantens publika `/boka`; saknas URL renderas knappen inte; ombokning i portalen = FAIL | SPEC §8 "Boka igen-labels"; CP-NEG-08 | STATES + MOBIL/DESKTOP; alla BookAgainButton-instanser | — | DOM+GREP | Exakt tre labels, rätt kontext; 0 omboknings-UI i portalen | EJ KÖRD |

### B5. Bokningsdetalj (SPEC §4.7, §24.9)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-016 | Detalj aktiv: kalender + Boka en tid till + Avboka (dialog); plats kommer från BOKNINGEN (Nordverk: Hälla resp. Erikslund per bokning) | SPEC §6.2, §24.9 (ST-DET-01) | STATES + MOBIL/DESKTOP; `[data-screen="detalj"][data-state="active"]` | 390×844 | DOM | BookingDetail; CP-DET-01–10; platsraden matchar bokningens plats, ej tenantens centrala adress | EJ KÖRD |
| ACC-B-017 | `policy_blocked`: spärrförklaring i stället för avboka — aldrig en död knapp | SPEC §8, §24.9 (ST-DET-02) | STATES; `[data-screen="detalj"][data-state="policy_blocked"]` | — | DOM | CP-DET-12–15; ingen disablad avboka-knapp utan förklaring | EJ KÖRD |
| ACC-B-018 | Historiska detaljlägen: `cancelled`/`completed` med Boka igen endast om tjänsten publik; `no_show` helt utan mutation | SPEC §24.9 (ST-DET-03/04/05) | STATES; `[data-screen="detalj"][data-state="cancelled"]`, `…="completed"`, `…="no_show"` | — | DOM | Chip CP-STATUS-03/04/05 + CP-DET-11; 0 avboka-CTA; no_show utan Boka igen-tvång | EJ KÖRD |
| ACC-B-019 | Neutral ägarskaps-404: EXAKT samma yta för fel id / annan kund / fel tenant | SPEC §8, §24.9 (ST-DET-06) | STATES; `[data-screen="detalj"][data-state="not_found"]` | — | DOM | PortalErrorState; CP-DET-18/19; en enda gemensam yta, inget existensavslöjande | EJ KÖRD |

### B6. Avbokning — alla dialoglägen (SPEC §24.10; flöde F3/F4)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-020 | Avbokningsdialog: `role="dialog"`, fokusfälla, `Esc` = Avbryt | SPEC §24.10 (ST-CAN-01) | STATES + F3; `[data-screen="detalj"][data-state="cancel_dialog"]` | 390×844 | DOM | CancelBookingDialog; CP-CAN-01–05; fokus fångad, Esc stänger | EJ KÖRD |
| ACC-B-021 | Avbokar-pending: ALLT låst inklusive Avbryt och `Esc` | SPEC §24.10 (ST-CAN-02) | STATES + F3; `[data-screen="detalj"][data-state="cancel_pending"]` | — | DOM | CP-CAN "Avbokar…"; inga interaktiva utvägar under pending | EJ KÖRD |
| ACC-B-022 | Avbokning lyckad: dialog stängs, chip → Avbokad, annons `role="status"` | SPEC §24.10 (ST-CAN-03) | STATES + F3; `[data-screen="detalj"][data-state="cancel_success"]` | — | DOM | CP-STATUS-04 i detaljen; success annonserad utan fokusstöld | EJ KÖRD |
| ACC-B-023 | Felserien: nätverksfel ("Din bokning är oförändrad." + retry, dialog kvar), policy ändrad (ingen mutation + CP-CAN-11/12), redan avbokad (idempotent success CP-CAN-13) | SPEC §8, §24.10 (ST-CAN-04/05/06) | STATES + F4; `[data-screen="detalj"][data-state="cancel_network_error"]`, `…="cancel_policy_changed"`, `…="cancel_already"` | — | DOM | Tre distinkta lägen med exakt COPY-CAN-serie; ingen mutation i felfallen | EJ KÖRD |

### B7. Kalenderexport (SPEC §8, §24.11; flöde F5)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-024 | Kalender alla lägen: pending låser knappen under "Hämtar…"; success = simulerad `.ics`-nedladdning + `role="status"`; fel/ägarskapsfel renderar EXAKT samma text | SPEC §8, §24.11 (ST-CAL-01/02/03) | STATES + F5; `[data-screen="detalj"][data-state="calendar_pending"]`, `…="calendar_success"`, `…="calendar_error"` | — | DOM+GREP | CalendarDownloadButton; CP-CAL-01/02 → CP-CAL-03 resp. CP-CAL-04 identisk i båda felfallen; knapp, inte delbar länk | EJ KÖRD |

### B8. Boknings-PIN steg 4 (SPEC §9, §24.3; flöde F12/F13)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-026 | ETT semantiskt kodfält (`one-time-code`, label CP-PIN-02) i tenantram utan portal-shell; flera inputs = FAIL | SPEC §9, §4.12 | STATES + MOBIL/DESKTOP (F12); `[data-screen="steg4-pin"]` alla states | 390×844 | DOM+GREP | PinVerificationForm `mode="booking"`; exakt 1 input; rubrik CP-PIN-01; 0 portal-nav | EJ KÖRD |
| ACC-B-027 | `sending`: kanalrad `aria-live="polite"`, fält + Verifiera låsta | SPEC §24.3 (ST-PIN-01) | STATES + F12; `[data-screen="steg4-pin"][data-state="sending"]` | — | DOM | CP-PIN-03; låsta kontroller under utskick | EJ KÖRD |
| ACC-B-028 | `sent_sms` (FreshCut): maskerad SMS-rad + "Ändra mobilnummer"; autofokus i kodfältet | SPEC §24.3 (ST-PIN-02) | STATES + F12; `[data-screen="steg4-pin"][data-state="sent_sms"]` | — | DOM | CP-PIN-04/05; fokus i kodfältet vid rendering | EJ KÖRD |
| ACC-B-029 | `sent_email` (Nordverk): maskerad e-postrad + "Ändra e-post" | SPEC §6.2, §24.3 (ST-PIN-03) | STATES + F13; `[data-screen="steg4-pin"][data-state="sent_email"]` | — | DOM | CP-PIN-06/07; e-postspåret bevisas i Nordverk-fixturen | EJ KÖRD |
| ACC-B-030 | `invalid`: `role="alert"` med försöksräknare; värdet kvar, fokus åter i fältet | SPEC §9, §24.3 (ST-PIN-04) | STATES + F12; `[data-screen="steg4-pin"][data-state="invalid"]` | — | DOM | CP-PIN-10 "Fel kod. Du har [n] försök kvar."; ingen fälttömning | EJ KÖRD |
| ACC-B-031 | `cooldown` + `resend_ready`: nedräkning `aria-live="polite"` utan fokusstöld; "Skicka ny kod" → bekräftelse, gammal kod ogiltig | SPEC §24.3 (ST-PIN-05/06) | STATES; `[data-screen="steg4-pin"][data-state="cooldown"]` och `…="resend_ready"` | — | DOM | CP-PIN-11 resp. CP-PIN-12/13 | EJ KÖRD |
| ACC-B-032 | `expired` + `max_attempts`: Verifiera låst tills ny kod; challenge låst, INGEN bokning skapas | SPEC §2.2, §24.3 (ST-PIN-07/08) | STATES; `[data-screen="steg4-pin"][data-state="expired"]` och `…="max_attempts"` | — | DOM | CP-PIN-14 resp. CP-PIN-15; 0 bokningsskapande väg i låst läge | EJ KÖRD |
| ACC-B-033 | `delivery_failed`: kanalriktig felrad (SMS ≠ e-post) + möjligt omskick | SPEC §24.3 (ST-PIN-09) | STATES; `[data-screen="steg4-pin"][data-state="delivery_failed"]` | — | DOM+GREP | CP-PIN-16 i SMS-läget, CP-PIN-17 i e-postläget — aldrig fel kanaltext | EJ KÖRD |
| ACC-B-034 | `slot_lost`: ersättningsyta "Välj en ny tid", ingen kodinmatning kvar (endast `mode="booking"`) | SPEC §9, §24.3 (ST-PIN-10) | STATES; `[data-screen="steg4-pin"][data-state="slot_lost"]` | — | DOM | CP-PIN-18/19; kodfältet borta ur DOM/ersatt | EJ KÖRD |
| ACC-B-035 | `verified`: `role="status"` + automatisk vidaregång till steg 5 | SPEC §24.3 (ST-PIN-11) | STATES + F12; `[data-screen="steg4-pin"][data-state="verified"]` | — | DOM | CP-PIN-20; simulerad övergång till `[data-screen="steg5"]` | EJ KÖRD |

### B9. Steg 5 — tenant-hostad bekräftelse (SPEC §10, §24.4)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-036 | `delivered`: full bekräftelse med kalender-CTA (CP-S5-04) + BookAgainButton (CP-S5-05) klickbara | SPEC §24.4 (ST-S5-01) | STATES + F12; `[data-screen="steg5"][data-state="delivered"]` | 390×844 | DOM | BookingStepFive; CP-S5-01–06 + CP-S5-08/09; h1 = "Bokningen är klar" | EJ KÖRD |
| ACC-B-037 | Gatewaystatusar `gateway_persisted`/`submitted`/`unknown`: h1 CP-S5-01 KONSTANT; statusrad per §10-tabellen; `unknown` = ingen retry-CTA, ingen dubblettsändning | SPEC §10-tabellen, §24.4 (ST-S5-02) | STATES; `[data-screen="steg5"][data-state="gateway_persisted"]` (+ §10-statusraderna) | — | DOM+GREP | CP-S5-07/08/15 exakt; `role="status"`; leveransstatus blandas aldrig med persistens | EJ KÖRD |
| ACC-B-038 | `delivery_failed`: felrad `role="alert"` + rate-limitad idempotent "Skicka bekräftelsen igen" (pending/cooldown) + företagskontakt; rubriken förblir "Bokningen är klar" | SPEC §10, §24.4 (ST-S5-03) | STATES; `[data-screen="steg5"][data-state="delivery_failed"]` | — | DOM | CP-S5-10–14; leveransfel gör aldrig bokningen osäker | EJ KÖRD |
| ACC-B-039 | Separat felspår `failed` (ingen bokning skapades): egen layout — ingen sammanfattning, ingen kalender-CTA, ingen "klar"-formulering | SPEC §10, §24.4 (ST-S5-04) | STATES; `[data-screen="steg5"][data-state="failed"]` | — | DOM+GREP | CP-S5-16–18; 0 träffar på "klar"/kalender/sammanfattning i felspåret | EJ KÖRD |

### B10. Profil, meny och namnredigering (SPEC §12, §24.12; flöde F6)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-040 | Profil readonly: uppgiftskort + exakt SEX menyposter i låst ordning; "Logga ut" (CP-PROF-14) är `<button>` | SPEC §12, §24.12 (ST-PROF-01) | STATES + MOBIL/DESKTOP; `[data-screen="profil"][data-state="readonly"]` | 390×844 | DOM | CustomerProfileCard + VerifiedContactCard; CP-PROF-01–14; menyordning exakt | EJ KÖRD |
| ACC-B-041 | Namnredigering: inline-fält med Avbryt/Spara; `saving` = "Sparar…" med låst fält | SPEC §24.12 (ST-PROF-02/03) | STATES + F6; `[data-screen="profil"][data-state="edit_name"]` och `…="saving"` | — | DOM | CP-NAME-01–03 resp. CP-NAME-05 | EJ KÖRD |
| ACC-B-042 | Namnfel: `name_invalid` (2–120 tecken, fel via `aria-describedby`) och `save_error` (felrad, värdet kvar, menyn funktionell) | SPEC §24.12 (ST-PROF-04/05) | STATES + F6; `[data-screen="profil"][data-state="name_invalid"]` och `…="save_error"` | — | DOM | CP-NAME-04 programmatiskt kopplat till fältet resp. CP-NAME-07 utan datatömning eller låst meny | EJ KÖRD |

### B11. `verifiedContact` — serverstyrd union (SPEC §13)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-044 | SMS-variant (FreshCut): VerifiedContactCard visar maskerat mobilnummer som verifierad kontakt | SPEC §13, §6.1 | STATES + MOBIL/DESKTOP; `[data-screen="profil"][data-state="readonly"]` i FreshCut-fixturen | 390×844 | DOM | CP-VC-serien; SMS-raden maskerad; en (1) verifierad kanal | EJ KÖRD |
| ACC-B-045 | E-postvariant utan telefon (Nordverk): endast e-postrad — ingen tom telefonrad — samt åtgärden "Lägg till mobilnummer" | SPEC §13, §6.2 | STATES; `[data-screen="profil"][data-state="readonly"]` i Nordverk-fixturen | — | DOM+GREP | Unionen `sms | email` renderas exklusivt; CP-VC-07 finns; ingen tom telefonrad eller platshållare | EJ KÖRD |

### B12. Dubbelverifierat kontaktbyte — `ContactChangeFlow` (SPEC §14, §24.13; flöde F7)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-046 | Start: koden går ALLTID till NUVARANDE kontakt; scrim stänger inte overlayn | SPEC §14, §24.13 (ST-CCF-01) | STATES + F7; `[data-screen="profil"][data-state="ccf_start"]` | 390×844 | DOM | ContactChangeFlow steg 1; CP-CCF-01–06 | EJ KÖRD |
| ACC-B-047 | Step-up till aktuell kontakt: SMS-spår (FreshCut) och e-postspår (Nordverk) med rätt kanalcopy | SPEC §24.13 (ST-CCF-02/03) | STATES + F7/F13; `[data-screen="profil"][data-state="ccf_stepup_sms"]` och `…="ccf_stepup_email"` | — | DOM | CP-CCF-10 resp. CP-CCF-11, + CP-CCF-12–14 | EJ KÖRD |
| ACC-B-048 | Step-up-fel: invalid/expired/max_attempts; cooldown/omskick ärver CP-PIN-11/12/13 | SPEC §24.13 (ST-CCF-04) | STATES; `[data-screen="profil"][data-state="ccf_stepup_error"]` | — | DOM | CP-CCF-15/16/17 | EJ KÖRD |
| ACC-B-049 | Supportspärr `channel_unavailable`: klickbar länk till neutral hjälpvy, men INGEN alternativ verifiering | SPEC §14, §24.13 (ST-CCF-05) | STATES + F7; `[data-screen="profil"][data-state="ccf_channel_unavailable"]` | 390×844 | KLICK+DOM+GREP | CP-CCF-08 öppnar hjälpvy CP-CCF-39–41 med exakt CP-CCF-40 och exakt en fungerande publik kontaktväg CP-TID-03/CP-DET-15; 0 reserv-/ny-destinations-/dokument-/personalsessionskontroller; Tillbaka återgår till steg 1 | EJ KÖRD |
| ACC-B-050 | Ny destination: exakt ett kanalbundet fält; startåtgärden `change_phone`/`add_phone`/`change_email` avgör kanal; konsekvensinfo visas | SPEC §14, §24.13 (ST-CCF-06) | STATES + F7; `[data-screen="profil"][data-state="ccf_new_destination"]` | — | DOM | Telefonåtgärd: CP-CCF-20/21/33; e-poståtgärd: CP-CCF-34/35; CP-CCF-22/23; exakt 1 destinationsinput; ingen kanalhärledning ur fritext | EJ KÖRD |
| ACC-B-051 | PIN till NYA destinationen: separat challenge (ny kod ≠ steg 2-koden) + felserien fel/utgången/maxförsök | SPEC §24.13 (ST-CCF-07/08) | STATES + F7; `[data-screen="profil"][data-state="ccf_new_pin_sent"]` och `…="ccf_new_pin_error"` | — | DOM | CP-CCF-24/25 resp. CP-CCF-26–28 | EJ KÖRD |
| ACC-B-052 | Konflikt: åtgärdsspecifikt telefon-/e-postfel — ingen merge, inget avslöjande av annan kundrelation | SPEC §14, §24.13 (ST-CCF-09) | STATES; `[data-screen="profil"][data-state="ccf_conflict"]` + F7 | — | DOM+GREP | `change_phone`/`add_phone` använder CP-CCF-29; `change_email` använder CP-CCF-38; ingen variant visar den andra relationens uppgifter eller erbjuder merge | EJ KÖRD |
| ACC-B-053 | Atomiskt byte + kvitto: `switching` idempotent vid dubbelsubmit; `done` visar åtgärdsspecifikt kvitto + konsekvensrad; nya värdet i kortet EFTER stängning | SPEC §14, §24.13 (ST-CCF-10/11) | STATES + F7; `[data-screen="profil"][data-state="ccf_switching"]` och `…="ccf_done"` | — | DOM | CP-CCF-14; `change_phone` CP-CCF-30, `add_phone` CP-CCF-36, `change_email` CP-CCF-37; CP-CCF-31/32; efter `add_phone` är mobil primär och tidigare verifierad e-post maskerad reservkontakt | EJ KÖRD |

### B13. Säkerhet — två listor + destruktiva dialoger (SPEC §11, §15, §24.14; flöde F8)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-054 | Portalsessionslistan: en session = endast aktuell med badge, INGEN samlingsknapp; flera = aktuell först, per-rad + samlingsknapp (≥2); `only_current` efter logga-ut-övriga = samlingsknapp borta | SPEC §15, §24.14 (ST-SEC-01/02/08) | STATES + MOBIL/DESKTOP; `[data-screen="sakerhet"][data-state="one_session"]`, `…="many_sessions"`, `…="only_current"` | 390×844 | DOM | PortalSessionList; CP-SEC-03–09; samlingsknappen villkorad på ≥2 | EJ KÖRD |
| ACC-B-055 | Booking trust-listan: egen `<section>` "PIN-fria bokningsenheter" — slås ALDRIG ihop med sessionslistan; tomläge CP-SEC-17 | SPEC §11, §24.14 (ST-SEC-03) | STATES; `[data-screen="sakerhet"][data-state="trusts"]` | — | DOM | BookingTrustList; CP-SEC-13–16 (tom: CP-SEC-17); två separata hostkontexter i UI | EJ KÖRD |
| ACC-B-056 | Destruktiv dialog: FEM varianter enligt §15-variantmatrisen med rätt rubrik/konsekvenstext per variant + sekundär Avbryt | SPEC §15, §24.14 (ST-SEC-04) | STATES + F8; `[data-screen="sakerhet"][data-state="revoke_dialog"]` | — | DOM | DestructiveActionDialog; CP-DLG-01–15 + CP-DLG-16; trust-varianter lovar aldrig cookie-radering på andra hosten (CP-DLG-11/14) | EJ KÖRD |
| ACC-B-057 | Revoke pending + fel: pending låser Avbryt + `Esc`; fel lämnar dialog kvar och INGET ändrat | SPEC §24.14 (ST-SEC-05/07) | STATES + F8; `[data-screen="sakerhet"][data-state="revoke_pending"]` och `…="revoke_error"` | — | DOM | CP-DLG-17/18 resp. CP-DLG-19 + CP-SEC-11/12/19/20 | EJ KÖRD |
| ACC-B-058 | Revoke success: rad/post borta, annons `role="status"`, idempotent vid upprepning | SPEC §24.14 (ST-SEC-06) | STATES + F8; `[data-screen="sakerhet"][data-state="revoke_success"]` | — | DOM | CP-SEC-10/18; listan uppdaterad utan helsidesladdning | EJ KÖRD |

### B14. Utloggning + återhämtning (SPEC §2.5, §4.2–4.3, §24.5–24.6; flöde F11)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-B-059 | Utloggning (CP-PROF-14/CP-TOP-05) och `session_expired`: leder ALLTID till `aterhamta`-vägen med toast CP-REC-11 — ALDRIG en login-vy | SPEC §2.5, §24.6 (ST-PORT-03) | STATES; `[data-screen="mina"][data-state="session_expired"]` + utloggningsvägen | — | DOM+GREP | CustomerPortalShell → recovery; 0 login-/lösenordsyta i utloggat läge | EJ KÖRD |
| ACC-B-060 | Recovery-formulär: ETT fält med klientvalidering (CP-REC-04); `pending` = "Skickar…" med låst knapp | SPEC §4.2, §24.5 (ST-REC-01/04) | STATES + F11; `[data-screen="aterhamta"][data-state="default"]` och `…="pending"` | 390×844 | DOM | RecoveryForm; CP-REC-01–05, CP-REC-06/07 | EJ KÖRD |
| ACC-B-061 | Servervald kanal: SMS-spår (FreshCut) och e-postspår (Nordverk); maskerad rad visas FÖRST efter utskick | SPEC §4.3, §24.5 (ST-REC-02/03) | STATES + F11/F13; `[data-screen="verifiera"][data-state="sent_sms"]` och `…="sent_email"` | — | DOM | PinVerificationForm `mode="recovery"`; CP-VER-01/02/03/05 resp. CP-VER-01/02/04/05 | EJ KÖRD |
| ACC-B-062 | Verifiera-felserien: `sending`/`invalid`/`cooldown`/`expired`/`max_attempts`/`delivery_failed` med kanalNEUTRAL felrad i leveransfelet | SPEC §4.3, §24.5 (ST-REC-05–10) | STATES; `[data-screen="verifiera"][data-state="sending"]`, `…="invalid"`, `…="cooldown"`, `…="expired"`, `…="max_attempts"`, `…="delivery_failed"` | — | DOM | CP-VER-02/08/09/12/13/14; invalid = `role="alert"` med fokus åter i fältet | EJ KÖRD |
| ACC-B-063 | Recovery `verified`: portalsession etableras + `replace` till `/mina` — tokenfri adress | SPEC §24.5 (ST-REC-11) | STATES + F11; `[data-screen="verifiera"][data-state="verified"]` | — | DOM | CP-VER-15; simulerad navigering till startsidan | EJ KÖRD |

---

## Del C av 3 — PWA, tillgänglighet, paritet, säkerhet och slutgrind

### C1. PWA-manifest + service worker (SPEC §16, §20; COMPONENTS §23)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-001 | Manifestets `name`/`short_name` är exakt "Mina bokningar · Corevo" / "Mina bokningar" | SPEC §16; COMPONENTS §23 | Manifestdefinitionen i paketet (SPEC §16 + prototypernas manifest-referens) | — | DOK+GREP | Exakta strängar inklusive mittpunkt; avvikelse i stavning/kortform = FAIL | EJ KÖRD |
| ACC-C-002 | Manifestets `id`, `start_url` och `scope` är alla exakt `/mina/`; `display: standalone`; Corevos neutrala appikon | SPEC §16 | Samma som ACC-C-001 | — | DOK+GREP | Alla tre fält = `/mina/`; standalone; ingen tenantikon | EJ KÖRD |
| ACC-C-003 | Manifestet innehåller INGEN persondata, tenantdata eller state-query | SPEC §16 | Samma som ACC-C-001 | — | GREP | 0 träffar på namn/telefon/e-post/tenantSlug/queryparametrar i manifestvärden | EJ KÖRD |
| ACC-C-004 | `public/kund-sw.js` återanvänds INTE; eventuell separat v1-worker har scope `/mina/`, network-only för portalsidor och cachar ALDRIG personlig portaldata | SPEC §16, §20 (brief §17.1, §24.4) | SPEC §20-avsnittet; offline-läget i STATES | — | DOK+DOM | Offline-ytan (ST-PORT-05) visar ingen personlig cache-data; endast opersonligt statiskt skal/offlinefallback får cachas | EJ KÖRD |
| ACC-C-005 | Manifestet serveras via manifest-routen i filkartan (`app/api/customer-portal/manifest/route.ts`) | SPEC §16, §20 | `SPEC.md` §20 | — | DOK | Routen finns i filkartan och pekas ut av §16 | EJ KÖRD |

### C2. PWA-installationsstatemaskinen — alla lägen (SPEC §16, §24.15; flöde F9/F10)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-006 | Sluten maskin: `unsupported`/`standalone`/`eligible`/`prompted_once`/`dismissed_once`/`prompted_twice`/`dismissed_twice`/`accepted` — max TVÅ automatiska erbjudanden någonsin per enhet; räknaren nollställs aldrig vid utloggning | SPEC §16, §24.15 (ST-PWA-02–07) | STATES; `[data-screen="mina"][data-state="pwa_*"]` alla | 390×844 | DOM | Alla lägen träffbara; efter `dismissed_twice` visas aldrig kortet på `/mina` igen | EJ KÖRD |
| ACC-C-007 | Android/Chromium: native-prompten anropas ENDAST som direkt svar på klick på CP-PWA-03; offline = CTA `aria-disabled` + CP-PWA-06 | SPEC §16-miljötabellen, §24.15 (ST-PWA-03) | STATES + F9; `[data-screen="mina"][data-state="pwa_prompted"]` | 390×844 | DOM | Ingen auto-prompt vid sidladdning; klick→prompt-simulering | EJ KÖRD |
| ACC-C-008 | Chromium utan `beforeinstallprompt`: ENDAST länken CP-PWA-05 "Så installerar du" — aldrig en knapp som låtsas installera | SPEC §16-miljötabellen | STATES; miljövarianten i PWA-galleriet | — | DOM+GREP | Länk, inte knapp; 0 fejk-installations-CTA | EJ KÖRD |
| ACC-C-009 | iOS-guiden: CP-IOS-01 "Visa hur" → IosInstallGuide med CP-IOS-02 + tre låsta iOS-ordagranna steg CP-IOS-03/04/05 + CP-IOS-06/07; inline på `/mina/installera` utan stängknapp | SPEC §16, §24.15 (ST-PWA-08) | STATES + F10; `[data-screen="installera"][data-state="ios_guide"]` | 390×844 | DOM+GREP | Stegtexterna ordagranna enligt COPY.md; inline-varianten saknar stängknapp | EJ KÖRD |
| ACC-C-010 | In-app-webbläsare: CP-APP-01 + "Kopiera länken" (CP-APP-02→03) + steg CP-APP-04–06; CP-APP-07 "Öppna i Safari" ENDAST vid verifierad systemåtgärd; urklippsfel CP-APP-08 | SPEC §16, §24.15 (ST-PWA-09) | STATES + F10; `[data-screen="installera"][data-state="in_app"]` | 390×844 | DOM | Kopiera-flödet komplett; ingen ovillkorad "Öppna i Safari"-knapp | EJ KÖRD |
| ACC-C-011 | `standalone`: allt installations-UI dolt på `/mina`; `/mina/installera` visar CP-INST-03 "Appen är installerad." | SPEC §16, §24.15 (ST-PWA-10) | STATES; `[data-screen="installera"][data-state="standalone"]` | — | DOM | 0 installationskort i standalone; exakt CP-INST-03 | EJ KÖRD |
| ACC-C-012 | `unsupported`: inget kort på `/mina`; `/mina/installera` förklarar med CP-INST-02; sidan alltid nåbar även efter `dismissed_twice` | SPEC §16, §24.15 (ST-PWA-01/06) | STATES; `[data-screen="installera"][data-state="unsupported"]` | — | DOM | CP-INST-02; navposten/länken till `installera` aldrig gatad | EJ KÖRD |
| ACC-C-013 | Sidan `/mina/installera`: dokumenttitel CP-INST-01; exakt EN h1 = CP-INST-04 "Installera på hemskärmen"; CP-PWA-01 som h2 därunder; ingen "Inte nu" på sidan; utgången session i standalone → återhämtning med toast CP-REC-11, aldrig vit skärm/loop/login | SPEC §16, §4.10 | MOBIL/DESKTOP + STATES; `[data-screen="installera"]` | 390×844 | DOM | Rubrikhierarkin exakt; standalone-session-utgång leder till `aterhamta` | EJ KÖRD |

### C3. Återstående §24-states + övriga routes (SPEC §24.6, §4.4, §4.11)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-014 | Portal `loading`: PortalSkeleton med skeletons `aria-hidden`, ETT statiskt textalternativ (CP-SKEL-01), noll live-spam | SPEC §24.6 (ST-PORT-01) | STATES; `[data-screen="mina"][data-state="loading"]` | 390×844 | DOM | Inga `aria-live`-annonser från skeletons; exakt en textfallback | EJ KÖRD |
| ACC-C-015 | Portal `normal`: fullt interaktiv startsida i skalet (topbar+nav+innehåll) | SPEC §24.6 (ST-PORT-02) | STATES + MOBIL/DESKTOP; `[data-screen="mina"][data-state="normal"]` | 390×844 + 1440×900 | DOM | CustomerPortalShell komplett; §4.5-serien renderad | EJ KÖRD |
| ACC-C-016 | Portal `server_error`: PortalErrorState i `<main>` med CP-ERR-01–05, retry-CTA, inga databastermer | SPEC §24.6 (ST-PORT-04) | STATES; `[data-screen="mina"][data-state="server_error"]` | — | DOM+GREP | 0 träffar på "database", "SQL", "500", stacktrace-text | EJ KÖRD |
| ACC-C-017 | Portal `offline`: PortalErrorState CP-OFF-01–03 ERSÄTTER innehållet; ingen personlig cache-data syns | SPEC §24.6 (ST-PORT-05), §16 | STATES; `[data-screen="mina"][data-state="offline"]` | — | DOM+GREP | Endast statiskt skal + felyta; 0 bokningsdata/namn i offline-läget | EJ KÖRD |
| ACC-C-018 | State-registret är slutet: varje ST-rad i SPEC §24 (alla 15 områden) har träffbar `[data-screen][data-state]`-yta i STATES — och ingen yta i STATES saknar ST-rad | SPEC §24 (slutrad); §22.3 | STATES hela; `SPEC.md` §24 | — | DOM+DOK | 1:1-mappning båda riktningarna; avvikelse åt något håll = FAIL | EJ KÖRD |

### C4. Tillgänglighet — WCAG 2.2 AA (SPEC §19; brief §20)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-019 | Landmärken + rubriker: skip-länk CP-SHELL-01 först i DOM; `<main id="huvudinnehall">`; exakt EN synlig h1 per vy med korrekt hierarki | SPEC §19 | Alla `.dc.html`, varje huvudvy | 390×844 | DOM | Skip-länk fungerar; h1-räkning = 1 per vy; ingen nivåhoppning | EJ KÖRD |
| ACC-C-020 | Full tangentbordsnavigation i logisk DOM-ordning genom samtliga huvudvyer; ikonknappar har tillgängligt namn (CP-A11Y-registret) | SPEC §19; COPY CP-A11Y-01–05 | MOBIL + DESKTOP, tab-genomgång | 390×844 + 1440×900 | DOM | Alla interaktiva element nåbara i ordning; 0 namnlösa ikonknappar | EJ KÖRD |
| ACC-C-021 | Alla dialoger (CancelBookingDialog, DestructiveActionDialog, ContactChangeFlow): `role="dialog"`, fokusfälla, `Esc` stänger (utom låsta pending-lägen), fokusåtergång till utlösande element | SPEC §19, §24.10, §24.14 | STATES + F3/F7/F8, alla overlay-lägen | 390×844 | DOM | Fokus fångad i dialogen; efter stängning ligger fokus på öppningsknappen | EJ KÖRD |
| ACC-C-022 | Formfel via `aria-describedby`; bekräftelser `role="status"`/`aria-live="polite"`, fel `role="alert"` — exakt enligt live-regionslistan i COPY §23; aggressiv alert för icke-fel = FAIL | SPEC §19; COPY §23 | STATES; alla fel-/successlägen | — | DOM | Varje live-region matchar listan; 0 alerts på bekräftelser | EJ KÖRD |
| ACC-C-023 | Pekytor ≥44×44px på VARJE interaktiv kontroll i alla vyer (utökar ACC-A-039 till hela ytinventariet inkl. STATES-lägen) | SPEC §19; TOKENS `--tap-min` | Alla `.dc.html`, alla interaktiva element | 390×844 | DOM | 0 kontroller under 44px i någon vy eller något state | EJ KÖRD |
| ACC-C-024 | Kontrast AA: text/ikoner/chips klarar WCAG AA mot sina bakgrunder i samtliga färgklasser (`--warning`/`--positive`/`--negative` inkluderade) | SPEC §19; TOKENS §2 | Alla `.dc.html`, stickprov 15 par | — | DOM | Alla mätta par ≥4.5:1 (normal) / ≥3:1 (stor text/UI) | EJ KÖRD |
| ACC-C-025 | Status aldrig enbart färg: varje BookingStatusChip + navmarkering + felindikering bär text och/eller ikonform utöver färgen | SPEC §19, §8 | STATES; alla chips + aktiv nav | — | DOM | Gråskale-check: alla statusar särskiljbara utan färg | EJ KÖRD |
| ACC-C-026 | 200 % zoom + textförstoring: alla huvudvyer fungerar utan förlorat innehåll eller överlapp | SPEC §19 | MOBIL + DESKTOP, browser-zoom 200 % | 1440×900 | VIEW | Ingen klippt text/kontroll; ingen horisontell scroll av zoom | EJ KÖRD |
| ACC-C-027 | Landscape på liten mobil fungerar: bottennav täcker inte innehåll, dialog/sheet ryms med tangentbord öppet | SPEC §19 | MOBIL, huvudvyer + dialoger | 568×320 (landscape) | VIEW | Allt nåbart och läsbart i liggande läge | EJ KÖRD |
| ACC-C-028 | `prefers-reduced-motion`, `prefers-contrast` och forced colors respekteras: animationer avstängbara, fokus/kontroller synliga i forced colors-läge | SPEC §19 | Alla `.dc.html` CSS; devtools-emulering | — | DOM+GREP | `@media (prefers-reduced-motion)`-regler finns; forced colors bryter inte fokusring/chips | EJ KÖRD |
| ACC-C-029 | Begripliga datum för skärmläsare (inga råa ISO-strängar som enda tillgängliga namn) | SPEC §19 | `.dc.html` datumelement, stickprov 5 | — | DOM | Tillgängligt namn = läsbart svenskt datum | EJ KÖRD |

### C5. Responsiv paritet — sex viewports, ingen desktop-extra (SPEC §25, §26, §19)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-030 | Desktop/mobil-paritet: desktop introducerar INGA egna funktioner — samma kortordning, etiketter och actions som mobil; enda skillnaderna = §25-tabellens | SPEC §25 | MOBIL vs DESKTOP, vy-för-vy-jämförelse | 390×844 vs 1440×900 | VIEW+DOK | Varje avvikelse spårbar till §25-tabellen; ospecad skillnad = FAIL | EJ KÖRD |
| ACC-C-031 | Alla sex viewports (320×568, 390×844, 430×932, 768×1024, 1024×768, 1440×900): nästa bokning + primär handling synliga utan onödigt tomrum | SPEC §26, §19 | MOBIL/DESKTOP startsidan | alla sex | VIEW | NextBookingCard + primär CTA ovanför onödig scroll i varje viewport | EJ KÖRD |
| ACC-C-032 | Bottennav täcker aldrig innehåll (sista elementet nåbart); dialog/sheet ryms med simulerat tangentbord öppet | SPEC §19, §26 | MOBIL; scrollbotten + dialoglägen | 320×568 + 390×844 | VIEW | Padding-bottom kompenserar navhöjd; dialogens knappar nåbara | EJ KÖRD |
| ACC-C-033 | Layouten fungerar utan logotyp och utan hero-bild (fixture utan `logoUrl`) | SPEC §19, §17 | `.dc.html` med logotypfritt läge | 390×844 | DOM | Ingen trasig bildplats; ordning bevarad | EJ KÖRD |
| ACC-C-034 | Svenska datum och priser får plats i alla sex viewports utan klippning | SPEC §19, §26 | MOBIL/DESKTOP kort + detalj | alla sex | VIEW | 0 avhuggna datum-/prissträngar | EJ KÖRD |

### C6. Säkerhetsneutralitet i UI (SPEC §17; COPY §25; §8, §14)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-035 | Neutrala fel överallt: inga felmeddelanden avslöjar om ett konto/en bokning/en kontaktuppgift existerar (ägarskaps-404, kalenderfel, CCF-konflikt, recovery) | SPEC §8, §14, §17; COPY §25 | STATES; alla fellägen | — | DOM+GREP | Samma text för existerande/icke-existerande resurs i varje felpar | EJ KÖRD |
| ACC-C-036 | Ingen enumeration via recovery: `aterhamta` svarar identiskt oavsett om kontaktuppgiften finns i systemet | SPEC §4.2; COPY §25 | STATES; `[data-screen="aterhamta"]` + `verifiera`-utskickslägen | — | DOM | Utskicksbekräftelsen avslöjar aldrig träff/icke-träff | EJ KÖRD |
| ACC-C-037 | Inga interna ID:n renderade: `tenantId`, `customerId`, sessions-`id` aldrig synliga; boknings-`id` endast i route, aldrig som säkerhet | SPEC §17-tabellen | Alla `.dc.html` DOM + synlig text | — | GREP+DOM | 0 UUID:n i synlig text; ID endast i URL-simulering | EJ KÖRD |
| ACC-C-038 | Inga tokens eller PIN-koder i klartext i någon rendering; destinationer alltid maskerade; opersonligt fel-ID | COPY §25; SPEC §17 | Alla `.dc.html`; alla PIN-/länklägen | — | GREP | 0 träffar på fullständigt telefonnummer/e-post/token/PIN-värde utanför maskering | EJ KÖRD |
| ACC-C-039 | Fabricerad fallbackdata förbjuden: saknade optionalfält döljer sin rad (bevarad ordning); pris aldrig fabricerat; `publicRebookUrl` saknas → BookAgainButton renderas inte | SPEC §17 | STATES + Nordverk-fixturen | — | DOM | 0 platshållare som ser verkliga ut; dold prisrad i Nordverk bevisas | EJ KÖRD |

### C7. Fixturernas optionalfält och långa namn (SPEC §6.2, §17, §19)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-040 | Nordverk bevisar optionalfälten: ingen telefonrad, dold prisrad, plats per bokning (Hälla/Erikslund) — allt utan tomma platshållare | SPEC §6.2, §17 | `.dc.html` Nordverk-fixturen; kort + detalj + profil | 390×844 | DOM | Raderna frånvarande (inte tomma); ordningen bevarad | EJ KÖRD |
| ACC-C-041 | Långa företags-/tjänste-/personalnamn bryts eller trunkeras med fulltext tillgänglig — Nordverk-tjänsten är testfallet | SPEC §19, §6.2 | `.dc.html` Nordverk-tjänsten i kort/lista/detalj | 320×568 + 390×844 | VIEW+DOM | Ingen overflow; trunkerad text har fulltext via tillgängligt namn/title | EJ KÖRD |
| ACC-C-042 | FreshCut-fixturen komplett: SMS-kanal, en plats, telefonrad + prisrad synliga — kontrasten mot Nordverk bevisar villkorsrenderingen | SPEC §6.1, §13 | `.dc.html` FreshCut-fixturen | 390×844 | DOM | Alla FreshCut-fält renderade; fixturbyte togglar raderna korrekt | EJ KÖRD |

### C8. Dokumentkorslänkar + filkravet (README; SPEC §1, §18, §28)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-043 | Korslänksintegritet: varje COPY-ID som refereras i SPEC/COMPONENTS/prototyper finns i COPY.md; varje komponentnamn i SPEC §18 finns i COMPONENTS.md; varje token som refereras finns i TOKENS.md | SPEC §1.1, §18 | Alla .md-filer, korsläsning + stickprov 20 referenser | — | DOK+GREP | 0 döda referenser åt något håll | EJ KÖRD |
| ACC-C-044 | Exakt 10-filskravet håller efter komplettering: katalogen innehåller exakt de tio kanoniska filerna — varken fler eller färre (omkontroll av ACC-A-001 vid granskningstillfället) | README §"tio kanoniska filer" | Paketkatalogen | — | FIL | `ls` visar exakt 10 filer med README:s namn | EJ KÖRD |
| ACC-C-045 | FEATURE-MATRIX ↔ ACCEPTANCE-MATRIX-täckning: varje `NU`-rad i FEATURE-MATRIX har minst en ACC-rad; ingen ACC-rad testar funktion utanför FEATURE-MATRIX | FEATURE-MATRIX.md; denna fil | Båda matriserna | — | DOK | 1:1-täckningskontroll dokumenterad utan luckor | EJ KÖRD |

### C9. Produktionsgrind — öppen säkerhetsblockerare (SPEC §21; brief §25.2)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-046 | ⛔ corevo-sms lagrar meddelande-body i klartext (inkl. backuper): recipient + body måste persistas med autentiserad kryptering och redigering i backuper INNAN riktiga PIN-koder/portal-tokens skickas i produktion. Denna rad får ALDRIG sättas till PASS på grundval av den visuella prototypen — endast verifierad gateway-fix kvalificerar | SPEC §21; brief §25.2 | corevo-sms-transportkedjan (utanför designpaketet); `SPEC.md` §21 | — | DOK | BLOCKER tills gateway fix verifierad | EJ KÖRD |
| ACC-C-047 | Grindregel: så länge ACC-C-046 är öppen får PIN-flödet (§9), portallänkarna (§7) och recovery-utskicken (§4.2–4.3) INTE driftsättas med riktig trafik — designpaketet får mocka kedjan men aldrig markera flödena driftklara | SPEC §21 | Denna matris + driftbeslut | — | DOK | Dokumenterat driftstopp tills ACC-C-046 stängd; prototypgodkännande ≠ driftklart | EJ KÖRD |

### C10. Slutresultat-liggare (README-regeln; SPEC §28)

| ACC-ID | Krav | Source ref | Fil/selector | Viewport | Metod | Förväntat | Status |
|---|---|---|---|---|---|---|---|
| ACC-C-048 | Slutsammanräkning: när granskningen körts förs antal PASS / FAIL / BLOCKER / EJ KÖRD in här med datum och granskarens namn | README-regeln (rad 3); SPEC §28 | Denna fil, samtliga ACC-rader | — | DOK | Fullständig räkning; inga rader kvar utan slutstatus | EJ KÖRD |
| ACC-C-049 | Varje PASS bär bevisreferens: skärmdump, grep-utdrag, DOM-dump eller filhänvisning antecknad i statuskolumnen — PASS utan bevis räknas som EJ KÖRD | README-regeln (rad 3) | Denna fil, alla rader med status PASS | — | DOK | 0 PASS utan bevislänk | EJ KÖRD |
| ACC-C-050 | Implementationsgrind: en (1) FAIL eller öppen BLOCKER någonstans i matrisen stoppar implementationsstart enligt SPEC §28 — designpaketet är inte design-done förrän allt är PASS eller medvetet undantaget med skriftligt beslut | SPEC §28; §21 | Hela matrisen | — | DOK | Grindbeslutet dokumenterat; ACC-C-046 räknas alltid in | EJ KÖRD |

---

**ACCEPTANCE KOMPLETT — ALLA EJ KÖRD**
