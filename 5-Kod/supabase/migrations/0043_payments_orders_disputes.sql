-- ============================================================================
-- 0043 — Generalisera payments till webshop-ordrar + dispute-tabell (goal-49 Fas 3)
--
-- Förlänger boknings-betal-rälsen (0007) till att ÄVEN bära shop_orders, additivt:
--   1. payments.booking_id blir NULLABLE; ny payments.order_id (FK→shop_orders).
--      XOR-constraint: exakt EN källa per betalning (booking ELLER order).
--   2. UNIQUE(order_id) (partiell) — en order = en payment-rad (idempotens-grund,
--      speglar UNIQUE(booking_id) i 0007).
--   3. payment_disputes — Connect-tvister (charge.dispute.*), tenant-scopad.
--
-- DIRECT charge-modellen är OFÖRÄNDRAD (application_fee=0, Corevo tar ingen cut).
-- Befintliga payment-rader (alla med booking_id satt, order_id null) uppfyller
-- XOR-checken → säker att lägga utan NOT VALID. Betal-rälsen är PAUSAD: order-vägen
-- är dormant tills tenant_settings.payments_enabled tänds (compliance-gate, separat).
--
-- Re-runnable: drop not null (idempotent), add column/constraint/index if not exists.
-- ROLLBACK-fil bredvid.
-- ============================================================================
set search_path = public;

-- ── 1. booking_id nullable + order_id-källa ──────────────────────────────────
alter table public.payments alter column booking_id drop not null;
alter table public.payments add column if not exists order_id uuid
  references public.shop_orders(id) on delete set null;

-- XOR: exakt en källa per betalning. Befintliga rader (booking_id satt) passerar.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_one_source' and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments add constraint payments_one_source
      check ((booking_id is not null)::int + (order_id is not null)::int = 1);
  end if;
end $$;

-- ── 2. En payment-rad per order (idempotens). ICKE-partiellt unique-index: en
-- vanlig unik-index behandlar NULL som distinkta → alla boknings-rader (order_id
-- NULL) saminryms, OCH PostgREST onConflict('order_id') kan inferera det (ett
-- partiellt index matchas INTE av bare ON CONFLICT → 42P10 bröt checkouten).
create unique index if not exists payments_order_id_key on public.payments (order_id);

-- ── 3. payment_disputes (Connect charge.dispute.*) ───────────────────────────
create table if not exists public.payment_disputes (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  payment_id       uuid references public.payments(id) on delete set null,
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  amount_cents     integer,
  currency         text not null default 'sek',
  reason           text,
  dispute_status   text,           -- warning_needs_response | needs_response | under_review | won | lost | …
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);
create index if not exists payment_disputes_tenant_idx on public.payment_disputes (tenant_id);
create index if not exists payment_disputes_payment_idx on public.payment_disputes (payment_id);

-- RLS: tenant-scopad (mönster ur 0002 payments_rls). anon har INGEN åtkomst.
-- service_role explicit (webhooken skriver direkt via service-role-klienten) — bero
-- ej på projektets default-privileges.
alter table public.payment_disputes enable row level security;
grant select, insert, update on public.payment_disputes to authenticated;
grant select, insert, update on public.payment_disputes to service_role;

drop policy if exists payment_disputes_rls on public.payment_disputes;
create policy payment_disputes_rls on public.payment_disputes
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));

drop trigger if exists trg_payment_disputes_updated_at on public.payment_disputes;
create trigger trg_payment_disputes_updated_at before update on public.payment_disputes
  for each row execute function public.set_updated_at();

-- ── 4. Härda _commit_shop_order_stock: ROW-LOCK före commit-guarden ───────────
-- Webhook-vägen (mark_shop_order_paid → _commit) tog INGEN lås på order-raden, så
-- två samtidiga payment_intent.succeeded-leveranser kunde båda passera stock_committed
-- =false-checken före någon skrev → dubbel lager-dekrement (oversell). Lås raden FÖRST
-- (confirm_shop_order låser redan via FOR UPDATE; detta stänger webhook-racet).
create or replace function public._commit_shop_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- serialisera samtidiga committar på samma order (Stripe är at-least-once).
  perform 1 from public.shop_orders where id = p_order_id for update;

  if not exists (
    select 1 from public.shop_orders o
     where o.id = p_order_id and o.stock_committed = false and o.status in ('reserved','awaiting_payment')
  ) then
    return;
  end if;

  update public.shop_product_variants v
     set stock = case when v.stock is null then null else greatest(0, v.stock - oi.quantity) end,
         reserved_qty = greatest(0, v.reserved_qty - oi.quantity)
    from public.shop_order_items oi
   where oi.order_id = p_order_id and oi.variant_id = v.id;

  update public.shop_orders set stock_committed = true, expires_at = null where id = p_order_id;
end;
$$;
revoke all on function public._commit_shop_order_stock(uuid) from public;
grant execute on function public._commit_shop_order_stock(uuid) to service_role;

do $$
begin
  raise notice '0043: payments.order_id + XOR + payment_disputes + _commit row-lock klart';
end $$;
