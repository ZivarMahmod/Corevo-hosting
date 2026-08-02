-- Shop payment security fence.
-- A positive order in a shop configured for online payment may not transition
-- out of its reserve state without a payment method. This is append-only: the
-- already applied Goal 92 migration remains unchanged.

create or replace function private.guard_shop_payment_method_required()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_methods jsonb;
  v_has_online_payment boolean := false;
begin
  if new.total_cents <= 0 then
    if new.status = 'awaiting_payment' then
      raise exception 'zero_total_payment_not_required' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.status not in ('pending', 'awaiting_payment')
     or new.payment_method is not null then
    return new;
  end if;

  select coalesce(tm.config->'payment_methods', '[]'::jsonb)
    into v_methods
    from public.tenant_modules tm
   where tm.tenant_id = new.tenant_id
     and tm.module_key = 'shop';

  v_has_online_payment := case
    when pg_catalog.jsonb_typeof(coalesce(v_methods, '[]'::jsonb)) = 'array'
      then pg_catalog.jsonb_array_length(coalesce(v_methods, '[]'::jsonb)) > 0
    else false
  end;

  if new.status = 'awaiting_payment' or v_has_online_payment then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_shop_payment_method_required() from public;

drop trigger if exists trg_shop_payment_method_required on public.shop_orders;
create trigger trg_shop_payment_method_required
before insert or update of status, payment_method on public.shop_orders
for each row execute function private.guard_shop_payment_method_required();
