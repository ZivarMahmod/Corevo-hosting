# Corevo Design Elegance Playbook

> **Detta dokument ÄR standarden** för "make-it-match"-workflowet. En byggare följer det för att få implementationen att matcha designens *eleganta ton* — inte bara dess färger. Allt här är destillerat ur fem djupstudier av designkartan (M6-spec, filosofi/tokens, shell+atoms, back-office-sidor, storefront) + den faktiska implementationen (`portal-global.css`, `components/portal/ui/*`, `app/(admin|kund|personal|platform)/*`).

## Källhierarki & tie-break (läs detta först — det avgör alla konflikter)

Studierna och previews råkar ange olika siffror. Lös ALLTID enligt denna ordning:

1. **`colors_and_type.css` = kanon för färg, typografi, spacing, radii, motion, shadow.** Aldrig avvika.
2. **React/CSS-kiten (`Shell.jsx` + sidornas `.jsx`) = kanon för komponentstruktur och mått** (paddings, grid-ratios, drawer-bredd).
3. **Preview-HTML förlorar alltid** vid konflikt (deras `#2E7D5B`, `5px 12px`, pad 20 är off-token/off-kit).
4. **Där live-implementationen avviker från kanon är det en DELTA, inte ny kanon.** Skriv "korrigera mot X". Kända drift-punkter: sidebar `248px` → ska vara **244**; responsiv brytpunkt `760px + auto-fill` → ska vara **920px + fasta grids + `bo-2col/bo-stat-grid/bo-brand`-klasser**.

Kanoniska värden efter tie-break (använd dessa, punkt):

| Beslut | Kanon | Anmärkning |
|---|---|---|
| Sidebar-bredd | **244px** | impl har 248 → korrigera |
| Card padding | **22px** | preview 20 förlorar |
| Badge | **12px / `4px 11px`** | preview 12.5/`5px 12px` förlorar |
| Stat delta-färg (success) | **`--c-success #4E7A5E`** | preview `#2E7D5B` förlorar; impl Stat.tsx redan rätt |
| Responsiv brytpunkt | **920px** | + porta `bo-2col / bo-stat-grid / bo-brand` |
| Komponent-radius | **controls 10 · cards 16 · preview-frame 18 · pills 999** | mellan-rung-värden är avsiktliga |

---

## 1. Design philosophy & two-worlds

Designen optimerar för **återhållsam, redaktionell elegans** (whitespace + typografi gör jobbet) och **white-label-trovärdighet** (varje salong ska se ut som sin egen riktiga svenska salongssajt — aldrig en SaaS-portal). Sju regler styr allt:

