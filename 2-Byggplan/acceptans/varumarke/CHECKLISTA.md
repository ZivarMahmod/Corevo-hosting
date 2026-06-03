# Acceptans — Varumärke (flaggskeppet) · `(admin)/admin/varumarke`

> Källa för värden: mocken `../../components/Branding.jsx` (1:1) + playbook §4.3.
> Orakel: `mock-varumarke.png` (kontroller) + `mock-varumarke-preview.png` (live-preview).
> Impl: `5-Kod/apps/web/app/(admin)/admin/varumarke/page.tsx` + `components/admin/BrandingForm.tsx`.
>
> **Kör `_shell-och-tokens.md` först (0 FAIL). Sedan detta. Sedan `varumarke.accept.spec.ts`.**

Det här är "make-it-match"-prioritet #1. Sidan **finns** redan; checklistan är en
retrofit till full flaggskepps-spec. Varje rad är mätbar.

---

## 1. PageHead

| # | Element | Egenskap | Förväntat |
|---|---|---|---|
| P1 | Eyebrow | text / family / size / spacing / transform / färg | `Studio Salvia` (tenant-namn) · **Inter** · 11px · `.18em` · UPPERCASE · `--c-gold-600` #D98E12 |
| P2 | Titel | text / family / size / weight / färg | `Varumärke` · **Playfair Display** · 28px · 700 · `--c-forest` #1F4636 |
| P3 | Sub | text / max-bredd | "Ändra bild, färg, typsnitt och text — du ser det direkt och inget kräver ny deploy." · capped ~560 |
| P4 | Actions | baseline-align mot titel | `align-items:flex-end` (actions sitter i baslinje, inte top) |
| P5 | Ångra | variant / ikon / disabled | ghost · `undo` · **disabled när `history.length === 0`** |
| P6 | Visa storefront | variant / ikon | ghost · `external` (öppnar storefront) |
| P7 | Publicera | variant / ikon / disabled | **gold** · `check` · **disabled när `!dirty`** |

## 2. Dirty/published-band (obligatoriskt — båda states)

| # | Egenskap | Förväntat |
|---|---|---|
| D1 | Layout | `display:flex; align-items:center; gap:11px; padding:11px 16px; border-radius:12px; margin-bottom:18px` |
| D2 | Bakgrund **dirty** | `--c-warning-bg` #F3EBD9, leading-ikon `alert` 16px i `--c-warning` #A37D3C |
| D3 | Text **dirty** | "Osparade ändringar — förhandsvisningen uppdateras live. Tryck Publicera för att gå live." (13px, `--c-ink`) |
| D4 | Bakgrund **clean** | `--c-success-bg` #E8F0EA, leading-ikon `check` i `--c-success` #4E7A5E |
| D5 | Text **clean** | "Allt publicerat. Storefronten visar senaste versionen." |
| D6 | Inline "Ångra senaste" | syns bara när dirty; disabled-opacity `0.4` när `!history.length` |

## 3. Grid (`bo-brand`)

| # | Egenskap | Förväntat |
|---|---|---|
| G1 | `grid-template-columns` | **`390px 1fr`** (vänster kontroller, höger preview) |
| G2 | `gap` / `align-items` | `20px` / `start` |
| G3 | Kollaps | vid **920px** → `1fr` (single-col) via `bo-brand`-klass ⚠ DELTA |

## 4. Kontroll-kort (vänster)

| # | Element | Egenskap | Förväntat |
|---|---|---|---|
| C1 | Card | `padding` / `border-radius` | **22px** / 16px (canon) |
| C2 | Fält-label | size / weight | 13px / 600, `display:flex align-items:center` |
| C3 | Text-input (namn/hero/tagline) | padding / radius / border / font | `11px 13px` / `10px` / `1px solid --c-line` #E7E1D6 / Inter 14 |
| C4 | Logga-slot | layout | drop-zon `48×48 radius 10`, `2px dashed --c-line-strong` #D8D0C2, på `--c-paper-2` panel `radius 12 padding 14` |

### 4a. Accentfärg — namngiven swatch-ring-picker

