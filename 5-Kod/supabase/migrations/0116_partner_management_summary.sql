-- 0116_partner_management_summary.sql
-- goal-72 S7c: one authoritative, partner-scoped read model for license and
-- communication costs. Price remains editable per partner; the open month's
-- ledger rows are the live total while closed months remain frozen by 0114.

begin;

-- Every billing/partner page calls this immediately before reading. It closes
-- prior local months and upserts active tenants, so totals are correct at the
-- timezone boundary without waiting for the hourly maintenance sweep.
create or replace function public.sync_partner_license_open_month(
  p_partner uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope uuid := (select private.partner_id());
  v_rows integer := 0;
begin
  if not (select private.is_platform_admin()) then
    if v_scope is null then
      raise exception 'platform_operator_required' using errcode = '42501';
    end if;
    if p_partner is not null and p_partner is distinct from v_scope then
      raise exception 'partner_scope_required' using errcode = '42501';
    end if;
    p_partner := v_scope;
  end if;

  update public.partner_license_months lm
    set closed_at = coalesce(lm.closed_at, now())
  from public.partners p
  where p.id = lm.partner_id
    and (p_partner is null or p.id = p_partner)
    and lm.closed_at is null
    and lm.month < private.partner_month(p.id, now());

  insert into public.partner_license_months (
    partner_id, tenant_id, month, unit_price_ore, qualified_at
  )
  select p.id, t.id, private.partner_month(p.id, now()), p.license_price_ore, now()
  from public.partners p
  join public.tenants t on t.partner_id = p.id
  where p.status = 'active'
    and t.status = 'active'
    and (p_partner is null or p.id = p_partner)
  on conflict (partner_id, tenant_id, month) do update
    set unit_price_ore = excluded.unit_price_ore
  where partner_license_months.closed_at is null;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke all on function public.sync_partner_license_open_month(uuid)
  from public, anon;
grant execute on function public.sync_partner_license_open_month(uuid)
  to authenticated;

create or replace function public.platform_partner_summaries()
returns table (
  partner_id uuid,
  partner_name text,
  partner_slug text,
  partner_status text,
  country_code text,
  currency text,
  timezone text,
  license_price_ore integer,
  license_month date,
  active_tenants bigint,
  licensed_tenants bigint,
  license_total_ore bigint,
  sms_cost_ore bigint,
  sms_cost_currency text,
  member_email text,
  member_status text,
  member_joined_at timestamptz,
  sms_provider_key text,
  sms_provider_enabled boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_platform_access()) then
    raise exception 'platform_operator_required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.name,
    p.slug,
    p.status,
    p.country_code,
    p.currency,
    p.timezone,
    p.license_price_ore,
    private.partner_month(p.id, now()),
    coalesce(active_count.value, 0),
    coalesce(license_count.value, 0),
    coalesce(license_total.value, 0),
    coalesce(sms_total.value, 0),
    coalesce(sms_total.currency, 'SEK'),
    member.email,
    member.status,
    member.joined_at,
    coalesce(sms.provider_key, 'corevo_46elks'),
    coalesce(sms.enabled, false)
  from public.partners p
  left join lateral (
    select count(*)::bigint as value
    from public.tenants t
    where t.partner_id = p.id and t.status = 'active'
  ) active_count on true
  left join lateral (
    select count(*)::bigint as value
    from public.partner_license_months lm
    where lm.partner_id = p.id
      and lm.month = private.partner_month(p.id, now())
  ) license_count on true
  left join lateral (
    select sum(lm.unit_price_ore)::bigint as value
    from public.partner_license_months lm
    where lm.partner_id = p.id
      and lm.month = private.partner_month(p.id, now())
  ) license_total on true
  left join lateral (
    select
      sum(coalesce(o.cost_ore, 0))::bigint as value,
      max(o.cost_currency) filter (where o.cost_ore is not null) as currency
    from public.notifications_outbox o
    where o.partner_id = p.id
      and o.chosen_channel = 'sms'
      and o.status <> 'simulated'
      and o.created_at >= (private.partner_month(p.id, now())::timestamp at time zone p.timezone)
      and o.created_at < ((private.partner_month(p.id, now()) + interval '1 month')::timestamp at time zone p.timezone)
  ) sms_total on true
  left join lateral (
    select u.email, pm.status, pm.joined_at
    from public.partner_members pm
    join public.users u on u.id = pm.user_id
    where pm.partner_id = p.id
    order by case pm.role when 'owner' then 0 else 1 end, pm.created_at
    limit 1
  ) member on true
  left join public.partner_sms_configs sms on sms.partner_id = p.id
  where (select private.is_platform_admin())
     or p.id = (select private.partner_id())
  order by p.name, p.id;
end;
$$;

revoke all on function public.platform_partner_summaries() from public, anon;
grant execute on function public.platform_partner_summaries() to authenticated;

commit;
