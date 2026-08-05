-- One cancellation mutation owner for every verified customer surface.
-- The row transition, status history, notification routing and refund trigger
-- either commit together or roll back together.

begin;

-- Fail before changing schema when historical settings violate the new policy.
-- Operators must repair the offending tenant explicitly; this migration never
-- guesses or normalizes business policy.
do $preflight$
begin
  if exists (
    select 1
    from public.tenant_settings ts
    where not (
      case
        when not (ts.settings ? 'cancellation_cutoff_hours') then true
        when pg_catalog.jsonb_typeof(ts.settings -> 'cancellation_cutoff_hours') <> 'number' then false
        else
          (ts.settings ->> 'cancellation_cutoff_hours')::numeric
            = pg_catalog.trunc((ts.settings ->> 'cancellation_cutoff_hours')::numeric)
          and (ts.settings ->> 'cancellation_cutoff_hours')::numeric between 0 and 8760
      end
    )
  ) then
    raise exception 'invalid_existing_cancellation_cutoff_hours' using errcode = '23514';
  end if;

  -- Do not silently inherit an old paid cancellation that escaped the universal
  -- transition trigger. Creating financial jobs during a schema deployment is
  -- too surprising; stop so an operator can reconcile the exact rows first.
  if exists (
    select 1
    from public.bookings b
    join public.payments p
      on p.tenant_id = b.tenant_id
     and p.booking_id = b.id
     and p.status = 'succeeded'
    where b.status = 'cancelled'
      and not exists (
        select 1
        from private.payment_refund_jobs j
        where j.tenant_id = b.tenant_id
          and j.booking_id = b.id
          and j.payment_id = p.id
      )
  ) then
    raise exception 'legacy_cancelled_booking_refund_gap' using errcode = '55000';
  end if;
end
$preflight$;

alter table public.tenant_settings
  add constraint tenant_settings_cancellation_cutoff_hours_check
  check (
    case
      when not (settings ? 'cancellation_cutoff_hours') then true
      when pg_catalog.jsonb_typeof(settings -> 'cancellation_cutoff_hours') <> 'number' then false
      else
        (settings ->> 'cancellation_cutoff_hours')::numeric
          = pg_catalog.trunc((settings ->> 'cancellation_cutoff_hours')::numeric)
        and (settings ->> 'cancellation_cutoff_hours')::numeric between 0 and 8760
    end
  ) not valid;
alter table public.tenant_settings
  validate constraint tenant_settings_cancellation_cutoff_hours_check;

create index if not exists payment_refund_jobs_tenant_booking_idx
  on private.payment_refund_jobs (tenant_id, booking_id);

create or replace function private.cancel_customer_booking(
  p_tenant uuid,
  p_booking uuid,
  p_customer uuid,
  p_customer_profile uuid,
  p_expected_cutoff_hours integer
) returns table (outcome text, booking_status text, refund_job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_now timestamptz;
  v_cutoff integer := 24;
  v_event_key text := 'booking:' || p_booking::text || ':cancelled';
  v_refund_job_id uuid;
begin
  if p_tenant is null
     or p_booking is null
     or (p_customer is null and p_customer_profile is null) then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;
  if p_expected_cutoff_hours is not null
     and (p_expected_cutoff_hours < 0 or p_expected_cutoff_hours > 8760) then
    raise exception 'cancellation_cutoff_hours_invalid' using errcode = '22023';
  end if;

  -- route_booking_notification takes this advisory key before it locks the
  -- booking. Take the same key first so a concurrent router and cancellation
  -- can never acquire notification/booking locks in opposite order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant::text || ':booking_cancelled:' || v_event_key,
      0
    )
  );

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking
    and b.tenant_id = p_tenant
    and (
      (p_customer is not null and b.customer_id = p_customer)
      or (p_customer_profile is not null and b.customer_profile_id = p_customer_profile)
    )
  for update;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;

  if v_booking.status = 'cancelled' then
    select j.id into v_refund_job_id
    from private.payment_refund_jobs j
    where j.tenant_id = p_tenant and j.booking_id = p_booking
    order by j.created_at, j.id
    limit 1;
    if exists (
      select 1
      from public.payments p
      where p.tenant_id = p_tenant
        and p.booking_id = p_booking
        and p.status = 'succeeded'
        and not exists (
          select 1
          from private.payment_refund_jobs j
          where j.tenant_id = p.tenant_id
            and j.booking_id = p.booking_id
            and j.payment_id = p.id
        )
    ) then
      raise exception 'cancelled_booking_refund_invariant_violation' using errcode = '55000';
    end if;
    return query select 'already_cancelled'::text, 'cancelled'::text, v_refund_job_id;
    return;
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    return query select 'not_allowed'::text, v_booking.status, null::uuid;
    return;
  end if;

  select coalesce(
    (ts.settings ->> 'cancellation_cutoff_hours')::numeric::integer,
    24
  ) into v_cutoff
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant;
  v_cutoff := coalesce(v_cutoff, 24);

  if p_expected_cutoff_hours is not null
     and p_expected_cutoff_hours is distinct from v_cutoff then
    return query select 'policy_changed'::text, v_booking.status, null::uuid;
    return;
  end if;
  -- Evaluate the boundary after all contended locks. statement_timestamp()
  -- would preserve the caller's pre-wait time and could allow a cancellation
  -- whose cutoff passed while this transaction waited.
  v_now := pg_catalog.clock_timestamp();
  if v_booking.start_ts <= v_now + pg_catalog.make_interval(hours => v_cutoff) then
    return query select 'not_allowed'::text, v_booking.status, null::uuid;
    return;
  end if;

  update public.bookings b
  set status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = 'customer'
  where b.id = v_booking.id
    and b.tenant_id = p_tenant
    and b.status in ('pending', 'confirmed')
    and (
      (p_customer is not null and b.customer_id = p_customer)
      or (p_customer_profile is not null and b.customer_profile_id = p_customer_profile)
    );
  if not found then
    raise exception 'customer_booking_cancel_cas_failed' using errcode = '40001';
  end if;

  perform 1 from public.route_booking_notification(
    p_tenant => p_tenant,
    p_booking => v_booking.id,
    p_staff => v_booking.staff_id,
    p_event_type => 'booking_cancelled',
    p_event_key => v_event_key,
    p_category => 'transactional',
    p_type_opt_in => null,
    p_expected_statuses => array['cancelled']::text[],
    p_payload => pg_catalog.jsonb_build_object(
      'template', 'booking_cancelled',
      'booking_id', v_booking.id,
      'occurred_at', v_now,
      'start_iso', v_booking.start_ts,
      'include_manage_link', false,
      'include_account_claim', false
    ),
    p_allow => true,
    p_skip_reason => null,
    p_outbox_id => null
  );

  -- The universal booking-status trigger owns refund creation. Reading its
  -- result here exposes the same response contract without a second enqueue.
  select j.id into v_refund_job_id
  from private.payment_refund_jobs j
  where j.tenant_id = p_tenant and j.booking_id = p_booking
  order by j.created_at, j.id
  limit 1;

  return query select 'cancelled'::text, 'cancelled'::text, v_refund_job_id;
