# FAS 4 — syntes (VÅG 4: realtime + FULL multi-salong)

Recon-flotta `wd4tw6jgq` (3 agenter). Beslut låsta. Frusna filer (migrationer, `create_public_booking`, middleware ej rört) = SOLO; app-revir disjunkta → parallell flotta.

## 4a — Realtime (back-office live booking-updates)
- **Migr `0020_realtime_bookings.sql`:** `alter publication supabase_realtime add table public.bookings` (DO-guard mot pg_publication_tables → idempotent). RLS `bookings_rls` (0010) fence:ar redan kanalen per-subscriber-JWT (tenant + role≥3/egen) → INGEN ny policy, INGEN realtime.messages. replica identity default(pk) OK (inga hård-deletes → bara INSERT/UPDATE behövs, alltid fenced+delivered).
- **`<RealtimeBookings tenantId?>` ('use client'):** `lib/supabase/client.ts` createClient() → `channel('bookings').on('postgres_changes',{event:'*',schema:'public',table:'bookings'[,filter:'tenant_id=eq.<id>']}, debouncedRouterRefresh).subscribe()`; `removeChannel` on unmount. **SIGNAL→`router.refresh()`** (ej datakälla; server-läs är RLS-fenced + self-heal). **AUTH-RACE = #1 footgun:** subscribe FÖRST efter session-hydrering + re-auth på token-refresh (`onAuthStateChange`/`setAuth`) annars 0 events (tyst). Filter `tenant_id` för admin+personal (försvar-på-djupet + brus-minskning); INGET filter för platform (cross-tenant by design).
- **Mount:** `app/(admin)/layout.tsx`, `app/(personal)/layout.tsx`, `app/(platform)/layout.tsx`. tenantId från server-renderad layout (requirePortal redan löst).

## 4b — FULL multi-salong
**MODELL-BESLUT (forken):** per-location-scope = **`working_hours.location_id`** (flexibelt: en barberare kan jobba på flera platser via working_hours-rader per plats). `staff.location_id` = admin-"hemmaplats"-default. `staff_services` förblir tenant-global (erbjuder-tjänst = global, ingen location-kolumn). Tillgänglighet på plats Y = staff som har working_hours på Y.

**Migr `0021_multi_location.sql` (SOLO, atomisk):**
1. `alter table public.locations add column active boolean not null default true` (deactivate-stöd; saknas idag).
2. **`create_public_booking` 9→10-arg** (additivt `p_location uuid default null`): om satt → validera `exists(select 1 from public.locations where id=p_location and tenant_id=v_tenant and active)` annars fallback `is_primary limit 1` (byte-identiskt för 1-location). Stampar `bookings.location_id`. Body annars BEVARAD från 0015. SECURITY DEFINER + `search_path=''` + drop+create+revoke+grant atomiskt (10-arg signatur).
3. **`set_primary_location(p_location uuid)` RPC** (SECURITY DEFINER, tenant-fenced via `private.tenant_id()`): demote nuvarande primary → promote p_location, EN tx (undviker 23505 mot `locations_one_primary_idx`); aldrig noll primary. Grant authenticated.

**App read-side (HIGH latent-bug-fix, `app/boka/actions.ts`):**
- `getAvailableSlots`: filtrera `working_hours` (:116-121) + `working_hour_slots` (:128-134) på `location_id = p_location`; kandidat-staff (:100-107) = de som har working_hours på platsen (exists-filter). `get_busy_intervals` (:139-144) **EJ** location-filtrerad (staff-keyad, person på en plats).
- `getTenantContext` (:44-63): returnera även `locationId` (vald plats el. primary).
- `createBooking`-action: tråda `locationId` → `p_location` i RPC-anropet.

**Wizard (`components/booking/BookingWizard.tsx` + `app/boka/page.tsx`):**
- `page.tsx`: ladda `locations` (active) i Promise.all; lägg `location_id` på staff/service-payload + types.
- Location-picker: wizard-mode = nytt steg före Tjänst (stepLabels/Titles :316-317, canAdvance :280-289, kroppar +1); compact-mode = chip-rad överst (:343). **1 location → auto-vald + DOLD (oförändrad UX).** Tråda `locationId` → getAvailableSlots(:126) + createBooking(:194-202).

**Admin manage-locations (`lib/admin/actions.ts` + nytt):**
- Actions (mirror createService/toggleServiceActive-mönstret + adminCtx-gate + revalidate): `createLocation` (tenant_id+name, mirror platform/actions.ts:121), `renameLocation`/`updateLocation` (name/address/timezone), `setPrimaryLocation` (via RPC), `toggleLocationActive` (FÖRBJUD inaktivera/radera PRIMARY — load-bearing för create_public_booking; hård-delete blockad av 6 RESTRICT-FK → bara soft-deactivate).
- Sida `app/(admin)/admin/platser/page.tsx` + `LocationsManager` (mirror tjanster/ServicesManager, useActionState). Read finns: `lib/admin/data.ts` listLocations/LocationRow.
- Nav: `PortalSidebar.tsx:26-38` → `{href:'/admin/platser',label:'Platser',icon:'building'}` (befintlig IconName).
- **Per-location-tilldelning:** location-`<select>` på scheman-managern (working_hours per plats — den funktionella scopen). staff/tjanster-managers får location-`<select>` (default hemmaplats) där rad skapas.

## Frozen / SOLO ordning
1. Migr 0020 + 0021 (jag, sekventiellt mot molnet, AFTER-verify, regen types). 2. Parallell app-flotta (disjunkta revir): **R** realtime-komponent+3 layouts · **E** boka-motor (actions/page/wizard) · **A** admin-platser (actions/page/manager/nav + scheman-select).

## Verifiering (adversariell flotta)
Realtime: live booking-INSERT/UPDATE → back-office uppdateras utan reload; kanal 0 cross-tenant-läck (RLS + filter). Multi-location: 2-location test-tenant → picker visas (≥2) / döljs (1=FreshCut oförändrad); plats A's slots = bara A's staff/tider; bokning stampar rätt location_id; deactivate primary nekas; set-primary atomiskt. Gate + advisor (ingen ERROR-regress, ingen ny anon-PII). POS 200. FreshCut (1 plats) byte-identisk.

## Rollback
Migr 0020/0021 = drop/revert-block; kod `git revert` + `wrangler rollback c231d619`. Realtime av-bar (ta bort publication-medlem) utan att bryta bokning.
