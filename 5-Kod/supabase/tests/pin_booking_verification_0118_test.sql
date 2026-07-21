-- 0118 runtime: PIN writes stay service-only and durable data contains no clear PIN/contact.
begin;

do $$
declare
  v_start regprocedure := to_regprocedure(
    'public.start_booking_verification(text,uuid,uuid,timestamptz,uuid,text,text,text,text,uuid)'
  );
  v_finalize regprocedure := to_regprocedure(
    'public.finalize_verified_storefront_booking(uuid,uuid,text,text,text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
  );
  v_definition text;
begin
  if to_regclass('private.booking_verification_challenges') is null then
    raise exception 'booking_verification_challenges_missing';
  end if;
  if v_start is null or v_finalize is null then
    raise exception 'verified_booking_rpcs_missing';
  end if;
  if has_function_privilege('anon', v_start, 'EXECUTE')
     or has_function_privilege('authenticated', v_start, 'EXECUTE')
     or not has_function_privilege('service_role', v_start, 'EXECUTE') then
    raise exception 'start_booking_verification_grants_invalid';
  end if;

  select pg_get_functiondef(v_start) into v_definition;
  if v_definition not like '%booking_verification_pin%'
     or v_definition like '%''pin'',%'
     or v_definition like '%''contact'',%' then
    raise exception 'pin_outbox_payload_invalid';
  end if;
  if v_definition not like '%p_max_attempts => 1%'
     or v_definition not like '%pin_outbox_id%' then
    raise exception 'pin_outbox_contract_missing';
  end if;
end
$$;

rollback;
