# M3 – Bokningsmotor (Booking Engine)

> Källa: "Corevo Booking Platform Documentation.pdf"

## 1. Syfte
Plattformens kärnkonverteringstratt. Förvandlar webbplatsbesökare till betalande kunder via ett guidat
flerstegs-bokningsflöde med realtidstillgänglighet och Stripe-betalning.

## 2. Funktioner – v1 vs senare

| Funktion | v1? | Not |
|----------|-----|-----|
| Steg 1: Tjänsteval (multi-select, total tid/pris) | Ja | |
| Steg 2: Personalval ("vem som helst"-alternativ) | Ja | |
| Steg 3: Datum & tid (kalender, realtidsslots) | Ja | Hantera tidszon |
| Steg 4: Kunduppgifter (gäst-checkout + login) | Ja | Namn, e-post, telefon |
| Steg 5: Bekräftelse & betalning (Stripe) | Ja | Deposit eller full |
| Realtidstillgänglighet (mot dubbelbokning) | Ja | Slot-lås under checkout |
| E-post/SMS-bekräftelse | Ja | |
| Multi-service / combo-bokning | Ja | `booking_services` |
| Väntelista (waitlist) | Nej | v2 |

## 3. Vyer / sidor som ska byggas
Wizard i 5 steg (en flöde, `/boka`):
1. Service Selection
2. Staff Selection
3. Date & Time Selection
4. Customer Details
5. Confirmation & Payment

## 4. Datatabeller modulen rör
Nya / centrala:
- `bookings` (salon_id, customer_id, staff_id, service_id, datum, tid, status, belopp, payment_status)
- `booking_services` (multi-service: booking_id, service_id, staff_id, price)
- `availability_slots` (materialiserad för prestanda: staff_id, date, slot, is_available)
- `waitlist` (**v2**)
Läser: `salons`, `services`, `staff`, `customers`

## 5. API-endpoints
- `POST /api/bookings/create` → skapar bokning + tillgänglighetskoll, returnerar bokning + payment intent
- `GET /api/bookings/availability` → lediga slots (params: salonId, staffId?, serviceId, date)

## 6. Beroenden
- `services`, `staff`, `salons` → **M6 Salon Admin**
- `customers` + profil/historik → **M4 Kundportal**
- Personalens tillgänglighet matar tidsslots → **M5 Personalportal**
- Stripe Connect (betalning) → konfig via **M7 Platform Admin**
- Bokningsknapp kommer från **M2 Publik webbplats**

## 7. Definition of Done
- [ ] Alla bokningsstegen funktionella
- [ ] Realtidstillgänglighet fungerar
- [ ] Betalningsintegration klar
- [ ] E-post/SMS-bekräftelser skickas
- [ ] Mobilresponsiv
- [ ] Robust felhantering (dubbelbokning, betalfel, timeout, nätverksfel)
- [ ] Tester gröna
- [ ] Prestanda < 3s laddtid

## 8. Öppna frågor
1. Deposit-procent och avbokningsfönster – per salong (`salon_settings`) eller plattformsstandard?
2. SMS-leverantör (Twiilio/46elks) och kostnadsansvar i v1?
3. Slot-lås: hur länge hålls en slot under checkout innan release?
