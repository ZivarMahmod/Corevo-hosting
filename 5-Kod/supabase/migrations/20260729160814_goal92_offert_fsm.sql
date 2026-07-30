-- Goal 92: DB-owned offert FSM/CAS/audit and truthful durable reply delivery.
begin;

alter table public.offert_requests
  add column if not exists lifecycle_version bigint not null default 0,
  add column if not exists reply_delivery_state text not null default 'pending',
  add column if not exists reply_outbox_id uuid,
  add column if not exists reply_error_code text,
  add column if not exists reply_pending_message text,
  add column if not exists reply_content_hash text,
  add column if not exists reply_requested_version bigint,
  add column if not exists reply_requested_by uuid;

-- The old action persisted "sent" before attempting transport. Preserve its
-- text for a safe new attempt, but stop presenting an unverifiable delivery as
-- sent. Existing quoted workflow state is left untouched.
update public.offert_requests
   set reply_pending_message = reply_message,
       reply_message = null,
       replied_at = null,
       reply_delivery_state = 'failed',
       reply_error_code = 'legacy_unverified_delivery'
 where reply_message is not null
    or replied_at is not null;

alter table public.offert_requests
  drop constraint if exists offert_requests_lifecycle_version_check,
  drop constraint if exists offert_requests_reply_delivery_state_check,
  drop constraint if exists offert_requests_reply_error_code_check,
  drop constraint if exists offert_requests_reply_content_hash_check,
  drop constraint if exists offert_requests_reply_sent_check,
  drop constraint if exists offert_requests_reply_link_check,
  add constraint offert_requests_lifecycle_version_check
    check (lifecycle_version >= 0),
  add constraint offert_requests_reply_delivery_state_check
    check (reply_delivery_state in ('pending', 'sent', 'failed')),
  add constraint offert_requests_reply_error_code_check
    check (
      reply_error_code is null
      or reply_error_code in (
        'no_recipient',
        'channel_disabled',
        'consent_denied',
        'transport_off',
        'gdpr_erased',
        'delivery_uncertain',
        'provider_rejected',
        'payload_invalid',
        'delivery_failed',
        'lease_expired_after_max_attempts',
        'simulated_not_delivered',
        'legacy_unverified_delivery'
      )
    ),
  add constraint offert_requests_reply_content_hash_check
    check (
      reply_content_hash is null
      or reply_content_hash ~ '^[a-f0-9]{64}$'
    ),
  add constraint offert_requests_reply_sent_check
    check (
      (reply_message is null and replied_at is null)
      or (
        reply_delivery_state = 'sent'
        and reply_outbox_id is not null
        and reply_message is not null
        and replied_at is not null
      )
    ),
  add constraint offert_requests_reply_link_check
    check (
      (
        reply_outbox_id is null
        and reply_content_hash is null
        and reply_requested_version is null
        and reply_requested_by is null
        and (
          (
            reply_delivery_state = 'pending'
            and reply_pending_message is null
            and reply_error_code is null
          )
          or (
            reply_delivery_state = 'failed'
            and reply_pending_message is not null
            and reply_error_code = 'legacy_unverified_delivery'
          )
        )
      )
      or (
        reply_outbox_id is not null
        and reply_content_hash is not null
        and reply_requested_version is not null
        and reply_requested_by is not null
        and reply_pending_message is not null
        and (
          (reply_delivery_state = 'failed' and reply_error_code is not null)
          or (reply_delivery_state in ('pending', 'sent') and reply_error_code is null)
        )
      )
    );

create unique index if not exists notifications_outbox_id_tenant_unique
  on public.notifications_outbox (id, tenant_id);

alter table public.offert_requests
  drop constraint if exists offert_requests_reply_outbox_tenant_fkey,
  add constraint offert_requests_reply_outbox_tenant_fkey
    foreign key (reply_outbox_id, tenant_id)
    references public.notifications_outbox (id, tenant_id);

create index if not exists offert_requests_reply_outbox_idx
  on public.offert_requests (reply_outbox_id)
  where reply_outbox_id is not null;

create or replace function private.offert_transition_allowed(
  p_from text,
  p_to text
) returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_from = p_to
    or (p_from = 'new' and p_to in ('reviewing', 'quoted', 'declined', 'closed'))
    or (p_from = 'reviewing' and p_to in ('quoted', 'declined', 'closed'))
    or (p_from = 'quoted' and p_to in ('accepted', 'declined', 'closed'))
    or (p_from in ('accepted', 'declined') and p_to = 'closed')
$$;

