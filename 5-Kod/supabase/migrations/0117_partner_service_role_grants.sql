begin;

-- Data API baseline 0108 requires the trusted service role to retain complete
-- table privileges. Closed license rows remain immutable through
-- trg_partner_license_months_closed_guard even when the role has DELETE.
grant select, insert, update, delete on
  public.partner_license_price_events,
  public.partner_tenant_events,
  public.partner_license_months
to service_role;

commit;
