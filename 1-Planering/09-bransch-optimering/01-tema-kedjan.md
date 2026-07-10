# Tema-kedjan i onboarding-studion — kartläggning + brist-bevis

> Kartlagd 2026-07-11 mot `5-Kod/apps/web` (main) + live-DB (`npx supabase db query --linked`).
> Fråga: vad händer EXAKT när operatören väljer en vendor-template-key (t.ex. `alotan-bb`) i tema-steget och trycker Lansera?

## 1. Kedjan, steg för steg

### 1.1 Katalog-laddning — `lib/platform/verticals.ts`
- `loadVerticalPresets()` (rad 66–104) läser tre tabeller parallellt: `verticals`, `modules`, `templates` (endast `status='active'`).
- Rad 96–101: aktiva templates grupperas under `tags.bransch` → `templatesByVertical: Record<string, TemplateOption[]>` där `TemplateOption = { key, name }` — **ingen flagga för "är detta ett renderbart tema eller en vendor-mall"**. Det är hela roten till bristen.
- Live-DB: templates-tabellen har 21 aktiva vendor-rader (`alotan-bb`, `baker`, `barberx-bb`, `breeze-admin`, `capiclean-ns` …) taggade `barbershop`/`restaurang`/`generell`/`nagelstudio`. Ingen av dem finns i `STOREFRONT_THEMES`.
- `verticals.default_template` i DB pekar däremot på RIKTIGA teman (barbershop→zigge, frisör→salvia, generell→edit, nagelstudio→linnea, restaurang→leander) — den delen är frisk.

### 1.2 Tema-steget — `components/platform/onboarding-studio/StudioPanels.tsx`
- `PanelTema` (rad 376–): två grenar.
  - **Flagg-PÅ-grenen** (rad 377): listar `looks` från look-registryt — men `LOOKS = []` sedan goal-51 (`lib/sajtbyggare/look-registry.ts:39`), så grenen är i praktiken död.
  - **Flagg-AV/legacy-grenen** (rad 451–452):
    ```ts
    const branschTemplates = cfg.branch ? presets.templatesByVertical[cfg.branch] : undefined
    const options = branschTemplates && branschTemplates.length > 0 ? branschTemplates : BUILTIN_TEMPLATES
    ```
    **Här brister det:** har operatören valt bransch `barbershop` visas `alotan-bb`, `barberx-bb` osv. i stället för de riktiga temana. `BUILTIN_TEMPLATES` (rad 85–92, inkl. **freshcut** — kundens fredade tema, ska inte listas) används bara som fallback när branschen saknar taggade templates.
- Klick → `dispatch({ type: 'setTheme', key: opt.key })` (rad 467) → `cfg.theme = 'alotan-bb'` rakt av (state.ts rad 80, ingen validering).

### 1.3 Preview — `components/platform/onboarding-studio/StorefrontPreview.tsx`
- Rad 69: `const theme = (cfg.theme in STOREFRONT_LAYOUTS ? cfg.theme : DEFAULT_THEME)` — vendor-key finns inte i layout-mappen → previewn visar tyst **leander**. Operatören tror hen tittar på "Alotan" men ser leander.

### 1.4 Submit — `lib/platform/onboarding-studio/state.ts`
- `buildCreateTenantFormData` rad 143: `fd.set('theme', cfg.theme)` — vendor-keyn skickas oförändrad. Kommentar rad 124 erkänner kontraktet: "one of the 5 lowercase storefront keys, else server → 'leander'".

### 1.5 Server-validering — `lib/platform/actions/tenants.ts`
- `pickTheme` (rad 42–43): `STOREFRONT_THEMES.includes(v)` annars `DEFAULT_STOREFRONT_THEME` → `theme = 'leander'` (rad 93).
- Rad 99–103: rå-värdet fångas separat — om `sajtbyggareEnabled()` (env-flaggan, `lib/sajtbyggare/flag.ts`, **AV i prod**) OCH keyn inte är ett riktigt tema → `settings.look = 'alotan-bb'`. Flagg-AV i prod ⇒ `look` skrivs ALDRIG.
- Resultat i `tenant_settings.settings` (rad 180): `{ theme: 'leander' }` — vendor-valet är borttappat utan spår (endast audit-meta rad 368 sparar ev. `look`).

