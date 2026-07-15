-- 0067_admin_customer_rows_rpc.sql
--
-- Prestanda-audit C4 (den farligaste): /admin/kunder laddade ALLA kunder MED hela
-- deras bokningshistorik inbaddad + HELA loyalty_ledger, in i ett 128 MB-isolat, och
-- raknade besok/poang i JS. Ingen grans. Vid 1000+ kunder kapar PostgREST svaret vid
-- taket och siffrorna blir TYST felaktiga (inte ett fel — fel data). Kunddetaljsidan
-- drog dessutom HELA kundlistan bara for EN kunds poang.
--
-- Fix: aggregera i SQL. Den har RPC:n returnerar per-kund-rader dar besok (count),
-- senaste besok (max) och lojalitetssaldo (sum) redan ar raknade i Postgres — sma
-- rader, aldrig inbaddade arrayer, aldrig hela ledgern in i isolatet, och COUNT/SUM
-- kan inte kapas som en inbaddad select. Namn-maskering + niva-tarning bor kvar i
-- app-lagret (identiskt UI).
--
-- SECURITY INVOKER: kors med anroparens rattigheter, sa RLS pa customers/bookings/
-- loyalty_ledger galler EXAKT som de tre separata authed-lasningarna gjorde
-- (customers_rls 0011: role_level>=3 inom tenant; ledger SELECT-only tenant-wide).
-- Ingen ny atkomst oppnas. p_customer (default null) later kunddetaljsidan hamta
-- EN kunds aggregat utan att dra listan.
--
-- ACTIVE_BOOKING speglar lib/admin/data.ts: ('pending','confirmed','completed').

create or replace function public.admin_customer_rows(
  p_tenant uuid,
  p_customer uuid default null
)
returns table (
  id uuid,
  display_name text,
  full_name text,
  name_hidden boolean,
  status text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  hidden_at timestamptz,
  visits bigint,
  last_visit_ts timestamptz,
  loyalty_points bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.display_name,
    c.full_name,
    c.name_hidden,
    c.status,
    c.first_seen_at,
    c.last_seen_at,
    c.hidden_at,
    coalesce(v.visits, 0)      as visits,
    v.last_visit_ts,
    coalesce(l.points, 0)      as loyalty_points
  from public.customers c
  left join (
    select
      b.customer_id,
      count(*)          as visits,
      max(b.start_ts)   as last_visit_ts
    from public.bookings b
    where b.tenant_id = p_tenant
      and b.status in ('pending', 'confirmed', 'completed')
      and (p_customer is null or b.customer_id = p_customer)
    group by b.customer_id
  ) v on v.customer_id = c.id
  left join (
    select
      ll.customer_id,
      sum(ll.points_delta) as points
    from public.loyalty_ledger ll
    where ll.tenant_id = p_tenant
      and (p_customer is null or ll.customer_id = p_customer)
    group by ll.customer_id
  ) l on l.customer_id = c.id
  where c.tenant_id = p_tenant
    and c.status = 'active'
    and (p_customer is null or c.id = p_customer)
  -- c.id som unik tie-break: stabil ordning sa sidhamtning (.range i data-lagret)
  -- aldrig tappar/dubblar en rad vid sidgransen nar last_seen_at ar lika.
  order by c.last_seen_at desc nulls last, c.id;
$$;

-- Bara inloggade (authed) far kalla den; anon-storefronten aldrig. Postgres GRANTAR
-- EXECUTE till PUBLIC by default pa nya funktioner — det maste revokas FRAN PUBLIC
-- (att revoka fran enbart anon lamnar den arvda PUBLIC-rattigheten kvar).
revoke execute on function public.admin_customer_rows(uuid, uuid) from public;
grant execute on function public.admin_customer_rows(uuid, uuid) to authenticated;
