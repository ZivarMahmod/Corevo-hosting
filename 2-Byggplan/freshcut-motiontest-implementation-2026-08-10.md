# FreshCut Motiontest — produktionsplan

**Status:** aktiv på `codex/freshcut-motiontest-production-grade`
**Mål:** Bygg och publicera en produktionskvalitativ, isolerad FreshCut-upplevelse
på `motiontest.corevo.se` utan att ändra release eller render för
`freshcut.corevo.se`.

**Aktuellt exekveringsscope 2026-08-10:** användaren har godkänt en lokal,
helt syntetisk Higgsfield-demo från text utan uppladdade FreshCut-, kund- eller
personreferenser. Den ska märkas `generated-demo` / `synthetic-text-only`, får
inte beskrivas som verklig salong, personal eller slutgodkänt kundmaterial och
får inte deployas inom detta scope.

## Verifierad releasebas 2026-08-10

- Lokal motion-HEAD: `171338b254d9aa2ecefde0d5ff9d8b772a741f49` på den
  isolerade featurebranchen.
- Lokal och remote `main`: `cdc6a6c6b6fddc89e32c10baf565d69bfeb62a7a`.
- Senaste lyckade produktionsdeploy: GitHub Actions run `31022493653`, manuellt
  `workflow_dispatch`, production-jobb, exakt SHA `cdc6a6c6`.
- `freshcut.corevo.se` svarar publikt via Cloudflare.
- `motiontest.corevo.se` saknar DNS och publik Worker tills den separata
  motiontest-releasen uttryckligen körs.
- Befintlig produktionsworkflow vägrar feature-SHA eftersom den kräver lyckad
  push-CI på exakt `main`-SHA. Motiontest får ändå en separat manuell workflow
  och får aldrig anropa `deploy-prod.mjs`.

## Arkitektur

- Next.js 15/React 19/OpenNext och befintlig FreshCut-tenantdata återanvänds.
- Middleware är enda ägare för exakt hostklassning och trusted experience-header.
- `FreshCutMotionLayout` är serverägare för semantisk DOM, data och CTA:er.
- `FreshCutMotionSceneMap` är enda ägare för åtta scener och alla intervall.
- `FreshCutMotionExperience` är enda klientägare för scen, riktning, checkpoint
  och paus.
- En enda GSAP-tidslinje med en ScrollTrigger är master clock. Den gamla
  trestegs-/rAF-kontrollern raderas vid cutover; GSAP läggs inte ovanpå den.
- `FreshCutMotionMediaController` tar endast härledda scenkommandon. Den har
  ingen egen scrollkälla eller kontinuerlig rAF-loop.
- CSS-perspektiv, masker och 2.5D används först. R3F, r3f-scroll-rig, Theatre,
  Lenis och post-processing kräver separat mätbart behov och review.

## Hårda gränser

- Ingen deploy, DNS-ändring eller produktionsdatamutation på live FreshCut.
- Motiontest använder en separat Worker `freshcut-motiontest`, exakt en Custom
  Domain, ingen cron och inga skriv-/betal-/SMS-/mailhemligheter.
- Endast publik FreshCut-läsning används. Auth, admin, API och andra routes är
  fail-closed på experimenthosten.
- Tjänster, priser och Bokadirekt-destination kommer från befintliga ägare.
  Sankt Larsgatan och dampriser är tydligt stagingproveniens tills riktig data
  finns; ingen falsk bokningslänk skapas.
- Första viewporten fungerar helt med media av: boka, tre riktiga priser, två
  salonger, tjänster och frivillig upplevelse.
- Total kontrollerad desktopresa 100–130vh, aldrig över 150vh. Mobil 80–100vh
  och grupperas till Enter, Craft, Result/Team.
- Reduced motion, data saver, mediafel och partiell JavaScript ger en komplett
  designad statisk sida.
- Ingen betald Higgsfield-transformation av verkliga eller befintliga
  FreshCut-referenser före dokumenterad källa, rättighet och AI-medgivande.
  Den uttryckligen godkända text-only-demon får genereras efter låst storyboard,
  safe zones, live kostnadsestimat och fyra oberoende förgranskningar.
- Inget färdigpåstående förrän publik deploy, inspelningar, prestandabevis och
  samtliga critic loops är gröna.

## Genomförda och godkända grunduppgifter

### Task 1 — Host- och experienceisolering

Genomförd i `3cf137a9`, `10a132be`, `f95ce337`. Exakt motiontest-host mappar
fail-closed till FreshCut, spoofade headers strippas och lokala FreshCut-assets
är enda tillåtna bildoptimeringskälla.

### Task 2 — Serverrenderad affärssida och stagingproveniens

Genomförd i `feeba682`, `e4ba9813`. Riktiga tjänster/priser och befintlig
bokningsägare återanvänds; Sankt Larsgatan och preliminära dampriser hålls i en
enda stagingresolver och kan inte bli falska `Service`-poster.

### Task 3 — Runtimeval, noindex och live-layout

