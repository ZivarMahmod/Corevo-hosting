-- 0116 runtime proof: frontend read-sync is immediate and partner-scoped.
begin;

insert into public.partners (
  id, slug, name, status, country_code, currency, timezone, license_price_ore
) values
  ('b1160000-0000-4000-8000-000000000001', 'partner-0116-a', 'Partner 0116 A', 'active', 'SE', 'SEK', 'Europe/Stockholm', 4321),
  ('b1160000-0000-4000-8000-000000000002', 'partner-0116-b', 'Partner 0116 B', 'active', 'GR', 'EUR', 'Europe/Athens', 9876);
insert into auth.users (id, email) values
  ('b1160000-0000-4000-8000-000000000003', 'partner-0116@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values (
  'b1160000-0000-4000-8000-000000000003', null, 'partner-0116@example.test',
  (select id from public.roles where tenant_id is null and name = 'partner_admin' limit 1),
  'active', 'organization'
);
insert into public.partner_members (partner_id, user_id, role, status) values (
  'b1160000-0000-4000-8000-000000000001',
  'b1160000-0000-4000-8000-000000000003',
  'owner', 'active'
);
insert into public.tenants (id, slug, name, status, partner_id) values
  ('b1160000-0000-4000-8000-000000000011', 'tenant-0116-a', 'Tenant 0116 A', 'active', 'b1160000-0000-4000-8000-000000000001'),
  ('b1160000-0000-4000-8000-000000000012', 'tenant-0116-b', 'Tenant 0116 B', 'active', 'b1160000-0000-4000-8000-000000000002');

delete from public.partner_license_months
where partner_id in (
  'b1160000-0000-4000-8000-000000000001',
  'b1160000-0000-4000-8000-000000000002'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1160000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"platform_admin":false,"partner_admin":true,"partner_id":"b1160000-0000-4000-8000-000000000001"}}',
  true
);
select set_config('request.jwt.claim.sub', 'b1160000-0000-4000-8000-000000000003', true);
set local role authenticated;

select public.sync_partner_license_open_month('b1160000-0000-4000-8000-000000000001');

do $$
declare
  v_summary record;
begin
  if not exists (
    select 1 from public.partner_license_months
    where partner_id = 'b1160000-0000-4000-8000-000000000001'
      and tenant_id = 'b1160000-0000-4000-8000-000000000011'
      and unit_price_ore = 4321
  ) then
    raise exception 'partner_0116_open_month_sync_failed';
  end if;

  select * into strict v_summary from public.platform_partner_summaries();
  if v_summary.partner_id is distinct from 'b1160000-0000-4000-8000-000000000001'::uuid
    or v_summary.licensed_tenants <> 1
    or v_summary.license_total_ore <> 4321
  then
    raise exception 'partner_0116_summary_failed';
  end if;

  begin
    perform public.sync_partner_license_open_month('b1160000-0000-4000-8000-000000000002');
    raise exception 'partner_0116_foreign_sync_allowed';
  exception when sqlstate '42501' then null;
  end;
end
$$;

reset role;
rollback;