1. **TVÅ CSS-VÄRLDAR SOM ALDRIG BLANDAS** (regel #1, existentiell — inte stilval). Varje surface-root bär `data-world`:
   - `[data-world="backoffice"]` → Corevos egen look: **forest `#1F4636` + gold `#F5A623` på cream `#FAF8F4`**, Playfair + Inter. Alla admin/personal/platform-verktyg.
   - `[data-world="storefront"][data-theme="…"]` → **salongens egen** per-tenant-theme. **ALDRIG Corevo forest/gold här.** Kundportalen (`/konto`) och varje live-preview renderas i denna värld.
   - Förbjudet i storefront: alla `--c-forest*`, `--c-gold*`, `--c-cream`, `--c-ink*`, samt back-office-klasserna `.h-display/.h1/.h2/.eyebrow/.body/.small`. Förbjudet i back-office: hårdkodad hex (referera alltid CSS-variabeln). Tokens gör ingenting förrän både `data-world` (och i storefront `data-theme`) sitter på rooten — det finns ingen global `:root`-palett, så läckage är strukturellt omöjligt om kontraktet följs.
2. **Storefront är PRODUKTEN; back-office är verktyget.** Polera storefront högst; back-office ska vara "ren & funktionell". Corevo-varumärket syns aldrig för slutkunden.
3. **Samma språk, olika varumärke.** De fem storefront-temana skiljer sig i palett, typsnitt och radius — aldrig genom att bryta den redaktionella grammatiken. Distinktion kommer från färg/typ/mood, inte från kaos.
4. **Återhållsamhet = lyx.** Whitespace är den primära lyxsignalen. Skuggor subtila. Motion lugn, aldrig studsig. **Gold är accent, aldrig struktur** (forest bär all bärande vikt).
5. **Stängda skalor, disciplinerad tillämpning.** En 8px-spacingskala, en radius-skala, en motion-skala, ett ikonsystem, ett type-roll-set per värld. Avvikelse ÄR den "rough"-signal systemet är byggt att undvika.
6. **Produkten berättar om sig själv.** Callout-band, dirty/published-band, AKTIV/AV-pills, live-preview, maskerad-PII — varje garanti och konsekvens *visas* i UI. Att utelämna dem gör bygget till en CRUD-admin istället för Corevo.
7. **Röd tråd / live-koppling.** En mutation läser/skriver samma state och propagerar överallt + avfyrar en toast som beskriver *konsekvensen* på svenska ("Tid 17:00 frigjord — åter bokningsbar"). Inga döda toggles; sidor menar vad de heter; allt i UI utan deploy.

---

## 2. The token system (exakta värden — referens)

### 2.1 Globala primitiver (`:root` — säkra i BÅDA världar)

```
Spacing (8px-bas + två redaktionella halvsteg):
--space-1:4  -2:8  -3:12  -4:16  -5:24  -6:32  -7:48  -8:64  -9:96  -10:128  -11:160
Radii:  --radius-xs:4  sm:8  md:12  lg:18  xl:28  pill:999
Motion (lugn, aldrig studsig):
--ease-out: cubic-bezier(.22,1,.36,1)   --ease-in-out: cubic-bezier(.65,0,.35,1)
--dur-fast:160ms   --dur-base:280ms   --dur-slow:520ms
Tracking:  --tracking-wide:.18em (eyebrows)   --tracking-tight:-.02em (display)
```
**Komponent-radius (mellan namngivna rungs — snäpp INTE till 8/12/18):** controls/inputs/buttons **10**, cards **16**, preview-frame **18**, pills/avatars/toggles **999**.

### 2.2 World 2 — Back-office `[data-world="backoffice"]`

| var | hex | roll |
|---|---|---|
| `--c-forest` | `#1F4636` | struktur: sidebar, rubriker, primär-knapp |
| `--c-forest-700` | `#173529` | hover / sidebar-djup |
| `--c-forest-300` | `#4E7363` | dämpad forest, avatars, mörka borders, lägre stapel |
| `--c-gold` | `#F5A623` | **accent only**: aktiv nav-rail, KPI-eyebrow/delta, bell-dot, logo-tile, gold-CTA, "Bokad"-badge, idag-tint |
| `--c-gold-600` | `#D98E12` | gold-hover + **eyebrow-textfärg** |
| `--c-gold-100` | `#FBEBCB` | gold-tint-fyllning (callout, "Bokad"-bg) |
| `--c-cream` | `#FAF8F4` | **app-bakgrund** (aldrig vit) |
| `--c-paper` | `#FFFFFF` | cards / paneler |
| `--c-paper-2` | `#F3EFE8` | alt-fyllning, table-stripe, ghost-hover, icon-chip |
| `--c-line` | `#E7E1D6` | hårfin border på cream |
| `--c-line-strong` | `#D8D0C2` | starkare kant |
| `--c-ink` | `#21261F` | primär text |
| `--c-ink-2` | `#555C50` | sekundär / body |
| `--c-ink-3` | `#8A8F82` | dämpad / captions / th |
| `--c-on-forest` | `#EFEAE0` | text på sidebar |
| `--c-on-forest-2` | `#9DB1A6` | dämpad text på sidebar |

**Status (avsiktligt dämpade/dustiga — detta ÄR en elegans-tell):**
```
success #4E7A5E / bg #E8F0EA   warning #A37D3C / bg #F3EBD9
danger  #9E5A57 / bg #F1E2E0   info    #5E748C / bg #E6EAF0
```
**Elevation (forest-tonade skuggor, ALDRIG neutralt svart):**
```
--shadow-sm: 0 1px 2px rgba(31,70,54,.06), 0 1px 3px rgba(31,70,54,.08)   /* cards */
--shadow-md: 0 4px 14px rgba(31,70,54,.08), 0 2px 6px rgba(31,70,54,.06)  /* preview-frame, role-switcher */
--shadow-lg: 0 18px 48px rgba(23,53,41,.16)                                /* drawer, toast */
```
**Typografi:** `--font-display: 'Playfair Display', Georgia, serif` · `--font-ui: 'Inter', system-ui, sans-serif`.

| klass | family | wt | size / lh | färg | bruk |
|---|---|---|---|---|---|
| `.h-display` | Playfair | 700 | 40 / 1.08, `-.02em` | forest | hero-titel |
| `.h1` | Playfair | 700 | 28 / 1.15 | forest | **sidtitel (PageHead)** |
| `.h2` | Inter | 600 | 19 / 1.25 | ink | card-rubrik |
| `.h3` | Inter | 600 | 15 / 1.3 | ink | sub-rubrik |
| `.eyebrow` | Inter | 600 | 11, `.18em`, VERSAL | **gold-600** | label över titel + över varje drawer-sektion |
| `.body` | Inter | 400 | 14 / 1.55 | ink-2 | brödtext (max-bredd 560) |
| `.small` | Inter | 400 | 12.5 / 1.45 | ink-3 | captions |
| `.num` | — | — | — | — | `font-variant-numeric:tabular-nums; "tnum"` — på ALLA siffror/tider |

**Signaturregeln:** KPI-värden, scheman-datum (22), "nästa kund"-tid (34), lojalitetspoäng (28) sätts i **Playfair, aldrig Inter**, med `.num`. Stat-värde = Playfair 38 forest.

### 2.3 World 1 — Storefront `[data-world="storefront"]`

Neutral scaffolding: `--sf-overlay: linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.55))` · `--sf-shadow-soft: 0 10px 30px rgba(0,0,0,.06)` · `--sf-shadow-card: 0 24px 60px rgba(0,0,0,.12)`. Tema-kontraktet (det branding-editorn skriver): `--color-primary, --color-primary-d, --color-bg, --color-surface, --color-fg, --color-fg-2, --color-line, --color-accent-soft, --font-display, --font-body, --sf-radius`.

**De 5 shippade temana** (radius är en identitets-signal, inte brus):

| theme | namn | primary | primary-d | bg | surface | fg | fg-2 | line | accent-soft | display | body | `--sf-radius` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `salvia` | Studio Salvia | `#5E7361` | `#44543F` | `#F6F4EE` | `#FFFFFF` | `#232520` | `#5C5F55` | `#E2DED2` | `#EAEBE3` | Cormorant Garamond | Jost/Inter | **10** |
| `leander` | Maison Leander | `#7E6E92` | `#5A4C6E` | `#FBFAF8` | `#FFFFFF` | `#2A2630` | `#6A6472` | `#ECE7EF` | `#F1ECF3` | Playfair Display | Inter | **14** |
| `zigge` | Zigge | `#C8743C` | `#A65B29` | `#14120E` | `#1E1B16` | `#F2ECE2` | `#B3A998` | `#322C24` | `#241F19` | Bebas Neue/Archivo | Archivo/Inter | **4** |
| `linnea` | Salong Linnea | `#B0693F` | `#8E5230` | `#F4EDE1` | `#FFFFFF` | `#2E2820` | `#6E6452` | `#E3D9C8` | `#ECE3D3` | DM Serif Display | Inter | **12** |
| `edit` | Edit | `#3A3733` | `#1F1D1A` | `#F8F6F1` | `#FFFFFF` | `#232220` | `#6B675F` | `#E5E0D6` | `#EEEAE1` | Cormorant Garamond | Inter | **2** |

`zigge` = enda mörka temat: CTA-text → `#14120E`, `letterSpacing .08em` + VERSAL på alla CTA, foton `grayscale(.15–.2)`, karta inverterad, egen sf-typskala (Bebas: `clamp(60px,8.5vw,116px)`, lh 0.92, wt 400).

**Storefront type-roller** (theme-agnostiska — drar familjer ur aktivt tema): `.sf-eyebrow` body 600 / 12 / `.18em` VERSAL / `--color-primary` · `.sf-hero` display 600 / `clamp(36,4.6vw,62)` / 1.08 · `.sf-h1` display 600 / `clamp(30,4vw,56)` · `.sf-h2` display 600 / `clamp(22,2.4vw,34)` · `.sf-lede` body 400 / `clamp(16,1.4vw,20)` / 1.6 / fg-2 · `.sf-body` body 400 / 16 / 1.7 / fg-2 · `.sf-italic` display **italic 500** (värme-/accentraden).

---

## 3. The elegance tells (hjärtat — do/don't)

Detta är vad som skiljer "elegant" från "rough" i exakt denna design. Varje punkt är en byggregel.

**T1 — Siffror är Playfair, inte Inter.**
- ✅ KPI-värde 38, schema-datum 22, nästa-kund-tid 34, lojalitetspoäng 28 → `font-display` + `.num` (tabular).
- ❌ Sätta något numeriskt värde i UI-sans. Detta är den **enskilt största** rough-tellen.

**T2 — Gold är accent, aldrig struktur.**
- ✅ Gold visas ENDAST som: aktiv nav 2px vänster-rail, KPI-delta-glyf, eyebrow-text, bell-unread-dot, logo-tile, today-kolumn-tint, "ändrad"-pill, 3px card-rail (timeline/vecka/kanban), loyalty-tal, EN `variant="gold"`-CTA per mörkt kort.
- ❌ Gold som panel-fyllning, sid-bakgrund eller bärande element. Forest bär all struktur. (I storefront: motsvarande regel — `--color-primary` är både struktur OCH accent, men aldrig Corevo-gold.)

**T3 — Skuggor är forest-tonade och skiktade.**
- ✅ `rgba(31,70,54,…)`. Cards lyfter knappt (`shadow-sm`); endast overlays (Toast, Drawer) får `shadow-lg`; preview-frame får `shadow-md`. Tre verkliga tiers.
- ❌ Neutralt `rgba(0,0,0,…)` eller en platt default-skugga överallt.

**T4 — Status är dämpad, inte mättad.**
- ✅ `danger #9E5A57`, `success #4E7A5E` på bleka `*-bg`-tints. Badge-text är mörk ink; tonen bärs av en **6px-prick**, inte av textfärgen. Enda tillåtna vivida färgen: Stripe `#635BFF`.
- ❌ `#E00`-röd, mättad grön, färgad badge-text.

**T5 — Type-pairing är strikt + eyebrow överallt.**
- ✅ Playfair (forest) endast titlar + stora tal; Inter för all funktionell text. `.eyebrow` (11px, `.18em`, VERSAL, gold-600) sitter över VARJE sidtitel OCH varje drawer-/card-sektion. Storefront-eyebrows använder em-dash-konvention: `"— Tjänster"`.
- ❌ Sektioner separerade av rå `<h3>` utan eyebrow; titlar i Inter.

**T6 — Spacing-disciplin (8px-bas + medvetna halvsteg).**
- ✅ Card pad 22, drawer pad 24, main 30, grid-gaps 14/16/20. Återkommande set `{6,7,8,9,10,11,14,16,18,20,22,24,30}`. Storefront: sektioner **112 / 96 / 84px** vertikalt, konstant **28px** gutter, per-sektion max-bredd.
- ❌ Ad-hoc paddings (`2.5rem`, `1.25rem`), en global container-bredd för alla sektioner.

**T7 — Asymmetrisk komposition; arbetet dominerar.**
- ✅ Två-kolumns-body med vänster bredare: dashboard `1.5fr/1fr`, Tjänster `1.7fr/1fr`, Branding `390px/1fr`. `align-items:start` så en kort högerräcka inte sträcks. Sub-copy capped 560, sök capped 360 — aldrig full-bleed.
- ❌ Symmetrisk 1fr/1fr för arbetsytor; full-bredd brödtext/sökfält.

**T8 — Hairlines, inte boxar.**
- ✅ `1px solid --c-line` skiljer; cards är paper på cream + `shadow-sm`. Storefront input/action-borders är **1.5px** (avsiktligt tyngre där tappbarhet räknas), strukturella hairlines 1px.
- ❌ Tunga outlines / boxade paneler.

**T9 — Lugn motion; rörelse, inte bara färg.**
- ✅ 160ms interaktioner, 280–520ms entréer, `ease-out (.22,1,.36,1)`. Drawer glider `.34s`, toast `.42s`. Storefront-hover = **rörelse**: service-rad glider höger (`paddingLeft 8→20`), galleri-tile pressas in (`scale .985`), carousel-prick töjs (9→30px), knapp-press `scale(.97)`. Reveal-on-scroll: `opacity 0→1 + translateY 28→0`, 700ms, stagger `idx*60/90`.
- ❌ Studs/overshoot; hover som bara byter bakgrundsfärg.

**T10 — Alignment & "produkten berättar".**
- ✅ PageHead-actions baseline-aligned mot titeln (`align-items:flex-end`). Callout-band och live-preview visar varje garanti ("no-show blir aldrig auto-betald") och konsekvens i UI. Tomma states är skrivna ("Tom sektion", "Inga bokningar matchar"), aldrig blanka.
- ❌ Actions top-aligned; garantier/dirty-state/empty-states utelämnade eller renderade som grå lådor.

**T11 — Self-rendering pickers, inte platta listor.**
- ✅ Font-tiles renderar i sitt EGET typsnitt; theme-tiles som mini-storefronts; färg-swatches namngivna med ring i egen färg. Live-proof-paneler (storefront-preview i browser-chrome i salongens EGET tema; live placement-map) över statiska beskrivningar.
- ❌ Drop-down med fontnamn i systemfont; statisk färglista.

---

## 4. Signature components spec

### 4.1 Shell (sidebar + topbar)
**Sidebar** — `width:244` (impl 248 → korrigera), `flex:none`, `bg --c-forest`, `color --c-on-forest`, sticky `top:0 h:100vh`, pad `22px 16px`, tre zoner:
- **Brand:** gold logo-tile 34×34 `radius 9`, glyf `--c-forest-700` Playfair 800/19 ("C") + namn (Playfair 700/16, ellipsis) + roll-sub (10.5px `.08em` VERSAL `--c-on-forest-2`).
- **Nav** (`flex:1`, `gap:3`): item = `padding 11px 13px`, `radius 10`, `gap 12`, Inter 14, `<Icon size 18 stroke 1.7>`. **Aktiv = `bg --c-forest-700` + `color #fff` + `borderLeft:2px solid --c-gold` + wt 600**; inaktiv transparent / `--c-on-forest-2` / wt 500 / `borderLeft 2px transparent`; hover (endast inaktiv) `rgba(255,255,255,.05)`.
- **User-footer:** `borderTop 1px --c-forest-300`, avatar 34×34 `--c-forest-300` + namn (13/600) + org (11px) + logout-ikon.

Nav är roll-driven (`super`/`salon`/`staff`) — byter brand, sub-label, identitet, item-lista.

**Topbar** — sticky, pad `14px 30px`, `borderBottom 1px --c-line`, `bg color-mix(--c-cream 80%, transparent)` + `backdropFilter blur(8px)`, `z:20`.
- Vänster: sök `width 300, maxWidth 40vw`, search-ikon abs left:12, input `9px 12px 9px 36px`, `radius 10`, focus → border `--c-forest`. Kontext-medveten placeholder.
- Höger (`gap 12`): **"Se din sida"-pill — ENDAST salon-roll** (`<a>` + external-ikon, Inter 13/600, `color --c-forest`, `radius 10`, `1px --c-line`, paper). **Bell-knapp** 38×38 `radius 10`, `1px --c-line`, paper, bell-ikon 18, **gold unread-dot** 7×7 abs `top:8 right:9`. Notiser/external är gold-*prickade*, aldrig gold-fyllda.

### 4.2 Stat card (KPI)
Byggd på `Card`. Anatomi: header-rad (`.eyebrow`-label vänster | icon-chip höger 34×34 `radius 10` `bg --c-paper-2` `color --c-forest` `Icon 18`) → **value Playfair 700/38 forest `.num` lh 1.1 `mt 10`** → delta (om finns, `mt 8`, 13/600, `trendUp`-ikon + `--c-success`, annars ink-3) → hint (`mt 6`, 12 ink-3). Props: `{label, value, delta?, deltaTone:'success'|'muted', icon?, hint?}`. *Impl-status:* `Stat.tsx` redan korrekt (Playfair 38, success-token, paper-2 icon-tile) — **lägg till `hint`-raden** (saknas).

### 4.3 Branding editor (flaggskeppet)
State: `brand` (working) vs `published`; `dirty = stringify(brand)!==stringify(published)`; `history[]` undo-stack; `changed` = senast-redigerad nyckel. Layout `390px/1fr align-start gap 20`, klass `bo-brand`.
- **PageHead-actions:** `ghost icon="undo" Ångra` (disabled när `!history.length`) · `ghost external Visa storefront` · **`gold icon="check" Publicera` (disabled när `!dirty`)**.
- **Dirty-band** (full-bredd, callout-mönster): `warning-bg` + alert-ikon + "Osparade ändringar — förhandsvisningen uppdateras live. Tryck Publicera…" ↔ flippar till `success-bg` + check + **"Allt publicerat. Storefronten visar senaste versionen."** Båda states är obligatoriska.
- **Namngiven swatch-picker:** `[hex,label]`-par, 38×38 `radius 10`, `title=label`, vald = `boxShadow 0 0 0 2px {egen hex}` + 2px paper-border (ring i sin egen färg), ovald = `0 0 0 1px --c-line`. *Swatch-setet är illustrativt/konfigurerbart* (t.ex. Salvia-grön/Mässing/Terrakotta/Lavendel/Svart/Lera) — **blanda INTE ihop** med (a) de 5 shippade temana eller (b) preview-presets (Atelier/Brass/Lera/Kontur/Blom); det är tre separata lager.
- **Self-rendering font-tiles:** full-bredds-knappar, var och en `fontFamily:{font}` @ 18px (renderar i sitt eget snitt), vald = `1.5px forest + paper-2`, annars `1.5px line`. Oswald special-case: preview-namn → VERSAL + `letterSpacing .08em`.
- **"ändrad"-pill** per fält: `10.5px/700 gold-600 på gold-100, pad 2px 7px, pill`, inline i label-raden.
- **Live-preview i browser-chrome:** höger kolumn `radius 18 overflow hidden border line shadow-md`. Fake-bar `bg #EDEAE3` + tre 11px-prickar (`#E0726A/#E6B34D/#7FB47F`) + vit URL-pill `{name}.corevo.se`. Hero 430px med foto + scrim `(0,0,0,.28→.62)`; namn (i `brand.font`), eyebrow, 46px headline, två `brand.color` "Boka tid"-pills repaintar live. **Renderas i storefront-världen / salongens tema (NOT forest/gold).**
- **Changed-field-highlight (`hl()`):** redigerat preview-element får `outline:2px solid --c-gold, outlineOffset 3` + rubrikrad "Uppdaterade: {fieldLabel}".

### 4.4 Placement-first Services-tabell + storefront site-map
`twocol 1.7fr/1fr gap 16`.
- **Vänster tabell:** kolumner `Tjänst | Tid | Pris | Storefront | Online | (edit)`. Storefront = live `<select>` (Dam/Herr/Färg/Styling) när online, annars "— dold —". Online = inline pill-toggle 42×24 (`left 3↔21`, `bg forest↔line-strong`); av sätter section → "Dold".
- **Höger map:** Card "Var det syns på hemsidan" / "salvia.corevo.se → Tjänster". Per sektion: paper-2-panel `border line radius 12`, VERSAL forest 12/700 `.06em`-header, tjänster som små pill-chips; tom = "Tom sektion". Footer: "Ändringar slår igenom utan kod eller deploy." **Mappen är LIVE:** ändra select → chip flyttar direkt; toggla av → faller till "— dold —".

### 4.5 Weekly schema-grid
`Card pad={0}` → `grid repeat(5,1fr)` (Mön–Fre), kolumn `borderRight line, minHeight 360–420`, klass-hook för 920px-kollaps.
- **Dag-header:** centrerad; `bg --c-gold-100` ENDAST om `today` (enda gold-fyllningen på sidan); VERSAL ink-3 veckodag `.05em`; **Playfair 22/700 forest datum**; `.num` slot-count.
- **Slot-chips:** grön (`--c-success-bg` + `.num` success-tid), `gap 7`, pad 9–10, med `×`-remove; bokningsbar-tom = `1px dashed --c-line-strong`; add = dashed ghost-knapp + plus. **Explicita bokningsbara starttider** (ojämna intervall tillåtna 09:00, 09:45, 10:45…) — ALDRIG "från–till arbetstid".

### 4.6 Gold loyalty/tier-tabell (Kunder)
- PageHead-actions: `ghost icon="upload" Exportera` + `primary icon="plus" Ny kund`.
- Kolumner `Kund | Nivå | Besök | Senaste | Frisör | Lojalitet`. Kund-cell: 30px forest-avatar + namn + `--c-info` shield-glyf om skyddat namn. Nivå: `Badge` — Guld→gold, Silver→info, Ny→success, annars neutral. **Lojalitet (sista kol, höger-justerad): `.num` wt 600 `color --c-gold-600`** + `" p"` (`toLocaleString("sv-SE")`). Gold endast på loyalty-talet. Rad-klick → drawer 460 med tier-badge i `accent`-slot.

### 4.7 Dashboard `1.5fr/1fr` + callout-band
- Vänster (bredare): "Kommande idag"-card (klickbara rader → drawer), `Alla bokningar →`. Höger (smalare context-räcka): Tjänste-mix (MixBar — 14px stacked pill summerar **exakt 100%** + 2-kol legend), Dagens topptimmar (PeakChart — `flex-end` barer h130, högsta = gold, resten forest-300), **inverterat forest-card** "Röd tråd · Din sida, live", Stripe-card.
- **Inverterat forest "context"-card** (mest identitetsdefinierande): `Card {bg --c-forest, color --c-on-forest, border:none}`, eyebrow omfärgad `--c-gold`, vit Playfair h2 ~21/700, body i `--c-on-forest-2`, `variant="gold"`-knapp. Om dashboardens högerräcka är idel vita cards har du tappat identiteten.
- **Callout/guard-band** (komponent, används ~10 ställen): `flex align-center gap 11, pad 11–12px 16px, radius 12`, leading `Icon 16–17 flex:none` + 13px ink-text + valfri inline-action. Fyra toner (bg + ikonfärg parat): `warning` (dirty, no-show-guard), `success` (publicerat, "testad & fungerar"), `info` (schema-preset, auto-klar "försvinner aldrig", frånvaro), `gold-100` (live-koppling "prova: Avboka", runtime-info). Sitter mellan PageHead och body, eller inline i drawer. **Bygg denna komponent och använd den faktiskt** — rough-bygg utelämnar dem eller gör grå lådor.

### 4.8 Kund-portal Account (STOREFRONT-världen)
**Renderas i salongens eget tema — NOT forest/gold.** `Customer.jsx` är medvetet storefront-world (sage `--color-primary #5E7361`, Cormorant + Jost, pill-knappar `radius 999`, centrerad `maxWidth 760`). Att måla den i Corevo-tokens är en **korrekthets-bugg**, inte stilval.

*Scope-not (verifierad):* Det shippade `Account.jsx` är en lean modal (login/register/account + platt boknings-lista) — **ingen** loyalty-band/message-composer/date-block i kit-källan. Men M6-specen (Study 1 nod 12 + Study 4 §2k) **kräver** ett loyalty-bärande kundportal. Bygg därför Account som **M6-target, NET-NEW i storefront-grammatik**, flaggat som extension av lean-baseline:
- **Identitetsrad/hero:** 52×52 round avatar `bg --color-primary`, initial i `font-display 22`, namn `font-display 22` + email `.sf-body`.
- **Loyalitetskort:** nivå + poäng på EN rad (no-wrap) + tunn progress-rail (`h 8 radius 999`, track accent-soft, fill = **tema-accent**) mot nästa nivå + gift-ikon. **KRITISK världs-korrektion:** poäng "i guld" betyder här salongens lokala accent (`--color-primary`, eller portalens `#B08A4A`-sage-accent) — **ALDRIG Corevo `--c-gold`**. Loyalty-numeral = `font-display` + tenant-accent.
- **Mina bokningar:** card `border 1px line, radius var(--sf-radius), pad 16`. Top: service (15.5/600) + `who · when` (.sf-body) | status-pill (Kommande → `bg accent-soft, color primary`; Genomförd → outline + fg-2). Inline-actions ENDAST om Kommande: Omboka + Avboka (1.5px pill-borders, Avboka dämpad). Avboka → röd tråd: status avbokad, tid frigörs, reflekteras i admin/personal/dashboard.
- **Integritet:** visningsnamn-picker (full/förnamn/initialer, segmented i `info`/accent-soft, vald = primary-fyllning) + kontaktfält + consent-toggle. Modal-frame: overlay `rgba(0,0,0,.45) blur(3px)`, card `min(460px,100%)`, `radius calc(var(--sf-radius)+6px)`, `shadow 0 40px 100px rgba(0,0,0,.4)`.

### 4.9 Drawer (delad detalj-yta)
Höger-ankrad `width 460–480, maxWidth 94vw`, scrim `rgba(20,30,24,.34)` (grön-tonad), `translateX(102%→0)` `.34s --ease-out`, `bg --c-cream`, `shadow-lg`. Header (paper, hairline-botten): `accent`-slot (badge) → Playfair 18 → sub → 34×34 close. Body scrollar (sektioner = `.eyebrow` + content; detail-par `grid 1fr 1fr gap 12px 16px`). Sticky footer = status-medvetna actions (avbokad→Återställ; klar→Markera betald+Öppna igen; gjord→danger Avboka + primary Markera klar). **PII maskerad default** (`070- •• •• ••`); `Visa` → toast "Kontaktuppgift synlig i 15 min (loggas)" (warning). Noteringar = gold-100 chat-bubblor mot bokningsraden, INTE mejltråd.

### 4.10 Toast (röd-tråd-ryggrad)
Bottom-center, glider `bottom −80→28` `.42s --ease-out`, auto-dismiss **3400ms**. Forest pill, vit text, `radius 12 pad 13px 20px shadow-lg 13.5/500`, leading 26×26 ton-färgad ikon-chip. Varje muterande action avfyrar EN svensk toast som beskriver *konsekvensen*: `cancel`→"Tid {time} frigjord — åter bokningsbar på storefronten" · `complete`→"{time} markerad som klar" · `markPaid`→"Markerad som betald" · `revealPII`→"Kontaktuppgift synlig i 15 min (loggas)" (warning).

---

## 5. Per-page build spec (RETROFIT — alla sidor finns redan)

Format: **mål-komposition → obligatoriska signatur-element → delta mot impl.** Impl-grunden: `portal-global.css` har shell + `.portal-stat`/`.ptable`/`.pbtn`/`.pswitch`/`.ppill`; primitiver i `components/portal/ui/{Stat,Card,Button,Table,Badge,PageHead,Icon}.tsx`. Generell delta: **PageHead-primitiven används troligen inte** (sidorna har `.portal-section h1` utan eyebrow/sub-cap); **callout-band, drawers, live-preview, placement-map saknas**; **sidebar 248→244, brytpunkt 760→920 + porta `bo-*`-klasser + fasta grids.**

| Sida (route) | Mål-grid | Obligatoriska signatur-element | Delta mot impl |
|---|---|---|---|
| **Dashboard** `(admin)/admin` | stat `repeat(4,1fr)` g16 mb18 → `1.5fr/1fr` g16 (`bo-2col`/`bo-stat-grid`) | 4 KPI (live-data), Kommande-idag-lista (rad-klick→drawer), MixBar (=100%), PeakChart, **inverterat forest-card "Röd tråd"**, Stripe-card | Bygg inverterat forest-card + charts + callout. Inga klick-analytics (medvetet bortvalt v1). |
| **Bokningar** `(admin)/admin/bokningar` | filter-rad → 4-view-switch | gold-tint röd-tråd-band; status-pills m. counts; **ViewSwitcher Lista/Tidslinje/Vecka/Tavla** (persist `localStorage["corevo.bookings.view"]`); delad drawer; Tidslinje `dur`-proportionell (höjd = duration); avbokad = struck-through, ej borttagen | Bygg view-switcher + 4 vyer + drawer + band. |
| **Bokningsdetalj** (drawer) | drawer 460 | status-badge + Playfair-namn; auto-klar + payment-guard callouts; **PII maskerad default + loggad 15-min reveal-toast**; noteringar mot raden (gold-bubblor); separata Markera klar / Markera betald | Ny drawer-komponent. |
| **Kunder** `(admin)/admin/kunder` | stat `repeat(4,1fr)` → sök `maxWidth 360` → full-bredd tabell + drawer 460 | 4 stat-cards; tabell m. shield-glyf, tier-badge, **lojalitet gold-600 höger-justerad `.num`**; visningsnamn per `showAs` | Tabell finns ev. platt — lägg tier-badge + gold-loyalty-kol; cap sök 360. |
| **Kunddetalj** `(admin)/admin/kunder/[id]` | drawer/sida | identitet (bestående) → visningsnamn-picker → **PII tidsbunden** → lojalitet (Playfair gold-600 + progress) → historik | Bygg lager-separationen synligt. |
| **Tjänster** `(admin)/admin/tjanster` | `1.7fr/1fr` g16 | placement-tabell (online-toggle + section-select) + **live storefront-site-map** | Bygg map-räckan + inline-toggles. |
| **Schema** `(admin)/admin/scheman` | per-frisör-pill → `Card pad 0` `repeat(5,1fr)` | gröna slot-chips, today gold-tint, dashed `+ Tid`, explicita starttider | Bygg vecko-grid; inga från–till-tider. |
| **Personal** `(admin)/admin/personal` | `repeat(auto-fill,minmax(300px,1fr))` g16 | frisör-cards (egen-färg-avatar, specialty-chips) → drawer m. **"Verklig dag · idag"** (samma store som M5) | Bygg cards + drawer; duplicera inte boknings-data. |
| **Varumärke** `(admin)/admin/varumarke` | `390px/1fr` g20 (`bo-brand`) | **HELA flaggskeppet §4.3**: dirty↔published-band, swatch-ring-picker, self-rendering font-tiles, live browser-chrome-preview (salongens tema), gold changed-field-outline, Ångra/Publicera-gating | Sidan finns — bygg ut till full flaggskepps-spec. Högsta prioritet. |
| **Inställningar** `(admin)/admin/installningar` | constrained `maxWidth 640` | grupperade cards (Bokning/Betalning), varje rad: label + **AKTIV/AV-pill** + toggle + **proof-callout under aktiva toggles** | `.pswitch`/`.ppill` finns — lägg proof-callouts; constrain bredd. Inga döda toggles. |
| **Frisör idag** `(personal)/personal` | constrained `maxWidth 720` | **"Nästa kund"-hero** (inverterat forest, Playfair-tid, gold Markera klar) → dag-lista m. inline kund-not (gold-bubbla); samma store som admin | Bygg hero + inline-noteringar. |
| **Frisör schema/frånvaro** `(personal)/personal/{arbetstider,franvaro}` | `560/720` | vecko-grid (§4.5) / frånvaro m. info-callout "frigör storefront-slots" | Constrain + callout. |
| **Platform** `(platform)/*` | full-bredd tabeller | `.ptable` (redan rätt), status-ord-badges, Stripe `#635BFF` tillåten | Lägg PageHead-eyebrow; status-badges. |
| **Kund-portal** `(kund)/konto*` | **STOREFRONT-world**, centrerad `maxWidth 760` | §4.8: tema-färgad, loyalty-kort (tema-accent ej Corevo-gold), boknings-cards m. status-pill + Omboka/Avboka, integritets-picker | ⚠️ `/konto` är "un-worlded" i impl (`portal-global.css` L11) → **sätt `data-world="storefront" data-theme` och bygg i tema-grammatik.** Bygg loyalty net-new. |

---

## 6. Build checklist — "Är den elegant än?"

Kör denna före varje "klar"-deklaration på en sida:

**Världar & tokens**
- [ ] Rooten bär rätt `data-world` (+ `data-theme` i storefront). Inga `--c-forest/--c-gold/.h1/.eyebrow` i storefront/`/konto`; inga `--color-*`-tenant-vars som bär struktur i back-office.
- [ ] Noll hårdkodade hex — allt refererar CSS-variabler.

**Typografi (T1, T5)**
- [ ] Varje numeriskt värde (KPI, datum, tid, poäng, pris) = `font-display` + `.num` tabular. Inga siffror i Inter.
- [ ] `.eyebrow` (gold-600, 11px, `.18em`, VERSAL) sitter över varje sidtitel OCH varje card-/drawer-sektion. PageHead = eyebrow → Playfair-28 → sub capped 560, actions baseline-aligned.

**Gold & färg (T2, T4)**
- [ ] Gold ENDAST som accent (rail/border/loyalty/delta/active/today-tint/logo/en CTA). Ingen gold panel-fyllning.
- [ ] Status dämpad på `*-bg`; badge-text mörk ink, ton i pricken. Ingen mättad röd/grön.

**Komposition & spacing (T6, T7, T8)**
- [ ] Sidan ligger i `main{padding:30px}` + sticky-blur-topbar + 244px gold-railad sidebar; ingen egen sid-chrome/bg/padding.
- [ ] Arbetsytor är asymmetriska (1.5/1.7fr vänster); `align-items:start`; sub-copy 560 / sök 360 cappade.
- [ ] Spacing på `{6,7,8,9,10,11,14,16,18,20,22,24,30}`; cards radius 16, controls 10, pills 999. Hairlines `--c-line`, inte tunga boxar.

**Elevation & motion (T3, T9)**
- [ ] shadow-sm (cards) / md (preview) / lg (drawer, toast), forest-tonade. Inte allt platt eller neutralt-svart.
- [ ] Transitions från tokens (`160/280/520`, `ease-out`); inga studsar. Storefront-hover ger RÖRELSE (rad-glid/tile-press/dot-töj), inte bara färgbyte.

**Produkten berättar (T10, T11)**
- [ ] Callout-band finns och används för guards/explainers/dirty-state (warning/success/info/gold-100).
- [ ] Varje toggle är på riktigt wired + har AKTIV/AV-pill + proof-callout. Inga döda toggles.
- [ ] Empty-states är skrivna, inte blanka. Disabled-states (Ångra/Publicera) gatas på history/dirty.
- [ ] Pickers self-rendering (font-tiles i eget snitt, theme-tiles som mini-storefronts, namngivna swatch-ringar). Live-proof-paneler över statiska beskrivningar.

**Röd tråd**
- [ ] Varje muterande action propagerar till alla ytor + avfyrar EN svensk konsekvens-toast.
- [ ] PII maskerad default; reveal är loggad + tidsbunden (15 min) + warning-toast.

**Responsivt**
- [ ] 920px-brytpunkt med `bo-2col/bo-stat-grid/bo-brand` (4-up→2-up, multi-col→stacked) — inte 760 + auto-fill.

**Den "fixa fem saker"-genväg om tiden är knapp:** (1) PageHead-rytmen på varje sida; (2) alla tal i Playfair+tabular + eyebrow över varje sektion; (3) bygg & använd callout-band-komponenten; (4) bygg Branding-flaggskeppet helt; (5) gold som accent / forest som struktur + porta `bo-*`-klasser + 920px-kollaps. Plus: världa `/konto` till storefront.

---

**Källfiler (alla absoluta):** kanon-tokens `C:/Users/Zivar-PC/Desktop/firsör-sas/2-Byggplan/corevo-booking-design-system v2/project/colors_and_type.css`; back-office-kit `…/project/ui_kits/back-office/{Shell,SalonAdmin,Branding,ServicesSchema,Staff,StaffSettings,Customers,Customer,Bookings,App}.jsx` + `index.html`; storefront-kit `…/project/ui_kits/storefront/{App,Chrome,Home,Account}.jsx` + `layouts/{Leander,Edit}.jsx`; M6-spec `…/handoff-assets/Corevo M6 Build Spec.html` + `spec-data.js` + `img/`. Impl-grund `C:/Users/Zivar-PC/Desktop/firsör-sas/5-Kod/apps/web/app/portal-global.css` + `5-Kod/apps/web/components/portal/ui/*.tsx` + `5-Kod/apps/web/app/(admin|kund|personal|platform)/**/page.tsx`.
