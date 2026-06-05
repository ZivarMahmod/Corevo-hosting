# BRIEF-DB-022: "Lägg till kund"-drawer → riktigt formulär som skapar `customers`-rad
Thinking: 🟡 Think (en yta, en tabell — men cross-tenant + RLS)

---
> ## ✅ KLAR + DEPLOYAD LIVE — 2026-06-05
> - **Bygge:** `createPlatformCustomer` (platform_admin-gated, server-validerar tenant exists+active) → insert `customers {tenant_id, full_name, display_name, email, phone, status:'active'}`; INGEN `auth_user_id`/`contact_hash` (ingen fejkad auth-identitet; null contact_hash → partial unique-index krockar aldrig). Cross-tenant-insert tillåts av customers RLS WITH CHECK `is_platform_admin` (0011 §6.1). Drawer = riktigt formulär (Salong-select **aktiva-only**, Namn, E-post?, Telefon?) + ärlig callout + toast + `router.refresh()`.
> - **Audit-avvikelse (medvetet):** brief sa `customer.create` → bytt till **`tenant.customer_create`**. `classifyAuditActor` mappar `customer.*`+aktör → 'Kund' (skulle felattribuera en Zivar-handling); `tenant.*` → 'Zivar' (syskon till `tenant.staff_create`). Funktionell brief, inte design-paket → avvikelsen är rätt enligt ärlighetsregeln.
> - **Gate:** typecheck 0 / lint 0 / **vitest 245/245** (+8 nya). **Render-verifierad live** (`/kunder`-drawer, aktiv-only select, disabled-gate, 0 console-fel).
> - **Oberoende adversarial review: NO-GO → fix → GO.** HIGH = Enter-tangent dubbel-submit → permanenta dubblettrader (footer-knapp disabled men form-onSubmit inte). FIX: `if (pending) return` + `disabled={pending}` på alla fält. + 2 LOW (email-längdcap 254; aktiva-only salong-select så servern aldrig nekar ett valbart val).
> - **DEPLOYAD:** worker **`474e1768-82df-4514-8c11-c7363d489a91`**, rollback **`fb7473d0-673d-4301-b4de-7be3d8dd82be`** (`wrangler rollback fb7473d0… --config 5-Kod/apps/web/wrangler.jsonc`). Smoke grön: POS corevo.se 200, admin 200, freshcut 200 + tenant-kind=tenant, /kunder 307→login. Commit `17211c9`.
> - **⚠️ Sido-effekt:** denna worker (474e1768) bär ÄVEN goal-21 (stackade commits, byggde hela trädet). goal-21 är diff-0-säker (seed = gamla matrisen) men dess worker-deploy var gated → **väntar Zivars retroaktiva OK eller rollback**.
> - **Känd begränsning (utanför scope per brief):** manuell rad saknar `contact_hash` → en senare bokning av samma person mintar en SEPARAT rad (ingen dedup). Dokumenterat, ej byggt (brief anti-pattern förbjuder `contact_hash`; rätt hash kräver exakt samma normalisering som `resolve_customer_id` → risk > nytta).
---

## Mål
Gör "Lägg till kund"-drawern i plattformens kundvy till ett riktigt formulär som skapar en rad i `customers` för vald salong — istället för dagens info-stub med bara "Stäng".

## Lägeskoppling
- Audit nod #6: "'Lägg till kund'-drawer — bara Stäng-knapp + info-text. Inga fält, ingen submit. Avsiktlig stub."
- Plan → GOAL-22.
- Zivar-regel: om UI:t har en plats att skriva in en kund → den ska skapa en riktig rad, direkt synlig i DB.

## Kontext (verifierade ankare)
- `customers` (`0011_customers_identity_and_schedule.sql`:52): `{id, tenant_id (not null, cascade), auth_user_id, contact_hash, display_name, name_hidden, full_name, email, phone, status('active'|'anonymized'), first_seen_at, last_seen_at, created_at, updated_at}`. RLS (`0002`-loop): `tenant_id = private.tenant_id() OR private.is_platform_admin()`.
- **Ingen `createCustomer`-action finns** — kunder mintar idag automatiskt vid första bokningen (`private.resolve_customer_id` i `0015`). Detta är en NY manuell väg.
- `KunderView.tsx:341-369` (`components/platform/kunder/`) — drawern (`adding`-state) med bara info-callout + "Stäng". Plattformsvyn är **cross-tenant** (platform_admin läser alla tenants).
- Mönster att spegla: andra platform-actions i `lib/platform/actions.ts` (FormData → supabase insert → `logPlatformAction` → revalidate). `createTenantStaff` (~491) är närmaste mall.

