# WORKFLOW-04 — Super-admin FUNKTION (audit-fix, auto-körning)

**Detta är den ENDA arbetsordern för denna körning. Code arbetar med dessa 6 goals — inget annat.**
Inte design, inte storefront-polish, inte andra moduler. Riktig funktion bakom super-admin-ytan (det man "skulle kunna köra i en console-UI bara funktionen funkar"). Plan: `2-Byggplan/AUDIT-FIX-PLAN-superadmin-2026-06-04.md`. Källa: `4-Dokument-Underlag/superadmin-db-audit-2026-06-04.md`.

---

## 0. SCOPE-SPÄRR (läs först, gäller hela körningen)
- ✅ **I scope:** ENBART goals 18–23 nedan, i ordning.
- ⛔ **Utanför scope (rör INTE):** design/UI-estetik, storefront, `/konto`, kiosk, andra moduler, refaktorering "passande på vägen". Ser du något annat trasigt → **logga det i `KÄNDA-ÄRENDEN`/goal-loggen, fixa det INTE** här.
- ⛔ **POS heligt:** `corevo.se` / `admin.corevo.se` / `kiosk.corevo.se` rörs ALDRIG. Verifiera 200/200 efter varje goal.
- 🧭 **Bärande regel:** all data i UI ska ha riktig DB-koppling — ingen hårdkodad siffra som kan förväxlas med kunddata. Ärlig nolla OK, fejk inte.
- 📏 **Hårda regler (HANDOFF):** migrationer numrerade + idempotenta + rollback · RLS via `private.tenant_id()`/`is_platform_admin()` · roll/tenant ur `app_metadata` · atomärt → `SECURITY DEFINER`+`search_path=''`-RPC · build-once-never-delete · `bookings.customer_profile_id` rörs aldrig.

---

## 1. KÖR-ORDNING (en goal i taget — ALDRIG parallellt)

| # | Goal | Fil | Risk | Auto-deploy? |
|---|---|---|---|---|
| 1 | RLS `rate_limit_hits` | `goals/goal-18-rls-rate-limit-hits.md` | 🔴 | DB-only, Zivar har auktoriserat RLS-fix — kör, men INSPEKTERA skrivaren först |
| 2 | Ärlighetspass | `goals/goal-19-arlighetspass.md` | 🟡 | JA (ingen migration, låg risk) |
| 3 | Tenant-data/onboarding | `goals/goal-20-tenant-data-onboarding.md` | 🟠 | JA (additiv migration + rollback) |
| 4 | RBAC-rättigheter | `goals/goal-21-rbac-rattigheter.md` | ⚫ | **NEJ — Zivar-OK före prod-deploy** (auth-känsligt). Bygg + testa + commit, vänta på go för deploy |
| 5 | Lägg till kund-drawer | `goals/goal-22-lagg-till-kund-drawer.md` | 🟡 | JA |
| 6 | DomänPanel self-serve | `goals/goal-23-domanpanel-self-serve.md` | ⚫ | **Bygg + enhetstesta bakom flagga. Live-aktivering GATAD på Zivars CF-token** (ops). Deploya ej domän-live autonomt |

---

## 2. PER-GOAL-LOOP (kör exakt så här för varje goal)
1. **Läs hela briefen** för goal N (varje sektion). Underlaget = LAG.
2. Etablera lägesbild: `ls migrations/` (rätt nästa nummer), läs berörda filer.
3. **Bygg** enligt brief-stegen. En goal, ett revir.
4. **Gate (alla MÅSTE vara gröna innan nästa):**
   - `pnpm typecheck` 0 fel · `pnpm lint` 0 fel · `pnpm test` (vitest) grön
   - Brief-sektionens **Verifiering**-checklista mekaniskt avbockad (inte ögonmått)
   - Migration (om någon): applicerad + idempotent (kör 2×) + rollback nedskriven
   - **POS `corevo.se`+`admin.corevo.se` → 200**
   - DB-bevis där briefen kräver (t.ex. "fyll i UI → syns i DB")
5. **Oberoende verify:** en separat granskar-agent/pass dömer resultatet mot briefens Verifiering (byggaren rättar inte sin egen läxa). Adversariell för 🔴/⚫.
6. **Commit** (en goal = en logisk commit). Deploya enligt tabell kolumn "Auto-deploy?".
7. **Flytta** `goal-NN-*.md` → `2-Byggplan/goals/_klart/`. Uppdatera `HANDOFF.md` med worker-ver + rollback-id + gate-siffror.
8. Nästa goal. Aldrig hoppa, aldrig parallellt.

---

## 3. STOPP-VILLKOR (pausa + flagga Zivar, kör INTE vidare)
- 🛑 Gate röd som inte kan lösas inom briefens scope.
- 🛑 En migration vill bli destruktiv utan ren rollback.
- 🛑 GOAL-21 redo för **prod-deploy** → vänta på Zivars OK (auth-känsligt).
- 🛑 GOAL-23 behöver CF-token/ops för live → bygg klart bakom flaggan, flagga ops-steget, gå vidare utan att blockera (det är sista goal:en ändå).
- 🛑 Något utanför scope verkar trasigt → logga, fixa inte.
- 🛑 POS svarar inte 200 efter en ändring → rollback omedelbart.

## 4. KLART = HELA WORKFLOWEN
Alla 6 i `_klart/`, varje med grön gate + oberoende verify + POS 200/200 + uppdaterad HANDOFF. Då: super-admin-ytan är ärlig (noll falska knappar/fejk-data), RBAC är riktig, kund-drawer + onboarding-fält + egen-domän-skrivväg byggda hela vägen till DB.

## 5. PARKERAT (ej i denna workflow — egen planering senare)
- Superadmin-settings-katalog ("vad ska superadmin egentligen ha för inställningar"). De gamla 4 reglagen togs bort i GOAL-19; rätt uppsättning designas separat.
- Riktig magic-link-personal-invite (epost + roll + auth-invite) — GOAL-19 wirar bara befintliga `createTenantStaff`.
- Salong self-service-ytor (färg/öppettider/bild/produkt) mot RBAC från GOAL-21.