Genomförd i `9884e1b1`. Endast FreshCut plus literal trusted experience väljer
motionlayouten. Vanlig FreshCut-layout, metadata och sitemap för live är
oförändrade; motiontest är `noindex/nofollow` och robots disallow.

## Återstående produktionsarbete

### Task 4 — Rebaselinera till en åttascensmodell

**Filer:**

- Create `5-Kod/apps/web/components/storefront/layouts/freshcut-motion-scenes.ts`
- Create `5-Kod/apps/web/components/storefront/layouts/freshcut-motion-scenes.test.ts`
- Modify `1-Planering/02-motiontest-freshcut/00-design.md`
- Maintain `1-Planering/02-motiontest-freshcut/01-technical-motion-map.md`

- [ ] Definiera exakt `hero`, `entrance`, `chair`, `craft`, `range`, `return`,
      `mirror`, `team` med intervallen i motion mapen.
- [ ] Testa att intervallen täcker 0–1 utan glapp/överlapp, att desktop och mobil
      ligger under scrolltaket och att varje scen har stabilt forward, reverse,
      reduced-motion och fallback-kontrakt.
- [ ] Definiera ett enda typerat manifest för kamera, lager, media, DOM,
      preload, safe zone och verifieringsstatus.

### Task 5 — Ägarcutover till GSAP och central scencontroller

**Filer:**

- Replace `FreshCutMotionJourney.tsx` with `FreshCutMotionExperience.tsx`
- Replace corresponding unit tests
- Modify `FreshCutMotionLayout.tsx`
- Modify `freshcut-motion.module.css`
- Modify `apps/web/package.json` and lockfile for GSAP only

- [ ] Skriv RED-tester för scene lookup, direct checkpoint, fokus, paus,
      reduced motion, data saver, cleanup och att ingen gammal manuell scroll/rAF-
      ägare återstår.
- [ ] Installera GSAP från officiell npm-källa och registrera ScrollTrigger
      explicit så produktionsträdskakning inte tar bort pluginen.
- [ ] Skapa en enda timeline/ScrollTrigger. CSS sticky får bära layouten, men
      alla primära kameravärden, masker och scenövergångar kommer från tidslinjen.
- [ ] Radera gamla `FreshCutMotionJourney`, gamla checkpointintervall och deras
      tester/CSS i samma commit.
- [ ] Behåll affärs-UI som serverrenderade children. Flytta samma populärtjänst-
      och salongspanel från hero till spegel; skapa ingen motiondubblett.

### Task 6 — Dedikerad media controller och reproducerbar pipeline

**Filer:**

- Create `FreshCutMotionMediaController.ts`
- Create media-controller tests
- Create versioned media manifest
- Create `5-Kod/apps/web/scripts/prepare-freshcut-motion-media.mjs`
- Create script tests
- Create controlled artefact directories under `4-Dokument-Underlag/` and
  `6-Testing/` without committing private/raw references

- [ ] Hantera poster, preload, decode, timeout, play/pause, forward-only action,
      stable start/end, mobile source, reduced motion och failure.
- [ ] Använd `requestVideoFrameCallback` endast för ett bevisat framesynkbehov;
      alltid fallback och aldrig en konkurrerande huvudloop.
- [ ] FFmpeg-script tar bort ljud, trimmar, normaliserar fps, skapar holds,
      färgmatchar, kodar MP4/WebM, skapar posters och verifierar dimensioner,
      duration, bitrate, keyframes och filintegritet.
- [ ] Filnamn är innehållshashade/versionerade. Rå Higgsfield-output publiceras
      aldrig direkt.

### Task 7 — Bygg den sammanhängande åttascenskompositionen

- [ ] Hero fungerar som kampanjposter med all affärsnytta innan media.
- [ ] Entrance, Chair och Craft delar samma miljö och använder masker/
      foreground för att dölja skarvar, inte rektangulära videor.
- [ ] Range använder separata korrekta motiv och riktig DOM-tjänstedata.
- [ ] Return återför samma huvudkund innan Mirror.
- [ ] Mirror är komposit med boknings-UI bredvid/under, aldrig genererad text,
      genererad fysisk reflektion eller glaspanel ovanpå frisyren.
- [ ] Team/About kommer genom en motiverad pan vid sidan av spegeln och
      cinematic rendering pausas när vanlig sida tar över.
- [ ] Mobil är en avsiktlig Enter→Craft→Result/Team-regi utan intern scrollruta.

### Task 8 — Syntetisk Higgsfield-demo; verklig slutmedia efter referensgrind

**Låst syntetisk v2-råplan:** fjorton 2K-stills skapar S0/K0,
CUSTOMER_REF, BARBER_REF, K1A, K1B, K2, K3, K4, fem separata Range-motiv
och T0. Fyra femsekundersklipp är A entrance, B chair, C en enda craft-
detalj och D mirror-only. Hero, Range, Return och Team får deterministiska
responsiva posterfamiljer från godkända stills; Range kompositeras av R1–R5,
Team får en lokal CSS/GSAP-pan och Return återanvänder exakt Crafts poster-URL:er
utan ny hämtning eller videokälla. B- och C-drafts granskas först;
A/D och alla 1080p-finaler förblir spärrade tills föregående grind är grön.
Normalvägen är live-estimerad till 258 av 909,5 krediter.

