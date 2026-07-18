-- 0097 runtime: service-only delivery callback, unique refs and monotonic status.
-- Run on a fresh migrated database. Everything rolls back.
begin;

insert into public.tenants (id, slug, name) values
  ('97000000-0000-0000-0000-000000000001', 'sms-0097-a', 'SMS A'),
  ('97000000-0000-0000-0000-000000000002', 'sms-0097-b', 'SMS B');

insert into public.notifications_outbox (
  id, tenant_id, event_type, event_key, category, chosen_channel,
  status, provider_ref, sent_at
) values
  (
    '97000000-0000-0000-0000-000000000011',
    '97000000-0000-0000-0000-000000000001',
    'sms_test', 'sms:0097:a', 'transactional', 'sms',
    'sent', 's11111111111111111111111111111111', now()
  ),
  (
    '97000000-0000-0000-0000-000000000012',
    '97000000-0000-0000-0000-000000000002',
    'sms_test', 'sms:0097:b', 'transactional', 'sms',
    'sent', 's22222222222222222222222222222222', now()
  );

-- Provider-ref är globalt unik för SMS-ledgern, även över tenants.
do $$ begin
  insert into public.notifications_outbox (
    tenant_id, event_type, event_key, category, chosen_channel, status, provider_ref
  ) values (
    '97000000-0000-0000-0000-000000000002',
    'sms_duplicate', 'sms:0097:duplicate', 'transactional', 'sms',
    'sent', 's11111111111111111111111111111111'
  );
  raise exception 'duplicate_sms_provider_ref_succeeded';
exception when unique_violation then null; end $$;

-- Klientroller kan inte gissa provider-id och mutera ledgern.
do $$ begin
  if has_function_privilege(
      'anon', 'public.record_sms_delivery(text,text,timestamp with time zone,uuid)', 'execute'
    ) or has_function_privilege(
      'authenticated', 'public.record_sms_delivery(text,text,timestamp with time zone,uuid)', 'execute'
    ) then
    raise exception 'sms_delivery_rpc_exposed_to_client';
  end if;
  if not has_function_privilege(
      'service_role', 'public.record_sms_delivery(text,text,timestamp with time zone,uuid)', 'execute'
    ) then
    raise exception 'sms_delivery_rpc_missing_service_grant';
  end if;
end $$;

do $$
declare
  v_result text;
  v_row public.notifications_outbox%rowtype;
begin
  select public.record_sms_delivery(
    's11111111111111111111111111111111',
    'delivered', '2026-07-18T10:00:00Z'::timestamptz
  ) into v_result;
  if v_result <> 'updated' then raise exception 'delivery_not_updated_%', v_result; end if;

  select * into v_row from public.notifications_outbox
   where id = '97000000-0000-0000-0000-000000000011';
  if v_row.status <> 'delivered'
     or v_row.delivered_at <> '2026-07-18T10:00:00Z'::timestamptz then
    raise exception 'delivered_state_wrong';
  end if;

  select public.record_sms_delivery(
    's11111111111111111111111111111111',
    'delivered', '2026-07-18T10:00:00Z'::timestamptz
  ) into v_result;
  if v_result <> 'idempotent' then raise exception 'delivery_replay_not_idempotent'; end if;

  select public.record_sms_delivery(
    's11111111111111111111111111111111', 'failed', null
  ) into v_result;
  if v_result <> 'terminal' then raise exception 'terminal_delivery_regressed'; end if;
end $$;

do $$
declare v_result text;
begin
  select public.record_sms_delivery(
    's99999999999999999999999999999999', 'sent', null
  ) into v_result;
  if v_result <> 'unknown_provider' then raise exception 'unknown_provider_not_denied'; end if;
end $$;

rollback;
