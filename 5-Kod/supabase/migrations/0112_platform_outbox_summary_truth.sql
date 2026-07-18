-- goal-72 etapp 1a: korrigera den redan driftsatta utskickssummeringen utan att
-- skriva om 0106. Alla delaggregat behåller tenant_id som framtida partner-söm;
-- dagens auktoritativa grind är fortsatt private.is_platform_admin().

-- Detaljläsaren i 0110 sorterar globalt eller inom en tenant. Båda vägarna
-- behöver kunna läsa de senaste ledger-raderna utan sortering av hela tabellen.
create index if not exists notifications_outbox_recent_idx
  on public.notifications_outbox (created_at desc, id desc);
create index if not exists notifications_outbox_tenant_recent_idx
  on public.notifications_outbox (tenant_id, created_at desc, id desc);

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
  with recent_outbox as (
    select
      o.tenant_id,
      pg_catalog.count(*) filter (
        where o.status in ('sent', 'delivered')
      ) as sent_30d,
      pg_catalog.count(*) filter (where o.status = 'failed') as failed_30d,
      pg_catalog.count(*) filter (where o.status = 'skipped') as skipped_30d,
      pg_catalog.coalesce(
        pg_catalog.sum(o.cost_ore) filter (
          where o.chosen_channel = 'sms'
            and o.status <> 'simulated'
        ),
        0::bigint
      ) as sms_cost_ore_30d
    from public.notifications_outbox o
    where o.created_at > pg_catalog.now() - interval '30 days'
    group by o.tenant_id
  ), active_customer_totals as (
    select c.tenant_id, pg_catalog.count(*) as customers_total
    from public.customers c
    where c.status = 'active'
    group by c.tenant_id
  ), active_customer_prefs as (
    select c.tenant_id, pg_catalog.count(*) as prefs_rows
    from public.customers c
    join public.customer_notification_prefs p
      on p.customer_id = c.id
     and p.tenant_id = c.tenant_id
    where c.status = 'active'
    group by c.tenant_id
  ), active_push_customers as (
    select c.tenant_id, pg_catalog.count(distinct c.id) as push_subs_active
    from public.customers c
    join public.push_subscriptions s
      on s.customer_id = c.id
     and s.tenant_id = c.tenant_id
     and s.revoked_at is null
    where c.status = 'active'
    group by c.tenant_id
  )
  select
    t.id,
    t.slug,
    t.name,
    pg_catalog.coalesce(o.sent_30d, 0::bigint),
    pg_catalog.coalesce(o.failed_30d, 0::bigint),
    pg_catalog.coalesce(o.skipped_30d, 0::bigint),
    pg_catalog.coalesce(o.sms_cost_ore_30d, 0::bigint),
    pg_catalog.coalesce(c.customers_total, 0::bigint),
    pg_catalog.coalesce(p.prefs_rows, 0::bigint),
    pg_catalog.coalesce(s.push_subs_active, 0::bigint)
  from public.tenants t
  left join recent_outbox o on o.tenant_id = t.id
  left join active_customer_totals c on c.tenant_id = t.id
  left join active_customer_prefs p on p.tenant_id = t.id
  left join active_push_customers s on s.tenant_id = t.id
  where t.status <> 'deleted'
  order by t.name;
end;
$$;

revoke all on function public.platform_outbox_summary() from public, anon;
grant execute on function public.platform_outbox_summary() to authenticated, service_role;
