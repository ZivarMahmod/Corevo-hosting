begin;

do $$
declare
  v_function regprocedure := to_regprocedure(
    'public.finalize_verified_storefront_booking(uuid,uuid,text,text,text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
  );
  v_definition text;
begin
  if v_function is null then
    raise exception 'booking_pin_finalize_missing';
  end if;
  if has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE')
     or not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'booking_pin_finalize_grants_invalid';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if v_definition not like '%attempt_count >= 3%'
     or v_definition not like '%attempt_count + 1 >= 3%'
     or v_definition not like '%.boka.corevo.se%' then
    raise exception 'booking_pin_three_attempt_contract_invalid';
  end if;
end
$$;

rollback;
