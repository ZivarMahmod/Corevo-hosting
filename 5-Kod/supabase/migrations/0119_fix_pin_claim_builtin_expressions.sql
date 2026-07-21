-- 0119: make the immediate PIN outbox claim executable on PostgreSQL.
-- COALESCE/LEAST/GREATEST are SQL expressions and cannot be schema-qualified.

begin;

create or replace function public.claim_notification_outbox_by_id(
  p_id uuid,
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer
) returns setof public.notifications_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or p_lease_token is null or p_now is null then
    raise exception 'notification_claim_by_id_invalid' using errcode = '22023';
  end if;

  update public.notifications_outbox o
     set status = 'failed',
         last_error = 'lease_expired_after_max_attempts',
         lease_token = null,
         lease_expires_at = null,
         updated_at = p_now
   where o.id = p_id
     and o.status = 'attempting'
     and o.lease_expires_at <= p_now
     and o.attempt_count >= o.max_attempts;

  return query
  with due as (
    select o.id
      from public.notifications_outbox o
     where o.id = p_id
       and o.category = 'transactional'
       and o.event_type in (
         'booking_verification_pin', 'booking_confirmation', 'booking_request_received'
       )
       and o.chosen_channel in ('sms', 'email')
       and o.attempt_count < o.max_attempts
       and (
         (
           o.status = 'queued'
           and (
             o.event_type = 'booking_verification_pin'
             or o.available_at <= p_now
           )
         )
         or (o.status = 'attempting' and o.lease_expires_at <= p_now)
       )
     for update skip locked
  )
  update public.notifications_outbox o
     set status = 'attempting',
         attempt_count = o.attempt_count + 1,
         lease_token = p_lease_token,
         lease_expires_at = p_now + pg_catalog.make_interval(
           secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
         ),
         updated_at = p_now
    from due
   where o.id = due.id
  returning o.*;
end;
$$;

revoke all on function public.claim_notification_outbox_by_id(
  uuid,uuid,timestamptz,integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox_by_id(
  uuid,uuid,timestamptz,integer
) to service_role;

commit;
