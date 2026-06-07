# M7 — Platform Admin (målbild + gap)

**Datum:** 2026-06-02
**Status:** Spikad i planeringspass med Zivar.
**Ersätter:** den gamla `1-Planering/moduler/M7-platform-admin.md` (för-bygge-spec).
**Läs först:** `HANDOFF.md` + `CLAUDE.md`. `private.tenant_id()`, POS-guardrail, audit-guard (frisor3-radering blockeras med flit).

> **Röd tråd:** M7 är **Zivars kontrollcenter** — provisionerar alla tenants, äger det översta anpassningslagret (premium), driver onboarding. Top-tier i två-nivå-modellen (M2): ägaren = leksakslådan, **Zivar = full kontroll**.

---

## 0. Vad modulen ÄR

Zivars masterkontroll över hela plattformen. Hans vision i hans egna ord: **"Supabase-kraft med mitt UI — en plats jag kan klicka och leka med allt, men med röd tråd och meningsfulla flikar. Premium utan kod."**

---

## 1. Ytor — byggt / stale / saknas

| Yta | ✅ Byggt | ⚠️ Stale (medvetet) | ❌ Saknas |
|---|---|---|---|
| **Tenants** | `/salonger` lista, `/salonger/[id]` detalj, `/salonger/ny` skapa (atomiskt: slug+settings+roll) | — | — |
| **Onboarding** | 6-stegs-stege (`deriveOnboarding`) | steg 5 domän **spärrat** (UI-only, `tenant_domains` saknar status) | domän-provisionering (§5) |
| **Drift** | suspend (→ publik blockeras), audit-logg | — | — |
| **Fakturering** | `/fakturering` — underlag flöde 2 (per_booking/flat_monthly, completade/mån per salong) | spec ville Stripe-prenumerationer + MRR/churn | (medvetet bort — §2.2) |
| **Branding per tenant** | `PlatformBrandingForm` (basal) | — | **premium/devtools-lagret (§2.1)** |
| **Dashboard** | `/platform` | tunn | rik insyn (§2.3) |

---

## 2. Spikade beslut (M7)

### 2.1 Premium-lagret — KORRIGERAT: operativ data-kontroll utan kod, INTE design-UI

Två saker hölls isär fel tidigare. Rätt distinktion:

**A) Storefront-LOOK = kod i säker miljö (inte M7) — MED ETT EXPLICIT UNDANTAG.** Att ändra hur en storefront *ser ut* görs med **kod, i en säker miljö** (Zivar + Code) — aldrig via no-code-UI. Det är premium-design­arbetet Zivar tar betalt för.

*FAS 0-korrigering 2026-06-02 — ZIVARS BESLUT (carve-out, aligna ord mot kod):* "M7 rör ALDRIG utseendet" undantar **basal per-tenant token-branding** — färg / font / logo + **temamall-val** — som **TILLÅTEN no-code i M7**. Detta är redan byggt och avsiktligt no-code: `PlatformBrandingForm` (primär/bg/text-färg, `font_body`, logo-upload) + `CreateTenantForm` (Temamall-val → `nav_variant`/`hero_variant` + palett). "Kod i säker miljö" reserveras för **nivå-3 scoped CSS-overrides** — det är DET som aldrig får bli no-code. Token-branding = leksakslådan; nivå-3-overrides = premium-design via kod. (Nivå-3 scoped overrides finns i arkitekturen men appliceras via kod, inte en UI-builder.)

**B) "Supabase med mitt UI" = operativ data-kontroll utan kod (DETTA är M7).** Det Zivar vill slippa: klicka i **råa Supabase** för operativa uppgifter. Exponera dem i hans strukturerade UI, no-code:
- lägga till / välja kund
- skicka **lösenords-reset**
- sätta / redigera salongens **Google-recensions-länk**
- redigera tenant-data
- … "och massor" liknande klick-i-Supabase-uppgifter

Meningsfulla flikar, röd tråd. **"Premium utan kod" = data/drift, inte utseende.**

