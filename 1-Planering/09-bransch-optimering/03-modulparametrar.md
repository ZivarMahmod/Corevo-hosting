# Modulparametrar — bokningsparametrar som borde bli bransch-styrda

> Inventering 2026-07-11. Basen: `5-Kod/apps/web`. Frågan: vilka boknings-parametrar bor var idag,
> vilka är hårdkodade, och hur läggs en bransch-nivå (vertical-default) in utan att bryta
> befintliga fallback-mönster.

## 1. Nulägeskarta — parameter för parameter

### 1.1 Slot-steg (raster)
- **DB:** `staff.slot_step_min` och `services.slot_step_min` (nullable, check 1–240) — `supabase/migrations/0011_customers_identity_and_schedule.sql:184-189`.
- **Kod:** konstant `SLOT_STEP_MIN = 15` i `apps/web/app/boka/actions.ts:46`; fallback-kedja i `actions.ts:227`:
  `service.slot_step_min ?? stepByStaff.get(id) ?? SLOT_STEP_MIN`.
- **Status:** per-service/per-staff override finns; **sista fallbacket är hårdkodat 15** — det är där bransch-defaulten ska in.

### 1.2 Buffert
- **DB:** `staff.buffer_min`, `services.buffer_min` (samma migration 0011).
- **Kod:** `apps/web/app/boka/actions.ts:228`: `service.buffer_min ?? bufferByStaff.get(id) ?? 0`.
- **Status:** samma mönster; hårdkodad slutfallback `0`.

### 1.3 Bokningsfönster
- **Kod:** `const BOOKING_WINDOW_DAYS = 90` — `apps/web/components/booking/BookingWizard.tsx:192` (klient-konstant, styr kalenderns dagslista rad 196 och månadskalendern rad 828).
- **DB:** ingen kolumn alls.
- **Status:** **helt hårdkodad**, dessutom bara i UI:t — servern validerar inte fönstret (endast start-in-past via RPC P0001).

### 1.4 Gäst-fält (namn/tel/mail-krav)
- **Kod:** `apps/web/app/boka/actions.ts:297-302` — alla tre kräver icke-tomt: `if (!name || !email || !phone) → 'Fyll i namn, e-post och telefon.'`. Kontakt skrivs till RPC:ns `p_guest_name/email/phone` (rad 319-321) + note-seam (rad 309-310).
- **Status:** **hårdkodat "alla tre obligatoriska"**. En restaurang vill ofta ha namn+tel (mail valfritt); en cykelverkstad kanske namn+mail.

### 1.5 Pending-TTL (övergivna checkout-bokningar)
- **Kod:** `apps/web/app/api/cron/pending-expiry/route.ts:39` — `admin.rpc('expire_abandoned_pending_bookings', { p_ttl_min: 30 })`.
- **DB:** RPC:n tar `p_ttl_min` som parameter (migr 0018) men anropet är **hårdkodat 30 min globalt** — ingen tenant/bransch-dimension; svepet är dessutom cross-tenant i ett anrop.

### 1.6 Betala på plats vs förskott
- **Kod:** `apps/web/app/boka/actions.ts:382-393` — `requiresPayment = getPaymentGate(...).canTakeOnline` (payments_enabled AND charges_enabled), annars betala på plats.
- **Status:** dagens gate är en **teknisk capability** (Stripe kopplad?), inte en **policy** (vill branschen ha förskott/deposition/no-show-avgift?). Det finns ingen `payment_policy`-inställning alls — kan-ta-online ⇒ tar online, alltid fullpris.

### 1.7 Avbokningsregler
- **Kod:** `apps/web/lib/kund/settings.ts:6` — `DEFAULT_CANCELLATION_CUTOFF_HOURS = 24`; läses via `getCancellationCutoffHours()` (rad 14-27) från **`tenant_settings.settings.cancellation_cutoff_hours`** (jsonb). Konsumeras i `app/avboka/actions.ts:52`, `app/avboka/[id]/page.tsx:153`, `lib/kund/actions.ts:152,214`, admin-UI `components/admin/SettingsForm.tsx:213` + `lib/admin/actions.ts:1242,1287`.
- **Status:** **bästa förebilden i kodbasen** — tenant-override i jsonb + hårdkodad app-default. Saknar bara bransch-lagret mellan.

### 1.8 Påminnelse-timing
- **Kod:** `apps/web/lib/notifications/reminders.ts:59-62` — `horizon = now + 30 * 60 * 60 * 1000` (30h, Zivar-beslut 2026-07-10). On/off per tenant finns (`tenant_settings.settings.notifications.reminder`, `lib/notifications/settings.ts`), men **timingen är hårdkodad globalt**. En restaurang vill snarare 3–4h; en verkstad 24h.

## 2. Sammanfattningstabell

| Parameter | Bransch | Tenant | Staff/Service | Hårdkodad fallback |
|---|---|---|---|---|
| slot_step_min | ✗ | ✗ | ✓ (0011) | 15 (`boka/actions.ts:46`) |
| buffer_min | ✗ | ✗ | ✓ (0011) | 0 (`boka/actions.ts:228`) |
| booking_window_days | ✗ | ✗ | ✗ | 90, UI-only (`BookingWizard.tsx:192`) |
| gäst-fält-krav | ✗ | ✗ | ✗ | alla tre (`boka/actions.ts:300`) |
| pending_ttl_min | ✗ | ✗ | ✗ | 30 (`cron/pending-expiry/route.ts:39`) |
| payment_policy | ✗ | ✗ (capability, ej policy) | ✗ | on-site om ej Stripe (`boka/actions.ts:387`) |
| cancellation_cutoff_hours | ✗ | ✓ jsonb | ✗ | 24 (`lib/kund/settings.ts:6`) |
| reminder_hours_before | ✗ | ✗ (bara on/off) | ✗ | 30 (`reminders.ts:62`) |

