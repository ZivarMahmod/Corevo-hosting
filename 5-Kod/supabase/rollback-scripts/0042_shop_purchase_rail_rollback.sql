-- ROLLBACK 0042 — webshop köp-räls. Additivt → säkert att reversera.
-- Kör manuellt vid behov. Lager-holds försvinner med variant-tabellen.
set search_path = public;

drop function if exists public.get_public_shop_order(uuid,text);
drop function if exists public.release_shop_order(uuid,text,text);
drop function if exists public.mark_shop_order_paid(uuid);
drop function if exists public._commit_shop_order_stock(uuid);
drop function if exists public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text);
drop function if exists public.reserve_shop_order(text,jsonb,text,text,integer);
drop function if exists public.prune_expired_shop_reserves();

-- normalisera ordrar till original-FSM:en innan CHECK:en smalnas (annars constraint-fail).
update public.shop_orders set status = 'cancelled'
 where status in ('reserved','awaiting_payment','expired');
alter table public.shop_orders drop constraint if exists shop_orders_status_check;
alter table public.shop_orders add constraint shop_orders_status_check
  check (status in ('pending','confirmed','ready','completed','cancelled'));

alter table public.shop_orders drop column if exists session_token;
alter table public.shop_orders drop column if exists expires_at;
alter table public.shop_orders drop column if exists stock_committed;
alter table public.shop_orders drop column if exists subtotal_cents;
alter table public.shop_orders drop column if exists shipping_cents;
alter table public.shop_orders drop column if exists discount_cents;
alter table public.shop_orders drop column if exists tax_cents;

alter table public.shop_order_items drop column if exists variant_id;
alter table public.shop_order_items drop column if exists tax_rate;
alter table public.shop_order_items drop column if exists tax_cents;

drop table if exists public.shop_product_variants cascade;
