# goal-50 — Sajtbyggare: mall-register + galleri (varje look blir ett RIKTIGT val)
Thinking: 🔴 (rör den LIVE onboarding-wizarden + storefront-render bakom `SAJTBYGGARE_ENABLED`. Rollback obligatorisk. Flagg-OFF måste förbli byte-identisk. Zivar-OK före kod.)

## Mål
Gör **varje** sajtbyggare-mall till ett **valbart, 100% fungerande och redigerbart** alternativ i onboardingen — EN väg för alla looks. Avskaffa de tre specialfallen som gör det fragmenterat idag:
- (a) bransch sätter temat → ingen riktig look-väljare,
- (b) full redigering bara för `salvia`, övriga = stub,
- (c) de byggda render-bro-mallarna syns inte alls.

EN registry → ett galleri → en editor för alla. Inget "halvt för den, halvt för den".

## Lägeskoppling
- Stänger hålet mellan **plan och verklighet**: `1-Planering/06-sajtbyggare/MALL-KURERING-sektioner.md §0.5` beskrev goal-38 som "byt tema-väljaren mot mall-galleriet" — men goal-38 (KLAR+LIVE 2026-06-18) byggde *editorn* (monterade SiteEditor i "Designa sidan"), INTE galleriet. Galleriet är fortfarande obyggt. **Detta = exakt den biten.**
- Föder från **goal-36** (per-mall-konvertering): goal-36 producerar looks; goal-50 ger dem en plats att synas + väljas. goal-36 hårdas separat (R1/R2/R6/R4) och registrerar varje klar mall i registret detta bygger.
- Bygger på **goal-37 (S2 SiteEditor)** + **goal-38 (S3 onboarding)** — båda KLAR/LIVE. Återanvänder deras editor + spar-väg. **Bygg ingen andra editor.**

## Kontext (verifierat i koden 2026-06-26)
**Registret finns redan — det är `templates`-tabellen.** `lib/platform/verticals.ts` läser **aktiva templates grupperade på `tags.bransch`** (RLS `templates_read_active`); `lib/platform/preview-admin.ts` säger raderna "1:1 match templates table: salvia/leander/zigge/linnea/edit". Dvs tabellen har **5 rader idag** (de 5 temana). `loadVerticalPresets()` (anropas i `app/(platform)/salonger/ny/page.tsx`) matar wizarden ur den.

**De 4 byggda mallarna är INTE rader i tabellen.** `lib/sajtbyggare/templates/{restoran,klinik,drivin,carserv}.ts` (manifest + HTML + proofs, alla VERIFIERAD 0FAIL) finns bara som kod — onboardingen vet inte om dem.

**Väljaren visar ingen look-gallery.** `lib/platform/onboarding-steps.ts`: i editor-läge (flag-ON, prod) ersätts Temamall+Token-branding av "Designa sidan", och *"temat kommer från branschens default → ingen tema-väljare"*. `components/platform/CreateTenantForm.tsx:557+`: om `theme === 'salvia'` → full `SiteEditor`; annars → notis "Full sajt-redigering finns för mallen 'salvia'" + bara tagline/accent. = (b) och (c).

**Render-vägen finns men är ohärdad.** `lib/sajtbyggare/render-bridge.tsx` `renderTemplate(html, modules)` byter `<corevo-module>`-markörer → live-moduler; okänd modul → inert (ingen krasch). MEN: **ingen try/catch** (trasig HTML → SSR 500 = de-risk R2) och **`validate_markers.mjs` saknas** (lovad "i S3" = de-risk R8). SiteEditor-fil = `components/admin/SiteEditor.tsx`. Storefront = `app/(public)/page.tsx`.

