# M6 – Salon Admin

> Källa: "Salon Admin Module.pdf"

## 1. Syfte
Salongsägarens kontrollcenter. Dashboard med affärsmått, hantering av personal, tjänster, kunder,
bokningar och salonginställningar. Detta är navet som matar data till de andra modulerna.

## 2. Funktioner – v1 vs senare

| Funktion | v1? | Not |
|----------|-----|-----|
| Dashboard (intäkter idag, kommande bokningar, utnyttjande) | Ja | Realtidsmått |
| Personalhantering (lägg till/ta bort, roller, provision) | Ja | CRUD `staff` |
| Tjänstekatalog (CRUD, priser, varaktighet, kategorier) | Ja | CRUD `services` |
| Kunddatabas (åtkomst) | Ja | Läser `customers` |
| Bokningsöversikt (alla bokningar) | Ja | |
| Salonginställningar (policy, avbokning, deposit, öppettider) | Ja | `salon_settings` |
| Avancerad analys / rapporter | Nej | v2 |
| Marknadsföringskampanjer, automatiserad marknadsföring | Nej | v2 |
| Lagerhantering, lönesystem | Nej | v2 |
| Multi-location | Nej | v2 |
| Custom branding (white-label) | Nej | v2 |

## 3. Vyer / sidor som ska byggas
- `/admin` – Dashboard
- `/admin/calendar` – Hela salongens kalender
- `/admin/staff` – Personalhantering
- `/admin/services` – Tjänstekatalog
- `/admin/customers` – Kunddatabas
- `/admin/bookings` – Alla bokningar
- `/admin/settings` – Salonginställningar
- `/admin/reports` – Rapporter (**v2**)

## 4. Datatabeller modulen rör
Nya / centrala (ägs av denna modul):
- `salons` (huvud-tenant: owner_id, name, slug, brand_colors, timezone, subscription_tier)
- `services` (name, category, duration, price, is_active)
- `salon_settings` (booking_policy, cancellation_window, deposit, business_hours, social_links)
Administrerar även: `staff`, läser `customers`, `bookings`

## 5. API-endpoints
Dashboard:
- `GET /api/admin/dashboard`, `GET /api/admin/analytics`
Personal:
- `GET|POST /api/admin/staff`, `PATCH|DELETE /api/admin/staff/:id`
Tjänster:
- `GET|POST /api/admin/services`, `PATCH|DELETE /api/admin/services/:id`
Inställningar:
- `GET|PATCH /api/admin/settings`

## 6. Beroenden
- Levererar `salons`, `services`, `salon_settings`, `staff` → **M2, M3, M5** beror på dessa
- Bokningsöversikt → **M3 Bokningsmotor**
- Personalscheman → **M5 Personalportal**
- Stripe Connect (payouts, prenumeration)
- Tenant-konfig från **M7 Platform Admin**

## 7. Definition of Done
- [ ] Dashboard med live-mått
- [ ] Personal-CRUD
- [ ] Tjänstekatalog-hantering
- [ ] Kunddatabas-åtkomst
- [ ] Bokningsöversikt
- [ ] Inställningskonfiguration
- [ ] Mobilresponsiv
- [ ] Prestandamål uppnådda (dashboard < 2s, CRUD < 1s)

## 8. Öppna frågor
1. M6 äger `salons`/`services` men M7 provisionerar tenants – var skapas salongen först (onboarding-flödet)?
2. Vilka mått i v1-dashboarden kräver aggregering vs live-query (prestanda)?
3. Brand_colors i v1 – används de redan av M2 publik sajt eller är white-label v2?
