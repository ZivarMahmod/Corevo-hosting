-- ============================================================================
-- 0029 — (VALBAR / OPTIONAL) users.tenant_id → NULLABLE  ·  multi-bransch-skuld
--
-- ⚠️ KÖRS INTE AUTOMATISKT MED DB-GRUNDEN. Egen, medvetet separat migration.
-- DB-grunden (0026–0028) fungerar UTAN denna. Applicera bara om/när en
-- plattforms-nivå-användare utan tenant behövs (t.ex. en super-admin/'corevo-system'
-- operatör som inte hör till EN kund).
--
-- BAKGRUND (HANDOFF/memory): public.users.tenant_id är `uuid NOT NULL` (0001:70).
-- Det knyter VARJE användare hårt till exakt en tenant. För en äkta plattforms-
-- operatör (super-admin som spänner över alla tenants) är det en skuld. RLS bygger
-- på JWT-claimen app_metadata.tenant_id, INTE på users.tenant_id-kolumnen — så att
-- lätta NOT NULL bryter ingen tenant-isolering. Det öppnar bara för en users-rad
-- utan kund-koppling.
--
-- RISK: lågt. Att lätta en NOT NULL är icke-destruktivt och bakåtkompatibelt
-- (alla befintliga rader har redan ett värde). Återställning (sätta NOT NULL igen)
-- KRÄVER dock att inga NULL-rader hunnit skapas → se rollback-villkoret nedan.
--
-- IDEMPOTENT: drop not null är no-op om kolumnen redan är nullable.
-- ============================================================================

alter table public.users alter column tenant_id drop not null;

comment on column public.users.tenant_id is
  'Nullable sedan 0029: NULL = plattforms-operatör utan kund-koppling (super-admin). '
  'Tenant-isolering styrs av JWT app_metadata.tenant_id (0002), inte denna kolumn.';

-- ── ROLLBACK (endast om INGA users har tenant_id IS NULL) ──
--   -- avbryt om någon null-rad finns, annars återinför NOT NULL:
--   do $$
--   begin
--     if exists (select 1 from public.users where tenant_id is null) then
--       raise exception 'kan ej återställa NOT NULL: users med tenant_id IS NULL finns';
--     end if;
--     alter table public.users alter column tenant_id set not null;
--   end $$;
