# COMPONENTS.md — Komponentkontrakt

**Produkt:** Kundportal, lösenordsfri PWA v1 (Corevo)
**Status:** BINDANDE. Läses tillsammans med `TOKENS.md` (tokenlagen). Vid konflikt vinner TOKENS.md.
**Omfattning denna del:** Gemensamt kontrakt + CustomerPortalShell, CustomerPortalTopbar, CustomerPortalNavigation, PrototypeFixtureControl.

---

## 0. Gemensamt komponentkontrakt

Gäller ALLA komponenter i dokumentserien.

### 0.1 Grundregler

- **Tokenlag:** Alla färger, spacing, radius, skuggor, z-index, motion konsumeras via `var(--…)` från TOKENS.md §1. Hårdkodat värde som finns som token = FAIL.
- **Tema:** Endast Corevo dark. Ingen tema-prop, ingen light mode.
- **Språk:** All UI-text på svenska. Dokumentet har `lang="sv"`.
- **Tenant-isolering:** En rendering visar EXAKT en tenant (FreshCut **eller** Nordverk). Ingen komponent får samtidigt rendera data, namn, logotyp eller färg från två tenants. Blandning = FAIL.
- **Ingen v1-scope-läcka:** Inga komponenter, props, navposter eller CTA:er för login/lösenord, "Mina företag", lojalitet, erbjudanden eller push-notiser. Förekomst = FAIL.
- **Session:** Utgången/ogiltig session leder ALLTID till recovery-flödet (`/aterhamta/[tenantSlug]`), aldrig till en login-vy (login existerar inte i produkten).
- **States (kanonisk uppsättning):** varje komponent definierar sitt beteende för `default`, `loading` (skeleton enligt TOKENS §12.5), `empty`, `error` och där relevant `session-expired`. Ospecificerat state ärver `default`.
- **Fokus:** `:focus-visible`-ring enligt TOKENS §6.2 på allt fokusbart. Fokusordning = visuell ordning. Fokusring får inte klippas (§6.2).
- **Träffytor:** ≥ 44×44px (`--tap-min`) på alla kontroller.
- **Hover:** endast bakom `@media (hover: hover)`.
- **Motion:** 120–200ms, `--motion-duration`/`--motion-ease`, reduced motion enligt TOKENS §7.

### 0.2 Props-disciplin

- "Tillåtna kundsynliga props" nedan är en **sluten lista**: det som kan påverka vad slutkunden ser. Interna implementation-props (callbacks, refs, testid) är tillåtna men får inte ändra kundsynligt utseende utanför kontraktet.
- Ingen prop får ta emot råa stilvärden (`color`, `className` för tema-override etc.) som kringgår tokenlagen.
- Tenantdata (namn, logotyp) kommer alltid från sessionens tenant-kontext — aldrig som fri prop från anropande sida.

### 0.3 Breakpoints (kanon, från TOKENS §8)

| Läge | Spann | Navigation |
|---|---|---|
| Mobil | 0–767px | Topbar 60px + bottennav |
| Tablet | 768–1023px | Topbar 60px + bottennav (samma som mobil) |
| Desktop | ≥1024px | Topbar 56px + vänsternav 232px, ingen bottennav |

---

## 1. CustomerPortalShell

### Syfte

Yttersta layoutramen för hela kundportalen. Äger sid-skelettet (topbar + navigation + innehållsyta), tenant-kontexten, session-vakten och landmärkesstrukturen. Alla portalsidor renderas som barn i shellens `<main>`.

### Route/placering

- Layoutkomponent för alla portal-routes: `/mina` (start), `/mina/bokningar/[id]`, `/mina/historik`, `/mina/profil`, `/mina/sakerhet`, `/mina/installera` och `/mina/integritet`. Det publika recovery-flödet ligger på `/aterhamta/[tenantSlug]`.
- I recovery-läge (`/aterhamta/[tenantSlug]`) renderas shell **utan navigation** (topbar utan navelement, ingen bottennav/vänsternav) — användaren har ingen giltig session att navigera med.
- Renderas exakt en gång per sida; sidor får inte nästla shell.

### DOM/ARIA-ordning

1. Skip-länk `<a href="#huvudinnehall">Hoppa till innehåll</a>` — första fokusbara elementet, visuellt dold tills fokus (renderas då på `--surface-3`, ring §6.2).
2. `<header>` → `CustomerPortalTopbar`.
3. Desktop: `<nav aria-label="Huvudmeny">` (vänsternav, del av `CustomerPortalNavigation`).
4. `<main id="huvudinnehall" tabindex="-1">` — sidans innehåll. Exakt ett `<main>` per dokument.
5. Mobil/tablet: `<nav aria-label="Huvudmeny">` (bottennav) — sist i DOM men visuellt fäst i botten; fokusordningen accepteras eftersom navet är sista logiska blocket.
6. Allra sist: `PrototypeFixtureControl` (endast prototyp, se §4).

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `variant` | `"standard" \| "recovery"` | `recovery` döljer all navigation (se ovan). |
| `children` | ReactNode | Sidinnehåll i `<main>`. |

Ingen tenant-prop: tenant läses ur sessionskontexten.

### States

- **default:** full layout enligt aktuellt breakpoint.
- **loading (session avgörs):** den neutrala Corevo-topbaren renderas direkt, `<main>` visar skeleton enligt TOKENS §12.5; navigation renderas men ingen post markeras aktiv förrän route är känd.
- **session-expired:** shell navigerar till `/aterhamta/[tenantSlug]` och byter till `variant="recovery"`. Ingen login-vy, ingen dialog "logga in igen". Ett toast-meddelande ("Din session har gått ut. Verifiera dig igen.") är tillåtet enligt TOKENS §11.
- **error (oåterkalleligt fel):** `<main>` visar felyta (h2 `--ink-1`, brödtext `--ink-2`, sekundär knapp "Försök igen"); navigation förblir funktionell.

### CTA/interaktion/keyboard/fokus

- Skip-länken flyttar fokus till `<main>` (`tabindex="-1"`).
- Vid route-byte: fokus sätts på `<main>` (eller sidans h1), dokumenttiteln uppdateras `"{Sidnamn} – {Tenantnamn}"`.
- Shell fångar aldrig fokus; fokusfällor tillhör endast dialog/sheet (TOKENS §11).
- Innehållet får `padding-bottom` ≥ `--bottomnav-h` + `--space-4` på mobil/tablet (TOKENS §8.4).

### Mobil/tablet/desktop

- **Mobil (0–767):** en kolumn, full bredd, gutters `--gutter-mobile` (16px; 20px från ≥390px). Topbar 60px sticky, bottennav fäst i botten.
- **Tablet (768–1023):** som mobil men innehåll max `--container-tablet` (760px) centrerat, gutters 20px. Fortfarande bottennav.
- **Desktop (≥1024):** topbar 56px, därunder grid max `--container-desktop` (1248px): vänsternav `--col-left` (232px) + huvud `--col-main` (680px) + höger `--col-right` (288px) + två gap `--layout-gap` (24px). 1024–1247px: högerkolumnen faller ned under huvudkolumnen (TOKENS §8.3), vänsternav behålls.

### Tokens

`--bg` (app-bakgrund, enda tillåtna), `--topbar-h-mobile/-desktop`, `--bottomnav-h`, `--gutter-mobile`, `--container-tablet/-desktop`, `--col-left/-main/-right`, `--layout-gap`, `--space-4/-6` (topp-padding under topbar: 16 mobil / 24 desktop), `--z-content/-sticky/-nav`, `--font-ui`.

---

## 2. CustomerPortalTopbar

### Syfte

Sticky toppbar som bär Corevos neutrala säkerhetsidentitet och ger orienteringspunkt. Företagets identitet hör till `TenantIdentityCard` inne i innehållet och får aldrig ersätta Corevo i toppbaren. Topbaren är **inte** huvudnavigation på mobil/tablet och innehåller aldrig login-, notis- eller företagsspecifik logotyp.

### Route/placering

- Renderas av `CustomerPortalShell` som `<header>` överst på alla routes, inklusive `/aterhamta/[tenantSlug]`.
- Sticky: `position: sticky; top: 0; z-index: var(--z-sticky)`.

### DOM/ARIA-ordning

1. `<header>` med 1px `--line-1` underkant, bg `--bg` eller `--surface-1` (ett val per bygge, konsekvent på alla sidor).
2. Vänster identitetsblock: textlogotyp `COREVO` och monoetiketten `MINA BOKNINGAR`; länkas till `/mina` endast när en giltig portalsession finns.
3. Mobil/tablet: höger profilknapp med initialer eller neutral personikon, `aria-label="Öppna profil"`, mål `/mina/profil`, minst 44×44 px. På bokningsdetalj ersätts den av synlig `Tillbaka` enligt det verifierade ursprungskontraktet.
4. Desktop: höger visar kundens förnamn/initialer och en diskret `Logga ut`-åtgärd med definierad dialog; ingen tenantlogotyp, notis eller sök.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `interactive` | `boolean` (default `true`) | `false` i recovery-läge: Corevo-identiteten renderas statiskt och profil/logout döljs. |
| `detailBackTarget` | `'/mina' \| '/mina/historik' \| null` | Synlig detaljtillbaka; deep-link-fallback är alltid `/mina`. |

Kundinitialer kommer ur den verifierade portalsessionens snapshot. Företagsnamn/logotyp är förbjudna props här.

### States

- **default:** enligt ovan.
- **loading:** statisk Corevo-identitet ligger kvar; endast profilinitialen får vara neutral skeleton. Ingen layout-shift.
- **detail:** profilknapp ersätts av `Tillbaka`; direkt SMS/PWA/deep-link går till `/mina`.
- **error/session-expired:** Corevo-identiteten ligger kvar; sessionstyrda åtgärder döljs i recovery.

### CTA/interaktion/keyboard/fokus

- Corevo-hemlänken går till `/mina`; profil går till `/mina/profil`; desktop-logout öppnar definierad destruktiv dialog.
- Hover används endast under `@media (hover: hover)`. Fokus följer TOKENS §6.2 och får inte klippas.

### Mobil/tablet/desktop

- **Mobil/tablet:** höjd `--topbar-h-mobile` (60px), horisontell padding = sidans gutter. Respekterar `env(safe-area-inset-top)` (höjd + inset som padding).
- **Desktop:** höjd `--topbar-h-desktop` (56px), full bredd; innehållet linjeras med `--container-desktop`-gridens vänsterkant.
- Samma Corevo-identitet i alla lägen; högeråtgärder skiljer deterministiskt enligt mobil/desktop och detaljläge.

### Tokens

`--topbar-h-mobile`, `--topbar-h-desktop`, `--bg`/`--surface-1`, `--line-1`, `--ink-1`, `--font-ui`, `--text-h3-*`, `--logo-max`, `--z-sticky`, `--tap-min`, `--gutter-mobile`, `--focus-ring-*`.

---

## 3. CustomerPortalNavigation

### Syfte

Portalens enda navigationskomponent. Renderar exakt tre poster — **Bokningar**, **Historik**, **Profil** — som bottennav (mobil/tablet) eller vänsternav (desktop). Inga fler poster får läggas till i v1 (inga "Mina företag", erbjudanden, lojalitet — §0.1).

### Route/placering

- Renderas av `CustomerPortalShell` på alla routes utom `variant="recovery"`.
- Poster → routes: Bokningar → `/mina`, Historik → `/mina/historik`, Profil → `/mina/profil`. `/mina/bokningar/[id]` markerar Bokningar; `/mina/sakerhet`, `/mina/installera` och `/mina/integritet` markerar Profil.

### DOM/ARIA-ordning

Gemensamt (båda lägena):

```html
<nav aria-label="Huvudmeny">
  <ul>
    <li><a href="/mina" aria-current="page?">[ikon 24] Bokningar</a></li>
    <li><a href="/mina/historik">[ikon 24] Historik</a></li>
    <li><a href="/mina/profil">[ikon 24] Profil</a></li>
  </ul>
</nav>
```

- Länkar, inte knappar. Aktiv post har `aria-current="page"`.
- Ikoner 24px (`--icon-lg`), `currentColor`, `aria-hidden="true"` — labeln bär alltid texten (ingen ikon-endast-läge).
- Ordningen Bokningar → Historik → Profil är fast i DOM och visuellt, i båda lägena.

### Tillåtna kundsynliga props

Inga. Komponenten är helt styrd av route och breakpoint. (Aktiv post härleds, poster är hårdkodade i komponenten.)

### States

- **default/inaktiv post:** text+ikon `--ink-2` (TOKENS §6.3).
- **hover (hover: hover):** text/ikon `--ink-1`.
- **aktiv post, mobil/tablet:** ikon + label `--positive` (TOKENS §6.3 "Nav-post aktiv"). Färgen är inte enda signalen: `aria-current` + visuell viktökning på label (650) följer med.
- **aktiv post, desktop:** bg `--surface-2`, text `--ink-1`, 2px vänsterkant `--action` (enda tillåtna avsteget från 1px-border, per TOKENS §6.3).
- **loading:** navet renderas alltid direkt (statisk struktur, ingen skeleton); aktiv markering sätts när route är känd.
- Inga disabled-poster i v1.

### CTA/interaktion/keyboard/fokus

- `Tab` går genom posterna i DOM-ordning; ring §6.2 på varje länk (bottennavets `box-shadow`/overflow får inte klippa ringen — posterna har inre padding ≥ offset+width).
- Klick/`Enter` navigerar. Klick på redan aktiv post scrollar sidan till toppen (ingen omladdning).
- Träffyta per post ≥44×44; i bottennav fyller varje post 1/3 av bredden och hela stapelhöjden.

### Mobil/tablet/desktop

- **Mobil/tablet (0–1023):** bottennav. Höjd `--bottomnav-h` (60px + safe-area som padding-bottom), `position: fixed` botten, full bredd, bg `--surface-1`, 1px `--line-1` ovankant, `--shadow-bottom-nav`, radius 0, `z-index: var(--z-nav)`. Layout: 3 lika kolumner; per post ikon 24 över label (`--text-meta-size` 12/18, `--font-ui` — golvet 12px hålls, TOKENS §3.2).
- **Desktop (≥1024):** vänsternav i kolumn `--col-left` (232px), vertikal lista, sticky under topbaren (`top: var(--topbar-h-desktop)`), bg `--bg` (poster får `--surface-2` vid aktiv/hover), post-höjd ≥44px, ikon 24 + label `--text-compact-size` (15/22) i rad, radius `--radius-field` på postens yta (vänsterkanten 2px `--action` ligger på den aktiva postens vänstra kant), gap `--space-1` mellan poster, ingen bottennav.
- Exakt en av varianterna renderas per viewport — aldrig båda.

### Tokens

`--bottomnav-h`, `--col-left`, `--topbar-h-desktop`, `--surface-1/-2`, `--line-1`, `--shadow-bottom-nav`, `--ink-1/-2`, `--positive`, `--action`, `--icon-lg`, `--text-meta-*`, `--text-compact-*`, `--font-ui`, `--radius-field`, `--space-1`, `--tap-min`, `--z-nav`, `--focus-ring-*`.

---

## 4. PrototypeFixtureControl

### Syfte

Prototypverktyg (endast i den statiska prototypen, ALDRIG i produkt) för att växla fixtur: tenant (FreshCut / Nordverk) och datascenario (t.ex. normal / tom / fel / utgången session). Den ska vara omöjlig att förväxla med produkt-UI.

### Route/placering

- Renderas allra sist i DOM, utanför `<header>/<nav>/<main>` — eget `<aside aria-label="Prototypkontroll">`.
- Finns på alla prototypsidor. Får inte existera i produktionsbygge (i kod: gated bakom prototyp-flagga; i acceptans: förekomst i produkt = FAIL).
- Visuellt: hopfälld flik fäst i nedre vänstra hörnet (ovanför bottomnav på mobil), `z-index: var(--z-toast)` (100 — får ligga över allt eftersom den inte är produkt).

### DOM/ARIA-ordning

1. `<aside aria-label="Prototypkontroll">`.
2. Toggle-knapp `<button aria-expanded>` med texten **"PROTOTYP"** i `--font-mono` 12/18, versaler — alltid synlig, även hopfälld.
3. Utfälld panel:
   - Rubrik "Prototyp – fixturer" (h2-semantik i asiden, visuellt `--text-compact-*` 650).
   - Fältgrupp **Tenant**: `<fieldset><legend>Tenant</legend>` med två radioknappar — "FreshCut" och "Nordverk". Exakt en är alltid vald; val byter HELA sidans fixtur atomärt (data, namn, logotyp). Blandat läge existerar inte.
   - Fältgrupp **Scenario**: `<fieldset><legend>Scenario</legend>` med radioknappar per scenario (normal / tom / fel / utgången session — utgången session demonstrerar recovery-redirecten, §0.1).
