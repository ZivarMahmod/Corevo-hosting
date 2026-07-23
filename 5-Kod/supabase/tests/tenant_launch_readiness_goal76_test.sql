-- Goal 76 preview runtime acceptance.
-- One prepared statement; the inner subtransaction always rolls back its writes.

do $outer$
declare
  v_tenant uuid;
  v_result jsonb;
  v_status text;
begin
  begin
    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    perform pg_catalog.set_config(
      'request.jwt.claims',
      '{"role":"service_role"}',
      true
    );

    select t.id
      into v_tenant
      from public.tenants t
     where t.status = 'active'
       and pg_catalog.cardinality(private.tenant_launch_missing(t.id)) = 0
     order by t.created_at, t.id
     limit 1;

    if v_tenant is null then
      raise exception 'goal76_runtime_requires_one_ready_active_tenant';
    end if;

    -- Positive path and idempotency.
    update public.tenants set status = 'provisioning' where id = v_tenant;
    v_result := public.publish_tenant(v_tenant);
    if v_result ->> 'tenant_status' <> 'active'
       or (v_result ->> 'transitioned')::boolean is not true then
      raise exception 'goal76_first_publish_failed';
    end if;

    v_result := public.publish_tenant(v_tenant);
    if (v_result ->> 'transitioned')::boolean is not false then
      raise exception 'goal76_publish_not_idempotent';
    end if;

    -- One negative case: removing a common requirement must block both the RPC
    -- and a direct status bypass, while leaving the tenant provisioning.
    update public.tenants set status = 'provisioning' where id = v_tenant;
    delete from public.tenant_settings where tenant_id = v_tenant;

    if not ('tenant_settings' = any (
      private.tenant_launch_missing(v_tenant)
    )) then
      raise exception 'goal76_missing_requirement_not_reported';
    end if;

    begin
      perform public.publish_tenant(v_tenant);
      raise exception 'goal76_publish_should_have_been_blocked';
    exception
      when sqlstate '55000' then null;
    end;

    begin
      update public.tenants set status = 'active' where id = v_tenant;
      raise exception 'goal76_direct_active_should_have_been_blocked';
    exception
      when sqlstate '55000' then null;
    end;

    select t.status into v_status from public.tenants t where t.id = v_tenant;
    if v_status <> 'provisioning' then
      raise exception 'goal76_failed_publish_changed_status';
    end if;

    -- Deliberately abort the inner subtransaction so the real preview fixture is
    -- restored even when every assertion passed.
    raise exception 'goal76_runtime_rollback' using errcode = 'Z7600';
  exception
    when sqlstate 'Z7600' then
      raise notice 'goal76_runtime_ok';
  end;
end;
$outer$;
