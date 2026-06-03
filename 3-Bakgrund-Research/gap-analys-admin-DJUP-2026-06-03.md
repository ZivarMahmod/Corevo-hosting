# Corevo Booking — Verified & Extended Gap Analysis (Salon + Sweden + Multi-Tenant)

## TL;DR
- **The original gap analysis is broadly correct on its 12 items, but missed two genuinely Sweden-specific legal landmines:** (1) the **distansavtalslagen 14-day ångerrätt** that applies to online salon bookings and can make your headline deposit/no-show-fee feature unenforceable if designed naively, plus a NEW mandatory in-app "ångerfunktion" cancellation button from 19 June 2026; and (2) the **kassaregisterlagen** certified cash-register/kontrollenhet obligation that affects how FreshCut handles in-salon card/cash payments.
- **Confirmed legal-musts:** a written GDPR Art. 28 personuppgiftsbiträdesavtal (DPA) with each salon is legally required (IMY confirms); EEA card payments legally require SCA/3D Secure (Stripe PaymentIntents handles this); dispute webhooks (charge.dispute.*) are a real gap; MFA for super_admin is best practice, not optional.
- **Skip for now (overkill at your scale):** SOC 2 certification, schema-per-tenant isolation, a hot standby DR site, and quarterly third-party pentests. One annual pentest, RLS shared-schema, and PITR restore drills are the right level.

---

## Key Findings

1. **A written DPA (personuppgiftsbiträdesavtal) between Corevo and each salon is legally mandatory — not optional.** Corevo is the data processor (personuppgiftsbiträde); each salon is the controller. IMY states the relationship "ska" be regulated by a written agreement under GDPR Art. 28.
2. **SCA/3D Secure is legally required for your EEA card payments**, and your PaymentIntents flow must surface the `requires_action` 3DS challenge. The legacy Charges API is not SCA-ready.
3. **The deposit / no-show-fee feature — your single biggest product value item — collides with Swedish consumer withdrawal law** in a way the gap analysis did not flag. This needs careful flow design, not just a Stripe integration.
4. **Dispute/chargeback handling (charge.dispute.*) is a real, currently-unhandled gap** with money and deadlines attached.
5. **A certified kassaregister + kontrollenhet may be required at the salon** — a Sweden-specific obligation entirely absent from the gap analysis.
6. **Everything the gap analysis says you already do well is genuinely best practice** (RLS tenant isolation, EU residency, append-only audit log, double-booking EXCLUDE constraint, PITR backups).

---

## Details

### GROUP A — LEGAL-MUST

**A1. Data Processor Agreement (personuppgiftsbiträdesavtal / PUB-avtal) — GDPR Art. 28**
- **Real requirement for us? YES.** When a SaaS hosts salons' customer data on the salons' behalf, the SaaS is the **personuppgiftsbiträde (processor)** and each salon is the **personuppgiftsansvarig (controller)**. IMY states plainly that the parties "ska reglera sina relationer genom ett skriftligt avtal," and Art. 28(9) requires the contract be "in writing, including in electronic form." Missing/deficient DPAs are among the most common deficiencies IMY finds in audits, and can trigger sanction fees regardless of whether harm occurred.
- **Concrete best practice:** A DPA covering the Art. 28(3) minimums: subject matter, duration, nature/purpose, data types, categories of data subjects; processing only on documented instructions; confidentiality; Art. 32 security measures; sub-processor rules (general written authorisation + notice of changes so the controller can object); assistance with data-subject rights and breach notification; deletion/return at end; audit rights. You can base it on the EU Commission's standard contractual clauses for controller-processor or the Danish DPA's Nordic template (IMY-recognised). Maintain a **sub-processor list** (Supabase/AWS eu-north-1, Cloudflare, Stripe, email provider) — this is also an Art. 30 record obligation.
- **Minimum reasonable implementation:** A single click-through DPA bundled into the salon onboarding/Terms acceptance (electronic form is valid), with a published, versioned sub-processor list and an email-notify mechanism for sub-processor changes. This is a low-cost, high-priority must-do before onboarding FreshCut.

