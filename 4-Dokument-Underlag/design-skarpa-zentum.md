# Design-teardown: zentum.se — vad som gör den "skarp som ett svärd"

**Datum:** 2026-07-11
**Syfte:** Extrahera de mätbara designvalen bakom Zentums skärpa, så de kan kodas in i Corevos mallar.
**Metod:** Hämtat HTML + hela CSS-kedjan (341 KB, 9 filer) via curl, parsat Slider Revolution-JSON:en för hero-lagren, räknat WCAG-kontrast och inventerat radier/färger/motion i kod. Inga ögonmått.

## Källor (verifierade)
| Vad | Var |
|---|---|
| Stack | WordPress + Elementor 3.32 + tema `cleanfin` + Slider Revolution 7 |
| Tema-tokens | `/wp-content/pbmit-cleanfin-css/theme-style.min.css` |
| Sektionsrytm | `/wp-content/uploads/elementor/css/post-73.css` (= startsidan) |
| Hero (exakta värden) | `SR7.JSON['SR7_2_1']` inline i HTML — slider "Slider Demo 02" |
| Komponenter | `css/service/service-style-2.min.css`, `css/icon-heading/icon-heading-style-2.min.css` |

> ⚠️ **Fontvarning (deras bugg, inte deras styrka):** Sidan laddar BARA `Wix Madefor Display` (500,600), `DM Sans` (400) och `Merriweather`. Tema-CSS:en deklarerar `Inter` för brödtext/rubriker och `PT Serif` för h1 — men **de fonterna laddas aldrig**. Allt utanför heron renderas alltså i systemets fallback-grotesk (Arial/Helvetica). Skärpan kommer alltså INTE från fontvalet — den kommer från skala, vikt, kontrast och rytm. Vi ska ladda vår font på riktigt.

---

## 1. Typografi — mätvärden

### Faktiska nivåer
| Nivå | Font | Storlek | Line-height | Vikt | Letter-spacing | Färg |
|---|---|---|---|---|---|---|
| Hero H1 | Wix Madefor Display | **110px** (110/80/70/50 ned) | **120px** (1.09) | **500** | **0** | `#0c3c60` |
| Hero eyebrow (pill) | Wix Madefor Display | 13px | 24px | 500 | **2px** | `#fff` |
| Hero brödtext | DM Sans | 17px | 24px (1.41) | 400 | 0 | `#fff` |
| Hero CTA | Wix Madefor Display | 12px | 50px (= knapphöjd) | **600** | 1px | `#fff` |
| Sektionsrubrik | (Inter→fallback) | **54px** | **60px** (1.11) | **500** | 0 | `#212c40` |
| Sektions-eyebrow | (Inter→fallback) | **11px** | 22px | **600** | **1px** + VERSALER | `#212c40` |
| Kortrubrik (service) | — | 28px | 34px (1.21) | 600 | 0 | `#212c40` |
| Lead-text | — | 18px | 28px (1.56) | 400 | 0 | `#666` |
| Brödtext | — | **16px** | **1.6** | 400 | 0 | `#666` |
| Knapp (alla) | — | 12px | 24px | **600** | **1px** + VERSALER | — |
| h1…h6 default | — | 48/42/36/30/24/20 | 54/48/42/36/30/30 | 500/600/600/600/600/400 | 0 | `#212c40` |

### Typskalans STEG — det här är själva svärdet
```
110px  →  54px  →  28px  →  18px  →  16px   |  11px (mikro)
     ×2.04    ×1.93    ×1.56    ×1.13
```
Stegen är **enorma** (≈×1.9–2.0 mellan display→sektion→kort). Ingen tvekan om vad som är viktigast.
En slapp sida har istället ×1.2–1.33 hela vägen (40/32/24/18) → allt ser lika viktigt ut → grötigt.

### Line-height-kontrast
- Display/rubrik: **1.09–1.14** (spänt, kompakt block)
- Brödtext: **1.56–1.60** (luftigt, läsbart)
→ Skillnaden i sig skapar skärpa: rubriken blir en *form*, brödtexten en *yta*.