4. Ingen stängningsknapp utöver togglen; `Esc` fäller ihop (se nedan).

### Tillåtna kundsynliga props

Inga — komponenten är inte kundsynlig i produktmening. Prototypens fixturlista (tenants, scenarier) är hårdkodad i komponenten.

### States

- **hopfälld (default):** endast "PROTOTYP"-fliken syns.
- **utfälld:** panel enligt ovan; sidan bakom förblir interaktiv (ingen scrim — detta är ett verktyg, inte en dialog).
- **fixturbyte pågår:** kontrollerna får `aria-disabled` tills sidan rerendrats med ny fixtur (ingen halvbytt vy får synas — atomärt byte).
- Ingen loading/empty/error i övrigt.

### CTA/interaktion/keyboard/fokus

- Toggle: klick/`Enter`/`Space` växlar `aria-expanded`; `Esc` i panelen fäller ihop och återlämnar fokus till togglen.
- Radioknappar: standard-radiogruppsnavigering (piltangenter inom gruppen, `Tab` mellan grupperna).
- Fokusring §6.2 på allt. Ingen fokusfälla.
- Fixturbyte vid `change` direkt (ingen "Verkställ"-knapp).

### Mobil/tablet/desktop

- Samma komponent i alla lägen. Hopfälld flik: nedre vänstra hörnet, på mobil/tablet placerad `--bottomnav-h` + `--space-2` från botten så bottennavet aldrig skyms. Utfälld panel: max-bredd 288px (`--col-right`-måttet återanvänds som värde via egen bredd, ej token-tvång — panelen står utanför tokenlagens produktkrav men SKA ändå använda tokens där de finns), max-höjd 60vh med intern scroll (TOKENS §12.6).
- Panelen får aldrig skapa horisontell scroll på acceptansviewports.

### Utseende — avsiktligt icke-produkt

- Bakgrund `--surface-3`, **2px streckad kant** i `--warning` (medvetet avsteg från produktens 1px-solid-regel — det är själva markören för "inte produkt"), radius `--radius-field`.
- All text i `--font-mono`. Ordet "PROTOTYP" i `--warning` på flik och panelrubrik.
- Ingen produktkomponent får återanvända denna stil; ingen del av fixturkontrollen får återanvända produktens knapp-/kort-utseenden rakt av.

### Tokens

`--surface-3`, `--warning`, `--font-mono`, `--text-meta-*`, `--text-compact-*`, `--radius-field`, `--space-2/-3/-4`, `--bottomnav-h`, `--z-toast`, `--tap-min`, `--focus-ring-*`, `--line-2` (interna avgränsare), `--ink-1/-2`.

---

**Omfattning del 2:** TenantIdentityCard, NextBookingCard, UpcomingBookingList, BookingHistoryList, BookingStatusChip, BookingDetail.

---

## 5. TenantIdentityCard

### Syfte

Visar företagets (tenantens) identitet inne i portalens innehåll: vem kunden har bokat hos. Detta är den ENDA platsen där tenantens logotyp/namn får synas — topbaren tillhör Corevo (§2). Brief: "företagets identitet hör till innehållet, aldrig till säkerhetsramen".

### Route/placering

- `/mina`: första blocket i `<main>`, ovanför NextBookingCard.
- Får återanvändas på `/mina/historik` (ovanför listan) — samma kontrakt.
- ALDRIG i `<header>`/topbar. Placering i topbar = FAIL.

### DOM/ARIA-ordning

1. `<section aria-labelledby="tenant-namn">` som kort (`--surface-1`, 1px `--line-1`, `--radius-card`, `--shadow-card`).
2. Logotyp `<img alt="">` max `--logo-max` (48×48), `aria-hidden` (namnet bär informationen). Saknad logotyp → initialplatta 48×48 (`--surface-2`, initial i `--ink-1`), aldrig trasig bild.
3. `<h1 id="tenant-namn">` tenantnamn (`--text-h1-*` mobil/desktop enligt TOKENS §3.2).
4. `verticalLabel` (branschetikett, t.ex. "Frisörsalong") — `--text-compact-*`, `--ink-2`.
5. Kontaktrad(er), `--text-compact-*`:
   - CP-TID-03 **"Ring"** som riktig `<a href="tel:…">` när centralt telefonnummer finns.
   - CP-TID-04 **"Hitta hit"** som riktig kartlänk när adress och verifierad kart-URL finns; adressen CP-TID-05 visas som stödtext (`--ink-2`).
6. `bookingOrigin` — metarad `--text-meta-*` `--ink-3` (AA-mätt, annars `--ink-2`), t.ex. "Du bokade via freshcut.se".

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `showBookingOrigin` | `boolean` (default `true`) | Döljer ursprungsraden. |

All tenantdata (logo, name, verticalLabel, phone, address, mapUrl, bookingOrigin) läses ur sessionens tenant-kontext (§0.2) — aldrig som props. Saknat optionalfält (logotyp, telefon, adress/kartlänk, origin) → motsvarande rad döljs helt, ingen platshållartext och ingen död CTA.

### States

- **default:** enligt ovan.
- **loading:** skeleton §12.5 som matchar 48-platta + två textrader, ingen layout-shift.
- **error:** kortet döljs helt (identiteten är inte flödeskritisk); sidans övriga innehåll påverkas inte.
- Inget empty-läge (tenantnamn finns alltid i giltig session).

### CTA/interaktion/keyboard/fokus

- De enda interaktiva elementen är den villkorade tel-länken **"Ring"** och kartlänken **"Hitta hit"** (träffyta ≥44px höjd via padding, ring §6.2). Kortet i sig är inte klickbart.
- Ingen "byt företag"-åtgärd (v1 = en tenant per session, §0.1).

### Mobil/tablet/desktop

- Mobil/tablet: full bredd, padding `--space-4` (mobil) / `--space-5` (≥768), logotyp + textblock i rad, radbryt under 360px till stapel.
- Desktop: i huvudkolumnen `--col-main`; layouten oförändrad.

### Tokens

`--surface-1/-2`, `--line-1`, `--radius-card`, `--shadow-card`, `--ink-1/-2/-3`, `--text-h1-*`, `--text-compact-*`, `--text-meta-*`, `--font-ui`, `--font-mono`, `--logo-max`, `--space-2/-4/-5`, `--positive` (tel-länk), `--tap-min`, `--focus-ring-*`.

---

## 6. NextBookingCard

### Syfte

Hero-kortet på `/mina`: kundens nästa kommande bokning med primär CTA. Finns ingen kommande bokning byts innehållet till ett ärligt tomt läge med boknings-CTA. Brief: "nästa bokning är sidans viktigaste objekt".

### Route/placering

- Endast `/mina`, direkt under TenantIdentityCard. Exakt en instans.

### DOM/ARIA-ordning

Med kommande bokning:

1. `<section aria-labelledby="nasta-bokning">` som kort (`--surface-1`, 1px `--line-1`, `--radius-card`, `--shadow-card`).
2. `<h2 id="nasta-bokning">NÄSTA BOKNING</h2>` (etikett CP-HOME-01, `--font-mono`).
3. `BookingStatusChip` (§9) för bokningens status.
4. Datum + tid (CP-HOME-02), `--font-mono`, `--ink-1`, `--text-h3-size` — t.ex. "tors 23 jul · 14:30".
5. Tjänstenamn + varaktighet om känd (CP-HOME-03; `--text-body-*` `--ink-1`; varaktighet `--ink-2`).
6. Personal (CP-HOME-04, eller CP-HOME-05 "Valfri personal"), plats/adress från BOKNINGEN (CP-HOME-06) och pris endast om lagrat (CP-HOME-07) — `--text-compact-*` `--ink-2`. Saknade optionalfält döljs; pris aldrig fabricerat.
7. Åtgärdsrad (prioritet enligt brief §10.2):
   - **Primär knapp CP-HOME-08 "Visa bokningen"** → `/mina/bokningar/[id]` (§6.3 primär, ≥48px, full bredd mobil).
   - **Sekundär knapp CP-HOME-09 "Lägg i kalender"** (`CalendarDownloadButton` §12).
   - **Diskret destruktiv textknapp CP-HOME-10 "Avboka"** — renderas ENDAST när onlineavbokning är tillåten; tydligt separerad från primär CTA (brief §5.2).

"Boka en tid till" (CP-HOME-11, `BookAgainButton` §13) ligger UNDER kortet/kommande-listan — aldrig i kortets åtgärdsrad; "Visa bokningen" förblir sidans primära handling.

Utan kommande bokning (empty):

1. Samma kort-skal; `<h2>Ingen kommande bokning</h2>` (CP-HOME-14).
2. Kort brödtext `--ink-2`: CP-HOME-15 "Du har ingen bokning på gång just nu." när historik finns, annars CP-HOME-16 "Du har inga bokningar hos [Företag] ännu.".
3. **Primär knapp CP-HOME-17 "Boka ny tid"** → tenantens bokningsflöde.
4. Valfri Boka igen-rad (endast om senaste genomförda tjänsten fortfarande är publik): CP-HOME-18 "Boka igen" + metarad CP-HOME-19 "Senast: [tjänst], [datum]". Inga andra CTA:er.

### Tillåtna kundsynliga props

Inga. Bokningsdata hämtas ur sessionens datakontext; CTA-mål härleds ur tenant-kontexten.

### States

- **default:** kommande-varianten ovan.
- **empty:** varianten ovan — primär-CTA byter till "Boka ny tid". Aldrig båda varianterna samtidigt.
- **loading:** skeleton §12.5 i kortets slutmått (rubrikrad + två rader + knapprad).
- **error:** kort-skalet med text CP-HOME-20 "Bokningarna kunde inte hämtas. Din bokning är oförändrad." (`--ink-2`) + sekundär knapp CP-HOME-21 "Försök igen".
- **session-expired:** hanteras av shell (§1), kortet renderar inte eget läge.

### CTA/interaktion/keyboard/fokus

- Hela kortet är INTE klickbart — endast knapparna. Fokusordning: chip:en är inte fokusbar; `Tab` går rubrik→(tel/länkar om några)→primär→sekundär→Avboka.
- Knappar enligt §6.3, ring §6.2, träffytor ≥44/48.

### Pending/success/failure

- Navigering till detalj/bokningsflöde är länknavigation — ingen spinner i knappen.
- "Försök igen" (error): knappen får `aria-disabled` + texten "Hämtar…" under omförsök; lyckat → default/empty; misslyckat → felraden kvarstår + toast §11 tillåten.

### Mobil/tablet/desktop

- Mobil: knappar staplade (primär överst), full bredd. ≥768: knappar i rad (primär först), auto-bredd med padding ≥ `--space-6` horisontellt.
- Desktop: i `--col-main`; kortet får inte flyttas till högerkolumnen.

### Tokens

`--surface-1`, `--line-1`, `--radius-card`, `--shadow-card`, `--ink-1/-2`, `--text-h2-*/-h3-*/-body-*/-compact-*`, `--font-mono`, `--action`, `--action-hover`, `--action-text`, `--button-primary-h`, `--line-2` (sekundär), `--space-2/-3/-4/-5/-6`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

---

## 7. UpcomingBookingList

### Syfte

Lista över ÖVRIGA kommande bokningar på `/mina` (allt efter den som visas i NextBookingCard). Ger överblick utan att konkurrera med hero-kortet.

### Route/placering

- Endast `/mina`, under NextBookingCard. Rubrik `Fler kommande` (`CP-HOME-12`).
- Renderas inte alls när det finns 0 eller 1 kommande bokning (hero-kortet täcker den enda).

### DOM/ARIA-ordning

1. `<section aria-labelledby="kommande">` med `<h2 id="kommande">Fler kommande</h2>`.
2. `<ul>` i listcontainer (`--surface-1`, `--radius-card`, 1px `--line-1`); rader separerade med 1px `--line-1`.
3. Per `<li>`: en länkrad `<a href="/mina/bokningar/[id]">` som täcker hela raden:
   - Datum + tid (`--font-mono`, `--ink-1`).
   - Tjänstenamn (`--text-compact-*`, `--ink-1`); personal om satt (`--ink-2`).
   - `BookingStatusChip` (§9) högerställd.
   - Chevron-ikon 16 (`--icon-sm`, `--ink-3`, `aria-hidden`).
4. Sortering: stigande i tid. Ingen paginering i v1 (kommande bokningar är få).

### Tillåtna kundsynliga props

Inga. Data ur sessionens datakontext.

### States

- **default:** enligt ovan.
- **empty:** komponenten renderas inte (se placering) — inget tomt-kort.
- **loading:** 2 skeleton-rader §12.5 i radens mått.
- **error:** containern med texten "Bokningarna kunde inte hämtas" + sekundär "Försök igen" (samma mönster som §6).

### CTA/interaktion/keyboard/fokus

- Radens enda interaktion är länken till detaljen (listrad-states §6.3: hover `--surface-2`, active `--surface-3`, ring §6.2 — ringen får inte klippas av containerns `overflow`).
- Radhöjd ≥ `--tap-min`; `Tab` går rad för rad i listordning.

### Mobil/tablet/desktop

- Alla lägen: samma enkolumnslista. Mobil radpadding `--space-4`; ≥768 `--space-5` horisontellt.
- Desktop: i `--col-main`.

### Tokens

`--surface-1/-2/-3`, `--line-1`, `--radius-card`, `--shadow-card`, `--ink-1/-2/-3`, `--text-h2-*/-compact-*`, `--font-mono`, `--icon-sm`, `--space-2/-3/-4/-5`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

---

## 8. BookingHistoryList

### Syfte

Historiksidans lista: passerade bokningar (genomförda, avbokade, uteblivna och passerade utan avslut), nyast först. Ärlig historik — inga statusar döljs eller skrivs om.

### Route/placering

- `/mina/historik`, sidans huvudinnehåll under `<h1>Historik</h1>` (och ev. TenantIdentityCard, §5).

### DOM/ARIA-ordning

1. `<h1>Historik</h1>` (CP-HIST-01, `--text-h1-*`).
2. EXAKT TRE sektioner i exakt denna ordning (brief §11) — aldrig en platt lista:
   1. `<section>` med `<h2>Tidigare besök</h2>` (CP-HIST-02) — status `completed`;
   2. `<section>` med `<h2>Avbokade bokningar</h2>` (CP-HIST-03) — status `cancelled`;
   3. `<section>` med `<h2>Övriga bokningar</h2>` (CP-HIST-04) — `no_show`, väntande utfall ("Väntar på avslut") och okänd status.
   En sektion utan poster renderas inte; tid + status avgör tillsammans sektion (§8-matrisen i SPEC).
3. Varje sektion: lista med samma container- och radkontrakt som §7 (ul, länkrader CP-HIST-05 → `/mina/bokningar/[id]`, chip högerställd, chevron 16).
4. Radinnehåll: tjänst, lokalt datum (mono), personal om känd, plats om företaget har flera platser, `BookingStatusChip` (§9), pris endast om lagrat.
5. Sortering: fallande i tid (nyast först) inom varje sektion. Första vyn visar högst 20 rader totalt; därefter sekundär knapp "Visa fler" (CP-HIST-07) efter listorna laddar nästa 20 (ingen oändlig scroll).

### Tillåtna kundsynliga props

Inga.

### States

- **default:** enligt ovan.
- **empty:** ärligt tomt läge i kortcontainer: ikon 24 (`--icon-lg`, `--ink-3`), text CP-HIST-06 "Du har inga tidigare bokningar hos [Företag] ännu." (`--ink-2`). Ingen CTA (bokning görs från `/mina`).
- **loading:** 3 skeleton-rader §12.5.
- **error:** CP-HIST-10 "Historiken kunde inte hämtas." + sekundär CP-HIST-11 "Försök igen".

### CTA/interaktion/keyboard/fokus

- Som §7. "Visa fler" (CP-HIST-07): sekundär knapp §6.3; under hämtning `aria-disabled` + CP-HIST-08 "Hämtar…"; nya rader appendas, fokus ligger kvar på knappen (försvinner knappen sätts fokus på första nya raden).
- Misslyckad "Visa fler" → CP-HIST-09 "Fler bokningar kunde inte hämtas. Försök igen." (`role="alert"`, toast §11 eller inline) + knappen återställs.

### Mobil/tablet/desktop

- Som §7. Desktop: i `--col-main`.

### Tokens

Som §7 samt `--text-h1-*`, `--icon-lg`, `--line-2` (sekundär knapp).

---

## 9. BookingStatusChip

### Syfte

