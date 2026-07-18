-- 0106_platform_insyn_rpcs.sql
-- goal-72 etapp 1a+1b: läs-RPC:er för superadmins Utskick- och Drift-vyer.
-- Båda är SECURITY DEFINER med hård platform_admin-grind INUTI funktionen —
-- aggregat över alla tenants (1a) respektive cron-schemat (1b) går inte att
-- uttrycka via RLS/PostgREST-selects. Ingen mutation någonstans.

-- ── 1a: utskickssummering per tenant (30 dagar) + adoption ────────────────────
create or replace function public.platform_outbox_summary()
returns table (
  tenant_id uuid,
  slug text,
  name text,
  sent_30d bigint,
  failed_30d bigint,
  skipped_30d bigint,
  sms_cost_ore_30d bigint,
  customers_total bigint,
  prefs_rows bigint,
  push_subs_active bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  return query
  select
    t.id,
    t.slug,
    t.name,
    count(o.id) filter (where o.status = 'sent' and o.created_at > now() - interval '30 days'),
    count(o.id) filter (where o.status = 'failed' and o.created_at > now() - interval '30 days'),
    count(o.id) filter (where o.status = 'skipped' and o.created_at > now() - interval '30 days'),
    coalesce(sum(o.cost_ore) filter (where o.created_at > now() - interval '30 days'), 0),
    (select count(*) from public.customers c where c.tenant_id = t.id and c.status = 'active'),
    (select count(*) from public.customer_notification_prefs p where p.tenant_id = t.id),
    (select count(*) from public.push_subscriptions s where s.tenant_id = t.id and s.revoked_at is null)
  from public.tenants t
  left join public.notifications_outbox o on o.tenant_id = t.id
  where t.status <> 'deleted'
  group by t.id, t.slug, t.name
  order by t.name;
end;
$$;

revoke all on function public.platform_outbox_summary() from public, anon;
grant execute on function public.platform_outbox_summary() to authenticated, service_role;

-- ── 1b: cron-hälsa — jobben + senaste körningen per jobb ──────────────────────
create or replace function public.platform_cron_health()
returns table (
  jobname text,
  schedule text,
  active boolean,
  last_status text,
  last_start timestamptz,
  last_duration_ms bigint,
  last_message text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  -- Preview/local branches do not necessarily install pg_cron. The platform
  -- view should be empty there, not crash after an otherwise valid migration.
  if to_regclass('cron.job') is null then
    return;
  end if;
  return query
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    d.status::text,
    d.start_time,
    (extract(epoch from (d.end_time - d.start_time)) * 1000)::bigint,
    -- Trunkerat: felmeddelanden kan vara långa; UI:t visar första raden.
    left(d.return_message, 300)
  from cron.job j
  left join lateral (
    select rd.status, rd.start_time, rd.end_time, rd.return_message
    from cron.job_run_details rd
    where rd.jobid = j.jobid
    order by rd.start_time desc
    limit 1
  ) d on true
  order by j.jobname;
end;
$$;

revoke all on function public.platform_cron_health() from public, anon;
grant execute on function public.platform_cron_health() to authenticated, service_role;
