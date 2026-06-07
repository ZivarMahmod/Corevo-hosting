# M4 – Kundportal (Customer Portal)

> Källa: "04-customer-portal-module.pdf"

## 1. Syfte
Självbetjäningshubb där salongens kunder hanterar hela sin relation med salongen: boka, ombokningar,
historik och lojalitet. App-lik upplevelse. Minskar adminbörda ~60 % och ökar återköp.

## 2. Funktioner – v1 vs senare

| Funktion | v1? | Not |
|----------|-----|-----|
| Magic link-login (lösenordsfritt) | Ja | E-postlänk |
| Progressiv profil (fyll i över tid) | Ja | |
| Smart dashboard (nästa bokning, snabb-omboka, poäng) | Ja | |
| Kommande bokningar (omboka, avboka, kalender, vägbeskrivning) | Ja | Omboka/avboka enl. policy |
| Bokningshistorik (omboka tidigare, kvitton) | Ja | |
| Lojalitetspoäng (visning) | Ja | tier bronze osv. |
| Favoriter (tjänster/personal) | Ja | |
| Recensioner (lämna betyg) | Ja | |
| Sparade betalmetoder (Stripe) | Nej | v2 |
| Push-notiser | Nej | v2 |
| Referral, presentkort, prenumerationspaket | Nej | v2 |
| Multi-salongsprofil, in-app-meddelanden | Nej | v2 |

## 3. Vyer / sidor som ska byggas
- `/portal` – Dashboard
- `/portal/appointments` – Bokningslista
- `/portal/appointments/[id]` – Detalj
- `/portal/history` – Bokningshistorik
- `/portal/profile` – Profilinställningar
- `/portal/loyalty` – Lojalitet & belöningar
- `/portal/favorites` – Sparade tjänster/personal
- `/portal/login` – Magic link-login

## 4. Datatabeller modulen rör
Nya / centrala:
- `customers` (extends auth.users: salon_id, namn, telefon, födelsedatum, preferences JSONB)
- `loyalty_points` (points, lifetime_points, tier)
- `customer_favorites` (favorite_type, favorite_id)
- `reviews` (booking_id, rating 1–5, comment)
- `notification_preferences`, sparade kort → **v2**
Läser: `bookings`, `services`, `staff`

## 5. API-endpoints
Auth:
- `POST /api/auth/magic-link` → skicka länk
- `POST /api/auth/verify` → verifiera token
- `POST /api/auth/logout`
Profil:
- `GET|PATCH /api/customer/profile`
- `GET /api/customer/loyalty`
- `GET|POST /api/customer/favorites`, `DELETE /api/customer/favorites/:id`
Bokningar:
- `GET /api/customer/appointments`, `GET /api/customer/appointments/:id`
- `POST /api/customer/appointments/:id/cancel`
- `POST /api/customer/appointments/:id/reschedule`
- `GET /api/customer/appointments/history`

## 6. Beroenden
- `bookings` + bokningsflöde (omboka/nyboka) → **M3 Bokningsmotor**
- `staff` + recensioner → **M5 Personalportal**
- Stripe sparade kort → **v2**
- E-post/SMS-påminnelser (notifikationstjänst)

## 7. Definition of Done
- [ ] Magic link-auth fungerar
- [ ] Dashboard visar alla kort
- [ ] Bokningshantering (avboka/omboka)
- [ ] Bokningshistorik med omboka
- [ ] Lojalitetspoäng visas
- [ ] Favorithantering
- [ ] Recensioner kan lämnas
- [ ] Mobilresponsiv
- [ ] Prestandamål uppnådda (dashboard < 2s, åtgärder < 1s)

## 8. Öppna frågor
1. Hur tjänas/beräknas lojalitetspoäng (regler) – och var sätts de, M4 eller M6?
2. Avboknings-/ombokningsregler: läses från `salon_settings` (M6) eller hårdkodat i v1?
3. Recensioner: synliga publikt på M2 i v1 eller bara internt?
