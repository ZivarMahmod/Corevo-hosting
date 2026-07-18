-- 0115 runtime proof: direct partner onboarding stays in safe tenant/role bounds.
begin;

insert into public.partners (
  id, slug, name, status, country_code, currency, timezone, license_price_ore
) values (
  'b1150000-0000-4000-8000-000000000001', 'partner-0115', 'Partner 0115',
  'active', 'SE', 'SEK', 'Europe/Stockholm', 5000
);
insert into auth.users (id, email) values
  ('b1150000-0000-4000-8000-000000000002', 'partner-0115@example.test');
insert into public.users (id, tenant_id, email, role_id, status, access_scope) values (
  'b1150000-0000-4000-8000-000000000002', null, 'partner-0115@example.test',
  (select id from public.roles where tenant_id is null and name = 'partner_admin' limit 1),
  'active', 'organization'
);
insert into public.partner_members (partner_id, user_id, role, status) values (
  'b1150000-0000-4000-8000-000000000001',
  'b1150000-0000-4000-8000-000000000002',
  'owner', 'active'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1150000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"platform_admin":false,"partner_admin":true,"partner_id":"b1150000-0000-4000-8000-000000000001"}}',
  true
);
select set_config('request.jwt.claim.sub', 'b1150000-0000-4000-8000-000000000002', true);
set local role authenticated;

insert into public.tenants (
  id, slug, name, plan, status, partner_id, stripe_account_id,
  stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted,
  vertical_id, created_at, updated_at
) values (
  'b1150000-0000-4000-8000-000000000099', 'partner-0115-tenant', 'Partner tenant',
  'enterprise', 'active', 'b1150000-0000-4000-8000-000000000001', 'acct_forbidden',
  true, true, true, 'salon', '2000-01-01T00:00:00Z', '2000-01-02T00:00:00Z'
);

do $$
declare
  v_tenant public.tenants%rowtype;
begin
  select * into strict v_tenant from public.tenants where slug = 'partner-0115-tenant';
  if v_tenant.id = 'b1150000-0000-4000-8000-000000000099'::uuid
    or v_tenant.plan <> 'standard'
    or v_tenant.status <> 'provisioning'
    or v_tenant.partner_id is distinct from 'b1150000-0000-4000-8000-000000000001'::uuid
    or v_tenant.stripe_account_id is not null
    or v_tenant.stripe_charges_enabled
    or v_tenant.stripe_payouts_enabled
    or v_tenant.stripe_details_submitted
    or v_tenant.vertical_id is not null
    or v_tenant.updated_at is not null
  then
    raise exception 'partner_0115_tenant_insert_guard_failed';
  end if;

  insert into public.roles (tenant_id, name, level) values
    (v_tenant.id, 'salon_admin', 6),
    (v_tenant.id, 'staff', 3);
  if (select count(*) from public.roles where tenant_id = v_tenant.id) <> 2 then
    raise exception 'partner_0115_fixed_roles_failed';
  end if;
end
$$;

reset role;
rollback;
