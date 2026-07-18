-- 0112 runtime: plattformens utskickssummering räknar verkliga leveranser,
-- SMS-kostnader och aktiva unika kunder. All testdata rullas tillbaka.
begin;

insert into public.tenants (id, slug, name) values
  ('a1120000-0000-0000-0000-000000000001', 'outbox-0112', 'Outbox 0112');

insert into public.roles (id, tenant_id, name, level) values
  ('a1120000-0000-0000-0000-000000000011', null, 'super_admin', 8);
insert into auth.users (id, email) values
  ('a1120000-0000-0000-0000-000000000012', 'platform-0112@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values
  (
    'a1120000-0000-0000-0000-000000000012', null,
    'platform-0112@example.test', 'a1120000-0000-0000-0000-000000000011',
    'active', 'organization'
  );

insert into public.customers (id, tenant_id, full_name, email, status) values
  (
    'a1120000-0000-0000-0000-000000000021',
    'a1120000-0000-0000-0000-000000000001',
    'Aktiv 0112', 'active-0112@example.test', 'active'
  ),
  (
    'a1120000-0000-0000-0000-000000000022',
    'a1120000-0000-0000-0000-000000000001',
    'Inaktiv 0112', 'inactive-0112@example.test', 'anonymized'
  );

insert into public.customer_notification_prefs (customer_id, tenant_id) values
  (
    'a1120000-0000-0000-0000-000000000021',
    'a1120000-0000-0000-0000-000000000001'
  ),
  (
    'a1120000-0000-0000-0000-000000000022',
    'a1120000-0000-0000-0000-000000000001'
  );

insert into public.push_subscriptions (
  id, tenant_id, customer_id, endpoint, p256dh, auth
) values
  (
    'a1120000-0000-0000-0000-000000000031',
    'a1120000-0000-0000-0000-000000000001',
    'a1120000-0000-0000-0000-000000000021',
    'https://push.example.test/0112-active-a', 'key-a', 'auth-a'
  ),
  (
    'a1120000-0000-0000-0000-000000000032',
    'a1120000-0000-0000-0000-000000000001',
    'a1120000-0000-0000-0000-000000000021',
    'https://push.example.test/0112-active-b', 'key-b', 'auth-b'
  ),
  (
    'a1120000-0000-0000-0000-000000000033',
    'a1120000-0000-0000-0000-000000000001',
    'a1120000-0000-0000-0000-000000000022',
    'https://push.example.test/0112-inactive', 'key-c', 'auth-c'
  );

insert into public.notifications_outbox (
  id, tenant_id, event_type, event_key, category, chosen_channel,
  status, cost_ore, created_at
) values
  (
    'a1120000-0000-0000-0000-000000000041',
    'a1120000-0000-0000-0000-000000000001',
    'booking.sent', '0112-sent', 'transactional', 'sms',
    'sent', 100, now() - interval '2 days'
  ),
  (
    'a1120000-0000-0000-0000-000000000042',
    'a1120000-0000-0000-0000-000000000001',
    'booking.delivered', '0112-delivered', 'transactional', 'sms',
    'delivered', 125, now() - interval '1 day'
  ),
  (
    'a1120000-0000-0000-0000-000000000043',
    'a1120000-0000-0000-0000-000000000001',
    'booking.simulated', '0112-simulated', 'transactional', 'sms',
    'simulated', 999, now()
  ),
  (
    'a1120000-0000-0000-0000-000000000044',
    'a1120000-0000-0000-0000-000000000001',
    'booking.email', '0112-email', 'transactional', 'email',
    'sent', 777, now()
  );

do $$
begin
  if to_regprocedure('public.platform_outbox_summary()') is null then
    raise exception 'platform_outbox_summary_missing';
  end if;
  if has_function_privilege('anon', 'public.platform_outbox_summary()', 'EXECUTE') then
    raise exception 'platform_outbox_summary_exposed_to_anon';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.platform_outbox_summary()', 'EXECUTE'
  ) or not has_function_privilege(
    'service_role', 'public.platform_outbox_summary()', 'EXECUTE'
  ) then
    raise exception 'platform_outbox_summary_grant_missing';
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
  perform public.platform_outbox_summary();
  raise exception 'non_platform_outbox_summary_succeeded';
exception when insufficient_privilege then null;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1120000-0000-0000-0000-000000000012","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
select set_config(
  'request.jwt.claim.sub', 'a1120000-0000-0000-0000-000000000012', true
);

do $$
declare
  v_summary record;
begin
  select * into strict v_summary
    from public.platform_outbox_summary()
   where tenant_id = 'a1120000-0000-0000-0000-000000000001';

  if v_summary.sent_30d <> 3 then
    raise exception 'delivered_not_included';
  end if;
  if v_summary.sms_cost_ore_30d = 1224 then
    raise exception 'simulated_cost_included';
  end if;
  if v_summary.sms_cost_ore_30d = 1002 then
    raise exception 'email_cost_included';
  end if;
  if v_summary.sms_cost_ore_30d <> 225 then
    raise exception 'sms_cost_not_truthful';
  end if;
  if v_summary.push_subs_active <> 1 then
    raise exception 'push_customers_not_distinct';
  end if;
  if v_summary.customers_total <> 1 or v_summary.prefs_rows <> 1 then
    raise exception 'inactive_customer_included';
  end if;
  if v_summary.push_subs_active > v_summary.customers_total then
    raise exception 'push_adoption_exceeds_active_population';
  end if;
end
$$;

rollback;
