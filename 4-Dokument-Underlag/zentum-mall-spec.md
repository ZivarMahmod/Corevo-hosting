# Zentum-mallen — sida-spec (pixel-exakt kopia av zentum.se startsida)

**Datum:** 2026-07-12
**Syfte:** Byggunderlag för ny mall i NY kategori **ekonomi** (redovisningsbyrå). Detta dokument = LAG för bygget.
**Källa:** zentum.se hämtad via curl 2026-07-12. HTML + hela CSS-kedjan (31 filer) ligger i scratchpad `zentum/` (index.html, css/, sr7-hero-settings.js). Kompletterar `design-skarpa-zentum.md` (tokens/regler — läs den FÖRST).

**⚠️ Innehålls-gräns (upphovsrätt):** Designen kopieras EXAKT (mått, färger, typografi, layout, motion, laddningsbeteende). Men Zentums EGNA foton, logotyp/varumärke, kunders riktiga citat/namn och brödtext-stycken får inte skeppas i vårt bibliotek — de ersätts med: stock-foton i EXAKT samma beskärning (9:10, 900×1000), egen ekonomi-copy i samma struktur/längd via bransch-lagret, platshållar-testimonials, generiska partner-logotyper. Generiska branschtermer (tjänstenamn, navetiketter) behålls — de är generiska facktermer, inte skyddad text.

---

## Stack som ska efterliknas (beteende, inte teknik)
WordPress + Elementor + tema `cleanfin` + Slider Revolution 7 + GSAP (ScrollTrigger, SplitText). Vi bygger React/CSS-modules enligt mall-anatomin i repot — men BETEENDET kopieras: split-line rubrik-reveal, hero-slider med lagerintro, sticky header-växling, scroll-progress-knapp, counter-uppräkning, magnetiska knappar AV (cursor disabled: body har `pbmit-cursor-disable`).

## Fonter (exakt som live RENDERAR)
- **Hero:** Wix Madefor Display (500, 600) + DM Sans (400) — laddas på riktigt (Google Fonts).
- **Intro-statement:** Merriweather (400) — laddas på riktigt.
- **Allt annat:** deklareras `Inter, sans-serif` men Inter laddas ALDRIG på live-sajten → renderar i systemets sans (Arial/Helvetica). EXAKT kopia = samma: deklarera stacken, ladda inte Inter. (Medveten trohet mot livesajtens faktiska rendering.)

## Färger (8 hex, allt i design-skarpa-zentum.md §6/§10)
`#212c40` global navy · `#111926` blackish · `#0c3c60` hero-navy · `#f2f4f8` ljus yta · `#fff` · `#a5cbe3` accent · `#666` brödtext · `#9da5b5` dämpad. Container 1140px. Radie binär: 0 eller pill.

---

## HEADER (cleanfin header-style-4 — overlay, transparent över hero)
- `position:absolute; width:100%; z-index:999` över heron. Bottenlinje `1px solid rgba(255,255,255,.2)`.
- Container: full bredd, `margin: 0 60px` (≤1600px: 50px). Höjd ~90px.
- Vänster: logga (vit SVG-variant på overlay).
- Nav: menyobjekt `margin: 0 35px` (≤1600px: 30px), vit text, 500-vikt, ~13px versaler.
  Meny: Start · Våra tjänster (dropdown: 6 tjänster) · Om oss · Kontakt. Dropdown: vit ruta, radie 0.
- Höger: sök-ikon · CTA-knapp **outline-pill**: `background:transparent; color:#fff; border:2px solid #fff; padding:12px 25px; radie pill; 12px/600/VERSALER/LS 1px` + pil-SVG `margin-left:8px`. Hover: vit bg + blackish text (hård växling).
- **Sticky:** efter scroll fälls en sticky-variant ner: vit bg, mörk logga, CTA-outline byter till `2px solid #212c40`, text `#212c40`; hover inverterar till navy bg + vit text.
- Mobil: burger-ikon (`pbmit-burger-menu-wrapper`), off-canvas meny.

