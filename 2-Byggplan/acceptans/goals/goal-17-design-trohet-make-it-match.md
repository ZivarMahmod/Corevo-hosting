# BRIEF-UI-017: Design-trohet "make-it-match" — designen blir LAG över alla ytor
Thinking: 🔴 Think hard (körs som WORKFLOW-04, STOR agent-flotta — se §Exekvering)

## Mål
Tvinga implementationen att bli en **ren, exakt kopia** av designen — inte bara dess färger, utan dess **komposition, signatur-komponenter, varje knapp och interaktions-finish**. Idag improviserar Code → ~62% likhet, `/konto` 22%. Denna goal gör design-paketet i **roten av `2-Byggplan/`** till lag, med en **bindande spärr**: ingen sida är "klar" förrän den är identisk med mocken (screenshot sida-vid-sida + checklista). Ordning: **back-office först** (super/salong/personal) → `/konto` → storefront. Knappar/komponenter som finns i designen men inte i koden **byggs**.

## ⭐ LAGEN (läs detta FÖRST — det är hela poängen)
**Filerna LÖST I ROTEN av `2-Byggplan/` = VERKLIGHETENS GUD.** Det är det senaste, maxade paketet Zivar la dit — **utplattat direkt i roten** (ingen `design_handoff_backoffice/`-wrapper längre; `tokens.json`, `backoffice-spec.json`, `data-model.json`, `colors_and_type.css`, `components/`, `css/`, `backoffice-pages/`, `handoff-assets/`, `ui_kits/`, `preview/`, `Corevo Back-office.html`, `Corevo-salongsdemo.html` ligger ALLA löst i `2-Byggplan/`). Det är den senaste, mest uppdaterade sanningen som ska finnas i verkligheten.

> ⛔ **`2-Byggplan/corevo-booking-design-system v3/` är OLD — IGNORERA den.** (Zivar kunde bara inte radera mappen.) Likaså allt under `2-Byggplan/Tillfällig map struktur/`. Läs ENDAST root-paketet.

Koden ska bli en **exakt kopia** av root-paketet — INTE "inspirerad av", INTE Code:s egna idéer, INTE "ungefär liknande". Kolla mappen RIKTIGT noga: sida för sida, knapp för knapp, komponent för komponent.

**Detta är INTE bara CSS.** Designen definierar vad som FINNS. Regeln per element:
> Finns knappen/vyn/komponenten i designen? → Finns den i verkligheten? → **Nej? → då bygger vi den.** → Ja men ser annorlunda ut? → **gör den exakt som designen.**

- Ingen knapp/komponent i designen får SAKNAS i appen.
- Inget i appen får AVVIKA från designen.
- Avviker verkligheten → **verkligheten har fel, inte designen.** Rätta verkligheten.
- Code som "hittar på annat den driver med" = misslyckande. Exakt kopia, punkt.

## Lägeskoppling
- Roadmap `2-Byggplan/ROADMAP-efter-baseline-2026-06-03.md` → **#1 (toppen), "Design-trohet över alla ytor"**.
- Rotorsak: `5-Kod/docs/solutions/design-patterns/design-fidelity-composition-not-just-tokens-2026-06-03.md` — *"atomerna är rätt, kompositionen är fel."*
- HUR-man-läser-designen: `2-Byggplan/DESIGN-ELEGANS-playbook.md` (T1–T11, §4 signatur-komponenter, §5 per-sida-retrofit, §6 checklista). Vid krock mot root-paketet → **root-paketet vinner.**
- Baseline: WORKFLOW-03 klar/live (worker `36fea384`), POS `corevo.se` orörd. Detta är ett UTSEENDE-lyft, inte en funktionsändring.

