-- ============================================================================
-- 0014 — READY — APPLICERA EJ utan Zivar-OK.
-- M3 §2.2: 5-min slot-hold + release (ersätter pending-squat-skulden).
-- ADDITIV (BUILD-ONCE-NEVER-DELETE): ny tabell + helpers. Inga DROP/destruktiva
-- ALTER. Rör INTE bookings, no_double_booking-EXCLUDE eller create_public_booking.
--
-- ⚠️ INTE APPLICERAD. Skälet den ligger READY (inte applicerad i denna våg):
--   (1) Hård regel: ingen migration appliceras mot live-DB utan per-gång-Zivar-OK.
--   (2) types.ts är FRYST denna våg → app-vägen kan inte typsäkert läsa slot_holds
--       (supabase.from('slot_holds') felar typecheck förrän types regenereras).
--       Hold-FILTRERINGEN är därför byggd som en REN funktion (dormant, importeras
--       av ingen live-väg): lib/booking/holds.ts → filterHeldSlots(). När 0014
--       appliceras + types regenereras wiras get_busy_intervals/getAvailableSlots
--       att läsa aktiva holds och mata dem in. Tills dess: noll beteendeförändring.
--
-- MODELL (varför separat tabell, inte en bookings-status):
--   Ett hold är en KORTLIVAD reservation som ska auto-försvinna utan städ-jobb.
--   En 'hold'-status på bookings skulle (a) kräva ALTER på CHECK-constraint +
--   (b) blanda in i no_double_booking-EXCLUDE-semantiken + (c) sätta squat-skulden
--   den ska lösa. En separat tabell med expires_at + partiellt index = self-pruning
--   läsning ("aktiva = expires_at > now()"); utgångna rader ignoreras av läsvägen
--   och kan gallras lat (cron/lazy delete), aldrig load-bearing.
-- ============================================================================


-- ── 1. TABELL: slot_holds — kortlivad (5 min) reservation per (staff, tidsspann) ─
-- tenant_id bärs EXPLICIT (RLS nycklar på den, mönster = working_hour_slots 0011).
-- staff_id + tstzrange speglar bookings så samma frisör/tid-logik återanvänds.
-- session_token: opак klient-genererad nyckel (INTE auth) så samma flik kan
-- förlänga/släppa sitt eget hold utan inloggning (publik bokning kör anon).
create table if not exists public.slot_holds (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id)  on delete cascade,
  staff_id      uuid not null references public.staff(id)    on delete cascade,
  service_id    uuid          references public.services(id) on delete set null,
  start_ts      timestamptz not null,
  end_ts        timestamptz not null,
  session_token text not null,                              -- opak klient-nyckel (ej PII, ej auth)
  expires_at    timestamptz not null,                       -- now() + 5 min vid skapande
  created_at    timestamptz not null default now(),
  check (end_ts > start_ts),
  check (expires_at > created_at)
);

-- Hot path: läsvägen slår upp AKTIVA holds för (tenant, staff-set) → speglar
-- get_busy_intervals. Partiellt på framtida expiry kan inte vara now()-predikat
-- (icke-immutable) → indexera (tenant, staff, expires_at) och filtrera now() i query.
create index if not exists slot_holds_lookup_idx
  on public.slot_holds (tenant_id, staff_id, expires_at);
create index if not exists slot_holds_expires_idx
  on public.slot_holds (expires_at);                        -- lat gallring av utgångna
-- En session kan inte hålla samma exakta start två gånger för samma frisör.
create unique index if not exists slot_holds_session_uniq
  on public.slot_holds (staff_id, start_ts, session_token);


-- ── 2. updated_at saknas medvetet (holds uppdateras bara via expires_at-förlängning;
--       håll raden minimal). RLS: ── ────────────────────────────────────────────
alter table public.slot_holds enable row level security;

-- 2.1 authenticated tenant-fence (admin/personal ser sin tenants holds).
drop policy if exists slot_holds_rls on public.slot_holds;
create policy slot_holds_rls on public.slot_holds
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));

-- 2.2 anon public booking: läsa AKTIVA holds (matar slot-genereringen som kör anon)
--     + skapa/förnya/släppa sitt EGET hold. Gated på aktiv tenant, ingen PII.
--     Spegel av working_hour_slots_public_read (0011). Skriv-policys hålls smala:
--     INSERT/UPDATE/DELETE gatas på aktiv tenant; session-ägarskap drivs av
--     session_token i app-vägen (anon har ingen identitet att RLS-gata på).
drop policy if exists slot_holds_public_read on public.slot_holds;
create policy slot_holds_public_read on public.slot_holds
  for select to anon
  using (exists (
    select 1 from public.tenants t
     where t.id = slot_holds.tenant_id and t.status = 'active'
  ));

