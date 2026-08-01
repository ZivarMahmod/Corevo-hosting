# TOKENS.md — Bindande tokenlag

**Produkt:** Kundportal, lösenordsfri PWA v1 (Corevo)
**Status:** BINDANDE. Varje värde i detta dokument är lag. Avvikelse = FAIL i acceptans.
**Tema:** Corevo dark (enda temat i v1).
**Nivå:** WCAG 2.2 AA är golv, inte mål.

Regler för läsning:

- **SKA** = obligatoriskt. **FÅR INTE** = förbjudet. Inga "bör".
- Alla värden konsumeras via CSS custom properties i §1. Hårdkodade hex/px som redan finns som token = FAIL.
- Inget i detta dokument får överridas per komponent utan att det uttryckligen står här.

---

## 1. CSS custom properties (kanonisk källa)

Hela blocket SKA ligga i `:root` i global CSS. Komponenter SKA referera `var(--…)`, aldrig råvärden.

```css
:root {
  /* ---- Färg: ytor ---- */
  --bg:        #121210; /* app-bakgrund */
  --surface-1: #1C1C18; /* kort, listrader, paneler */
  --surface-2: #25251F; /* upphöjd yta: sheets, dropdowns, input-bg */
  --surface-3: #2E2E28; /* högsta yta: dialoger, aktiva/hover-ytor */

  /* ---- Färg: text ---- */
  --ink-1: #F0F0EA; /* primär text, rubriker */
  --ink-2: #C8C8BD; /* sekundär text, brödtext på ytor */
  --ink-3: #96968C; /* metadata/tertiär — se AA-regel §2.3 */

  /* ---- Färg: linjer ---- */
  --line-1: #33332C; /* standardavgränsare, kortkanter */
  --line-2: #4A4A41; /* starkare kant: inputs, hover-kanter */

  /* ---- Färg: action ---- */
  --action:       #2F5F47; /* primär knapp-bg, aktiva val */
  --action-hover: #3A7357; /* hover/active på primär */
  --action-text:  #E9F2EC; /* text/ikon PÅ action-ytor */

  /* ---- Färg: status ---- */
  --positive: #9AC4A5; /* bekräftat, lyckat */
  --warning:  #D6AC6A; /* väntar, uppmärksamma */
  --negative: #D68F85; /* fel, avbokat, destruktivt */

  /* ---- Fokus ---- */
  --focus-ring:        #9AC4A5;
  --focus-ring-width:  2px;
  --focus-ring-offset: 3px;

  /* ---- Typografi ---- */
  --font-ui:   "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --text-h1-size: 28px; --text-h1-line: 32px; --text-h1-weight: 700; /* mobil; desktop se §3.2 */
  --text-h1-size-desktop: 36px; --text-h1-line-desktop: 40px;
  --text-h2-size: 22px; --text-h2-line: 28px; --text-h2-weight: 700;
  --text-h3-size: 18px; --text-h3-line: 24px; --text-h3-weight: 650;
  --text-body-size: 16px;    --text-body-line: 24px;    --text-body-weight: 400;
  --text-compact-size: 15px; --text-compact-line: 22px; --text-compact-weight: 400;
  --text-meta-size: 12px;    --text-meta-line: 18px;    --text-meta-weight: 400;

  /* ---- Spacing (bas 4) ---- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ---- Radius ---- */
  --radius-field:  10px; /* inputs, selects, små kontroller */
  --radius-card:   16px; /* kort, listpaneler */
  --radius-dialog: 18px; /* dialoger, sheets (ovansida) */
  --radius-pill:   999px; /* chips, badges, pill-knappar */

  /* ---- Border ---- */
  --border-width: 1px;

  /* ---- Skuggor ---- */
  --shadow-card:       0 1px 0 rgba(255, 255, 255, .03);
  --shadow-dialog:     0 24px 64px rgba(0, 0, 0, .48);
  --shadow-bottom-nav: 0 -8px 30px rgba(0, 0, 0, .24);

  /* ---- Mått: kontroller ---- */
  --tap-min: 44px;          /* minsta träffyta alla kontroller */
  --button-primary-h: 48px; /* minsta höjd primär knapp */

  /* ---- Motion ---- */
  --motion-duration: 160ms; /* standard; tillåtet spann 120–200ms */
  --motion-ease: ease;

  /* ---- Barer ---- */
  --topbar-h-mobile: 60px;
  --topbar-h-desktop: 56px;
  --bottomnav-h: calc(60px + env(safe-area-inset-bottom));

  /* ---- Layout ---- */
  --gutter-mobile: 16px;        /* 20px från 390px, se §8.3 */
  --container-tablet: 760px;
  --container-desktop: 1248px;
  --col-left: 232px;
  --col-main: 680px;
  --col-right: 288px;
  --layout-gap: 24px;

  /* ---- Z-index ---- */
  --z-content: 0;
  --z-sticky: 20;
  --z-nav: 40;
  --z-scrim: 80;
  --z-sheet: 90;   /* även dialog */
  --z-toast: 100;

  /* ---- Ikoner & logo ---- */
  --icon-sm: 16px;
  --icon-md: 20px;
  --icon-lg: 24px;
  --logo-max: 48px; /* max 48×48 */
}
```