## Berörda filer
- **`templates`-tabellen** (Supabase prod `clylvowtowbtotrahuad`) — **inventera schema FÖRST** (finns `kind`/`render_type`, `html`, `manifest`/`slots`, `tags`, `active`, `thumbnail`?). Saknas kolumner → ny migration (idempotent + rollback). RLS `templates_read_active` oförändrad.
- `lib/platform/verticals.ts` / `verticals-shared.ts` — utöka så registret returnerar BÅDA render-typerna (`theme` + `template`), inte bara bransch-grupperade teman.
- `lib/sajtbyggare/look-registry.ts` *(NY)* — kanonisk lista `{ id, namn, vibe-taggar, thumbnail, renderType:'theme'|'template', templateKey }`. EN källa; picker + preview läser den.
- `components/platform/CreateTenantForm.tsx` — "Designa sidan"-steget: **lägg galleri-väljare** (thumbnails ur registret) FÖRE editorn. Ta bort `theme==='salvia' ? full : stub`-grenen → driv `SiteEditor` av valt registry-entry (templateKey + regions ur dess manifest). Flagg-OFF byte-identisk.
- `components/admin/SiteEditor.tsx` — ta emot valfri `templateKey` + `regions` (redan props) → redigera vilken registrerad look som helst, inte hårdkodat salvia.
- `lib/sajtbyggare/templates/*` → registrera de 4 (restoran/klinik/drivin/carserv) som rader i `templates` (HTML + manifest/slots + thumbnail).
- `lib/sajtbyggare/render-bridge.tsx` — **R2:** try/catch + safe fallback; parse varje mall EN gång author-time. **R8:** bygg `validate_markers.mjs`.
- `app/(public)/page.tsx` — rendera `template`-typ looks via render-bron för valfri tenant (inte bara `theme`).

## Steg
1. **Inventera `templates`-tabellen** (Code via Supabase `list_tables`/SQL): kolumner, de 5 radernas form, finns render-typ/html/manifest/thumbnail. Landa schemat innan kod. Saknas kolumner → migration (idempotent + rollback).
2. **look-registry.ts** — bygg den kanoniska listan ur tabellen; 5 teman = `renderType:'theme'`, mallar = `renderType:'template'`.
3. **Registrera de 4 mallarna** som `template`-rader (HTML/manifest/slots/thumbnail ur `lib/sajtbyggare/templates/*`). Reconcile slots → manifest (mönster `0040`).
4. **Galleri-väljare** i "Designa sidan": rendera registret som thumbnails; val sätter `templateKey`. Picker dispatchar preview på `renderType`.
5. **SiteEditor för alla:** ta bort salvia-grenen; mata editorn med valt entrys templateKey + regions. Varje look full-redigerbar.
6. **Härda render-vägen:** R2 (try/catch + author-time-parse), R8 (`validate_markers.mjs`). En mall-rad får aldrig 500:a storefronten.
7. **Storefront** renderar `template`-looks via render-bron för tenants som valt en.
8. **Licens strip-läge:** credit-fält i manifestet, **default AV** (renderas bara om `attribution_enabled`). Ingen synlig credit nu; 1 toggle om det nån gång behövs.

## Verifiering (mekaniskt 0 FAIL — aldrig ögonmått)
- [ ] Galleriet listar ALLA registry-entries (5 teman + 4 mallar = 9) med thumbnail. Test asserterar antal + identiteter ur registret.
- [ ] Välj varje mall → storefront/preview renderar 200, root mountar, **noll console-fel / ingen error-boundary**, alla regioner + `data-corevo-module` i DOM (per-mall proof, mönster `*.proof.test.ts`).
- [ ] Välj varje mall → SiteEditor öppnar, en region redigeras → draft lyfts (ingen salvia-special).
- [ ] **R2:** mata renderTemplate trasig HTML → fallback, INGEN 500 (test).
- [ ] **R8:** `validate_markers.mjs` fångar felstavad `type` (test).
- [ ] Flagg-OFF: legacy-wizarden byte-identisk (regression-test, båda STEPS-grenar).
- [ ] **Anti-stub (R4):** varje per-mall-proof asserterar >=N regioner + booking-variant + >=1 kanon-px/hex, annars failar proofet självt.
- [ ] **Oberoende verify-agent** granskar att proofen asserterar mallens UNIKA regioner (ej copy-paste-stub). Verifieraren rättar inte sin egen läxa.