| # | Egenskap | Förväntat |
|---|---|---|
| SW1 | Antal swatchar | **6** (Salvia-grön #5E7361, Mässing #9A8463, Terrakotta #C77B53, Lavendel #7E6E92, Svart #0A0A0A, Lera #B0693F) |
| SW2 | Mått (varje) | `38×38`, `border-radius:10px`, `border:2px solid --c-paper` #fff, `gap:9px` |
| SW3 | `title`-attr | = färgnamnet (Salvia-grön…) — för tillgänglighet |
| SW4 | **Vald** | `box-shadow: 0 0 0 2px {egen hex}` (ring i sin egen färg) |
| SW5 | Ovald | `box-shadow: 0 0 0 1px --c-line` |

### 4b. Rubrik-typsnitt — self-rendering font-tiles

| # | Egenskap | Förväntat |
|---|---|---|
| F1 | Antal | **5** (Cormorant Garamond, DM Serif Display, Oswald, Archivo, Fredoka) |
| F2 | **Renderas i eget snitt** | varje tile har `font-family` = sitt eget namn (Cormorant-tile ÄR Cormorant) · `font-size:18px` |
| F3 | Layout | `padding:11px 14px`, `border-radius:10px`, vänsterställd text |
| F4 | Vald | `border:1.5px solid --c-forest` #1F4636 + `background:--c-paper-2` #F3EFE8 |
| F5 | Ovald | `border:1.5px solid --c-line` #E7E1D6 + `background:--c-paper` #fff |

### 4c. "ändrad"-pill (per redigerat fält)

| # | Egenskap | Förväntat |
|---|---|---|
| CH1 | Stil | `font-size:10.5px; font-weight:700; color:--c-gold-600` #D98E12 `; background:--c-gold-100` #FBEBCB `; padding:2px 7px; border-radius:999px` |
| CH2 | Visas | endast på fältet vars värde just ändrades (`changed === field`) |

## 5. Live-preview (höger) — **STOREFRONT-världen**, flaggskeppet

> **Världs-korrektion (kritisk):** denna panel renderas i salongens tema
> (sage/Cormorant), **ALDRIG** i Corevo forest/gold. Att måla den i back-office-
> tokens är en **bugg**, inte stilval. (Playbook §4.3, T2.)

| # | Element | Egenskap | Förväntat |
|---|---|---|---|
| L0 | Eyebrow ovanför | text | "Live-förhandsvisning · storefront" + `sun`-ikon i `--c-gold-600` |
| L1 | Ram | `border-radius` / `overflow` / `box-shadow` | **18px** / hidden / `--shadow-md` (forest-tonad) |
| L2 | Browser-bar | bg | `#EDEAE3`, `border-bottom 1px --c-line`, `padding 10px 14px` |
| L3 | Trafikljus-prickar | 3 st, `11×11 radius 999` | `#E0726A` · `#E6B34D` · `#7FB47F` (i ordning) |
| L4 | URL-pill | stil + text | vit, `radius 999`, `padding 4px 12px`, Inter 12px; text = `{namn}.corevo.se` (gemener, a–z) |
| L5 | Hero | `height` | **430px**, bakgrundsfoto `cover/center` |
| L6 | Hero-overlay | gradient | `linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.62))` |
| L7 | Hero-padding | — | `30px` |
| L8 | Salongsnamn (top) | family / size / färg | = `brand.font` (Cormorant) · 22px (Oswald-fall: 26 + UPPERCASE + `.08em`) · #fff 600 |
| L9 | Tagline-eyebrow | stil | Inter 11px · `.16em` · UPPERCASE · `rgba(255,255,255,.85)` · prefix `"— "` |
| L10 | Hero-rubrik | family / size / lh / max | = `brand.font` · **46px** · lh 1.06 · `max-width 460` · #fff 600 |
| L11 | "Boka tid"-pill (top) | bg / färg / radius / padding | `background:{brand.color}` · #fff · Inter 12.5/600 · `radius 999` · `9px 18px` |
| L12 | "Boka tid"-pill (botten) | padding | `12px 26px` (övrigt = L11) |
| L13 | **Live-repaint** | beteende | ändra färg/font/text i kontroll → preview uppdateras **direkt**, ingen reload |
| L14 | changed-highlight `hl()` | redigerat preview-element | `outline:2px solid --c-gold; outline-offset:3px` |

## 6. Info-callout under preview

| # | Egenskap | Förväntat |
|---|---|---|
| I1 | Stil | `background:--c-gold-100` #FBEBCB · `padding:12px 16px` · `radius:12px` · leading `info`-ikon i `--c-gold-600` |
| I2 | Text | "Färg och typsnitt läses som runtime-inställningar — därför syns ändringen direkt utan deploy." |

## 7. Beteende & röd tråd (state-maskin)

| # | Påstående |
|---|---|
| B1 | `dirty = JSON.stringify(brand) !== JSON.stringify(published)` styr Publicera + bandet |
| B2 | `set(key,val)` pushar förra värdet på `history` (undo-stack) + sätter `changed=key` |
| B3 | `undo()` poppar `history`, nollar `changed`; disabled när tom |
| B4 | `publish()` sätter `published=brand`, tömmer `history`, nollar `changed` → bandet flippar till clean |
| B5 | Färg/font läses som **runtime** `tenant_settings` → publicera ändrar storefront **utan deploy** (kärnlöftet — verifiera mot live storefront-route) |

---

## Avgränsning (ärlig)
- Swatch-setet (6 färger) är **illustrativt/konfigurerbart** — blanda inte ihop med
  (a) de 5 shippade storefront-temana eller (b) preview-presets. Tre separata lager (§4.3).
- Foto i previewn = Unsplash-platshållare → byts mot tenant-uppladdad R2-media.
- "ändrad"-pill + undo finns i mocken; om impl saknar dem = bygg dem (de är obligatoriska, inte nice-to-have).
