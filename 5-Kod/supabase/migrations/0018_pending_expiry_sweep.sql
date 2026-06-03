-- 0018 — Pending-expiry sweep. Cancels an abandoned online-checkout 'pending' booking
-- (payment never completed) after a TTL, freeing the no_double_booking slot. Toggle-safe:
-- only acts on pendings that have a 'pending' payments row (i.e. startBookingCheckout ran)
-- — non-paying / pre-toggle pendings have no payments row and are NEVER touched. Reuses
-- status='cancelled' (no new enum value). service_role-ONLY (it mass-cancels). The cancel
-- is logged to booking_status_history (0017 trigger) with source='pending_expiry'.
-- 0014_slot_holds is DEFERRED (orthogonal: wizard-phase hold vs already-inserted pending).
set search_path = public;

create or replace function public.expire_abandoned_pending_bookings(p_ttl_min int default 30)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  if p_ttl_min is null or p_ttl_min <= 0 or p_ttl_min > 1440 then
    raise exception 'invalid_ttl' using errcode = '22023';
  end if;
  perform set_config('app.status_reason', 'pending_expiry', true);

  with expired as (
    update public.bookings b
       set status = 'cancelled', updated_at = now()
      from public.payments p
     where p.booking_id = b.id
       and b.status = 'pending'
       and p.status  = 'pending'                       -- never started/finished paying
       and p.created_at <= now() - make_interval(mins => p_ttl_min)
    returning b.id
  )
  select count(*) into v_n from expired;
  return v_n;
end;
$$;
revoke all on function public.expire_abandoned_pending_bookings(int) from public, anon, authenticated;
grant execute on function public.expire_abandoned_pending_bookings(int) to service_role;
