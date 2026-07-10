# Template-arkitektur — hur de 5 modulära temana är byggda + recept för nya

> Underlag för bransch-optimering (09). Beskriver salvia/leander/zigge/linnea/edit
> som de faktiskt är byggda i `5-Kod/apps/web`, och receptet för att massproducera
> nya teman via en agent-loop. **freshcut = kundens tema — röres aldrig.**

## 1. Arkitekturen i ett svep

Ett "tema" är summan av TRE saker, alla nycklade på samma temasträng:

1. **Tokens** — ett `[data-world="storefront"][data-theme="<key>"]`-block i
   `packages/ui/tokens.css` (salvia rad 190, leander 205, zigge 220, linnea 235,
   edit 250, freshcut 266). ~10 CSS-variabler: `--color-primary/-d`, `--color-bg`,
   `--color-surface`, `--color-fg/-fg-2`, `--color-line`, `--color-accent-soft`,
   `--font-display`, `--font-body`, `--sf-radius`.
2. **Layout** — en React-komponent i
   `apps/web/components/storefront/layouts/<Namn>Layout.tsx`
   (Salvia 237 rader, Leander 83, Zigge 79, Linnea 87, Edit 98), registrerad i
   `layouts/index.ts` → `STOREFRONT_LAYOUTS: Record<StorefrontTheme, ComponentType<StorefrontLayoutProps>>`.
3. **Innehålls-defaults** — en post per tema i `THEME_CONTENT` i
   `apps/web/components/storefront/theme-content.ts` (444 rader): hero-copy,
   eyebrows, sektionsrubriker, italic-quote, stats, team-fallbacks samt
   Unsplash-fotomanifest (`IMG`-konstanten, rad ~62).

Temat väljs per tenant i `settings.theme`, valideras av `parseTheme()`
(`apps/web/lib/tenant-data.ts:40`) mot listan
`STOREFRONT_THEMES = ['salvia','leander','zigge','linnea','edit','freshcut']`
(`lib/tenant-data.ts:34`).

## 2. Hur renderingen hänger ihop

**Publika storefronten** (`app/(public)/page.tsx`):
- rad 62: `const Layout = STOREFRONT_LAYOUTS[settings.theme]` — total lookup,
  ingen runtime-fallback behövs (parseTheme garanterar giltig nyckel).
- rad 89: `resolveThemeContent(settings.theme, branding, copy)` — precedens:
  ägar-uppladdningar (`settings.branding.hero_images/gallery_images/...`) och
  ägar-copy (`settings.copy`) vinner per fält; temats default fyller resten.
  Salvia har dessutom slot-lagret (content_slots > tenant_settings > theme, rad 68-76).

**Roten som aktiverar tokens** sätts i `app/(public)/layout.tsx:140`:
`data-world="storefront"` + `data-theme={settings.theme}` + inline
`injectTenantTokens(settings.branding)` (från `packages/ui/index.ts`) — inline
per-tenant-branding vinner alltid över temats bas (dokumenterat i tokens.css rad 145).
Samma attribut-trio sätts även av `app/boka/layout.tsx:37`,
`app/butik/layout.tsx:35`, `app/avboka/[id]/page.tsx:57` och
`app/(kund)/konto/layout.tsx` — bokningsflöde/butik/konto ärver alltså temat gratis.

**Chrome** (Nav/Footer) är EN komponent (`components/brand/Nav.tsx`,
`Footer.tsx`) vars layout flexar rent på `[data-theme]` i `brand.module.css` —
ingen theme-prop, temat styr via CSS.

**Typroller** är tema-agnostiska klasser (`.sf-eyebrow/.sf-hero/.sf-h1/.sf-h2/
.sf-lede/.sf-body/.sf-italic`, tokens.css rad ~278) som drar familj/vikt från
temats variabler. Undantag med per-tema override: zigge (Bebas kräver egen
sizing-rytm, tokens.css rad 290-292).

## 3. Vad gör dem MODULÄRA (ej bransch-låsta)

- **Modulsektionerna är delade och gate-ade per tenant, inte per tema.**
  `components/storefront/StorefrontModuleSections.tsx` (42 rader) monteras
  EFTER varje temas egna sektioner (`(public)/page.tsx` rad ~93-100) och
  renderar ShopSection/OffertSection/BloggSection/LojalitetSection/
  PresentkortSection utifrån `getTenantModuleStates()` — live = renderas,
  paused = read-only, draft/off = osynlig. "Lägg modul → vävs in i vald mall"
  gäller alltså ALLA teman automatiskt; ett nytt tema får alla moduler gratis.
- **Layouterna konsumerar bara `StorefrontLayoutProps`**
  (`layouts/types.ts`): tenant, theme, content (resolvad copy/media),
  services (riktiga tjänster), location. Ingen layout vet vilken bransch den är —
  branschton bor i THEME_CONTENT-copyn + `tags.bransch` i DB.
