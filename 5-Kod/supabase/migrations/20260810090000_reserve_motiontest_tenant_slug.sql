-- Reserve the isolated FreshCut motiontest host as infrastructure, never a tenant.
-- This replaces only the current fallback-origin function; historical migrations
-- remain immutable.

create or replace function private.customer_portal_booking_origin(p_tenant uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_domain text;
begin
  select t.slug into v_slug
  from public.tenants t
  where t.id = p_tenant and t.status = 'active';

  if v_slug is null then return null; end if;

  select d.domain into v_domain
  from public.tenant_domains d
  where d.tenant_id = p_tenant
    and d.verified
    and d.domain = lower(d.domain)
    and length(d.domain) between 4 and 253
    and d.domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    and d.domain !~ '(^|\.)(xn--|admin|internal|localhost|portal|sms)(\.|$)'
    and pg_catalog.strpos(d.domain, 'corevo') = 0
    and d.domain <> 'corevo.se'
    and d.domain !~ '\.corevo\.se$'
  order by d.is_primary desc, d.created_at, d.id
  limit 1;

  if v_domain is not null then return 'https://' || v_domain; end if;

  if v_slug = lower(v_slug)
     and length(v_slug) between 1 and 63
     and v_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
     and v_slug !~ '^xn--'
     and v_slug not in (
       'booking', 'admin', 'app', 'www', 'api', 'superadmin', 'kiosk', 'dev',
       'odoo', 'superbooking', 'minbooking', 'boka', 'mina', 'internal',
       'localhost', 'portal', 'sms', 'motiontest'
     ) then
    return 'https://' || v_slug || '.corevo.se';
  end if;
  return null;
end;
$$;

revoke all on function private.customer_portal_booking_origin(uuid)
  from public, anon, authenticated, service_role;
