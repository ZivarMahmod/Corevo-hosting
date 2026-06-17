# goal-46 — AUDIT-PLAN (exekverbar) · komponent-audit + röd-tråd-optimering

> **Detta är planen** (lfg-steg 1). Spec = `2-Byggplan/goals/goal-46-komponent-audit-rodatrad.md`. Master-fyndlista = `LÖSA-NODER.md` (skapas av FAS 1). Live-schema = `_schema-snapshot-live.md`.
> Körs i isolerad worktree `../corevo-audit` på branch `components-audit` (bas: clean `main` @ `199d560`). Parallellt med 37→45-sweepen på `sajtbyggare-100-templates`.

## Lägesbild (verifierad 2026-06-17)
- 132 komponenter (storefront 27, admin 26, portal 21, platform 20, kund 18, personal 9, brand 8, sajtbyggare/realtime/booking 1 vardera) + 109 app/-filer + 18 lib-domäner.
- Migrations topp = **0038** på BÅDA branscher → nästa fria = **0039** (re-kolla taket precis före varje migration; sweepen kan ha lagt fler).
- Sweep-branch hade **0 divergens** mot main vid start (allt committat som `199d560`). Sweepens live-footprint syns bara som ocommittade filer i HUVUDträdet → koordineras live (se nedan).
- Connector = `clylvowtowbtotrahuad` ENDAST.

## Isolerings-/koordineringsregel (kritisk)
- Jobba ALDRIG i huvudträdet `firsör-sas`. Bara i `corevo-audit`.
- Sweepens domäner (edit SIST): **sajtbyggare, booking, kund, platform**. Sweep-fria FÖRST: **brand, personal, portal, storefront, realtime, admin**.
- **Före varje FAS 2-domänbatch:** kör `git -C <huvudträd> status --porcelain` → hoppa ALLA filer sweepen har öppna just då. Aldrig editera en fil sweepen rör.

## AVSIKTLIG-lista (FAS 2 får INTE "koppla upp" dessa — flagga som AVSIKTLIG, lämna)
- booking-variant `drawer`/`inline` (presentation-deferred).
- `holds.ts` / `0014_slot_holds` (vilande, ej applicerad — säkert).
- F2 instant-attach domän-automation (vilande).
- GrapesJS = FÖRKASTAT (editor = TipTap + klick-overlay). render-bron stannar.
- DomainPanel bakom `DOMAIN_PROVISIONING_ENABLED=false` (fail-closed utan secrets) — vilande tills ops.
- `SAJTBYGGARE_ENABLED` av i prod.
- Cross-tenant plattform-vyer (SuperCustomers/Staff/Ops) — RLS-deferred.
- storefront reveal-on-scroll `opacity:0` — medvetet behållet (Zivar "jaga inte").
- onboarding steg-5 "🔒 SPÄRRAD" statisk (`lib/platform/tenants.ts`) — kosmetisk doc-skuld.
- **Betalningar PAUSADE (Stripe)** — payments/refund-paritet vilande tills Zivar aktiverar rails. `avboka cancelByToken` refund-paritet = deferred.
- RBAC `role_permissions`-matris = diff-0, RÖR EJ enforcement.

## Guardrails
Rör ej POS/`corevo.se`, `private.tenant_id()`, `staff`/`staff_id`-namn. Inget hårdkodat per bransch (komponenter universella). **build-once: ALDRIG radera** — flagga oanvänt, ta ej bort. Migrationer additiva + idempotenta + behåll RLS.

## FASER
### FAS 1 — MAP (read-only, fan-out via Workflow, 1 agent/domän → 10 agenter)
Per fil: vad den gör · DB-tabell/action (mot snapshot) · vilken sida importerar den (verifiera dynamiska/lazy/sträng-importer FÖRE "oanvänd") · klassning {kopplad / oanvänd / död-knapp / UI-utan-DB / DB-utan-UI / schema-mismatch / AVSIKTLIG} · röd-tråd-status · åtgärd · confidence. Output → `LÖSA-NODER.md`. **Commit LÖSA-NODER.md (durabelt) innan FAS 2.**

### FAS 2 — OPTIMERA (edit, disjunkta revir, sweep-fria domäner först)
Per BEKRÄFTAT fynd (adversariell verify, ej påstå):
- Lös nod som SKA kopplas → wire:a UI ↔ action ↔ DB **på riktigt** (ej stub). *Detta är kärnan — Zivar: "OPTIMERA koderna så de är mer verkliga och har ett riktigt flöde om något inte har logik".*
- Avsiktlig → flagga `AVSIKTLIG`, lämna.
- Schema-mismatch → idempotent migration (#≥0039, re-kolla tak) + RLS, på `clylvowtowbtotrahuad`. **SISTA, mest gatade steget.** Föredra Supabase-branch-verify för icke-trivialt.
- Död knapp/oanvänd → koppla, eller flagga (ALDRIG radera).
- En agent = en domän = ett revir. Delade filer (`tenant.ts`, middleware, types) = SOLO.

## Gates (per domän-batch, före commit)
`pnpm typecheck` (0) · riktade `pnpm test` (vitest grön) · `pnpm build` (next build grön — worktree saknar ö, säkert) · oberoende verify-agent (rättar ej egen läxa). En commit per domän-batch.

## lfg-svans
FAS 2 klar → ce-code-review (mode:agent) → applicera fixar → residual-handoff → ce-test-browser (N/A om ingen snabb harness för 241 komponenter — motivera) → ce-commit-push-pr → CI-watch → DONE. **Ingen deploy** (gated på Zivar).

## Klar när
Varje av 132+109 klassad · `LÖSA-NODER.md` = 0 oavsiktliga lösa noder · DB↔kod i synk · `pnpm build` grön + oberoende verify ren per domän · branch redo att merge:a.

## Status-logg (uppdateras löpande — resumabel)
- [x] Setup: worktree, schema-snapshot, deps installerade, plan skriven. (commit 48952a9)
- [x] FAS 1 MAP (10 domäner) → LÖSA-NODER.md. **376 filer · 337 kopplad · 22 AVSIKTLIG · 18 lösa (alla "oanvänd", 0 död-knapp/schema-mismatch).** (commit 2ee85e7)
- [~] FAS 2 verify+decide (6 cluster-agenter, read-only) — per orphan: WIRE/SUPERSEDED/FUTURE/SWEEP-DEFER. 7 sajtbyggare = sweep-defer. 11 + mfa under bedömning.
- [ ] FAS 2 implementera WIRE-beslut (sweep-fria domäner, build-gate per batch)
- [ ] Migrationer (om mismatch — inga hittade i FAS 1)
- [ ] lfg-svans (review → PR → CI)