- **Terminologi** är vertical-styrd (t.ex. `resolveStaffNoun(tenant.vertical_id)`
  i preview-shell), inte tema-styrd.
- **Booking-CTA** (`Bookable`, `BookCta`) är delade komponenter; wizard-tjänster
  gate-as på booking-modulens state, samma i alla teman.

Det som SKILJER temana är enbart: tokens (palett/typografi/radius) +
layoutens kompositionsform (Leander = centrerad prislista med dot-leaders +
quote-band, INGEN team/galleri; Salvia = full sida med team/galleri/om;
Zigge = mörk Bebas-poster; osv) + copy-röst i THEME_CONTENT.

## 4. Registreringsytor (allt som pekar på temanyckeln)

| Yta | Fil:rad |
|---|---|
| Kanonisk lista + typ | `lib/tenant-data.ts:34-41` (`STOREFRONT_THEMES`, `parseTheme`) |
| Tokens-block | `packages/ui/tokens.css:190-266` (+ ev. typ-overrides ~290) |
| Layout-registret | `components/storefront/layouts/index.ts` (`STOREFRONT_LAYOUTS`) |
| Copy/media-defaults | `components/storefront/theme-content.ts` (`THEME_CONTENT`) |
| Kund-admin temaväljare | `app/(admin)/admin/sida/page.tsx:8,57` |
| Super-admin kundkort | `app/(platform)/salonger/[id]/page.tsx:24,119` |
| Tema-byte action | `lib/platform/actions/theme.ts:23` + `lib/platform/actions/tenants.ts:43,101` |
| Preview (iframe) | `app/salong-preview/[slug]/preview-shell.tsx:37,94` (`resolvePreviewTheme`, `?theme=`-param, samma bundle/moduler som live) |
| Slot-skrivningar (validering) | `lib/platform/preview-admin.ts:45,236,341` |
| DB: templates-tabellen | `supabase/migrations/0026_multibranch_core.sql:82` (schema); seed-mönster i `0028_multibranch_seed_backfill.sql:76` (salvia); 21 vendor-rader i `0041_template_catalog_import.sql` |
| DB: verticals→wizard | `lib/platform/verticals.ts:78` — läser `templates` med `status='active'`, grupperar på `tags.bransch` → wizardens mallval per bransch |

**OBS konflatera ej:** templates-tabellens 21 vendor-rader (0041) är
katalog-metadata/render-bron-spår — INTE renderbara React-teman. Renderbart =
finns i `STOREFRONT_THEMES` + `STOREFRONT_LAYOUTS`. Salvia är enda temat som
även har template_slots (migration `0040_salvia_slots_canonical.sql`).

## 5. RECEPTET — bygga ETT nytt tema (agent-loop-körbart)

Steg för nytt tema `<key>` (t.ex. `bruno`), i ordning:

1. **Tokens**: lägg ett `[data-world="storefront"][data-theme="<key>"]`-block i
   `packages/ui/tokens.css` efter `edit`-blocket (rad ~264). Exakt de 11
   variablerna som salvia-blocket. Ny display-font? Lägg Google-Fonts-laddning
   som befintliga (jfr freshcuts `next/font`-variabler i `app/layout.tsx:30` —
   men de 5 modulära temana använder CSS-fallback-stackar, enklast är samma).
2. **Nyckel**: lägg `<key>` i `STOREFRONT_THEMES` (`lib/tenant-data.ts:34`).
   TypeScript tvingar därefter fram punkt 3+4 (Record-typerna blir annars röda) —
   detta är kompilatorns checklista.
3. **Layout**: skapa `components/storefront/layouts/<Key>Layout.tsx` (~80-100
   rader räcker; kopiera närmaste kompositionsgranne, t.ex. Leander för centrerat
   / Zigge för mörkt-bold). Bygg av delade byggstenar: `HeroCarousel`, `Reveal`,
   `Bookable`, `BookCta`, `Gallery`, `ServiceMenu`, `Parallax`, klasser ur
   `storefront.module.css` + typroller `sf-*`. Registrera i `layouts/index.ts`.
4. **Copy/media**: lägg `<key>`-posten i `THEME_CONTENT`
   (`theme-content.ts`) — alla fält, branschanpassad röst, återanvänd/utöka
   `IMG`-manifestet. Ingen fejk-data bunden till riktigt namn (regel i filhuvudet).
5. **Ev. typ-override**: condensed/allcaps-font → egen `.sf-hero`-sizing som
   zigge (tokens.css rad 290).
