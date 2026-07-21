-- 0119 runtime: the service-only immediate claim parses and executes.
begin;

do $$
declare
  v_claim regprocedure := to_regprocedure(
    'public.claim_notification_outbox_by_id(uuid,uuid,timestamptz,integer)'
  );
  v_definition text;
  v_rows integer;
begin
  if v_claim is null then
    raise exception 'claim_notification_outbox_by_id_missing';
  end if;
  if has_function_privilege('anon', v_claim, 'EXECUTE')
     or has_function_privilege('authenticated', v_claim, 'EXECUTE')
     or not has_function_privilege('service_role', v_claim, 'EXECUTE') then
    raise exception 'claim_notification_outbox_by_id_grants_invalid';
  end if;

  select pg_get_functiondef(v_claim) into v_definition;
  if v_definition ~ 'pg_catalog\.(coalesce|least|greatest)\s*\(' then
    raise exception 'claim_notification_outbox_by_id_uses_invalid_qualification';
  end if;

  select count(*) into v_rows
    from public.claim_notification_outbox_by_id(
      gen_random_uuid(), gen_random_uuid(), now(), 120
    );
  if v_rows <> 0 then
    raise exception 'claim_notification_outbox_by_id_claimed_unknown_row';
  end if;
end
$$;

rollback;
