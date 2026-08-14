do $test$
declare
  v_tenant uuid;
begin
  select id into v_tenant
  from public.tenants
  where slug = 'freshcut-motiontest' and status = 'active';

  if v_tenant is null then
    raise exception 'freshcut_motiontest_tenant_missing';
  end if;
  if v_tenant = (select id from public.tenants where slug = 'freshcut') then
    raise exception 'freshcut_motiontest_reuses_live_tenant';
  end if;
  if pg_catalog.cardinality(private.tenant_launch_missing(v_tenant)) <> 0 then
    raise exception 'freshcut_motiontest_not_launch_ready';
  end if;
  if (select count(*) from public.services where tenant_id = v_tenant and active) <> 7 then
    raise exception 'freshcut_motiontest_services_incomplete';
  end if;
  if exists (
    select 1 from public.users
    where tenant_id = v_tenant and email <> 'motiontest-owner@corevo.invalid'
  ) then
    raise exception 'freshcut_motiontest_contains_real_user';
  end if;
  if exists (
    select 1 from public.tenants
    where id = v_tenant
      and (stripe_account_id is not null or stripe_charges_enabled or stripe_payouts_enabled)
  ) then
    raise exception 'freshcut_motiontest_has_payment_connection';
  end if;
  if exists (select 1 from public.bookings where tenant_id = v_tenant)
     or exists (select 1 from public.customers where tenant_id = v_tenant) then
    raise exception 'freshcut_motiontest_contains_customer_activity';
  end if;

  raise notice 'freshcut_motiontest_tenant_runtime_ok';
end;
$test$;
