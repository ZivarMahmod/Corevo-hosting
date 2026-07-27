-- Preserve the token fence before the module-state decision. Otherwise the
-- same wrong token returns different outcomes in live/paused and off/draft.
create or replace function public.get_public_shop_order(p_id uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_session_token text;
begin
  select o.tenant_id, o.session_token
    into v_tenant, v_session_token
    from public.shop_orders o
   where o.id = p_id;

  if v_tenant is null then
    return null;
  end if;
  if p_token is null
     or v_session_token is null
     or v_session_token <> p_token then
    raise exception 'forbidden_order' using errcode = '42501';
  end if;
  if not private.module_public_readable(v_tenant, 'shop') then
    return null;
  end if;

  return private.get_public_shop_order_goal87_impl(p_id, p_token);
end;
$$;

revoke all on function public.get_public_shop_order(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_shop_order(uuid, text)
  to anon, authenticated;
