# ROADMAP — allt som är kvar i pipen
Uppdaterad 2026-06-03 (efter att WORKFLOW-03 slutförts). EN vy över allt återstående. Källor: `3-Bakgrund-Research/*` + beslut i `HANDOFF.md`.

Status-koder: ✅ klar · 🔲 att bygga · ⏳ ägar-steg (Zivar) · ⚠️ lös tråd

---

## ✅ KLART (live)
- **WORKFLOW-03** VÅG 1–5 + FAS SLUT. Live worker `36fea384` (rollback `4bfead59`). 163/163 tester.
  Rollgränser täppta · migr/lojalitet-intjäning/boknings-spårbarhet · FreshCut-baseline (riktig data, salvia) · realtime + multi-salong · mangle-pass · POS orörd.

## ⚠️ LÖSA TRÅDAR FRÅN BASELINE (stäng innan/tidigt i nästa fas)
- ⚠️ **Media-bugg (Varumärke "Spara bilder & innehåll" kraschar vid bildborttagning)** — härdad men **EJ bekräftat löst**. Trolig orsak: komponent-render (ej action-svansen). Repro saknas (FreshCut har `branding={}`). Stäng: seeda media på test-tenant → ta bort → felsök render. *Kärnyta, verklig krasch.*
- ⏳ **TESTA-DETTA-03** (Zivar testar: rollmatris + "försök tappa en bokning" + boka→poäng).

## ⏳ ÄGAR-STEG (Zivar — blockerar ej, men krävs för full funktion/launch)
- Auth-hook-toggle (Supabase Dashboard) → full roll-matris i JWT.
- Stripe test-nycklar (Worker-secrets) → M8/betalning prövbar live.
- Kunddomän-DNS (väg A/B) → kunds egen domän live.
- leaked-password-toggle (HIBP) — medvetet av; revidera före produktion.
- Stäng anon billing-config (pre-launch).
- `SUPABASE_SERVICE_ROLE_KEY` (om ej satt) → `/registrera`.

---

## 🔲 KVAR ATT BYGGA (prioriterat)

### ⭐ #1 — DESIGN-TROHET ÖVER ALLA YTOR ("make-it-match") — Zivar-valt FÖRST (2026-06-03)
**Goal:** `2-Byggplan/goals/goal-17-design-trohet-make-it-match.md`.
Designen blir LAG: implementationen ska matcha mocken i **komposition + signatur-komponenter + interaktions-finish**, inte bara färg/font. Idag ~62% likhet (back-office), `/konto` 22%. `DESIGN-ELEGANS-playbook.md` blir en **bindande spärr** (screenshot sida-vid-sida mot mocken + §6-checklista per sida). Ordning: **back-office först** (super/salong/personal) → `/konto` → storefront-polish. Knappar/komponenter i designen som inte är byggda → **byggs**. Konsumerar **v3-paketet** (det maxade) när det landar → committas som kontrakt. Körs som WORKFLOW-04 (per-sida-flotta + verify-grind).
> ⚠️ **Deadline-krock:** ångerknappen nedan har hård lagdeadline **19 juni 2026** (16 dgr). Design är #1 enligt Zivar, men ångerknappen får inte tappas — kör den **parallellt** (helt skilt revir: avboknings-flöde vs UI-polish).

### 🔴 Tidskänsligt / legal-MÅSTE
1. **Ångerknapp** — lagkrav **19 juni 2026** (SFS 2026:246). Tvåstegs, tydligt märkt, bekräftelse m. tidpunkt. Grunden finns → möt exakt spec. *Deadline → kör PARALLELLT med #1 ovan (skilt revir).*
2. **DPA / personuppgiftsbiträdesavtal** — lagkrav (Corevo = biträde). Mall + accept i onboarding.
3. **SCA/3DS verifierat + dispute-webhook** (`charge.dispute.*`) — Stripe-vägen.

### 🟠 Betal- & boknings-kärnan (bär produkten)
4. **Provider-arkitektur** — `payment_provider` per salong (`stripe` | `eskassa` | framtida), gemensam adapter, aldrig kedja. *Fundament för #5 + #6.*
5. **ES Order-integration** (`provider=eskassa`, FreshCut) — staged plan i `es-dinkassa-DJUP`:
   - **Stage 0** (blockerande, kan göras NU): maila ES — creds per salong, Pro vs Pro+, `State`-värde, embedda ES Order vs bygga på API.
   - **Stage 1** single-tenant pilot · **Stage 2** durabel + multi-tenant (Vault + Queues + DLQ + reconciliation) · **Stage 3** härda/skala.
6. **Deposit / no-show-skydd + boknings-regler + lojalitet:**
   - Betala i förväg ELLER på plats (kundval).
   - Obetald bokning → max 2 kommande besök.
   - Längre fram / fler tider → betala i förväg.
   - Lojalitetskund → förboka flera populära tider (t.ex. 4).
   - Tvingad avbokningspolicy (≥24h annars hela tjänsten) + samtyckes-steg vid bokning.

### 🟡 Admin / plattform
7. **Dela plattform-admin från kund-admin** (super_admin-isolering, mindre attackyta).
8. **MFA för super_admin** · **audit-logg-UI** (din tvärs-vy + salongens egen) · **per-tenant-övervakning + larm**.

### 🟢 Kund-sida (konvertering + retention)
9. Snabba vinster: **visa betyg/recensioner vid Boka-knappen** · **klicka-för-att-ringa** · **rebook vid checkout** · bekräfta längd+tid före submit.
10. **Återhämtning avbrutna bokningar** · **väntelista** · **post-visit-uppföljning** · prestanda-budget <3s · review-loop ALLA till Google (ingen gating).

### ⚪ Drift
11. **Status-sida** · **testad restore-drill** · incident-playbook.

---

## Föreslagen ordning
**#1 design-trohet (goal-17)** + **ångerknapp parallellt (deadline 19 juni)** → stäng media-bugg + (Zivar) testa baseline → **provider-arkitektur (#4)** låser upp **ES Order (#5) + deposit/boknings-regler (#6)** → DPA + Stripe-legal (#2,#3) → admin (#7,#8) → kund-sida (#9,#10) → drift (#11).
Var och en blir en goal-brief eller en WORKFLOW-04-fas när den tas.

## Kan göras NU (parallellt, blockerar inget)
- **ES Stage 0-mail** till api@eskassa.se (svaret behövs innan ES-bygget).
- Zivars ägar-steg ovan.
