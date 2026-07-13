-- ROLLBACK 0044 — order-fulfilment-spårning. Additivt → säkert.
set search_path = public;
alter table public.shop_orders drop column if exists tracking_number;
alter table public.shop_orders drop column if exists carrier;
alter table public.shop_orders drop column if exists shipped_at;