### Vikt-inversionen (viktigast, mest kontraintuitiv)
- **Stort = MEDIUM (500)** — 110px och 54px körs i vikt 500, inte 700/800.
- **Litet = SEMIBOLD (600) + VERSALER + letter-spacing 1–2px** — 11px, 12px, 13px.

Letter-spacing skalar **omvänt mot storleken**: 0 på allt ≥28px, +1px på 11–12px, +2px på 13px.
Fet 110px-rubrik = tung morot. Medium 110px-rubrik = skarp kniv.

---

## 2. Kontrast (beräknad WCAG)
| Par | Ratio | Betyg |
|---|---|---|
| Blackish `#111926` på vitt | **17.63:1** | AAA |
| Rubrik `#212c40` på vitt | **14.01:1** | AAA |
| Hero-CTA `#fff` på `#212c40` | **14.01:1** | AAA |
| Rubrik `#212c40` på ljus `#f2f4f8` | 12.72:1 | AAA |
| Hero H1 `#0c3c60` på vitt | 11.47:1 | AAA |
| Accent `#a5cbe3` på navy | 8.17:1 | AAA |
| Brödtext `#666` på vitt | **5.74:1** | AA |

**Mönster:** Varenda rubrik ligger på **11–18:1**. Ingenting ligger i den mjuka 3–4:1-zonen. Brödtexten är den enda som "bara" är AA (5.74:1) — och det är medvetet: den ska backa för rubriken.

---

## 3. Rytm & spacing
- **Container:** `1140px` max-width.
- **Sektionspadding:** `100px 0` (standard), `110px` (bildsektion), `80px` topp. Nedskalning: 1366px → 100/70, 1024px → 80/50, 767px → 60/30.
- **Blockrytm inom sektion:**
  - eyebrow → rubrik: **5px**
  - rubrik → beskrivning: **30px**
  - hela heading-blocket → innehåll: **50px**
  - bild → text i kort: **30px**
  - knapp-topp i ihbox: **35px**
- **Grid:** 3 kolumner, kolumnpadding `12px`, widget-spacing `20px`.
- **Skala:** 5 / 10 / 12 / 15 / 20 / 25 / 30 / 35 / 50 / 60 / 80 / 100 / 110
  → **bas-5, med 10-multiplar i det stora spannet.** Inte 4/8-bas — men konsekvent.
- **Textbredd:** `max-width: 800px` på beskrivningar (radlängd-spärr).

---

## 4. Bild
- **Alla innehållsbilder är beskurna till EXAKT `900×1000` = 9:10** (0.900). Sex bilder, samma ratio, inga undantag.
- `width: 100%`, ingen `object-fit` behövs (redan beskurna serverside).
- **`border-radius: 0` på bilderna.** Inga mjuka hörn.
- Hero: bakgrundsbild + `linear-gradient` overlay (270°) som separat shape-lager.
- Hero-bildlager ratio 2.02 (panorama).

Enhetlig ratio = kanterna linjerar i grid = ögat får raka linjer. **Detta är den enskilt billigaste skärpe-fixen.**

---

## 5. Knappar
| Egenskap | Värde |
|---|---|
| Typsnitt | 12px / 600 / **VERSALER** / LS **1px** |
| Hero-CTA höjd | `line-height: 50px`, padding `0 30px` |
| Hero-CTA radie | **25px** (= exakt halva höjden → perfekt pill) |
| Hero-CTA färg | text `#fff` på `#212c40` (14:1) |
| Outline-variant | `2px solid`, padding `12px 25px` |
| Radie-varianter i temat | `0` (square) / `15px` (round) / `50px` (rounded/pill) |
| Hover | fylld bakgrund ↔ inverterad text (hård växling, ingen opacitet) |

---

## 6. Färg — räknat
**8 hex-värden totalt** på hela sidan:

| Hex | Roll | Hue |
|---|---|---|
| `#212c40` | Global/primär navy | 220° |
| `#111926` | Blackish (text/footer-bg) | 220° |
| `#0c3c60` | Hero-rubrik navy | 209° |
| `#f2f4f8` | Ljus sektionsbakgrund | 220° |
| `#ffffff` | Bas | — |
| `#a5cbe3` | **Accent** (ljusblå) | 205° |
| `#666666` | Brödtext | neutral |
| `#9da5b5` | Dämpad footer-text | 218° |