**A2. SCA / 3D Secure verified in the PaymentIntent flow**
- **Real requirement for us? YES.** SCA is mandatory under PSD2 for card payments where both business and cardholder bank are in the EEA (in force since 14 Sept 2019). FreshCut (Linköping) and Swedish cardholders are squarely in scope. Stripe: "Card payments require you to use 3D Secure to meet SCA requirements," and the legacy Charges API "isn't SCA-ready."
- **Concrete best practice:** Use the PaymentIntents API (you already do). Stripe triggers 3DS dynamically; your front end MUST handle the `requires_action` status and present the 3DS challenge (`stripe.handleNextAction` / `confirmCardPayment`). Successful 3DS authentication shifts fraud-dispute liability to the issuer. Test both successful and failed 3DS with Stripe's 3DS test cards. Note: under **Direct charges on connected accounts, Radar/3DS rules are governed by the connected account**, not the platform — verify FreshCut's account-level rules.
- **Minimum reasonable implementation:** Confirm your client handles `next_action` (don't assume frictionless), and add the 3DS test cards to your test plan. If you ever fall back to Checkout, it handles SCA automatically.

**A3. Dispute / chargeback webhooks (charge.dispute.*)**
- **Real requirement for us? YES — practically.** You currently handle only `charge.refunded`. Stripe notifies disputes via webhook, debits the disputed amount **plus a dispute fee**, and gives a limited response window — per Stripe Documentation ("Respond to disputes"): "you have a limited window to respond (usually 7 to 21 days, depending on the card network)"; missing it means "you automatically lose the dispute and can't retrieve the disputed funds." With deposits/no-show fees, disputes are a predictable cost center for a barbershop.
- **Concrete best practice:** Subscribe to `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, and ideally `radar.early_fraud_warning.created`. Verify signatures, process idempotently by event id, return 2xx fast, and queue async work. On Direct charges the dispute belongs to the connected account — route the alert to the salon and surface evidence (booking record, policy acceptance, reminder logs) to contest.
- **Minimum reasonable implementation:** Handle `charge.dispute.created` → notify super_admin + the affected salon by email, store the dispute with its `due_by`, and provide a one-click way to submit evidence (or auto-attach the booking + policy-acceptance record). Even just reliable alerting beats silent loss.

**A4. MFA / 2FA for super_admin (at minimum)**
- **Real requirement for us? YES (best practice; effectively a must for platform admin).** OWASP: "Always enforce MFA for administrators or high-privilege accounts." Microsoft Security (Melanie Maynes, 20 Aug 2019, "One simple action you can take to prevent 99.9 percent of attacks") states MFA "can block over 99.9 percent of account compromise attacks" (Microsoft separately reports MFA "can block more than 99.2% of account compromise attacks"). A super_admin compromise = cross-tenant breach of every salon's customer data.
- **Concrete best practice:** Enforce TOTP MFA for all super_admin and salon_admin accounts; require re-authentication before changing MFA settings or email; provide one-time backup codes (single-use, brute-force protected, notify on use); log all MFA events. Supabase Auth supports MFA and exposes Assurance Level (AAL2) — you can even gate sensitive RLS policies / admin actions on `auth.jwt()` showing AAL2.
- **Minimum reasonable implementation:** TOTP enforced for super_admin now; offer (then later require) it for salon_admin. Avoid SMS as the only factor (SIM-swap risk).

**A5. (MISSED BY GAP ANALYSIS) Swedish withdrawal right (distansavtalslagen) vs. your deposit/no-show fee**
- **Real requirement for us? YES — and it directly constrains your flagship feature.** An online booking is a **distansavtal**; under Lag 2005:59, the consumer has a **14-day ångerrätt** that, for a service, starts the day the contract is concluded. **Konsumentverket's position is that hairdressers/barbers are NOT covered** by the "fritidsaktivitet on a fixed day" exemption (2 kap. 11 § p.12) — that exemption is read narrowly (cf. Marknadsdomstolen MD 2016:13). Konsumentverket states bluntly: "Salongen får inte ta ut en avgift om du ångrar dig, oavsett hur nära inpå du ångrar dig." Frisörföretagarna contest this and say it must be court-tested; **there is no Swedish supreme-court ruling**, and ARN has consistently sided with consumers. **If you fail to inform about ångerrätt, the withdrawal window extends up to one year (2 kap. 12 §).**
- **Concrete best practice / how to make deposits legally safe:**
  - **Timing arbitrage (the practical safe harbor):** Properly inform about ångerrätt at booking so the 14-day clock starts. For appointments booked **more than 14 days out**, the withdrawal right lapses before the appointment, and a normal cancellation/no-show fee (reflecting the salon's actual cost) becomes an enforceable ordinary contract term.
  - **"Fully-performed + express waiver" (2 kap. 11 § p.1):** capture the consumer's express consent to begin the service and acknowledgement that the withdrawal right is lost once fully performed — but this only protects a fee for a service *already completed*, and a waiver cannot be taken before the withdrawal period has started (MD 2005:37, MD 2009:8). It does not save a no-show fee for an appointment cancelled before it happens.
  - **From 19 June 2026 (SFS 2026:246), you must build a mandatory "ångerfunktion"** — an easy-to-find, clearly labelled in-app/website "ångra avtalet här" button available throughout the 14-day window, capturing name + contract identification + the consumer's chosen receipt format, and auto-sending a durable-form mottagningsbevis (receipt) with the time of receipt. The same reform bans "dark patterns." Non-compliance is treated as otillbörligt under Marknadsföringslagen.
- **Minimum reasonable implementation:** (1) Show clear ångerrätt information + record policy acceptance at booking (start the clock, avoid the 1-year extension); (2) make deposit/no-show fees default to appointments booked >14 days ahead, OR implement the express-waiver consent for near-term bookings; (3) ship the ångerfunktion + durable receipt ahead of the 19 June 2026 deadline. This is the single most important salon-specific design correction in this report.

**A6. (MISSED BY GAP ANALYSIS) Certified kassaregister + kontrollenhet (kassaregisterlagen)**
- **Real requirement for us? PARTLY — it's the salon's legal obligation, but it shapes your product.** Swedish law requires businesses selling against cash or card payment to use a **certified cash register with a kontrollenhet** ("Skatteverkets svarta låda"); Swish and electronic payments count as cash-equivalent. The exemption is cash/card sales up to 236,800 SEK incl. VAT for 2026, per Skatteverket: "Fyra prisbasbelopp för år 2026 är 236 800 kronor (4 × 59 200 kronor)" — below this, kontantförsäljning is deemed "av obetydlig omfattning" and no certified register is required. **Online-only payment (e-handel) where payment occurs online is exempt** — so Corevo's online deposits are likely outside the kassaregister requirement, but FreshCut's in-salon card/cash checkout is in scope. Note the "Frisörboxen" (CleanCash multi-user) exists precisely for salons with multiple org-numbers (hyrstol/chair-rental) on one system.
- **Concrete best practice:** Decide explicitly whether Corevo offers an in-salon POS/checkout. If yes, it must integrate a certified kontrollenhet and issue compliant receipts for every sale (cash/card/Swish); from 1 Jan 2027 the register must meet SKVFS 2021:17 (XML export). If no, document that the salon must use its own certified register for in-person payments and that Corevo handles only online distansköp.
- **Minimum reasonable implementation:** Scope decision in writing now. For FreshCut's launch, treat in-salon payments as out-of-scope for Corevo (online deposits only), and flag chair-rental/multi-org scenarios for the roadmap.

### GROUP B — PRODUCT VALUE (booking-specific)

**B1. Deposits / no-show fee at booking**
- **Real requirement for us? YES — it's table stakes in this category.** Every major competitor offers it. Per Fresha's blog ("How to protect your business from no-shows"), the cancellation-policy feature "has the ability to reduce no-shows and last-minute cancellations by up to 90%" (Fresha adds: "On average, 1 in 10 salon or spa appointments is cancelled or lost when clients don't show up"). Per Booksy, "a month after implementing No-Show Protection settings, providers had 20% fewer cancellations" and "there was no significant impact on bookings." GlossGenius states: "Businesses using deposits with GlossGenius see a 32% increase in successful appointments on average—translating to nearly $1,000 of additional monthly revenue" (flat 2.6% processing rate). Notably, **Square does NOT offer a true booking deposit** (only prepayment or card-hold) — a long-standing user complaint and a differentiation opportunity. Swedish competitors Voady and Wavy emphasise SMS reminders/waitlist to cut no-shows.
- **Concrete best practice:** Stripe-backed deposit collected at booking (PaymentIntent with SCA), applied to the final bill; configurable per-service and per-client (e.g., exempt trusted/returning clients), with a "capture card / charge fee on no-show" option. Crucially, wire it to the **A5 withdrawal-law flow**.
- **Minimum reasonable implementation:** Per-service deposit toggle + card-on-file capture, defaulting to compliance-safe timing (>14 days) or express-waiver consent.

**B2. Cancellation policy enforced (accept before booking + fee within window)**
- **Real requirement for us? YES.** All competitors display the policy at the "confirm with card" step and let the salon set the window (commonly 24h standard, 48h for high-value/colour services) and fee (up to 100%).
- **Concrete best practice:** Require explicit policy acceptance at booking (store the acceptance + timestamp as dispute/ångerrätt evidence), configurable cancellation window + fee %, automatic fee capture from card-on-file.
- **Minimum reasonable implementation:** Checkbox acceptance with stored timestamp + a per-salon window/fee setting enforced at cancellation.

**B3. Waitlist (notify me of earlier slot)**
- **Real requirement for us? YES — common and valued, lower legal risk.** Booksy auto-notifies waitlisted clients when a slot opens; Voady markets väntelista as a core no-show/utilisation tool. It directly recovers revenue from the cancellations your A5/B1 flow will generate.
- **Concrete best practice:** Clients opt into a waitlist per service/stylist/date-range; on cancellation, auto-notify (SMS/email — SMS has ~98% open rate per Wavy's cited figure) with a time-boxed booking link. Supabase Realtime can drive instant notifications but **respects RLS**, so ensure SELECT policies scope waitlist rows correctly.
- **Minimum reasonable implementation:** Simple waitlist table + a cron/trigger that emails the first eligible waitlister when a slot frees up.

### GROUP C — OPERATIONS / SCALE

**C1. Audit log viewable in UI**
- **Real requirement for us? YES (you already log; readability is the gap).** OWASP A09 treats audit trails with integrity controls (append-only) as a core control; you have the append-only log but admins can't read it. Best practice: RBAC-restricted viewer, and log access to the audit log itself.
- **Minimum reasonable implementation:** A super_admin (and scoped salon_admin) read-only, filterable view (by tenant, actor, action, date). Mask/omit secrets and session IDs per OWASP logging guidance.

**C2. Per-tenant health/monitoring + alerts**
- **Real requirement for us? YES, lightweight.** You have Sentry + structured logging; the gap is per-tenant signal. Best practice: per-tenant error-rate/booking-success/payment-failure metrics with thresholds that alert (so one salon's broken integration is caught before they complain).
- **Minimum reasonable implementation:** Tag Sentry events + structured logs with tenant_id; add a couple of alert rules (payment-failure spike, webhook failures, error-rate per tenant).

**C3. Tested restore / DR drill**
- **Real requirement for us? YES.** You have PITR + R2 versioning, but an untested backup is a liability. Best practice across DR sources: test restores at least quarterly and after major infra changes; define RTO/RPO; document the runbook. Daily/weekly automated verification for critical data is ideal.
- **Minimum reasonable implementation:** A documented quarterly PITR restore drill into a scratch project, verifying a known booking/customer row and recording RTO achieved.

**C4. Incident playbook + status page**
- **Real requirement for us? YES, lightweight.** Best practice: a public status page (hosted separately from your infra so it survives an outage) with component status, incident history, and subscribe option; plus an incident playbook with severity levels and a comms cadence (e.g., updates every 30–60 min). Reduces support load and churn during incidents.
- **Minimum reasonable implementation:** A hosted status page (e.g., a third-party provider's free tier) + a one-page incident playbook defining sev levels, on-call owner, and customer-comms templates.

**C5. Penetration testing cadence (and SOC 2 = premature)**
- **Real requirement for us? Annual pentest YES; SOC 2 NO (premature).** Industry consensus: at least one annual pentest, plus tests after significant changes; grey-box, scoped to your app/API. SOC 2 is principles-based and not legally required; it's driven by enterprise-buyer demand. At your scale (first barbershop customer), SOC 2 is overkill — revisit when you start selling to chains/enterprise that demand it in vendor due diligence.
- **Minimum reasonable implementation:** Budget one annual grey-box pentest of the app + API + auth + multi-tenant isolation; keep the report + remediation log. Run after any major architecture change.

### Verified "already doing well" (confirmed genuinely best practice)
DB-level RLS tenant isolation via `private.tenant_id()` (Supabase explicitly recommends RLS as the security floor and "defense in depth" — confirmed best practice, and correctly NOT relying on UI filtering); EU residency (eu-north-1 keeps data in EU, simplifying transfer rules); append-only audit log (OWASP A09); rate-limiting on login/booking (OWASP credential-stuffing guidance); CSP/HSTS; secrets scanning; double-booking EXCLUDE constraint; GDPR self-service export + deletion while retaining ~7-year payment records; PITR + R2 versioning; email confirmation + reminder cron; structured logging + Sentry. **One nuance:** Cloudflare Workers secrets must use `wrangler secret` / Secrets Store (not plaintext `vars`), and use `crypto.subtle.timingSafeEqual` for webhook-signature comparison.

### The 7-year retention rule (confirmed)
Bokföringslagen requires räkenskapsinformation (incl. payment/accounting records) be retained **7 years after the end of the calendar year** in which the financial year ended (so a calendar-year 2025 record is kept through 31 Dec 2032; a broken financial year ending 30 June extends it to 7 years and 6 months). Your "retain payment records ~7 years while honouring GDPR deletion" design is correct: erase marketing/profile PII on request, but retain transaction records as a legal obligation (GDPR Art. 17(3)(b)). Note the 1 July 2024 modernisation now allows keeping records in digital-only form (paper originals may be discarded once correctly transferred).

---

## Recommendations (staged)

**Stage 0 — Before onboarding FreshCut (legal-musts):**
1. Ship the click-through **DPA** + sub-processor list (A1).
2. Verify the **3DS `requires_action` handling** in the live PaymentIntent flow + connected-account Radar rules (A2).
3. Add **`charge.dispute.created` handling** with alerting + stored `due_by` (A3).
4. Enforce **TOTP MFA for super_admin** (A4).
5. Resolve the **kassaregister scope decision** in writing (A6).

**Stage 1 — Make the booking product legally safe + valuable (next sprint):**
6. Implement the **ångerrätt-aware deposit/cancellation flow** (A5 + B1 + B2): policy acceptance + ångerrätt info stored with timestamp; deposits default to >14-day bookings or use express-waiver consent.
7. Ship **waitlist** (B3).

**Stage 2 — Operations hardening (next quarter):**
8. **Audit-log UI viewer** (C1); **per-tenant alerts** (C2); **quarterly restore drill** (C3); **status page + incident playbook** (C4).

**Stage 3 — Before 19 June 2026 / first enterprise deal:**
9. Ship the mandatory **ångerfunktion + durable receipt** and dark-pattern review (A5).
10. Commission the **first annual pentest** (C5).

**Thresholds that change these recommendations:**
- Add a true in-salon POS → kassaregister/kontrollenhet becomes a hard must (A6).
- Sign a salon chain / enterprise buyer that demands it → start SOC 2 (otherwise skip).
- Cross-region expansion outside EU → revisit data-residency/transfer (currently a non-issue at eu-north-1).
- Dispute volume rises → upgrade A3 from "alert" to automated evidence submission.

## Caveats
- **The hairdresser ångerrätt question is contested and untested in a Swedish court.** I report Konsumentverket's/ARN's position (no exemption; fee unenforceable on withdrawal) as the prudent operating assumption, while flagging Frisörföretagarna's dissent and the residual litigation risk. Get Swedish consumer-law counsel before finalising the deposit flow.
- No-show-reduction figures (Fresha "up to 90%", Booksy "20% fewer cancellations", GlossGenius "32% increase in successful appointments") are **vendor-reported marketing claims**, not independent studies — directionally useful, not guarantees.
- Stripe dispute response windows ("usually 7 to 21 days, depending on the card network") and SCA exemption thresholds (e.g., TRA up to €250 EEA) are Stripe-documented but change; verify current values at integration time.
- This is engineering/operational guidance informed by primary sources, not legal advice.