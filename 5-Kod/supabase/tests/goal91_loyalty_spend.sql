-- Goal 91 loyalty runtime contract. Every fixture is rolled back.
begin;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('91100000-0000-0000-0000-000000000001', 'goal91-loyalty-a', 'Goal 91 Loyalty A', 'active'),
  ('91100000-0000-0000-0000-000000000002', 'goal91-loyalty-b', 'Goal 91 Loyalty B', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.tenant_modules (tenant_id, module_key, state, config) values
  ('91100000-0000-0000-0000-000000000001', 'lojalitet', 'off', '{}'),
  ('91100000-0000-0000-0000-000000000002', 'lojalitet', 'off', '{}');
update public.tenant_modules
   set state = 'draft'
 where tenant_id in (
   '91100000-0000-0000-0000-000000000001',
   '91100000-0000-0000-0000-000000000002'
 )
   and module_key = 'lojalitet';
update public.tenant_modules
   set state = 'live'
 where tenant_id in (
   '91100000-0000-0000-0000-000000000001',
   '91100000-0000-0000-0000-000000000002'
 )
   and module_key = 'lojalitet';

insert into public.customers (id, tenant_id, display_name) values
  ('91100000-0000-0000-0000-000000000011', '91100000-0000-0000-0000-000000000001', 'Ada'),
  ('91100000-0000-0000-0000-000000000012', '91100000-0000-0000-0000-000000000002', 'Bo');

insert into public.loyalty_ledger (
  id, tenant_id, customer_id, points_delta, reason, note
) values (
  '91100000-0000-0000-0000-000000000021',
  '91100000-0000-0000-0000-000000000001',
  '91100000-0000-0000-0000-000000000011',
  100,
  'adjustment',
  'goal91 opening'
);

do $$
begin
  if pg_catalog.to_regprocedure(
       'public.spend_loyalty_points(uuid,uuid,integer,uuid,text,text,text)'
     ) is null
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.loyalty_ledger', 'insert'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.reverse_loyalty_spend(uuid,uuid,uuid,text)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.spend_loyalty_points(uuid,uuid,integer,uuid,text,text,text)',
       'execute'
     ) then
    raise exception 'goal91_loyalty_schema_or_grants_invalid';
  end if;
end
$$;

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_spend jsonb;
  v_retry jsonb;
  v_reverse jsonb;
  v_entry uuid;
begin
  v_spend := public.spend_loyalty_points(
    '91100000-0000-0000-0000-000000000001',
    '91100000-0000-0000-0000-000000000011',
    60,
    '91100000-0000-4000-8000-000000000101',
    'admin',
    null,
    'Förmån'
  );
  v_retry := public.spend_loyalty_points(
    '91100000-0000-0000-0000-000000000001',
    '91100000-0000-0000-0000-000000000011',
    60,
    '91100000-0000-4000-8000-000000000101',
    'admin',
    null,
    'Förmån'
  );
  if v_spend is distinct from v_retry
     or (v_spend ->> 'balance_points')::integer <> 40 then
    raise exception 'loyalty_spend_retry_or_balance_invalid';
  end if;
  v_entry := (v_spend ->> 'entry_id')::uuid;

  if (
    select pg_catalog.count(*)
      from public.loyalty_ledger l
     where l.idempotency_key = '91100000-0000-4000-8000-000000000101'
  ) <> 1 then
    raise exception 'loyalty_spend_not_exactly_once';
  end if;

  begin
    perform public.spend_loyalty_points(
      '91100000-0000-0000-0000-000000000001',
      '91100000-0000-0000-0000-000000000011',
      61,
      '91100000-0000-4000-8000-000000000101',
      'admin',
      null,
      'Förmån'
    );
    raise exception 'loyalty_changed_payload_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'loyalty_idempotency_conflict' then raise; end if;
  end;

  begin
    perform public.spend_loyalty_points(
      '91100000-0000-0000-0000-000000000001',
      '91100000-0000-0000-0000-000000000011',
      41,
      '91100000-0000-4000-8000-000000000102',
      'admin',
      null,
      null
    );
    raise exception 'loyalty_overspend_succeeded';
  exception when raise_exception then
    if sqlerrm <> 'loyalty_insufficient_points' then raise; end if;
  end;

  begin
    perform public.spend_loyalty_points(
      '91100000-0000-0000-0000-000000000001',
      '91100000-0000-0000-0000-000000000012',
      1,
      '91100000-0000-4000-8000-000000000103',
      'admin',
      null,
      null
    );
    raise exception 'loyalty_cross_tenant_customer_succeeded';
  exception when no_data_found then
    if sqlerrm <> 'loyalty_customer_not_found' then raise; end if;
  end;

  v_reverse := public.reverse_loyalty_spend(
    '91100000-0000-0000-0000-000000000001',
    v_entry,
    '91100000-0000-4000-8000-000000000104',
    'Förmånen återtagen'
  );
  if (v_reverse ->> 'balance_points')::integer <> 100 then
    raise exception 'loyalty_reverse_wrong_balance';
  end if;
  if public.reverse_loyalty_spend(
    '91100000-0000-0000-0000-000000000001',
    v_entry,
    '91100000-0000-4000-8000-000000000104',
    'Förmånen återtagen'
  ) is distinct from v_reverse then
    raise exception 'loyalty_reverse_retry_changed_result';
  end if;

  begin
    perform public.reverse_loyalty_spend(
      '91100000-0000-0000-0000-000000000001',
      v_entry,
      '91100000-0000-4000-8000-000000000105',
      'Andra återställningen'
    );
    raise exception 'loyalty_double_reverse_succeeded';
  exception when unique_violation then
    if sqlerrm <> 'loyalty_reversal_exists' then raise; end if;
  end;
