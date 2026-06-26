-- ============================================================================
-- 0045 — BASELINE RESET: purge the 13 vendor-look rows from the catalogue (goal-51).
--
-- The sajtbyggare mall-layer is reset to a clean baseline: the 13 imported vendor looks
-- (foreign static sites that never merged with Corevo's tokens/modules/live-edit) are
-- removed from code AND DB. goal-52 rebuilds the original 5 as NATIVE looks.
--
-- Of the 13 look-keys, six exist as rows in `templates` (alotan, barberx, barberz, feane,
-- haircut, restoran) with 80 child `template_slots`; the other seven were code-only. This
-- migration deletes whatever matches — idempotent (re-run = no-op). The OTHER catalogue
-- templates (salvia, studio, training-studio, star-admin2, sneat, connect-plus, …) are NOT
-- look-keys and are left intact (the parked skin-DB datalager). `content_slots` referencing
-- a look is purged too (0 rows in prod; included for a clean rebuild). One tenant (test234rf)
-- pinned settings.look='haircare' → the pin is dropped so its storefront falls through to its
-- theme layout (settings.theme) — safe fallback, never a 500.
--
-- ROLLBACK: 0045_purge_vendor_looks_rollback.sql (verbatim snapshot of the live rows,
-- validated byte-identical before this purge). 0041 alone restores only `haircut`.
-- ============================================================================
begin;

-- tenant-authored content bound to a vendor look (0 in prod; idempotent safety)
delete from content_slots
where template_key in ('haircare','hairsal','haircut','alotan','barberx','barberz',
                      'restoran','klinik','drivin','carserv','dentcare','keto','feane');

-- child slot definitions (FK child first) — 80 live rows across the 6 existing looks
delete from template_slots
where template_key in ('haircare','hairsal','haircut','alotan','barberx','barberz',
                      'restoran','klinik','drivin','carserv','dentcare','keto','feane');

-- the look templates themselves — 6 live rows; salvia + the other catalogue rows untouched
delete from templates
where key in ('haircare','hairsal','haircut','alotan','barberx','barberz',
              'restoran','klinik','drivin','carserv','dentcare','keto','feane');

-- drop the one tenant look-pin that points at a now-removed look → theme fallback, not 500
update tenant_settings
set settings = settings - 'look'
where settings->>'look' in ('haircare','hairsal','haircut','alotan','barberx','barberz',
                            'restoran','klinik','drivin','carserv','dentcare','keto','feane');

commit;
