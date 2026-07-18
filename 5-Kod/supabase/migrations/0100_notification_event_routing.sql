-- 0100 — U4: one tenant-safe routing decision for every booking notification.
-- Business mutations never call a provider. They record one stable domain event;
-- the existing durable outbox owns delivery/retry. SMS/global dispatch remains
-- physically unwired until the explicit release gate is approved.

begin;

create or replace function public.route_booking_notification(
  p_tenant uuid,
  p_booking uuid,
  p_staff uuid,
  p_event_type text,
  p_event_key text,
  p_category text,
  p_type_opt_in text,
  p_expected_statuses text[],
  p_payload jsonb,
  p_allow boolean default true,
  p_skip_reason text default null,
  p_outbox_id uuid default null
) returns table (
  id uuid,
  status text,
  chosen_channel text,
  skip_reason text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer public.customers%rowtype;
  v_prefs public.customer_notification_prefs%rowtype;
  v_existing public.notifications_outbox%rowtype;
  v_settings jsonb := '{}'::jsonb;
  v_channels text[] := array[]::text[];
  v_channel text;
  v_fallback text;
  v_status text;
  v_reason text;
  v_consent jsonb;
  v_has_push boolean := false;
  v_sms_enabled boolean := false;
  v_new_id uuid;
  v_inserted boolean := false;
begin
  if p_tenant is null
     or p_booking is null
     or p_event_type not in (
       'booking_request_received', 'booking_confirmation', 'booking_cancelled', 'booking_rebooked',
       'booking_reminder', 'booking_completed'
     )
     or p_event_key is null
     or length(p_event_key) < 8
     or length(p_event_key) > 300
     or p_category not in ('transactional', 'marketing')
     or p_type_opt_in is not null
        and p_type_opt_in not in ('reminders', 'recommendations')
     or p_expected_statuses is null
     or cardinality(p_expected_statuses) = 0
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_skip_reason is not null
        and p_skip_reason not in ('actor_opted_out', 'tenant_disabled') then
    raise exception 'booking_notification_invalid_input' using errcode = '22023';
  end if;

  -- One transaction owns a domain key. The partial indexes
  -- notifications_outbox_routing_unique / notifications_outbox_delivery_unique
  -- remain the final backstop, including callers in separate app workers.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant::text || ':' || p_event_type || ':' || p_event_key,
      0
    )
  );

  -- This lock serializes status correction (including completed -> no_show) with
  -- the routing decision. If routing wins, 0095's status trigger subsequently
  -- closes the queued row; if correction wins, this call records a terminal skip.
  select b.* into v_booking
    from public.bookings b
   where b.id = p_booking
     and b.tenant_id = p_tenant
   for no key update;
  if not found then
    raise exception 'booking_notification_booking_not_found' using errcode = 'P0002';
  end if;
  if p_staff is not null and p_staff <> v_booking.staff_id then
    raise exception 'booking_notification_staff_mismatch' using errcode = '42501';
  end if;

  if p_outbox_id is not null then
    select o.* into v_existing
      from public.notifications_outbox o
     where o.id = p_outbox_id
       and o.tenant_id = p_tenant
       and o.booking_id = p_booking
       and o.event_type = p_event_type
       and o.event_key = p_event_key
     for update;
    if not found then
      raise exception 'booking_notification_outbox_mismatch' using errcode = '42501';
    end if;
  else
    select o.* into v_existing
      from public.notifications_outbox o
     where o.tenant_id = p_tenant
       and o.event_type = p_event_type
       and o.event_key = p_event_key
     order by
       case when o.status in ('delivery_started', 'sent', 'delivered', 'simulated') then 0 else 1 end,
       o.created_at,
       o.id
     limit 1
     for update;
  end if;

  if found
     and v_existing.status not in ('routing', 'skipped') then
    return query select
      v_existing.id, v_existing.status, v_existing.chosen_channel,
      v_existing.skip_reason, false;
    return;
  end if;

  -- Actor choice is immutable for this event. Dynamic reminder skips may reopen
  -- when contact/settings change before the appointment; other terminal skips do not.
  if found
     and v_existing.status = 'skipped'
     and not (
       p_event_type = 'booking_reminder'
       and v_existing.skip_reason in ('tenant_disabled', 'no_channel', 'type_opt_out')
     ) then
    return query select
      v_existing.id, v_existing.status, v_existing.chosen_channel,
      v_existing.skip_reason, false;
    return;
  end if;

  if v_booking.customer_id is not null then
    select c.* into v_customer
      from public.customers c
     where c.id = v_booking.customer_id
       and c.tenant_id = p_tenant;
  elsif v_booking.customer_profile_id is not null then
    select c.* into v_customer
      from public.customers c
     where c.auth_user_id = v_booking.customer_profile_id
       and c.tenant_id = p_tenant
       and c.status = 'active'
     order by c.created_at, c.id
     limit 1;
  end if;

  if v_customer.id is not null then
    select p.* into v_prefs
      from public.customer_notification_prefs p
     where p.customer_id = v_customer.id
       and p.tenant_id = p_tenant;
    select exists (
      select 1
        from public.push_subscriptions s
       where s.customer_id = v_customer.id
         and s.tenant_id = p_tenant
         and s.revoked_at is null
    ) into v_has_push;
  end if;

  select coalesce(ts.settings, '{}'::jsonb) into v_settings
    from public.tenant_settings ts
   where ts.tenant_id = p_tenant;
  v_settings := coalesce(v_settings, '{}'::jsonb);
  v_sms_enabled := coalesce(v_settings ->> 'sms_enabled', 'false') = 'true';

  v_status := 'queued';
  v_reason := null;

  if not p_allow then
    v_status := 'skipped';
    v_reason := coalesce(p_skip_reason, 'actor_opted_out');
  elsif not (v_booking.status = any(p_expected_statuses)) then
    v_status := 'skipped';
    v_reason := 'booking_outcome_changed';
  elsif v_customer.id is null then
    v_status := 'skipped';
    v_reason := 'customer_missing';
  elsif p_event_type in ('booking_request_received', 'booking_confirmation')
        and coalesce(v_settings -> 'notifications' ->> 'confirmation', 'true') = 'false' then
    v_status := 'skipped';
    v_reason := 'tenant_disabled';
  elsif p_event_type = 'booking_reminder'
        and coalesce(v_settings -> 'notifications' ->> 'reminder', 'true') = 'false' then
    v_status := 'skipped';
    v_reason := 'tenant_disabled';
  elsif p_category = 'marketing'
        and coalesce(v_prefs.marketing_consent, false) is not true then
    v_status := 'skipped';
    v_reason := 'no_consent';
  elsif p_type_opt_in = 'recommendations'
        and coalesce(v_prefs.want_recommendations, false) is not true then
    v_status := 'skipped';
    v_reason := 'type_opt_out';
  elsif p_type_opt_in = 'reminders'
        and v_prefs.customer_id is not null
        and v_prefs.want_reminders is not true then
    v_status := 'skipped';
    v_reason := 'type_opt_out';
  end if;

  if v_status = 'queued' then
    if v_has_push and coalesce(v_prefs.push_enabled, false) then
      v_channels := pg_catalog.array_append(v_channels, 'push');
    end if;
    if v_customer.email is not null
       and btrim(v_customer.email) <> ''
       and (v_prefs.customer_id is null or v_prefs.email_enabled) then
      v_channels := pg_catalog.array_append(v_channels, 'email');
    end if;
    if v_customer.phone is not null
       and btrim(v_customer.phone) <> ''
       and v_sms_enabled
       and (v_prefs.customer_id is null or v_prefs.sms_enabled) then
      v_channels := pg_catalog.array_append(v_channels, 'sms');
    end if;

    -- Mandatory confirmation/cancellation must not disappear solely due to a
    -- customer channel toggle when an address exists. Reminders/rebooks respect
    -- the current per-channel preference and marketing never enters this branch.
    if cardinality(v_channels) = 0
       and p_event_type in ('booking_request_received', 'booking_confirmation', 'booking_cancelled')
       and v_customer.email is not null
       and btrim(v_customer.email) <> '' then
      v_channels := pg_catalog.array_append(v_channels, 'email');
    end if;

    if cardinality(v_channels) = 0 then
      v_status := 'skipped';
      v_reason := 'no_channel';
    else
      v_channel := v_channels[1];
      if cardinality(v_channels) > 1 then v_fallback := v_channels[2]; end if;
    end if;
  end if;

  v_consent := pg_catalog.jsonb_build_object(
    'category', p_category,
    'type', p_event_type,
    'has_prefs', v_prefs.customer_id is not null,
    'push_enabled', coalesce(v_prefs.push_enabled, false),
    'email_enabled', coalesce(v_prefs.email_enabled, true),
    'sms_enabled', case when v_prefs.customer_id is null then null else v_prefs.sms_enabled end,
    'marketing_consent', coalesce(v_prefs.marketing_consent, false),
    'tenant_sms_enabled', v_sms_enabled
  );

  if v_existing.id is not null then
    update public.notifications_outbox o
       set customer_id = v_customer.id,
           staff_id = v_booking.staff_id,
           chosen_channel = case when v_status = 'queued' then v_channel else null end,
           fallback_channel = case when v_status = 'queued' then v_fallback else null end,
           consent_state = v_consent,
           payload = p_payload,
           status = v_status,
           skip_reason = v_reason,
           attempt_count = 0,
           available_at = pg_catalog.statement_timestamp(),
           lease_token = null,
           lease_expires_at = null,
           last_error = null,
           updated_at = pg_catalog.statement_timestamp()
     where o.id = v_existing.id
       and o.tenant_id = p_tenant
       and o.status in ('routing', 'skipped')
     returning o.id into v_new_id;
    v_inserted := false;
  else
    insert into public.notifications_outbox (
      tenant_id, customer_id, booking_id, staff_id,
      event_type, event_key, category, chosen_channel, fallback_channel,
      consent_state, payload, status, skip_reason, max_attempts, available_at
    ) values (
      p_tenant, v_customer.id, p_booking, v_booking.staff_id,
      p_event_type, p_event_key, p_category,
      case when v_status = 'queued' then v_channel else null end,
      case when v_status = 'queued' then v_fallback else null end,
      v_consent, p_payload, v_status, v_reason, 5, pg_catalog.statement_timestamp()
    )
    returning notifications_outbox.id into v_new_id;
    v_inserted := true;
  end if;

  if v_new_id is null then
    raise exception 'booking_notification_route_cas_failed' using errcode = '40001';
  end if;

  return query
  select v_new_id, v_status,
         case when v_status = 'queued' then v_channel else null end,
         v_reason, v_inserted;
end;
$$;

revoke all on function public.route_booking_notification(
  uuid, uuid, uuid, text, text, text, text, text[], jsonb, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.route_booking_notification(
  uuid, uuid, uuid, text, text, text, text, text[], jsonb, boolean, text, uuid
) to service_role;

commit;