revoke all on function private.offert_transition_allowed(text, text)
  from public, anon, authenticated, service_role;

create or replace function private.assert_offert_admin(p_tenant uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_session_tenant uuid := (select private.tenant_id());
  v_level integer := (select private.role_level());
  v_external_scope boolean := (select private.can_access_tenant(p_tenant));
begin
  if v_uid is null
     or not (
       (v_session_tenant = p_tenant and coalesce(v_level, 0) >= 6)
       or coalesce(v_external_scope, false)
     )
     or not exists (
       select 1
         from public.tenants t
        where t.id = p_tenant
          and t.status = 'active'
     ) then
    raise exception 'offert_access_denied' using errcode = '42501';
  end if;

  if (select private.module_state(p_tenant, 'offert')) not in ('draft', 'live') then
    raise exception 'offert_module_read_only' using errcode = '55000';
  end if;

  return v_uid;
end;
$$;

revoke all on function private.assert_offert_admin(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.update_offert_request(
  p_tenant uuid,
  p_request uuid,
  p_expected_version bigint,
  p_status text,
  p_note text,
  p_estimate_cents integer
) returns table (
  outcome text,
  offert_status text,
  version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_offert_admin(p_tenant);
  v_request public.offert_requests%rowtype;
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  v_version bigint;
begin
  if p_expected_version is null
     or p_expected_version < 0
     or p_status not in ('new', 'reviewing', 'quoted', 'accepted', 'declined', 'closed')
     or p_estimate_cents is not null and p_estimate_cents < 0
     or pg_catalog.char_length(v_note) > 6000 then
    raise exception 'offert_input_invalid' using errcode = '22023';
  end if;

  select q.*
    into v_request
    from public.offert_requests q
   where q.id = p_request
     and q.tenant_id = p_tenant
   for update;

  if v_request.id is null then
    return query select 'not_found'::text, null::text, null::bigint;
    return;
  end if;
  if v_request.lifecycle_version <> p_expected_version then
    return query select 'stale'::text, v_request.status, v_request.lifecycle_version;
    return;
  end if;
  if v_request.reply_outbox_id is not null
     and v_request.reply_delivery_state = 'pending'
     and (
       v_request.status is distinct from p_status
       or v_request.note is distinct from v_note
       or v_request.estimate_cents is distinct from p_estimate_cents
     ) then
    return query select 'delivery_pending'::text, v_request.status, v_request.lifecycle_version;
    return;
  end if;
  if not private.offert_transition_allowed(v_request.status, p_status) then
    raise exception 'offert_status_transition_invalid' using errcode = '55000';
  end if;
  -- "quoted" is a delivery fact. Only finalize_offert_reply may create it.
  if p_status = 'quoted' and v_request.status <> 'quoted' then
    raise exception 'offert_quote_delivery_required' using errcode = '55000';
  end if;
  if v_request.status = p_status
     and v_request.note is not distinct from v_note
     and v_request.estimate_cents is not distinct from p_estimate_cents then
    return query select 'unchanged'::text, v_request.status, v_request.lifecycle_version;
    return;
  end if;

  v_version := v_request.lifecycle_version + 1;
  update public.offert_requests q
     set status = p_status,
         note = v_note,
         estimate_cents = p_estimate_cents,
         lifecycle_version = v_version
   where q.id = v_request.id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    v_actor,
    'offert_request.updated',
    'offert_requests',
    v_request.id,
    pg_catalog.jsonb_build_object(
      'from_status', v_request.status,
      'to_status', p_status,
      'lifecycle_version', v_version
    )
  );

  return query select 'changed'::text, p_status, v_version;
end;
$$;

create or replace function public.delete_offert_request(
  p_tenant uuid,
  p_request uuid,
  p_expected_version bigint
) returns table (
  outcome text,
  version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_offert_admin(p_tenant);
  v_request public.offert_requests%rowtype;
  v_version bigint;
begin
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'offert_input_invalid' using errcode = '22023';
  end if;

  select q.*
    into v_request
    from public.offert_requests q
   where q.id = p_request
     and q.tenant_id = p_tenant
   for update;

  if v_request.id is null then
    return query select 'not_found'::text, null::bigint;
    return;
  end if;
  if v_request.lifecycle_version <> p_expected_version then
    return query select 'stale'::text, v_request.lifecycle_version;
    return;
  end if;
  if v_request.status = 'accepted'
     or v_request.payment_status <> 'unpaid'
     or (
       v_request.reply_outbox_id is not null
       and v_request.reply_delivery_state = 'pending'
     ) then
    return query select 'protected'::text, v_request.lifecycle_version;
    return;
  end if;

  v_version := v_request.lifecycle_version + 1;
  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    v_actor,
    'offert_request.deleted',
    'offert_requests',
    v_request.id,
    pg_catalog.jsonb_build_object(
      'from_status', v_request.status,
      'to_status', 'deleted',
      'lifecycle_version', v_version
    )
  );

  delete from public.offert_requests q where q.id = v_request.id;
  return query select 'deleted'::text, v_version;
end;
$$;

create or replace function public.enqueue_offert_reply(
  p_tenant uuid,
  p_request uuid,
  p_expected_version bigint,
  p_reply text
) returns table (
  outcome text,
  outbox_id uuid,
  version bigint,
  delivery_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_offert_admin(p_tenant);
  v_request public.offert_requests%rowtype;
  v_reply text := pg_catalog.btrim(coalesce(p_reply, ''));
  v_hash text;
  v_event_key text;
  v_outbox uuid;
  v_inserted boolean;
  v_version bigint;
begin
  if p_expected_version is null
     or p_expected_version < 0
     or pg_catalog.char_length(v_reply) < 1
     or pg_catalog.char_length(v_reply) > 6000 then
    raise exception 'offert_reply_invalid' using errcode = '22023';
  end if;

  v_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_reply, 'UTF8'), 'sha256'),
    'hex'
  );

  select q.*
    into v_request
    from public.offert_requests q
   where q.id = p_request
     and q.tenant_id = p_tenant
   for update;

  if v_request.id is null then
    return query select 'not_found'::text, null::uuid, null::bigint, null::text;
    return;
  end if;
  if nullif(pg_catalog.btrim(coalesce(v_request.customer_email, '')), '') is null then
    return query select
      'missing_email'::text,
      null::uuid,
      v_request.lifecycle_version,
      v_request.reply_delivery_state;
    return;
  end if;

  -- A currently claimable/retryable attempt owns the reply slot. Repeated
  -- submission of the same text always targets that exact durable row.
  if v_request.reply_outbox_id is not null
     and v_request.reply_delivery_state = 'pending' then
    if v_request.reply_content_hash = v_hash then
      return query select
        'existing'::text,
        v_request.reply_outbox_id,
        v_request.lifecycle_version,
        v_request.reply_delivery_state;
    elsif v_request.lifecycle_version <> p_expected_version then
      return query select
        'stale'::text,
        v_request.reply_outbox_id,
        v_request.lifecycle_version,
        v_request.reply_delivery_state;
    else
      return query select
        'delivery_pending'::text,
        v_request.reply_outbox_id,
        v_request.lifecycle_version,
        v_request.reply_delivery_state;
    end if;
    return;
  end if;

  -- Lost HTTP/finalize responses may retry the original version after the row
  -- has advanced. The same version+content must reuse the same outbox id.
  if v_request.reply_outbox_id is not null
     and v_request.reply_requested_version = p_expected_version
     and v_request.reply_content_hash = v_hash then
    return query select
      'existing'::text,
      v_request.reply_outbox_id,
      v_request.lifecycle_version,
      v_request.reply_delivery_state;
    return;
  end if;

  if v_request.lifecycle_version <> p_expected_version then
    return query select
      'stale'::text,
      v_request.reply_outbox_id,
      v_request.lifecycle_version,
      v_request.reply_delivery_state;
    return;
  end if;
  if not private.offert_transition_allowed(v_request.status, 'quoted') then
    return query select
      'status_conflict'::text,
      null::uuid,
      v_request.lifecycle_version,
      v_request.reply_delivery_state;
    return;
  end if;

  v_event_key := 'offert:' || v_request.id::text
    || ':reply:v' || p_expected_version::text || ':' || v_hash;

  select n.id, n.inserted
    into v_outbox, v_inserted
    from public.enqueue_notification(
      p_tenant => p_tenant,
      p_customer => v_request.customer_id,
      p_booking => null,
      p_staff => null,
      p_event_type => 'offert_reply',
      p_event_key => v_event_key,
      p_category => 'transactional',
      p_channel => 'email',
      p_fallback_channel => null,
      p_consent_state => pg_catalog.jsonb_build_object(
        'category', 'transactional',
        'type', 'offert_reply'
      ),
      p_payload => pg_catalog.jsonb_build_object(
        'offert_request_id', v_request.id
      ),
      p_max_attempts => 3
    ) n;

  if v_outbox is null then
    raise exception 'offert_reply_outbox_missing' using errcode = 'P0002';
  end if;

  v_version := v_request.lifecycle_version + 1;
  update public.offert_requests q
     set lifecycle_version = v_version,
         reply_delivery_state = 'pending',
         reply_outbox_id = v_outbox,
         reply_error_code = null,
         reply_pending_message = v_reply,
         reply_content_hash = v_hash,
         reply_requested_version = p_expected_version,
         reply_requested_by = v_actor
   where q.id = v_request.id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    v_actor,
    'offert_request.reply_queued',
    'offert_requests',
    v_request.id,
    pg_catalog.jsonb_build_object(
      'from_status', v_request.status,
      'to_status', v_request.status,
      'lifecycle_version', v_version,
      'outbox_id', v_outbox
    )
  );

  return query select
    case when v_inserted then 'queued' else 'existing' end,
    v_outbox,
    v_version,
    'pending'::text;