## Anti-patterns
- Bygg INTE en andra editor/picker — återanvänd SiteEditor + `templates`-tabellen.
- Forka INTE `manifest/types.ts`/`render-bridge`/`booking-mount` unilateralt (READ-ONLY-kontrakt, goal-36 §9). Ny region-typ → STOPP + flagga.
- Platta ALDRIG en mall till 5 tokens (tappar layouten = hela looken). Full HTML/manifest behålls.
- Bryt INTE flagg-OFF-vägen. Prod-onboarding får inte ändras när flaggan är av.
- Ingen ren smoke-test som "verifiering" (falsk-grön, 62%-fällan).

## Kopplingar
- **goal-36** (per-mall-konvertering, hårdas R1/R2/R6/R4) → registrerar varje klar mall HÄR.
- **goal-37 / goal-38** (KLAR/LIVE) — editor + onboarding-montering, återanvänds.
- `MALL-KURERING-sektioner.md §0.5` (look-registry, två render-typer) = ritningen.
- `PILOT-UTFALL.md` (MÖNSTRET) + de-risk-doc `3-Bakgrund-Research/de-risk-goal36-2026-06-26.md`.

## Rollback
- Migration: rollback-SQL (drop nya kolumner).
- `templates`-rader: de 4 mall-raderna sätts `active=false` → galleriet faller tillbaka till 5 teman.
- Allt bakom `SAJTBYGGARE_ENABLED`; flippa "false" → legacy-wizard, prod orörd (samma rollback som goal-38).
- Worker-rollback: `wrangler rollback` per `HANDOFF.md`.

## Öppet (markeras, gissas EJ)
- Exakt `templates`-schema (steg 1 avgör om migration behövs).
- Thumbnail-generering: per-mall screenshot vs statisk bild — landa i steg 1/4.
- Om galleriet ska visa BÅDE teman och mallar, eller pensionera de 5 temana till "start-paletter inuti en look" (MALL-KURERING §0.5). Default: visa båda, två render-typer. Ändra bara om Zivar säger annat.

## ⛔ LÅST 2026-06-26 (Zivars förtydligande — går FÖRE allt ovan vid krock)
> Bilden: ett hus med EN box. I boxen ligger ALLA mallar. Inget utanför, inget förbyggt i vägen, inget privilegierat. Varje gång man bygger ett rum väljer man en mall ur boxen för hur det ser ut. Lägger man till en modul hamnar den direkt i den valda mallen.

- **EN box, allt likvärdigt.** Registret = EN behållare med mallar. Inga separata "hus-teman", inget privilegierat `salvia`-special, inget förbyggt. Varje entry behandlas IDENTISKT.
- **De 5 gamla temana (salvia/leander/zigge/linnea/edit) pensioneras eller blir vanliga mallar i boxen** — ALDRIG en egen privilegierad väg. Ta bort `theme === 'salvia' ? full : stub`-grenen och hela "theme vs template"-uppdelningen som ger olika behandling. En sorts sak i boxen: mallar.
- **Varje mall = valbar när man väljer look.** Många att välja mellan. Utseendet spelar ingen roll — det som räknas är att den är VALBAR och funkar 100%.
- **Varje mall är ISOLERAD** — en malls CSS/innehåll läcker ALDRIG in i en annan (scoping, de-risk R5). Ingen mall smutsar ner en annan.
- **Lägg till modul → vävs direkt in i den valda mallen** (render-bro `<corevo-module>`-slot), live, utan deploy.
- Det här är hela poängen. Allt annat i briefen tjänar detta. Krockar något ovan med detta → detta vinner.

## 🔥 RIV BORT — komplett & listat (Zivar 2026-06-26: "inget halvt, inget i vägen, men släng inte motorn")
> Det-i-vägen = ett TUNT lager ovanpå motorn. Det rivs HELT. Motorn behålls — den ÄR boxen. Inget "börja från noll" på motorn (vi skulle bara bygga tillbaka den identiskt).

