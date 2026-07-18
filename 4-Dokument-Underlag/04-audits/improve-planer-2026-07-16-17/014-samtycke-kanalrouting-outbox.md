# Plan 014: Kommunikationsryggraden — samtycke + kanalrouting + notifications_outbox

> **Executor instructions**: Följ steg för steg, verifiera varje steg. STOP-villkor
> gäller — dubbelutskick och samtyckesbrott är de farliga felen. Uppdatera
> statusraden i `plans/README.md` när klar.
>
> **Drift check**: `git diff --stat 6cdd690..HEAD -- 5-Kod/apps/web/lib/notifications 5-Kod/supabase/migrations | head`

## Status

- **Priority**: P1 (ryggraden — kanalrouting, anti-spam, SMS-kostnad, durabilitet hänger på outboxen)
- **Effort**: L
- **Risk**: HÖG (samtycke = juridik; dubbelutskick = dubbla mejl/SMS till kund)
- **Depends on**: 013 (kundsubjekt), 006 (SMS-provider), 012 (durabel dispatch); mjuk 003 (samtyckesjuridik)
- **Category**: feature / infra
- **Planned at**: commit `6cdd690`, 2026-07-17
- **Beslut:** `notifications_outbox` är EN ledger som vet varför/kanal/samtycke/leverans/kostnad.
  Se `plans/DIREKTION-engagemangsmotor.md` punkt 2–4.

## Why this matters

Idag: e-post är enda riktiga kanalen, SMS är stub, push finns inte, allt är
fire-and-forget (utom påminnelser). Samtycke finns bara på tenant-nivå
(`tenant_settings.settings.notifications`), inte per kund; per-personal-flaggorna på
`tenant_member_permissions` skrivs men **läses aldrig** (död kontrakt). Ingen
service-vs-marknadsförings-separation per kund, ingen opt-out, ingen leverans-/
kostnadsledger. Visionen kräver: billigaste opt-in-kanal (push→e-post→SMS),
transaktionellt får alltid gå ut, marknadsföring kräver eget samtycke + kan stängas
av utan att slå av bekräftelser, och EN plats som spårar allt (för frekvenstak +
SMS-kostnadsdashboard + retry).

## Current state

- `lib/notifications/*`: `email.ts` (relä, kastar aldrig), `sms.ts` (STUB —
  `skipped:transport_unavailable`), `booking.ts` (confirm/cancel/reminder/rebook/receipt),
  `reminders.ts` (durabel lease, migr 0088), `events/offert/shop/gift/kontakt/google-review.ts`,
  `templates/brand/parse/settings.ts`.
- Tenant-toggles konsulteras: `reminders.ts:124,181`, `booking.ts:166`, `boka/actions.ts:398`,
  `google-review.ts:150`, `avboka/actions.ts:107`; `settings.ts:38-45` hårdkodar
  receipts/cancellations som "aldrig undertryckta".
- Per-staff-flaggor (`0081:179-228`) skrivs via `lib/personal/notification-preference-actions.ts`,
  läses av 0 sändare.
- Ingen `notifications_outbox`, ingen per-kund-preferens/samtycke.

## Scope

**In scope**:
- Ny migration (>=0089): `customer_notification_prefs` + `notifications_outbox`.
- Kanalrouter `lib/notifications/router.ts` (väljer billigaste opt-in+samtyckt kanal).
- Wire EN pilotkanal helt genom routern + outboxen (rekommendation: bokningsbekräftelse).
- SMS-kostnad från 46elks-svar (plan 006) skrivs till outbox.
- `lib/gdpr/erase.ts` (nå prefs + outbox-PII).

**Out of scope**:
- Skriva om ALLA sändare på en gång — EN kanal migreras helt (plan 012:s STOP), resten följer.
- Marknadsförings-SÄNDNING (win-back/erbjudanden) — kräver reko-motorn (017) + samtyckesjuridik
  (003). Här byggs bara datamodellen + routern som HEDRAR samtycke; inga marknadsutskick tänds.
- Push-transporten (plan 015) — routern får en `push`-gren men den no-op:ar tills 015 landar.

## Steps

### Step 1: customer_notification_prefs
Ny tabell (per `customers.id`): `push_enabled, email_enabled, sms_enabled bool`,
`preferred_channel text`, `marketing_consent bool` + `marketing_consent_at timestamptz`
+ `marketing_consent_source text` (GDPR-spårbarhet), per-typ-toggles (`want_reminders,
want_offers, want_open_slots, want_recommendations`). RLS: kund läser/skriver egen;
ägare/personal läser inom tenant; service-role skriver. Defaults: transaktionellt på,
marknadsföring AV (opt-in).

**Verify**: `insert`/`select` i DEMO; kund-RLS tillåter egen rad, nekar annans.