## Källa-till-sanning (tie-break — avgör ALLA konflikter)
1. **ROOT-PAKETET i `2-Byggplan/` = lagen. Exakt kopia.** Det du matchar mot:
   - **Klickbar sanning (matcha sidorna exakt mot dessa):** `2-Byggplan/backoffice-pages/1 Super admin.html`, `…/2 Salong-admin.html`, `…/3 Frisör.html`, `…/4 Kundportal.html`, `2-Byggplan/Corevo Back-office.html`, `2-Byggplan/Corevo-salongsdemo.html`.
   - **Komponent-ground-truth (de faktiska komponenterna att kopiera):** `2-Byggplan/components/*.jsx` — `Shell, Bookings, Branding, Customers, Customer, SalonAdmin, ServicesSchema, Staff, StaffSettings, SuperAdmin, SuperData, SuperPlatform, SuperTenant, icons, data, super-data, App`.
   - **Tokens/CSS-kanon:** `2-Byggplan/css/{00-tokens,01-backoffice,02-storefront-customer,03-micro-interactions}.css` + `2-Byggplan/colors_and_type.css` + `2-Byggplan/tokens.json`.
   - **Data-/spec-kontrakt:** `2-Byggplan/backoffice-spec.json` + `2-Byggplan/data-model.json` + `2-Byggplan/handoff-assets/Corevo M6 Build Spec.html` + `2-Byggplan/handoff-assets/spec-data.js`.
   - **Referens-screenshots att DIFFA mot:** `2-Byggplan/handoff-assets/img/*.png` (`dashboard, varumarke, kunder, schema, tjanster, bok-lista/tavla/tidslinje/vecka, frisor-idag, installningar, kund-portal, onboard-tema`).
   - **Komponent-previews (states):** `2-Byggplan/preview/*.html` (buttons, badges, input, stat-card, service-row, time-chips, two-worlds, type-*, colors-*, radii, shadows, spacing-scale). `2-Byggplan/ui_kits/` = klickbara helsidor per roll.
2. **`DESIGN-ELEGANS-playbook.md`** = HUR man läser paketet (T1–T11 + §6-checklista). Säger playbook och root-paketet olika → **root vinner**; uppdatera playbook.
3. **`corevo-booking-design-system v3/` + `Tillfällig map struktur/` = OLD. Läs inte. Krock → root vinner alltid.**
4. **Preview-HTML** förlorar vid off-token-konflikt mot tokens/css-kanon.

## ⛔ TVÅ CSS-VÄRLDAR — den existentiella regeln (playbook §1.1 + root `css/01` vs `css/02`)
- `[data-world="backoffice"]` → Corevo forest `#1F4636` + gold `#F5A623` på cream `#FAF8F4`, Playfair + Inter. ALLA admin/personal/platform. (Källa: root `css/00-tokens.css` + `css/01-backoffice.css`.)
- `[data-world="storefront"][data-theme="…"]` → salongens EGNA tema. **ALDRIG Corevo forest/gold.** Gäller storefront OCH `/konto`. (Källa: root `css/02-storefront-customer.css`.)
- Blanda aldrig. Hårdkodad hex i back-office = fel (referera CSS-var). Corevo-tokens i `/konto` = **korrekthets-bugg**, inte stilval.

## Berörda filer (revir per fas — rör inte annat)
**Delade UI-primitiver (byggs/härdas EN gång, fas 1 P0 — kopieras från root `components/` + `css/`):**
- `5-Kod/apps/web/app/portal-global.css` — porta root-paketets `css/00-tokens.css` + `css/01-backoffice.css` (sidebar 244, 920-brytpunkt + `bo-*`, forest-skuggor, `.num`/`.eyebrow`/PageHead).
- `5-Kod/apps/web/components/portal/ui/*.tsx` — `Stat, Card, Button, Table, Badge, PageHead, Icon`. NYA (finns i root `components/` men ej i koden): `Callout`/guard-band, `Drawer`, `Toast`, `ViewSwitcher`.
**Fas 1 — back-office:** `app/(admin)/**`, `app/(personal)/**`, `app/(platform)/**` (matcha mot root `backoffice-pages/1,2,3.html` + `components/{SuperAdmin,SuperPlatform,SuperTenant,SalonAdmin,Bookings,Customers,ServicesSchema,Staff,StaffSettings,Branding}.jsx`).
**Fas 2 — kund-portal:** `app/(kund)/konto*` — **världa om till storefront** (`data-world="storefront" data-theme`), matcha mot root `backoffice-pages/4 Kundportal.html` + `components/Customer.jsx`.
**Fas 3 — storefront-polish:** `app/(public)/**` + `packages/ui/tokens.css` (de 5 temana) — matcha mot root storefront-ui_kits + `css/03-micro-interactions.css`.
**FRYS — rör ALDRIG i denna goal:** `middleware.ts`, `lib/supabase/*`, `lib/tenant.ts`, `supabase/migrations/*` + RLS, `lib/database.types.ts`, allt under POS/`corevo.se`. Ren frontend.

