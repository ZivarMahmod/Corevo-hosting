# Modul: Orderstatus (orderstatus)

> En fil per modul. Följer `10-arkitekturprincip-universal-vs-variant.md`. Status: 🆕 **NY MODUL** (finns EJ i DB — kräver tabell + RLS + `modules`-rad). Korsref: **inlamning** (`intake_items` matar in) + **booking** (status-historik finns). DB-sanning §0/§7.2/§8. Schema bara på Zivars go.

## 1. Kärna (universell)
Statusspårning av inlämnat/påbörjat arbete: **mottagen → under arbete → klar för hämtning**. Ägaren flyttar status i admin → kunden följer den i Mitt konto + får **notis (SMS/mail)** vid statusbyte. EN tabell `work_orders` (NY), kopplad till en inlämning (`intake_items`) eller bokning. EN modul, varianter (idag samma trestegskedja för verkstad/skräddare, men kedjan ska vara config). defaultPos = `konto` (ingen publik sida).

## 2. Universal vs variant — beslut + axlar
**NY modul (egen tabell), universell + togglad** — inte verkstads-specifik kod. Ett "jobb med statuskedja + notis" är en egen modell (inte booking, inte inlämning) → egen tabell `work_orders`.
- **`variant_schema`** (förslag): `stages` (ordnad lista, config) — default `["mottagen","under_arbete","klar_for_hamtning"]`. Branschen kan ge fler/andra steg utan ny modul. `notify` (enum/flaggor): `sms` | `mail` | `both` | `none`.
- **`verticals.terminology`** kan byta stegens etiketter.
- **`tenant_modules.config`**: stegdefinition, notiskanal, notistext-mall per steg.
- **Notis** = en sidoeffekt (edge-function/worker), inte en kolumn. Återanvänd plattformens mejl (one.com SMTP, se MEMORY) + SMS via **46elks**.

## 3. Per bransch
| Bransch | variant-val | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Bilverkstad 🌱 | stages=mottagen→under arbete→klar; notify=sms | Stegindikator i Mitt konto; admin "Nästa steg"-knapp | Ofta startad via **offert** (fel+bild) → booking/drop-off → work_order → SMS "klar för hämtning" | Kund vill veta när bilen är klar utan att ringa; SMS är normen i verkstad |
| Skräddare 🌱 | stages=mottagen→under arbete→klar; notify=sms/mail | Samma trestegskedja | Startad via **inlämning** (plagg + kvittonr) → work_order → notis när klar | Plagg lämnas in, kund hämtar; spårning + avisering |
| (Verkstad/elektronik-reparation, framtid) | stages=config | Ev. fler steg (väntar på del → reparerar → testad → klar) | Samma motor, längre kedja | Längre reparationsflöden behöver fler steg — config, ej ny modul |
| Alla andra branscher | (off) | — | — | Inget inlämnat arbete att spåra |

## 4. DB-form (NY)
**Förslag `public.work_orders`** (ej skapad):
- `id` uuid PK · `tenant_id` uuid NOT NULL FK→tenants · `customer_id` uuid FK→customers (set null)
- `intake_item_id` uuid FK→intake_items (set null) · `booking_id` uuid FK→bookings (set null) — work_order föds ur en inlämning ELLER en bokning
- `reference` text — visningsreferens (kan spegla intake_items.receipt_no)
- `status` text NOT NULL CHECK in (mottagen, under_arbete, klar_for_hamtning [, hamtad/closed]) — eller fri text validerad mot config-stages
- `notify_channel` text (sms / mail / both / none) · `note` text (intern)
- `created_at` · `updated_at`
- **Statushistorik:** egen tabell `work_order_status_history` ELLER återanvänd mönstret från booking (`record_booking_status_change()` + `booking_status_history` finns redan, §8) — bygg analogt: trigger loggar varje statusbyte (vem, när, från→till).

**RLS** (mönster ur 0033/offert): `for all to authenticated using/with check (tenant_id = private.tenant_id() OR is_platform_admin())`. Kund ser bara egna work_orders (`customer_id = current_customer_id()`), som bookings (§4.3). **Ingen anon-policy** (konto-yta, ej publik). Notis-utskick via SECURITY DEFINER / edge-function (service-roll), inte anon.

