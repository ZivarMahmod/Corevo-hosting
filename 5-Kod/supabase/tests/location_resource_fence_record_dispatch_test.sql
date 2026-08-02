begin;

do $$
declare
  v_sql text := pg_catalog.lower(pg_catalog.pg_get_functiondef(
    'private.enforce_location_resource_fence()'::regprocedure
  ));
begin
  if v_sql not like '%if tg_table_name = ''location_opening_hours'' then%if new.confirmed_by is not null%' then
    raise exception 'location_resource_fence_record_dispatch_missing';
  end if;
end;
$$;

rollback;