## Berörda filer
- `5-Kod/apps/web/lib/platform/actions.ts` — NY `createPlatformCustomer(_p, fd)`-action: FormData `{tenantId, full_name, email?, phone?}` → insert `customers {tenant_id, full_name, display_name, email, phone, status:'active'}` → `logPlatformAction('customer.create'...)` → revalidate. Lägg `customer.create` i `PlatformAuditAction`.
- `5-Kod/apps/web/components/platform/kunder/KunderView.tsx` — drawern får riktiga fält + submit.
- `5-Kod/apps/web/lib/platform/audit.ts` — ny action-sträng.
- Test: ny/utökad för `createPlatformCustomer` (insert + tenant-scoping + validering).

## Steg
1. **Action** `createPlatformCustomer` i `actions.ts`:
   - Gated: `requirePlatformAdmin` (cross-tenant skapande är en platform-operation).
   - Validera: `tenantId` finns + är en aktiv tenant; `full_name` icke-tom; `email`/`phone` valfria men формат-sanerade.
   - Insert i `customers` med `tenant_id = tenantId`, `display_name = full_name` (eller härled), `status:'active'`. Sätt INTE `auth_user_id`/`contact_hash` (manuell rad, ingen auth-koppling).
   - `logPlatformAction(supabase, { action:'customer.create', tenantId, actorId, entityId: newCustomerId })`.
   - Returnera `{success}`/`{error}`.
2. **Drawer** i `KunderView.tsx`:
   - Behåll info-callouten ("kunder skapas oftast automatiskt vid första bokningen") men lägg under den ett riktigt formulär: **Salong-select** (vilken tenant — obligatoriskt eftersom vyn är cross-tenant), **Namn** (obligatoriskt), **E-post** (valfri), **Telefon** (valfri).
   - Submit → `createPlatformCustomer` via `useActionState`/form-action → success-toast + stäng + lista-refresh (`router.refresh()`).
   - Felvisning vid valideringsfel (tom namn, ogiltig tenant).
3. Tester + typecheck + lint gröna.

## Verifiering
- [ ] Fyll i salong + namn + ev. epost/telefon → submit → **ny rad i `customers`** med rätt `tenant_id`: `select * from customers where full_name=... and tenant_id=...`. Direkt synlig (Zivars DB-test).
- [ ] Kunden dyker upp i kundlistan direkt efter skapande (refresh funkar).
- [ ] Tenant-isolering: raden får EXAKT vald `tenant_id`; ingen läcka till annan tenant.
- [ ] Validering: tomt namn → fel, ingen rad. Ogiltig/utelämnad tenant → fel, ingen rad.
- [ ] `audit_log`-rad skapas för `customer.create`.
- [ ] vitest + typecheck + lint gröna. POS `corevo.se`+`admin.corevo.se` → 200.

## Anti-patterns
- Skapa INTE kund utan `tenant_id` (kolumnen är `not null` + det är bärande för isolering).
- Rör INTE `auth_user_id`/`contact_hash`/`customer_profile_id` — manuell rad ska inte fejka auth-identitet (`customer_profile_id` är dessutom en fryst live-nyckel, finns ej ens på denna tabell men nämns för säkerhets skull: rör aldrig).
- Gör INTE skapandet client-side direkt mot supabase — gå via server-action (platform_admin-gated).
- Validera tenant server-side (klienten får inte skicka godtyckligt `tenant_id` utan kontroll).

## Kopplingar
- Speglar `createTenantStaff`-mönstret (GOAL-19 wire).
- Oberoende av GOAL-20/21 — kan köras när som helst efter GOAL-19.

## Rollback
- Kod: `git revert` + redeploy (drawern faller tillbaka till stub).
- DB: inga schemaändringar (tabellen finns). Ev. testrader: `delete from customers where ...` (tenant=1 baseline har 0 kunder → lätt att städa).
