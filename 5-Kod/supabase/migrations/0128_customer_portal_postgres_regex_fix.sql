-- PostgreSQL repetition bounds are limited to 255. The original optional logo
-- validation used {1,2000}, so evaluating a portal snapshot raised 2201B.
--
-- 0120 is corrected for fresh installs. This migration repairs preview/staged
-- databases where 0120 was already applied and the function was later moved to
-- the private schema by 0122.
do $migration$
declare
  v_definition text;
  v_old_condition constant text :=
    'ts.branding ->> ''logo_url'' ~* ''^https://[^[:space:]]{1,2000}$''';
  v_new_condition constant text :=
    'pg_catalog.length(ts.branding ->> ''logo_url'') between 9 and 2008 and ts.branding ->> ''logo_url'' ~* ''^https://[^[:space:]]+$''';
begin
  select pg_catalog.pg_get_functiondef(
    'private.customer_portal_session_snapshot(uuid,text,text,integer)'::regprocedure
  ) into v_definition;

  if pg_catalog.strpos(v_definition, v_old_condition) > 0 then
    v_definition := pg_catalog.replace(v_definition, v_old_condition, v_new_condition);
    execute v_definition;
  end if;

  if pg_catalog.strpos(v_definition, '{1,2000}') > 0 then
    raise exception 'customer_portal_regex_fix_failed';
  end if;
end;
$migration$;
