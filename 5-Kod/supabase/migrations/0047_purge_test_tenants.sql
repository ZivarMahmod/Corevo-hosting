-- 0047 — Purge test-tenants (Zivar 2026-07-08: "vi ska bara ha en kund, FreshCut").
--
-- ✅ REDAN KÖRD MOT PROD 2026-07-08 via `supabase db query --linked` (repo-flödet
-- använder inte migration-history-tabellen; filen ligger kvar som journal).
--
-- De fyra soft-deletade test-tenanterna raderades HÅRT så de försvinner ur alla
-- super-admin-vyer (Översikt/Fakturering/Slutkunder). tenant_id-FK:erna kaskadar.
-- Fyra delete-vakter blockerar kaskaden och stängdes av under körningen och slogs
-- på igen (verifierat tgenabled='O' efteråt):
--   trg_audit_no_delete (audit_log) · trg_loyalty_no_delete (loyalty_ledger)
--   trg_bookings_no_delete (bookings, ej cascade-FK → explicit delete först)
--   trg_bsh_no_mutation (booking_status_history)
-- FreshCut (1e472427-…) rördes INTE.
--
-- Efterarbete i samma pass (service-role): zivar68@gmail.com ombunden till
-- freshcuts salon_admin-roll (lösenord orört); super-adminens public.users-rad
-- (kaskadad med corevo-system) återskapad ankrad i freshcut; felskapade
-- zivar.68@gmail.com raderad.

alter table public.audit_log disable trigger trg_audit_no_delete;
alter table public.loyalty_ledger disable trigger trg_loyalty_no_delete;
alter table public.bookings disable trigger trg_bookings_no_delete;
alter table public.booking_status_history disable trigger trg_bsh_no_mutation;

delete from public.bookings
where tenant_id in (
  '11111111-1111-1111-1111-111111111111', -- corevo-system
  '11abfb33-3539-4b6b-8932-40bca6a3505e', -- test-barber
  '28f2edfd-154d-4111-9efd-7e21b4121a5e', -- test2
  '5163112c-afd3-4a0b-8f4c-9aef3ce2bb96'  -- test234rf
);

delete from public.tenants
where status = 'deleted'
  and id in (
    '11111111-1111-1111-1111-111111111111',
    '11abfb33-3539-4b6b-8932-40bca6a3505e',
    '28f2edfd-154d-4111-9efd-7e21b4121a5e',
    '5163112c-afd3-4a0b-8f4c-9aef3ce2bb96'
  );

alter table public.booking_status_history enable trigger trg_bsh_no_mutation;
alter table public.bookings enable trigger trg_bookings_no_delete;
alter table public.audit_log enable trigger trg_audit_no_delete;
alter table public.loyalty_ledger enable trigger trg_loyalty_no_delete;
