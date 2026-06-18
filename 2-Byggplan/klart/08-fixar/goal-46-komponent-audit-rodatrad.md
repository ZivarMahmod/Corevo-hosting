# goal-46 — Komponent-audit + röd-tråd-optimering (UI ↔ DB ↔ koppling)

**Datum:** 2026-06-17
**Typ:** Autonom ultracode-körning (subagent-flotta) — körs **PARALLELLT** med 37→45-sweepen, på **EGEN branch/worktree**.
**Vad detta är:** Gå igenom ALLA komponenter under `app/` + `components/` (inte en, ALLA), kolla deras verkliga bygge, jämför mot databasen och mot UI:t i sidorna, och optimera så allt flödar i en röd tråd UI → DB → kopplat. Inga lösa noder / återvändsgränder som inte ska vara det.

## Omfattning (faktisk, räknad 2026-06-17)
- **`components/` = 132 .tsx** över 10 domäner: admin(26) · storefront(27) · portal(21) · platform(20) · kund(18) · personal(9) · brand(8) · booking(1) · realtime(1) · sajtbyggare(1)
- **`app/` = 109 .tsx** i route-grupper: `(admin) (auth) (kund) (personal) (platform) (public)` + `api avboka boka sajtbyggare-spike`
- **Domän-logik:** `lib/` (admin, auth, booking, branding, gdpr, kund, notifications, observability, personal, platform, portal, stripe, storefront, supabase, tenant*)
- **DB-sanning:** migrationerna (`supabase/migrations/` — hitta exakt path) + LIVE-schemat via Supabase-connectorn på prod-projektet **`clylvowtowbtotrahuad`** (ALDRIG ygieacwrpevytghdxecd).

## ⛔ ISOLERING — får INTE krocka med 37→45-sweepen
- **Egen branch/worktree** (`components-audit`). Två Code-sessioner i samma working tree = korruption. Använd `git worktree`.
- **FAS 1 (MAP) = read-only → helt säker parallellt.**
- **FAS 2 (OPTIMERA) = editar → koordineras:** rör ALDRIG filer som sweepen har ocommittade ändringar i. Ta de domäner sweepen INTE rör först (brand, personal, portal, storefront, realtime), och sweepens domäner (sajtbyggare, booking, kund-dedup, platform) SIST / efter merge. Ärlig sanning: edit-fasen på samma filer samtidigt = merge-helvete → undvik.

## FAS 1 — MAP (read-only, fan-out 1 subagent per domän)
För VARJE komponent, kartlägg:
1. **Vad gör den** (verkligt bygge, inte namnet).
2. **DB-koppling:** vilken tabell / `lib/*/actions` den läser/skriver. Matchar den schemat (live-schema via connector)?
3. **UI-koppling:** vilken sida/route i `app/` använder den? Eller är den **oanvänd**?
4. **Röd tråd / lös nod:** flödar UI → action → DB → tillbaka korrekt? Eller är den en **återvändsgränd** (knapp utan handling, UI utan DB-backning, DB-fält utan UI, oimporterad komponent)?
- **Output:** en karta per domän + en master-lista **`LÖSA-NODER.md`** (`1-Planering/01-arkitektur/`): varje fynd = `fil · typ (oanvänd/död-knapp/UI-utan-DB/DB-utan-UI/schema-mismatch) · röd-tråd-status · åtgärd`.

## FAS 2 — OPTIMERA (edit, disjunkta revir, egen branch)
Per **bekräftat** fynd (adversariell verify — påstå inte):
- Lös nod som SKA kopplas → wire:a UI ↔ action ↔ DB hela vägen. Riktigt, inte stub.
- Avsiktlig återvändsgränd → flagga `AVSIKTLIG` i listan, lämna.
- Schema-mismatch → numrerad idempotent migration på `clylvowtowbtotrahuad` (+ RLS) så DB och kod är i synk. **DB får aldrig halka efter.**
- Död knapp / oanvänd komponent → koppla, eller ta bort om verkligt skräp (build-once: flagga först).
- En subagent = en domän = ett revir (disjunkta filer, ingen edit-krock). Frozen/delade filer (`tenant.ts`, middleware, types) = SOLO.

## Autonomi-regler
- Alla tekniska val själv, allt via kod/CLI, fråga aldrig droppvis.
- `npm run build` grön + 0-FAIL verify före varje commit. En commit per domän-batch.
- **Oberoende verify** per domän (granskar-agent som inte rättar sin egen läxa): bekräftar att fynden är äkta + att fixarna faktiskt sluter röda tråden.
- `/compact` i tid (stor körning, 241 filer).

## Guardrails
- Egen branch, rör ej POS/corevo.se, `private.tenant_id()`, `staff/staff_id`.
- Inget hårdkodat per bransch — komponenterna är universella (vilken bransch/kund som helst).
- Rör ej sweepens aktiva filer (se ISOLERING).

## Klar när
- [ ] Varje av de 132 + 109 filerna klassad: `kopplad` / `lös-nod-fixad` / `avsiktlig-död (flaggad)`.
- [ ] `LÖSA-NODER.md` komplett, 0 oavsiktliga lösa noder kvar.
- [ ] DB ↔ kod i synk (inga schema-mismatchar; migrationer applicerade på prod).
- [ ] `npm run build` grön, oberoende verify ren per domän.
- [ ] Branch redo att merge:a (konflikter mot sweepen lösta efter att den landat).

## Versionshistorik
| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-17 | Första utkast — grundad i faktisk struktur (132 components + 109 app, 10 domäner). |
