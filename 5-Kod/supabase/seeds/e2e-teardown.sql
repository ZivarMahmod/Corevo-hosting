-- ▸ FIL: supabase/seeds/e2e-teardown.sql
--
-- E2E-TEARDOWN — river fixturen och ALLT sviten skapade. Körs via scripts/e2e-db.mjs.
--
-- Kontraktet: efter det här ska databasen se EXAKT ut som före seeden. Sviten kör mot
-- produktionsdatabasen (Zivars beslut 2026-07-14: inga slutkunder ännu, Free-planen
-- har ingen branching), så "städar efter sig" är inte en artighet — det är villkoret
-- för att den får köras alls.
--
-- Vad som raderas, och varför just det:
--   1. tenants.slug = 'frisor1'  → själva fixturen. Allt tenant-scopat (bokningar,
--      kunder, personal, tjänster, arbetstider, settings, roller) hänger i den med
--      ON DELETE CASCADE och följer med.
--   2. tenants.slug like 'e2e%'  → platform.spec provisionerar en NY salong per körning
--      (slug e2e<6 siffror>). Utan den här raden växer kundens tenant-lista med en
--      skräprad varje gång sviten körs.
--   3. auth.users id like 'e2e00000%' → ligger UTANFÖR tenanten (auth-schemat) och
--      cascadar därför inte. Bland dem finns en super_admin — den MÅSTE dö.
--   4. roles id like 'e2e00000%' → den globala super_admin-rollen har tenant_id NULL
--      och cascadar inte heller.
--
-- Inga riktiga tenants (freshcut, florist, zentum) matchar något av mönstren.

-- 1 + 2. Fixtur-tenanten och alla tenants platform.spec provisionerat.
delete from public.tenants
 where slug = 'frisor1'
    or slug like 'e2e%';

-- 3. Auth-användarna (cascadar inte med tenanten — eget schema).
--    public.users har FK mot auth.users och cascadar med raden ovan; den här tar
--    resten. Super_adminen med engångslösenordet dör här.
delete from auth.users
 where id::text like 'e2e00000%';

-- 4. Den globala super_admin-rollen (tenant_id NULL → ingen cascade).
delete from public.roles
 where id::text like 'e2e00000%';