## Steg

### Steg 0 — läs HELA root-paketet FÖRST (egen inventerings-agent)
1. Sanningen ligger LÖST i `2-Byggplan/` (root). Ignorera `corevo-booking-design-system v3/` + `Tillfällig map struktur/` — OLD.
2. **Läs allt, noga (allt ligger löst i `2-Byggplan/`-roten):** alla `backoffice-pages/*.html`, alla `components/*.jsx`, alla `css/*.css`, `tokens.json`, `backoffice-spec.json`, `data-model.json`, `colors_and_type.css`, alla `handoff-assets/img/*.png`, alla `preview/*.html`. Öppna de klickbara HTML-sidorna och klicka igenom dem.
3. **Bygg komplett inventering:** varje sida → varje knapp/komponent/vy på den. För varje: finns den i appen? Stämmer exakt? Skapa avvikelse-/saknas-lista (= bygg-listan). Inget hoppas över.
4. Krockar root mot playbook → uppdatera playbook (root vinner) + notera i Beslutslogg.

### Fas 1 — BACK-OFFICE (super/salong/personal) — det Zivar hatade mest
5. **P0 delade primitiver först:** kopiera root `css/` + `components/`-primitiver → porta `bo-*`, sidebar 244, 920-brytpunkt, bygg `Callout`/`Drawer`/`Toast`/`ViewSwitcher`, härda `Stat` (Playfair 38 + `.num`).
6. **Per sida, gör den till exakt kopia** av sin root-`.html` + `.jsx` + screenshot. Ordning efter impact: **Varumärke (flaggskeppet, högsta prio)** → Dashboard → Bokningar → Kunder → Tjänster → Schema → Personal → Inställningar → Super admin/Platform.
7. **Bygg varje knapp/komponent** som finns i designen men saknas i koden (Ångra/Publicera-gating, "Se din sida"-pill, bell-dot, vyswitch, drawer-actions, callout-band). Finns i designen, inte byggt → byggs.

### Fas 2 — KUND-PORTAL `/konto`
8. Sätt `data-world="storefront" data-theme` på rooten (idag un-worlded → 22%). Gör den till exakt kopia av root `4 Kundportal.html` + `Customer.jsx`: tema-färgad identitetsrad, **loyalty-kort med poäng i TEMA-accent (ALDRIG Corevo-gold)**, boknings-cards m. status-pill + Omboka/Avboka, integritets-picker.

### Fas 3 — STOREFRONT-polish
9. Lyft de 5 temana till exakt root-storefront-grammatik (`ui_kits/storefront*` + `css/03-micro-interactions.css`): rörelse-på-hover, reveal-on-scroll, sf-type-roller, per-sektion-rytm. Tas sist (redan 5 teman live = minst akut).

## Verifiering — DEN BINDANDE SPÄRREN (utan denna händer 62% igen)
**Per sida, INNAN "klar" får sägas:**
- [ ] **Screenshot sida-vid-sida mot root-mocken** (`backoffice-pages/*.html` / `handoff-assets/img/*.png`). Ta screenshot live (Claude in Chrome / Playwright / `design`-pluginens `design-critique`), lägg bredvid mocken, döm. Kan du inte svara "samma komposition + samma signatur-komponent + alla knappar finns?" utan att öppna mocken → öppna mocken.
- [ ] **Playbook §6-checklistan grön** för sidan (T1 siffror i Playfair+`.num` · T5 eyebrow · T2/T4 gold accent/status dämpad · T6/T7/T8 8px/asymmetrisk/hairlines · T3/T9 forest-skuggor/rörelse · T10/T11 callout-band + self-rendering pickers + inga döda toggles + skrivna empty-states · röd tråd konsekvens-toast · 920-responsivt).
- [ ] **Saknas-svep:** varje knapp/komponent i root-mocken finns i appen ELLER medvetet flaggad. Knapp i designen men saknas i koden = byggd, inte hoppad.
- [ ] **Två-världar-grind:** noll `--c-forest/--c-gold/.h1/.eyebrow` i storefront/`/konto`; noll hårdkodad hex i back-office; rätt `data-world`.