### 2.2 Fakturering flöde 2 — manuell + underlag (inget Stripe)
Behåll det byggda: systemet ger **underlag** (completade bokningar/mån per salong, billing_model), Zivar fakturerar manuellt utanför systemet. Inga Stripe-prenumerationer, ingen MRR/ARR/churn-automation. (Spec var stale här.)

### 2.3 Dashboard — Zivars insyn över ALLA salonger
Visar: **antal salonger · aktiva vs inaktiva · bokningar totalt · faktureringsunderlag per salong.** Klick-och-lek, drill-down till tenant-detalj. Meningsfulla flikar, röd tråd.

### 2.4 Onboarding & personal-hjälp — Zivar-driven
- Zivar **skapar tenants** (salonger är hans kunder — inte publik self-service).
- Zivar kan **onboarda personal åt en salong** via M7 (M6 §3.4) om de vill ha hjälp.
- **Välj boknings-vy per tenant i onboarding** — Zivar väljer vilken bokningsvariant salongen får (Variant 3 default / Variant 4 snabbboka / annan). Saknas idag. Kopplar M3 + design `booking-variants/*`.
- **Djupare onboarding, INGA måste-fält** — mer info kan fångas, men **inga forcerade required-värden som blockerar** (Zivar hit friction på det när han la upp en tjänst). Fyll det som finns, inget gate:ar.

---

## 3. Röd tråd — kopplingar

| Koppling | Vad M7 gör | Var det andra bor |
|---|---|---|
| **M7 → alla** | provisionerar tenant, sätter nivå 1–3, suspend | varje modul respekterar tenant-status |
| **M7 → M2** | premium nivå-3-overrides renderas på storefront | M2 renderar scoped overrides |
| **M7 → M6** | Zivar-assisterad personal-onboarding; obegränsad ägar-kontroll | M6 äger salongsdata |
| **M8 → M7** | faktureringsunderlag från completade bokningar | M8/M3 äger bokning |

---

## 4. Bygg-items (vad Code faktiskt gör i M7)

**Rör INTE** (byggt): skapa-tenant-atomicitet, onboarding-stege, suspend, audit, slug, billing-underlag, guard. Bygg ovanpå. **Audit-guard (frisor3) ska blockera — det är rätt.**

1. **Operativ data-kontroll (§2.1B):** UI för Zivars klick-i-Supabase-uppgifter — lägga till/välja kund, lösenords-reset, Google-recensions-länk, redigera tenant-data, m.m. No-code, strukturerade flikar. **Storefront-look byggs INTE här** (kod/säker miljö, §2.1A).
2. **Dashboard-insyn (§2.3):** antal salonger, aktiva/inaktiva, bokningar totalt, underlag per salong, drill-down, meningsfulla flikar.
3. **Personal-onboarding via M7 (§2.4):** Zivar lägger till personal åt en tenant.
4. **Behåll manuell fakturering** (§2.2) — ingen Stripe-prenumeration.

---

## 5. Parkerat (planerat, byggs inte först)

- **Custom domain / "egen domän"** (onboarding-steg 5) — gated/UI-only idag (`tenant_domains` saknar status-kolumn). Eget planeringsspår. Subdomän `salong.corevo.se` räcker tills vidare.
- **Nivå-3 scoped CSS-overrides** — görs ALDRIG via no-code-UI. Look på den nivån = kod i säker miljö (§2.1A). *(FAS 0-korrigering 2026-06-02: gäller nivå-3-overrides — basal token-branding (färg/font/logo + temamall-val) ÄR tillåten no-code i M7, se §2.1A.)*
- Stripe-prenumerationer, MRR/ARR/churn-automation — slopat (manuell modell).
- Automatiserad provisionering, reseller-program, API-access — v2.

---

## 6. Öppet kvar

Inget blockerande. Exakt vilka nivå-3-kontroller som ingår i premium-v1 (vilka overrides) finputsas vid bygge — håll listan strukturerad, inte freeform.