**Nyckelinsikt: ALLT ligger i EN hue-familj (205–220°, blått).** Noll konkurrerande kulörer. Ingen orange, ingen grön, ingen andra-accent.
Accenten `#a5cbe3` sitter bara på små ytor (ikoner, prickar, progress). Sparsamt = skarpt.
Färg gör alltså **ingen** hierarki-jobb här — det gör *skalan* och *kontrasten*. Därför blir det aldrig plottrigt.

---

## 7. Hörnradier — inventerat
```
 26×  50px   (pill: knappar, eyebrow-pills)
 23×  0      (kort, bilder, sektioner, progress, dropdowns)
 16×  50%    (cirklar: prickar, ikoner)
  4×  15px   (marginell variant)
  3×  36px, 3× 4px, 2× 3px
```
**Systemet är binärt: `0` eller full pill (`50px`/`50%`).** Nästan inget däremellan.
Det är därför det känns skarpt: raka kanter överallt + medvetet runda småelement som kontrast.
En "morot" har istället `12px` på allt — kort, bilder, knappar, inputs — och blir en enda mjuk gröt.

---

## 8. Motion
- Kort-hover: `transform: translateY(-5px)`, `transition: all 500ms ease`. **Bara 5px lyft.** Ingen scale, ingen shadow-bloom.
- Ikon-hover: samma `-5px` / `500ms`.
- Vanligaste durationer: `0.25s` (28×), `0.4s` (44×), `300ms` (24×), `500ms` (14×).
- Rubrik-reveal: split-line med `cubic-bezier(.22,.61,.36,1)`.
- Ingen scroll-parallax på innehåll, inget fade-in-överallt.

Återhållsam motion = seriöst. Studsande/skalande hover = leksak.

---

## REGEL-LISTAN (kodbar)

### GÖR
1. **GÖR typskala med ×1.9–2.0 mellan nivåer** (110 → 54 → 28 → 18 → 16 px) — DÄRFÖR skarpt: ögat ser omedelbart vad som är viktigast, ingen tvekan.
2. **GÖR display-rubriker i vikt 500, inte 700** (110px/500, 54px/500) — DÄRFÖR skarpt: stor text i medium får tunna, precisa stammar; fet stor text blir en klump.
3. **GÖR line-height 1.09–1.14 på rubriker, 1.55–1.60 på brödtext** — DÄRFÖR skarpt: rubriken blir ett kompakt block med raka kanter, brödtexten en luftig yta. Kontrasten i sig gör skärpan.
4. **GÖR letter-spacing omvänt mot storleken: 0 på ≥28px, +1px på 11–12px, +2px på 13px** — DÄRFÖR skarpt: stor text behöver ingen spärr, liten versaltext behöver den för att inte bli en gråsuddig klump.
5. **GÖR all mikrotext till 11–12px / vikt 600 / VERSALER / LS 1px** (eyebrows, knappar, kategorier) — DÄRFÖR skarpt: små etiketter blir tydliga signaler, inte viskningar.
6. **GÖR rubrikkontrast 11:1 eller högre** (`#212c40` på vitt = 14.01:1) och brödtext ~5.7:1 — DÄRFÖR skarpt: rubriken *skär* mot bakgrunden; brödtexten backar medvetet.
7. **GÖR EN hue-familj, max 8 hex totalt** (allt inom 205–220° blått + vitt + en neutral grå) — DÄRFÖR skarpt: färg konkurrerar inte med hierarkin, skalan får göra jobbet.
8. **GÖR accenten sparsam** (`#a5cbe3` bara på prickar/ikoner/progress) — DÄRFÖR skarpt: en accent som syns överallt slutar vara en accent.
9. **GÖR binär hörnradie: `0` på allt strukturellt (kort, bilder, sektioner) + full pill (`50px`) bara på knappar/taggar** — DÄRFÖR skarpt: raka kanter linjerar mot varandra; pillen blir ett medvetet undantag.
10. **GÖR alla innehållsbilder till EN gemensam ratio, hårdbeskuren** (`900×1000` = 9:10, `border-radius: 0`) — DÄRFÖR skarpt: bildkanterna bildar raka linjer i griden. Billigaste skärpe-fixen som finns.
11. **GÖR knappen till exakt pill: höjd 50px + radie 25px + padding 0 30px** — DÄRFÖR skarpt: radie = exakt halva höjden ger en ren kapsel, inte en "nästan rundad rektangel".
12. **GÖR hover till 5px lyft / 500ms ease, inget mer** — DÄRFÖR skarpt: återhållsam rörelse läser som kompetens; studs och skalning läser som leksak.

