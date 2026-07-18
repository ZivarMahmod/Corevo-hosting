-- 0117 runtime: trusted service automation keeps the explicit Data API grant
-- baseline while authenticated operators remain read-only on license history.
begin;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'partner_license_price_events',
    'partner_tenant_events',
    'partner_license_months'
  ] loop
    if not has_table_privilege(
      'service_role', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE'
    ) then
      raise exception 'service_role_partner_grants_missing_%', v_table;
    end if;
    if has_table_privilege(
      'authenticated', format('public.%I', v_table), 'INSERT,UPDATE,DELETE'
    ) then
      raise exception 'authenticated_partner_history_write_grant_%', v_table;
    end if;
  end loop;

  if to_regclass('public.trg_partner_license_months_closed_guard') is not null then
    raise exception 'trigger_misidentified_as_relation';
  end if;
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'partner_license_months'
      and t.tgname = 'trg_partner_license_months_closed_guard'
      and not t.tgisinternal
  ) then
    raise exception 'closed_partner_license_guard_missing';
  end if;
end
$$;

rollback;