## 5. Två ytor — Storefront + Admin
- **Storefront/Mitt konto** (design `super-admin/preview.jsx` → ModOrderstatus): horisontell stegindikator (Mottagen / Under arbete / Klar för hämtning) med aktivt steg markerat. Ingen publik sida — kunden ser sin egen order. MODULE_FACE sf: *"Kunden följer statusen på sitt inlämnade jobb."*
- **Admin** (design `kund-admin/surfaces-more.jsx` → `Orderstatus`): lista av jobb (referens-nr + vad + status-badge) med **"Nästa steg"**-knapp som flyttar status; not "Konto-modul. Du flyttar status → kunden följer det i sitt Mitt konto. Ingen publik sida." MODULE_FACE adm: *"Ägaren flyttar status: mottagen → under arbete → klar."* Vid statusbyte → trigga notis.

## 6. Verklighets-koll
- **SMS-notis (46elks, svensk leverantör):** skicka via API; sätt `whendelivered`-webhook → 46elks POST:ar tillbaka leveransstatus (`delivered`/`failed`) → logga utfall. Meddelanden som ej får plats i en SMS-del **delas upp och debiteras per del** → håll notistexten kort (referens + status + ev. hämtinfo) för att hålla nere kostnad. Betala per skickad del, fakturerbart.
- **Mail-notis:** plattformen har redan egen SMTP (one.com, `booking@`, se MEMORY) → återanvänd; pusha aldrig Resend som tvång.
- **Mönster finns redan:** booking har `record_booking_status_change()` + `booking_status_history` + `tenant_modules_state_guard()` (§8) — work_orders ska byggas **analogt**, inte uppfinna nytt. Statusbyten append-only-loggas.
- **Lätt missat:** idempotent notis (skicka inte dubbelt vid retry); kundens samtycke/val för SMS vs mail (GDPR — kontaktuppgift för avisering); telefonnr-format (E.164 för 46elks); vad "klar för hämtning" → "hämtad" gör (stäng work_order); koppling tillbaka till intake_items-status så kvittot och ordern är i synk.

## 7. Status idag vs bygg
- **Finns:** inget i DB (ingen `work_orders`). Design-mockup (ModOrderstatus, admin `Orderstatus`, MODULE_FACE, cfg-data variants bilverkstad/skraddare). Booking-status-historik-mönstret finns att kopiera (§8).
- **Bygg (fas D, per riktig kund):** migration `work_orders` (+ history-trigger analogt med booking) + RLS + config-driven stages + storefront-stegindikator + admin "Nästa steg" + **notis-edge-function** (46elks SMS + one.com mail, idempotent, delivery-webhook). Bygg **tillsammans med inlamning** (for_work föder work_order).

## 8. Öppna beslut för Zivar
1. **Status-historik:** egen `work_order_status_history` eller generalisera booking-historikmönstret till en gemensam tabell? (Rekommendation: analog egen tabell, samma trigger-mönster.)
2. **Notiskanal default:** SMS (46elks, kostar/del) vs mail (gratis via egen SMTP) som standard — och vem betalar SMS (per-tenant billing-hook)?
3. **Stages config-driven från start** eller hårdkoda trestegskedjan v1 och generalisera senare? (Backlog säger fast kedja; principen säger config.)
4. **"Hämtad"/closed-steg:** lägga till ett avslutssteg + auto-stäng, eller stanna på "klar för hämtning"?
5. **Samtycke för avisering:** måste kunden aktivt välja SMS/mail (GDPR), eller räcker att de lämnat kontaktuppgift vid inlämning/bokning?

## 9. Källor
- 46elks, *Sending SMS* (whendelivered-webhook, leveransstatus delivered/failed, message splitting/debitering per del): https://46elks.com/guides/sending-sms · https://46elks.se/
- Internt: DB-sanning §8 (`record_booking_status_change`, `booking_status_history`, `tenant_modules_state_guard`) + §4 (RLS, current_customer_id); MEMORY *Mejl på Workers + Supabase via egen SMTP* (one.com, ej Resend-tvång); `cfg-data.js` (MODULES.orderstatus, MODULE_FACES.orderstatus); `preview.jsx` (ModOrderstatus); `kund-admin/surfaces-more.jsx` (Orderstatus); `09-modul-bransch-spec-backlog.md`. Korsref: `moduler/inlamning.md`, `moduler/booking.md`.
