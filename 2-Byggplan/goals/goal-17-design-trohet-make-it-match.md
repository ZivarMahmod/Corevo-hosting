# BRIEF-UI-017: Design-trohet "make-it-match" — designen blir LAG över alla ytor
Thinking: 🔴 Think hard (körs som WORKFLOW-04, per-sida-flotta — se §Exekvering)

## Mål
Tvinga implementationen att matcha designen — inte bara dess färger, utan dess **komposition, signatur-komponenter och interaktions-finish**. Idag applicerar Code tokens (färg/font) och plattar resten → ~62% likhet, `/konto` 22%. Denna goal gör `DESIGN-ELEGANS-playbook.md` till en **bindande spärr**: ingen sida är "klar" förrän den passerar playbook-checklistan sida-vid-sida mot mocken. Ordning: **back-office först** (super/salong/personal), sen **/konto**, sen **storefront-polish**. Knappar/komponenter som finns i designen men inte i koden **byggs** — generiska primitiver ersätter aldrig en signatur-komponent.

## Lägeskoppling
- Roadmap `2-Byggplan/ROADMAP-efter-baseline-2026-06-03.md` → **#1 (toppen), "Design-trohet över alla ytor"**.
- Rotorsak dokumenterad: `5-Kod/docs/solutions/design-patterns/design-fidelity-composition-not-just-tokens-2026-06-03.md` — *"atomerna är rätt, kompositionen är fel."*
- Standard som blir spärr: `2-Byggplan/DESIGN-ELEGANS-playbook.md` (T1–T11, §4 signatur-komponenter, §5 per-sida-retrofit, §6 checklista). **Auktoritativ.**
- Baseline: WORKFLOW-03 klar/live (worker `36fea384`), FreshCut `branding={}` → salvia driver, POS `corevo.se` orörd. Bygget funkar — detta är ett UTSEENDE-lyft, inte en funktionsändring.

## Kontext — varför Code aldrig löst det (läs detta, annars händer det igen)
1. **Token-trohet läser som design-trohet för den som applicerade tokens — men inte för den som kan designen.** Varje atom (forest, gold, Playfair) stämmer → Code tror den är klar. Bara sida-vid-sida med mocken syns gapet. Därför är **screenshot-jämförelse mot mocken en OBLIGATORISK grind**, inte en bonus.
2. **Tre lager saknas, i prioritetsordning:** (a) komposition — asymmetriska grids (`1.5fr/1.7fr` vänster-bredare, `align-items:start`) plattas till en kolumn; (b) signatur-komponenten byts mot en generisk primitiv (flaggskepps-väljaren → rå `<input type=color>`); (c) interaktions-finish — dirty-state, live-preview, rörelse-på-hover, self-rendering pickers saknas.
3. **Designen är inte bara värden — den är komponenter.** Code måste BYGGA det som finns i designen men inte i koden (callout-band, drawer, inverterat forest-card, vyswitchare, self-rendering pickers). Spec finns i playbook §4 + §5.

## Källa-till-sanning (tie-break — avgör ALLA konflikter)
1. **v3-paketet (det maxade) NÄR det landar** — committas in (se Steg 0). Blir ny kanon. Om v3 ändrar värden → uppdatera playbook-kanonen (DELTA-tabellen) i samma svep.
2. **`DESIGN-ELEGANS-playbook.md`** — kanon tills v3 ersätter (färg/typ/spacing/radii/motion/shadow + signatur-komponenter).
3. **v2-kit** `2-Byggplan/corevo-booking-design-system v2/project/…` (`colors_and_type.css` + `ui_kits/*` + `Corevo M6 Build Spec.html`) — djupare källa när playbook är tvetydig.
4. **Preview-HTML förlorar alltid** vid konflikt (off-token värden).
> Kända drift-punkter att korrigera (playbook §0): sidebar `248→244px`, brytpunkt `760→920px` + porta `bo-2col/bo-stat-grid/bo-brand`, card-pad `22`, success `#4E7A5E`.

## ⛔ TVÅ CSS-VÄRLDAR — den existentiella regeln (playbook §1.1)
- `[data-world="backoffice"]` → Corevo forest `#1F4636` + gold `#F5A623` på cream `#FAF8F4`, Playfair + Inter. ALLA admin/personal/platform.
- `[data-world="storefront"][data-theme="…"]` → salongens EGNA tema. **ALDRIG Corevo forest/gold.** Gäller storefront OCH `/konto`.
- Blanda aldrig. Hårdkodad hex i back-office = fel (referera CSS-var). Corevo-tokens i `/konto` = **korrekthets-bugg**, inte stilval.

