# FINSLIP-TODO — master-lista (start 2026-06-07)

Arbetssätt (Zivars beslut): allt som ska kollas listas här → ordnas **lättast → tyngst** → Nörden skriver ALLA briefs i förväg (röda tråden hålls en gång) → Zivar kör dem mot Code en efter en → Nörden verifierar varje. Små poster, inga klumpar.

---

## A. KOMMANDE 2 DAGAR (förslag — Zivar fyller på/ändrar)

### Dag 1 — stäng allt öppet, samla listan
- [x] **Stäng goal-23 helt:** DomänPanel ögonkollad 2026-06-07 (Integrationer-fliken: aktivt formulär + kvikta.se/demo.corevo.se "Verifierad", 0 console-fel) → goal-23 flyttad → `klart/01-grund/`
- [x] **Committa de 3 okommitterade** — klart: avbokning×2 i `25aa7aa` (pushad), custom-domains-ops committad tidigare
- [ ] **Zivar dumpar SIN lista** (allt i huvudet → sektion C nedan) → Nörden sorterar in i B/C, ordnar lättast→tyngst
- [ ] **Betal-rails-diskussion** (ES kassasystem / Swish Företag / Stripe / övriga) → beslut → underlag för policy-motor-brief
- [ ] **Purge-OK + seed-OK från Zivar** → städa testdata på prod + seeda bokningar så Bokningar-ön kan verifieras visuellt

### Dag 2 — briefs + börja beta av
- [ ] Nörden skriver **alla briefs** för den sorterade listan (en brief = en post)
- [ ] Kör de 2 kända buggarna: **personal-Idag-krasch** + **savePlatformBranding-clobber** (rotorsak obekräftad — repro: seeda media, ta bort bild, spara)
- [ ] **Ägar-toggles** (Zivar, ~10 min): auth-hook (Supabase Dashboard) · leaked-password-skydd · Stripe-testnycklar
- [ ] Börja beta av fin-slip-listan i ordning

---

## B. NÖRDENS GRANSKNINGSLISTA (känt läge, från HANDOFF + dagens session)

### Verifiering som aldrig gjordes klart
- [ ] **Bokningar-ön visuellt** — ViewSwitcher/Drawer/Toast aldrig renderade (kräver seedad bokningsdata)
- [ ] **TESTA-DETTA-03.md köras** — Zivars egen testlista (rollmatris + "försök tappa en bokning"), skriven men aldrig körd. Ligger nu i `2-Byggplan/`
- [ ] **Realtime cross-tab push-test** — kanalen bevisad ren, men live-uppdatering mellan två flikar aldrig testad
- [ ] **Mejl live-test end-to-end** — boka → bekräftelsemejl landar, SPF/DKIM grönt

### Drift/process-härdning
- [ ] **Innehållsbaserad smoke i deploy-runbooken** — dagens lärdom ×2: HTTP 200 ≠ funkar; body-grep på "Sidan kunde inte hittas" ljuger (RSC-boundary). Verifiera via `<title>`/`data-world`/hero
- [ ] **Deploy-checklista som EN fil** (robocopy /E → del .env.local → grep-guard → deploy → innehålls-smoke → version-ID) — finns spritt i HANDOFF/minne, ska bli runbook
- [ ] **CF Cron Triggers verifierade** — reminders + pending-expiry: är de aktiverade och kör de?
- [ ] **Doc-skuld:** runbooks nämner `demo.corevo.se` (slug bytte till freshcut) — städa referenser
- [ ] **Onboarding-steg 5 säger statiskt "SPÄRRAD"** (`lib/platform/tenants.ts:328`) fast DomänPanelen är live — texten ska spegla flaggan (kosmetiskt, fynd 2026-06-07)
- [ ] **Städa test-domäner i tenant_domains?** `kvikta.se` + `demo.corevo.se` ligger som "Verifierad" på freshcut (gamla test-rader) — Zivar beslutar behåll/ta bort