---

## 2. Färg — användningsregler

### 2.1 Ytor

| Token | Användning |
|---|---|
| `--bg` | Enda tillåtna app-bakgrund. |
| `--surface-1` | Kort, listrader, sektionspaneler direkt på `--bg`. |
| `--surface-2` | Sheets, dropdowns, input-bakgrund, rader-i-kort. |
| `--surface-3` | Dialoger, hover-/aktiv-yta på `--surface-2`, segmenterade kontrollers aktiva del. |

Ytor SKA staplas i ordning bg → 1 → 2 → 3; att hoppa nivå (t.ex. `--surface-3` direkt på `--bg`) FÅR INTE ske utom för dialog/sheet som ligger över scrim.

### 2.2 Linjer

- `--line-1`: standardavgränsare (kortkant, listseparator, sektionsgräns).
- `--line-2`: kanter som ska synas mot `--surface-2` (inputkant, hover-kant, tabellhuvud).
- All border SKA vara `var(--border-width) solid` (1px). Tjockare border FÅR INTE användas för dekor; enda undantag är fokusring (§6).

### 2.3 Text och AA-regel för ink-3

- `--ink-1`: rubriker, primär text, belopp, namn.
- `--ink-2`: brödtext, sekundär info, inaktiva flikars text.
- `--ink-3`: **endast** när AA (kontrast ≥ 4.5:1 mot faktisk bakgrund, ≥ 3:1 för text ≥ 24px/700) hålls på den yta den står på. `--ink-3` på `--surface-3` eller ljusare ytor SKA kontrastmätas före användning; klarar den inte AA SKA `--ink-2` användas i stället. `--ink-3` FÅR INTE användas för länkar, felmeddelanden, belopp eller något användaren måste läsa för att slutföra ett flöde.

### 2.4 Action

- `--action` = bakgrund för primär knapp och markerat/valt tillstånd (t.ex. vald tid-slot).
- `--action-hover` = hover **och** active på action-ytor.
- `--action-text` = enda tillåtna text-/ikonfärg på action-bakgrund.
- `--action` FÅR INTE användas som textfärg på mörka ytor (för låg kontrast). Länkar i löptext SKA använda `--positive` med understrykning, inte `--action`.

### 2.5 Status

- `--positive` / `--warning` / `--negative` används för statustext, statusikoner och badge-kanter.
- **Status FÅR ALDRIG kommuniceras med enbart färg.** Varje statusindikering SKA ha minst en av: text-label, ikon med distinkt form, eller mönster. En prick utan text = FAIL.
- Statusfärg som bakgrundsplatta: SKA då renderas som färgen på 12–16 % opacitet (`color-mix(in srgb, var(--negative) 14%, transparent)` eller motsvarande förberäknat värde) med statusfärgen som text/kant — aldrig fullmättad platta med mörk text.

---

