-- 0020 — enable Supabase Realtime for bookings (VÅG 4a, back-office live updates).
-- The supabase_realtime publication exists with 0 member tables; add bookings so an
-- authenticated back-office client receives INSERT/UPDATE row events. The channel is
-- fenced by the EXISTING bookings_rls policy (0010: tenant + role>=3 / own booking),
-- evaluated per-subscriber with the subscriber's JWT — no new policy, no realtime.messages.
-- Bookings are never hard-deleted (every transition is an UPDATE), so default replica
-- identity (pk) is sufficient; INSERT/UPDATE carry the full NEW row (tenant_id) → fenced.
-- DO-guarded: ALTER PUBLICATION ADD TABLE errors on a duplicate, so re-apply is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