Enda kanoniska statusindikatorn för bokningar. Mappar bokningsstatus + tid till exakt en svensk label med färg + text (aldrig enbart färg, TOKENS §2.5).

### Route/placering

- Inuti NextBookingCard, UpcomingBookingList, BookingHistoryList och BookingDetail. Får inte återuppfinnas lokalt — all status renderas via denna komponent.

### Statusmatris (kanonisk, sluten)

| status | tid | Label | Färg |
|---|---|---|---|
| `pending` | framtida | Förfrågan mottagen | `--warning` |
| `confirmed` | framtida | Bekräftad | `--positive` |
| `completed` | — | Genomförd | `--positive` |
| `cancelled` | — | Avbokad | `--negative` |
| `no_show` | — | Uteblev | `--negative` |
| `pending`/`confirmed` | passerad | Väntar på avslut | `--warning` |
| okänd/övrig | — | Status uppdateras | `--warning` |

- "Passerad" = bokningens sluttid < nu. Mappningen är ren presentation — komponenten FÅR INTE mutera bokningens status (okänd status skrivs aldrig om i data).
- Andra labels/statusar än tabellens = FAIL.

### DOM/ARIA-ordning

1. `<span>` badge enligt TOKENS §12.3: höjd 24px, padding 4px 12px, `--radius-pill`, `--font-mono` 12/18.
2. Ikon 16 (`--icon-sm`) med distinkt form per färgklass (`--positive` bock, `--warning` klocka, `--negative` kryss), `aria-hidden`.
3. Textlabel enligt matrisen — texten bär alltid statusen (§2.5).
4. Bakgrund: statusfärg på 12–16 % (`color-mix`-mönstret §2.5), text + 1px kant i statusfärgen.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `status` | bokningsstatus (enum ovan) | Väljer rad i matrisen. |
| `isPast` | `boolean` | Aktiverar "Väntar på avslut"-raden för pending/confirmed. |

### States

- Endast default. Ingen loading/empty/error — saknas status renderas "Status uppdateras"-varianten.

### CTA/interaktion/keyboard/fokus

- Inte interaktiv, inte fokusbar. Ingen tooltip.

### Mobil/tablet/desktop

- Identisk i alla lägen; labeln får inte trunkeras (chip:en radbryts hel till egen rad vid platsbrist).

### Tokens

`--positive`, `--warning`, `--negative`, `--radius-pill`, `--font-mono`, `--text-meta-*`, `--icon-sm`, `--space-1/-3`.

---

## 10. BookingDetail

### Syfte

Fullständig vy för en bokning på `/mina/bokningar/[id]`: allt kunden behöver inför besöket, med plats från BOKNINGEN (inte tenantens centrala uppgifter) och tillåtna åtgärder.

### Route/placering

- `/mina/bokningar/[id]`, hela `<main>`-innehållet. Nav-markering: Bokningar (§3).

### DOM/ARIA-ordning (fast, uppifrån och ned)

1. **Tillbaka:** synlig `Tillbaka`-länk (ghost §6.3, ikon 20 + text) — se backlogik nedan. (Speglas även i topbaren, §2.)
2. **Status:** `BookingStatusChip` (§9).
3. **Datum + tid:** `<h1>` i `--font-mono`-sifferstil, t.ex. "tors 23 jul 2026" + "14:30–15:15" (`--text-h1-*`; tiden får ligga som mono-rad under).
4. **Tjänst + varaktighet:** tjänstenamn (`--text-h3-*` `--ink-1`), varaktighet (`--ink-2`).
5. **Personal:** namn (om satt).
6. **Plats:** från bokningen — platsnamn, adress, telefonnummer (`tel:`-länk, mono), kartlänk "Öppna i karta" (extern länk §12.4, `rel="noopener"`). Plats FÅR INTE falla tillbaka på tenantens centrala adress/telefon.
7. **Pris:** belopp `--ink-1` mono + ev. prisförbehåll `--ink-2`.
8. **customerVisibleNote:** kundsynlig anteckning i eget delkort (`--surface-2`, `--radius-field`), label "Meddelande" `--text-meta-*`.
9. **Policy:** av-/ombokningsvillkor, `--text-compact-*` `--ink-2`.
10. **Åtgärder:** sist — t.ex. destruktiv "Avboka" (§6.3 destruktiv, kräver bekräftelsedialog §11) och sekundär "Boka en tid till". Endast åtgärder giltiga för aktuell status (passerad/avbokad bokning → ingen Avboka).

Fälten 4–9: saknat optionalfält (personal, telefon, karta, pris, note, policy) döljs helt — ingen tom rad, ingen platshållare. Ordningen för kvarvarande fält behålls.

### Backlogik (bindande)

| Ursprung | Tillbaka-mål |
|---|---|
| Navigerat från `/mina` | `/mina` |
| Navigerat från `/mina/historik` | `/mina/historik` |
| Direkt inhopp (SMS-länk, PWA-start, deep-link) | `/mina` |

Målet avgörs av dokumenterad in-app-navigation (t.ex. query/state), aldrig av `document.referrer`-gissning. Okänt ursprung = `/mina`.

### Tillåtna kundsynliga props

Inga — allt läses ur route-param + sessionens datakontext.

### States

- **default:** enligt ovan.
- **loading:** skeleton §12.5 för block 2–7 (tillbaka-länken renderas direkt).
- **error (hämtning misslyckades):** "Bokningen kunde inte hämtas" + sekundär "Försök igen" + Tillbaka.
- **error (ägarskap/finns ej):** neutral text **"Bokningen kunde inte visas"** (`--ink-2`) + Tillbaka till `/mina`. Samma yta för fel tenant, annan kunds bokning och ogiltigt id — ingen skillnad som läcker om bokningen existerar.
- **session-expired:** shell-recovery (§1).

### CTA/interaktion/keyboard/fokus

- Vid inladdning sätts fokus på `<main>`/h1 (§1); dokumenttitel "Bokning – {Tenantnamn}".
- `Tab`-ordning = DOM-ordning: Tillbaka → tel-länk → kartlänk → åtgärder.
- "Avboka" öppnar destruktiv dialog (§11: fokusfälla, `Esc` avbryter, fokus återlämnas). Bekräfta-knappen i dialogen är destruktiv §6.3.

### Pending/success/failure (Avboka)

- **pending:** dialogens bekräftaknapp `aria-disabled` + "Avbokar…"; övriga kontroller låsta.
- **success:** dialog stängs, status-chip byter till "Avbokad", åtgärden Avboka försvinner, toast CP-CAN-08 "Bokningen är avbokad. [Företag] har fått besked." (§11).
- **failure:** dialogen stängs INTE; felrad i dialogen (`--negative` 12/18 + ikon) CP-CAN-09 "Avbokningen kunde inte genomföras. Din bokning är oförändrad."; separat CP-CAN-10 "Försök igen" återställer försöket.

### Mobil/tablet/desktop

- Mobil/tablet: en kolumn; åtgärder full bredd, staplade sist.
- Desktop: i `--col-main`; åtgärder i rad. Högerkolumnen får användas för plats-blocket ≥1248px men DOM-ordningen ovan ändras inte.

### Tokens

`--surface-1/-2/-3`, `--line-1/-2`, `--radius-card/-field/-dialog`, `--shadow-card/-dialog`, `--ink-1/-2/-3`, `--text-h1-*/-h3-*/-body-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--positive/-warning/-negative`, `--action*`, `--button-primary-h`, `--icon-md/-sm`, `--space-2…-6`, `--z-scrim/-sheet`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

---

**Omfattning del 3:** CancelBookingDialog, CalendarDownloadButton, BookAgainButton, PinVerificationForm, BookingStepFive, RecoveryForm.

---

## 11. CancelBookingDialog

### Syfte

Den enda bekräftelseytan för avbokning. Öppnas av "Avboka" i BookingDetail (§10) och äger hela avbokningsinteraktionen: bekräfta, pending, fel och idempotens. Ingen avbokning får ske utan denna dialog.

### Route/host/placering

- Portalhosten, på `/mina/bokningar/[id]` — renderas som overlay ovanpå BookingDetail, aldrig som egen route.
- **Mobil/tablet (0–1023):** bottom-sheet enligt TOKENS §11 (bg `--surface-2`, radius `--radius-dialog` endast ovankant, drag-handtag 32×4, safe-area-padding i botten).
- **Desktop (≥1024):** centrerad dialog enligt TOKENS §11 (bg `--surface-3`, radius `--radius-dialog`, max-bredd 440px, padding `--space-6`).
- Scrim `rgba(0,0,0,.56)` z `--z-scrim`; dialog/sheet z `--z-sheet`. Scrim-klick stänger INTE (destruktiv bekräftelse, TOKENS §11).

### DOM/ARIA-ordning

1. `<div role="dialog" aria-modal="true" aria-labelledby="avboka-titel" aria-describedby="avboka-brod">`.
2. (Mobil) drag-handtag, `aria-hidden="true"`.
3. `<h2 id="avboka-titel">Avboka bokningen?</h2>` (`--text-h2-*`, `--ink-1`).
4. `<p id="avboka-brod">` sammanfattning av bokningen: datum + tid i `--font-mono` och tjänstenamn (`--text-body-*`, `--ink-2`), samt policyrad om villkor finns (`--text-compact-*`, `--ink-2`).
5. Felrad (endast vid failure/policy-fel): `--negative` 12/18 med ikon 16, `role="alert"`.
6. Knapprad, i denna DOM-ordning:
   - Sekundär knapp **"Behåll bokningen"** (§6.3 sekundär, ≥44px).
   - Destruktiv knapp **"Ja, avboka"** (§6.3 destruktiv, ≥44px).

### Tillåtna kundsynliga props

Inga. Bokningsdata (sammanfattning, policy) läses ur samma datakontext som BookingDetail; dialogen tar emot `open`/callbacks som interna implementation-props (§0.2).

### States

- **default (öppen):** enligt ovan. Initialt fokus på **"Behåll bokningen"** (icke-destruktiv som standard).
- **pending:** "Ja, avboka" får `aria-disabled` + texten **"Avbokar…"**; "Behåll bokningen" och `Esc` låses (avbrottet kan inte ångra en pågående serverbegäran). Ingen spinner-endast — texten bär tillståndet.
- **success:** dialogen stängs, fokus återlämnas till BookingDetail (Avboka-knappen är borta → fokus på status-chipens närmaste rubrik/`<main>`), chip byter till "Avbokad", toast CP-CAN-08 **"Bokningen är avbokad. [Företag] har fått besked."**.
- **failure (nätverk/server):** dialogen stängs INTE; felraden visar CP-CAN-09 **"Avbokningen kunde inte genomföras. Din bokning är oförändrad."** och en separat knapp CP-CAN-10 **"Försök igen"**; den destruktiva submitten får inte bära retry-copy.
- **policy changed (avbokning inte längre tillåten enligt villkoren):** felraden visar CP-CAN-11 **"Bokningen kan inte längre avbokas online. Din bokning är oförändrad."**; "Ja, avboka" döljs, endast CP-CAN-12 **"Stäng"** återstår; BookingDetail uppdaterar sina åtgärder och visar `policy_blocked` när dialogen stängs.
- **already cancelled (idempotent):** servern svarar att bokningen redan är avbokad → behandlas som **success** (samma stängning, chip "Avbokad", toast). Aldrig ett felmeddelande för detta.

### CTA/keyboard/fokus

- Fokusfälla i dialogen (TOKENS §11): `Tab` cyklar endast dialogens fokusbara element.
- `Esc` = samma som "Behåll bokningen" (stänger utan åtgärd), utom under pending.
- Vid stängning utan åtgärd återlämnas fokus till utlösaren ("Avboka" i BookingDetail).
- Träffytor ≥44px; på mobil fyller knapparna sheetens bredd, staplade med destruktiv knapp underst.

### Responsivt

- Mobil/tablet: bottom-sheet, in-animation `translateY` + fade 160–200ms, ut 120–160ms (0ms vid reduced motion).
- Desktop: centrerad dialog, fade + lätt skala via `transform`.
- Sheet med tangentbord: `max-height: calc(100dvh - 16px)`, internt scrollbar (TOKENS §10) — gäller ej här normalt (inga fält) men ärvs från sheet-kontraktet.

### Tokens

`--surface-2/-3`, `--line-2`, `--radius-dialog`, `--shadow-dialog`, `--ink-1/-2`, `--negative`, `--text-h2-*/-body-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm`, `--space-2…-6`, `--z-scrim/-sheet/-toast`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Avbokningsflödet i BookingDetail-briefen: destruktiv åtgärd kräver alltid explicit bekräftelse, idempotent mot dubbelklick och redan avbokad bokning; texterna "Avboka bokningen?", "Behåll bokningen", "Ja, avboka", "Avbokar…" är låsta.

---

## 12. CalendarDownloadButton

### Syfte

Låter kunden ladda ned bokningen som kalenderfil (`.ics`). Filen genereras **ägarskapskontrollerat** på servern — endast den verifierade sessionens egen bokning (eller, i steg 5, den just skapade bokningen) kan hämtas.

### Route/host/placering

- Portalhosten: i BookingDetail (§10) bland åtgärderna, som sekundär knapp.
- Tenanthosten: i BookingStepFive (§15) som **primär** knapp "Lägg i kalender".
- Samma komponentkontrakt på båda platserna; endast knappvarianten (§6.3 primär/sekundär) skiljer och styrs av placeringen.

### DOM/ARIA-ordning

1. `<button type="button">` med ikon 20 (kalender, `--icon-md`, `aria-hidden`) + textlabel **"Lägg i kalender"**.
2. Statusrad under knappen vid success/fel: `--text-meta-*` med ikon 16; success `--positive`, fel `--negative`, `role="status"` respektive `role="alert"`.

Knapp — inte länk: hämtningen är en auktoriserad server-begäran, inte en publik URL som kan delas.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `variant` | `"primary" \| "secondary"` | §6.3-utseende; primär endast i BookingStepFive. |

Boknings-id härleds ur kontexten (route-param respektive steg 5:s bokningsreferens) — aldrig som fri prop.

### States / pending / success / failure

- **default:** "Lägg i kalender".
- **pending:** `aria-disabled` + texten **"Hämtar…"** (texten bär tillståndet).
- **success:** filen levereras till webbläsarens nedladdning; statusraden visar CP-CAL-03 **"Kalenderfilen är klar"** (`--positive` + bock-ikon); knappen återgår till default (omhämtning tillåten, idempotent).
- **failure:** statusraden visar CP-CAL-04 **"Kalenderfilen kunde inte skapas. Försök igen."** (`--negative` + ikon); knappen återställs. Nytt klick = nytt försök.
- **ownership-fel (ogiltig/annan kunds bokning):** samma neutrala failure-text som ovan — ingen skillnad som läcker om bokningen existerar (samma princip som §10 error).

### Filinnehåll (bindande)

- `.ics` innehåller ENDAST: tjänstenamn (SUMMARY), start/slut, platsnamn + adress från bokningen (LOCATION), tenantnamn (ORGANIZER/beskrivning).
- FÅR INTE innehålla: interna anteckningar, `customerVisibleNote` är tillåten men interna notes = FAIL, sessions-/verifieringstoken, interna boknings-/kund-id:n, personaldata utöver visat namn. Läcka = FAIL.

### CTA/keyboard/fokus

- `Enter`/`Space` aktiverar; ring §6.2; träffyta ≥44px (primärvariant ≥48px).
- Fokus stannar på knappen genom hela cykeln; statusraden annonseras via `role="status"`/`role="alert"`.

### Responsivt

- Mobil: full bredd i sin knappgrupp. ≥768: auto-bredd. Identiskt beteende alla lägen.

### Tokens

`--action`, `--action-hover`, `--action-text`, `--line-2`, `--ink-1/-2`, `--positive`, `--negative`, `--radius-field`, `--button-primary-h`, `--icon-md/-sm`, `--text-compact-*/-meta-*`, `--font-ui`, `--space-2/-3`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Kalender-åtgärden i BookingDetail-/steg 5-briefen: ägarskapskontrollerad export, ärliga tillstånd "Hämtar…" / "Kalenderfilen är klar" / fel; kalenderfilen är kundens artefakt och får aldrig bära interna data.

---

## 13. BookAgainButton

### Syfte

Tar kunden till **tenantens publika bokningsflöde** för att boka en ny tid. Portalen bokar ALDRIG själv — v1 har ingen portalbokning; knappen är en utlänk till företagets egen bokningssida.

### Route/host/placering

- Portalhosten: NextBookingCard (§6, sekundär "Boka en tid till" / primär "Boka ny tid" i empty), BookingDetail (§10, "Boka en tid till" för aktiv bokning och "Boka igen" för historisk bokning) samt BookingHistoryList (§8, "Boka igen" när tjänsten fortfarande är publik).
- Tenanthosten: BookingStepFive (§15, sekundär "Boka en tid till").
- Målet är alltid tenantens `publicRebookUrl` ur tenant-kontexten.

