-- 0092 — tenanttät och durable notifications-outbox.
--
-- 0091 skapade rätt ENDA ledger men producenterna skrev transportutfall efter
-- direktutsändning. Den här migrationen gör samma tabell till kön: idempotent
-- enqueue, atomisk SKIP LOCKED-claim, tidsbegränsad lease och CAS-kvittens.
-- Inga transporter eller kanaler aktiveras här.

-- Sammansatta nycklar gör tenantbandet verifierbart av riktiga FK:er för
-- preferenser och push-prenumerationer.
create unique index if not exists customers_id_tenant_unique
  on public.customers (id, tenant_id);

alter table public.customer_notification_prefs
  drop constraint if exists customer_notification_prefs_customer_id_fkey;
alter table public.customer_notification_prefs
  add constraint customer_notification_prefs_customer_tenant_fkey
  foreign key (customer_id, tenant_id)
  references public.customers (id, tenant_id)
  on delete cascade;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_customer_id_fkey;
alter table public.push_subscriptions
  add constraint push_subscriptions_customer_tenant_fkey
  foreign key (customer_id, tenant_id)
  references public.customers (id, tenant_id)
  on delete cascade;

alter table public.notifications_outbox
  add column if not exists event_key text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text,
  add column if not exists parts integer,
  add column if not exists updated_at timestamptz not null default now();

update public.notifications_outbox
   set event_key = 'legacy:' || id::text
 where event_key is null;

alter table public.notifications_outbox
  alter column event_key set default ('legacy:' || gen_random_uuid()::text),
  alter column event_key set not null,
  drop constraint if exists notifications_outbox_status_check,
  drop constraint if exists notifications_outbox_attempt_count_check,
  drop constraint if exists notifications_outbox_max_attempts_check,
  drop constraint if exists notifications_outbox_parts_check,
  add constraint notifications_outbox_status_check
    check (status in ('routing','queued','attempting','delivery_started','sent','delivered','failed','skipped','simulated')),
  add constraint notifications_outbox_attempt_count_check
    check (attempt_count >= 0),
  add constraint notifications_outbox_max_attempts_check
    check (max_attempts between 1 and 20),
  add constraint notifications_outbox_parts_check
    check (parts is null or parts between 1 and 255);

drop index if exists public.notifications_outbox_queued_idx;
create index notifications_outbox_claim_idx
  on public.notifications_outbox (available_at, created_at, id)
  where status in ('queued', 'attempting');

create unique index notifications_outbox_delivery_unique
  on public.notifications_outbox (tenant_id, event_type, event_key, chosen_channel)
  where chosen_channel is not null;

-- Domänhändelser som ännu saknar ett verifierat kanal-/samtyckesbeslut är
-- durable men aldrig claimbara. U4 routar samma rad senare; NULL får därför en
-- egen partiell unikhet i stället för att fabricera en leveranskanal.
create unique index notifications_outbox_routing_unique
  on public.notifications_outbox (tenant_id, event_type, event_key)
  where chosen_channel is null;

