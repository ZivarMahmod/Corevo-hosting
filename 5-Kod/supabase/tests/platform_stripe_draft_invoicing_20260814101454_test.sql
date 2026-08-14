-- Platform Stripe Billing: one immutable month snapshot, isolated test/live IDs,
-- service-only webhook effects and atomic event-to-PGMQ handoff.

begin;

insert into public.tenants (id, slug, name) values
  ('b1400000-0000-4000-8000-000000000001', 'billing-20260814', 'Billing 20260814');
insert into public.roles (id, tenant_id, name, level) values
  ('b1400000-0000-4000-8000-000000000011', null, 'super_admin', 8);
insert into auth.users (id, email) values
  ('b1400000-0000-4000-8000-000000000012', 'billing-20260814@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values (
  'b1400000-0000-4000-8000-000000000012',
  null,
  'billing-20260814@example.test',
  'b1400000-0000-4000-8000-000000000011',
  'active',
  'organization'
);
insert into public.partners (
  id, slug, name, status, country_code, currency, timezone, license_price_ore
) values (
  'b1400000-0000-4000-8000-000000000021', 'billing-partner-20260814',
  'Billing Partner 20260814', 'active', 'SE', 'SEK', 'Europe/Stockholm', 0
);
insert into auth.users (id, email) values
  ('b1400000-0000-4000-8000-000000000022', 'billing-partner-20260814@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values (
  'b1400000-0000-4000-8000-000000000022', null,
  'billing-partner-20260814@example.test',
  (select id from public.roles where tenant_id is null and name = 'partner_admin' limit 1),
  'active', 'organization'
);
insert into public.partner_members (partner_id, user_id, role, status) values (
  'b1400000-0000-4000-8000-000000000021',
  'b1400000-0000-4000-8000-000000000022',
  'owner', 'active'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"b1400000-0000-4000-8000-000000000012","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'b1400000-0000-4000-8000-000000000012', true
);
update public.tenants
set partner_id = 'b1400000-0000-4000-8000-000000000021'
where id = 'b1400000-0000-4000-8000-000000000001';

do $$
declare
  v_signature text;
begin
  if pg_catalog.has_table_privilege(
    'service_role', 'private.platform_billing_periods', 'select'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'private.platform_billing_webhook_events', 'select'
  ) then
    raise exception 'platform_billing_private_table_exposed';
  end if;

  foreach v_signature in array array[
    'public.attach_platform_billing_draft(uuid,text,text,text,boolean)',
    'public.mark_platform_billing_error(uuid,text)',
    'public.record_platform_billing_event_and_enqueue(text,text,text,boolean)',
    'public.platform_billing_webhook_event(text)',
    'public.reconcile_platform_billing_invoice(text,text,text,boolean,integer)'
  ] loop
    if pg_catalog.has_function_privilege('anon', v_signature, 'execute')
       or pg_catalog.has_function_privilege('authenticated', v_signature, 'execute')
       or not pg_catalog.has_function_privilege('service_role', v_signature, 'execute') then
      raise exception 'platform_billing_service_rpc_grant_invalid_%', v_signature;
    end if;
  end loop;
end
$$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.platform_billing_periods(integer,integer)',
    'public.platform_billing_period(uuid,date)',
    'public.platform_billing_completed_counts(timestamp with time zone,timestamp with time zone)',
    'public.reserve_platform_billing_period(uuid,date,text,integer,integer,integer,text)'
  ] loop
    if pg_catalog.has_function_privilege('anon', v_signature, 'execute')
       or pg_catalog.has_function_privilege('service_role', v_signature, 'execute')
       or not pg_catalog.has_function_privilege('authenticated', v_signature, 'execute') then
      raise exception 'platform_billing_admin_rpc_grant_invalid_%', v_signature;
    end if;
  end loop;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"platform_admin":false}}',
  true
);
do $$
begin
  perform public.platform_billing_periods(2026, 8);
  raise exception 'non_platform_billing_read_succeeded';
exception when insufficient_privilege then null;
end
$$;
do $$
begin
  perform public.platform_billing_completed_counts(
    '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z'
  );
  raise exception 'non_platform_billing_count_succeeded';
exception when insufficient_privilege then null;
end
$$;
do $$
begin
  perform public.platform_billing_period(
    'b1400000-0000-4000-8000-000000000001', '2026-07-01'
  );
  raise exception 'non_platform_billing_period_read_succeeded';
exception when insufficient_privilege then null;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"b1400000-0000-4000-8000-000000000022","role":"authenticated","app_metadata":{"platform_admin":false,"partner_admin":true,"partner_id":"b1400000-0000-4000-8000-000000000021"}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'b1400000-0000-4000-8000-000000000022', true
);
do $$
begin
  if public.platform_billing_completed_counts(
    '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z'
  ) <> '{}'::jsonb then
    raise exception 'partner_billing_count_scope_failed';
  end if;
  begin
    perform public.platform_billing_periods(2026, 7);
    raise exception 'partner_billing_ledger_read_succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"b1400000-0000-4000-8000-000000000012","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'b1400000-0000-4000-8000-000000000012', true
);

