-- 0108 — explicit Data API privileges.
--
-- Supabase no longer auto-exposes new public tables. Grants and RLS are
-- independent gates, so a fresh database built from our migrations otherwise
-- fails before the row policies are evaluated. Tighten the legacy production
-- grants and declare the exact client surface in code.

-- New public objects must opt in explicitly in the migration that creates them.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables
  from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences
  from anon, authenticated, service_role;

-- Normalize legacy projects that still carry Supabase's former broad defaults.
-- The migration is atomic: the least-privilege grants below are restored before
-- commit, while RLS remains the per-row authorization layer.
revoke all privileges on all tables in schema public
  from anon, authenticated, service_role;

-- Trusted server clients need the complete DML surface. service_role stays a
-- server-only secret and bypasses RLS; database constraints remain the backstop.
grant select, insert, update, delete on all tables in schema public
  to service_role;
grant usage, select on all sequences in schema public
  to service_role;

-- Anonymous storefront: read-only tables whose final RLS policies explicitly
-- expose public rows. Booking/intake writes continue through validated RPCs and
-- server actions, never through direct table DML.
grant select on table
  public.blog_posts,
  public.content_slots,
  public.gallery_items,
  public.location_opening_hours,
  public.locations,
  public.loyalty_plans,
  public.media_assets,
  public.modules,
  public.services,
  public.shop_product_variants,
  public.shop_products,
  public.shop_shipping_options,
  public.site_content_vertical_defaults,
  public.staff,
  public.staff_services,
  public.template_slots,
  public.templates,
  public.tenant_events,
  public.tenant_modules,
  public.verticals,
  public.working_hour_slots,
  public.working_hours
to anon;

-- Storefront identity/settings stay column-scoped so an anonymous select cannot
-- expose Stripe linkage, subscription plan or Corevo's fee configuration.
grant select (
  id, slug, name, status, city, vertical_id, created_at, updated_at,
  stripe_charges_enabled
) on table public.tenants to anon;
grant select (
  id, tenant_id, payment_mode, branding, settings, payments_enabled,
  created_at, updated_at
) on table public.tenant_settings to anon;

-- Authenticated application tables with RLS-scoped CRUD.
grant select, insert, update, delete on table
  public.blog_posts,
  public.content_slots,
  public.customer_favorites,
  public.customer_notes,
  public.customer_notification_prefs,
  public.customers,
  public.gallery_items,
  public.gift_cards,
  public.location_closures,
  public.locations,
  public.loyalty_plans,
  public.media_assets,
  public.modules,
  public.push_subscriptions,
  public.role_permissions,
  public.roles,
  public.services,
  public.shop_order_items,
  public.shop_orders,
  public.shop_product_variants,
  public.shop_products,
  public.shop_shipping_options,
  public.staff,
  public.staff_services,
  public.template_slots,
  public.templates,
  public.tenant_domains,
  public.tenant_events,
  public.tenant_modules,
  public.tenant_settings,
  public.tenants,
  public.verticals,
  public.working_hour_slots,
  public.working_hours
to authenticated;

-- Purpose-limited authenticated table access. The missing operations are
-- intentional: mutations go through audited/security-definer functions or
-- trusted server actions.
grant select, insert on table public.audit_log to authenticated;
grant select, insert on table public.bookings to authenticated;
grant select, update on table public.contact_messages to authenticated;
grant select, update, delete on table
  public.event_registrations,
  public.offert_requests
to authenticated;
grant select, insert, update on table public.payment_disputes to authenticated;
grant select on table
  public.booking_status_history,
  public.location_opening_hours,
  public.loyalty_ledger,
  public.loyalty_members,
  public.notifications_outbox,
  public.payments,
  public.site_revisions,
  public.slot_holds,
  public.tenant_member_permissions,
  public.time_off
to authenticated;

-- A signed-in user may maintain the public profile row, but only the phone
-- column is directly updateable. Role, tenant, status and email stay guarded.
grant select, insert, delete on table public.users to authenticated;
grant update (phone) on table public.users to authenticated;

-- Auth hooks read these two tables through their dedicated database role.
grant select on table public.users, public.roles to supabase_auth_admin;
