# Premium-login — återanvändbar design ("Salongsljus split-scen")

Byggd för Corevo 2026-07-09 (v1.6.4, `app/(auth)/layout.tsx` + auth-blocket i
`app/globals.css`). Zivar: "spara en readme så jag kan lägga den till flera
andra projekt i framtiden." Detta dokument är hela receptet — koncept, exakta
värden och portnings-instruktioner. Ingen beroende-installation: allt är ren
CSS + en server-renderad layout.

## Konceptet i en mening
Split-skärm där vänster halva är en **mörk ljusscen i rörelse** (djup
skogsgrön botten, tre drivande guld-glödar, en långsamt roterande guldring,
serif-tagline) och höger halva är ett **frostat formulärkort** som glider in —
premium utan en enda bildfil, och med plats för kundens egen hero-bild när en
finns.

## Byggstenarna

| Del | Vad | Nyckelvärden |
|---|---|---|
| Scen-botten | Två lager: radial högt upp + linjär 160° | `#24493a` → `#16352a` → `#0f271f` → `#0b1e18` |
| Glöd 1 (guld) | 34rem cirkel, blur 70px, driver 26s alternate | `rgba(201,162,90,.32)` |
| Glöd 2 (salvia) | 26rem, 34s, motsatt riktning | `rgba(122,168,116,.24)` |
| Glöd 3 (ljusguld) | 16rem, 20s, mitt i scenen | `rgba(232,197,130,.16)` |
| Guldringen | conic-gradient + radial `mask` (2px kant), roterar 46s linjärt | `rgba(201,162,90,.55)` vid 12 % |
| Tagline | Serif (`--font-display`/Georgia), `clamp(2.4rem,4.2vw,3.6rem)`, rad-bruten | `#f6f2ea` på mörk botten |
| Brand-eyebrow | Versal, `letter-spacing .16em` | `rgba(232,197,130,.9)` |
| Kortet | Max 25.5rem, radius 1.15rem, dubbelskugga, frostat | `rgba(255,255,255,.86)` + `backdrop-filter: blur(10px)` |
| Entré | `translateY(14px)→0` + opacity, 0.55s | `cubic-bezier(.22,1,.36,1)` |
| Fält | Upplyft bg `#fcfbfa`, fokus = primärfärgad kant + 3px mjuk ring | `color-mix(primary 16%, transparent)` |
| Ken Burns (valfri bild) | Absolut lager, `opacity .28`, `saturate(.85)`, zoom 1→1.12 över 38s alternate | tonas IN i scenen, aldrig rå |
| Fond höger sida | Paper + två svaga radial-toningar i primärfärgen | `#faf9f7` bas |

## Rörelse-reglerna (det som gör den "premium" i stället för "rörig")
1. **Långsamt**: inget under 20 s per cykel. Rörelsen ska upptäckas, inte ses.
2. **Olika takt**: 26/34/20/46 s — inga två lager i synk, scenen "andas".
3. **Alternate**, inte loop — glödarna vandrar fram och tillbaka, hoppar aldrig.
4. **En accent**: guldet är enda färgspelet; formulärsidan är helt stilla.
5. **`prefers-reduced-motion: reduce` stänger av ALLT** (animation: none).

## Så portar du den till ett annat projekt
1. Kopiera CSS-blocket `/* ---- premium-login split-scen ---- */` +
   auth-kort-blocket ur `app/globals.css` (allt är prefixat `auth-`).
2. Kopiera markup-strukturen ur `app/(auth)/layout.tsx`:
   `main.auth-split > aside.auth-visual (aria-hidden) + section.auth-side > .auth-card`.
   Scenen är dekorativ — allt skärmläsarinnehåll bor i kortet.
3. Byt tre saker per projekt: **primärfärgen** (CSS-varn `--color-primary`,
   används i fokus-ring/brand/fond-toningar), **taglinen** och **brand-namnet**.
   Grön-/guldvärdena i scenen kan stå kvar eller mappas om till projektets
   mörka + accent.
4. Valfri bild: sätt `background-image` på `.auth-visual-photo` — lagret gör
   resten (opacity, tonläge, Ken Burns).
5. Mobil: `@media (max-width: 940px)` döljer scenen och centrerar kortet —
   ingen extra mobilvariant behövs.

## Fällor vi redan gått i (slipp dem)
- **Specificitet**: kortets frostade bakgrund sätts via `.auth-split .auth-card`
  så den inte slår centrerade kort på andra ytor som delar `.auth-card`
  (registrera/felsidor). Behåll den scopingen.
- **`backdrop-filter`** kräver att något faktiskt ligger bakom kortet —
  fond-toningarna på `.auth-main`/`.auth-side` är inte bara dekor.
- **Formuläret får aldrig animera om** vid felmeddelande — entré-animationen
  ligger på kortet (mountas en gång), inte på formbarnen.
- Serif-taglinen behöver `line-height ≤ 1.1` och negativ letter-spacing för
  att kännas satt, inte utspilld.
