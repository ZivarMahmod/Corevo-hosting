-- ============================================================================
-- 0008 — G10 hardening: rate-limiting store + reminder bookkeeping.
--
--   · bookings.reminded_at        — idempotency stamp for the reminder cron
--                                   (lib/notifications/reminders.ts) so a booking
--                                   is reminded at most once.
--   · private.rate_limit_hits     — fixed-window counter store. Lives in `private`
--                                   (NOT exposed by PostgREST). Shared across all
--                                   Workers isolates → the ONLY Workers-safe limiter
--                                   (per-isolate memory can't rate-limit anything).
--   · public.check_rate_limit()   — SECURITY DEFINER (writes the private store from
--                                   the anon/authenticated roles). Fail-OPEN on bad
--                                   args (never lock users out on a config slip).
--
-- DEFINER hardening (same rule as 0004/0005): pinned `search_path = ''`, every
-- object fully qualified. EXECUTE granted only to anon + authenticated.
-- Re-runnable: add-column-if-not-exists, create-table-if-not-exists, or-replace fn.
-- ============================================================================

-- ── 1. reminder idempotency stamp ──
alter table public.bookings add column if not exists reminded_at timestamptz;

-- ── 2. rate-limit store (private schema; granted to the limiter fn only) ──
create table if not exists private.rate_limit_hits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (bucket, window_start)
);

-- ── 3. fixed-window limiter ──
-- Returns TRUE while the bucket is under p_max in the current p_window_secs window.
-- One bucket key = one identity+action (e.g. 'login:<ip>'). Targeted GC keeps each
-- active key to a single live row.
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_secs int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits   int;
begin
  if p_key is null or p_max <= 0 or p_window_secs <= 0 then
    return true;  -- misconfigured → fail open
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_secs) * p_window_secs
  );

  insert into private.rate_limit_hits as r (bucket, window_start, hits)
    values (p_key, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- bound the table: drop this key's stale windows (cheap, PK-indexed).
  delete from private.rate_limit_hits
   where bucket = p_key and window_start < v_window;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
