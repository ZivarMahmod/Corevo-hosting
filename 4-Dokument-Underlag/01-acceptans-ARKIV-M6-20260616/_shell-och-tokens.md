# Acceptans — Shell, världar & tokens (gäller VARJE back-office-sida)

> Kör detta **före** varje sid-checklista. Misslyckas något här är ingen sida klar.
> Värden = kanon efter playbookens tie-break (`DESIGN-ELEGANS-playbook.md` §0).
> Kända live-drift-punkter är märkta **⚠ DELTA** — det är där tidigare köringar gled.

## A. Världs-kontraktet (existentiellt — regel #1)

| # | Påstående | Förväntat | Enhet |
|---|---|---|---|
| W1 | Back-office-rooten bär `data-world` | `[data-world="backoffice"]` finns på app-rooten | attr |
| W2 | Ingen Corevo-grön/guld läcker till storefront/`/konto` | `/konto`-root = `[data-world="storefront"][data-theme]`, **inte** backoffice | attr |
| W3 | Inga hårdkodade hex i back-office-CSS | grep `#1F4636\|#F5A623\|#FAF8F4` i `components/admin/**` → **0 träffar** (allt via `var(--c-*)`) | count |
| W4 | App-bakgrund | `--c-cream` `#FAF8F4` — **aldrig** rent vitt på `<main>`/body | hex |

## B. Shell — sidebar (`components/portal/...` shell)

| # | Element | Egenskap | Förväntat |
|---|---|---|---|
| S1 | Sidebar | `width` | **244px** ⚠ DELTA (impl har 248 → korrigera) |
| S2 | Sidebar | `background-color` | `rgb(31, 70, 54)` (`--c-forest` #1F4636) |
| S3 | Sidebar | `position` / höjd | `sticky`, `top:0`, `height:100vh` |
| S4 | **Aktiv** nav-item | `background-color` | `rgb(23, 53, 41)` (`--c-forest-700` #173529) |
| S5 | **Aktiv** nav-item | `border-left-width` + färg | `2px` solid `rgb(245, 166, 35)` (`--c-gold`) |
| S6 | **Aktiv** nav-item | `color` / `font-weight` | `#fff` / `600` |
| S7 | Inaktiv nav-item | `color` | `--c-on-forest-2` #9DB1A6, `font-weight 500`, vänster-rail transparent |
| S8 | Nav-item | `padding` / `border-radius` / `gap` | `11px 13px` / `10px` / `12px`, ikon `18` stroke `1.7` |
| S9 | Logo-tile | mått | `34×34`, `radius 9`, bg `--c-gold`, glyf Playfair på `--c-forest-700` |

## C. Shell — topbar

| # | Element | Egenskap | Förväntat |
|---|---|---|---|
| T1 | Topbar | `padding` | `14px 30px` |
| T2 | Topbar | `border-bottom` | `1px solid` `rgb(231, 225, 214)` (`--c-line`) |
| T3 | Topbar | `backdrop-filter` | `blur(8px)`, bg `color-mix(--c-cream 80%, transparent)`, `position:sticky z:20` |
| T4 | Sök | `width` / `border-radius` | `300px` (maxWidth 40vw) / `10px`; focus → border `--c-forest` |
| T5 | "Se din sida"-pill | **endast salon-roll** | `<a>`, Inter `13/600`, `color --c-forest`, paper, `1px --c-line`, `radius 10` |
| T6 | Bell | mått + unread-dot | `38×38 radius 10`; gold-dot `7×7` abs `top:8 right:9` — **prickad, ej fylld** |

## D. Type-roller (T1/T5 i playbooken — största rough-tellen)

| # | Roll/klass | Family (computed) | Size / Weight | Färg |
|---|---|---|---|---|
| Y1 | `.h-display` | **Playfair Display** | 40 / 700, `-.02em`, lh 1.08 | `--c-forest` |
| Y2 | `.h1` (sidtitel) | **Playfair Display** | 28 / 700, lh 1.15 | `--c-forest` |
| Y3 | `.h2` (card-rubrik) | **Inter** | 19 / 600 | `--c-ink` |
| Y4 | `.eyebrow` | **Inter** | 11 / 600, `.18em`, UPPERCASE | `--c-gold-600` #D98E12 |
| Y5 | `.body` | Inter | 14 / 400, lh 1.55, **max-bredd 560** | `--c-ink-2` |
| Y6 | **Alla siffror** (KPI, tid, datum, pris, poäng) | **Playfair Display** + `font-variant-numeric: tabular-nums` | — | — |

> **Y6 är den enskilt största tellen.** Vilket numeriskt värde som helst i Inter = FAIL.

## E. Skala-discipliner

| # | Påstående | Förväntat |
|---|---|---|
| R1 | Radius | controls/inputs/knappar **10** · cards **16** · preview-frame **18** · modal **20** · pills **999** — snäpp **inte** till 8/12 |
| R2 | Card-padding | **22px** ⚠ DELTA (preview-HTML 20 förlorar) |
| R3 | Spacing endast ur | `{4,8,12,16,24,32,48,64}` + medvetna halvsteg `{6,7,9,10,11,14,18,20,22,30}`. Ad-hoc `1.25rem`/`2.5rem` = FAIL |
| R4 | Skuggor | **forest-tonade**: sm `rgba(31,70,54,…)` cards · md preview · lg drawer/toast. Neutralt `rgba(0,0,0,…)` = FAIL |
| R5 | Status-färger | dämpade: success `#4E7A5E`/bg `#E8F0EA`, warning `#A37D3C`/bg `#F3EBD9`, danger `#9E5A57`/bg `#F1E2E0`, info `#5E748C`/bg `#E6EAF0`. Ton bärs av 6px-prick, badge-text = mörk ink |

## F. Responsivt ⚠ DELTA (här gled bygget)

| # | Påstående | Förväntat |
|---|---|---|
| F1 | Brytpunkt | **920px** (impl 760 → korrigera) |
| F2 | Klasser | `bo-stat-grid` (4-up→2-up), `bo-2col`/`bo-brand` (multi→stacked) — **fasta grids**, inte `auto-fill` |

## Hur man kör

Dessa selektorer är generiska — wire dem i `probe.js` mot din faktiska DOM
(lägg gärna `data-accept="S1"` etc. på elementen så blir det deterministiskt),
eller läs av i devtools med `getComputedStyle(el)`. Varje rad ovan = en assertion
i `probe.js`. **0 FAIL innan du går vidare till sid-checklistan.**
