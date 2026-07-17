-- 0087 — atomisk lokal spegling av en lyckad extern webshop-refund.
-- PayPal-terminalflödet återbetalar först capture:n hos leverantören och använder
-- sedan denna server-only funktion så payment/order aldrig hamnar i olika status.

create or replace function public.record_shop_order_refund(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_payment_updated integer := 0;
begin
  select o.tenant_id
    into v_tenant
    from public.shop_orders o
   where o.id = p_order_id
   for update;

  if v_tenant is null then
    return false;
  end if;

  update public.payments p
     set status = 'refunded'
   where p.order_id = p_order_id
     and p.tenant_id = v_tenant;
  get diagnostics v_payment_updated = row_count;

  if v_payment_updated <> 1 then
    raise exception 'shop_payment_missing' using errcode = 'P0002';
  end if;

  update public.shop_orders o
     set payment_status = 'refunded'
   where o.id = p_order_id;

  return true;
end;
$$;

revoke all on function public.record_shop_order_refund(uuid)
  from public, anon, authenticated;
grant execute on function public.record_shop_order_refund(uuid) to service_role;