end;
$$;

create or replace function public.finalize_offert_reply(
  p_tenant uuid,
  p_request uuid,
  p_outbox uuid
) returns table (
  outcome text,
  offert_status text,
  version bigint,
  delivery_state text,
  error_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.offert_requests%rowtype;
  v_outbox public.notifications_outbox%rowtype;
  v_version bigint;
  v_error text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'offert_finalize_access_denied' using errcode = '42501';
  end if;

  select q.*
    into v_request
    from public.offert_requests q
   where q.id = p_request
     and q.tenant_id = p_tenant
   for update;

  if v_request.id is null then
    return query select
      'not_found'::text, null::text, null::bigint, null::text, null::text;
    return;
  end if;
  if v_request.reply_outbox_id is distinct from p_outbox then
    raise exception 'offert_reply_outbox_mismatch' using errcode = '42501';
  end if;

  select o.*
    into v_outbox
    from public.notifications_outbox o
   where o.id = p_outbox
     and o.tenant_id = p_tenant
     and o.event_type = 'offert_reply'
     and o.payload = pg_catalog.jsonb_build_object(
       'offert_request_id', v_request.id
     )
   for update;

  if v_outbox.id is null then
    raise exception 'offert_reply_outbox_mismatch' using errcode = '42501';
  end if;
  if v_request.reply_delivery_state = 'sent' then
    return query select
      'already_sent'::text,
      v_request.status,
      v_request.lifecycle_version,
      v_request.reply_delivery_state,
      null::text;
    return;
  end if;
  if v_request.reply_delivery_state = 'failed' then
    return query select
      'already_failed'::text,
      v_request.status,
      v_request.lifecycle_version,
      v_request.reply_delivery_state,
      v_request.reply_error_code;
    return;
  end if;

  if v_outbox.status in ('routing', 'queued', 'attempting', 'delivery_started') then
    return query select
      'pending'::text,
      v_request.status,
      v_request.lifecycle_version,
      v_request.reply_delivery_state,
      null::text;
    return;
  end if;

  if v_outbox.status in ('sent', 'delivered') then
    if not private.offert_transition_allowed(v_request.status, 'quoted') then
      raise exception 'offert_status_transition_invalid' using errcode = '55000';
    end if;

    v_version := v_request.lifecycle_version + 1;
    update public.offert_requests q
       set status = 'quoted',
           reply_message = q.reply_pending_message,
           replied_at = coalesce(v_outbox.delivered_at, v_outbox.sent_at, pg_catalog.now()),
           reply_delivery_state = 'sent',
           reply_error_code = null,
           lifecycle_version = v_version
     where q.id = v_request.id;

    insert into public.audit_log (
      tenant_id, actor_profile_id, action, entity, entity_id, meta
    ) values (
      p_tenant,
      v_request.reply_requested_by,
      'offert_request.reply_sent',
      'offert_requests',
      v_request.id,
      pg_catalog.jsonb_build_object(
        'from_status', v_request.status,
        'to_status', 'quoted',
        'lifecycle_version', v_version,
        'outbox_id', v_outbox.id
      )
    );

    return query select
      'sent'::text, 'quoted'::text, v_version, 'sent'::text, null::text;
    return;
  end if;

  if v_outbox.status = 'simulated' then
    v_error := 'simulated_not_delivered';
  elsif v_outbox.last_error in (
    'delivery_uncertain',
    'provider_rejected',
    'payload_invalid',
    'delivery_failed',
    'lease_expired_after_max_attempts'
  ) then
    v_error := v_outbox.last_error;
  elsif v_outbox.skip_reason in (
    'no_recipient',
    'channel_disabled',
    'consent_denied',
    'transport_off',
    'gdpr_erased',
    'delivery_uncertain',
    'provider_rejected',
    'payload_invalid',
    'delivery_failed'
  ) then
    v_error := v_outbox.skip_reason;
  else
    v_error := 'delivery_failed';
  end if;

  v_version := v_request.lifecycle_version + 1;
  update public.offert_requests q
     set reply_delivery_state = 'failed',
         reply_error_code = v_error,
         lifecycle_version = v_version
   where q.id = v_request.id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    v_request.reply_requested_by,
    'offert_request.reply_failed',
    'offert_requests',
    v_request.id,
    pg_catalog.jsonb_build_object(
      'from_status', v_request.status,
      'to_status', v_request.status,
      'lifecycle_version', v_version,
      'outbox_id', v_outbox.id,
      'error_code', v_error
    )
  );

  return query select
    'failed'::text,
    v_request.status,
    v_version,
    'failed'::text,
    v_error;
