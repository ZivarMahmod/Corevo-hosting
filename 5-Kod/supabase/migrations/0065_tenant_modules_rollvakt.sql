-- ▸ FIL: 0065_tenant_modules_rollvakt.sql
-- ▸ (döp SQL-Editor-fliken till detta — Supabase kallar den annars "Untitled query")

-- 0065 — goal-67: personal kunde stänga av kundens bokning. Permanent.
--
-- FYND (Codex-granskning av L3, ALLVARLIG): `tenant_modules_rls` (0027) är `FOR ALL`
-- med ENDAST en tenant-koll:
--
--   using (tenant_id = private.tenant_id() or private.is_platform_admin())
--
-- Ingen rollkoll. Varje inloggad användare i tenanten — inklusive `staff` (nivå 3) —
-- kan alltså gå FÖRBI `setBookingMode` rakt på PostgREST och skriva `state = 'off'`.
--
-- Och det är en ENKELRIKTAD DÖRR: `tenant_modules_state_guard` (0026) kräver
-- platform_admin för att ta sig FRÅN 'off' tillbaka till 'live'. En anställd — eller
-- vem som helst med en kapad personalsession — kunde alltså släcka kundens
-- bokningsmodul permanent, och bara Corevo kunde tända den igen.
--
-- goal-67 släppte in personal i /admin (kalender + kunder). Hålet fanns före det, men
-- rollen som kan nå det är nu betydligt vanligare. Server actions vaktas
-- (requireAdminArea), men RLS är den vakt som INTE går att gå runt — och den saknades.
--
-- FIXEN: dela upp den allsmäktiga policyn.
--   · LÄSA   — hela tenanten (personal måste kunna se vilka moduler som är på).
--   · SKRIVA — salon_admin (nivå 6) och uppåt, eller platform_admin.
-- DB-vakten i 0026 står kvar orörd ovanpå: off→på kräver fortfarande platform_admin.
--
-- Idempotent: policyerna droppas och återskapas.

alter table public.tenant_modules enable row level security;

-- Bort med den allsmäktiga FOR ALL-policyn.
drop policy if exists tenant_modules_rls on public.tenant_modules;

-- LÄSA: alla i tenanten. Personalen måste kunna se modulläget — kalendern och navet
-- läser det för varje sidladdning.
create policy tenant_modules_read on public.tenant_modules
  for select
  using (
    tenant_id = (select private.tenant_id())
    or (select private.is_platform_admin())
  );

-- SKRIVA: bara salon_admin (6) och uppåt. Personal (3) har ingen väg in — varken via
-- appen eller via PostgREST.
create policy tenant_modules_write on public.tenant_modules
  for update
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );

-- INSERT/DELETE: bara plattformen. Vilka moduler en kund HAR är ett affärsbeslut
-- (abonnemang), inte något kunden själv lägger till eller river bort. Samma linje som
-- 0026 redan drar för aktivering.
create policy tenant_modules_platform_insert on public.tenant_modules
  for insert
  with check ((select private.is_platform_admin()));

create policy tenant_modules_platform_delete on public.tenant_modules
  for delete
  using ((select private.is_platform_admin()));

comment on table public.tenant_modules is
  'Modulläge per tenant. LÄSAS av hela tenanten; SKRIVAS bara av salon_admin+ (0065). '
  'off→på kräver dessutom platform_admin (state-guard, 0026).';
