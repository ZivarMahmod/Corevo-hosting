-- 0113 runtime: bounded köaggregat och heartbeat-hälsa följer 0102:s kanon.
-- All testdata och heartbeat-ersättning återställs av rollback.
begin;

insert into public.tenants (id, slug, name) values
  ('a1130000-0000-0000-0000-000000000001', 'drift-0113-a', 'Drift 0113 A'),
  ('a1130000-0000-0000-0000-000000000002', 'drift-0113-b', 'Drift 0113 B');

insert into public.roles (id, tenant_id, name, level) values
  ('a1130000-0000-0000-0000-000000000011', null, 'platform-0113', 8);
insert into auth.users (id, email) values
  ('a1130000-0000-0000-0000-000000000012', 'platform-0113@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1130000-0000-0000-0000-000000000012', null,
    'platform-0113@example.test', 'a1130000-0000-0000-0000-000000000011',
    'active', 'organization'
  );

insert into public.notifications_outbox (
  id, tenant_id, event_type, event_key, category, chosen_channel, status,
  available_at, lease_token, lease_expires_at
) values
  (
    'a1130000-0000-0000-0000-000000000021',
    'a1130000-0000-0000-0000-000000000001',
    'booking.reminder', '0113-ready', 'transactional', 'email', 'queued',
    now() - interval '2 minutes', null, null
  ),
  (
    'a1130000-0000-0000-0000-000000000022',
    'a1130000-0000-0000-0000-000000000001',
    'booking.reminder', '0113-future', 'transactional', 'sms', 'queued',
    now() + interval '30 minutes', null, null
  ),
  (
    'a1130000-0000-0000-0000-000000000023',
    'a1130000-0000-0000-0000-000000000001',
    'booking.reminder', '0113-attempting', 'transactional', 'push', 'attempting',
    now() - interval '10 minutes', 'a1130000-0000-0000-0000-000000000099',
    now() - interval '1 minute'
  ),
  (
    'a1130000-0000-0000-0000-000000000024',
    'a1130000-0000-0000-0000-000000000001',
    'booking.reminder', '0113-failed', 'transactional', 'email', 'failed',
    now(), null, null
  ),
  (
    'a1130000-0000-0000-0000-000000000025',
    'a1130000-0000-0000-0000-000000000002',
    'booking.reminder', '0113-other-tenant', 'transactional', 'email', 'queued',
    now(), null, null
  );

insert into private.scheduler_heartbeats (
  scheduler_name, last_run_id, last_status, last_started_at,
  last_succeeded_at, last_failed_at, last_error_code, updated_at
) values (
  'cloudflare-reminders-primary',
  'a1130000-0000-0000-0000-000000000031',
  'started', now(), now() - interval '1 minute', now() - interval '2 minutes',
  'route_failed', now()
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
  if to_regclass('public.notifications_outbox_drift_active_global_idx') is null then
    raise exception 'drift_global_index_missing';
  end if;
  if to_regclass('public.notifications_outbox_drift_active_tenant_idx') is null then
    raise exception 'drift_tenant_index_missing';
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
  '{"sub":"a1130000-0000-0000-0000-000000000012","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'a1130000-0000-0000-0000-000000000012', true
);

do $$
declare
  v_row record;
begin
  select * into strict v_row
  from public.platform_drift_health('a1130000-0000-0000-0000-000000000001');

  if v_row.queued_count <> 2 or v_row.oldest_ready_at is null
     or v_row.oldest_ready_at > now() then
    raise exception 'future_queued_row_missing';
  end if;
  if v_row.attempting_count <> 1 or v_row.stalled_count <> 1
     or v_row.failed_24h_count <> 1 then
    raise exception 'platform_drift_health_aggregate_failed';
  end if;
  if v_row.scheduler_last_status <> 'started' or not v_row.scheduler_healthy then
    raise exception 'started_fresh_success_not_healthy';
  end if;

  update private.scheduler_heartbeats
     set last_failed_at = now(), last_error_code = 'route_failed', updated_at = now()
   where scheduler_name = 'cloudflare-reminders-primary';

  select * into strict v_row
  from public.platform_drift_health('a1130000-0000-0000-0000-000000000001');
  if v_row.scheduler_healthy then
    raise exception 'newer_failure_not_unhealthy';
  end if;
end
$$;

rollback;