## 3. Typografi

### 3.1 Familjer

- **UI-text:** Instrument Sans, **self-hosted** (`@font-face` mot lokala woff2-filer i repot).
- **Labels, tider, klockslag, bokningsnummer, status-badges, PIN-kod:** IBM Plex Mono, **self-hosted**.
- Extern fontimport (Google Fonts, CDN, `@import url(...)`) är **FÖRBJUDEN**. Fontfiler SKA ligga i projektet och laddas med `font-display: swap`.
- Lokal prototypfallback: `ui-sans-serif`/`system-ui` respektive `ui-monospace` — redan inbakat i `--font-ui`/`--font-mono`. Prototyp utan fontfiler SKA rendera på fallback utan layoutkollaps.

### 3.2 Skala

| Roll | Mobil (0–767) | Desktop (≥1024) | Vikt | Font |
|---|---|---|---|---|
| h1 | 28/32 | 36/40 | 700 | UI |
| h2 | 22/28 | 22/28 | 700 | UI |
| h3 | 18/24 | 18/24 | 650 | UI |
| Body | 16/24 | 16/24 | 400 | UI |
| Compact body | 15/22 | 15/22 | 400 | UI |
| Metadata | 12/18 | 12/18 | 400 | UI eller Mono |

- Tablet (768–1023) använder mobilens h1.
- **Ingen viktig text under 12px.** 12px är absolut golv; under 12px är endast dekorativ/redundant text tillåten (och ska då även finnas läsbart på annan plats).
- Mono-text (tider, status) SKA använda `--font-mono` i samma storlekssteg som omgivande text, aldrig egen skala.
- Radlängd i löptext SKA hållas ≤ ~70 tecken (styrs av containers i §8).

---

## 4. Spacing

- Bas 4. Enda tillåtna steg: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64** (tokens `--space-1` … `--space-16`).
- Godtyckliga värden (10px, 14px, 18px, 25px …) = FAIL, även i "temporär" kod.
- Defaults:
  - Kort-padding: `--space-4` (16) mobil, `--space-5` (20) ≥768.
  - Vertikalt avstånd mellan kort/sektioner: `--space-3` (12) inom grupp, `--space-6` (24) mellan grupper.
  - Label → fält: `--space-2` (8). Fält → nästa fält: `--space-4` (16).
  - Sidans topp-padding under topbar: `--space-4` mobil, `--space-6` desktop.

---

## 5. Radius, border, skuggor

| Element | Radius | Border | Skugga |
|---|---|---|---|
| Input/select/små kontroller | `--radius-field` (10) | 1px `--line-2` | ingen |
| Kort/paneler/listcontainrar | `--radius-card` (16) | 1px `--line-1` | `--shadow-card` |
| Dialog | `--radius-dialog` (18) | 1px `--line-2` | `--shadow-dialog` |
| Bottom-sheet | `--radius-dialog` (18) endast ovankant | 1px `--line-2` ovankant | `--shadow-dialog` |
| Chips/badges/pills | `--radius-pill` (999) | 1px (kontext) | ingen |
| Bottom-nav | 0 | 1px `--line-1` ovankant | `--shadow-bottom-nav` |

- Skuggor utöver de tre definierade FÅR INTE införas. Skugga ersätter aldrig border — element SKA ha sin kant även med skugga.
- **Ingen glassmorphism:** `backdrop-filter`, blur-på-yta, halvtransparenta "frostade" paneler är förbjudna. Scrim (§11) är enda tillåtna transparenta ytan.

---

## 6. Interaktiva tillstånd

### 6.1 Träffytor

- Varje interaktiv kontroll SKA ha träffyta ≥ **44×44px** (`--tap-min`), oavsett visuell storlek (padding/pseudo-element får utöka).
- Primär knapp SKA vara ≥ **48px** hög (`--button-primary-h`), full bredd på mobil i formulärflöden.

### 6.2 Fokus