end
$$;

reset role;
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);
update public.tenant_modules
   set state = 'paused'
 where tenant_id = '91100000-0000-0000-0000-000000000001'
   and module_key = 'lojalitet';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    perform public.spend_loyalty_points(
      '91100000-0000-0000-0000-000000000001',
      '91100000-0000-0000-0000-000000000011',
      1,
      '91100000-0000-4000-8000-000000000106',
      'admin',
      null,
      null
    );
    raise exception 'paused_loyalty_spend_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'value_module_not_live' then raise; end if;
  end;
end
$$;
reset role;

select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);
update public.tenant_modules
   set state = 'live'
 where tenant_id = '91100000-0000-0000-0000-000000000001'
   and module_key = 'lojalitet';
insert into public.loyalty_plans (
  id, tenant_id, name, price_cents, interval
) values (
  '91100000-0000-0000-0000-000000000201',
  '91100000-0000-0000-0000-000000000001',
  'Betald nivå',
  19500,
  'month'
);

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  v_join jsonb;
begin
  v_join := public.join_loyalty_club(
    'goal91-loyalty-a',
    'paid-member@example.test',
    'Paid Member',
    '91100000-0000-0000-0000-000000000201'
  );
  if v_join ->> 'status' <> 'pending_payment' then
    raise exception 'paid_loyalty_plan_became_active';
  end if;
end
$$;
reset role;

do $$
declare
  v_negative bigint;
  v_gap bigint;
  v_duplicate bigint;
begin
  select
    r.negative_customer_count,
    r.command_metadata_gap_count,
    r.duplicate_reversal_count
  into v_negative, v_gap, v_duplicate
  from public.loyalty_reconciliation(
    '91100000-0000-0000-0000-000000000001'
  ) r;
  if v_negative <> 0 or v_gap <> 0 or v_duplicate <> 0 then
    raise exception 'loyalty_reconciliation_failed_%_%_%', v_negative, v_gap, v_duplicate;
  end if;

  if (
    select pg_catalog.count(*)
      from public.admin_loyalty_members(
        '91100000-0000-0000-0000-000000000001'
      )
     where customer_id = '91100000-0000-0000-0000-000000000011'
       and points_balance = 100
  ) <> 1 then
    raise exception 'admin_loyalty_aggregate_wrong';
  end if;

  begin
    update public.loyalty_ledger
       set points_delta = points_delta + 1
     where id = '91100000-0000-0000-0000-000000000021';
    raise exception 'loyalty_ledger_update_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'append_only' then raise; end if;
  end;
end
$$;

select 'goal91_loyalty_spend_ok' as result;
rollback;
