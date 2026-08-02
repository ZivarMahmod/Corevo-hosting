-- Every real booking cancellation owns its refund enqueue in the same transaction.
-- Provider IO remains asynchronous through private.payment_refund_jobs.

create or replace function private.enqueue_booking_refund_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
begin
  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    select p.id into v_payment_id
    from public.payments p
    where p.tenant_id = new.tenant_id
      and p.booking_id = new.id
      and p.status = 'succeeded'
    for update;

    if found then
      perform private.enqueue_booking_payment_refund(
        new.tenant_id,
        new.id,
        v_payment_id
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_booking_refund_on_cancel()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_enqueue_booking_refund_on_cancel on public.bookings;
create trigger trg_enqueue_booking_refund_on_cancel
after update of status on public.bookings
for each row execute function private.enqueue_booking_refund_on_cancel();