do $$
declare
  v_first record;
  v_second record;
  v_locked record;
begin
  select * into strict v_first from public.reserve_platform_billing_period(
    'b1400000-0000-4000-8000-000000000001',
    '2026-07-01',
    'per_booking',
    3,
    500,
    1500,
    'sek'
  );
  select * into strict v_second from public.reserve_platform_billing_period(
    'b1400000-0000-4000-8000-000000000001',
    '2026-07-01',
    'per_booking',
    3,
    500,
    1500,
    'sek'
  );
  if v_first.id <> v_second.id then
    raise exception 'billing_period_not_idempotent';
  end if;

  begin
    perform public.reserve_platform_billing_period(
      'b1400000-0000-4000-8000-000000000001',
      '2026-07-01',
      'per_booking',
      3,
      500,
      1400,
      'sek'
    );
    raise exception 'billing_snapshot_mismatch_accepted';
  exception when unique_violation then null;
  end;

  begin
    perform public.reserve_platform_billing_period(
      'b1400000-0000-4000-8000-000000000001',
      '2100-01-01',
      'flat_monthly',
      0,
      1500,
      1500,
      'sek'
    );
    raise exception 'open_billing_period_accepted';
  exception when invalid_parameter_value then null;
  end;

  if not public.attach_platform_billing_draft(
    v_first.id, 'cus_test_old', null, null, false
  ) or not public.attach_platform_billing_draft(
    v_first.id, 'cus_test_1', 'in_test_1', 'draft', false
  ) or not public.attach_platform_billing_draft(
    v_first.id, 'cus_live_1', 'in_live_1', 'draft', true
  ) then
    raise exception 'billing_test_live_attach_failed';
  end if;
  if public.attach_platform_billing_draft(
    v_first.id, 'cus_test_other', 'in_test_1', 'draft', false
  ) then
    raise exception 'billing_customer_replaced_after_invoice_attach';
  end if;
  if not public.mark_platform_billing_error(v_first.id, 'test_draft_failed') then
    raise exception 'billing_error_marker_failed';
  end if;
  select * into strict v_locked from public.platform_billing_period(
    'b1400000-0000-4000-8000-000000000001', '2026-07-01'
  );
  if v_locked.total_cents <> 1500
     or v_locked.currency <> 'sek'
     or v_locked.last_error_code <> 'test_draft_failed' then
    raise exception 'billing_locked_period_read_failed';
  end if;
end
$$;

do $$
declare
  v_before bigint;
  v_after bigint;
  v_event jsonb;
begin
  select count(*) into v_before from pgmq.q_corevo_jobs;
  if public.record_platform_billing_event_and_enqueue(
    'evt_billing_foreign', 'invoice.updated', 'in_foreign_1', true
  ) is not false then
    raise exception 'foreign_billing_event_enqueued';
  end if;
  if exists (
    select 1 from private.platform_billing_webhook_events
    where event_id = 'evt_billing_foreign'
  ) then
    raise exception 'foreign_billing_event_persisted';
  end if;
  if public.record_platform_billing_event_and_enqueue(
    'evt_billing_1', 'invoice.updated', 'in_live_1', true
  ) is not true then
    raise exception 'billing_event_first_insert_failed';
  end if;
  if public.record_platform_billing_event_and_enqueue(
    'evt_billing_1', 'invoice.updated', 'in_live_1', true
  ) is not false then
    raise exception 'billing_event_duplicate_not_deduplicated';
  end if;
  select count(*) into v_after from pgmq.q_corevo_jobs;
  if v_after <> v_before + 1 then
    raise exception 'billing_event_queue_effect_not_exactly_once';
  end if;
  v_event := public.platform_billing_webhook_event('evt_billing_1');
  if v_event <> '{"eventType":"invoice.updated","livemode":true,"objectId":"in_live_1"}'::jsonb then
    raise exception 'billing_event_read_contract_failed';
  end if;
  if public.reconcile_platform_billing_invoice(
    'in_live_1', 'cus_live_1', 'paid', true, 1500
  ) is not true then
    raise exception 'billing_reconcile_failed';
  end if;
  if public.reconcile_platform_billing_invoice(
    'in_live_1', 'cus_live_1', 'paid', true, 1400
  ) is not false then
    raise exception 'billing_reconcile_amount_mismatch_accepted';
  end if;
  if public.reconcile_platform_billing_invoice(
    'in_test_1', null, 'deleted', false, null
  ) is not true then
    raise exception 'billing_deleted_reconcile_failed';
  end if;
end
$$;

do $$
declare
  v_period record;
begin
  select * into strict v_period from public.platform_billing_periods(2026, 7);
  if v_period.total_cents <> 1500
     or v_period.stripe_test_invoice_id <> 'in_test_1'
     or v_period.stripe_test_invoice_status <> 'deleted'
     or v_period.stripe_invoice_id <> 'in_live_1'
     or v_period.stripe_invoice_status <> 'paid' then
    raise exception 'billing_period_read_contract_failed';
  end if;
end
$$;

rollback;
