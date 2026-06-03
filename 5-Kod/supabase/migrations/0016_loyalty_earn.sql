-- 0016 — Loyalty EARN. Mints exactly one loyalty_ledger row (reason='earn_completed')
-- when a booking transitions INTO status='completed'. Idempotent via the existing
-- loyalty_ledger_earn_once partial unique index. SECURITY DEFINER (loyalty_ledger RLS
-- is SELECT-only). FAILURE-ISOLATED: a loyalty hiccup must NEVER abort the status
-- UPDATE that just marked the booking completed (mirrors the review-nudge contract).
-- Depends on 0015 (bookings.customer_id populated). REDEEM is deferred (earn only).
set search_path = public;

create or replace function public.earn_loyalty_on_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
  v_points int;
begin
  -- Resolve the additive customer_id (NOT NULL FK) or SKIP — never violate the FK.
  v_customer := new.customer_id;
  if v_customer is null and new.customer_profile_id is not null then
    select c.id into v_customer from public.customers c
     where c.tenant_id = new.tenant_id and c.auth_user_id = new.customer_profile_id
     limit 1;
  end if;
  if v_customer is null then return new; end if;

  -- Per-tenant earn rate from tenant_settings.settings.loyalty.points_per_visit;
  -- platform default 50 points/visit. Non-numeric/<=0 -> no earn (no 0-point noise).
  select coalesce(nullif(ts.settings #>> '{loyalty,points_per_visit}', '')::int, 50)
    into v_points
    from public.tenant_settings ts where ts.tenant_id = new.tenant_id;
  v_points := coalesce(v_points, 50);
  if v_points <= 0 then return new; end if;

  insert into public.loyalty_ledger (tenant_id, customer_id, booking_id, points_delta, reason)
  values (new.tenant_id, v_customer, new.id, v_points, 'earn_completed')
  on conflict (booking_id) where (reason = 'earn_completed') do nothing;

  return new;
exception when others then
  return new;  -- loyalty must never block the status transition
end;
$$;
revoke all on function public.earn_loyalty_on_completed() from public;
-- Trigger-only fn: Supabase default-grants EXECUTE to anon/authenticated on public
-- functions, so revoking PUBLIC is not enough — strip the direct grants too (it must
-- never be PostgREST-callable).
revoke execute on function public.earn_loyalty_on_completed() from anon, authenticated;

drop trigger if exists trg_loyalty_earn_on_completed on public.bookings;
create trigger trg_loyalty_earn_on_completed
after update on public.bookings
for each row
when (new.status = 'completed' and old.status is distinct from 'completed')
execute function public.earn_loyalty_on_completed();
