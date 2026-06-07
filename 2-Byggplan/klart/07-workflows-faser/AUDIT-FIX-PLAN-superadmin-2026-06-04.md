# EXEKVERINGSPLAN — Superadmin-audit-fix (2026-06-04)

Bygger på `4-Dokument-Underlag/superadmin-db-audit-2026-06-04.md` (19 noder, Zivar-verifierad).
Besluten nedan är **låsta av Zivar 2026-06-04**. Code expanderar **en goal i taget** → verifierar → `2-Byggplan/goals/_klart/`.

---

## 0. BÄRANDE REGEL (gäller ALLA goals här)
**All data som syns i UI ska ha en riktig DB-koppling. Ingen hårdkodad siffra/sträng som kan förväxlas med kunddata.** Raderar man en kund → räknaren visar 11, inte 12. Visas ett fält i frontend → det finns en kolumn/tabell bakom + en skriv-väg. Ärlig nolla (tom tabell) är OK. Fejkad "live"-data är det INTE.

Standard-regler från HANDOFF gäller fortsatt: POS `corevo.se`/`admin.corevo.se`/`kiosk.corevo.se` ALDRIG rörd · RLS via `private.tenant_id()` · roll/tenant ur `app_metadata` · atomärt → RPC (`SECURITY DEFINER` + `search_path=''` + idempotent) · migrationer numrerade + idempotenta + rollback · build-once-never-delete · `bookings.customer_profile_id` rörs ALDRIG.

---

## 1. BESLUTSLÅS (vad Zivar valde)

| Nod | Beslut |
|---|---|
| #1 Hjälp salongen | **Simplify hårt.** Bort med falska "allt loggas"-toasten. Minimal ärlig variant: ETT `logPlatformAction`-anrop när hjälp-läge öppnas (loggas hos plattformen/Zivar, inte salongen). Ingen impersonation, ingen före→efter-diff. Om det blir krångligt → döda knappen helt. |
| #2 Bjud in personal | **Wire** drawern till befintliga `createTenantStaff` (`actions.ts:491`). |
| #3 Påminn | **Dölj** (ingen reminder-action finns). |
| #4 Hantera / #5 Docs | **Dölj döda knappar.** Wire bara det som har ett riktigt mål. |
| #6 Lägg till kund-drawer | **Bygg helt** → riktigt formulär → skriver rad i `customers`. |
| #7 RBAC-matris | **Bygg helt** inkl. schema: rättighetslagring + redigerbar matris (checkbox/toggle/save) + enforcement-läsning. |
| #8 Settings 4 reglage | **Ta bort** (fel noder — t.ex. Auto-klar bokningar är en *salong*-grej, inte plattform). Park: egen plan "vad ska superadmin ha för inställningar". Bygg INGET brus. |
| #9 DomänPanel | **Bygg helt** → egen-domän-flöde hela vägen → `tenant_domains` + Cloudflare. (Knyter an till roadmapens goal-16 self-serve.) |
| #10 Ägar-namn | **Bygg riktig koppling** — namn lagras i en riktig kolumn och LÄSES i plattform/salong-vy (inte bara död `user_metadata`-skrivning). |
| #11 Roll-väljare wizard | **Bygg riktig väljare** i steg 5 → skriver `users.role_id`. |
| #12 Hälsopiller | **Lämna ärligt "ej kopplad"** (ljuger inte). Ingen fejk. Riktig telemetri = framtida, egen grej. |
| #13 Integration-badge | **Härled från riktig signal.** Badge bara på integration som faktiskt funkar hela vägen (t.ex. Stripe kopplad). Ej-riktig/ej-testad → ingen badge / "Inaktiv". |
| #14 Stad-kolumn | **Bygg riktig:** `tenants.city`-kolumn + inmatning i onboarding/redigera + live-visning. |
| #15 Bokningar-kolumn | **Wire riktig** per-salong-bokningsräkning (läs `bookings`, ärlig 0). |
| #16 Senast aktiv-kolumn | **Relabela** "Senast aktiv" → "Skapad" (visar riktig `tenants.created_at`). |
| #17 Variant-etikett | **Bugfix** → använd kanoniska `readBookingVariant` (4-id), inte legacy-parsern. |
| #18 Nivå-badge | **Koppla till riktig RBAC-roll** (salong = sin self-service-nivå, Zivar = full access), inte döda `layout.*`-nycklar. Ingen fantom-Nivå-3-CSS-väg. |
| #19 platformMetrics (död kod) | **Lämna dormant** (build-once-never-delete). Markera, radera inte. |
| RLS-hål | **Fixa nu** — policy på `private.rate_limit_hits` + slå på RLS, med koll på utelåsningsrisk. |

