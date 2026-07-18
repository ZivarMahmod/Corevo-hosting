-- goal-72 etapp 1a: PII-fri detaljläsare för Kommunikationscenter.
-- Tenant-id är både filter och returkolumn så ett framtida partnerscope kan
-- läggas i servergrinden utan att UI- eller datakontraktet byggs om.

create or replace function public.platform_outbox_rows(
  p_tenant uuid default null,
  p_channel text default null,
  p_status text default null,
  p_category text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  event_type text,
  category text,
  chosen_channel text,
  status text,
  cost_ore integer,
  skip_reason text,
  provider_ref text,
  created_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;

  if p_limit is null or p_limit not between 1 and 250 then
    raise exception 'platform_outbox_limit_invalid' using errcode = '22023';
  end if;
  if p_tenant is not null and not exists (
    select 1 from public.tenants t where t.id = p_tenant and t.status <> 'deleted'
  ) then
    raise exception 'platform_outbox_tenant_invalid' using errcode = '22023';
  end if;
  if p_channel is not null and (
    p_channel = '' or p_channel <> btrim(p_channel) or length(p_channel) > 100
  ) then
    raise exception 'platform_outbox_channel_invalid' using errcode = '22023';
  end if;
  if p_status is not null and (
    p_status = '' or p_status <> btrim(p_status) or length(p_status) > 100
  ) then
    raise exception 'platform_outbox_status_invalid' using errcode = '22023';
  end if;
  if p_category is not null and (
    p_category = '' or p_category <> btrim(p_category) or length(p_category) > 100
  ) then
    raise exception 'platform_outbox_category_invalid' using errcode = '22023';
  end if;

  return query
  select
    o.id,
    o.tenant_id,
    t.slug,
    t.name,
    o.event_type,
    o.category,
    o.chosen_channel,
    o.status,
    o.cost_ore,
    o.skip_reason,
    o.provider_ref,
    o.created_at,
    o.sent_at,
    o.delivered_at
  from public.notifications_outbox o
  join public.tenants t on t.id = o.tenant_id
  where t.status <> 'deleted'
    and (p_tenant is null or o.tenant_id = p_tenant)
    and (p_channel is null or o.chosen_channel = p_channel)
    and (p_status is null or o.status = p_status)
    and (p_category is null or o.category = p_category)
  order by o.created_at desc, o.id desc
  limit p_limit;
end;
$$;

revoke all on function public.platform_outbox_rows(uuid, text, text, text, integer) from public, anon;
grant execute on function public.platform_outbox_rows(uuid, text, text, text, integer) to authenticated, service_role;
