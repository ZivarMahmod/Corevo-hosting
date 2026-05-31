# M7 – Platform Admin

> Källa: "07-platform-admin-module.pdf"

## 1. Syfte
Masterkontrollcenter för hela Corevo-plattformen. Hanterar alla salong-tenants, prenumerationer,
fakturering (Stripe) och plattformsövergripande drift. Plattformsägarens vy.

## 2. Funktioner – v1 vs senare

| Funktion | v1? | Not |
|----------|-----|-----|
| Tenant-hantering (granska, godkänn/avslå, provisionera) | Ja | Onboarding m. godkännande |
| Prenumerationshantering (tiers, upp/nedgradering) | Ja | starter/pro/enterprise |
| Fakturering via Stripe (failed payments) | Ja | Stripe webhook |
| Plattformsanalys (total intäkt, aktiva salonger, MRR/ARR, churn) | Ja | |
| Audit-logg | Ja | |
| Multi-tenant-isolering (RLS) | Ja | Supabase RLS |
| Automatiserad provisionering | Nej | v2 |
| Avancerade faktureringsregler | Nej | v2 |
| White-label reseller-program | Nej | v2 |
| API-åtkomsthantering, custom integrations | Nej | v2 |
| SLA-monitorering, multi-currency | Nej | v2 |

## 3. Vyer / sidor som ska byggas
- `/platform` – Dashboard
- `/platform/tenants` – Salonghantering
- `/platform/tenants/[id]` – Tenant-detalj
- `/platform/subscriptions` – Fakturering
- `/platform/analytics` – Plattformsmått
- `/platform/audit` – Audit-logg
- `/platform/settings` – Plattformskonfig

## 4. Datatabeller modulen rör
Nya / centrala:
- `platform_admins` (extends auth.users: role admin/super_admin)
- `subscriptions` (salon_id, stripe_subscription_id, tier, status, current_period_end)
- `platform_metrics` (aggregerat: total_salons, active_salons, total_revenue, total_bookings, mrr)
- `audit_log` (admin_id, action, entity_type, entity_id, details JSONB)
Administrerar: `salons` (provisionering, suspendering)

## 5. API-endpoints
Tenants:
- `GET /api/platform/tenants`, `POST /api/platform/tenants` (skapa/godkänn)
- `PATCH /api/platform/tenants/:id`
- `POST /api/platform/tenants/:id/suspend`
Prenumerationer:
- `GET /api/platform/subscriptions`, `PATCH /api/platform/subscriptions/:id`
- `POST /api/platform/billing/webhook` (Stripe)
Analys:
- `GET /api/platform/metrics`, `GET /api/platform/revenue`

## 6. Beroenden
- Provisionerar/överser **alla moduler** (skapar `salons`-tenant)
- Stripe Connect (prenumerationer, payouts, webhooks)
- Supabase RLS-policies (tenant-isolering)
- Cloudflare (subdomän-provisionering → matar **M2**)
- `subscription_tier` på `salons` delas med **M6 Salon Admin**

## 7. Definition of Done
- [ ] Tenant-hantering (CRUD)
- [ ] Prenumerationshantering
- [ ] Stripe-faktureringsintegration
- [ ] Plattformsanalys-dashboard
- [ ] Audit-loggning
- [ ] Multi-tenant-isolering (RLS)
- [ ] Mobilresponsiv
- [ ] Prestandamål uppnådda (dashboard < 3s, tenant-åtgärder < 2s)

## 8. Öppna frågor
1. Onboarding: self-service med godkännande vs admin skapar manuellt – exakt flöde i v1?
2. Provisionering i v1 manuell (PDF flaggar "automatiserad" som v2) – vilka steg görs för hand?
3. Stripe Connect-modell: plattformsavgift per bokning, ren prenumeration, eller båda?