### DOM/ARIA-ordning

1. `<a href="{publicRebookUrl}">` stylad som knapp (§6.3 enligt `variant`) med textlabel enligt placeringens kontrakt (CP-AGAIN-01 **"Boka en tid till"**, CP-AGAIN-02 **"Boka ny tid"** eller CP-AGAIN-03 **"Boka igen"**).
2. Länk — inte `<button>` — eftersom målet är en riktig navigering till tenantens host. Samma flik (kunden lämnar portalen medvetet); `rel="noopener"` om annan origin.

### Måladress (bindande)

- Bas: tenantens `publicRebookUrl` från sessionens tenant-kontext. Saknas den renderas komponenten INTE (ingen trasig CTA).
- **Kontextbevarande:** när komponenten står i en bokningskontext (BookingHistoryList, BookingDetail eller BookingStepFive) och bokningens `location` respektive `service` fortfarande är **giltiga och aktiva** hos tenanten, appendas de som förvalsparametrar till URL:en. Ogiltigt/inaktivt värde utelämnas tyst — aldrig en trasig förvals-URL, aldrig felmeddelande för detta.
- FÅR INTE peka på portal-routes, admin-ytor eller djuplänkar som kräver annan session.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `variant` | `"primary" \| "secondary"` | §6.3-utseende; primär endast i NextBookingCards empty-läge. |
| `label` | `"Boka en tid till" \| "Boka ny tid" \| "Boka igen"` | Sluten lista enligt CP-AGAIN-01–03 — inga andra texter. |

Kontextdata (URL, location, service) härleds — aldrig fria props.

### States

- **default:** enligt §6.3-variant.
- Ingen pending/success/failure — ren länknavigation, ingen spinner (§6 Pending-regeln).
- **saknad publicRebookUrl:** komponenten renderas inte (se ovan). Inget disabled-läge.

### CTA/keyboard/fokus

- `Enter` navigerar; ring §6.2; träffyta ≥44px (primär ≥48px).

### Responsivt

- Följer värdplatsens knappradsregler: staplad full bredd på mobil, i rad ≥768.

### Tokens

`--action`, `--action-hover`, `--action-text`, `--line-2`, `--ink-1`, `--radius-field`, `--button-primary-h`, `--text-compact-*`, `--font-ui`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

"Boka igen"-flödet i briefen: portalen är läs- och hanteringsyta, all nybokning sker i tenantens publika flöde; förval av plats/tjänst är service, aldrig krav.

---

## 14. PinVerificationForm

### Syfte

PIN-verifieringen i det publika bokningsflödet — **steg 4 av 5** — på **företagets (tenantens) host**, inte portalen. Kunden har valt tid och angett kontaktuppgift; här bevisar hen kontrollen över kanalen med en engångskod innan bokningen skapas. Samma komponent används i recovery-verifieringen på `/verifiera/[tenantSlug]` (§16) med identiskt kodkontrakt.

### Route/host/placering

- **Tenanthosten** (t.ex. `freshcut.se`-bokningsflödet), steg 4 av 5 i bokningsguiden. Portal-shell och portal-nav förekommer INTE här — sidan bär tenantens bokningsflödesram.
- Recovery-läget: `/verifiera/[tenantSlug]` på portalhosten, i recovery-shell (§1 `variant="recovery"`).

### DOM/ARIA-ordning

1. `<form>` med `<h2>` **"Ange koden"** (`--text-h2-*`).
2. Kanalrad, `--text-compact-*` `--ink-2`, `aria-live="polite"`: **"Vi har skickat en kod via SMS till {maskerat nummer}"** eller **"Vi har skickat en kod via e-post till {maskerad adress}"**. Kontaktuppgiften maskeras alltid (t.ex. `•••• •• 45 67`, `z•••@g•••.com`).
3. **Ett semantiskt kodfält:** `<input type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6">` med `<label>Engångskod</label>`. Får renderas med visuellt cellutseende (siffergrupper) men SKA vara ETT input i DOM — flera inputs för en kod = FAIL. Text i `--font-mono`, ≥16px (iOS-zoom, TOKENS §10).
4. Ändra-åtgärd vid kanalraden (`mode="booking"`): ghost-knapp CP-PIN-05 **"Ändra mobilnummer"** (SMS) respektive CP-PIN-07 **"Ändra e-post"** (e-post).
5. Felrad under fältet (vid fel): `--negative` 12/18 + ikon 16, `role="alert"`.
6. Primär knapp CP-PIN-08 **"Verifiera"** (§6.3 primär, ≥48px, full bredd mobil).
7. Resend-rad: textknapp (ghost §6.3) CP-PIN-12 **"Skicka ny kod"** + cooldown-text `--text-meta-*` `--ink-2` (se states).

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `mode` | `"booking" \| "recovery"` | Styr endast omgivande copy-kontext; kodkontraktet är identiskt. |

Kanal och maskerad kontaktuppgift kommer ur flödets serverstate — aldrig fria props.

### States (kanonisk, sluten lista)

| State | UI |
|---|---|
| `sending` | Kanalraden visar CP-PIN-03 **"Skickar koden…"**; fält + Verifiera `aria-disabled`. |
| `sent_sms` | Kanalrad CP-PIN-04 "Vi har skickat en kod via SMS till {…}" + CP-PIN-05 "Ändra mobilnummer"; fält aktivt, autofokus. |
| `sent_email` | Kanalrad CP-PIN-06 "Vi har skickat en kod via e-post till {…}" + CP-PIN-07 "Ändra e-post". |
| `invalid` | Felrad CP-PIN-10 **"Fel kod. Du har {n} försök kvar."**; fältet behåller värdet, markeras §6.3 Input fel, fokus åter i fältet. |
| `cooldown` | Omskickskontrollen `aria-disabled` + text CP-PIN-11 **"Skicka ny kod om {00:ss}"** (`aria-live="polite"`, uppdateras utan fokusstöld). |
| `resend_ready` | Knapp CP-PIN-12 **"Skicka ny kod"** (ny kod ogiltigförklarar gammal) → `sending` → `sent_*`; bekräftelse CP-PIN-13 **"En ny kod har skickats."** i kanalraden. |
| `expired` | Felrad CP-PIN-14 **"Koden har gått ut. Begär en ny kod."**; Verifiera `aria-disabled` tills ny kod begärts. |
| `max_attempts` | Felrad CP-PIN-15 **"För många försök. Begär en ny kod om {n} min."**; fält + Verifiera låsta; endast cooldown-styrd resend kvar. |
| `delivery_failed` | Kanalriktig felrad: CP-PIN-16 **"SMS:et med koden kunde inte skickas. Försök igen eller ändra mobilnummer."** respektive CP-PIN-17 **"Mejlet med koden kunde inte skickas. Försök igen eller ändra e-post."** + resend aktiv (utom under cooldown). |
| `slot_lost` (endast `mode="booking"`) | Ersättningsyta: **"Tiden hann tyvärr bokas av någon annan."** + primär knapp **"Välj en ny tid"** → tillbaka till tidsvalssteget. Ingen kodinmatning kvar. |
| `verified` | Kort bekräftelse (bock + **"Verifierad"**, `--positive`) och automatisk vidaregång: booking → steg 5 (§15); recovery → portalsession + redirect `/mina`. |

### Pending/success/failure (Verifiera)

- **pending:** Verifiera `aria-disabled` + CP-PIN-09 **"Verifierar…"**; fältet låst.
- **success:** `verified` enligt ovan.
- **failure:** nätverksfel → felrad CP-PIN-21 **"Koden kunde inte kontrolleras. Försök igen."**; kod och fält återställs INTE (kunden ska inte skriva om koden).

### CTA/keyboard/fokus

- Autofokus på kodfältet vid `sent_*`. `Enter` i fältet = Verifiera.
- `autocomplete="one-time-code"` ger OS-autofyll från SMS; autofylld komplett kod FÅR autosubmittas (ett försök), manuell inmatning kräver explicit Verifiera.
- Ring §6.2 på fält och knappar; felrad kopplas med `aria-describedby`.

### Responsivt

- Mobil: enkolumn, full bredd, Verifiera full bredd. ≥768: formulärbredd max ~440px centrerad i flödesramen. Identisk semantik alla lägen.

### Tokens

`--surface-1/-2`, `--line-2`, `--radius-field`, `--ink-1/-2/-3`, `--negative`, `--positive`, `--action*`, `--button-primary-h`, `--text-h2-*/-body-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm/-md`, `--space-2/-3/-4/-6`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Lösenordsfria flödets kärnkontrakt: PIN i steg 4/5 på företagshosten bevisar kanalkontroll före bokningsskapande; alla elva tillstånd ovan är låsta, koden är alltid ett semantiskt fält med `one-time-code`.

---

## 15. BookingStepFive

### Syfte

Bokningsflödets **steg 5 av 5** — bekräftelsesidan efter godkänd boknings-PIN — på **tenantens host**, inte portalen. Visar ärligt vad som faktiskt hänt med bokningen (persistens- och leveransstatus separat) och ger nästa steg.

### Route/host/placering

- Tenanthosten, sista steget i bokningsguiden, direkt efter `verified` i §14 (`mode="booking"`). Ingen portal-shell, ingen portal-nav.
- Nås ALDRIG utan genomförd PIN-verifiering; direktinhopp på steget utan flödesstate → tillbaka till flödets start.

### DOM/ARIA-ordning (lyckat huvudspår)

1. `<h1>` CP-S5-01 **"Bokningen är klar"** (`--text-h1-*`) med bock-ikon 24 `--positive` (`aria-hidden`; texten bär statusen, §2.5).
2. `BookingStatusChip` CP-S5-02: faktisk status **"Bekräftad"** eller **"Förfrågan mottagen"** (CP-STATUS-01/02-matrisen).
3. Bokningssammanfattning i kort (`--surface-1`, `--radius-card`): datum + tid (`--font-mono`), tjänst, personal/valfri personal, plats, pris om det finns — samma fältregler som §10 (saknat optionalfält döljs).
4. Leveransstatusrad (se statusmatris nedan), `--text-compact-*`, `role="status"` (fel: `role="alert"`), alltid med MASKERAD destination.
5. Hjälptext CP-S5-03 `--text-meta-*` `--ink-2`: **"Öppna länken i meddelandet för att se och hantera bokningen."** (ingen portal-CTA som kräver session här).
6. Åtgärder:
   - **Primär: `CalendarDownloadButton` (§12) — CP-S5-04 "Lägg i kalender"** (`variant="primary"`).
   - **Sekundär: `BookAgainButton` (§13) — CP-S5-05 "Boka en tid till"** (till tenantens bokningsstart).
   - **Stängåtgärd CP-S5-06 "Stäng"** — stänger overlayn respektive går till tenantens startsida på fristående `/boka`.

### Statusmatris (kanonisk, sluten) — persistens + leverans

Steget skiljer på **att bokningen finns** och **att bekräftelsen levererats**. Två separata sanningar, aldrig hopblandade:

| State | Betydelse | UI |
|---|---|---|
| `gateway_persisted` | Bokningen är sparad; gatewayen har tagit emot jobbet i sin beständiga kö | Statusrad CP-S5-07 **"Bokningen är klar. Bekräftelsen är på väg till [maskerad destination]."** (`--ink-2`, klock-ikon `--warning`, `role="status"`). |
| `submitted` | Utskick överlämnat till operatör/e-postserver | Statusrad CP-S5-08 **"Bekräftelsen är skickad till [maskerad destination]"** (`--warning`-ikon). |
| `delivered` | Leverans bekräftad | Statusrad CP-S5-09 **"Bekräftelse skickad till [maskerad destination]"** (`--positive` + bock 16) — samma normaltext, inget extra framgångskrav. |
| `delivery_failed` | Bokningen finns, men utskicket misslyckades | Statusrad CP-S5-10 **"Bokningen är klar, men bekräftelsen kunde inte levereras."** (`--negative` + ikon, `role="alert"`) + sekundär knapp CP-S5-11 **"Skicka bekräftelsen igen"** + företagskontakt CP-S5-14 **"Nås inte bekräftelsen? Ring [Företag] på [nummer]."** (tel-länk om publik telefon finns). Rubriken förblir "Bokningen är klar" — leveransfel gör ALDRIG bokningen osäker i UI. |
| `unknown` | Leveransstatus okänd (uppslag misslyckades) | Statusrad CP-S5-15 **"Bokningen är klar. Vi kontrollerar leveransen av bekräftelsen."** (`--warning`). Ingen automatisk dubblettsändning, ingen retry-CTA; uppdateras via polling/omladdning. |

Ingen text i dessa lägen får påstå att bokningen saknas.

### Separat felvy (ingen bokning skapades — PIN/finalisering misslyckades FÖRE skapande)

Egen felyta med egen layout i stället för hela huvudspåret — den återanvänder ALDRIG lyckad-bokningslayouten:

- `<h1>` CP-S5-16 **"Bokningen kunde inte slutföras"** (`--ink-1`);
- brödtext CP-S5-17 **"Ingen bokning skapades."** (`--ink-2`);
- primär CTA CP-S5-18 **"Tillbaka till lediga tider"** → tidsvalssteget.

Ingen sammanfattning, ingen kalender-CTA, ingen "klar"-formulering någonstans i felvyn. Blandning av spåren (t.ex. "Bokningen är klar" + "Ingen bokning skapades.") = FAIL.

### Retry-kontrakt (bindande)

- **"Skicka bekräftelsen igen"** (delivery_failed) är **rate-limitad** (cooldown-text CP-S5-13: "Du kan skicka igen om {n} s", `aria-live="polite"`) och **idempotent** — upprepade klick skapar aldrig dubbla bokningar och högst ett nytt utskick per beviljat försök. Pending: `aria-disabled` + CP-S5-12 **"Skickar…"**; success → `submitted`/`delivered`; failure → kvar i `delivery_failed` med felraden uppdaterad.
- Ett nytt bokningsförsök efter felvyn (via "Tillbaka till lediga tider") är idempotent mot serverns bokningsförsök — ett redan lyckat men sent svarat försök får ALDRIG dubbelbokas (servern svarar då med den befintliga bokningen → huvudspåret).

### Tillåtna kundsynliga props

Inga. Allt state kommer ur bokningsflödets serverstate.

### CTA/keyboard/fokus

- Vid inladdning: fokus på `<h1>`; dokumenttitel "Bokning klar – {Tenantnamn}" (respektive "Bokningen kunde inte slutföras – {Tenantnamn}" i felvyn).
- `Tab`-ordning = DOM-ordning: statusrad-knappar → primär → sekundär → Stäng.
- Statusradändringar annonseras via `role="status"` (ej fokusstöld).

### Responsivt

- Mobil: enkolumn, knappar staplade full bredd (primär överst). ≥768: knappar i rad, innehåll max ~560px centrerat i flödesramen.

### Tokens

`--surface-1/-2`, `--line-1/-2`, `--radius-card/-field`, `--shadow-card`, `--ink-1/-2`, `--positive/-warning/-negative`, `--action*`, `--button-primary-h`, `--text-h1-*/-h3-*/-body-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm/-lg`, `--space-2…-6`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Steg 5-briefen: bekräftelsen är tenant-hostad och ärlig — persistens och leverans är separata statusar, "Ingen bokning skapades" är ett eget spår, "Lägg i kalender" är primär åtgärd och all retry är rate-limitad och idempotent.

---

## 16. RecoveryForm

### Syfte

Det lösenordsfria återhämtningsflödets första steg: kunden anger sin kontaktuppgift på `/aterhamta/[tenantSlug]` och får (om den matchar en känd, redan verifierad kanal) en engångskod — därefter `/verifiera/[tenantSlug]` (§14 `mode="recovery"`). Detta är produktens ENDA väg in utan giltig session. Ingen login existerar (§0.1).

### Route/host/placering

- Portalhosten, `/aterhamta/[tenantSlug]`, i recovery-shell (§1 `variant="recovery"`): Corevo-topbar utan nav, inget bottennav/vänsternav.
- Lyckad submit → navigering till `/verifiera/[tenantSlug]`.
- Tenant-kontext från `[tenantSlug]`: tenantnamn i copy, inget mer (ingen TenantIdentityCard-data kräver session — endast namn/logotyp ur publik tenantinfo).

### DOM/ARIA-ordning