---

## 2. GOAL-SEKVENS (prioriterad — säkerhet → ärlighet → schema → byggen)

### 🔴 GOAL-18 — RLS-hål `private.rate_limit_hits` (SÄKERHET, först)
**Varför först:** Supabase-advisor flaggar kritiskt; minst jobb, störst risk om den lämnas.
- **Scope:** Skriv RLS-policy för `private.rate_limit_hits`, slå på RLS. Tänk igenom vem som skriver/läser tabellen idag (rate-limit-vägen) så policyn inte låser ute den legitima skrivaren → ingen utelåsning.
- **Migration:** ny numrerad (`00NN_rls_rate_limit_hits.sql`), idempotent, med rollback (`disable row level security` + `drop policy`).
- **Verify:** advisor 0 ERROR på den · rate-limit-vägen fungerar fortsatt (skriv + läs testas) · ingen legitim väg utelåst · POS 200/200.
- **Risk:** 🟡 (rör en live-tabell — verifiera skrivvägen INNAN RLS slås på).

### 🟢 GOAL-19 — Ärlighetspass (kill lögnerna + snabb-wires + bugfixar, INGA migrationer)
**Varför näst:** Tar bort all aktiv vilseledning snabbt, låg risk, ingen schema.
- **#1 Hjälp salongen** → ta bort falsk toast; lägg ETT `logPlatformAction` vid öppning (ärlig, plattformssidig). Blir det rörigt → dölj knappen.
- **#2 Bjud in personal** → wire drawer-submit till `createTenantStaff` (finns). Kontrollera fälten (epost/namn/salong) på riktigt.
- **#3 Påminn** → dölj.
- **#4 Hantera / #5 Docs** → dölj döda knappar.
- **#13 Integration-badge** → härled status ur riktig kopplings-signal (0 = Inaktiv); badge bara på verkligt funkande.
- **#15 Bokningar-kolumn** → wire riktig räkning ur `bookings`.
- **#16 Senast aktiv** → relabela till "Skapad".
- **#17 variant-etikett** → `readBookingVariant`.
- **#18 Nivå-badge** → läs riktig roll/`roles.level` istället för döda `layout.*`-nycklar.
- **#8 Settings 4 reglage** → ta bort de vilseledande reglagen (ärlig tom/“under utveckling” är OK; helst bort).
- **#19** → lämna `platformMetrics` dormant; lägg ev. en `// dormant — build-once`-kommentar, radera inte.
- **Verify:** vitest grön · grep: inga kvarvarande toast-only-knappar som påstår åtgärd · klick på varje f.d. falsk knapp gör nu antingen riktig sak eller finns inte · POS 200/200 · 0 console-fel inloggat.
- **Risk:** 🟡 (många små ytor — verifiera per nod).

### 🟠 GOAL-20 — Tenant-data & onboarding-komplettering (migrationer)
**Scope:** Riktig DB-koppling för de fält UI lovar.
- **#10 Ägar-namn** → bestäm lagring: namn-kolumn på `users` ELLER läs `auth.user_metadata.full_name` i vyn. Välj EN, koppla skriv→läs hela vägen så namnet syns i plattform/salong-vy.
- **#11 Roll-väljare wizard steg 5** → riktig väljare → `users.role_id` (passar när RBAC ändå byggs i goal-21).
- **#14 Stad** → `tenants.city`-kolumn + fält i onboarding + redigera-vy + live-visning i översiktstabellen.
- **Migration(er):** numrerade, idempotenta, rollback. `tenants.city` additiv. Ev. `users`-namnkolumn additiv.
- **Verify:** fyll i stad/namn/roll i UI → syns direkt i DB (Zivars "Zigge→kebabsås"-test) · redigera → uppdateras · tom = ärlig tom · POS orörd.
- **Risk:** 🟠 (schema, men additivt).