6. **DB-registrering**: ny migration som upsertar `templates`-raden enligt
   0028-mönstret:
   `insert into public.templates (key,name,tags,tokens,sections,status) values ('<key>','<Namn>','{"bransch":"<vertical>","typ":"storefront","stil":"<stil>","scope":"booking"}', '{}','[]','active') on conflict (key) do update ...`
   → temat dyker då upp i onboarding-wizardens branschgrupp
   (`lib/platform/verticals.ts` grupperar på `tags.bransch`). Vill man göra det
   till branschens default: uppdatera `verticals.default_template`.
7. **Preview**: gratis — `salong-preview/[slug]?theme=<key>` funkar direkt när
   nyckeln finns i `STOREFRONT_THEMES` (preview-shell.tsx:37 validerar mot listan).
8. **Verify (0 FAIL, aldrig ögonmått)**: `next build` grönt; curl storefront med
   tenant satt till temat → grep `data-theme="<key>"`, hero-`<h1>` ur
   THEME_CONTENT, `<title>` (jfr storefront-verify-≠-body-grep-regeln);
   preview-URL med `?theme=<key>` renderar 200 + rätt attribut.

**Rör ALDRIG:** freshcut-blocket i tokens.css, `FreshCutLayout.tsx`,
freshcut-posten i THEME_CONTENT, freshcut-tenantens settings.

### Agent-loop (jfr goal-36-harnessen)
`lib/sajtbyggare/_optimize/` (proof-kit.ts) + fidelity-mönstret från
sajtbyggare-piloten är rätt förlaga: per tema en isolerad run med (a) koncept-spec
(namn/palett/fonter/kompositionsform/bransch-tagg) som input, (b) steg 1-7
mekaniskt, (c) verify-gate steg 8 av OBEROENDE pass, (d) commit per tema.
Skillnad mot goal-36: här byggs NATIVA teman (React-layout + tokens), inte
manifest/HTML-mallar — ingen codemod behövs, TypeScript-Record-felen ÄR trackern.
Batchstorlek 1 tema per commit; varje tema är ~4 filer + 1 migration.

## 6. Föreslagen första batch — 8 tema-koncept

| Nyckel | Namn | Vibe | Primär bransch (`tags.bransch`) | Kompositionsgranne |
|---|---|---|---|---|
| `klara` | Klinik Klara | kliniskt vit, ljusblå accent, Inter/IBM Plex, mycket whitespace, trust-badges | klinik/hälsa (ny vertical-tagg) | Edit |
| `terra` | Terra | jordnära olivgrön/sten, grov serif, stora foton | nagelstudio / spa | Linnea |
| `noir` | Noir | svart/guld, hög kontrast, condensed caps, poster-hero | barbershop | Zigge |
| `pärla` | Pärla | rosé/pärlemor, mjuk rundning, lekfull skript-display | nagelstudio | Leander |
| `smak` | Smak | varm rödbrun/kräm, meny-först-komposition (prislista=meny), foto-band | restaurang | Leander (prisgrid → meny) |
| `verk` | Verkstad | industrigrå/signalorange, monospace-accent, rakt på sak, offert-CTA framlyft | generell/hantverk (offert-modulen) | Zigge (ljus variant) |
| `bris` | Bris | havsblå/sand, luftig, breda foton, sommarkänsla | frisör/salong kust-profil | Salvia |
| `atelje` | Ateljé | gallerivit, near-black, extrem typografi-fokus, galleri-modulen framlyft | generell/kreatör | Edit |

Varje koncept = unik token-palett + egen kompositionsform (minst ett strukturellt
grepp som skiljer, inte bara färg — jfr "Leanders restraint är formen").

## Rekommenderad byggordning

1. **Harness först** (0,5 dag): skriv en `verify-theme.mjs` (curl+grep enligt steg 8)
   + en koncept-spec-mall — så varje tema-run har mekanisk 0-FAIL-gate.
2. **Pilottema `noir`** (barbershop, närmast befintlig Zigge-form) — hela receptet
   steg 1-8 end-to-end, en commit; kalibrera receptet mot verkligheten.
3. **`terra` + `pärla`** — testar receptet på ny bransch (nagelstudio) inkl.
   vertical-koppling (`verticals.default_template`) i wizarden.
4. **`smak`** — första temat med strukturell avvikelse (prisgrid→meny); bevisar
   att layout-friheten håller utan att röra delade komponenter.
5. **`klara` + `verk`** — nya branschtaggar (klinik, hantverk) + modul-framlyft
   (offert) → validerar att StorefrontModuleSections-modellen räcker eller om
   layouten behöver kunna PLACERA en modulsektion mitt i sig (troligt fynd; ta
   beslutet här, inte tidigare).
6. **`bris` + `atelje`** — ren volymproduktion, receptet ska nu vara ~1 tema/run.
7. **Efter batchen**: uppdatera onboarding-wizardens branschgruppering +
   super-admin-temaväljaren är automatiska (läser listan/tabellen) — verifiera
   bara att alla 8 syns per bransch; deploy först på Zivars "deploy" (lokalt-först-fasen).
