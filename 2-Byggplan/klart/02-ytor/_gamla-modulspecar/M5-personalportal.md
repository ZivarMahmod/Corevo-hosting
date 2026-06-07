# M5 – Personalportal (Staff Portal)

> Källa: "Staff Portal Module.pdf"

## 1. Syfte
Personalens arbetsyta: egen kalender, tillgänglighet, hantera dagens bokningar och se klientinfo.
Varje anställd ser bara sitt eget schema.

## 2. Funktioner – v1 vs senare

| Funktion | v1? | Not |
|----------|-----|-----|
| Personlig kalendervy (dag/vecka) | Ja | Bara egen kalender |
| Tillgänglighetsinställningar (arbetstider, raster) | Ja | Styr bokningsbarhet |
| Bokningsdetaljer (klientinfo, tjänst, anteckningar) | Ja | |
| Markera klar / no-show | Ja | |
| Checkout/betalning vid bokning | Ja | |
| Klientprofiler (historik, preferenser, lojalitet) | Ja | |
| Intäkter/provision (earnings) | Nej | v2 |
| Prestandaanalys, klientmeddelanden, dricks | Nej | v2 |
| Skiftbyte, målsättning | Nej | v2 |

## 3. Vyer / sidor som ska byggas
- `/staff` – Dashboard (dagens schema)
- `/staff/calendar` – Kalendervy
- `/staff/appointments` – Bokningar
- `/staff/appointments/[id]` – Detalj
- `/staff/clients` – Klientlista
- `/staff/clients/[id]` – Klientprofil
- `/staff/availability` – Schemainställningar
- `/staff/earnings` – Intäkter (**v2**)

## 4. Datatabeller modulen rör
Nya / centrala:
- `staff` (extends auth.users: salon_id, namn, role, bio, photo, specialties, commission_rate, is_active)
- `staff_schedules` (day_of_week, start/end_time, is_working)
- `staff_time_off` (start/end_date, reason, status)
Läser: `bookings`, `customers`, `services`

## 5. API-endpoints
Schema:
- `GET|PATCH /api/staff/schedule`
- `POST|GET /api/staff/time-off`
Bokningar:
- `GET /api/staff/appointments`, `GET /api/staff/appointments/:id`
- `PATCH /api/staff/appointments/:id` (status/anteckningar)
- `POST /api/staff/appointments/:id/complete`
- `POST /api/staff/appointments/:id/no-show`
Klienter:
- `GET /api/staff/clients`, `GET /api/staff/clients/:id`
Intäkter (**v2**):
- `GET /api/staff/earnings`

## 6. Beroenden
- Tillgänglighet matar tidsslots → **M3 Bokningsmotor**
- Klientdata + recensioner → **M4 Kundportal**
- Schemaöversikt + provision → **M6 Salon Admin**
- `staff`-poster skapas/administreras av **M6 Salon Admin**
- Notifieringar för nya bokningar

## 7. Definition of Done
- [ ] Personlig kalendervy fungerar
- [ ] Tillgänglighetsinställningar funktionella
- [ ] Bokningsstatus uppdateras
- [ ] Klientprofiler åtkomliga
- [ ] Anteckningar och historik spåras
- [ ] Mobilresponsiv
- [ ] Prestandamål uppnådda (kalender < 2s, statusuppdatering < 1s)

## 8. Öppna frågor
1. Vem skapar staff-konton i v1 – M6-admin bjuder in, eller självregistrering?
2. Tidsledighet (`staff_time_off`): kräver godkännande av admin eller auto-approve i v1?
3. Checkout via personal vs kundens egen betalning i M3 – var sker betalningen primärt?