- [ ] Ladda inte upp eller transformera befintliga FreshCut-, kund-, sociala
      medier- eller fallbackbilder. Syntetiska ankarramar skapas från text och
      återanvänds endast som internt genererade kontinuitetsreferenser.
- [ ] Lås syntetisk salong, syntetisk barberare/kund, sekventiella keyframes,
      storyboard, crop och UI-safe zones.
- [ ] Kör fyra oberoende pre-generation reviews.
- [ ] Kontrollera aktuellt workspace/balans/modell och estimera före varje jobb.
- [ ] Börja med en Mini-kandidat per validerad action-shot. Generera final i
      1080p först när draftens komposition, fysik och crops har godkänts.
- [ ] Generera aldrig batch eller omtag om ett dokumenterat visuellt fel inte
      kräver en ny kandidat.
- [ ] För kreditbok och accepted/rejected-logg; stoppa före 65 % totalbudget.
- [ ] Frame-QC av händer, verktyg, hår, kundidentitet, stol, ljus och skarvar.
- [ ] Publicera endast hashade/versionerade FFmpeg-derivat och märk varje
      integrerad familj `generated-demo` / `synthetic-text-only`.

**Sanningsgrind:** den lokala syntetiska demon kan slutföras utan verkliga
referenser, men den är inte verklig FreshCut-slutmedia. Cutover till
`approved-final` för en verklig salong/kund förblir blockerad tills godkända
salong-/kundreferenser och rätt att AI-transformera dem har lämnats.

### Task 9 — Isolerad Cloudflare- och GitHub-releaseväg

**Filer:**

- Modify canonical reserved-host parity files
- Add a new migration for the current DB fallback denylist; do not rewrite history
- Add Wrangler env `motiontest` with Worker `freshcut-motiontest`
- Add fail-closed `deploy-motiontest.mjs` and tests
- Add manual `.github/workflows/deploy-motiontest.yml`

- [ ] Exakt route `motiontest.corevo.se`, `workers_dev:false`, tom cron,
      ASSETS-binding och godkända publika vars; inga R2/queue/KV/DO eller privilegier.
- [ ] Scriptet vägrar extra route, fel Worker, produktionens deployscripts,
      okänd flagga eller saknad build. Dry-run och riktig deploy använder argument-
      arrayer utan shell.
- [ ] Workflown är manual only, använder motiontest-worker och public read-only
      FreshCut-config, kör tester/build/dry-run före deploy och kör inga migrationer.
- [ ] Produktionsworkflowen lämnas oförändrad. Den avsiktliga enda
      production-/staging-avvikelsen utanför nya `env.motiontest` är att den
      icke-routbara säkerhetslabeln `motiontest` läggs till i
      `NEXT_PUBLIC_RESERVED_SUBDOMAINS`; inga befintliga Worker-routes,
      entrypoints eller bindings ändras.

**Aktuell verifieringsgräns:** detta är verifierat i lokala kontrakt och en
semantisk konfigurationsdiff. Motiontest är inte byggd eller deployad live, och
ingen Worker-version eller fjärrmiljö påstås vara verifierad före den separata
releasegrinden.

### Task 10 — Kontinuerlig verifierings- och critic loop

Varje loop kör:

1. fokuserade unit-/integrationstester;
2. `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` från `5-Kod/`;
3. Playwright i Chromium, Firefox och WebKit;
4. 320/360/375/390/412/430/768/1024/1440, Android, iPhone, reduced motion,
   slow network, mediefel, WebGL-avstängd regressionssentinel och 200 % zoom;
5. checkpointbilder, komplett desktop-/mobilinspelning, console/network och
   prestanda-/minnesmätning;
6. fyra oberoende kritiker: motion, conversion, frontendarkitektur,
   prestanda/tillgänglighet;
7. test-först-fix av rotorsak och omkörning.

Exit kräver noll critical/major, inga boknings-/mobil-/a11y-/prestandablockers,
inga omärkta placeholders eller falsk slutmedia, inga synliga videogränser,
inga console errors och ingen
generisk template-känsla.

### Task 11 — Push, isolerad deploy och offentlig slutkontroll

- [ ] Dokumentera förebevis: Git-SHA/deployment för live FreshCut, HTTP-identitet
      och bokningsdestination.
- [ ] Pusha endast featurebranchen och kör endast motiontest-workflown.
- [ ] Verifiera publik motiontest-identitet, noindex, riktiga priser, sanningsenlig
      andra salong, bokning, alla scener, mobil, fallback, console och performance.
- [ ] Dokumentera efterbevis att `freshcut.corevo.se` fortfarande kör samma
      deployment och beteende.
- [ ] Begär aldrig cutover till FreshCut live utan ett separat uttryckligt beslut.

## Slutregel

Build är inte klart. Deploy är inte klart. En snygg hero är inte klart.
Arbetet är klart först när hela resan, data, bokning, mobil, tillgänglighet,
prestanda, media, critics och isolerad offentlig drift är verifierade med bevis.