### 1.6 Render — `lib/tenant-data.ts` + `app/(public)/page.tsx`
- `parseTheme` (tenant-data.ts rad 40–41, 134): okänt → `leander`.
- `settings.look` (rad 137) passas rå; `app/(public)/page.tsx:36` validerar mot look-registryt: `getLook(settings.look)` → `undefined` eftersom `LOOKS=[]` → temavägen renderar.

## 2. Bevisat brott-scenario (Lansera med `alotan-bb`)
1. Bransch = barbershop → tema-steget listar 5+ vendor-keys, INGA riktiga teman.
2. Operatören väljer "Alotan" → preview visar tyst leander (fallback rad 69).
3. Lansera → `pickTheme` koercerar → `settings.theme='leander'`; prod-flaggan AV → ingen `settings.look`.
4. Storefronten renderar **leander** — inte det operatören valde. Ingen varning, inget fel, ingen persistens av valet. Readiness-gaten (StudioPanels rad 981 `!!cfg.theme`) släpper igenom eftersom vendor-keyn är truthy.
5. Även med flaggan PÅ: `settings.look='alotan-bb'` → `getLook` missar (tomt registry) → samma leander-fallback.

Sammanfattning: **valet är en no-op med vilseledande UI** — allt degraderar tyst till leander.

## 3. Minsta fix (nu)
En rad + en listjustering, båda i UI-lagret — servern behöver inte röras (den är redan defensiv):
1. **`StudioPanels.tsx` rad 451–452:** sluta läsa `templatesByVertical` i tema-steget. Lista alltid riktiga teman:
   ```ts
   const options = BUILTIN_TEMPLATES.filter((t) => t.key !== 'freshcut')
   ```
   (freshcut = FreshCuts kundtema, fredat — ska inte erbjudas nya tenants.) Ta samtidigt bort freshcut ur `BUILTIN_TEMPLATES` (rad 91) eller filtrera som ovan; spegla i `CreateTenantForm.tsx` som har samma lista.
2. Valfritt hygien: `loadVerticalPresets` kan sluta hämta templates-tabellen till tema-steget (behålls för goal-50-galleriet), eller filtrera `templatesByVertical` mot `STOREFRONT_THEMES` — men punkt 1 räcker för att stänga bristen.
3. `verticals.default_template` i DB är redan riktiga teman — kan användas för att för-markera rätt tema per bransch (ren bonus, inte krav).

## 4. Hur vendor-templates SKA in senare (render-bron, goal-47/50)
Arkitekturen finns redan — den är bara tom:
- **Kontraktet är låst:** vendor-mall ≠ `settings.theme`. Den går via `settings.look` → `lib/sajtbyggare/look-registry.ts` → `app/(public)/page.tsx:36–46` som renderar lookens REAL HTML (`renderTemplate` + `corevo-tpl-scope` + `BookingMount`-inline). Denna räls är byggd och testad (goal-50), registryt tömdes medvetet i goal-51 (13 låg-fidelity vendor-looks revs).
- Väg framåt per mall: kör fidelity-pipelinen (verbatim copy + manifest + asset + css-scope, `lib/sajtbyggare/_optimize/`, bevisad 4.1–4.6) → registrera i `LOOKS` → mallen dyker automatiskt upp i goal-50-galleriet (`PanelTema` flagg-PÅ-grenen, rad 377) och renderas på riktigt i previewn.
- Gate: env-flaggan `SAJTBYGGARE_ENABLED` (prod AV) — slås på först när registryt har mallar som klarar fidelity-golvet. templates-tabellens 21 rader förblir katalog-metadata (namn/bransch-tagg/thumbnail), aldrig render-källa.
- Konflatera ALDRIG de tre render-vägarna (tema-CSS / look-HTML / sajtbyggar-overrides) — 18h-fällan.

## Rekommenderad byggordning
1. **Fix tema-steget** (StudioPanels rad 451–452 + freshcut-filter, spegla i CreateTenantForm) — 1 liten commit, stänger den tysta leander-degraderingen direkt.
2. **För-markera bransch-default** i tema-steget från `verticals.default_template` (redan riktiga teman i DB) — liten UX-vinst.
3. **Katalog-hygien:** filtrera/sluta mata `templatesByVertical` in i tema-steget; behåll datat för goal-50-galleriet.
4. **Senare (goal-47/50-spåret):** fidelity-porta vendor-mallar en i taget → `LOOKS`-registryt → galleri + `settings.look`-rälsen; slå på env-flaggan när första mallen klarar golvet.
