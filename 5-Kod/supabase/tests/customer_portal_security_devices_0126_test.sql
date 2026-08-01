begin;

do $$
declare
  v_function regprocedure := to_regprocedure(
    'public.customer_portal_security_snapshot(uuid,text)'
  );
  v_definition text;
begin
  if v_function is null then
    raise exception 'customer_portal_security_snapshot_missing';
  end if;
  if has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE')
     or not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'customer_portal_security_snapshot_grants_invalid';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if v_definition not like '%private.customer_portal_resolve_session%'
     or v_definition like '%ip_hash%'
     or v_definition like '%user_agent_hash%' then
    raise exception 'customer_portal_security_snapshot_contract_invalid';
  end if;
end
$$;

rollback;
