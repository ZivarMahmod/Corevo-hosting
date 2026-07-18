-- 0110 runtime: platformens detaljläsare är tenantfiltrerbar, validerad och
-- databasgrindad. All testdata rullas tillbaka.
begin;

insert into public.tenants (id, slug, name) values
  ('a1100000-0000-0000-0000-000000000001', 'outbox-0110-a', 'Outbox 0110 A'),
  ('a1100000-0000-0000-0000-000000000002', 'outbox-0110-b', 'Outbox 0110 B');

insert into public.roles (id, tenant_id, name, level) values
  ('a1100000-0000-0000-0000-000000000011', null, 'super_admin', 8);
insert into auth.users (id, email) values
  ('a1100000-0000-0000-0000-000000000012', 'platform-0110@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1100000-0000-0000-0000-000000000012', null,
    'platform-0110@example.test', 'a1100000-0000-0000-0000-000000000011',
    'active', 'organization'
  );

insert into public.notifications_outbox (
  id, tenant_id, event_type, event_key, category, chosen_channel,
  status, cost_ore, skip_reason, provider_ref, created_at
) values
  (
    'a1100000-0000-0000-0000-000000000021',
    'a1100000-0000-0000-0000-000000000001',
    'booking.created', '0110-a-email', 'transactional', 'email',
    'sent', 0, null, 'provider.email.0110', now() - interval '2 minutes'
  ),
  (
    'a1100000-0000-0000-0000-000000000022',
    'a1100000-0000-0000-0000-000000000001',
    'booking.reminder', '0110-a-sms', 'transactional', 'sms',
    'failed', 125, null, 'provider.sms.0110', now() - interval '1 minute'
  ),
  (
    'a1100000-0000-0000-0000-000000000023',
    'a1100000-0000-0000-0000-000000000002',
    'campaign.created', '0110-b-push', 'marketing', 'push',
    'skipped', 0, 'no_consent', null, now()
  );

do $$
begin
  if to_regprocedure(
    'public.platform_outbox_rows(uuid,text,text,text,integer)'
  ) is null then
    raise exception 'platform_outbox_rows_missing';
  end if;
  if has_function_privilege(
    'anon', 'public.platform_outbox_rows(uuid,text,text,text,integer)', 'EXECUTE'
  ) then
    raise exception 'platform_outbox_rows_exposed_to_anon';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.platform_outbox_rows(uuid,text,text,text,integer)', 'EXECUTE'
  ) or not has_function_privilege(
    'service_role', 'public.platform_outbox_rows(uuid,text,text,text,integer)', 'EXECUTE'
  ) then
    raise exception 'platform_outbox_rows_grant_missing';
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
  perform public.platform_outbox_rows();
  raise exception 'non_platform_outbox_rows_succeeded';
exception when insufficient_privilege then null;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000012","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000012', true
);

do $$
begin
  perform public.platform_outbox_rows(p_limit => 0);
  raise exception 'platform_outbox_rows_limit_validation_missing';
exception when invalid_parameter_value then null;
end
$$;

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
    from public.platform_outbox_rows(
      p_tenant => 'a1100000-0000-0000-0000-000000000001'
    );
  if v_count <> 2 then
    raise exception 'platform_outbox_rows_tenant_filter_failed';
  end if;

  select count(*) into v_count
    from public.platform_outbox_rows(p_channel => 'sms');
  if v_count <> 1 then
    raise exception 'platform_outbox_rows_channel_filter_failed';
  end if;

  select count(*) into v_count
    from public.platform_outbox_rows(p_status => 'skipped', p_category => 'marketing');
  if v_count <> 1 then
    raise exception 'platform_outbox_rows_status_category_filter_failed';
  end if;
end
$$;

rollback;
