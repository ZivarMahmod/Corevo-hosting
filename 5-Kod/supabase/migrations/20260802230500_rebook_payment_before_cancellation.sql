-- Move a settled payment before cancelling the old booking. The cancellation
-- trigger must not enqueue a refund for a payment carried to the replacement.
create or replace function public.finalize_customer_booking_rebook(
  p_tenant uuid,
  p_old_booking uuid,
  p_new_booking uuid,
  p_customer_profile uuid,
  p_customer uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.bookings%rowtype;
  v_new public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_existing private.customer_booking_rebooks%rowtype;
  v_now timestamptz := statement_timestamp();
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_old_booking is null or p_new_booking is null
     or p_old_booking = p_new_booking or p_customer_profile is null then
    raise exception 'rebook_scope_invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text || ':booking-payment:' || p_old_booking::text, 0
  ));
  perform 1 from public.bookings b
  where b.tenant_id = p_tenant and b.id in (p_old_booking, p_new_booking)
  order by b.id
  for update;

  select b.* into v_old from public.bookings b
  where b.tenant_id = p_tenant and b.id = p_old_booking;
  select b.* into v_new from public.bookings b
  where b.tenant_id = p_tenant and b.id = p_new_booking;
  if v_old.id is null or v_new.id is null
     or v_new.customer_profile_id is distinct from p_customer_profile
     or not (
       v_old.customer_profile_id = p_customer_profile
       or (p_customer is not null and v_old.customer_id = p_customer)
     )
     or (p_customer is not null and (
       v_old.customer_id is distinct from p_customer
       or v_new.customer_id is distinct from p_customer
     ))
     or v_old.service_id is distinct from v_new.service_id then
    raise exception 'rebook_scope_invalid' using errcode = '42501';
  end if;

  select r.* into v_existing
  from private.customer_booking_rebooks r
  where r.tenant_id = p_tenant and r.old_booking_id = p_old_booking;
  if found then
    if v_existing.new_booking_id is distinct from p_new_booking
       or v_existing.customer_profile_id is distinct from p_customer_profile
       or v_existing.customer_id is distinct from p_customer then
      raise exception 'rebook_already_finalized' using errcode = '55000';
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_finalized', 'payment_carried', v_existing.payment_id is not null
    );
  end if;
  if v_old.status not in ('pending', 'confirmed')
     or v_new.status not in ('pending', 'confirmed') then
    raise exception 'rebook_booking_state_invalid' using errcode = '55000';
  end if;

  select p.* into v_payment from public.payments p
  where p.tenant_id = p_tenant and p.booking_id = p_old_booking
  for update;
  if found then
    if v_payment.status <> 'succeeded' then
      raise exception 'rebook_payment_not_settled' using errcode = '55000';
    end if;
    if v_payment.stripe_payment_intent_id is null
       or v_payment.stripe_connected_account_id is null then
      raise exception 'rebook_payment_identity_missing' using errcode = '55000';
    end if;
    if exists (
      select 1 from private.payment_refund_jobs j
      where j.tenant_id = p_tenant
        and (j.payment_id = v_payment.id or j.booking_id = p_old_booking)
    ) then
      raise exception 'rebook_refund_state_conflict' using errcode = '55000';
    end if;
  elsif exists (
    select 1 from private.payment_refund_jobs j
    where j.tenant_id = p_tenant and j.booking_id = p_old_booking
  ) then
    raise exception 'rebook_refund_state_conflict' using errcode = '55000';
  end if;

  if v_payment.id is not null then
    update public.payments p
    set booking_id = p_new_booking
    where p.id = v_payment.id and p.tenant_id = p_tenant
      and p.booking_id = p_old_booking and p.status = 'succeeded';
    if not found then raise exception 'rebook_payment_move_failed' using errcode = '55000'; end if;
    update public.bookings b set status = 'confirmed'
    where b.tenant_id = p_tenant and b.id = p_new_booking
      and b.status in ('pending', 'confirmed');
  end if;

  update public.bookings b
  set status = 'cancelled', cancelled_at = v_now, cancelled_by = 'customer'
  where b.tenant_id = p_tenant and b.id = p_old_booking
    and b.status in ('pending', 'confirmed');
  if not found then raise exception 'rebook_booking_state_invalid' using errcode = '55000'; end if;

  insert into private.customer_booking_rebooks (
    tenant_id, old_booking_id, new_booking_id, customer_profile_id, customer_id,
    payment_id, provider_payment_intent_id, provider_connected_account_id
  ) values (
    p_tenant, p_old_booking, p_new_booking, p_customer_profile, p_customer,
    v_payment.id, v_payment.stripe_payment_intent_id,
    v_payment.stripe_connected_account_id
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'finalized', 'payment_carried', v_payment.id is not null
  );
end;
$$;

revoke all on function public.finalize_customer_booking_rebook(uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_customer_booking_rebook(uuid,uuid,uuid,uuid,uuid)
  to service_role;
