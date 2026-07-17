-- 0090_pg_cron_sweeps.sql
-- Plan 012 steg 1 (väg b): schemalägg de RENA DB-svepen i pg_cron — garanterad
-- schemaläggning i databasen, oberoende av GitHub Actions (som är best-effort och
-- stängs av tyst efter 60 dagars repo-inaktivitet). Påminnelse-utskicken ligger
-- KVAR på GH-cronen (de kräver appens mallrendering via /api/cron/reminders) tills
-- webhook-/edge-vägen byggs.
--
-- Körs PARALLELLT med GH Actions-cronen först (alla svep är idempotenta —
-- dubbelkörning är ofarlig). När cron.job_run_details visat gröna körningar några
-- cykler avvecklas sweep-halvan av cron-booking.yml (plan 012 steg 2).
--
-- Kräver PRO-planens pg_cron. Hela blocket är no-op om extensionen saknas
-- (lokal CI/dev-DB) — därav guard-blocket.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron saknas - hoppar over schemalaggning (lokal/dev-DB)';
    return;
  end if;

  -- cron.schedule med namn är en upsert: samma namn ⇒ schemat/kommandot ersätts,
  -- aldrig dubbla jobb. Var 15:e minut, samma kadens som GH-cronen (pending-TTL 30 min).
  perform cron.schedule(
    'corevo-expire-pending-bookings',
    '*/15 * * * *',
    $job$select public.expire_abandoned_pending_bookings(30)$job$
  );
  perform cron.schedule(
    'corevo-prune-shop-reserves',
    '*/15 * * * *',
    $job$select public.prune_expired_shop_reserves()$job$
  );
  perform cron.schedule(
    'corevo-prune-slot-holds',
    '*/15 * * * *',
    $job$select public.prune_expired_slot_holds()$job$
  );
  -- Retention är daglig (04:10 UTC — lågtrafik i svensk natt), inte var 15:e minut.
  perform cron.schedule(
    'corevo-prune-contact-messages',
    '10 4 * * *',
    $job$select public.prune_contact_messages(18)$job$
  );
end;
$$;

-- Verifiering efter applicering (SQL Editor):
--   select jobname, schedule, active from cron.job where jobname like 'corevo-%';
--   select jobname, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