### Kända kod-gap (flaggade, ej fejkade — från HANDOFF)
- [ ] **Refund-paritet gäst-avboka** (`cancelByToken` refundar ej) — MÅSTE täppas innan betalning aktiveras
- [ ] **Poäng-revoke** — completed→cancelled återbetalar pengar men återkallar ej lojalitetspoäng (ofarligt tills redeem byggs — men bygg revoke FÖRE redeem)
- [ ] **Anon-läsbar pris-/avgiftskonfig** på `tenant_settings` — stäng bakom kolumn-vy FÖRE riktig multi-tenant-launch
- [ ] **Per-location pris = platt** — en prismodell oavsett plats (känt, beslut behövs om det ska byggas)
- [ ] **Storefront reveal-on-scroll** (`opacity:0`) bryter mot micro-interactions-canon — Zivars val: behåll eller ta bort (orörd tills beslut)

### Planerat men inte startat
- [ ] **Policy-motor avbokning/återbetalning** (specen LÅST i `1-Planering/03-avbokning/avbokning-aterbetalning-modell.md`) — rail-agnostisk, brief efter betal-rails-beslutet
- [ ] **Frisör-frånvaro → auto-omfördelning** av dagens bokningar (NY feature ur avboknings-specen)
- [ ] **Dela plattform-admin från salong-admin** (egen route/worker-isolering) — beslutat kort, efter baseline
- [ ] **Template-katalogen:** Zivar dumpar 100 templates i `4-Dokument-Underlag/03-template-katalog/00-inbox/` → ⚠️ licenskoll → svep → kandidater → Nörden deployar/screenshottar → val → ombrandnings-brief till Code
- [ ] **Ångerknapp-lagkravet (19 juni 2026)** — gäller presentkort/produkter, EJ bokade tider → triggas först när shop/presentkort byggs. Bevaka, blockerar inget nu

### Nördens kortlista (alla kända obekvämligheter — kortform, diskuteras vid sortering)

**Buggar/fixar:**
- [ ] Personal-Idag-kraschen
- [ ] Branding-clobber (savePlatform)
- [ ] "SPÄRRAD"-texten (steg 5)
- [ ] Refund gäst-avboka
- [ ] Poäng-revoke

**Verifiera/testa:**
- [ ] Bokningar-ön (seed först)
- [ ] TESTA-DETTA köras
- [ ] Realtime 2 flikar
- [ ] Mejl end-to-end
- [ ] Cron-triggers på?
- [ ] DomänPanel skarp-test (riktig CNAME)

**Städa/docs:**
- [ ] ROADMAP stale → uppdatera
- [ ] TESTA-DETTA stale → uppdatera
- [ ] HANDOFF bantas (336 rader)
- [ ] demo.corevo.se-referenser
- [ ] `.probe.md` skräp?
- [ ] Test-domäner bort? (kvikta/demo)
- [ ] Testdata-purge prod
- [ ] Version-ID-rutin deploy

**Beslut (Zivar):**
- [ ] Betal-rails-valet
- [ ] Reveal-on-scroll behåll/bort
- [ ] Per-location-pris ja/nej
- [ ] Redeem-poäng när?
- [ ] Deposition-toggle senare?
- [ ] DNS nord/barberco/leander/zigge?

**Säkerhet/launch-krav:**
- [ ] Anon prisconfig stäng
- [ ] Auth-hook toggle (du)
- [ ] Leaked-pw toggle (du)
- [ ] MFA super_admin
- [ ] DPA-mall
- [ ] Audit-logg-UI

---

## C. ZIVARS LISTA (fyll på här — ostrukturerat är fint, Nörden sorterar)

- _(tomt — dumpa allt ur huvudet)_

---

## Ordningslogg
| Datum | Vad | Status |
|---|---|---|
| 2026-06-07 | Listan skapad (A+B), C väntar på Zivar | öppen |