-- Service-role bypassar RLS men aldrig triggers. Därför verifieras varje valfri
-- relationsnyckel mot radens tenant här, även vid framtida direkta writes.
create or replace function private.enforce_notification_outbox_tenant_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is not null and not exists (
    select 1 from public.customers c
     where c.id = new.customer_id and c.tenant_id = new.tenant_id
  ) then
    raise exception 'notifications_outbox_customer_tenant_mismatch'
      using errcode = '23514';
  end if;

  if new.booking_id is not null and not exists (
    select 1 from public.bookings b
     where b.id = new.booking_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'notifications_outbox_booking_tenant_mismatch'
      using errcode = '23514';
  end if;

  if new.staff_id is not null and not exists (
    select 1 from public.staff s
     where s.id = new.staff_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'notifications_outbox_staff_tenant_mismatch'
      using errcode = '23514';
  end if;

  -- Även en framtida service-role-callsite får bara persistenta slutna koder.
  -- Fri providertext kan innehålla kontaktdata och ersätts därför, aldrig trimmas.
  if new.skip_reason is not null and new.skip_reason <> all(array[
    'no_consent', 'type_opt_out', 'no_channel', 'missing_recipient',
    'no_recipient', 'channel_disabled', 'consent_denied', 'transport_off',
    'gdpr_erased', 'booking_outcome_changed', 'actor_opted_out',
    'tenant_disabled', 'customer_missing',
    'delivery_skipped', 'delivery_failed', 'delivery_uncertain',
    'provider_rejected', 'payload_invalid'
  ]) then
    new.skip_reason := 'delivery_reason';
  end if;
  if new.last_error is not null and new.last_error <> all(array[
    'delivery_uncertain', 'delivery_failed', 'delivery_retryable',
    'provider_rejected', 'payload_invalid', 'provider_unavailable',
    'provider_rate_limited', 'provider_timeout_before_acceptance',
    'network_unreachable_before_request', 'lease_expired_after_max_attempts'
  ]) then
    new.last_error := 'delivery_error';
  end if;
  if new.provider_ref is not null and (
    length(new.provider_ref) > 200
    or new.provider_ref !~ '^[A-Za-z0-9._:-]+$'
  ) then
    new.provider_ref := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notifications_outbox_tenant_refs on public.notifications_outbox;
create trigger notifications_outbox_tenant_refs
before insert or update on public.notifications_outbox
for each row execute function private.enforce_notification_outbox_tenant_refs();

-- Producent-API. Den stabila fyran tenant/event/event-key/channel kan bara skapa
-- en leveransrad. Vid retry/dubbel-submit returneras den befintliga radens id.
create or replace function public.enqueue_notification(
  p_tenant uuid,
  p_customer uuid,
  p_booking uuid,
  p_staff uuid,
  p_event_type text,
  p_event_key text,
  p_category text,
  p_channel text,
  p_fallback_channel text,
  p_consent_state jsonb,
  p_payload jsonb,
  p_max_attempts integer
) returns table (id uuid, inserted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(p_event_type), '') is null
     or nullif(btrim(p_event_key), '') is null then
    raise exception 'notification_event_identity_required'
      using errcode = '22023';
  end if;
  if p_category not in ('transactional', 'marketing') then
    raise exception 'notification_category_invalid' using errcode = '22023';
  end if;
  if p_channel not in ('push', 'email', 'sms') then
    raise exception 'notification_channel_invalid' using errcode = '22023';
  end if;
  if p_fallback_channel is not null
     and p_fallback_channel not in ('push', 'email', 'sms') then
    raise exception 'notification_fallback_channel_invalid' using errcode = '22023';
  end if;

  insert into public.notifications_outbox (
    tenant_id, customer_id, booking_id, staff_id,
    event_type, event_key, category, chosen_channel, fallback_channel,
    consent_state, payload, status, max_attempts, available_at
  ) values (
    p_tenant, p_customer, p_booking, p_staff,
    btrim(p_event_type), btrim(p_event_key), p_category, p_channel, p_fallback_channel,
    coalesce(p_consent_state, '{}'::jsonb), coalesce(p_payload, '{}'::jsonb),
    'queued', least(greatest(coalesce(p_max_attempts, 5), 1), 20), now()
  )
  on conflict (tenant_id, event_type, event_key, chosen_channel)
    where chosen_channel is not null
  do nothing
  returning notifications_outbox.id into v_id;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  select o.id into v_id
    from public.notifications_outbox o
   where o.tenant_id = p_tenant
     and o.event_type = btrim(p_event_type)
     and o.event_key = btrim(p_event_key)
     and o.chosen_channel = p_channel;
  return query select v_id, false;
end;
$$;

-- Worker claimar atomiskt. En krasch återlämnar raden när leasen går ut.
-- Ett sista försök som kraschade blir terminalt failed vid nästa sweep.
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
  update public.notifications_outbox
     set status = 'failed',
         last_error = 'lease_expired_after_max_attempts',
         lease_token = null,
         lease_expires_at = null,
         updated_at = p_now
   where status = 'attempting'
     and lease_expires_at <= p_now
     and attempt_count >= max_attempts;

  return query
  with due as (
    select o.id
      from public.notifications_outbox o
     where o.attempt_count < o.max_attempts
       and o.chosen_channel is not null
       and (
         (o.status = 'queued' and o.available_at <= p_now)
         or (o.status = 'attempting' and o.lease_expires_at <= p_now)
       )
     order by o.available_at, o.created_at, o.id
     for update skip locked
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
  )
  update public.notifications_outbox o
     set status = 'attempting',
         attempt_count = o.attempt_count + 1,
         lease_token = p_lease_token,
         lease_expires_at = p_now
           + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)),
         updated_at = p_now
    from due
   where o.id = due.id
  returning o.*;
end;
$$;