**Per fas (DoD):**
- [ ] typecheck + lint + vitest gröna (baseline 163/163 + nya komponent-tester).
- [ ] opennext-build PASS, grep-guard på byggd middleware ren (ingen `localhost:3000`).
- [ ] POS `corevo.se` + `/admin` → 200 (orörd). freshcut/boka/konto → 200.
- [ ] Fidelity per rörd sida ≥ 90% (baseline back-office 62%, `/konto` 22%).

## Anti-patterns
- ❌ Läsa `corevo-booking-design-system v3/` eller `Tillfällig map struktur/` — de är OLD. Bara root-paketet gäller.
- ❌ Matcha färg/font och kalla det klart (det ÄR buggen — token-trohet ≠ design-trohet).
- ❌ Ersätta en signatur-komponent med en generisk primitiv (color-input istället för swatch-ring-picker).
- ❌ Hoppa över en knapp/komponent som finns i designen. Platta asymmetrisk grid. Siffror i Inter. Gold som fyllning. Mättad status-färg. Neutralt-svarta skuggor.
- ❌ Corevo forest/gold i storefront eller `/konto`. Hårdkodad hex i back-office.
- ❌ Säga "klar" utan screenshot-jämförelse mot root-mocken. Döda toggles. Blanka empty-states.
- ❌ Röra `middleware.ts`/`lib/tenant.ts`/migrations/RLS/POS. Ren frontend.

## Exekvering — STARTA EN STOR AGENT-FLOTTA (inte en agent i taget)
Det blir rätt genom **många agenter parallellt** mot root-paketet — inte en ensam agent som betar av allt. **WORKFLOW-04, starta massor:**
1. **1 inventerings-agent (Steg 0):** läser HELA root-paketet, bygger sida-för-sida + knapp-för-knapp-listan.
2. **1 solo-agent (P0):** delade primitiver + tokens kopierade från root `css/` + `tokens.json` (fryser grunden så ingen agent bygger sin egen rough-variant).
3. **Sen en flotta — EN agent PER sida, parallellt:** Super admin · Salong-admin (Dashboard, Bokningar, Kunder, Tjänster, Schema, Personal, Varumärke, Inställningar) · Frisör-idag · Kundportal. Varje agent äger EN sida och gör den till en exakt kopia av sin root-`.html` + `.jsx` + screenshot.
4. **Sen en verify-flotta (flera adversariella agenter):** screenshot sida-vid-sida mot root, T1–T11-checklistan, "saknas-någon-knapp/komponent"-svep. Avvikelse → tillbaka till bygg-agenten.
En fas klar + verifierad → nästa. Back-office HELT klar innan /konto, /konto innan storefront. **Fler agenter = mer parallellt = rätt, snabbare.**

## Kopplingar
- Root-paketet i `2-Byggplan/` (lagen). `DESIGN-ELEGANS-playbook.md` (hur man läser det) · `DESIGN-SYSTEM-referens.md`.
- `design`-pluginen: `design-critique` + `accessibility-review` + `design-system` som verifierings-grind per sida.
- Lösnings-doc `…/design-patterns/design-fidelity-composition-not-just-tokens-2026-06-03.md`.
- Auto-minnen: `corevo-design-elegance-standard`, `corevo-backoffice-fidelity`, `corevo-storefront-design-audit`.
- ⚠️ **Deadline-krock:** ångerknapp (lagkrav 19 juni 2026) — kör PARALLELLT (skilt revir: avboknings-flöde vs UI-polish). Se roadmap.

## Rollback
Ren frontend → `git revert` per fas-commit + redeploy. Inga DB-/migrations-ändringar. POS orörd. Varje fas = egen commit → rullas tillbaka isolerat.
