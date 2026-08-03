-- Services are public storefront content even when booking is handled by an
-- external provider. Booking writes and availability remain module-gated.
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon
  using (
    active = true
    and exists (
      select 1
        from public.tenants t
       where t.id = services.tenant_id
         and t.status = 'active'
    )
  );
