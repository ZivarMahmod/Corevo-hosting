-- 0089_contact_messages_retention.sql
-- Plan 008 (tidsrobusthet) + GDPR lagringsminimering: kontaktformulärsmeddelanden
-- är PII (namn/mejl/telefon/fritext) och lagrades för evigt. Denna funktion raderar
-- meddelanden äldre än N månader (default 18). Anropas av cron-svepet
-- (/api/cron/pending-expiry) och av pg_cron (0090) — idempotent, billig, tenant-neutral
-- (åldern gäller alla tenants lika; ingen cross-tenant-logik).
--
-- OBS: site_revisions-cappen ur plan 008 är MEDVETET inte med här — 0080:s
-- immutabilitetstrigger blockerar DELETE på publicerade revisioner, så en cap
-- kräver ett produktbeslut om historikens kontrakt (spårat i plans/README.md).

create or replace function public.prune_contact_messages(p_months integer default 18)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  -- Vakt: aldrig en noll-/negativ-fönster-radering (felanrop får inte tömma inkorgen).
  if p_months is null or p_months < 1 then
    raise exception 'invalid_retention_months' using errcode = 'P0001';
  end if;
  delete from public.contact_messages
    where created_at < now() - make_interval(months => p_months);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Endast service_role (cron-svepet) får köra retention — aldrig klientroller.
revoke all on function public.prune_contact_messages(integer)
  from public, anon, authenticated;
grant execute on function public.prune_contact_messages(integer) to service_role;