drop policy if exists slot_holds_public_write on public.slot_holds;
create policy slot_holds_public_write on public.slot_holds
  for insert to anon
  with check (exists (
    select 1 from public.tenants t
     where t.id = slot_holds.tenant_id and t.status = 'active'
  ));

drop policy if exists slot_holds_public_release on public.slot_holds;
create policy slot_holds_public_release on public.slot_holds
  for delete to anon
  using (exists (
    select 1 from public.tenants t
     where t.id = slot_holds.tenant_id and t.status = 'active'
  ));


-- ── 3. RPC: place_slot_hold — skapa/förnya ett 5-min hold (SECURITY DEFINER) ──
-- Validerar tenant aktiv + att (staff, tid) inte redan är hårt-bokad (samma fönster
-- create_public_booking annars skulle racea på). Idempotent per (staff,start,token):
-- en ny öppning av samma tid från samma flik FÖRNYAR expires_at i stället för att
-- skapa dubblett. Returnerar hold-id. p_ttl_min default 5 (M3 §2.2).
create or replace function public.place_slot_hold(
  p_tenant_slug text,
  p_staff       uuid,
  p_service     uuid,
  p_start       timestamptz,
  p_token       text,
  p_ttl_min     int default 5
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant   uuid;
  v_duration int;
  v_end      timestamptz;
  v_id       uuid;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if p_ttl_min is null or p_ttl_min <= 0 or p_ttl_min > 60 then
    raise exception 'invalid_ttl' using errcode = '22023';
  end if;

  select t.id into v_tenant from public.tenants t
   where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002'; end if;

  select s.duration_min into v_duration from public.services s
   where s.id = p_service and s.tenant_id = v_tenant and s.active = true;
  if v_duration is null then raise exception 'invalid_service' using errcode = 'P0002'; end if;

  v_end := p_start + make_interval(mins => v_duration);

  -- Redan hårt-bokad? Då finns inget att hålla (graceful "togs precis" i app-vägen).
  if exists (
    select 1 from public.bookings b
     where b.staff_id = p_staff
       and b.status in ('pending','confirmed','completed')
       and tstzrange(b.start_ts, b.end_ts) && tstzrange(p_start, v_end)
  ) then
    raise exception 'slot_taken' using errcode = '23P01';
  end if;

  insert into public.slot_holds (tenant_id, staff_id, service_id, start_ts, end_ts, session_token, expires_at)
  values (v_tenant, p_staff, p_service, p_start, v_end, p_token, now() + make_interval(mins => p_ttl_min))
  on conflict (staff_id, start_ts, session_token)
    do update set expires_at = now() + make_interval(mins => p_ttl_min),
                  end_ts     = excluded.end_ts,
                  service_id = excluded.service_id
  returning id into v_id;

  return v_id;
end;
$$;
revoke all     on function public.place_slot_hold(text, uuid, uuid, timestamptz, text, int) from public;
grant  execute on function public.place_slot_hold(text, uuid, uuid, timestamptz, text, int) to anon, authenticated;


-- ── 4. RPC: release_slot_hold — släpp ett eget hold tidigt (annars auto-expire) ─
create or replace function public.release_slot_hold(
  p_staff uuid,
  p_start timestamptz,
  p_token text
) returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.slot_holds
   where staff_id = p_staff and start_ts = p_start and session_token = p_token;
$$;
revoke all     on function public.release_slot_hold(uuid, timestamptz, text) from public;
grant  execute on function public.release_slot_hold(uuid, timestamptz, text) to anon, authenticated;


-- ── 5. (VALFRITT, EJ load-bearing) lat gallring av utgångna holds ────────────
-- Läsvägen ignorerar redan utgångna (expires_at <= now()); detta är bara städ.
-- Kan köras av en cron-sweep eller anropas opportunistiskt. Idempotent.
create or replace function public.prune_expired_slot_holds()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  delete from public.slot_holds where expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.prune_expired_slot_holds() from public;
grant  execute on function public.prune_expired_slot_holds() to authenticated;

-- ============================================================================
-- SLUT 0014. EJ APPLICERAD. När Zivar-OK: apply → regen packages/db/types.ts →
-- wira getAvailableSlots att läsa aktiva holds (lib/booking/holds.ts:filterHeldSlots)
-- + place/release i wizardens tidsval. Tills dess noll beteendeförändring.
-- ============================================================================
