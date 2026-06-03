-- 0019 — resolve_tenant_by_domain (goal-16 custom domains).
-- Maps an EXTERNAL host (a customer's own domain) to its tenant slug for the
-- middleware custom-domain fallback. tenants has no domain/verified column — the
-- mapping lives in public.tenant_domains (domain, verified, tenant_id). SECURITY
-- DEFINER so the anon middleware lookup can read the join regardless of RLS; it
-- exposes ONLY the slug, and ONLY for a VERIFIED domain on an ACTIVE tenant
-- (no PII, write-nothing). Numbered 0019 (NOT the brief's stale '0011').
set search_path = public;

create or replace function public.resolve_tenant_by_domain(p_host text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.slug
    from public.tenant_domains d
    join public.tenants t on t.id = d.tenant_id
   where d.domain = lower(btrim(p_host))
     and d.verified = true
     and t.status = 'active'
   limit 1;
$$;

revoke all on function public.resolve_tenant_by_domain(text) from public;
grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;