## Berörda filer (revir per fas — rör inte annat)
**Delade UI-primitiver (byggs/härdas EN gång, fas 1 P0):**
- `5-Kod/apps/web/app/portal-global.css` — sidebar 244, brytpunkt 920 + `bo-*`-klasser, forest-tonade skuggor, `.num`/`.eyebrow`/PageHead-rytm.
- `5-Kod/apps/web/components/portal/ui/*.tsx` — `Stat` (lägg `hint`-rad), `Card`, `Button`, `Table`, `Badge`, `PageHead`, `Icon`. NYA: `Callout`/guard-band (§4.7), `Drawer` (§4.9), `Toast` (§4.10), `ViewSwitcher`.
**Fas 1 — back-office (per-sida §5-tabell):** `app/(admin)/**`, `app/(personal)/**`, `app/(platform)/**`.
**Fas 2 — kund-portal:** `app/(kund)/konto*` — **världa om till storefront** (`data-world="storefront" data-theme`), bygg loyalty-kort net-new (§4.8).
**Fas 3 — storefront-polish:** `app/(public)/**` + `packages/ui/tokens.css` (de 5 temana) — rörelse-på-hover, reveal-on-scroll, type-roller (§2.3, §3 T9).
**FRYS — rör ALDRIG i denna goal:** `middleware.ts`, `lib/supabase/*`, `lib/tenant.ts`, `supabase/migrations/*` + RLS, `lib/database.types.ts`, allt under POS/`corevo.se`. Detta är ren frontend.

## Steg

### Steg 0 — v3-intake (gör först om v3 landat; annars hoppa till Fas 1 mot playbook+v2)
1. Lägg v3-paketet i `2-Byggplan/corevo-booking-design-system v3/` (committa — det är kontraktet; v2 behålls på disk som referens).
2. Diffa v3:s `colors_and_type.css`/kit mot playbook-kanonen. Skiljer värden → uppdatera playbook §0/§2 DELTA + notera i Beslutslogg. v3 vinner.
3. Inventera v3:s komponenter/knappar som INTE finns i koden → lista dem i denna goal som bygg-poster.

### Fas 1 — BACK-OFFICE (super/salong/personal) — det Zivar hatade mest
4. **P0 delade primitiver först** (annars bygger varje sida sin egen rough-variant): porta `bo-*`-klasser, fixa sidebar 244 + 920-brytpunkt, bygg `Callout`, `Drawer`, `Toast`, `ViewSwitcher`, härda `Stat` (Playfair 38 + `.num` + `hint`).
5. **Per sida, kör §5-retrofit-tabellen** (mål-grid → obligatoriska signatur-element → delta). Ordning efter impact: **Varumärke (flaggskeppet §4.3, högsta prio)** → Dashboard (§4.7 inverterat forest-card + charts) → Bokningar (§4.6 ViewSwitcher + drawer) → Kunder (§4.6 gold-loyalty + tier-badge) → Tjänster (§4.4 placement-map) → Schema (§4.5 vecko-grid) → Personal → Inställningar (proof-callouts, inga döda toggles) → Platform (eyebrow + status-badges).
6. **Bygg saknade knappar/komponenter** som specen kräver men koden saknar (Ångra/Publicera-gating, "Se din sida"-pill endast salong, bell-dot, vyswitch-knappar, drawer-actions). Finns i designen, inte byggt än → byggs.

### Fas 2 — KUND-PORTAL `/konto`
7. Sätt `data-world="storefront" data-theme` på rooten (idag un-worlded → 22% likhet). Bygg §4.8: tema-färgad identitetsrad, **loyalty-kort med poäng i TEMA-accent (ALDRIG Corevo-gold)**, boknings-cards m. status-pill + Omboka/Avboka, integritets-picker.

### Fas 3 — STOREFRONT-polish
8. Lyft de 5 temana till full §2.3/§3-grammatik: rörelse-på-hover (rad-glid, tile-press, dot-töj), reveal-on-scroll, korrekta sf-type-roller, per-sektion max-bredd + vertikal rytm (112/96/84). Storefront är PRODUKTEN — högsta polish-ribban, men tas sist här eftersom den redan har 5 teman live (minst akut mismatch).

