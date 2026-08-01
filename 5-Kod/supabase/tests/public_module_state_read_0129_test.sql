begin;

do $$
declare
  v_function regprocedure := to_regprocedure(
    'public.get_public_tenant_module_states(uuid)'
  );
  v_definition text;
begin
  if v_function is null then
    raise exception 'public_module_state_read_missing';
  end if;
  if not has_function_privilege('anon', v_function, 'EXECUTE')
     or not has_function_privilege('authenticated', v_function, 'EXECUTE')
     or not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'public_module_state_read_grants_invalid';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if v_definition not like '%t.status = ''active''%'
     or v_definition not like '%select tm.module_key, tm.state%' then
    raise exception 'public_module_state_read_contract_invalid';
  end if;
end
$$;

rollback;