### 🟠 GOAL-21 — RBAC-rättigheter (största — egen goal)
**Scope:** Gör behörighetsmatrisen riktig.
- **#7** → rättighetslagring i DB (`roles` har bara `name`+`level` idag → behövs rättighets-kolumner/tabell, t.ex. `role_permissions(role_id, area, can_*)` eller jsonb-permissions). Redigerbar matris (checkbox/toggle) + save-action + enforcement-läsning i appen.
- **Koppling till Zivars "nivå"-tanke:** salong-ägare (salon_admin) = avgränsad self-service (branding, öppettider, bild-upp, produkt-för-försäljning) UTAN att störa Zivar; Zivar (superadmin) = full access. Matrisen ska uttrycka EXAKT det.
- **Migration:** ny tabell/kolumner, RLS via `private.tenant_id()` där relevant, rollback.
- **Anti-pattern:** rättigheter får ALDRIG enforceras bara i frontend — DB/RLS + server-action är sanningen.
- **Verify:** ändra en rättighet i matrisen → sparas i DB → enforceras (en roll utan rätt nekas server-side) · adversariell roll-check (ingen bypass) · POS orörd.
- **Risk:** 🔴 (auth/behörighet — kräver rollback + noggrann verify, ev. Zivar-OK före deploy).

### 🟠 GOAL-22 — "Lägg till kund"-drawer (full till DB)
- **#6** → drawer blir riktigt formulär → `customers`-insert (tenant-scopat, `private.tenant_id()`), validering, fel-hantering, lista-refresh.
- **Verify:** skapa kund i UI → rad i `customers` · syns i listan direkt · fel-fall (dubblett/tomt) hanteras · tenant-isolering håller · POS orörd.
- **Risk:** 🟡.

### 🔴 GOAL-23 — DomänPanel self-serve (egen domän hela vägen)
**Scope:** Bygg #9 fullt → `tenant_domains` + Cloudflare for SaaS.
- **Bygger på** befintlig grund: migration `0019 resolve_tenant_by_domain` + `lib/custom-domain.ts` + middleware-fallback finns redan (WORKFLOW-03 VÅG 3). Detta är "skriv-vägen": panel → skapa custom hostname + DCV → sätt `tenant_domains`-rad.
- **Bakom** `DOMAIN_PROVISIONING_ENABLED` tills verifierad.
- **Verify:** lägg domän i panel → `tenant_domains`-rad + Cloudflare custom hostname skapad + DCV-status visas · verifierad domän → storefront resolvar (white-label) · POS orörd · rollback rent.
- **Risk:** 🔴 (extern provider + DNS — egen goal, noggrann verify; OPS-steg åt Zivar separat).

### 📋 PARKERAT (ej goal — egen planering)
- **Superadmin-settings-katalog:** "Vad ska superadmin EGENTLIGEN ha för inställningar?" De 4 gamla reglagen var fel. Designa rätt uppsättning separat innan något byggs. (Triggern: `projekt-metodik` / beslutsgenomgång.)
- **Salong self-service-ytor** (ändra färg/öppettider/bild/produkt utan att störa Zivar): mycket finns redan (Varumärke §4.3 m.m.); kartlägg gap mot RBAC-rättigheterna i goal-21 — ev. egen goal.

---

## 3. SEKVENS-LOGIK (varför denna ordning)
1. **18 RLS** — säkerhet, billigast, först.
2. **19 Ärlighet** — döda lögnerna direkt, noll schema, låg risk → snabbt förtroende.
3. **20 Tenant-data** — additiv schema-grund (namn/stad/roll) som 21 lutar sig mot.
4. **21 RBAC** — störst, bygger på 20:s roll-väljare.
5. **22 Kund-drawer** — fristående feature.
6. **23 DomänPanel** — störst extern risk, sist, egen verify.

En goal i taget. Code kör → verifierar oberoende → flyttar till `_klart/` → nästa.

---

## 4. NÄSTA STEG
Säg vilken goal jag ska expandera först till en **full körbar brief** (format som `goal-16`). Default-förslag: **GOAL-18 (RLS)** — minst, säkrast, rensar advisor-flaggan. Sen GOAL-19.
