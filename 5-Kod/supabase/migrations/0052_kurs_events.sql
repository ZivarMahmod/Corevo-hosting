-- goal-54 körning 4 (A6/S8): KURSER SOM RIKTIGA EVENT.
-- Ett tillfälle (tenant_events) har datum, kapacitet och anmälningsavgift; en
-- anmälan (event_registrations) tar 1–20 platser. Bransch-neutralt: "kurs" för
-- floristen, workshop/provning/event för vilken bransch som helst.
-- RLS-mönstret = 0033 (offert_requests): tenant-scoped via private.tenant_id()
-- + is_platform_admin()-bypass; anon får LÄSA tillfällen (publik kurslista) och
-- SKAPA anmälningar (publikt formulär) men aldrig läsa anmälningar (PII).

create table if not exists public.tenant_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  title        text not null,
  description  text,
  starts_at    timestamptz not null,
  duration_min integer not null default 120 check (duration_min between 15 and 1440),
  capacity     integer not null check (capacity between 1 and 500),
  -- anmälningsavgift i ören; 0 = gratis. Betalning tas inte här (betal-rails per
  -- kund = körning 5) — avgiften visas och bekräftas, betalas på plats tills dess.
  price_cents  integer not null default 0 check (price_cents >= 0),
  status       text not null default 'open' check (status in ('open','cancelled','done')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create index if not exists tenant_events_tenant_starts_idx
  on public.tenant_events (tenant_id, starts_at);

create table if not exists public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  event_id   uuid not null references public.tenant_events(id) on delete cascade,
  name       text not null,
  email      text,
  phone      text,
  party_size integer not null default 1 check (party_size between 1 and 20),
  message    text,
  status     text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists event_registrations_event_idx
  on public.event_registrations (event_id, status);
create index if not exists event_registrations_tenant_idx
  on public.event_registrations (tenant_id);

do $$
begin
  drop trigger if exists trg_tenant_events_updated_at on public.tenant_events;
  create trigger trg_tenant_events_updated_at before update on public.tenant_events
    for each row execute function public.set_updated_at();
end $$;

-- grants + RLS
grant select on public.tenant_events to anon;
grant select, insert, update, delete on public.tenant_events to authenticated;
grant insert on public.event_registrations to anon;
grant select, insert, update, delete on public.event_registrations to authenticated;

alter table public.tenant_events enable row level security;
drop policy if exists tenant_events_rls         on public.tenant_events;
drop policy if exists tenant_events_public_read on public.tenant_events;
create policy tenant_events_rls on public.tenant_events
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- anon läser tillfällen (publik lista; app-lagret filtrerar på tenant_id, jfr 0033).
create policy tenant_events_public_read on public.tenant_events
  for select to anon using (true);

alter table public.event_registrations enable row level security;
drop policy if exists event_registrations_rls           on public.event_registrations;
drop policy if exists event_registrations_public_insert on public.event_registrations;
create policy event_registrations_rls on public.event_registrations
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- anon får SKAPA en anmälan (app-lagret sätter tenant_id + kapacitetsvakt);
-- INGEN anon SELECT → anmälningar (PII) är aldrig publikt läsbara.
create policy event_registrations_public_insert on public.event_registrations
  for insert to anon with check (true);

-- Överbokningsskydd bor i app-lagret: intake-actionen läser summan av confirmed
-- party_size FÖRE insert och nekar när sällskapet inte får plats.
-- ponytail: känt race-fönster mellan läsning och insert (två samtidiga anmälningar
-- kan i teorin översälja) — acceptabelt på kursskala; uppgraderingsväg = en
-- SECURITY DEFINER-insertfunktion med radlås när volymen kräver det.
