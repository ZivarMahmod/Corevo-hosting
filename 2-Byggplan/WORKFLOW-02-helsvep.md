# WORKFLOW-02 — Helsvep: aligna mot plan + design, täpp gap, verifiera (end-to-end)

**Datum:** 2026-06-02
**Vad detta är:** Hela finish-jobbet i ETT dokument. Klistra in i Code, kör uppifrån och ner.
**Lägg i:** `2-Byggplan/`. Ersätter `workflow-01` för denna runda.

> ⚠️ **Detta dok är avsiktligt kompakt.** Det re-specar INGET — det pekar till modul-doken. Varje agent öppnar SITT modul-dok + design-referensen och bygger därifrån. Klistra inte in modul-doken i context; läs dem per behov.

---

## LÄS FÖRST (i denna ordning)
1. `CLAUDE.md` + `HANDOFF.md` — regler + nuläge.
2. De 8 spikade doken — **ALLA i `2-Byggplan/`:**
   - `2-Byggplan/` → `M2-storefront.md`, `M3-bokningsmotor.md`, `M4-kundportal.md`, `M5-personalportal.md`, `M6-salon-admin.md`, `M7-platform-admin.md`, `M8-betalningar.md`
   - `2-Byggplan/DESIGN-SYSTEM-referens.md` (design ↔ modul-mappning)
   - ⛔ Öppna INTE `1-Planering/moduler/` — det är de GAMLA för-bygge-specarna (ersatta av M-doken ovan).
3. Design-bundlen: `2-Byggplan/corevo-booking-design-system v2/project/` — `colors_and_type.css` (tokens) + `ui_kits/*` (prototyper). **Recreate pixel-perfekt i Next, läs källan, screenshota inte.**
   - **M6-tillägg:** `2-Byggplan/corevo-booking-design-system v2/project/handoff-assets/` → `Corevo M6 Build Spec.html` + `img/` + `spec-data.js` (extra byggspec för salon-admin).

---

## HÅRDA REGLER (gäller hela vägen)
- **Aligna, bygg INTE om.** Plattformen är byggd & live. Rör inte fungerande kod. Fyll gap, aligna mot design, verifiera. Riv aldrig en grön yta.
- **Frozen files = SOLO:** `packages/db`, `packages/auth`, `middleware.ts`, `lib/tenant*.ts`, root-config, design-tokens. Rörs bara i solo-faser (Våg 0).
- **Parallellt = git worktrees**, en mapp per agent. Aldrig 2 agenter i samma mapp/revir.
- **Per modul:** bygg klart ditt revir → **rapportera KLAR + STANNA** → verifieras → nästa. "Klart" är en avsikt, inte ett bevis.
- **Riktigt, inte stubbar.** Varje knapp gör något; varje vy har laddar/tom/fel/lyckat-läge. Inga döda toggles (M6-princip).
- **POS-guardrail:** rör ALDRIG corevo.se POS-DNS/records. Bara booking/demo/tenant-hostar.
- **ö-fällan:** `ö` i mappnamnet bryter OpenNext/esbuild → bygg/deploya från ren ASCII-väg (`C:\tmp\kod` + `pnpm install`).
- **Pushat ≠ deployat.** Verifiera den körande sidan, inte att en commit gått.
- **Test live** mot deployen + demo-kontona, inte bara localhost.

## AGENT-ORKESTRERING
- **En agent per revir per våg.** Spawna **tillräckligt** för att köra hela vågen parallellt — snåla inte med agenter när reviren är skilda.
- **Men ingen överbyggnad:** slå inte ihop orelaterade revir i en agent för att "spara", och splittra inte ett revir på många agenter. **Lagom flotta.**
- Varje agent rapporterar även **UX-luckor den ser utanför sitt revir** (inte bara sin grej).

## 👤 PENDING-OWNER (Zivar, out-of-band — Code rör dem inte, loopar inte, re-rapporterar inte)
1. `SUPABASE_SERVICE_ROLE_KEY` som Worker-secret → registrera/personal-invite funkar.
2. Stripe **test-nycklar** + en **Connect**-webhook-endpoint + dess secret → M8 kan verifieras (se M8 §2.1/§5).
3. Verifiera bundlen vid deploy (ASCII-väg).
Markera som "pending-owner" i rapporten. Allt annat görs klart utan att vänta.

---

## FAS 0 — GRANSKA PLANEN (innan en kodrad)
Spawna **adversariella granskar-subagenter** som läser de 8 doken MOT den faktiska koden och flaggar: motsägelser, gap vi missat, frozen-file-krockar mellan vågorna, allt som inte håller. **Landa fynden med Zivar innan bygge.** (Detta är Zivars "fler ögon"-steg.)

---