## HERO (Slider Revolution-beteende, 2 slides)
- Modulstorlek: bredd-steg `[1524,1524,1024,778,480]`, höjd `[950,950,800,700,550]` (desktop 950px hög).
- Slide-bg: panoramafoto (ratio ~2.02) + gradient-overlay EXAKT `linear-gradient(270deg, rgba(44,56,63,.77) 0%, rgba(33,44,64,0) 100%)` (horisontellt) som eget lager. OBS: källbildens mörka TOPPBAND ligger bakat i själva fotot (ger vita headern kontrast) — vid foto-ersättning återskapas bandet som separat bild-lager, inte i gradient-lagret. EN innehålls-slide ("slide 2" i rå-DOM = SR7:s tomma Global Layers-container, ingen växling).
- Lager per slide (positioner/timing i `sr7-hero-settings.js`):
  1. **Eyebrow-pill**: "Välkommen till [namn]" — 13px/24px/500/LS 2px/vit, pill-ram.
  2. **H1**: "Ditt ekonomiska verktyg" — Wix Madefor Display **110px/120px/500**, färg `#0c3c60`, nedskalning 110/80/70/50.
  3. **Brödtext**: "Vi skapar lösningar som hjälper dig driva ditt bolag framåt." — DM Sans 17px/24px/400 vit.
  4. **CTA**: "Kontakta oss" + pil-SVG — pill `#212c40` bg, vit text, `line-height:50px; padding:0 30px; radie 25px; 12px/600/LS 1px/VERSALER`.
- Lagerintro: sekventiell in-animation (eyebrow → H1 → text → CTA), mjuk y-translate+fade, exakta frames i sr7-filen.
- OBS: texterna ovan är generisk säljfras-nivå och behålls som default-copy i bransch-lagret ("[namn]" = tenantens namn).

## SEKTION 1 — Intro-statement (`fe2b232`)
- `padding: 80px 30px 0`.
- Centrerad enda rad/stycke, **Merriweather, 26px, normal**, färg `#212c40`.
- Copy-intent (skriv egen, samma längd ~160 tecken): "modern byrå + smart teknik + personlig rådgivning → förenkla/effektivisera/stärka företagandet".

## SEKTION 2 — Våra tjänster (`3dc8b8cc`, col-stretched-RIGHT)
- `padding: 50px 0 100px` (1366: 100/70 · 1024: 80/50 · 767: 60/30).
- Heading-block vänsterställt: H2 "Våra tjänster" 54px/60px/500 `#212c40`; beskrivning 30px under, max-width 800px, 18px/28px `#666`.
- **6 service-kort, 3 kolumner** (`service-style-2`), kolumnpadding 12px:
  - Kortbild **900×1000 (9:10), radie 0**, `width:100%`.
  - Titel 28px/34px/600 `#212c40`, 30px över bilden→texten.
  - Hover: `translateY(-5px)`, `transition: all 500ms ease`. Inget mer.
  - Tjänster (generiska facktermer, behålls): **Bokföring · Bokslut & årsredovisning · Rådgivning & skatteplanering · Deklarationer (INK1, INK2) · Interimslösningar · Projekt & punktinsatser**.
- Rubrik-reveal: split-line med `cubic-bezier(.22,.61,.36,1)`.

## SEKTION 3 — "Din trygga partner" (`6e7def0d`, full-bleed split, NAVY bg)
- Sektion `padding: 0`, bg **globalcolor `#212c40`**, col-stretched-LEFT.
- **Vänsterkolumn:** bakgrundsFOTO `center/cover` (kontor/arbetsmiljö; ersätts med stock i samma stil), fyller kolumnen (1024: `padding: 230px 0`; 767: `150px 0`).
- **Högerkolumn:** `padding: 110px 0 110px 110px` (1366: 80/30/80/40 · 1024: 60/30/80/30 · 767: 40/30/60/30), inre textblock `padding-left: 145px` (1366: 0).
  - H2 tvåradig: "Din trygga partner inom / redovisning och bokföring." — 54px/60px/500 **vit** på navy.
  - Lead 18px/28px/400, vit/dämpad, `margin-top` enligt blockrytm (rubrik→text 30px).
  - Spacer 50px.
  - **2 st icon-headings** (`ihbox-style-2`), margin-top 60px resp 50px (1366: 40px):
    - Ikon 90px (tema-ikonfont: bok resp. investering — ersätt med likvärdig SVG, margin-right 35px) + titel **24px/30px/600** (rå ihbox-CSS; tidigare 28px här var fel) + kort rad (padding-top 10px, vit .7).
    - a) "Löpande bokföring" — "Vi hanterar din bokföring effektivt, med moderna digitala verktyg."
    - b) "Rådgivning" — "Oavsett fas är du välkommen att ställa frågor och få råd."
  - Knapp-topp i ihbox: 35px.