1. `<h1>` **"Kom åt dina bokningar"** (`--text-h1-*`).
2. Brödtext `--text-body-*` `--ink-2`: **"Ange mobilnumret eller e-postadressen du bokade med hos {Tenantnamn}, så skickar vi en engångskod."**
3. `<form>`:
   - `<label for="kontakt">Mobilnummer eller e-post</label>` (`--text-compact-*`).
   - `<input id="kontakt" type="text" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false">` — ETT fält för båda formaten (§6.3 Input), ≥16px.
   - Valideringsfelrad (endast format): `--negative` 12/18 + ikon, `role="alert"`, **"Ange ett giltigt mobilnummer eller en giltig e-postadress."**
   - Primär knapp **"Skicka kod"** (§6.3 primär, ≥48px, full bredd mobil).
4. Metarad `--text-meta-*` `--ink-2`: **"Koden skickas bara till en kontaktuppgift som redan är verifierad hos {Tenantnamn}."**

### Kanalval (bindande säkerhetskontrakt)

- Kunden får skriva mobil ELLER e-post, men **servern väljer alltid själv kanal** och skickar ENDAST till en kanal som redan är verifierad för kundprofilen. Inmatningen är en uppslagsnyckel — aldrig en fritt vald leveransadress. En overifierad/okänd adress får ALDRIG ta emot kod.
- **Neutral enumeration-respons:** oavsett om kontaktuppgiften matchar en kund eller inte visar UI:t exakt samma svar: navigering till `/verifiera/[tenantSlug]` med kanalraden **"Om uppgiften finns hos oss har vi skickat en kod."** följt av maskerad kanal ENDAST när utskick faktiskt skett och maskeringen inte avslöjar mer än kunden själv angav. Ingen skillnad i text, timing-copy eller UI mellan träff och icke-träff = bindande. "Kontot finns inte"-meddelanden = FAIL.

### Tillåtna kundsynliga props

Inga. Tenantnamn ur `[tenantSlug]`-uppslaget.

### States / pending / success / failure

- **default:** enligt ovan.
- **valideringsfel (klient, endast format):** felraden ovan; ingen serverbegäran.
- **pending:** "Skicka kod" `aria-disabled` + **"Skickar…"**; fältet låst.
- **success (neutral):** navigering till `/verifiera/[tenantSlug]` (§14, neutral kanalrad enligt ovan).
- **failure (nätverk/server):** felrad **"Något gick fel. Försök igen."** (`role="alert"`); fältets värde behålls; knappen återställs.
- **cooldown (rate limit per uppgift/IP):** felrad **"Du kan begära en ny kod om {n} s."**; knappen `aria-disabled` med nedräkning (`aria-live="polite"`). Cooldownen är neutral — den avslöjar inte om uppgiften matchar.
- **max_attempts:** felrad **"För många försök. Försök igen om {n} min."**; formuläret låst tills tiden gått. Även denna neutral.
- **session-expired-inhopp:** detta ÄR målet för utgången session (§0.1) — ingen egen variant; toast från shell ("Din session har gått ut. Verifiera dig igen.") är tillåten.

### CTA/keyboard/fokus

- Autofokus på fältet vid sidladdning. `Enter` = submit.
- Ring §6.2; felrad via `aria-describedby`. Fokusordning: fält → Skicka kod.
- Inga andra CTA:er: ingen "logga in", ingen "skapa konto", ingen tenantväxlare.

### Responsivt

- Mobil: enkolumn, gutters enligt §0.3, knapp full bredd. ≥768: formuläryta max ~440px centrerad. Desktop: samma centrerade smala yta (recovery använder inte trekolumnslayouten).

### Tokens

`--bg`, `--surface-1/-2`, `--line-2`, `--radius-field/-card`, `--ink-1/-2/-3`, `--negative`, `--action*`, `--button-primary-h`, `--text-h1-*/-body-*/-compact-*/-meta-*`, `--font-ui`, `--icon-sm`, `--space-2…-6`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Recovery-briefen: lösenordsfri åtkomst via redan verifierad kanal, servern äger kanalvalet, svaret är alltid enumeration-neutralt, och flödet `/aterhamta/[tenantSlug]` → `/verifiera/[tenantSlug]` är den enda ingången utan session.

---

**Omfattning del 4:** CustomerProfileCard, VerifiedContactCard, ContactChangeFlow, PortalSessionList, BookingTrustList, DestructiveActionDialog.

---

## 17. CustomerProfileCard

### Syfte

Profilsidans nav och uppgiftskort på `/mina/profil`: kundens namn (redigerbart) och länkmeny till portalens övriga profilsidor. Ingen login, inget lösenord, ingen IP — sådana element existerar inte i produkten (§0.1).

### Route/placering

- `/mina/profil`, hela `<main>`-innehållet under `<h1>Profil</h1>`. Nav-markering: Profil (§3).
- Uppgiftskortet (namn + `VerifiedContactCard` §18) först, menyn därunder. Menyposten "Mina uppgifter" på andra sidor länkar hit och fokus sätts på uppgiftskortet.

### DOM/ARIA-ordning

1. `<h1>Profil</h1>` (`--text-h1-*`).
2. **Uppgiftskort** `<section aria-labelledby="uppgifter" id="uppgiftskort" tabindex="-1">` (`--surface-1`, 1px `--line-1`, `--radius-card`, `--shadow-card`):
   - `<h2 id="uppgifter">Mina uppgifter</h2>` (`--text-h2-*`).
   - Namnrad: label "Namn" (`--text-meta-*` `--ink-2`), värde (`--text-body-*` `--ink-1`), ghost-knapp **"Ändra"** (§6.3, ≥44px).
   - `VerifiedContactCard` (§18) — verifierad kontakt renderas ENDAST via den komponenten.
3. **Meny** `<nav aria-label="Profilmeny">` med `<ul>` av länkrader (radkontrakt §7; ikon 24 `--icon-lg` + label `--text-compact-*` + chevron 16). Poster, exakt denna slutna lista i exakt denna ordning:

| Post | Mål |
|---|---|
| Mina uppgifter | `/mina/profil` — fokus flyttas till uppgiftskortet (på sidan själv: scroll+fokus, ingen navigering) |
| Säkerhet och enheter | `/mina/sakerhet` |
| Installera på hemskärmen | `/mina/installera` |
| Integritet | `/mina/integritet` |
| Hjälp | `/hjalp` |
| Logga ut | öppnar `DestructiveActionDialog` (§22, variant logout-current) — `<button>`, inte länk |

Andra poster (login, lösenord, "Mina företag", notiser, erbjudanden) = FAIL. "Logga ut"-radens text + ikon i `--negative`.

### Redigera namn (inline)

- "Ändra" byter namnraden till `<form>`: `<label for="namn">Namn</label>`, `<input id="namn" type="text" autocomplete="name" minlength="2" maxlength="120">` (§6.3 Input, ≥16px), sekundär **"Avbryt"** + primär **"Spara"** (≥44/48px).
- Validering: 2–120 tecken efter trim. Fel → felrad `--negative` 12/18 + ikon, `role="alert"`, **"Namnet måste vara 2–120 tecken."**; ingen serverbegäran.

### Tillåtna kundsynliga props

Inga. Namn och kontakt ur sessionens datakontext (§0.2).

### States

- **default:** visningsläge enligt ovan.
- **edit:** formuläret ovan, autofokus i fältet med markören sist.
- **loading:** skeleton §12.5 för namnrad + kontaktkort; menyn renderas direkt (statisk).
- **error:** uppgiftskortet visar "Uppgifterna kunde inte hämtas" (`--ink-2`) + sekundär "Försök igen"; menyn förblir funktionell.
- **session-expired:** shell-recovery (§1).

### Pending/success/failure (Spara)

- **pending:** "Spara" `aria-disabled` + **"Sparar…"**; fältet låst.
- **success:** tillbaka till visningsläge med nytt namn, fokus på "Ändra", toast **"Namnet är sparat."** (§11).
- **failure:** kvar i edit; felrad **"Namnet kunde inte sparas. Försök igen."**; värdet behålls, knappen återställs.

### CTA/keyboard/fokus

- `Tab`-ordning = DOM-ordning: Ändra → (kontaktkortets CTA) → menyposter uppifrån och ned. `Esc` i edit = Avbryt (fokus åter på "Ändra").
- Ring §6.2 överallt; träffytor ≥44px; menyrader ≥ `--tap-min` höga.

### Responsivt

- Mobil/tablet: enkolumn full bredd; edit-knappar staplade (primär överst). Desktop: i `--col-main`; edit-knappar i rad.

### Tokens

`--surface-1/-2/-3`, `--line-1/-2`, `--radius-card/-field`, `--shadow-card`, `--ink-1/-2/-3`, `--negative`, `--action*`, `--button-primary-h`, `--text-h1-*/-h2-*/-body-*/-compact-*/-meta-*`, `--font-ui`, `--icon-sm/-lg`, `--space-2…-6`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Profilbriefen: profilen är namn + verifierad kontakt + meny, inget konto-UI; namnredigering 2–120 tecken med "Namnet är sparat."; menylistan är sluten och Logga ut kräver alltid dialog.

---

## 18. VerifiedContactCard

### Syfte

Visar kundens **primära verifierade kontakt** — en serverstyrd union `sms | email`, aldrig båda som primär — och är enda ingången till `ContactChangeFlow` (§19). Kontakten är kundens identitetsnyckel i den lösenordsfria modellen och behandlas som säkerhetsdata, inte fritextfält.

### Route/placering

- Inuti CustomerProfileCards uppgiftskort (§17). Får inte förekomma någon annanstans.

### DOM/ARIA-ordning

1. Delkort (`--surface-2`, `--radius-field`, 1px `--line-2`, padding `--space-4`).
2. Label: **"Verifierad kontakt"** (CP-VC-01, `--text-meta-*` `--ink-2`).
3. Kanalrad (primär): ikon 20 (SMS-/mejlikon, `aria-hidden`) + kanalordet **"SMS"** (CP-VC-02) eller **"E-post"** (CP-VC-03) (`--text-compact-*` `--ink-2`) + värdet (`--font-mono` `--ink-1`, `--text-body-size`): ALLTID den serverlevererade MASKERADE destinationen (`maskedDestination`) — ingen destination visas omaskerad, inte heller i kundens egen vy.
4. Verifieringsmärke: badge §12.3 med bock 16 + **"Verifierad"** (CP-VC-04, `--positive`).
5. Sekundär kontaktrad ENDAST om den faktiskt finns (maskerad): verifierad reservkontakt (t.ex. tidigare verifierad e-post efter mobiltillägg) med chip CP-VC-04 "Verifierad", eller overifierad valfri e-post hos SMS-kund med chip CP-VC-05 "Inte verifierad".
6. Åtgärdsknapp(ar) (§6.3, ≥44px) → startar §19 med serverstyrd åtgärd:
   - primär kontakt är mobil → CP-VC-06 **"Byt telefonnummer"** (`change_phone`);
   - e-postverifierad kund utan telefon → CP-VC-07 **"Lägg till mobilnummer"** (`add_phone`);
   - på en e-postrad som faktiskt finns → CP-VC-08 **"Byt e-post"** (`change_email`).

### Datakontrakt (bindande)

- `verifiedContact` är en serverstyrd union: `{ channel: "sms", maskedDestination }` ELLER `{ channel: "email", maskedDestination }` (brief §22). Klienten renderar exakt det servern anger — ingen lokal härledning, ingen prop, aldrig omaskerad destination.
- **Telefon får saknas** (e-postkund utan telefonnummer): då finns bara e-postraden — ingen tom telefonrad, ingen platshållare — och åtgärden är CP-VC-07 "Lägg till mobilnummer" (brief §15.2). Efter godkänt tillägg blir mobilen primär verifierad kanal och den tidigare verifierade e-posten ligger kvar som maskerad verifierad reservkontakt.
- Overifierad PRIMÄRkontakt kan inte förekomma i en giltig session; en valfri sekundär kontakt får vara overifierad (CP-VC-05).
- Ingen relation slås ihop automatiskt; alla ändringar sker endast via §19.

### Tillåtna kundsynliga props

Inga.

### States

- **default:** enligt ovan.
- **loading:** skeleton §12.5 (label + en rad), ingen layout-shift.
- **error:** ärvs av §17 (kortet renderas inte separat vid uppgiftsfel).
- **change-pending:** medan §19 är öppen/oavslutad visas default oförändrat — bytet är atomärt, halvbytt kontakt får ALDRIG visas.

### CTA/keyboard/fokus

- Enda interaktioner: åtgärdsknapparna CP-VC-06/07/08 (ring §6.2, ≥44px). Vid avbrutet/misslyckat flöde i §19 återlämnas fokus till den utlösande knappen.

### Responsivt

- Alla lägen: full bredd i uppgiftskortet; knappen full bredd på mobil, auto-bredd ≥768.

### Tokens

`--surface-2`, `--line-2`, `--radius-field/-pill`, `--ink-1/-2`, `--positive`, `--text-body-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm/-md`, `--space-2/-3/-4`, `--tap-min`, `--focus-ring-*`.

### Briefreferens

Kontaktbriefen (§15/§15.2/§15.3/§22): primärkontakten är en serverstyrd sms/e-post-union med maskerad destination, telefon är optional, e-postkund utan telefon får "Lägg till mobilnummer", tidigare verifierad e-post ligger kvar som maskerad reservkontakt — aldrig fritextredigering av identitetsnyckeln.

---

## 19. ContactChangeFlow

### Syfte

Det enda flödet för att byta eller lägga till primär verifierad kontakt. Tvåstegs step-up: kunden bevisar först kontroll över den NUVARANDE primära kanalen, därefter över den NYA destinationen — först då uppdateras relationen atomärt och allt gammalt förtroende återkallas. Utan båda bevisen ändras ingenting.

### Route/placering

- Startas från VerifiedContactCard (§18) med en serverstyrd åtgärd: `change_phone` (CP-VC-06 "Byt telefonnummer"), `add_phone` (CP-VC-07 "Lägg till mobilnummer") eller `change_email` (CP-VC-08 "Byt e-post"). Åtgärden — aldrig fältformatet — avgör den nya destinationens kanal. Renderas som dialog/bottom-sheet enligt TOKENS §11 ovanpå `/mina/profil` (mobil/tablet: sheet på `--surface-2`; desktop: dialog på `--surface-3`, max 440px). Ingen egen route.
- Scrim-klick stänger INTE (säkerhetsflöde); `Esc` = Avbryt (utom under pending).

### Stegkontrakt (kanoniskt, sluten sekvens)

| Steg | Innehåll |
|---|---|
| **1. Bekräfta identitet** | `<h2>Bekräfta att det är du</h2>`, brödtext "Vi skickar en kod till din nuvarande kontakt {maskerat värde}." + primär **"Skicka kod"**. Koden går ALLTID till den nuvarande primära `verifiedContact` — aldrig till något kunden anger här. |
| **2. Ange kod (nuvarande)** | `PinVerificationForm`-kodkontraktet (§14: ett fält, `one-time-code`, samma states invalid/expired/cooldown/max_attempts/delivery_failed). |
| **3. Ny destination (kanalbunden efter åtgärd)** | Telefonåtgärder (`change_phone`/`add_phone`): `<label>Nytt mobilnummer</label>` (CP-CCF-20) + landskodsväljare CP-CCF-33 "Landskod" med normalisering; formatvalidering CP-CCF-21 "Ange ett giltigt mobilnummer." `change_email`: `<label>Ny e-postadress</label>` (CP-CCF-34); validering CP-CCF-35. Inget generiskt "mobil eller e-post"-fält existerar — kanalen är låst av åtgärden, aldrig härledd ur formatet. |
| **4. Ange kod (ny)** | Separat PIN/challenge med separat purpose skickad till den NYA destinationen (SMS till det nya numret vid telefonåtgärder — CP-CCF-24; e-post endast vid `change_email` — CP-CCF-25); samma kodkontrakt som steg 2. Ny kod ≠ steg 2-koden. |
| **5. Klart** | Bekräftelse per åtgärd (bock, `--positive`): CP-CCF-30 **"Telefonnumret är ändrat."** (`change_phone`), CP-CCF-36 **"Mobilnumret är tillagt."** (`add_phone`), CP-CCF-37 **"Kontaktuppgiften är bytt."** (`change_email`) + konsekvensrad (se nedan) + primär **"Stäng"** (CP-CCF-32). |

- Steg-up-fönstret från godkänt steg 2 är **max 10 minuter**; därefter förfaller hela flödet → felyta **"Sessionen för bytet har gått ut. Börja om."** + primär **"Börja om"** (till steg 1).
- Stegindikator "Steg {n} av 4" (`--text-meta-*` `--ink-2`; steg 5 är kvitto).

### Atomiskt byte + återkallelse (bindande)

Vid godkänt steg 4 sker ALLT i en atomär serveroperation — ingen delordning får synas eller överleva fel:

1. Primär `verifiedContact` byts till den nya destinationen.
2. Alla utestående länkar/challenges till den gamla kanalen återkallas.
3. Alla booking trusts (§21) återkallas.
4. Alla ANDRA portalsessioner loggas ut; den aktuella sessionen roteras (nytt sessions-id, kunden förblir inloggad).

Konsekvensraden i steg 5 (och i steg 3 som förhandsinfo, `--text-compact-*` `--ink-2`): **"Dina andra inloggade enheter loggas ut och dina PIN-fria bokningsenheter återkallas."**

### Spärrar (bindande)

- **Gammal kanal otillgänglig** (kunden kommer inte åt nuvarande kontakt): ingen self-service-väg finns. Steg 1 visar länken CP-CCF-08 **"Jag kommer inte åt den här kontaktuppgiften"**. Den byter innehållet i samma dialog/sheet till en neutral hjälpvy med h2 CP-CCF-39, exakt säkerhetstext CP-CCF-40 och sekundär CP-CCF-41 **"Tillbaka"** till steg 1. Hjälpvyn visar exakt en fungerande publik kontaktväg: CP-TID-03 **"Ring"** om telefon finns, annars CP-DET-15 **"deras webbplats"** om publik webbplats finns. Ingen reservadress, ny destination, personalsession, uppladdad handling eller kontaktlänk får kringgå step-up.
- **Konflikt (nya uppgiften används redan av annan kundprofil):** i steg 4 visar telefonåtgärder CP-CCF-29 och `change_email` CP-CCF-38. Ingen merge, ingen text som avslöjar den andra relationens uppgifter.

### Tillåtna kundsynliga props

Inga. Nuvarande kontakt, maskering och tenantnamn ur sessionskontexten.

### States / pending / success / failure

- Kodstegen ärver §14:s slutna statelista. Steg 1/3-submit: pending = knapp `aria-disabled` + "Skickar…"/"Skickar kod…"; failure = felrad "Något gick fel. Försök igen." (`role="alert"`), värden behålls.
- **success (helhet):** steg 5; VerifiedContactCard visar nya värdet först EFTER stängning (atomärt, §18).
- **avbrutet (Avbryt/`Esc`/10-min):** ingenting har ändrats; fokus åter till den åtgärd som öppnade flödet: "Byt telefonnummer", "Lägg till mobilnummer" eller "Byt e-post".
- Idempotens: dubbelsubmit i steg 4 får aldrig ge dubbelbyte — servern svarar med samma resultat (→ steg 5).

### CTA/keyboard/fokus

- Fokusfälla §11; initialt fokus på stegets rubrik; `Esc` = Avbryt (låst under pending). Sekundär **"Avbryt"** finns i steg 1–4.
- Ring §6.2; fält ≥16px; knappar ≥44/48px, staplade på mobil (primär överst).

### Responsivt

- Mobil/tablet: bottom-sheet, internt scrollbar med tangentbord (TOKENS §10). Desktop: centrerad dialog. Samma stegsekvens alla lägen.

### Tokens

`--surface-2/-3`, `--line-2`, `--radius-dialog/-field`, `--shadow-dialog`, `--ink-1/-2`, `--negative/-positive`, `--action*`, `--button-primary-h`, `--text-h2-*/-body-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm/-md`, `--space-2…-6`, `--z-scrim/-sheet`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Kontaktbytesbriefen: step-up mot nuvarande kanal först (max 10 min), separat challenge mot nya destinationen, därefter atomärt byte med full återkallelse (gamla länkar/challenges, booking trusts, andra sessioner) + sessionsrotation; otillgänglig gammal kanal = kontakta företaget; konflikt = neutral, aldrig merge.

---

## 20. PortalSessionList

### Syfte

Lista över kundens aktiva portalsessioner under rubriken **"Inloggade enheter"** — endast sessioner på portalhosten (`mina.corevo.se`). Ger utloggning per enhet, av alla andra, och av aktuell enhet. Bokningsenheter på tenanthosten hör till §21, aldrig hit.

### Route/placering

- `/mina/sakerhet`, under `<h1>Säkerhet och enheter</h1>`, ovanför BookingTrustList (§21). Nav-markering: Profil (§3).

### DOM/ARIA-ordning

1. `<section aria-labelledby="enheter">` med `<h2 id="enheter">Inloggade enheter</h2>` (`--text-h2-*`).
2. `<ul>` i listcontainer (§7-kontraktet). Per `<li>`:
   - Enhetsbeskrivning (`--text-compact-*` `--ink-1`): läsbar enhet/webbläsare, t.ex. "iPhone · Safari". Okänd → "Okänd enhet".
   - Senast aktiv (`--text-meta-*` `--ink-2`, relativ tid t.ex. "för 2 tim sedan"; tidsvärde i `--font-mono`).
   - Aktuell session: badge §12.3 **"Den här enheten"** (`--positive`), alltid sorterad först.
   - Åtgärd: destruktiv knapp §6.3 — **"Logga ut"** (andra enheter) / **"Logga ut här"** (aktuell) — öppnar §22.
3. Efter listan, vid ≥2 sessioner: destruktiv knapp **"Logga ut alla andra enheter"** → §22.
4. **Ingen IP-adress i standardvyn.** Ingen plats-/IP-kolumn; sådan data = FAIL i denna vy.

### Tillåtna kundsynliga props

Inga. Sessionslistan ur serverstate; aktuell session flaggas av servern.

### States

- **default:** enligt ovan.
- **empty:** kan inte inträffa i giltig session (minst den aktuella finns) — inget empty-kontrakt.
- **loading:** 2 skeleton-rader §12.5.
- **error:** "Enheterna kunde inte hämtas" + sekundär "Försök igen".
- **session-expired:** shell-recovery (§1).

### Pending/success/failure

- Ägs av §22 per åtgärd. Efter lyckad utloggning av annan enhet: raden tas bort, `role="status"`-annons "Enheten är utloggad."; fokus till närmast följande rad (eller rubriken om listan bara har aktuell kvar).
- Redan utloggad session (idempotent) → behandlas som success, aldrig fel.

### CTA/keyboard/fokus

- Raderna är INTE länkar (ingen detaljvy i v1); enda fokusbara element är knapparna. `Tab` rad för rad; ring §6.2; ≥44px.

### Responsivt

- Mobil: enhetsinfo över knapp (staplad rad); ≥768: info vänster, knapp höger. Desktop: i `--col-main`.

### Tokens

`--surface-1/-2`, `--line-1/-2`, `--radius-card/-pill`, `--shadow-card`, `--ink-1/-2/-3`, `--negative/-positive`, `--text-h2-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm`, `--space-2…-5`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Säkerhetsbriefen: "Inloggade enheter" visar ENDAST portalsessioner (mina.corevo.se), aldrig IP i standardvyn, och all utloggning går via bekräftelsedialogen med exakta konsekvenser.

---

## 21. BookingTrustList

### Syfte

Lista under rubriken **"PIN-fria bokningsenheter"**: enheter kunden markerat som betrodda i tenantens bokningsflöde, så att FRAMTIDA bokningar på tenanthosten inte kräver ny PIN. Återkallelse här påverkar ENDAST framtida PIN-krav på tenanthosten — aldrig portalsessioner (§20) och aldrig befintliga bokningar.

### Route/placering

- `/mina/sakerhet`, under PortalSessionList (§20). Egen `<section>` — de två listorna får aldrig slås ihop eller dela rader.

### DOM/ARIA-ordning

1. `<section aria-labelledby="pinfria">` med `<h2 id="pinfria">PIN-fria bokningsenheter</h2>`.
2. Förklaringsrad `--text-compact-*` `--ink-2`: **"På de här enheterna kan du boka hos {Tenantnamn} utan att ange en ny kod."**
3. `<ul>` i listcontainer (§7). Per `<li>`: enhetsbeskrivning (`--ink-1`), betrodd sedan (`--text-meta-*` `--ink-2`, datum i mono), destruktiv knapp **"Kräv PIN nästa gång"** → §22.
4. Efter listan, vid ≥2 poster: destruktiv knapp **"Kräv PIN på alla enheter"** → §22.
5. Ingen IP i standardvyn (som §20).

### Tillåtna kundsynliga props

Inga.

### States

- **default:** enligt ovan.
- **empty:** ärligt tomt läge: ikon 24 `--ink-3` + **"Inga PIN-fria enheter."** (`--ink-2`) + förklaringsraden. Ingen CTA (trust skapas endast i bokningsflödet på tenanthosten, aldrig här).
- **loading:** 2 skeleton-rader §12.5.
- **error:** "Enheterna kunde inte hämtas" + sekundär "Försök igen".

### Pending/success/failure

- Ägs av §22. Success: raden tas bort, annons **"PIN krävs nästa gång på enheten."** (`role="status"`); "alla" → listan byter till empty-läget. Redan återkallad trust = success (idempotent).
- Effekten är strikt framåtriktad: pågående/kommande bokningar berörs inte, portalsessionen berörs inte — konsekvenstexten i §22 säger exakt detta.

### CTA/keyboard/fokus

- Som §20: endast knapparna fokusbara, ring §6.2, ≥44px.

### Responsivt

- Som §20. Desktop: i `--col-main`.

### Tokens

`--surface-1/-2`, `--line-1/-2`, `--radius-card`, `--shadow-card`, `--ink-1/-2/-3`, `--negative`, `--text-h2-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm/-lg`, `--space-2…-5`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Trust-briefen: "PIN-fria bokningsenheter" är tenanthostens trust-lager, separat från portalsessioner; återkallelse ("Kräv PIN nästa gång"/"Kräv PIN på alla enheter") gäller endast framtida PIN-krav och går alltid via bekräftelsedialog.

---

## 22. DestructiveActionDialog

### Syfte

Den enda bekräftelseytan för säkerhetssidans destruktiva åtgärder: logga ut annan enhet, logga ut alla andra, logga ut den här enheten, samt återkalla en/alla booking trusts. Samma skal som CancelBookingDialog (§11) men med variantstyrd copy — varje variant anger sin EXAKTA konsekvens.

### Route/placering

- Overlay på `/mina/sakerhet` (och Logga ut-posten i §17 från `/mina/profil`), aldrig egen route. Mobil/tablet: bottom-sheet; desktop: centrerad dialog (TOKENS §11). Scrim-klick stänger INTE.

### Variantmatris (kanonisk, sluten)

| Variant | Rubrik | Konsekvenstext | Destruktiv CTA |
|---|---|---|---|
| `logout-other` | Logga ut enheten? | "{Enhet} loggas ut från dina bokningar. Enheten kan verifiera sig igen med en ny kod." | **Logga ut enheten** |
| `logout-all-others` | Logga ut alla andra enheter? | "Alla enheter utom den här loggas ut. De kan verifiera sig igen med en ny kod." | **Logga ut alla andra** |
| `logout-current` | Logga ut från den här enheten? | "Du loggas ut från dina bokningar på den här enheten. Du kan verifiera dig igen med en ny kod." | **Logga ut** |
| `revoke-trust` | Kräv PIN på enheten? | "{Enhet} måste ange en kod vid nästa bokning hos {Tenantnamn}. Dina bokningar och din inloggning här påverkas inte." | **Kräv PIN nästa gång** |
| `revoke-all-trusts` | Kräv PIN på alla enheter? | "Alla PIN-fria enheter måste ange en kod vid nästa bokning hos {Tenantnamn}. Dina bokningar och din inloggning här påverkas inte." | **Kräv PIN på alla** |

Andra varianter/texter = FAIL. Sekundär knapp är alltid **"Avbryt"**.

### DOM/ARIA-ordning

1. `<div role="dialog" aria-modal="true" aria-labelledby="da-titel" aria-describedby="da-brod">`; (mobil) drag-handtag `aria-hidden`.
2. `<h2 id="da-titel">` variantens rubrik (`--text-h2-*`).
3. `<p id="da-brod">` variantens konsekvenstext (`--text-body-*` `--ink-2`).
4. Felrad (endast failure): `--negative` 12/18 + ikon 16, `role="alert"`.
5. Knapprad: sekundär **"Avbryt"** → destruktiv variant-CTA (§6.3 destruktiv), båda ≥44px; mobil staplade med destruktiv underst.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `variant` | enum enligt matrisen | Väljer rubrik/konsekvens/CTA. |

Enhetsnamn/tenantnamn ur kontexten; `open`/callbacks är interna (§0.2).

### States / pending / success / failure

- **default (öppen):** initialt fokus på "Avbryt".
- **pending:** destruktiva CTA:n `aria-disabled` + gerundtext (**"Loggar ut…"** / **"Återkallar…"**); "Avbryt" och `Esc` låsta.
- **success:** dialogen stängs; värdlistan uppdaterar enligt §20/§21. **Undantag `logout-current`:** ingen återgång till portalen — hela vyn ersätts av utloggningsyta: `<h1>Du är utloggad</h1>` (`--text-h1-*`) + primär **"Få en ny kod"** → `/aterhamta/[tenantSlug]`. Inga andra CTA:er, ingen nav (recovery-shell §1).
- **failure:** dialogen stängs INTE; felrad **"Åtgärden kunde inte genomföras. Försök igen."**; CTA:n återställs.
- **idempotent:** redan utloggad session / redan återkallad trust → behandlas som success, aldrig fel.

### CTA/keyboard/fokus

- Fokusfälla §11; `Esc` = Avbryt (utom pending); vid stängning utan åtgärd återlämnas fokus till utlösarknappen.
- Ring §6.2; träffytor ≥44px.

### Responsivt

- Mobil/tablet: bottom-sheet (in `translateY`+fade 160–200ms, ut 120–160ms, 0ms reduced motion). Desktop: centrerad dialog max 440px.

### Tokens

`--surface-2/-3`, `--line-2`, `--radius-dialog`, `--shadow-dialog`, `--ink-1/-2`, `--negative`, `--text-h1-*/-h2-*/-body-*/-meta-*`, `--font-ui`, `--icon-sm`, `--space-2…-6`, `--z-scrim/-sheet`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Säkerhetsbriefen: varje destruktiv åtgärd har egen dialog med exakt konsekvens, "Avbryt" + specifik destruktiv CTA, ärlig pending/failure och idempotent server-semantik; logga-ut-här landar i "Du är utloggad" med enda vägen tillbaka via "Få en ny kod" → `/aterhamta/[tenantSlug]`.

---

**Omfattning del 5:** InstallPromptCard, IosInstallGuide, PortalEmptyState, PortalErrorState, PortalSkeleton.

---

## 23. InstallPromptCard

### Syfte

Portalens enda PWA-installationserbjudande. Äger hela installationslogiken: plattformsdetektering, den slutna erbjudande-maskinen (max två verkliga erbjudanden per enhet, någonsin) och rätt CTA per miljö (Android/Chromium, iOS Safari, in-app-webbläsare). Ingen annan komponent får erbjuda installation.

### Manifest (bindande, komponentens förutsättning)

- `name`: exakt **"Mina bokningar · Corevo"**. `short_name`: exakt **"Mina bokningar"**.
- `id`: `/mina/` · `start_url`: `/mina/` · `scope`: `/mina/` · `display`: `standalone`.
- Manifestet FÅR INTE innehålla persondata eller tenantdata: inga kundnamn, inga tenantnamn/logotyper, inga boknings-id:n, inga query-parametrar med state. Ikoner = Corevos neutrala appikon. Avvikelse = FAIL.

### Route/placering

- **Automatiskt erbjudande:** `/mina`, som SISTA blocket i huvudkolumnen (efter UpcomingBookingList) — erbjudandet får aldrig tränga sig före bokningsinnehållet.
- **Manuell ingång:** `/mina/installera` (menyposten "Installera på hemskärmen", §17). Sidan visar samma kort i `placement="page"` och räknas ALDRIG som ett av de två automatiska erbjudandena — den är alltid nåbar, även efter `dismissed_twice`.
- Nav-markering på `/mina/installera`: Profil (§3).

### Erbjudande-maskin (kanonisk, sluten)

