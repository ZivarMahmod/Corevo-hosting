# Auth hook — role_level i JWT (väg B, VÅG 1)

**Status:** READY, EJ aktiverad. Aktiveras av Zivar via Supabase Dashboard (kan ej SQL-migreras — det är en projekt-inställning). Pending sedan G12.

## Varför
VÅG 1 stängde super_admin→tenant-yta-gapet med en **app_metadata-only-guard** i middleware (väg A — `platform_admin`/`tenant_id` finns redan i JWT, ingen DB-läs). Det räcker för platform_admin-separationen men kan INTE göra nivå-separation (kund/staff/salon_admin) i middleware, eftersom `roleLevel` idag bara finns i DB (`session.ts` joinar `users`→`roles` per render).

Den här hooken lyfter `role_level` + `role_name` in i JWT custom claims. När den är på kan HELA rollmatrisen kollapsa till EN middleware-guard på claims (väg B) — DAL-fences blir då försvar-på-djupet, inte enda gränsen.

> Tills hooken är på: middleware-guarden (väg A) + DAL `requirePortal`/`requirePlatformAdmin` (per-grupp-layout) är auktoritativa. Datagränsen = RLS, oförändrad oavsett.

## SQL — kör i Supabase SQL Editor INNAN du slår på hooken
```sql
-- Custom Access Token Hook: injicera role_level + role_name i JWT-claims.
-- Idempotent. search_path tomt (ingen injektionsyta). SECURITY DEFINER så den
-- når public.users/roles oavsett anroparens RLS.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims    jsonb := coalesce(event->'claims', '{}'::jsonb);
  v_level   int;
  v_name    text;
begin
  select r.level, r.name
    into v_level, v_name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = (event->>'user_id')::uuid;

  if v_level is not null then
    claims := jsonb_set(claims, '{role_level}', to_jsonb(v_level));
    claims := jsonb_set(claims, '{role_name}',  to_jsonb(v_name));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- GoTrue (supabase_auth_admin) MÅSTE kunna köra hooken; ingen annan roll ska.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
```

## Dashboard-steg (Zivar)
1. **Authentication → Hooks (Beta) → Custom Access Token** → välj funktionen `public.custom_access_token_hook` → **Enable**.
2. Logga ut + in på ett konto → nya JWT bär `role_level`/`role_name` i claims.
3. Verifiera: `select * from auth.users` JWT eller dekoda token → claimsen finns.

## När den är på (väg B-uppföljning, eget litet kort)
- `lib/supabase/middleware.ts updateSession` → läs `user.app_metadata` + nya top-level-claims; exponera `roleLevel` på middleware-usern UTAN DB-join.
- `middleware.ts` step-4b → utöka guarden till full matris (kund/staff/salon_admin på fel yta → `/ingen-atkomst`), inte bara platform_admin-bounce.
- Behåll DAL-fences (försvar-på-djupet). RLS orört.
- **Rollback:** Disable-toggla hooken i Dashboard → claims slutar sättas → middleware faller tillbaka på väg A automatiskt (guarden läser bara `platform_admin`, som alltid finns).

## Residual (VÅG 1, dokumenterat — ej hål)
Väg A-guarden stoppar GET-navigering, inte en handgjord action-POST: en `platform_admin` som träffar en admin-server-action direkt passerar fortf. `requirePortal('admin')`-kortslutningen och muterar den ankrade tenanten. Lågrisk (platform_admin = betrott konto, demo-ankaret raderas i VÅG 3). Väg B + en action-nivå-flagga-check täpper det helt senare.
