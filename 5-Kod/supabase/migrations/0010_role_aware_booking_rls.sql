-- 0010 — role-aware RLS for bookings + payments (FAS 3 security)
--
-- Before: bookings_rls / payments_rls were `for all to authenticated using
-- (tenant_id = private.tenant_id() OR is_platform_admin())` — tenant-wide but NOT
-- role-aware. A customer (level 2) carries the same tenant_id claim as staff/admin,
-- so via the browser anon key + their own JWT a kund could read/UPDATE/DELETE EVERY
-- booking/payment in their tenant (other customers' rows) directly through
-- PostgREST, bypassing the app-layer `.eq('customer_profile_id', uid)` filter. RLS
-- was not the fence it was claimed to be.
--
-- Role is NOT in the JWT (claims carry only tenant_id + platform_admin), so we read
-- the level from the DB via a SECURITY DEFINER helper. The fence:
--   · platform_admin            → all tenants (unchanged).
--   · level >= 3 (staff/admin)  → tenant-wide within their own tenant (unchanged
--                                 behaviour; admin/personal portals need this).
--   · level < 3  (kund)         → only their OWN rows
--                                 (bookings.customer_profile_id = auth.uid();
--                                  payments via the owning booking).
-- The app-layer filters become defence-in-depth; the DB is now the fence, per the
-- project's RLS-first isolation rule. Payment WRITES are unaffected — they all run
-- through the service-role client (RLS-bypass), never the authenticated client.

-- Current user's role level (0 if none). SECURITY DEFINER so the policy can read
-- users/roles without recursing through their RLS. STABLE → wrapped in (select ...)
-- at the call site so it is evaluated once per query (initplan), like tenant_id().
create or replace function private.role_level()
returns int
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(r.level, 0)
  from public.users u
  left join public.roles r on r.id = u.role_id
  where u.id = (select auth.uid())
$$;

revoke all on function private.role_level() from public;
grant execute on function private.role_level() to authenticated;

-- bookings: staff/admin tenant-wide, kund own rows.
drop policy if exists bookings_rls on public.bookings;
create policy bookings_rls on public.bookings for all to authenticated
using (
  (select private.is_platform_admin())
  or (
    tenant_id = (select private.tenant_id())
    and ((select private.role_level()) >= 3 or customer_profile_id = (select auth.uid()))
  )
)
with check (
  (select private.is_platform_admin())
  or (
    tenant_id = (select private.tenant_id())
    and ((select private.role_level()) >= 3 or customer_profile_id = (select auth.uid()))
  )
);

-- payments: no customer_profile_id column → a kund's own scope joins through the
-- owning booking. Writes are service-role (this policy never gates them).
drop policy if exists payments_rls on public.payments;
create policy payments_rls on public.payments for all to authenticated
using (
  (select private.is_platform_admin())
  or (
    tenant_id = (select private.tenant_id())
    and (
      (select private.role_level()) >= 3
      or exists (
        select 1 from public.bookings b
        where b.id = payments.booking_id and b.customer_profile_id = (select auth.uid())
      )
    )
  )
)
with check (
  (select private.is_platform_admin())
  or (
    tenant_id = (select private.tenant_id())
    and (
      (select private.role_level()) >= 3
      or exists (
        select 1 from public.bookings b
        where b.id = payments.booking_id and b.customer_profile_id = (select auth.uid())
      )
    )
  )
);