| State | Betydelse | UI |
|---|---|---|
| `unsupported` | Miljön kan inte installera (och är inte in-app) | Kortet renderas INTE på `/mina`. På `/mina/installera`: ärlig text **"Din webbläsare stöder inte installation."** (`--ink-2`), inga CTA:er. |
| `standalone` | Redan installerad, körs i standalone-läge | ALLT döljs på `/mina`. `/mina/installera` visar bekräftelse: bock 24 `--positive` + **"Appen är installerad."** (`--ink-1`), inga CTA:er. |
| `eligible` | Stödd miljö, inga förbrukade erbjudanden | Kortet renderas på `/mina` → övergår till `prompted_once` i samma ögonblick det faktiskt visats. |
| `prompted_once` | Första verkliga erbjudandet visas/visat | Kort enligt DOM nedan. "Inte nu" → `dismissed_once`. |
| `dismissed_once` | Första erbjudandet avböjt | Kortet döljs för resten av besöket och persisteras per enhet. Visas igen FÖRST vid ett **senare separat besök** (ny session, inte samma sidvisning/flik) → `prompted_twice`. |
| `prompted_twice` | Andra och SISTA verkliga erbjudandet | Samma kort. "Inte nu" → `dismissed_twice`. |
| `dismissed_twice` | Permanent avböjt | Kortet renderas ALDRIG mer automatiskt på denna enhet. Endast `/mina/installera` återstår. Ingen "påminnelse", ingen toast, ingen banner = bindande. |
| `accepted` | Installationen genomförd | → `standalone` (allt döljs). |

- "Verkligt erbjudande" = kortet har faktiskt renderats synligt. Räknaren persisteras per enhet (t.ex. localStorage) och FÅR INTE nollställas vid utloggning — den följer enheten, inte sessionen.
- Fler än två automatiska visningar = FAIL. Native-promptens egen dismiss (Android) räknas som avböjt erbjudande.

### DOM/ARIA-ordning

1. `<section aria-labelledby="installera">` som kort (`--surface-1`, 1px `--line-1`, `--radius-card`, `--shadow-card`).
2. Appikon-platta 48×48 (`--logo-max`, Corevo-neutral, `aria-hidden`).
3. Automatkortet använder `<h2 id="installera">Ha dina bokningar nära till hands</h2>` (`CP-PWA-01`). Den manuella sidan har separat sid-h1 `Installera på hemskärmen` (`CP-INST-04`) och kortets rubrik ligger under som h2.
4. Brödtext `--text-compact-*` `--ink-2`: **"Snabb åtkomst till dina bokningar, direkt från hemskärmen."** Ingen persondata, inget tenantnamn i copyn.
5. Statusrad (endast vid kopierad länk, se in-app): `--text-meta-*` `--positive` + bock 16, `role="status"`.
6. Knapprad enligt miljövariant (nedan). Sist alltid ghost-knapp **"Inte nu"** (§6.3 ghost, ≥44px) — utom i `placement="page"` där "Inte nu" utgår (sidan stängs via navigation).

### Miljövarianter (kanonisk, sluten)

| Miljö | Primär CTA | Beteende |
|---|---|---|
| **Android/Chromium** (fångad `beforeinstallprompt`) | CP-PWA-03 **"Lägg på hemskärmen"** (§6.3 primär, ≥48px) | Native-prompten anropas ENDAST som direkt svar på klicket (user gesture). Prompt före klick = FAIL. Accept → `accepted`; native-dismiss → räknas som avböjt. |
| **iOS Safari** | **"Visa hur"** (§6.3 primär) | Öppnar `IosInstallGuide` (§24). Ingen native-prompt existerar; ingen fejkad "Installera"-knapp = FAIL. |
| **In-app-webbläsare** (Instagram/Facebook/Messenger m.fl.) | CP-APP-02 **"Kopiera länken"** (§6.3 primär) | Kopierar portalens rena personliga `/mina`-URL till urklipp → statusraden CP-APP-03 **"Länken är kopierad"** endast efter verklig framgång; fel visar CP-APP-08. Under knappen: `<ol>` med exakt tre steg (`--text-compact-*` `--ink-2`): CP-APP-04 **"1. Kopiera länken."** CP-APP-05 **"2. Öppna Safari."** CP-APP-06 **"3. Klistra in länken i adressfältet."** En knapp CP-APP-07 **"Öppna i Safari"** får ENDAST finnas när en verifierad systemåtgärd för detta existerar i miljön — aldrig en gissad URL-scheme-länk som kan bli en död knapp. Saknas verifierad väg finns bara Kopiera-vägen. |

- Miljödetektering är intern; blandade varianter (t.ex. iOS-steg + Android-knapp) = FAIL.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `placement` | `"auto" \| "page"` | `auto` = kortet på `/mina` (styrs av maskinen); `page` = `/mina/installera` (visas alltid utom i `unsupported`/`standalone`-texterna ovan, utan "Inte nu", påverkar aldrig räknaren). |

Miljö och maskin-state härleds — aldrig props.

### States / pending / success / failure

- Maskinens states enligt matrisen. Kortet har inget loading-läge (renderas först när detekteringen är klar; ingen skeleton — kortet är inte flödeskritiskt).
- **Kopiera pending/failure:** misslyckad urklippsåtkomst → statusraden **"Länken kunde inte kopieras. Markera och kopiera adressen manuellt."** (`--negative` + ikon, `role="alert"`) samt adressen synlig i `--font-mono` för manuell kopiering.
- **session-expired:** shell-recovery (§1); räknaren röres inte.
- **Offline:** kortet får renderas (ingen persondata i det), men installation kräver nät — Android-CTA:n får `aria-disabled` + metarad "Kräver internetanslutning."

### CTA/keyboard/fokus

- `Tab`-ordning: primär CTA → ("Öppna i Safari" om den finns) → "Inte nu". Ring §6.2, träffytor ≥44px (primär ≥48px).
- "Inte nu" flyttar fokus till nästa sektion på sidan (inget fokustapp när kortet försvinner).
- Native-prompt (Android) återlämnar fokus till kortet/dess plats efter stängning.

### Responsivt

- Mobil: full bredd, knappar staplade (primär överst). ≥768: knappar i rad. Desktop: i `--col-main` (`placement="auto"`) respektive huvudkolumnen på `/mina/installera`.

### Tokens

`--surface-1`, `--line-1`, `--radius-card/-field`, `--shadow-card`, `--ink-1/-2`, `--positive/-negative`, `--action*`, `--button-primary-h`, `--text-h2-*/-h3-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--icon-sm/-lg`, `--logo-max`, `--space-2…-6`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

PWA-briefen: manifestet är Corevo-neutralt (`name` "Mina bokningar · Corevo", `short_name` "Mina bokningar", id/start/scope `/mina/`, ingen persondata); max två verkliga automatiska erbjudanden per enhet med permanent tystnad efter andra avböjandet; native-prompt endast efter klick; iOS får ärlig guide, in-app-webbläsare får kopiera-vägen; standalone döljer allt.

---

## 24. IosInstallGuide

### Syfte

Steg-för-steg-guiden för att lägga till portalen på hemskärmen i iOS Safari, där ingen native-installprompt finns. Instruktionerna citerar iOS eget UI ordagrant — kunden ska känna igen exakt de ord hon ser i Safari.

### Route/placering

- Öppnas av "Visa hur" i InstallPromptCard (§23, iOS-varianten). Mobil: bottom-sheet enligt TOKENS §11; ≥768 (iPad Safari): centrerad dialog. Ingen egen route.
- På `/mina/installera` (iOS) får guiden dessutom renderas **inline** i sidan (`presentation="inline"`, ingen scrim/fälla) under kortet.

### DOM/ARIA-ordning

1. (Sheet/dialog) `<div role="dialog" aria-modal="true" aria-labelledby="ios-guide-titel">`; (mobil) drag-handtag `aria-hidden`. Inline: `<section aria-labelledby="ios-guide-titel">`.
2. `<h2 id="ios-guide-titel">Så lägger du till på hemskärmen</h2>` (`--text-h2-*`).
3. `<ol>` med EXAKT tre steg. Per `<li>`: stegnummer i `--font-mono` (`--ink-2`), ikon 20 (`--icon-md`, `aria-hidden`) och text `--text-body-*` `--ink-1` där iOS-termerna är markerade (vikt 650):
   1. **"Tryck på Dela"** — dela-ikonen (fyrkant med pil upp).
   2. **"Välj Lägg till på hemskärmen"** — plus-i-fyrkant-ikonen.
   3. **"Tryck på Lägg till"**.
4. Bekräftelserad CP-IOS-06 `--text-meta-*` `--ink-2`: **"Klart — Mina bokningar finns på hemskärmen."**
5. Sekundär knapp CP-IOS-07 **"Stäng"** (§6.3, ≥44px). Inga andra CTA:er — guiden kan inte "installera åt" kunden och låtsas aldrig kunna det.

Texterna i steg 1–3 är låsta (de speglar iOS svenska UI). Andra formuleringar, skärmdumpar med persondata eller extra steg = FAIL.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `presentation` | `"sheet" \| "inline"` | Sheet/dialog med fokusfälla respektive statisk sektion i `/mina/installera`. |

### States

- Endast default. Ingen loading/empty/error — innehållet är statiskt. Har enheten gått till standalone medan guiden är öppen stängs den och §23 visar `standalone`-läget.

### CTA/keyboard/fokus

- Sheet/dialog: fokusfälla §11, initialt fokus på rubriken, `Esc` = Stäng, scrim-klick stänger (icke-destruktivt), fokus återlämnas till "Visa hur".
- Inline: inga fällor; "Stäng" utgår (sektionen är del av sidan).
- Ring §6.2; träffytor ≥44px.

### Responsivt

- Mobil: bottom-sheet (in `translateY`+fade 160–200ms, ut 120–160ms, 0ms vid reduced motion), safe-area-padding i botten. ≥768: dialog max 440px. Inline: full bredd i huvudkolumnen.

### Tokens

`--surface-2/-3`, `--line-2`, `--radius-dialog/-field`, `--shadow-dialog`, `--ink-1/-2`, `--text-h2-*/-body-*/-meta-*`, `--font-ui/-mono`, `--icon-md`, `--space-2…-6`, `--z-scrim/-sheet`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

PWA-briefen (iOS-spåret): iOS saknar installprompt — portalen visar en ärlig guide med iOS exakta ord "Dela" → "Lägg till på hemskärmen" → "Lägg till", ingenting som låtsas installera.

---

## 25. PortalEmptyState

### Syfte

Den kanoniska renderaren för portalens ÄRLIGA tomlägen. Varje yta har sitt eget, separata tomläge med sin egen text — ett tomläge lånar aldrig en annan ytas copy, visar aldrig exempeldata och erbjuder aldrig login (login existerar inte, §0.1). Sektionskontrakten §6/§8/§21 pekar på denna komponent; deras texter är matrisens rader.

### Route/placering

- Renderas inuti värdytans container (kort/listcontainer) i stället för dess innehåll. Aldrig fristående route.

### Variantmatris (kanonisk, sluten)

| Variant | Yta | Rubrik | Brödtext | CTA |
|---|---|---|---|---|
| `bokningar` | NextBookingCard (§6 empty) | CP-HOME-14 **"Ingen kommande bokning"** | CP-HOME-15 **"Du har ingen bokning på gång just nu."** när historik finns, annars CP-HOME-16 **"Du har inga bokningar hos [Företag] ännu."** | Primär `BookAgainButton` CP-HOME-17 **"Boka ny tid"**. När en senaste genomförd tjänst fortfarande är publik får en separat sekundär CP-HOME-18 **"Boka igen"** + CP-HOME-19 metarad visas. |
| `historik` | BookingHistoryList (§8 empty) | — | CP-HIST-06 **"Du har inga tidigare bokningar hos [Företag] ännu."** | Ingen (bokning görs från `/mina`). |
| `pinfria` | BookingTrustList (§21 empty) | **"Inga PIN-fria enheter."** | Förklaringsraden ur §21. | Ingen (trust skapas endast i tenantens bokningsflöde). |

Andra varianter/texter = FAIL. Nya tomlägen kräver ny rad i denna matris.

### DOM/ARIA-ordning

1. Värd-containerns yta (`--surface-1`, `--radius-card`, 1px `--line-1`) med centrerat innehåll, padding `--space-6` vertikalt.
2. Ikon 24 (`--icon-lg`, `--ink-3`, `aria-hidden`) med distinkt form per variant.
3. Rubrik (`--text-h3-*`, `--ink-1`) när matrisen anger en. Semantisk nivå ärvs av värdytan (h2 i §6-kortet, annars text med rubrikvikt utan att bryta sidans rubrikhierarki).
4. Brödtext (`--text-compact-*`, `--ink-2`) om matrisen anger en.
5. CTA om matrisen anger en (§6.3-variant enligt värdkontraktet).

Ingen `role="alert"`/`aria-live` — ett tomläge är inte ett fel och ska inte annonseras som händelse.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `variant` | enum enligt matrisen | Väljer ikon/rubrik/brödtext/CTA. |

### States

- Endast default. Loading/error ägs av värdytan (§27/§26) — komponenten renderas först när hämtningen lyckats OCH gett noll poster. Ett tomläge FÅR ALDRIG visas medan data fortfarande hämtas eller efter fel (fel ≠ tomt = bindande).

### CTA/keyboard/fokus

- Endast eventuell CTA är fokusbar (ring §6.2, ≥44/48px). Ingen fokusflytt när tomläget renderas.

### Responsivt

- Alla lägen: centrerad stapel i värdcontainerns bredd. Desktop: följer värdytan i `--col-main`.

### Tokens

`--surface-1`, `--line-1`, `--radius-card`, `--ink-1/-2/-3`, `--icon-lg`, `--text-h3-*/-compact-*`, `--font-ui`, `--space-2/-3/-6`, `--tap-min`, `--focus-ring-*`.

### Briefreferens

Tomläges-principen i portalbriefen: varje yta har sitt eget ärliga tomläge — ingen fejkdata, inga hopslagna lägen, tomt är aldrig samma sak som fel, och det enda tomläge som får en boknings-CTA är hero-kortets.

---

## 26. PortalErrorState

### Syfte

Den kanoniska felytan för portalens fellägen. Varje feltyp har sitt eget, separata läge med ärlig text och ett KONKRET nästa steg. Ingen felyta får visa gammal/cachad persondata bredvid felet, gissa data eller erbjuda login. Sektionskontraktens felrader (§§5–8, 10, 17, 20–21) är instanser av denna komponent.

### Route/placering

- Renderas inuti värdytans container (sektionsfel) eller som hela `<main>`-innehållet (sidfel, t.ex. §10 ägarskapsfel). Aldrig egen route.
- **Undantag `session-expired`:** har INGEN egen UI — shellen (§1) navigerar till `/aterhamta/[tenantSlug]`. En felyta som ber kunden "logga in" = FAIL.

### Variantmatris (kanonisk, sluten)

| Variant | Rubrik/text | Nästa steg (CTA) |
|---|---|---|
| `fetch` | "{Yta} kunde inte hämtas" (exakta ytnamn ur värdkontrakten: "Bokningarna/Historiken/Uppgifterna/Enheterna kunde inte hämtas") | Sekundär **"Försök igen"**. |
| `not-found` (neutral ägarskaps-404) | **"Bokningen kunde inte visas"** (`--ink-2`) — EXAKT samma yta för fel tenant, annan kunds bokning och ogiltigt id; ingen skillnad som läcker om bokningen existerar (§10). | Ghost **"Tillbaka"** → `/mina`. |
| `offline` | CP-OFF-01 **"Du är offline. Anslut till internet för att se aktuella bokningar."** | Sekundär CP-OFF-02 **"Försök igen"**. Ytan ERSÄTTER innehållet — ingen gammal persondata (bokningar, namn, kontakt) får ligga kvar synlig eller renderas ur cache. Statiskt skal (topbar/nav) får synas. |
| `server` | **"Något gick fel hos oss."** + "Försök igen om en stund." | Sekundär **"Försök igen"** + valfri fel-ID-rad. |
| `session-expired` | — (redirect, se ovan) | — |

Andra varianter/texter = FAIL.

### Fel-ID (bindande)

- `server`-varianten FÅR visa ett fel-ID för support: `--text-meta-*` `--font-mono` `--ink-3` (AA-mätt, annars `--ink-2`), format CP-ERR-04 **"Felkod: {kod}"**. Koden SKA vara opersonlig — ingen kund-/sessions-/boknings-identifierare, inget som kan slås tillbaka till personen utanför serverloggen. Persondata i fel-ID = FAIL.

### DOM/ARIA-ordning

1. Värdcontainerns yta (sektionsfel) eller kortyta i `<main>` (sidfel), centrerat innehåll, padding `--space-6`.
2. Ikon 24 (`--icon-lg`; `--negative` för `fetch`/`server`, `--ink-3` för `not-found`/`offline`, `aria-hidden`).
3. Rubrik (`--text-h3-*` `--ink-1`; sidfel får `--text-h2-*`).
4. Brödtext (`--text-compact-*` `--ink-2`).
5. Ev. fel-ID-rad (endast `server`).
6. CTA enligt matrisen (§6.3-variant), ≥44px.
7. Fel som UPPSTÅR i en redan renderad vy annonseras med `role="alert"` på textblocket; fel som renderas som del av sidladdningen använder ingen live-region (skärmläsaren läser dem i flödet).

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `variant` | enum enligt matrisen | Väljer ikon/rubrik/text/CTA. |
| `surfaceLabel` | ytnamn (sluten lista ovan, endast `fetch`) | Fyller "{Yta}". |

