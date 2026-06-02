# Notiser — arkitektur (M9 / Modul G)

Kund-notiser (e-post) + Google-recension-nudge för Corevo Booking. All kod ligger
i `apps/web/lib/notifications/`. Detta är **lib + doc** — inga callers ändras här;
orkestreraren kopplar in nya anrop (se "Ej inkopplat" nedan).

> Designspråk i mejl: e-postklienter strippar `<link>`, ignorerar CSS-variabler
> och laddar inte webfonter. Därför når **varken** `globals.css`-klasser eller
> `var(--color-*)`-tokens inkorgen. Corevo-känslan bärs av **inline-stilar** med
> design-systemets HEX-spegel (skogsgrön `#1F4636`, guld `#F5A623`, kräm `#F4F1EA`,
> ink `#0E1411`, papper `#FEFCF7`) och en serif-rubrikstack
> (`'Playfair Display', Georgia, serif` — Playfair renderar oftast INTE i mejl,
> Georgia är den riktiga fallbacken). Tabell-layout + 520px-container.

---

## 1. Kanaler

| Kanal | Status | Transport |
|---|---|---|
| **E-post** | live (M9; transport bytt i goal-14) | **HTTPS → Supabase Edge Function `send-email` → one.com SMTP** (`lib/notifications/email.ts`). Workern POST:ar renderat mejl med `x-relay-secret`; klassisk SMTP går ej på Workers. Per-salong From/Reply-To/brand via `lib/notifications/brand.ts`. (Resend borttaget.) Se `docs/ops/mejl-egen-smtp.md`. |
| **SMS** | framtid | Ej byggt. Lägg som ny transport bredvid `sendEmail` (t.ex. en `sendSms` mot en HTTP-SMS-leverantör), behåll samma best-effort-kontrakt. |

**Best-effort-kontrakt (gäller alla sändare):** en notis får ALDRIG kasta in i,
eller blockera, flödet den observerar (bokning/avbokning/betalning/besök). Utan
relä-secrets `EMAIL_RELAY_URL`/`EMAIL_RELAY_SECRET` (lokalt/CI) loggar `sendEmail` avsikten och returnerar
`{ skipped: true }` i stället för att kasta. `SendResult` är `ok` / `skipped` / `failed`
— det är notismodulens motsvarighet till laddar/tom/fel/lyckat-tillstånden.

---

## 2. Mallar (Corevo-brandade, svenska)

Alla i `lib/notifications/templates.ts`. Returnerar `{ subject, html }`.

| Mall | Funktion | Trigger | Eyebrow |
|---|---|---|---|
| Bekräftelse | `confirmationEmail` | Ny bokning skapad (`app/boka/actions`) | "Bokning bekräftad" |
| Ombokning (**ny**) | `rebookEmail` | Kund flyttar tid (`lib/kund/actions.rebookBooking`) | "Ombokning" |
| Avbokning | `cancellationEmail` | Kund avbokar (`lib/kund/actions.cancelBooking`) | "Avbokning" |
| Kvitto | `receiptEmail` | `payment_intent.succeeded` (Stripe-webhook) | "Kvitto" |
| Påminnelse | `reminderEmail` | Cron ~24h före tid (`lib/notifications/reminders`) | "Påminnelse" |

Delad chrome: `shell(title, bodyHtml, tenantName, eyebrow?)` är **exporterad** så
Google-recension-mejlet återanvänder exakt samma ram. Tjänste-/tidsblocket renderas
av den interna `details()` i salongens tidszon via `Intl` (Workers-säkert).

Orkestrering: `lib/notifications/booking.ts` —
`sendBookingConfirmation` / `sendBookingRebook` (**ny**) / `sendBookingCancellation`
/ `sendBookingReminder` / `sendPaymentReceipt`. Alla `await`:bara, kastar aldrig.

---

## 3. Google-recension-nudge

Fil: `lib/notifications/google-review.ts`. Exporterar `sendGoogleReviewNudge(to, data)`
och `googleReviewEmail(...)`.

- **Timing:** designad att avfyras **efter ett genomfört besök** — dvs när en bokning
  får `status = 'completed'`. Naturliga call-sites (kopplas av orkestreraren):
  en "markera klar"-action i personal/admin, eller en cron-svep över bokningar som
  nyss blivit `completed`. Skicka tidigast efter besöket; en kort fördröjning (t.ex.
  någon timme) ökar svarsfrekvensen men är valfri.
- **Recensions-URL:** läses från `tenant_settings.settings.google_review_url`
  via `getGoogleReviewUrl(supabase, tenantId)`. Saknas den → **graceful no-op**
  (`sendGoogleReviewNudge` returnerar `{ ok:false, skipped:true }` utan att skicka),
  så call-siten kan anropa villkorslöst.
