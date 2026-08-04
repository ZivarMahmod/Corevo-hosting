-- Web push is retired. Preserve the recorded opt-in timestamp and subscription
-- history, but prevent new routing to a transport that no longer exists.

begin;

alter table public.customer_notification_prefs
  add column if not exists push_retired_at timestamptz;

update public.customer_notification_prefs
set push_enabled = false,
    push_retired_at = coalesce(push_retired_at, pg_catalog.statement_timestamp())
where push_enabled;

update public.push_subscriptions
set revoked_at = coalesce(revoked_at, pg_catalog.statement_timestamp())
where revoked_at is null;

alter table public.customer_notification_prefs
  drop constraint if exists customer_notification_prefs_push_disabled,
  add constraint customer_notification_prefs_push_disabled
    check (push_enabled = false);

-- Preserve already queued work when its recorded fallback has a live consumer.
update public.notifications_outbox o
set chosen_channel = o.fallback_channel,
    fallback_channel = null,
    status = 'queued',
    skip_reason = null,
    attempt_count = 0,
    last_error = null,
    lease_token = null,
    lease_expires_at = null,
    available_at = pg_catalog.statement_timestamp(),
    updated_at = pg_catalog.statement_timestamp()
where o.chosen_channel = 'push'
  and o.fallback_channel in ('email', 'sms')
  and o.status in ('routing', 'queued', 'attempting')
  and not exists (
    select 1
    from public.notifications_outbox sibling
    where sibling.tenant_id = o.tenant_id
      and sibling.event_type = o.event_type
      and sibling.event_key = o.event_key
      and sibling.chosen_channel = o.fallback_channel
      and sibling.id <> o.id
  );

update public.notifications_outbox
set status = 'skipped',
    skip_reason = 'channel_disabled',
    lease_token = null,
    lease_expires_at = null,
    updated_at = pg_catalog.statement_timestamp()
where chosen_channel = 'push'
  and status in ('routing', 'queued', 'attempting');

create or replace function public.claim_notification_outbox(
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer,
  p_limit integer
) returns setof public.notifications_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications_outbox o
  set status = 'failed', last_error = 'lease_expired_after_max_attempts',
      lease_token = null, lease_expires_at = null, updated_at = p_now
  where o.event_type <> 'customer_portal_recovery_code'
    and o.chosen_channel = 'email'
    and o.status = 'attempting'
    and o.lease_expires_at <= p_now
    and o.attempt_count >= o.max_attempts;

  return query
  with due as (
    select o.id from public.notifications_outbox o
    where o.event_type <> 'customer_portal_recovery_code'
      and o.chosen_channel = 'email'
      and o.attempt_count < o.max_attempts
      and ((o.status = 'queued' and o.available_at <= p_now)
        or (o.status = 'attempting' and o.lease_expires_at <= p_now))
    order by o.available_at, o.created_at, o.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  )
  update public.notifications_outbox o
  set status = 'attempting', attempt_count = o.attempt_count + 1,
      lease_token = p_lease_token,
      lease_expires_at = p_now + pg_catalog.make_interval(
        secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
      ),
      updated_at = p_now
  from due where o.id = due.id
  returning o.*;
end;
$$;

revoke all on function public.claim_notification_outbox(
  uuid, timestamptz, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox(
  uuid, timestamptz, integer, integer
) to service_role;

commit;
