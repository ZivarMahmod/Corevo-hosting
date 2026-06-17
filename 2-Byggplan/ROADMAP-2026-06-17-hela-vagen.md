# ROADMAP — Hela vägen framför oss (2026-06-17)

**Varför det känns långt:** du har 5 spår igång samtidigt (deploy, sajtbyggare, multibransch, verify-skuld, fakturering). Det är inte *långt* — det är *otrågt*. Den här filen lägger dem i EN ordning så varje steg stängs innan nästa börjar. Vägen är ändlig: **NU → A → B → C → D → E.** Vi är i slutet av A.

Ryggraden = loop-brytar-ordningen du låste 2026-06-15: **A gör bygget verkligt → B bevisa med 1 riktig kund → C stabilisera → D bredd.** (+ E fakturering.)

---

## 📍 NU — var vi står

- **goal-34 (Sajtbyggare S1)** klar hos Code (region-manifest + 3-nivå-kaskad + DOM-markörer). Väntar oberoende verify.
- **fix-35 (domän deploy-safe)** skriven, redo för Code. ← *härnäst i kö.*
- **Prod live:** worker `bokningsplatformen`, tenant Test Barber, domäner stabiliserade. Design v3 LÅST. 7 moduler live. Princip LÅST (universal motor + variant, aldrig fork).

---

## ▶️ HÄRNÄST — stäng Fas A (deploy verkligt + stabilt + rent)

**Mål:** en deploy kan ALDRIG ta ner en kund · allt byggt är bevisat live · repo rent.

1. **fix-35** → Code bygger (`add-domain.mjs` = CF API-attach + wrangler.jsonc-rad + validator) → jag verifierar (2 deploys, test-barber 200 hela vägen, inget flimmer) → `klart/`.
2. **goal-34 verify** → oberoende (kaskad Universal→Bransch→Kund, markörer i DOM, gates gröna) → `klart/`.
3. **Arkivera superseded:** `fix-33` + `goal-32` (domän-mekaniken ersatt av fix-35) → `klart/08-fixar/`.
4. **Verify-to-close-pass** (deployat men aldrig stängt): `goal-27` (admin-split 3 dörrar), `goal-28` (wildcard `*.boka`), `goal-30` (multibransch-motorn) → live-verifiera → `klart/`. `fix-29` (superbooking-krasch) + `fix-26` (refund-paritet) verify. `fix-25` (kosmetisk) stäng.
5. **Git-städning:** committa doc-skuld (scoped, ej 5-Kod) + gitignore 6.9 MB `01-acceptans/standalone/`-HTML.

→ **Klart när:** `goals/` bara innehåller framtidsbriefs — inget "verify-kvar", inget superseded.

---

## 🧩 ÖPPNA BESLUT — blockerar Fas B+ (beta av med dig i ett beslutspass)

De 5 som blockerar närmast (resten ~18 i `moduler/00-INDEX.md`, tas i batcher):

1. **booking `object:table`-kapacitet** (restaurang-bord) + `party_size`/`address`-kolumner → **kräver ditt schema-go** (rör `no_double_booking`).
2. **intag — rättslig grund** (Patientdatalag 2008:355 + DPA, EJ samtycke) → **juridik, blockerar privatklinik**.
3. **namn `vehicles`/`pets`** (vs `_profiles`) → bekräfta.
4. **café-lojalitet earn-source** (ny trigger på `shop_orders`) → välj.
5. **booking `variant_schema` / verticals.rules** → bekräfta.

\+ **fakturering-detaljer:** Swish auto-bekräfta vs manuell knapp v1 (reko: manuell v1), vad ingår i 399 kr, moms 25 %.

---

## 🏗️ FAS B — Bevisa multi-bransch med 1 riktig kund

**Mål:** Corevo bevisat som icke-bara-frisör.

- **booking bransch-medveten** — *enda riktiga nybygget i modul-lagret.* Bord/slot/drop-off/syntest via `verticals.rules` — EN motor, ingen fork. (Kräver beslut 1 ovan.)
- **Onboarda 1 riktig restaurang live** (bordsbokning), storefront + admin-flöde end-to-end.

→ **Klart när:** en riktig icke-frisör-kund tar bokningar live.

---

## 🎨 FAS C — Sajtbyggare-editor (kund redigerar sin sida själv, live)

Låst riktning: visuell klick-editor (EJ page-builder/drag-drop), HTML-mall as-is, TipTap för text.

- **S2 — visuell editor-motor:** klick-overlay (egen, per INRIKTNING-LÅST) + TipTap (MIT, text) + R2-bildväljare + tokens-sidopanel + XSS-sanerare (edge). Puck i reserv om overlay blir tung. Klicka element → redigera text/bild/färg → live, **ingen deploy**.
- **S3 — onboarding-integration:** tema + branding + bilder + texter fylls i SAMMA editor under sign-up.

→ **Klart när:** kund bygger/ändrar sin sida utan oss. (S0 + S1 redan klara.)

---

## 📦 FAS D — Bredd (per riktig kund, en modul/bransch i taget)

- **9 nya moduler** i prio-ordning: `fordon` → `recurring` → `meny` → `portfolio` → `orderstatus` → (fördröjt pga legal/rails: `intag`, `deposit`, `inlamning`). Build-once, aktivera per kund.
- **Nya branscher** (en `verticals`-rad per kund — gratis, ingen kod): bilverkstad, café, hundsalong, privatklinik, florist, tatuering, cykel, optiker…
- **Modul-djup:** shop / offert / blogg / lojalitet / presentkort utbyggnad mot v3.
- **Mall-galleri (S4–S5):** ~100 vendor-mallar via render-bron, per-mall-automation (~0,5–1 dag/mall när moget).

---

## 💰 FAS E — Fakturering + drift

- **Billing:** 399 kr/mån platt. Swish-QR manuell v1 ("jag har betalat" + Godkänn) → auto sen. Moms 25 %. Cloudflare Analytics-räknare så kunden ser värdet. Infra ≈ 1 kr/kund.
- **Stabilitet:** 2 kända buggar (`savePlatformBranding`-clobber, personal-"Idag"-krasch), R2-toggle, uptime-mot-kund.

---

## 🧹 PARALLELLT / FINSLIP (när-som, blockerar inget)

- Test-domäner bort (kvikta.se / demo.corevo.se), Supabase-toggles (auth-hook + leaked-password), cron-verify (reminders + pending-expiry).
- Research → doc: CF-ekonomi-skolan, Supabase-skolan, kassasystem-research (10 vanligaste SE), konkurrenter (Bokadirekt/Fresha/Timma), bytes-playbook, marknadsenkät-analys.
- Ägar-ops: `goal-23` CF-for-SaaS-secrets + `DOMAIN_PROVISIONING_ENABLED` (för kund-EGNA domäner senare).

---

## 🧭 Spelregler (varför ordningen är låst)

- **En goal i taget → verify → `klart/`.** "Klart" = deployat + bevisat, aldrig "kod committad".
- **Universal motor + variant per bransch — ALDRIG fork.**
- **Build once, never delete, activate when needed.**
- **POS `corevo.se` + de 3 fasta hostarna får aldrig gå ner.**
- **Deploy-first:** bevisa innan mer byggs.

---

*Källor: ROADMAP-bryt-loopen-2026-06-15 · MASTER-LISTA · FINSLIP-TODO · moduler/00-INDEX (+16 spec) · 06-sajtbyggare (S0/S1-UTFALL, INRIKTNING) · 07-efter-sajtbyggaren · 08-fakturering · HANDOFF. Synt via 4 parallella subagenter 2026-06-17.*
