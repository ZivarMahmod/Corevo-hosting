-- ============================================================================
-- 0044 — Webshop order-fulfilment: spårningsnummer + transportör (goal-49 Fas 2)
--
-- Additivt: merchant-admin kan registrera spårningsnummer + transportör när en order
-- skickas. status-FSM:en (0032/0042) bär själva arbetsflödet (pending→ready→completed);
-- detta är logistik-metadata bredvid. Inga RPC/RLS-ändringar (vanliga kolumner, ärvd
-- shop_orders-RLS). Rollback bredvid.
-- ============================================================================
set search_path = public;

alter table public.shop_orders add column if not exists tracking_number text;
alter table public.shop_orders add column if not exists carrier text;
alter table public.shop_orders add column if not exists shipped_at timestamptz;