### UNDVIK
1. **UNDVIK typskala med ×1.2–1.33-steg** (40/32/24/18) — DÄRFÖR slappt: allt väger lika mycket, sidan blir en gröt utan fokus.
2. **UNDVIK font-weight 300–400 på rubriker** — DÄRFÖR slappt: tunna stammar i stor grad = blek, kraftlös rubrik som inte håller ihop.
3. **UNDVIK enhetlig line-height (~1.4) på både rubrik och brödtext** — DÄRFÖR slappt: inget register-byte, allt flyter ihop i samma textur.
4. **UNDVIK text under 4.5:1 kontrast** (grå-på-grå, `#999` på `#f5f5f5`) — DÄRFÖR slappt: kanterna suddas ut, sidan känns disig/urblekt.
5. **UNDVIK `border-radius: 8–16px` på ALLT** (kort + bilder + knappar + inputs) — DÄRFÖR slappt: inga raka linjer kvar att linjera mot, allt blir mjuka kuddar.
6. **UNDVIK bilder i blandade ratios** (16:9 här, 4:3 där, kvadrat där) — DÄRFÖR slappt: kanterna hackar, griden tappar sina linjer.
7. **UNDVIK 3+ hue-familjer + flera accenter** — DÄRFÖR slappt: färgerna slåss om uppmärksamhet, hierarkin dör.
8. **UNDVIK letter-spacing på stora rubriker** — DÄRFÖR slappt: spärrad stor text tappar ordform och blir loj.
9. **UNDVIK box-shadow-bloom + scale(1.05) på hover** — DÄRFÖR slappt: pösig, "template-ig" rörelse.
10. **UNDVIK att lita på font-fallbacks** (Zentums egen miss: deklarerar `Inter`, laddar den aldrig) — DÄRFÖR slappt: du får systemets font, inte din design.

---

## 9. De 6 vanligaste anledningarna till att en sida känns MJUK / SLAPP

| # | Orsak | Varför det känns slappt | Konkret motmedel |
|---|---|---|---|
| 1 | **För lika typskala-steg** (×1.2–1.25 mellan nivåer) | Ögat hittar ingen ingång — allt är "mellanstort". Ingen hierarki = ingen skärpa. | Sätt stegen till **×1.8–2.0** i toppen. `110 / 54 / 28 / 18 / 16`. Låt gapet mellan H1 och H2 vara *brutalt*. |
| 2 | **Låg kontrast** (grå text `#999` på ljusgrå `#f7f7f7`, 2–3:1) | Bokstavskanterna suddas ut → hela sidan ser ur fokus ut, som en oskarp bild. | Rubriker **≥11:1** (nästan-svart på vitt). Brödtext **≥4.5:1**. Kör en kontrast-check i CI. |
| 3 | **För många hörnradier / radie på allt** (12px på kort, bild, knapp, input) | Inga raka linjer kvar att linjera mot. Allt blir kuddar; ögat får inga kanter att vila på. | **Binärt system:** `0` på struktur (kort/bild/sektion), full pill (`50px`) BARA på knappar/taggar. Inget däremellan. |
| 4 | **För lätt font-weight på rubriker** (300/400 i stor grad) | Tunna stammar i 54px blir bleka och kraftlösa — texten "hänger". | **500 (medium)** på display. Inte 300, inte 700. Och göm inte svag vikt bakom stor storlek. |
| 5 | **Luddig bildbeskärning** (blandade ratios, `object-fit: cover` på olika höjder) | Bildkanterna hackar i griden → inga sammanhängande linjer → rörigt och mjukt. | **EN ratio för alla innehållsbilder.** Beskär serverside till t.ex. **9:10 (900×1000)**. `border-radius: 0`. |
| 6 | **För mycket färg / för många accenter** | Färgerna konkurrerar om uppmärksamheten, hierarkin flyttas från skala till kulör — och kulör är trubbigt. | **En hue-familj** (t.ex. allt inom 205–220°) + vitt + en neutral grå. **Max ~8 hex.** Accenten bara på småytor. |