-- Precis före provideranropet flyttas EN claimad rad till ett icke-återclaimbart
-- läge. Det löser två dubblettrisker: en lång batch vars svanslease gått ut och
-- ett lyckat provideranrop vars efterföljande DB-kvittens misslyckas. Efter denna
-- CAS väljer vi at-most-once; delivery_started kräver manuell avstämning vid krasch.
create or replace function public.begin_notification_delivery(
  p_id uuid,
  p_lease_token uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated uuid;
begin
  update public.notifications_outbox
     set status = 'delivery_started',
         lease_expires_at = null,
         updated_at = now()
   where id = p_id
     and status = 'attempting'
     and lease_token = p_lease_token
     and lease_expires_at > now()
  returning id into v_updated;
  return v_updated is not null;
end;
$$;

-- Terminal kvittens är compare-and-swap på id + token efter begin-CAS. Ett
-- ackfel lämnar delivery_started och kan därför aldrig orsaka automatisk resend.
create or replace function public.ack_notification_outbox(
  p_id uuid,
  p_lease_token uuid,
  p_status text,
  p_provider_ref text,
  p_cost_ore integer,
  p_skip_reason text,
  p_parts integer default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated uuid;
begin
  if p_status not in ('sent', 'delivered', 'failed', 'skipped', 'simulated') then
    raise exception 'notification_terminal_status_invalid' using errcode = '22023';
  end if;

  update public.notifications_outbox
     set status = p_status,
          provider_ref = coalesce(p_provider_ref, provider_ref),
          cost_ore = coalesce(p_cost_ore, cost_ore),
          parts = coalesce(p_parts, parts),
         skip_reason = p_skip_reason,
         sent_at = case when p_status in ('sent', 'delivered') then coalesce(sent_at, now()) else sent_at end,
         delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
         lease_token = null,
         lease_expires_at = null,
         last_error = case when p_status = 'failed' then coalesce(p_skip_reason, last_error) else null end,
         updated_at = now()
   where id = p_id
     and status in ('attempting', 'delivery_started')
     and lease_token = p_lease_token
  returning id into v_updated;

  return v_updated is not null;
end;
$$;

-- Retrykvittens återköar om försök återstår, annars terminaliseras raden.
create or replace function public.retry_notification_outbox(
  p_id uuid,
  p_lease_token uuid,
  p_error text,
  p_retry_at timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  update public.notifications_outbox
     set status = case when attempt_count >= max_attempts then 'failed' else 'queued' end,
         available_at = greatest(coalesce(p_retry_at, now()), now()),
         lease_token = null,
         lease_expires_at = null,
         last_error = left(coalesce(p_error, 'delivery_failed'), 200),
         updated_at = now()
   where id = p_id
     and status = 'delivery_started'
     and lease_token = p_lease_token
  returning status into v_status;
  return v_status;
end;
$$;

-- GDPR-fence: scrubba både direkt kundkopplade rader och booking-only-rader.
-- En aktiv lease görs terminal skipped och token rensas, så ett senare CAS-svar
-- från workern nekas. Ett provideranrop som redan lämnat vår process kan däremot
-- inte återkallas; detta förhindrar endast ny/retryad leverans och sen DB-kvittens.
create or replace function public.scrub_notification_outbox_customer(
  p_customer_ids uuid[],
  p_booking_ids uuid[]
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications_outbox
     set status = case when status in ('routing', 'queued', 'attempting', 'delivery_started') then 'skipped' else status end,
         skip_reason = case when status in ('routing', 'queued', 'attempting', 'delivery_started') then 'gdpr_erased' else skip_reason end,
         customer_id = null,
         booking_id = null,
         payload = '{}'::jsonb,
         provider_ref = null,
         lease_token = null,
         lease_expires_at = null,
         last_error = null,
         updated_at = now()
   where customer_id = any(coalesce(p_customer_ids, array[]::uuid[]))
      or booking_id = any(coalesce(p_booking_ids, array[]::uuid[]));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_notification(
  uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.enqueue_notification(
  uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, integer
) to service_role;

revoke all on function public.claim_notification_outbox(
  uuid, timestamptz, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(
  uuid, timestamptz, integer, integer
) to service_role;

revoke all on function public.begin_notification_delivery(
  uuid, uuid
) from public, anon, authenticated;
grant execute on function public.begin_notification_delivery(
  uuid, uuid
) to service_role;

revoke all on function public.ack_notification_outbox(
  uuid, uuid, text, text, integer, text, integer
) from public, anon, authenticated;
grant execute on function public.ack_notification_outbox(
  uuid, uuid, text, text, integer, text, integer
) to service_role;

revoke all on function public.retry_notification_outbox(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.retry_notification_outbox(
  uuid, uuid, text, timestamptz
) to service_role;

revoke all on function public.scrub_notification_outbox_customer(
  uuid[], uuid[]
) from public, anon, authenticated;
grant execute on function public.scrub_notification_outbox_customer(
  uuid[], uuid[]
) to service_role;
