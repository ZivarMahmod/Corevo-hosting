begin;

do $$
declare
  v_function regprocedure := to_regprocedure(
    'private.customer_portal_session_snapshot(uuid,text,text,integer)'
  );
  v_definition text;
begin
  if v_function is null then
    raise exception 'customer_portal_session_snapshot_missing';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if v_definition like '%{1,2000}%'
     or v_definition not like '%length(ts.branding ->> ''logo_url'') between 9 and 2008%' then
    raise exception 'customer_portal_postgres_regex_fix_missing';
  end if;
end
$$;

rollback;