## 3. Var bransch-lagret ska bo

`public.verticals` (migr `0026_multibranch_core.sql:57`) har redan en **`rules` jsonb-kolumn** — plattform-ägd katalog, anon-läsbar (0027). Bransch-defaults läggs som `verticals.rules.booking` — ingen ny tabell behövs. Tenant kopplas via `tenants.vertical_id` (0026:159, nullable).

### Föreslagen schema-form (`verticals.rules.booking`)

```jsonc
{
  "booking": {
    "slot_step_min": 15,
    "buffer_min": 0,
    "booking_window_days": 90,
    "guest_fields": { "name": "required", "email": "required", "phone": "required" },
    "pending_ttl_min": 30,
    "payment_policy": "on_site_or_online",   // on_site_only | prepay_required | deposit
    "cancellation_cutoff_hours": 24,
    "reminder_hours_before": 30
  }
}
```

### Exempel per bransch

| Parameter | frisör | nagelstudio | restaurang | cykelverkstad |
|---|---|---|---|---|
| slot_step_min | 15 | 30 | 15 (sittningsstart) | 60 |
| buffer_min | 0 | 10 (torkning/städ) | 0 | 15 |
| booking_window_days | 90 | 60 | 30 | 21 |
| guest_fields | namn+mail+tel | namn+mail+tel | namn+tel (mail optional) | namn+mail (tel optional) |
| pending_ttl_min | 30 | 30 | 15 (het inventory) | 60 |
| payment_policy | on_site_or_online | prepay gärna (no-show-tungt) | on_site (ev. deposition stora sällskap) | on_site (betalar vid hämtning) |
| cancellation_cutoff_hours | 24 | 24 | 4 | 48 (delar beställda) |
| reminder_hours_before | 30 | 30 | 4 | 24 |

## 4. Fallback-kedja — matcha befintligt mönster

Befintligt mönster i `app/boka/actions.ts:227` är `service ?? staff ?? KONSTANT`. Utökning:

```
service-override  →  staff-override  →  tenant-override            →  bransch-default        →  kodkonstant
(services.*)         (staff.*)          (tenant_settings.settings     (verticals.rules          (sista skyddsnät,
                                          .booking.*)                   .booking.*)               dagens värden)
```

Konkret:
1. Ny helper `lib/booking/params.ts`: `getBookingParams(supabase, tenantId)` — läser `tenants.vertical_id` → `verticals.rules.booking`, spreadar `tenant_settings.settings.booking` ovanpå, återfaller på dagens konstanter. Samma form som `getCancellationCutoffHours` (`lib/kund/settings.ts:14`) och `getEnabledNotifications` (`lib/notifications/settings.ts`).
2. `boka/actions.ts:227-228` byter bara sista ledet: `service.slot_step_min ?? stepByStaff.get(id) ?? params.slot_step_min` — staff/service-overrides orörda.
3. `BookingWizard` får `bookingWindowDays` som prop från server-sidan (tenant-data), plus server-side validering av fönstret i `createBooking`.
4. Gäst-fält: valideringen i `createBooking` (rad 300) läser `params.guest_fields`; wizard-formuläret speglar samma krav (required-attribut).
5. Pending-TTL: svepet är cross-tenant → antingen RPC:n läser per-tenant TTL internt, eller kör med minsta aktiva TTL. Enklast: flytta TTL-uppslag in i `expire_abandoned_pending_bookings` (per booking-rad: tenant → vertical → 30).
6. Reminder-timing: `sendDueReminders` byter fast 30h-horisont mot max(params) som query-horisont + per-rad-filter på tenantens faktiska `reminder_hours_before` (cachen per tenant finns redan, rad 81-91).
7. `payment_policy`: ny inställning som kombineras med capability-gaten: `requiresPayment = gate.canTakeOnline && policy !== 'on_site_only'`; `prepay_required` utan Stripe → degradera till on-site (aldrig blockera bokning).

**Fredning:** freshcut (frisör-vertical) ska få byte-identiskt beteende — frisör-defaults i `verticals.rules.booking` sätts till exakt dagens hårdkodade värden (15/0/90/alla-fält/30/24/30h).

## Rekommenderad byggordning

1. **Seed `verticals.rules.booking`** för de 5 befintliga verticals (frisör = dagens värden ⇒ noll beteendeskifte) — en migration, ingen kodändring.
2. **`lib/booking/params.ts`** — helper med fallback-kedjan + enhetstester (mönster: `lib/booking/availability.test.ts:250` testar redan NULL→15).
3. **Koppla in slot_step/buffer** i `boka/actions.ts:227-228` (minsta diff, störst befintligt stöd).
4. **cancellation_cutoff**: lägg bransch-ledet i `getCancellationCutoffHours` (24 → vertical → tenant) — 1 fil.
5. **booking_window_days**: prop till BookingWizard + server-validering i `createBooking`.
6. **guest_fields**: validering + wizard-formulär.
7. **reminder_hours_before**: `sendDueReminders`-horisont per tenant.
8. **pending_ttl_min**: per-tenant TTL i RPC:n (DB-migration).
9. **payment_policy**: sist — kräver produktbeslut (deposition/no-show-avgift = ny Stripe-yta), leverera bara `on_site_only`-flaggan först.