## SEKTION 4 — Referenser (`689d6ebc`, stretched, VIT bg)
- `padding: 100px 0` (1366: 100/450!, 1024: 80/330 — stora bottenvärden pga överlappande carousel på mindre skärm).
- **Layout: rubrikblock i VÄNSTER kolumn (col-lg-3, 25 %), slidern i HÖGER (col-lg-9, 75 %), vänsterställd text** — inte centrerad.
- Eyebrow "Referenser" (h4: 11px/22px/600/LS 1px/VERSALER) + H2 "Så säger våra kunder".
- **Testimonial-slider style-2, autoplay 4000ms** (rå `data-autoplayspeed`): stort citat (18px/1.7), författar-rad = rund kund-logga **80×80 med margin-right 15px** bredvid namn **18px/24px/600** + företag (dämpad). (Tidigare "namn 28px, logga 150×150" här var fel — rå-CSS:en gäller.) 2 platshållar-testimonials (EJ källsajtens riktiga kunder/citat).
- Kolumnpadding 12px (`776edc8d`), 1366: 30px.

## SEKTION 5 — Partner-logotyper (`dc5e4bd`)
- `margin: 50px 0`. Logo-carousel, **4 synliga slides** (swiper), grå/stillsamma logotyper 150×150 (Fortnox/Bokio/Capego-platshållare = generiska "integrations-partner"-brickor med text, EJ deras riktiga märken om ej licens).

## FOOTER (blackish `#111926`)
- Stor yta med kolumner:
  - **Kontakta oss**: e-post (tenantens).
  - **Org. nummer**: nr + "Innehar F-skattsedel".
  - **Våra tjänster**: 6 länkar med FOOTERNS egna etiketter (live avviker från korten: "Skatteplanering & rådgivning" + "Deklarationer" — kopiera footerlistan, inte kortlistan).
- Rubriker vita (h2-stil i footer ~20px/600), text `#9da5b5`.
- Bottenrad: "Copyright © [år] [namn]." + Integritetspolicy-länk.

## GLOBALA BETEENDEN ("allt som händer på sidan")
1. **Rubrik-reveal:** varje H2 splittas i rader; raderna glider upp med `cubic-bezier(.22,.61,.36,1)` när de scrollas in (SplitText/ScrollTrigger-beteende).
2. **Hero-lagerintro** i sekvens vid load (se sr7-filen för frames).
3. **Sticky header** fälls ner med transition efter att overlay-headern scrollats förbi.
4. **Scroll-progress-knapp** (`pbmit-progress-wrap`): rund tillbaka-till-toppen-knapp nere till höger med SVG-cirkel som fylls med scrollprogress.
5. **Hover:** kort/ikoner `translateY(-5px)/500ms ease`; knappar hård färgväxling (ingen opacitet).
6. **Lazy images** + `font-display: swap`.
7. Undersidor: title-bar med `padding-top: 140px` (headern är overlay).
8. INGEN custom cursor (live: `pbmit-cursor-disable`), ingen parallax, inget fade-in-överallt.

## Brytpunkter
1600 → container-marginal 50px · 1366 → sektionspadding 100/70 · 1200 → mobilheader/burger · 1024 → 80/50, hero 800px · 767 → 60/30, hero 700→550px, 1 kolumn.

## Acceptans
- Mekaniskt 0 FAIL: render-test enligt mallsvitens mönster + probe på: tokens (8 hex exakt), typskala (110/54/28/18/16/11), radie-binär (0/pill), bild-ratio 9:10, sektionspaddings, hover-transform, sticky-header-klass, progress-knapp.
- Oberoende verify — byggaren rättar inte sin egen läxa.