**Bonus 7 (Zentums egen miss):** deklarerad font som aldrig laddas → systemfallback. Kolla att fonten faktiskt levereras (`<link>` + `font-display: swap`).

---

## 10. Kodbara tokens (kopiera rakt in)

```css
:root{
  /* FÄRG — en hue-familj (205–220°), max 8 värden */
  --c-ink:        #111926;   /* 17.6:1 mot vitt */
  --c-primary:    #212c40;   /* 14.0:1 mot vitt */
  --c-display:    #0c3c60;   /* 11.5:1 mot vitt */
  --c-surface:    #ffffff;
  --c-surface-2:  #f2f4f8;
  --c-accent:     #a5cbe3;   /* SPARSAMT: prickar, ikoner, progress */
  --c-body:       #666666;   /* 5.7:1 — backar medvetet */
  --c-muted:      #9da5b5;

  /* TYPSKALA — steg ×1.9–2.0 */
  --fs-display: 110px;  --lh-display: 120px;  --fw-display: 500;  --ls-display: 0;
  --fs-h2:       54px;  --lh-h2:       60px;  --fw-h2:      500;  --ls-h2:      0;
  --fs-card:     28px;  --lh-card:     34px;  --fw-card:    600;
  --fs-lead:     18px;  --lh-lead:     28px;  --fw-lead:    400;
  --fs-body:     16px;  --lh-body:     1.6;   --fw-body:    400;
  --fs-micro:    11px;  --lh-micro:    22px;  --fw-micro:   600;  --ls-micro: 1px; /* + UPPERCASE */

  /* RADIE — binärt */
  --r-flat: 0;
  --r-pill: 50px;

  /* SPACING — bas 5/10 */
  --sp-1: 5px;   --sp-2: 10px;  --sp-3: 15px;  --sp-4: 20px;
  --sp-5: 30px;  --sp-6: 35px;  --sp-7: 50px;  --sp-8: 80px;  --sp-9: 100px;
  --container: 1140px;
  --measure: 800px;           /* max radlängd på brödtext */

  /* MOTION — återhållsam */
  --dur: 500ms;  --ease: ease;  --lift: -5px;
}

/* Bild: EN ratio, hårda kanter */
.media{ aspect-ratio: 9/10; object-fit: cover; border-radius: var(--r-flat); width: 100%; }

/* Knapp: exakt pill (radie = halva höjden) */
.btn{
  height: 50px; line-height: 50px; padding: 0 30px;
  border-radius: 25px;
  font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
  background: var(--c-primary); color: #fff;      /* 14:1 */
  transition: all var(--dur) var(--ease);
}

/* Eyebrow-pill */
.eyebrow{
  display: inline-block; padding: 2px 20px;
  border: 1px solid var(--c-primary); border-radius: var(--r-pill);
  font-size: 11px; line-height: 22px; font-weight: 600;
  letter-spacing: 1px; text-transform: uppercase; color: var(--c-primary);
  margin-bottom: 5px;                              /* eyebrow → rubrik = 5px */
}

/* Sektionsrytm */
.section{ padding: 100px 0; }
.section-head{ margin-bottom: 50px; }
.section-head .desc{ margin-top: 30px; max-width: var(--measure); }

/* Kort-hover: 5px lyft, inget mer */
.card:hover{ transform: translateY(var(--lift)); }
```

## Sammanfattning i en mening
Skärpan kommer inte från fonten — den kommer från **enorma typskale-steg (×2)**, **medium vikt på stor text + semibold versaler på liten**, **AAA-kontrast överallt**, **en enda hue**, **binära hörnradier (0 eller pill)**, **en gemensam bild-ratio (9:10) med raka kanter** och **återhållsam rörelse (5px/500ms)**.
Moroten uppstår när alla dessa sju är halvvägs: mellanstora steg, mellanvikt, mellankontrast, flera kulörer, 12px-radie på allt, blandade bildformat och studsig hover.
