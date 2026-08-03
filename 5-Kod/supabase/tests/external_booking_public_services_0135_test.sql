begin;

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('01350000-0000-0000-0000-000000000001', 'external-booking-0135', 'External Booking 0135', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.tenant_modules (tenant_id, module_key, state) values
  ('01350000-0000-0000-0000-000000000001', 'booking', 'off');

insert into public.services (id, tenant_id, name, duration_min, price_cents, active) values
  ('01350000-0000-0000-0000-000000000011', '01350000-0000-0000-0000-000000000001', 'Public external service', 30, 39900, true),
  ('01350000-0000-0000-0000-000000000012', '01350000-0000-0000-0000-000000000001', 'Hidden external service', 30, 49900, false);

set local role anon;

do $$
begin
  if (select count(*) from public.services where tenant_id = '01350000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'external_booking_active_service_not_public';
  end if;
end;
$$;

reset role;
rollback;