end;
$$;

create or replace function public.offert_reply_delivery_target(
  p_outbox uuid,
  p_lease_token uuid
) returns table (
  outcome text,
  tenant_id uuid,
  tenant_name text,
  customer_email text,
  customer_name text,
  subject text,
  reply_message text,
  estimate_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'offert_delivery_target_access_denied' using errcode = '42501';
  end if;

  return query
  select
    'target'::text,
    q.tenant_id,
    t.name,
    q.customer_email,
    q.customer_name,
    q.subject,
    q.reply_pending_message,
    q.estimate_cents
  from public.notifications_outbox o
  join public.offert_requests q
    on q.reply_outbox_id = o.id
   and q.tenant_id = o.tenant_id
  join public.tenants t on t.id = q.tenant_id
  where o.id = p_outbox
    and o.lease_token = p_lease_token
    and o.status = 'delivery_started'
    and o.event_type = 'offert_reply'
    and o.payload = pg_catalog.jsonb_build_object(
      'offert_request_id', q.id
    )
    and q.reply_delivery_state = 'pending'
    and q.reply_pending_message is not null
    and nullif(pg_catalog.btrim(coalesce(q.customer_email, '')), '') is not null;
end;
$$;

-- Extend the existing exact-id accelerator; the generic worker contract stays
-- unchanged and only this explicit transactional event is added.
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
         'booking_verification_pin',
         'booking_confirmation',
         'booking_request_received',
         'customer_portal_recovery_code',
         'offert_reply'
       )
       and o.chosen_channel in ('sms', 'email')
       and o.attempt_count < o.max_attempts
       and (
         (
           o.status = 'queued'
           and (
             o.event_type in (
               'booking_verification_pin',
               'customer_portal_recovery_code'
             )
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
           secs => least(
             greatest(coalesce(p_lease_seconds, 120), 30),
             900
           )
         ),
         updated_at = p_now
    from due
   where o.id = due.id
  returning o.*;
end;
$$;

revoke update, delete on table public.offert_requests
  from public, anon, authenticated;
grant select on table public.offert_requests to authenticated;
grant insert on table public.offert_requests to service_role;

revoke all on function public.update_offert_request(
  uuid, uuid, bigint, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.update_offert_request(
  uuid, uuid, bigint, text, text, integer
) to authenticated;

revoke all on function public.delete_offert_request(
  uuid, uuid, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.delete_offert_request(
  uuid, uuid, bigint
) to authenticated;

revoke all on function public.enqueue_offert_reply(
  uuid, uuid, bigint, text
) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_offert_reply(
  uuid, uuid, bigint, text
) to authenticated;

revoke all on function public.finalize_offert_reply(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_offert_reply(
  uuid, uuid, uuid
) to service_role;

revoke all on function public.offert_reply_delivery_target(
  uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.offert_reply_delivery_target(
  uuid, uuid
) to service_role;

revoke all on function public.claim_notification_outbox_by_id(
  uuid, uuid, timestamptz, integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox_by_id(
  uuid, uuid, timestamptz, integer
) to service_role;

comment on function public.update_offert_request(
  uuid, uuid, bigint, text, text, integer
) is 'Goal 92: tenant/role/module-gated CAS update; quoted is delivery-owned.';
comment on function public.enqueue_offert_reply(
  uuid, uuid, bigint, text
) is 'Goal 92: idempotent reply intent linked to one durable notifications_outbox row.';
comment on function public.finalize_offert_reply(
  uuid, uuid, uuid
) is 'Goal 92: service-only domain finalize from the exact linked outbox truth.';
comment on function public.offert_reply_delivery_target(
  uuid, uuid
) is 'Goal 92: expose one reply target only after exact outbox delivery CAS.';

commit;