### Step 2: notifications_outbox (ledgern)
Ny tabell: `id, tenant_id, customer_id, booking_id null, event_type,
category text CHECK(transactional|marketing), chosen_channel, fallback_channel,
consent_state jsonb (snapshot), status text (queued|sent|delivered|failed|skipped),
skip_reason text, cost_ore int null, staff_id null, provider_ref text,
created_at, sent_at, delivered_at`. Status får uppdateras (queued→sent→delivered);
raden raderas inte. RLS: ägare/personal läser inom tenant; service-role skriver/uppdaterar.
Index på `(tenant_id, customer_id, category, created_at)` för frekvenstak-frågor.

**Verify**: `insert` en rad i DEMO; frekvensfråga "marknadsföring till kund X senaste 30
dagar" returnerar räkning.

### Step 3: kanalrouter
`lib/notifications/router.ts`: `resolveChannel(customer, category, type) → {channel,
fallback, allowed, skip_reason}`. Regler: transaktionellt (category=transactional)
kringgår marknads-opt-out men respekterar hård kanal-opt-out endast om lagligt utrymme
finns (bekräftelser måste kunna nå kunden — matcha `settings.ts:38-45`-logiken).
Marknadsföring kräver `marketing_consent=true` + typ-opt-in. Kanalval: push (om 015-sub
finns) → e-post (om email_enabled) → SMS (om sms_enabled). SMS aldrig auto till
app-kund om de inte valt det.

**Verify**: enhetstest på routern: (a) opt-out-kund + marknadsföring ⇒ `allowed=false,
skip_reason=no_consent`; (b) app-kund + transaktionellt ⇒ push; (c) icke-app + transaktionellt
⇒ e-post/SMS; (d) SMS aldrig vald för app-kund utan explicit val.

### Step 4: migrera pilotkanalen helt (bokningsbekräftelse)
Dra bokningsbekräftelsen (`lib/notifications/booking.ts`) genom routern; varje utskick
skriver en outbox-rad (chosen_channel, consent_state, status, cost). **Ta bort den gamla
in-app-direktsändningen för DENNA kanal samtidigt** (annars dubbla bekräftelser — plan
012 STOP). Övriga kanaler orörda tills de migreras senare.

**Verify**: DEMO-bokning ⇒ exakt EN bekräftelse skickas, EN outbox-rad med rätt kanal +
status; ingen dubbelsändning (grep att gamla direktvägen inte längre kör för bekräftelse).

### Step 5: SMS-kostnad in i ledgern
När SMS-grenen skickar (via plan 006:s 46elks-fetch), skriv `cost_ore` från provider-svaret
till outbox-raden. (Push/e-post `cost_ore=0`.)

**Verify**: DEMO-SMS-testutskick ⇒ outbox-raden har `cost_ore` satt.

### Step 6: död per-staff-kontrakt — wire minimalt eller markera
De skrivna-men-olästa staff-notify-flaggorna: antingen wire en minimal
staff-"ny bokning"-notis genom routern, ELLER markera flaggorna som ej-aktiva i UI så
kontraktet inte ljuger. Bygg inte full staff-notifiering här om det inte är trivialt —
markera som uppföljning.

**Verify**: flaggorna läses av något, eller UI säger tydligt "kommer snart"; inget tyst
löfte kvar.

### Step 7: GDPR
`lib/gdpr/erase.ts`: erase når `customer_notification_prefs` + nollar PII i `notifications_outbox`
(behåll icke-PII-statistik om möjligt, scrubba innehåll/kontakt).

**Verify**: erase en DEMO-kund ⇒ prefs borta, outbox-PII scrubbad.

## Done criteria

- [ ] `customer_notification_prefs` + `notifications_outbox` finns med RLS
- [ ] Router väljer billigaste opt-in+samtyckt kanal; enhetstestad (4 fall ovan)
- [ ] Bokningsbekräftelsen går genom router+outbox; INGEN dubbelsändning
- [ ] SMS-kostnad skrivs till outbox
- [ ] Död staff-kontrakt wire:at eller ärligt markerat
- [ ] Erase når prefs + outbox
- [ ] `pnpm test && pnpm typecheck` → 0; statusrad i README uppdaterad

## STOP conditions

- Pilotkanalen dubbeltriggar (router + gammal direktväg båda skickar) → ta bort
  in-app-direktvägen för kanalen INNAN routern tänds. Aldrig båda.
- Marknads-sändning skulle tändas utan samtyckespost/juridik (plan 003) → bygg bara
  datamodell + router; tänd inga marknadsutskick.
- Migrationsnummer krockar → nästa lediga, synka README.

## Maintenance notes

- Outboxen är basen för: frekvenstak (017), SMS-kostnadsdashboard (020), retry-durabilitet
  (webhook/cron läser `status='queued'`, plan 012). Håll den som enda sanningskälla — lägg
  aldrig en parallell räknare.
- När fler kanaler migreras: EN i taget, ta alltid bort in-app-direktvägen samtidigt.
- Realtime: om outbox-status ska bli live i admin, lägg `notifications_outbox` i
  `supabase_realtime` (samma postgres_changes-modell som `bookings`; blanda inte in Broadcast).