- Synligt fokus SKA renderas som `outline: 2px solid var(--focus-ring); outline-offset: 3px;` (tokens `--focus-ring-*`).
- Gäller **alla** fokusbara element, via `:focus-visible`. `outline: none` utan ersättning = FAIL.
- Fokusring FÅR INTE klippas av `overflow: hidden` — containrar kring fokusbara element SKA lämna ≥ 5px utrymme eller använda `overflow: visible`/padding.

### 6.3 Tillståndstabell (defaults)

| Komponent | Default | Hover | Active | Disabled | Fokus |
|---|---|---|---|---|---|
| **Primär knapp** | bg `--action`, text `--action-text`, radius `--radius-field`, höjd ≥48 | bg `--action-hover` | bg `--action-hover` + `transform: translateY(1px)` | opacity .45, `cursor: not-allowed`, ingen hover | ring §6.2 |
| **Sekundär knapp** | bg transparent, text `--ink-1`, border 1px `--line-2`, höjd ≥44 | bg `--surface-2` | bg `--surface-3` | opacity .45 | ring |
| **Ghost/textknapp** | text `--ink-2`, ingen bg/border | text `--ink-1`, bg `--surface-2` | bg `--surface-3` | opacity .45 | ring |
| **Destruktiv knapp** | som sekundär men text+border `--negative` | bg `color-mix(in srgb, var(--negative) 12%, transparent)` | 16 % mix | opacity .45 | ring |
| **Input/select** | bg `--surface-2`, text `--ink-1`, placeholder `--ink-3` (AA-mätt), border 1px `--line-2`, radius 10, höjd ≥44, padding 12px 16px | border `--line-2` (oförändrad) | — | bg `--surface-1`, text `--ink-3`, opacity 1 | border `--focus-ring` **plus** ring |
| **Input fel** | border 1px `--negative` + felrad `--negative` 12/18 med ikon under fältet | — | — | — | ring behålls |
| **Listrad/länkkort** | bg `--surface-1` | bg `--surface-2` | bg `--surface-3` | — | ring |
| **Nav-post (bottennav/vänsternav)** | text/ikon `--ink-2` | text `--ink-1` | — | — | ring |
| **Nav-post aktiv** | text/ikon `--action-text`-nivå: mobil = ikon+label `--positive`; desktop = bg `--surface-2`, text `--ink-1`, 2px vänsterkant `--action` | — | — | — | ring |
| **Chip/val (t.ex. tid-slot)** | bg `--surface-2`, border 1px `--line-2`, radius pill, höjd ≥44 | border `--focus-ring` | — | opacity .45 | ring |
| **Chip vald** | bg `--action`, text `--action-text`, border 1px `--action` | bg `--action-hover` | — | — | ring |

- Hover-stilar SKA gate:as bakom `@media (hover: hover)` så touch inte fastnar i hover-läge.
- Disabled-element SKA behålla sin text i DOM (ingen tömning) och ha `aria-disabled` eller `disabled`.

---

## 7. Motion