## FAS 0.5 — FIXA KÄNDA BUGGAR FÖRST (solo, innan align-svepet)
Två verifierade buggar i live-koden. Fixa + deploya + verifiera **innan** ny kod staplas på samma ytor (annars byggs de in igen):
1. **`savePlatformBranding`-clobber** (`5-Kod/apps/web/lib/platform/actions.ts` ~rad 236) — `branding`-objektet byggs utan `...prev` → en plattforms-branding-save **raderar ägarens uppladdade storefront-media** (hero/galleri/about/closing/team/stats/accent) ur DB. Fix: spreada `...prev`, skriv bara ändrade fält. **Guard:** M6 §3.6 + M7 §2.1B skriver BÅDA tenant-branding — båda måste **merga, aldrig ersätta hela objektet**.
2. **Personalvyns "Idag" kraschar** (`app/(personal)/personal/...` + `lib/booking/tz.ts`) — `Invalid Date` → `.toISOString()`. Klippare ser inte dagens bokningar. Fix: tåla saknad/ogiltig tid, rendera tom-läge istället för krasch.

---

## VÅG 0 — SOLO (fundament, rör frozen files — ALL db-ändring sker HÄR)
1. **Kund-tabell + identitet/PII** (M6 §4) — stabil kund-identitet, PII tidsbunden/maskad, migrera bort gäst-i-`note`. *Fundament för M4-lojalitet, M5-klientkort, M6-kunddatabas.* (db = frozen.)
2. **Schema-modell: bokbara starttider** (M6 §5) — `working_hours` (fast öppen/stäng-raster) → **explicita, ev. ojämna bokbara starttider** per frisör. Detta är en **db/migration-ändring (frozen)** → görs HÄR i Våg 0-solo, **inte** i Våg 1-M6 (annars rör Agent C frozen db parallellt). Bara vyer/UI lämnas till M6.
3. **Design-token-baseline** — koppla `colors_and_type.css` som källa; säkerställ att färg/font/copy/tema läses som **runtime `tenant_settings`**, ej build-inlinat (M2 §2.4). (tokens = frozen.)

> Våg 1 startar inte förrän Våg 0 är grön + verifierad.

## VÅG 1 — PARALLELLT (skilda revir: storefront · platform · salon-admin)
- **Agent A — M2 storefront:** SEO-svit + redigerbar copy + aligna 5 teman mot tokens/ui_kit + **token-audit: noll hårdkodade Corevo-färger i storefront** (t.ex. stjärnbetyg `#F5A623` → tema-accent-token). (Se `M2-storefront.md` + design §3.)
- **Agent B — M7 platform:** operativ data-kontroll-UI (no-code) + onboarding djupare/inga-måste-fält + boknings-vy-val per tenant + aligna SuperAdmin. (`M7-platform-admin.md`.)
- **Agent C — M6 salon-admin:** kunddatabas-vy + branding live-preview/undo/spara-utan-deploy (**merga branding, aldrig ersätta hela objektet — se FAS 0.5**) + branding-editorn exponerar copy-fälten **eyebrow / om-text / italic-fras** (M2 §2.3), ej bara namn/logga/färg/font/hero/tagline + sanna toggles + tjänster-storefront-placering + inga-måste-fält + schema-**VYER** (db-modellen byggd i Våg 0) + verifiera personal-invite. (`M6-salon-admin.md`.)

## VÅG 2 — PARALLELLT (ovanpå kund-tabell + M6-schema)
- **Agent D — M4 kundportal:** lojalitet (poäng/tier per salong, completed-gated) + favoriter + behåll Google-nudge + aligna Account. (`M4-kundportal.md`.)
- **Agent E — M5 personalportal:** klientkort + kundnoteringar (internt/vaktat) + drop-in + schema = ägar-baseline/frisör-operativ + aligna. (`M5-personalportal.md`.)

## VÅG 3 — SOLO/KÄNSLIGT (bokningskärna + pengar)
- **M3 bokningsmotor:** 5-min-hold + release + "togs av annan"-vy · combo/multi-tjänst · per-frisör steg/buffert · "Alla"-union+tilldela · avbokningsfönster ur settings · flytt-av-betald. (`M3-bokningsmotor.md`.)
- **M8 betalningar:** verifiera **Connect**-webhook i test-mode · håll lagret **vilande** (default av, dagens flöde oförändrat) · flytt-av-betald bär betalning · no-show-refund byggd-ej-aktiverad. (`M8-betalningar.md`.)

## VÅG 4 — TVÄRGÅENDE
- **Tablet:** långlivade sessioner (iPad + Android-platta) + äkta responsivt tvärs admin + storefront (design §7).
- **Slut-verifiering:** e2e mot demo-kontona live + adversarial review av hela systemet + deploy-verify (ö-path, live smoke 200, POS orörd).

---

## VERIFIERING (per modul OCH till slut)
- Bygg/lint/typecheck/test gröna.
- Verifiera mot **faktisk kod + körande sida**, inte Code:s "klart".
- RLS/tenant-isolering intakt (kund A ser ej B).
- Inga döda toggles, inga döda länkar, alla states finns.
- Design: rätt `data-world` + tema, aldrig Corevo-grön på storefront.
- POS (corevo.se) orörd.

## KLAR-KRITERIUM
Alla 7 moduler aligned mot plan + design, gap täppta, allt verifierat live mot demo-kontona, betalning vilande men verifierad i test-mode, tablet/responsivt OK, POS orörd. Pending-owner-grejerna kvarstår hos Zivar — de blockerar inte "klart".
