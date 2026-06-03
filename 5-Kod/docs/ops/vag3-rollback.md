# VÅG 3 — rollback-artefakter (destruktiv FreshCut-baseline + goal-16)

**PITR-ANKARE (restore-punkt FÖRE all VÅG 3-destruktion):** `2026-06-03 07:56:40.570728+00` (UTC).
Live-state vid ankaret: 5 tenants, 8 bokningar, 3 kunder, 7 audit_log-rader. DB-rollback = PITR till denna tidpunkt (allt återställs) ELLER per-steg nedan. Kod-rollback = `git revert` + `wrangler rollback 39717c0c --config 5-Kod/apps/web/wrangler.jsonc`.

## Destruktiv purge (3a) — körd som postgres owner-session, EN transaktion
**Varför trigger-disable:** `audit_log`-CASCADE (7 rader i frisor3/arsgw/grwg) träffar `trg_audit_no_delete` (append-only, INGEN GUC-escape) → naiv delete abortar. Disable den NAMNGIVNA triggern (behåller RI/cascade). ALDRIG `session_replication_role=replica` (slår av FK → föräldralösa barn).
```sql
begin;
  -- A) Purge 4 junk-tenants (0 bokningar var → bookings.tenant_id RESTRICT blockerar ej).
  alter table public.audit_log disable trigger trg_audit_no_delete;
  delete from public.tenants where id in (
    '98ea5c70-c058-4e2f-a410-68bd2154287e', -- frisor3 'Frisör Tre'
    'aaaaaaaa-0000-0000-0000-000000000002', -- studio  'Studio Nord'
    '3b4139f3-f197-41b1-93e1-e408fb7f43d1', -- arsgw   'hej'
    '68c695cf-9f35-449e-9538-a092e1dd92f3'  -- grwg    'sdfgwe'
  );  -- expect DELETE 4

  -- B) Rensa FreshCuts E2E-testbokningar + testkunder ('ingen bokningsdata'-baseline,
  --    Zivar-auktoriserat). freshcut bsh/payments/loyalty = 0 → bara GUC behövs, men
  --    disable bsh-guarden för säkerhets skull (0 rader cascadar ändå).
  set local corevo.allow_booking_delete = 'on';
  alter table public.booking_status_history disable trigger trg_bsh_no_mutation;
  delete from public.bookings  where tenant_id = '11111111-1111-1111-1111-111111111111'; -- expect DELETE 8
  delete from public.customers where tenant_id = '11111111-1111-1111-1111-111111111111'; -- expect DELETE 3

  -- Re-arma ALLA append-only-guarder (DDL är transaktionellt → abort re-armar auto).
  alter table public.booking_status_history enable trigger trg_bsh_no_mutation;
  alter table public.audit_log enable trigger trg_audit_no_delete;
commit;
```
**Post-villkor (MÅSTE verifieras):** `tenants`=1 (bara freshcut/active); freshcut `bookings`=0, `customers`=0; `audit_log`=0; `select tgenabled from pg_trigger where tgname in ('trg_audit_no_delete','trg_bsh_no_mutation')` → båda `'O'` (åter-armade — annars är VÅG 2-invarianten tyst upphävd).

## FreshCut-reconcile (3a) — `5-Kod/supabase/seed-freshcut.sql`
Idempotent data-script (UPDATE/UPSERT på fixa id, primary location resolvas dynamiskt; rör ALDRIG bokning). Kör efter purgen. Rollback = PITR (data-only, ingen schema-ändring).

## goal-16 (3b) — migration 0019 + kod
- **Migration `0019_resolve_tenant_by_domain.sql`** — rollback: `drop function if exists public.resolve_tenant_by_domain(text);`
- **Kod** (`lib/custom-domain.ts`, `lib/tenant.ts` isExternalHost, `middleware.ts:1c`, `lib/tenant.test.ts`) — rollback: `git revert` + redeploy `wrangler rollback 39717c0c`.
- **wrangler.jsonc routes: NOLL ändring** (zero-churn, redan korrekt).

## DORMANT-flagga (goal-16)
Custom-domän-grenen i middleware är KOD-KOMPLETT men VILANDE tills Zivar DNS-routar en riktig extern kunddomän till workern (Väg A apex-zon / Väg B Cloudflare-for-SaaS). `demo.corevo.se` klassas som `.corevo.se`-subdomän UPPSTRÖMS → når aldrig grenen. RPC verifieras direkt: `resolve_tenant_by_domain('demo.corevo.se')` → 'freshcut'; okänd/overifierad/suspenderad → null.