end;
$$;

revoke all on function private.cancel_customer_booking(uuid,uuid,uuid,uuid,integer)
  from public, anon, authenticated, service_role;

create or replace function public.cancel_verified_customer_booking(
  p_tenant uuid,
  p_booking uuid,
  p_customer uuid,
  p_customer_profile uuid
) returns table (outcome text, booking_status text, refund_job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  return query
  select *
  from private.cancel_customer_booking(
    p_tenant,
    p_booking,
    p_customer,
    p_customer_profile,
    null
  );
end;
$$;

revoke all on function public.cancel_verified_customer_booking(uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_verified_customer_booking(uuid,uuid,uuid,uuid)
  to service_role;

create or replace function public.customer_portal_cancel_booking(
  p_session_public_id uuid,
  p_secret_digest text,
  p_booking_public_id uuid,
  p_expected_cutoff_hours integer,
  p_idempotency_key text
) returns table (outcome text, booking_status text, refund_job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_audit private.customer_portal_audit%rowtype;
  v_core record;
  v_now timestamptz := statement_timestamp();
  v_refund_job_id uuid;
begin
  if p_idempotency_key is null
     or length(p_idempotency_key) not between 16 and 160
     or p_expected_cutoff_hours is null
     or p_expected_cutoff_hours < 0
     or p_expected_cutoff_hours > 8760 then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;

  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, v_now
  );
  if not found then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_session.tenant_id::text || ':booking_cancelled:' || p_idempotency_key, 0
  ));

  select a.* into v_audit
  from private.customer_portal_audit a
  where a.tenant_id = v_session.tenant_id
    and a.event_type = 'booking_cancelled'
    and a.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_audit.customer_id = v_session.customer_id
       and v_audit.entity_public_id = p_booking_public_id then
      select j.id into v_refund_job_id
      from private.payment_refund_jobs j
      where j.tenant_id = v_session.tenant_id
        and j.booking_id = p_booking_public_id
      order by j.created_at, j.id
      limit 1;
      if exists (
        select 1
        from public.payments p
        join public.bookings b
          on b.tenant_id = p.tenant_id
         and b.id = p.booking_id
        where p.tenant_id = v_session.tenant_id
          and p.booking_id = p_booking_public_id
          and p.status = 'succeeded'
          and b.status = 'cancelled'
          and not exists (
            select 1
            from private.payment_refund_jobs j
            where j.tenant_id = p.tenant_id
              and j.booking_id = p.booking_id
              and j.payment_id = p.id
          )
      ) then
        raise exception 'cancelled_booking_refund_invariant_violation' using errcode = '55000';
      end if;
      return query select 'cancelled'::text, 'cancelled'::text, v_refund_job_id;
    else
      return query select 'idempotency_conflict'::text, null::text, null::uuid;
    end if;
    return;
  end if;

  select * into v_core
  from private.cancel_customer_booking(
    v_session.tenant_id,
    p_booking_public_id,
    v_session.customer_id,
    null,
    p_expected_cutoff_hours
  );

  if v_core.outcome in ('cancelled', 'already_cancelled') then
    insert into private.customer_portal_audit (
      tenant_id, customer_id, session_id, event_type,
      entity_public_id, idempotency_key, metadata
    ) values (
      v_session.tenant_id, v_session.customer_id, v_session.session_id,
      'booking_cancelled', p_booking_public_id, p_idempotency_key,
      case
        when v_core.outcome = 'already_cancelled'
          then pg_catalog.jsonb_build_object('outcome', 'already_cancelled')
        else '{}'::jsonb
      end
    );
  end if;

  return query select
    v_core.outcome::text,
    v_core.booking_status::text,
    v_core.refund_job_id::uuid;
end;
$$;

revoke all on function public.customer_portal_cancel_booking(uuid,text,uuid,integer,text)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_cancel_booking(uuid,text,uuid,integer,text)
  to service_role;

commit;