Fel-ID härleds ur felsvaret — aldrig fri prop.

### States / pending / success / failure

- **default:** enligt matrisen.
- **retry pending:** "Försök igen" `aria-disabled` + **"Hämtar…"** (texten bär tillståndet, ingen spinner-endast).
- **retry success:** felytan ersätts av värdytans default/empty; fokus till värdytans rubrik.
- **retry failure:** felytan kvarstår; toast §11 tillåten. Nytt klick = nytt försök.

### CTA/keyboard/fokus

- Vid sidfel sätts fokus på `<main>`/felrubriken (§1-mönstret). Endast CTA:n är fokusbar; ring §6.2; ≥44px.

### Responsivt

- Som §25: centrerad stapel i värdcontainerns bredd; desktop i `--col-main`. CTA full bredd på mobil vid sidfel.

### Tokens

`--surface-1`, `--line-1/-2`, `--radius-card`, `--ink-1/-2/-3`, `--negative`, `--icon-lg/-sm`, `--text-h2-*/-h3-*/-compact-*/-meta-*`, `--font-ui/-mono`, `--space-2/-3/-6`, `--tap-min`, `--focus-ring-*`, `--motion-*`.

### Briefreferens

Felprinciperna i portal-/detaljbriefen: ärliga separata fellägen med konkret nästa steg; ägarskaps-404 är neutral ("Bokningen kunde inte visas") och läcker aldrig existens; utgången session leder alltid till `/aterhamta/[tenantSlug]`, aldrig login; offline visar aldrig gammal persondata; fel-ID är opersonligt.

---

## 27. PortalSkeleton

### Syfte

Den kanoniska skeleton-renderaren för alla portalens loading-lägen (TOKENS §12.5). Skelettet är en tyst, exakt platshållare för slutlayouten — aldrig fejkdata, aldrig ljud i skärmläsaren.

### Route/placering

- Renderas av värdytan i dess loading-state (§§1, 5–8, 10, 17–18, 20–21) på platsen där slutinnehållet kommer stå. Aldrig fristående.

### Variantmatris (kanonisk, sluten)

| Variant | Ersätter | Form |
|---|---|---|
| `identity` | TenantIdentityCard (§5) | 48-platta + två textrader. |
| `hero` | NextBookingCard (§6) | Kortskal med rubrikrad + två rader + knapprad. |
| `row` | Listrad (§7/§8/§20/§21) | En rad i radens slutmått; `count` styr antal (2 för §7/§20/§21, 3 för §8). |
| `detail` | BookingDetail block 2–7 (§10) | Chip-rad + h1-rad + fyra textblock. |
| `profil` | Uppgiftskortet (§17–18) | Namnrad + kontaktkortets label + rad. |

Andra varianter kräver ny rad här. Varje form SKA matcha slutlayoutens mått (höjd, radius = ersatt elements radius, text-rader 6px radius) så att data-inladdningen sker UTAN layout-shift.

### DOM/ARIA-ordning

1. Wrapper med `aria-hidden="true"` på ALLA visuella skeleton-block.
2. Ett enda visuellt dolt textalternativ per värdyta: **"Laddar innehåll"** (statisk text). INGEN `aria-live`, INGET `role="status"`, inga upprepade annonser per block eller per variant — skärmläsaren får exakt en tyst ledtråd, aldrig live-spam.
3. Block: bg `--surface-2`; shimmer = linjär gradient `--surface-2` → `--surface-3` → `--surface-2`, 1.2s linear infinite.
4. Inga texter, namn, tider eller platshållarord i blocken — ett skeleton som ser ut som data = FAIL.

### Tillåtna kundsynliga props

| Prop | Typ | Effekt |
|---|---|---|
| `variant` | enum enligt matrisen | Väljer form. |
| `count` | heltal (endast `row`) | Antal rader enligt värdkontraktet. |

### States

- Endast default. Skelettet visas ENDAST medan hämtning faktiskt pågår och ersätts omedelbart av default/empty/error när svaret kommit — ingen artificiell minimitid, ingen skeleton ovanpå fel.

### CTA/keyboard/fokus

- Ingenting i skelettet är fokusbart eller interaktivt. Fokus hanteras av värdytan/shellen (§1) — skelettet stjäl aldrig fokus.

### Responsivt

- Formerna följer värdytans mått per breakpoint (samma containers, §0.3). Desktop: i `--col-main`.

### Motion/reduced motion

- Shimmer stängs HELT av vid `prefers-reduced-motion` → statiskt `--surface-2`-block (TOKENS §12.5). Ingen annan animation förekommer.

### Tokens

`--surface-2/-3`, `--radius-card/-field/-pill`, `--space-2/-3/-4`, `--motion-*` (endast shimmer-undantaget enligt §12.5; shimmer-tiden 1.2s är tokenlagens egen och räknas inte mot 120–200ms-spannet).

### Briefreferens

Loading-principen i portalbriefen: skeleton är slutlayoutens exakta mått utan fejkdata, `aria-hidden` med ett enda statiskt textalternativ och noll live-region-spam; shimmer försvinner helt vid reduced motion.

---

**Omfattning del 6:** Samlingsregister, komplettlista, v1-förbudslista, kanonregel, slutmarkör.

---

## 28. Samlingsregister — komponent → route/host → åtgärd → states → brief

Kompakt kanonisk tabell över HELA sviten. "Ren navigation" = ingen server action utlöses av komponenten själv; "läsning" = data ur sessionens datakontext (hämtning ägs av värdytan/servern).

| # | Komponent | Route/host | Server action/API eller ren navigation | Obligatoriska states | Briefavsnitt |
|---|---|---|---|---|---|
| 1 | CustomerPortalShell | Portalhost: alla `/mina*` + `/aterhamta/[tenantSlug]` | Ren layout/navigation; session-vakt → recovery-redirect | default, loading, session-expired, error | Portalbrief (shell/ram) |
| 2 | CustomerPortalTopbar | Portalhost: alla routes (inkl. recovery) | Ren navigation (`/mina`, `/mina/profil`, Tillbaka); logout via §22 | default, loading, detail, error/session-expired | Portalbrief (säkerhetsram) |
| 3 | CustomerPortalNavigation | Portalhost: alla utom `variant="recovery"` | Ren navigation (3 fasta poster) | default, hover, aktiv (mobil/desktop), loading | Portalbrief (navigation) |
| 4 | PrototypeFixtureControl | Alla prototypsidor (ALDRIG produkt) | Ingen server; klientstyrt fixturbyte | hopfälld, utfälld, fixturbyte-pågår | Prototypbrief (fixturer) |
| 5 | TenantIdentityCard | `/mina` (+ `/mina/historik`) | Läsning (tenant-kontext); tel-/kartlänk | default, loading, error | Identitetsbrief ("identiteten i innehållet") |
| 6 | NextBookingCard | `/mina` | Läsning + retry-API vid fel; CTA:er = navigation | default, empty, loading, error, session-expired | Portalbrief (hero "nästa bokning") |
| 7 | UpcomingBookingList | `/mina` | Läsning + retry-API; rader = navigation till detalj | default, empty (renderas ej), loading, error | Portalbrief (kommande lista) |
| 8 | BookingHistoryList | `/mina/historik` | Läsning + "Visa fler"-API (paginering 20) | default, empty, loading, error | Portalbrief (ärlig historik) |
| 9 | BookingStatusChip | Inbäddad (§6/§7/§8/§10) | Ingen (ren presentation, muterar aldrig status) | endast default (sluten statusmatris) | Portalbrief (statusspråk §2.5) |
| 10 | BookingDetail | `/mina/bokningar/[id]` | Läsning; Avboka delegeras till §11 | default, loading, error (hämtning), error (neutral 404), session-expired | BookingDetail-brief |
| 11 | CancelBookingDialog | Overlay på `/mina/bokningar/[id]` | Avboknings-action (idempotent) | öppen, pending, success, failure, policy-changed, already-cancelled | BookingDetail-brief (avbokning) |
| 12 | CalendarDownloadButton | Portalhost (§10) + tenanthost (§15) | Server-genererad `.ics`, ägarskapskontrollerad | default, pending, success, failure (inkl. neutral ownership) | BookingDetail-/steg 5-brief (kalender) |
| 13 | BookAgainButton | §6, §10, §15 | Ren navigation → tenantens `publicRebookUrl` | default; saknad URL = renderas ej | Boka igen-briefen |
| 14 | PinVerificationForm | Tenanthost steg 4/5; `/verifiera/[tenantSlug]` | PIN-verify + resend-API | 11 states: sending, sent_sms, sent_email, invalid, cooldown, resend, expired, max_attempts, delivery_failed, slot_lost, verified | Lösenordsfria kärnkontraktet (PIN) |
| 15 | BookingStepFive | Tenanthost steg 5/5 | Bokningspersistens-uppslag + rate-limitad resend-action | gateway_persisted, submitted, delivered, delivery_failed, unknown, "Ingen bokning skapades" | Steg 5-briefen (persistens ≠ leverans) |
| 16 | RecoveryForm | `/aterhamta/[tenantSlug]` (portalhost, recovery-shell) | Kodutskicks-action (enumeration-neutral, servern väljer kanal) | default, valideringsfel, pending, success (neutral), failure, cooldown, max_attempts | Recovery-briefen |
| 17 | CustomerProfileCard | `/mina/profil` | Spara namn-action; meny = navigation; Logga ut via §22 | default, edit, loading, error, session-expired (+ pending/success/failure) | Profilbriefen |
| 18 | VerifiedContactCard | Inuti §17 (endast där) | Läsning (serverstyrd union); byt-CTA → §19 | default, loading, change-pending (error ärvs av §17) | Kontaktbriefen |
| 19 | ContactChangeFlow | Overlay på `/mina/profil` | Step-up-API (2 challenges) + atomär byt/återkalla-action | steg 1–5, kodstates ur §14, 10-min-expiry, avbrutet | Kontaktbytesbriefen |
| 20 | PortalSessionList | `/mina/sakerhet` | Läsning; utloggnings-actions delegeras till §22 | default, loading, error, session-expired (empty finns ej) | Säkerhetsbriefen (Inloggade enheter) |
| 21 | BookingTrustList | `/mina/sakerhet` | Läsning; trust-återkallelse delegeras till §22 | default, empty, loading, error | Trust-briefen (PIN-fria bokningsenheter) |
| 22 | DestructiveActionDialog | Overlay `/mina/sakerhet` + `/mina/profil` | Logout-/revoke-actions (idempotenta) enligt variantmatris | öppen, pending, success (inkl. logout-current-yta), failure | Säkerhetsbriefen (destruktiva åtgärder) |
| 23 | InstallPromptCard | `/mina` (auto) + `/mina/installera` (page) | Ingen server: `beforeinstallprompt`/urklipp; persisterad räknare | unsupported, standalone, eligible, prompted_once, dismissed_once, prompted_twice, dismissed_twice, accepted | PWA-briefen (erbjudande-maskinen) |
| 24 | IosInstallGuide | Sheet från §23; inline på `/mina/installera` | Ingen (statisk guide) | endast default | PWA-briefen (iOS-spåret) |
| 25 | PortalEmptyState | Inuti värdytor (§6/§8/§21) | Ingen; ev. CTA = §13 | endast default (3 slutna varianter) | Tomläges-principen |
| 26 | PortalErrorState | Inuti värdytor eller hela `<main>` | Retry-API via värdytan | fetch, not-found, offline, server (+ retry pending/success/failure); session-expired = redirect | Felprinciperna |
| 27 | PortalSkeleton | Inuti värdytor (loading) | Ingen | endast default (5 slutna varianter) | Loading-principen |
| 28 | PortalBootstrap | Portalhost, sessionsuppstart före shell-rendering | Sessionsvalidering mot servern; ogiltig/utgången → `/aterhamta/[tenantSlug]` | validating (neutral topbar + skeleton §1 loading), valid → shell, invalid → recovery-redirect | Portalbrief (sessionsmodellen); per briefbeslut, renderar aldrig egen kund-UI |

---

## 29. Komplettlista — alla komponenter bekräftade

22 ursprungliga komponenter plus de sex flödes-/verktygskomponenterna. Varje bock = komponenten har fullständigt kontrakt (syfte, route, DOM/ARIA, props, states, CTA/fokus, responsivt, tokens) i detta dokument, utom PortalBootstrap som är kontrakterad via §28 + briefbeslut.

**22 ursprungliga:**

- [x] 1. CustomerPortalShell (§1)
- [x] 2. CustomerPortalTopbar (§2)
- [x] 3. CustomerPortalNavigation (§3)
- [x] 4. TenantIdentityCard (§5)
- [x] 5. NextBookingCard (§6)
- [x] 6. UpcomingBookingList (§7)
- [x] 7. BookingHistoryList (§8)
- [x] 8. BookingStatusChip (§9)
- [x] 9. BookingDetail (§10)
- [x] 10. CancelBookingDialog (§11)
- [x] 11. CalendarDownloadButton (§12)
- [x] 12. BookAgainButton (§13)
- [x] 13. CustomerProfileCard (§17)
- [x] 14. VerifiedContactCard (§18)
- [x] 15. ContactChangeFlow (§19)
- [x] 16. PortalSessionList (§20)
- [x] 17. BookingTrustList (§21)
- [x] 18. InstallPromptCard (§23)
- [x] 19. IosInstallGuide (§24)
- [x] 20. PortalEmptyState (§25)
- [x] 21. PortalErrorState (§26)
- [x] 22. PortalSkeleton (§27)

**Plus sex:**

- [x] PortalBootstrap (§28, rad 28 — kontrakt per briefbeslut)
- [x] RecoveryForm (§16)
- [x] PinVerificationForm (§14)
- [x] BookingStepFive (§15)
- [x] DestructiveActionDialog (§22)
- [x] PrototypeFixtureControl (§4)

Summa: 28 komponenter. Ingen komponent utanför denna lista får existera i v1-leveransen; ny komponent kräver briefbeslut (§30).

---

## 30. Förbjudna/dolda funktioner i v1 (bindande)

Följande får INTE förekomma i någon komponent, route, navpost, CTA, copy eller manifest. Förekomst = FAIL (§0.1).

| Funktion | Status i v1 | Innebörd |
|---|---|---|
| Vanlig login/signup/password/social | FÖRBJUDEN | Ingen login-vy, inget lösenordsfält, ingen "skapa konto", ingen social inloggning. Enda vägen in utan session = `/aterhamta/[tenantSlug]` (§16). |
| "Mina företag" / global hub | FÖRBJUDEN | En session = exakt EN tenant. Ingen tenantväxlare, ingen företagslista, ingen cross-tenant-vy. |
| Push-notiser | FÖRBJUDEN | Ingen notis-permission-prompt, ingen notisikon, inga notisinställningar. |
| Erbjudanden | FÖRBJUDEN | Inga kampanjkort, banners eller erbjudande-CTA:er i portalen. |
| Lojalitet/klippkort | FÖRBJUDEN | Inga poäng, stämplar, klippkort eller nivåer. |
| Webshop | FÖRBJUDEN | Inga produkter, varukorg eller köp i portalen. |
| Ombokning i portal | FÖRBJUDEN | Portalen bokar/ombokar ALDRIG själv — endast Avboka (§11) + utlänk till tenantens publika flöde (§13). |
| Native app | FÖRBJUDEN | Ingen App Store-/Play-länk, ingen "ladda ned appen"-copy. PWA-installation (§23) är enda install-vägen. |

Dessa är inte "dolda bakom flagga" — de existerar inte i v1:s komponenter, props eller routes över huvud taget.

---

## 31. Kanonregel (bindande prioritetsordning)

1. **Designspec (briefen) > TOKENS.md > COMPONENTS.md.** Vid konflikt vinner det högre dokumentet; COMPONENTS.md får aldrig utöka eller mildra brief eller tokenlag.
2. **Inga ungefärliga värden.** Varje mått, färg, tid och text hämtas exakt ur TOKENS.md respektive detta dokuments slutna matriser. "Ungefär 44px", "någon mörk yta", omskriven copy = FAIL.
3. **Inga nya routes, props eller states utan briefbeslut.** Route-listan (§28), props-listorna ("sluten lista", §0.2) och state-matriserna är slutna. Tillägg kräver ett dokumenterat briefbeslut FÖRST — därefter uppdateras TOKENS/COMPONENTS, aldrig tvärtom.

---

*KOMPLETT — 6 av 6*
