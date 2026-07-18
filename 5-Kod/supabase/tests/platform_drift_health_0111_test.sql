-- 0111 runtime: driftläsaren är PII-fri, tenantfiltrerbar och DB-grindad.
-- Testdata och heartbeat-ersättning återställs av rollback.
begin;

insert into public.tenants (id, slug, name) values
  ('a1110000-0000-0000-0000-000000000001', 'drift-0111-a', 'Drift 0111 A'),
  ('a1110000-0000-0000-0000-000000000002', 'drift-0111-b', 'Drift 0111 B');

insert into public.roles (id, tenant_id, name, level) values
  ('a1110000-0000-0000-0000-000000000011', null, 'platform-0111', 8);
insert into auth.users (id, email) values
  ('a1110000-0000-0000-0000-000000000012', 'platform-0111@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1110000-0000-0000-0000-000000000012', null,
    'platform-0111@example.test', 'a1110000-0000-0000-0000-000000000011',
    'active', 'organization'
  );

insert into public.notifications_outbox (
  id, tenant_id, event_type, event_key, category, chosen_channel, status,
  available_at, lease_token, lease_expires_at, updated_at
) values
  (
    'a1110000-0000-0000-0000-000000000021',
    'a1110000-0000-0000-0000-000000000001',
    'booking.reminder', '0111-a-queued', 'transactional', 'email', 'queued',
    now() - interval '2 minutes', null, null, now() - interval '2 minutes'
  ),
  (
    'a1110000-0000-0000-0000-000000000022',
    'a1110000-0000-0000-0000-000000000001',
    'booking.reminder', '0111-a-attempting', 'transactional', 'sms', 'attempting',
    now() - interval '10 minutes', 'a1110000-0000-0000-0000-000000000099',
    now() - interval '1 minute', now() - interval '2 minutes'
  ),
  (
    'a1110000-0000-0000-0000-000000000023',
    'a1110000-0000-0000-0000-000000000001',
    'booking.reminder', '0111-a-started', 'transactional', 'sms', 'delivery_started',
    now() - interval '20 minutes', 'a1110000-0000-0000-0000-000000000098',
    null, now() - interval '20 minutes'
  ),
  (
    'a1110000-0000-0000-0000-000000000024',
    'a1110000-0000-0000-0000-000000000001',
    'booking.reminder', '0111-a-failed', 'transactional', 'email', 'failed',
    now() - interval '30 minutes', null, null, now() - interval '30 minutes'
  ),
  (
    'a1110000-0000-0000-0000-000000000025',
    'a1110000-0000-0000-0000-000000000002',
    'booking.reminder', '0111-b-queued', 'transactional', 'push', 'queued',
    now() + interval '5 minutes', null, null, now()
  );

insert into private.scheduler_heartbeats (
  scheduler_name, last_run_id, last_status, last_started_at,
  last_succeeded_at, last_failed_at, last_error_code, updated_at
) values (
  'cloudflare-reminders-primary',
  'a1110000-0000-0000-0000-000000000031',
  'succeeded', now() - interval '2 minutes', now() - interval '1 minute',
  null, null, now() - interval '1 minute'
)
on conflict (scheduler_name) do update set
  last_run_id = excluded.last_run_id,
  last_status = excluded.last_status,
  last_started_at = excluded.last_started_at,
  last_succeeded_at = excluded.last_succeeded_at,
  last_failed_at = excluded.last_failed_at,
  last_error_code = excluded.last_error_code,
  updated_at = excluded.updated_at;

do $$
begin
  if to_regprocedure('public.platform_drift_health(uuid)') is null then
    raise exception 'platform_drift_health_missing';
  end if;
  if has_function_privilege(
    'anon', 'public.platform_drift_health(uuid)', 'EXECUTE'
  ) then
    raise exception 'platform_drift_health_exposed_to_anon';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.platform_drift_health(uuid)', 'EXECUTE'
  ) or not has_function_privilege(
    'service_role', 'public.platform_drift_health(uuid)', 'EXECUTE'
  ) then
    raise exception 'platform_drift_health_grant_missing';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"platform_admin":false}}',
  true
);
do $$
begin
  perform public.platform_drift_health();
  raise exception 'non_platform_drift_health_succeeded';
exception when insufficient_privilege then null;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1110000-0000-0000-0000-000000000012","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'a1110000-0000-0000-0000-000000000012', true
);

do $$
declare
  v_row record;
begin
  select * into strict v_row
  from public.platform_drift_health('a1110000-0000-0000-0000-000000000001');

  if v_row.queued_count <> 1
     or v_row.attempting_count <> 1
     or v_row.delivery_started_count <> 1
     or v_row.stalled_count <> 1
     or v_row.failed_24h_count <> 1
     or v_row.scheduler_last_status <> 'succeeded'
     or not v_row.scheduler_healthy then
    raise exception 'platform_drift_health_aggregate_failed';
  end if;
end
$$;

rollback;