- Standard: `--motion-duration` **160ms**, easing `ease`. Tillåtet spann **120–200ms**; utanför spannet = FAIL.
- Tillåtna animerade egenskaper: `opacity`, `transform`, `background-color`, `border-color`. Layoutegenskaper (`height`, `width`, `top` …) FÅR INTE animeras utom sheets höjd via `transform`.
- Sheet/dialog: in = `translateY` + fade 160–200ms; ut = 120–160ms.
- **Reduced motion:**

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
  /* Inga translations: element visas/döljs med opacity/direkt, aldrig med förflyttning. */
}
```

Vid reduced motion SKA alla durations vara 0ms och inga `translate`-baserade entréer/exits förekomma. Skeleton-shimmer stängs av (§12.5).

---

## 8. Breakpoints, containers, layout

### 8.1 Breakpoints

| Namn | Spann | Navigation |
|---|---|---|
| Mobile | 0–767px | Bottennav 60px + safe-area |
| Tablet | 768–1023px | **Bottennav** (samma som mobil) |
| Desktop | ≥1024px | Vänsternav 232px, ingen bottennav |

### 8.2 Acceptansviewports

Bygget SKA verifieras felfritt (ingen horisontell scroll, inga klippta kontroller, fokus synligt) i exakt: **320×568, 390×844, 430×932, 768×1024, 1024×768, 1440×900**.

### 8.3 Containers

- **Mobile:** full bredd, gutters **16px**; från **≥390px** gutters **20px**.
- **Tablet:** innehåll max **760px**, centrerat, gutters 20px.
- **Desktop:** total max **1248px**, centrerad: **232 + 680 + 288 + 2 × 24**. Tre kolumner: vänsternav **232px**, huvud **680px**, höger **288px**, gap **24px** (`--layout-gap`).
- **1024–1247px:** höger kolumn FÅR INTE klämmas — den faller ned **under huvudkolumnen** (i huvudkolumnens bredd). Vänsternav behålls.

### 8.4 Barer

- Topbar mobil/tablet: **60px** hög, sticky topp, bg `--bg` eller `--surface-1`, 1px `--line-1` underkant.
- Topbar desktop: **56px**.
- Bottennav: **60px + `env(safe-area-inset-bottom)`** (padding-bottom = safe-area), bg `--surface-1`, `--shadow-bottom-nav`, 1px `--line-1` ovankant.
- Innehåll SKA få `padding-bottom` ≥ bottennavens totalhöjd + `--space-4` så inget döljs bakom navet.

---

## 9. Z-index

Enda tillåtna nivåer (tokens i §1):

| Lager | Värde |
|---|---|
| Innehåll | 0 |
| Sticky (topbar, sektionshuvuden) | 20 |
| Navigation (bottennav, vänsternav) | 40 |
| Scrim | 80 |
| Sheet/Dialog | 90 |
| Toast | 100 |

Godtyckliga z-index (999, 9999 …) = FAIL. Nya lager kräver ändring av denna lag.

---

## 10. Safe area, scroll, tangentbord, zoom

- `viewport-fit=cover` + `env(safe-area-inset-*)` SKA respekteras i topbar, bottennav och sheets.
- **Ingen horisontell scroll** på någon acceptansviewport. `html, body { overflow-x: hidden }` är tillåtet som skyddsnät men FÅR INTE dölja verkliga overflow-buggar — brett innehåll ska fixas i källan.
- Sheets med tangentbord synligt: `max-height: calc(100dvh - 16px)`, internt scrollbart innehåll, fokuserat fält SKA vara synligt (scroll-into-view).
- **200 % zoom** (desktop) SKA fungera utan förlorad funktionalitet eller klippt innehåll (WCAG 1.4.4/1.4.10). Text-input SKA vara ≥16px på mobil så iOS inte auto-zoomar.

---

## 11. Scrim, dialog, sheet, toast — defaults

- **Scrim:** `rgba(0, 0, 0, .56)`, z 80, klick stänger (utom i destruktiva bekräftelser), fade 160ms.
- **Dialog (≥768):** bg `--surface-3`, radius 18, `--shadow-dialog`, max-bredd 440px, padding `--space-6`, z 90. Fokus fångas i dialogen; `Esc` stänger; fokus återlämnas till utlösaren.
- **Bottom-sheet (mobil):** bg `--surface-2`, radius 18 ovankant, drag-handtag 32×4px `--line-2` radius pill centrerat med 8px marginal, padding `--space-4` + safe-area i botten, z 90. Samma fokusregler som dialog.
- **Toast:** bg `--surface-3`, text `--ink-1`, radius `--radius-field`, 1px `--line-2`, padding 12px 16px, ikon 20px i statusfärg + statustext (aldrig endast färg), z 100, placeras ovanför bottennav (mobil) / nedre högra hörnet (desktop), auto-dismiss ≥ 5s, pausar på hover/fokus.

---

## 12. Övriga component defaults

### 12.1 Ikoner

- Storlekar: **16 / 20 / 24px** (`--icon-sm/md/lg`). Inga andra storlekar.
- 16 = inline i metadata-text; 20 = i knappar, inputs, toasts; 24 = navigation, tomma lägen.
- Stroke-stil enligt husets ikonspråk; färg = omgivande textfärg (`currentColor`).

### 12.2 Logotyp

- Max **48×48px** i UI. Placeras i topbar/loginyta; FÅR INTE skalas upp över 48.

### 12.3 Badges/status-chips

- Höjd 24px, padding 4px 12px, radius pill, `--font-mono` 12/18, ikon 16 + text. Färg enligt §2.5 (mix-bakgrund + statusfärg som text/kant).

### 12.4 Länkar

- Löptextlänk: `--positive`, `text-decoration: underline`, `text-underline-offset: 2px`. Hover: `--ink-1` med bibehållen underline.

### 12.5 Skeleton (laddningstillstånd)

- Bas: bg `--surface-2`, radius = ersatt elements radius (text: 6px), höjd = ersatt radhöjd.
- Shimmer: linjär gradient `--surface-2` → `--surface-3` → `--surface-2`, animation 1.2s linear infinite — **stängs helt av vid `prefers-reduced-motion`** (statisk `--surface-2`).
- Skeleton SKA matcha slutlayoutens mått (ingen layout-shift vid data-inladdning) och ha `aria-hidden="true"` + textalternativ ("Laddar …") för skärmläsare.

### 12.6 Scrollbars

- Interna scrollytor (sheets, listor):

```css
.scroll-area { scrollbar-width: thin; scrollbar-color: var(--line-2) transparent; }
.scroll-area::-webkit-scrollbar { width: 8px; }
.scroll-area::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: var(--radius-pill); }
.scroll-area::-webkit-scrollbar-track { background: transparent; }
```

- Dokument-scroll får behålla plattformens standard. Scroll FÅR INTE döljas helt på ytor där innehåll kan overflowa utan annan indikation.

### 12.7 Avgränsare

- `<hr>`/separatorer: 1px `--line-1`, marginal `--space-4` vertikalt, ingen skugga.

---

## 13. Tillgänglighet (bindande golv)

1. **WCAG 2.2 AA** i sin helhet.
2. Kontrast: normaltext ≥ 4.5:1, stor text (≥24px eller ≥18.5px/700) ≥ 3:1, UI-komponentkanter och ikoner ≥ 3:1 mot intilliggande färg.
3. **Status aldrig endast färg** (§2.5).
4. Fokus alltid synligt (§6.2); fokusordning följer visuell ordning.
5. `forced-colors: active` SKA respekteras: inga borttagna outlines, borders behålls (systemfärger tillåts ta över), ingen information som bara bärs av bakgrundsfärg. Testas i Windows High Contrast.
6. `prefers-contrast: more` SKA höja: border `--line-2` → `--ink-3`-nivå på kontroller och text `--ink-2` → `--ink-1` där det är läskritiskt.
7. `prefers-reduced-motion` enligt §7.
8. 200 % zoom + 320px-viewport utan innehållsförlust (§10).
9. Träffytor ≥ 44×44 (§6.1) — uppfyller även WCAG 2.5.8 med marginal.
10. Språk: `lang="sv"` på dokumentet; tider och datum i mono men uppläsbara (ingen ASCII-konst för tid).

---

## 14. Förbudslista (sammanfattning)

- ❌ Glassmorphism / `backdrop-filter` / frostade ytor.
- ❌ Extern fontimport (CDN/Google Fonts). Endast self-hosted + systemfallback.
- ❌ Viktig text under 12px.
- ❌ Status via enbart färg.
- ❌ Hårdkodade färg-/spacing-/radius-värden som finns som token.
- ❌ Spacing utanför 4-bas-skalan.
- ❌ Z-index utanför §9.
- ❌ Skuggor utanför §5.
- ❌ `outline: none` utan fullvärdig fokusersättning.
- ❌ Horisontell scroll på acceptansviewports.
- ❌ Motion utanför 120–200ms eller som ignorerar reduced motion.
- ❌ Logotyp över 48×48.

---

*Slut på tokenlagen. Ändringar i detta dokument kräver ny version av filen — inga tysta avsteg i kod.*
