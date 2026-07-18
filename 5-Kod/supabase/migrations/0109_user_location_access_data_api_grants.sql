-- 0109 — complete the explicit Data API contract for owner-managed location access.
-- The final 0076 RLS policies allow SELECT/INSERT/DELETE; UPDATE is intentionally
-- absent because access rows are replaced, never edited in place.

revoke all privileges on table public.user_location_access
  from anon, authenticated;
grant select, insert, delete on table public.user_location_access
  to authenticated;
grant select, insert, update, delete on table public.user_location_access
  to service_role;