## Verifiering — DEN BINDANDE SPÄRREN (utan denna händer 62% igen)
**Per sida, INNAN "klar" får sägas:**
- [ ] **Sida-vid-sida-screenshot mot mocken** (v3/v2-kit `index.html` eller M6-spec). Ta screenshot live (Claude in Chrome / Playwright), lägg bredvid mocken, döm. Kan du inte svara "samma komposition + samma signatur-komponent?" utan att öppna mocken → öppna mocken.
- [ ] **Playbook §6-checklistan grön** för sidan: världar/tokens · T1 (alla siffror Playfair+`.num`) · T5 (eyebrow över varje sektion) · T2/T4 (gold bara accent, status dämpad) · T6/T7/T8 (8px-skala, asymmetrisk grid, hairlines) · T3/T9 (forest-skuggor, rörelse ej bara färg) · T10/T11 (callout-band finns & används, self-rendering pickers, inga döda toggles, skrivna empty-states) · röd tråd (konsekvens-toast på svenska) · responsivt (920-brytpunkt).
- [ ] **Två-världar-grind:** noll `--c-forest/--c-gold/.h1/.eyebrow` i storefront/`/konto`; noll hårdkodad hex i back-office; rätt `data-world` på rooten.
- [ ] **Inga döda knappar:** varje knapp/toggle i designen är wired ELLER medvetet flaggad. Knapp som finns i designen men saknas i koden = byggd, inte hoppad.

**Per fas (DoD):**
- [ ] typecheck + lint + vitest gröna (baseline 163/163, lägg till tester för nya komponenter).
- [ ] opennext-build PASS, grep-guard på byggd middleware ren (ingen `localhost:3000`).
- [ ] POS `corevo.se` + `/admin` → 200 (orörd, före+efter). freshcut/boka/konto → 200.
- [ ] Fidelity-score per rörd sida ≥ mål (sikta 90%+; back-office-baseline var 62%, `/konto` 22%).

## Anti-patterns
- ❌ Matcha färg/font och kalla det klart (det ÄR buggen — token-trohet ≠ design-trohet).
- ❌ Ersätta en signatur-komponent med en generisk primitiv (color-input istället för swatch-ring-picker).
- ❌ Platta asymmetrisk grid till en kolumn. Siffror i Inter. Gold som fyllning/struktur. Mättad status-färg. Neutralt-svarta skuggor.
- ❌ Corevo forest/gold i storefront eller `/konto`. Hårdkodad hex i back-office.
- ❌ Säga "klar" utan screenshot-jämförelse mot mocken. Döda toggles. Blanka empty-states.
- ❌ Röra `middleware.ts`/`lib/tenant.ts`/migrations/RLS/POS. Detta är ren frontend.

## Exekvering (rekommendation)
Körs som **WORKFLOW-04**: Steg 0 + P0-primitiver solo (fryser delad grund), sen per-sida-flotta (varje sida = disjunkt revir, parallellt) inom en fas, sen verify-flotta som kör screenshot-grinden adversariellt. En fas klar + verifierad → nästa fas. Back-office hela vägen innan /konto, /konto innan storefront.

## Kopplingar
- `2-Byggplan/DESIGN-ELEGANS-playbook.md` (standarden/grinden), `2-Byggplan/DESIGN-SYSTEM-referens.md`.
- v2-kit `2-Byggplan/corevo-booking-design-system v2/`; v3 `…v3/` (när landat).
- Lösnings-doc `…/design-patterns/design-fidelity-composition-not-just-tokens-2026-06-03.md`.
- Auto-minnen: `corevo-design-elegance-standard`, `corevo-backoffice-fidelity`, `corevo-storefront-design-audit`.
- ⚠️ **Deadline-krock:** ångerknapp (lagkrav 19 juni 2026) ligger annars som #1 i roadmap. Design är Zivar-valt #1 — men ångerknappen får inte tappas. Kan köras parallellt (helt skilt revir: avboknings-flöde vs UI-polish). Se roadmap-not.

## Rollback
Ren frontend → `git revert` per fas-commit + redeploy. Inga DB-/migrations-ändringar. POS orörd hela vägen. Varje fas är en egen commit → kan rullas tillbaka isolerat.
