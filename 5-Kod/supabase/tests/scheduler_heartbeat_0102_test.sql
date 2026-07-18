-- 0102 runtime: private heartbeat, closed codes, service-only RPC and stale alarm.
begin;

do $$ begin
  if has_table_privilege('anon', 'private.scheduler_heartbeats', 'select')
     or has_table_privilege('authenticated', 'private.scheduler_heartbeats', 'select') then
    raise exception 'scheduler_heartbeat_table_exposed';
  end if;
  if has_function_privilege(
      'anon', 'public.record_scheduler_heartbeat(text,uuid,text,text,timestamp with time zone)', 'execute'
    ) or has_function_privilege(
      'authenticated', 'public.get_scheduler_health(text,timestamp with time zone,integer)', 'execute'
    ) then
    raise exception 'scheduler_heartbeat_rpc_exposed';
  end if;
  if not has_function_privilege(
      'service_role', 'public.record_scheduler_heartbeat(text,uuid,text,text,timestamp with time zone)', 'execute'
    ) then
    raise exception 'scheduler_heartbeat_service_grant_missing';
  end if;
end $$;

do $$
declare
  v_health jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  perform public.record_scheduler_heartbeat(
    'cloudflare-reminders-primary',
    '10200000-0000-4000-8000-000000000001',
    'started', null, v_now - interval '2 minutes'
  );
  perform public.record_scheduler_heartbeat(
    'cloudflare-reminders-primary',
    '10200000-0000-4000-8000-000000000001',
    'succeeded', null, v_now - interval '1 minute'
  );
  select public.get_scheduler_health(
    'cloudflare-reminders-primary', v_now, 2100
  ) into v_health;
  if (v_health ->> 'healthy')::boolean is not true
     or v_health ->> 'status' <> 'succeeded' then
    raise exception 'fresh_scheduler_not_healthy_%', v_health;
  end if;

  select public.get_scheduler_health(
    'cloudflare-reminders-primary', v_now + interval '1 hour', 2100
  ) into v_health;
  if (v_health ->> 'healthy')::boolean is not false then
    raise exception 'stale_scheduler_not_alarm_%', v_health;
  end if;
end $$;

do $$ begin
  begin
    perform public.record_scheduler_heartbeat(
      'cloudflare-reminders-primary',
      '10200000-0000-4000-8000-000000000002',
      'failed', 'raw_provider_message', pg_catalog.clock_timestamp()
    );
    raise exception 'open_scheduler_error_code_accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

rollback;
