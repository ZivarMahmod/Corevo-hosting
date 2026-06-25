# goal-48 — Onboarding-studio (multibransch) live i superbooking

Thinking: 🔴 (designtrohet-bygge mot LAG-paket + rör den LIVE onboarding-vägen i superbooking. Improvisera = 18h-fällan. Allt bakom flagga, nuvarande 5-stegs-form kvar som fallback tills studion är staging-bevisad. DB vinner över mockupen — designen namnger tabeller som inte finns.)

**Datum:** 2026-06-25
**Typ:** Autonom goal-brief för Claude Code — designtrohet, körs i vågor.
**Beslut (Zivar 2026-06-25):** onboarding-v2 (CHECKLISTA W5 #20) **flyttad fram till NU** — kunder väntar på sina sidor, superbooking sitter på gammal kod. Bygg den designade studion och få den live. Sen: "modulerna funkar som de ska" (= W3-spåret, egen goal efter denna).

---

## Mål
Bygg om superbookings onboarding från dagens **kompakta 5-stegs-form** (`CreateTenantForm`) till den designade **Onboarding-studion**: en 3-stegs-resa (Kunder → Studio → Live) där studion har vänster-rail (5 faser / 12 steg) + kontrollpanel + en **alltid-synlig live storefront-preview** bredvid varje steg. Exakt kopia av design-paketet. Flagg-gatad, staging-bevisad, nuvarande form kvar som fallback tills 0-FAIL.

## DESIGN = LAG (läs HELA, kopiera exakt — aldrig improvisera)
Paket: `4-Dokument-Underlag/01-acceptans/super-admin/` (källan) + `standalone/Onboarding-studio.html` (kompilerad referens).
- `cfg-data.js` ⭐ — data-spine: 6 teman, 17 moduler (7 live/10 roadmap), 18 branscher (4–5 live), 12 steg/5 faser (PHASES), LAUNCH_CHECK, SECTIONS, MODULE_FACES (sf/adm per modul).
- `studio.jsx` — vänster-rail + de 12 stegens kontrollpaneler (PanelBranch…PanelLive).
- `app.jsx` — orkestrering + `cfg`-state-formen + `setBranch`-föraktivering.
- `preview.jsx` — live-preview: re-temar direkt, renderar aktiva moduler per-bransch, klicka-redigera hero/ingress, device-toggle, spec-läge.
- `stages.jsx` — SuperEntry (Kunder-lista), LaunchSequence (overlay), CustomerAdmin (M6-resultat-flik).
- Regler i `01-BASELINE.md` + `00-LÄS-FÖRST.md` + `HANDOFF.md`: **DB vinner, mockup ≠ funktion**, bygg bara det live'a, radera ej roadmap.

## Nuläge (vad som FAKTISKT är live) vs Design — GAPET
| | Nuläge (`CreateTenantForm`, flagga PÅ) | Design (Onboarding-studio) |
|---|---|---|
| Form | 1 kolumn, max-820, ingen preview | 3-stegs-resa + studio: rail + panel + **live preview-pane** |
| Steg | 5: Bransch · Namn · Designa sidan (salvia-only) · Moduler · Ägare | 12: branch · namn · tema · modval · **modplace** · **modconf** · brand · **text** · **tjanster** · agare · **granska** · **live** |
| Preview | statisk `ThemePreview`-mock per tema-val | alltid-på, re-temar, renderar moduler per-bransch, klicka-redigera, device-toggle |
| Saknas helt | — | modul-**ordning** (dra), per-modul **bransch-config**, **tjänster+priser**, **granska-checklista**, **lansera**-skärm, **resultat**-vy (Besökarens vy + Kundens admin) |

Återbruk (rör ej i onödan): `createTenant` (atomisk write-väg — studion är ny FRONT-END över SAMMA writes), `SiteEditor` (salvia in-wizard, 'onboarding'-läge), `onboarding-steps.ts`, `verticals-shared.ts`/`modulesForVertical`, `booking-variant.ts`, `WIZARD_THEMES`/`ThemePreview`, `resolveSiteContent`/manifest.

## Wave 0 — DB-SANNING FÖRST (goal-47-lärdomen: designen 2026-06-16 ljuger om DB)
**Verifiera mot LIVE-DB innan en rad byggs (DB vinner):**
- [x] `templates`/`template_slots`/`content_slots` finns (migr 0026). ✓
- [x] ⚠️ `tenant_site_pages` finns **INTE** (verifierat live 2026-06-26) → "text"+"modplace" skriver `content_slots` (goal-47 slice 2-väg). Beslut låst till W5.
- [x] `services` pris-kolumnform: **inline `price_cents` (int, öre)** finns — INGEN separat `service_prices`-tabell. W4 skriver inline. ✓
- [x] Lojalitet-nyckel-bugg: bekräftad på **alla 5 verticals** (`default_modules ? 'loyalty'` = true överallt; `modules.key='lojalitet'`). Fix = `0039_w0_loyalty_key_fix.sql` (§7.1-rename, värde bevarat draft/off, idempotent). **Apply staging först.**
- [x] ~~4 tomma mallar seedas~~ → **DROPPAD (falsk premiss, goal-47-mönstret igen).** Storefront renderar via **5 hårdkodade React-layouter** (`STOREFRONT_LAYOUTS[theme]`: Salvia/Leander/Zigge/Linnea/Edit) + starka per-tema-defaults i `theme-content.ts`. `templates.sections` läses ENDAST av `SkinRenderer`, som är gatad `theme==='salvia'` + flagga (av i prod). En nagel-onboard → `theme='linnea'` → `LinneaLayout` med fulla `THEME_CONTENT.linnea`-defaults (hero/lede/stats/bilder) → **redan en riktig sajt, ej tom.** Seed hade ändrat NOLL i prod-render (+ vilselett: antyder att de temana rider data-driven-vägen, vilket de inte gör). Klar-beviset "ej tom sajt" är alltså redan uppfyllt av befintlig kod. *Att seeda sektioner för icke-salvia-teman hör hemma när data-driven-render breddas bortom salvia (goal-47/template-bron), inte här.*
- [x] Live-sanning: **5 verticals** (frisör/barbershop/nagelstudio/restaurang/generell) + **7 modules** (booking/shop/offert/lojalitet/presentkort/blogg/media_library). Bara dessa wire:as; resten = Roadmap-märkta.

### W0 — UTFALL (2026-06-26)
DB-sanning klar. **W0 = ENBART loyalty-key-fixen** (`0039`). Template-seed droppad som falsk premiss (se ovan) — avvikelse från runspec, ratificeras här. `services.price_cents` + `tenant_site_pages`-frånvaro bekräftade → W4/W5-writes låsta. Ingen TS-ändring i W0 (ren SQL).

## Vågor (en klar → staging-bevisa → nästa; flagga ny `ONBOARDING_STUDIO_ENABLED`, separat från SAJTBYGGARE_ENABLED)
1. **Studio-skal (UX, inga nya writes).** Journey-bar (Kunder→Studio→Live) + SuperEntry (riktig kund-lista, ej DEMO_TENANTS) + rail (5 faser/12 steg, `cfg-data PHASES`) + 420px-panel + preview-pane. `cfg`-state per `app.jsx`. Lansera-knappen anropar befintliga `createTenant` (mappa `cfg`→FormData). Befintliga 5-stegs-fälten återanvänds inuti panelerna. **Inga nya DB-tabeller.**
2. **Live preview = riktig render (inte mock).** Återbruk S2/S3 salvia-preview-vägen (LÅST-B renderar riktiga layouter). Per-bransch modul-sektioner: interimt designens preview-mock (`preview.jsx` ModX), men spec:a att prod-preview ska bli den riktiga storefronten (render-bron). Avgör med advisor om preview blockerar på template-bron eller ej — sannolikt nej (salvia-render finns redan).
3. **Stegen utan nya writes:** modval (state-toggle, finns) · modconf (per-bransch regler ur `MODULES.variants`/`.build` — REN spec-display, ingen logik) · brand (logo/accent/tagline, finns) · agare (finns) · granska (LAUNCH_CHECK-checklista, härledd) · live (lanseringsskärm + `LaunchSequence`-overlay).
4. **tjanster-steg (NY write):** services (+ pris i öre) → verifierad pris-tabellform från wave 0. Minst 1 tjänst med pris = launch-krav.
5. **text + modplace (kopplar template-bron):** hero/ingress klicka-redigera + modul-ordning → `content_slots` (goal-47 slice 2-väg) eller interim `tenant_settings`. **Beror på wave-0-beslutet.**
6. **Resultat-stage:** Besökarens vy (riktig storefront) + "Kundens egen admin (M6)" — länka till befintliga `booking.corevo.se/admin`, bygg inte om M6.

## Hårda regler
- **Flagga `ONBOARDING_STUDIO_ENABLED`** (env-fälla: anropa i komponentkropp, ej modul-scope). OFF → nuvarande `CreateTenantForm` byte-identisk. Aldrig ersätt fungerande onboarding på live superbooking innan staging-bevisad.
- **Bara live:** 7 moduler / ~5 verticals wire:as. Roadmap-moduler/-branscher visas (märkta) men byggs ej, raderas ej.
- **mockup ≠ funktion:** varje kontroll som visas måste antingen vara wire:ad mot riktig tabell ELLER ärligt märkt (som designen gör). Aldrig fejk-success.
- **Bygg ALDRIG i repo-mappen** (`ö` → opennext-krasch). Endast `C:\tmp\kod` för opennext-build.
- **"Klart" = mekaniskt 0 FAIL** (render-verify) + oberoende verify — aldrig ögonmått.

## Verifiering (per våg)
- `pnpm --filter @corevo/web typecheck` = 0 · `pnpm --filter @corevo/web test` grön (+ nya) · opennext-build från `C:\tmp\kod` = "Compiled successfully".
- Render-verify studion på staging-testtenant: skapa kund e2e → storefront live → 0 FAIL.
- Flag-OFF byte-identisk: nuvarande form orörd.

## Kopplingar
CHECKLISTA W5 #20 (onboarding-v2, framflyttad) + W2 template-bron (goal-47: text/slot-write) + W3 moduler-end-to-end (NÄSTA goal, "modulerna funkar"). Design-LAG = `01-acceptans/super-admin/`. Sanningsdoc `02-Arkitektur-sanning.md` (läs före modul-wiring). Nuvarande: `components/platform/CreateTenantForm.tsx`, `app/(platform)/salonger/ny/page.tsx`.

## Rollback
Ny flagga + ny komponent vid sidan av `CreateTenantForm`. Rollback = flippa `ONBOARDING_STUDIO_ENABLED`→false (fallback till nuvarande form) eller `git revert`. Ingen DB-tabell tas bort (build-once).
