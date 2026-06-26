-- ROLLBACK 0043 — payments order-generalisering + disputes. Additivt → säkert.
-- OBS: drop not null återställs INTE (booking_id förblir nullable; harmlöst — alla
-- live-rader har booking_id satt). Kör manuellt vid behov.
set search_path = public;

drop table if exists public.payment_disputes cascade;
drop index if exists public.payments_order_id_key;
alter table public.payments drop constraint if exists payments_one_source;
alter table public.payments drop column if exists order_id;