- **Innehåll:** kort, varm svensk text + en guld-pill-knapp ("Lämna ett omdöme")
  som länkar till recensions-URL:en, i den delade brandade `shell()`.

---

## 4. Ägarkontroll (på/av per salong)

Helper: `getEnabledNotifications(supabase, tenantId)` i `lib/notifications/settings.ts`.
Läser `tenant_settings.settings.notifications.{confirmation,reminder,review}` och
returnerar `{ confirmation, reminder, review }`. **Default: allt `true`** — en
okonfigurerad salong behåller full service. Ägaren kan senare slå av en kategori
genom att sätta flaggan `false` i jsonb (admin-UI byggs i annan modul).

Avsiktligt **bara dessa tre** kategorier är på/av-bara. **Kvitto** och
**avboknings­bekräftelse** är transaktionella/legala och dämpas aldrig.

**Varför helpern inte är inkopplad i sändarna:** befintliga sändare tar `(to, data)`
utan `tenantId`/klient. Att läsa settings inne i dem skulle kräva ändrad signatur +
caller-ändringar (utanför revir, regressionsrisk). Helpern exporteras därför och
orkestreraren konsulterar den **vid call-siten** före anropet, t.ex.:

```ts
const prefs = await getEnabledNotifications(supabase, tenantId)
if (prefs.confirmation) await sendBookingConfirmation(to, data)
// ...
if (prefs.review) {
  const url = await getGoogleReviewUrl(supabase, tenantId)
  await sendGoogleReviewNudge(to, { tenantName, reviewUrl: url, customerName })
}
```

`tenant_settings.settings` (jsonb) — relevant form:

```jsonc
{
  "cancellation_cutoff_hours": 24,          // (lib/kund/settings.ts, befintlig)
  "google_review_url": "https://g.page/r/.../review",
  "notifications": { "confirmation": true, "reminder": true, "review": true }
}
```

---

## 5. Triggrar (översikt)

| Händelse | Var | Notis |
|---|---|---|
| Bokning skapad | `app/boka/actions` | `sendBookingConfirmation` |
| Kund ombokar | `lib/kund/actions.rebookBooking` | i dag `sendBookingConfirmation` → bör bli `sendBookingRebook` |
| Kund avbokar | `lib/kund/actions.cancelBooking` | `sendBookingCancellation` |
| Betalning lyckad | `app/api/stripe/webhook` | `sendPaymentReceipt` |
| ~24h före tid (cron) | `app/api/cron/reminders` → `reminders.ts` | `sendBookingReminder` (idempotent via `bookings.reminded_at`) |
| Besök genomfört (`completed`) | **ej inkopplat** | `sendGoogleReviewNudge` |

---

## 6. Ej inkopplat (orkestreraren kopplar) — cross-module

Dessa nya exporter är klara men medvetet **inte** inkopplade (call-sites ligger
utanför detta revir):

1. **`sendBookingRebook`** — `lib/kund/actions.rebookBooking` anropar i dag
   `sendBookingConfirmation` för den nya tiden. Byt till `sendBookingRebook` för
   en korrekt "ombokad"-formulering.
2. **`sendGoogleReviewNudge`** — koppla in vid `completed`-övergången (markera-klar-
   action eller cron-svep). Konsultera `getEnabledNotifications(...).review` +
   `getGoogleReviewUrl(...)` först.
3. **`getEnabledNotifications`** — konsultera vid varje på/av-bar call-site
   (bekräftelse, påminnelse, recension) före sändning.

---

## 7. Krävda secrets (Worker-secrets i prod)

| Secret | Roll | Saknas → |
|---|---|---|
| `EMAIL_RELAY_URL` + `EMAIL_RELAY_SECRET` | Edge Function-reläets URL + delad hemlighet (e-posttransport, goal-14) | `sendEmail` no-op:ar (`{ skipped:true }`) — inga mejl skickas, inget kastar |
| `NOTIFICATIONS_FROM` | Avsändaradress (display-namn byts per salong). Default `Corevo <bokning@corevo.se>` | Faller tillbaka på default |
| `CRON_SECRET` | Bearer-secret som skyddar `app/api/cron/reminders` | Endpoint stängd (401) — inga påminnelser |

Relaterat (befintligt): `SUPABASE_SERVICE_ROLE_KEY` krävs av påminnelse-pipen
(`reminders.ts` kör service-role, cross-tenant). `SENTRY_DSN` (valfritt) för
fel-rapportering. Alla degrade:ar till no-op lokalt/CI när de saknas.
