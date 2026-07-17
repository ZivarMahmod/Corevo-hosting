-- 0088 — atomiska leases för bokningspåminnelser.
-- Två överlappande cron-körningar får aldrig välja samma bokning. Ett avbrutet
-- jobb släpper automatiskt igenom raden efter 15 minuter.

alter table public.bookings
  add column if not exists reminder_claim_token uuid,
  add column if not exists reminder_claimed_at timestamptz;

create index if not exists bookings_due_reminder_claim_idx
  on public.bookings (start_ts)
  where reminded_at is null and status in ('pending', 'confirmed');

create or replace function public.claim_due_booking_reminders(
  p_claim uuid,
  p_now timestamptz,
  p_horizon timestamptz,
  p_limit integer default 200
) returns setof uuid
language sql
security definer
set search_path = ''
as $$
  with due as (
    select b.id
      from public.bookings b
     where b.status in ('pending', 'confirmed')
       and b.reminded_at is null
       and b.start_ts > p_now
       and b.start_ts <= p_horizon
       and (
         b.reminder_claim_token is null
         or b.reminder_claimed_at < p_now - interval '15 minutes'
       )
     order by b.start_ts, b.id
     for update skip locked
     limit least(greatest(coalesce(p_limit, 200), 1), 500)
  )
  update public.bookings b
     set reminder_claim_token = p_claim,
         reminder_claimed_at = p_now
    from due
   where b.id = due.id
  returning b.id;
$$;

revoke all on function public.claim_due_booking_reminders(
  uuid, timestamptz, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.claim_due_booking_reminders(
  uuid, timestamptz, timestamptz, integer
) to service_role;