**DÖR — verifiera att INGET av detta finns kvar i onboarding/look-vägen (annars FAIL):**
- De 5 tema-raderna i `templates` som privilegierade looks (salvia/leander/zigge/linnea/edit) → konverteras till vanliga mall-entries i boxen ELLER `active=false`. Ingen kvar som "tema".
- `WIZARD_THEMES`, `THEME_KEYS`, `ThemeDef`, `ThemePreview` + tema-specifik gren i `components/platform/CreateTenantForm.tsx`.
- `theme === 'salvia' ? full : stub`-grenen → bort. `SiteEditor` körs för ALLA looks via registret.
- "temat kommer från branschens default → ingen tema-väljare"-logiken i `lib/platform/onboarding-steps.ts` + wizarden → ersätts av galleri-valet.
- All theme-specifik CSS/nav-special som ger de 5 looks olika behandling → neutraliseras (looken bär sin egen scoped CSS, ingen global tema-gren).
- Legacy flag-OFF-vägen som bär tema-väljaren (Temamall + Token-branding-stegen) → pensioneras med (vi behåller INTE en byte-identisk tema-legacy när hela poängen är att teman dör).

**BEHÅLLS — riv ALDRIG (det är motorn/boxen):**
- `lib/sajtbyggare/render-bridge.tsx` (renderTemplate — det som väljbarheten + modul-väven vilar på).
- `lib/sajtbyggare/templates/*` — de 4 färdiga mallarna (restoran/klinik/drivin/carserv, VERIFIERAD 0FAIL).
- `components/admin/SiteEditor.tsx` (editorn för alla looks).
- `templates`-tabellen + `manifest/*` + slot/region-modellen (boxens hyllor).
- booking-mount + modul-väven (`<corevo-module>`-slot → modul hamnar i vald mall).

**Verifiering av rivningen (mekaniskt):**
- [ ] grep-test: inga `WIZARD_THEMES`/`THEME_KEYS`/`theme === 'salvia'` kvar i onboarding-vägen.
- [ ] Galleriet visar BARA mallar, 0 entries av typ "tema".
- [ ] Onboarding → välj mall → lägg modul → modulen vävs in i den valda mallen (live, ingen deploy).
- [ ] Ingen look får särbehandling (samma render- + edit-väg för alla, asserterat).

## 📸 LIVE-BEVIS (Zivars screenshots 2026-06-26) — exakt vad som är fel
Sett i onboarding-studion. Bekräftar diagnosen + skärper den med två precisa fel:

1. **"Välj startmall"-steget är egentligen BRANSCH-väljaren** (Barbershop/Frisör/Generell/Nagelstudio/Restaurang) — inte en mall/look. Stegets egen text säger "Branschen är bara en förinställning … du ändrar allt fritt efteråt" — men koden filtrerar ändå looken på branschen. Intentionen finns, wiringen motsäger den. Bransch ska BARA förvälja moduler/innehåll, aldrig vara "startmall/look".
2. **"Temamall"-steget filtrerar looks per bransch** (`tags.bransch`-gruppering i `lib/platform/verticals.ts`) → bara 3–4 visas (barber-ex: Corevo Alotan BB / BarberX BB / Barberz / Zigge). Zivar ska se ALLA mallar i boxen, oavsett bransch. **Ta bort bransch-filtret på look-listan.**
3. **Previewen renderar inte mallarna distinkt** — Alotan, BarberX och Barberz ger IDENTISK preview ("Din frisör i lugn och ro / SALONG & FÄRGATELJÉ"); bara Zigge skiljer. Valet byter namn men inte utseende → previewen visar ett generiskt tema, inte mallens RIKTIGA HTML via render-bron.

### Tillägg till RIV BORT / BYGGS (från live-beviset)
- **RIV:** bransch→look-filtret (`tags.bransch` som look-grind), "startmall"-begreppet som blandar ihop bransch + look + tema.
- **BYGG:** galleriet visar ALLA mallar i boxen oavsett bransch · bransch = separat modul/innehålls-preset (frikopplad från look) · preview dispatchar på mallens riktiga HTML.
- **VERIFIERA (skärpning):** 3 olika mall-val = 3 SYNLIGT olika previews (computed-style/screenshot-diff, aldrig bara olika namn på samma render). Samma bransch får aldrig krympa look-listan.
