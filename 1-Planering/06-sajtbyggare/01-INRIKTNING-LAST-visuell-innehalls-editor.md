# Sajtbyggaren — LÅST inriktning: visuell innehålls-editor (INTE page-builder)

> Bekräftat av Zivar 2026-06-16 ("Ja, exakt — kör på det"). Detta **KORRIGERAR och går före** `00-DESIGN-sajtbyggare.md` på editor-scopet. S0:s render-bro gäller fortfarande; editor-MOTORVALET (GrapesJS) ska **omprövas** mot denna modell.

## Vad det ÄR
EN live-vy där Zivar (och senare salongen) **klickar direkt på elementet och ändrar det** — live, snyggt, lätt:
- Klick på **bild** → väljare → byt → syns direkt.
- Klick på **rubrik/text** → skriv om → syns direkt.
- Klick på **färg / font / logo** → ändra → syns direkt.
- **Allt på EN plats** (mall + färg + font + logo + bilder + texter) — inte utspritt på Varumärke/Texter/Bilder-flikar.
- **Fylls redan i onboardingen** → kundens sida är klar när hen skapas.
- Ändringar slår igenom **utan deploy** (runtime, som färg/font redan gör idag).

## Vad det INTE är
- **INTE en page-builder.** Inga drag-drop-block, inga egna sidor/sektioner/knappar från noll. Zivar bygger inte sidor — han **konfigurerar en färdig design**.
- Redigerbara regioner är **definierade av mallen** (hero-bild, rubriker, färger…) → kunden kan inte söndra layouten.

## Bygger på det som finns (inte från noll)
Dagens system gör REDAN ~80 %: per-tenant färg/font/logo + hero-texter + bilder + live-preview + runtime-apply. Det här lyfter det till **EN WYSIWYG-yta** (klicka-på-grejen) + **in i onboardingen** + snyggt. Plus S0:s render-bro för att kunna erbjuda fler designer än de 5 temana.

## Konsekvens för S0:s motorval (viktig, ärlig)
S0 valde **GrapesJS** — men GrapesJS ÄR en page-builder (drag-drop block). Den modellen är nu förkastad. För "klicka-på-grejen-på-en-fast-mall" räcker oftast något **lättare**: rendera mallen + klickbara hotspots på de redigerbara regionerna + inline-editor (contentEditable för text, klick-byt för bild, färg bunden till mall-slot). **Motorvalet omprövas när S2 skrivs.** S0:s RENDER-BRO (mall renderar troget med levande moduler invävda) gäller oavsett — det var aldrig bortkastat, det är keepern.

### Editor-verktyg — research-svar (2026-06-16, web-research, citerat)
**Ingen drop-in passar exakt.** Verktygen som gör precis "klicka-på-elementet-i-live-preview → redigera inline" (**Sanity Presentation**, **TinaCMS**) **kräver sin EGEN backend** (content lake / git-markdown) → fel för vår Supabase/R2-stack. De stora React-builders (**GrapesJS**, **Puck**, **Craft.js**, **Plasmic**) är **page-builders** (block/drag-drop) = fel modell.

**BESLUT (matar S2):** bygg ett **litet eget "klicka-på-elementet"-overlay** ovanpå mallen + två beprövade MIT-libs gör det tunga:
- **TipTap** (MIT, headless rich-text) för inline-text.
- **egen R2-bild-väljare** för klick-byt-bild.
- **färg / font / logo** som tokens i sidopanel (finns nästan redan).
= exakt vår modell, allt öppet, bakas in i admin utan vendor-lock eller månadskostnad. **Mindre** kod än ett tungt ramverk, inte mer. Live-preview-mönstret = **iframe + `postMessage`** (så Sanity/Builder gör det); MVP klarar sig utan iframe (rendera mallen direkt, uppdatera React-state on-change).

**Reserv:** **Puck (MIT)** går att LÅSA till edit-only (`permissions: { drag,insert,delete,duplicate = false }`) + har inline-text (v0.20) — men vill äga mall-renderingen. Välj bara om vi inte vill skriva overlayn själva.

Källor: Sanity visual-editing-overlays · Puck (MIT) permissions/feature-toggling · TipTap (MIT core) · TinaCMS contextual-editing · Builder.io visual SDK.

## Omskalade skivor (skrivs i detalj när vi når dit)
- **S1** — datamodell för redigerbart innehåll per mall (vilka regioner = redigerbara: bild/text/färg) + **override-kaskaden** (Universal→Bransch→Kund + "modifierad"-badge) inbyggd från start. EN mall görs klick-redigerbar.
- **S2** — den visuella editorn: EN live-vy, klick-på-element → inline-ändra → spara → live. Ersätter dagens utspridda formulär. (Motorval omprövas här.)
- **S3** — in i onboardingen: tema + branding + bilder + texter fylls i SAMMA editor under onboarding.
- **S4** — fler designer/mallar (galleri) via S0:s render-bro, var och en med markerade redigerbara regioner.
- **S5** — drift: bild-optimering, fler designer, polish.

## Modulerna
Modulerna (bokning osv) placeras på sina mall-definierade platser (S0-bron väver in dem). Bransch-medveten bokning (restaurang = bordsbokning) = eget modul-spår (task #14). Sajtbyggaren PLACERAR modulen; modulens djup byggs separat.
