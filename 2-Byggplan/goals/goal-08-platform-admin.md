## Goal 08 — Platform Admin M7

**Spår:** E · **Beror på:** G02 · **Modul:** M7 (Platform Admin)

**Mål:** Corevo-personal (platform_admin) hanterar hela plattformen: skapa/administrera tenants (salonger), planer/status, översikt och support — separat från tenant-data.

**Kontext:** G02 (DB/RLS, `tenants`, `profiles`, platform_admin-bypass-policy) klar. Kan byggas parallellt med M2/M3 eftersom det jobbar på tvär-tenant-data via platform_admin-policy.

**Omfattning (bygg detta):**
- Separat skyddad yta `app/(platform)/...` på egen route/subdomän (t.ex. `admin.corevo.app`), kräver role=platform_admin.
- Tenant-hantering:
  - Lista alla tenants (sök, filter på plan/status).
  - Skapa ny tenant (slug, namn, plan, custom_domain) + bjud in första salon_admin.
  - Redigera plan/status (active/suspended), avsluta.
- Översikt/metrics: antal tenants, bokningar totalt, aktiva salonger.
- Support: "impersonate/visa som" eller åtminstone read-only insyn i en tenant (loggat i `audit_log`).
- Plattforms-branding (Corevo eget — här FÅR Corevo-varumärket synas).

**Utanför scope:**
- Tenant-intern drift (det är G07).
- Stripe-utbetalningar/Connect-flöde (G09); men plan/pris-koppling kan förberedas.
- Fakturering av tenants (senare).

**Berörda områden/filer:** `5-Kod/app/(platform)/`, `5-Kod/components/platform/`, `5-Kod/lib/platform/`.

**Steg:**
1. Route-grupp `(platform)` med strikt role=platform_admin-check + egen host-routing.
2. Tenant-lista + sök/filter (läser tvärs tenants via platform_admin RLS-policy/service-role).
3. Skapa-tenant-flöde (transaktion: skapa `tenants` + invite salon_admin).
4. Redigera plan/status.
5. Metrics-dashboard.
6. Read-only tenant-insyn + audit-loggning.
7. `pnpm build` + lint.

**Verifieras (DoD):**
- platform_admin kan skapa en ny tenant som sedan är bokningsbar (M2/M3 funkar för den).
- Lista visar alla tenants; vanlig salon_admin når INTE `(platform)`-ytan.
- Suspendera tenant → publika sajten blockeras/visar suspended.
- Insyn i tenant loggas i `audit_log`.
- `pnpm build` grön.

**Tekniska noter:**
- Tvär-tenant-läsning: använd platform_admin RLS-bypass-policy (från G02) ELLER service-role i server-Actions med extra role-guard. Föredra RLS-policy för spårbarhet.
- Host-separation: `(platform)` ska inte vara nåbar via tenant-domäner — gör host-check i middleware.
- Allt platform_admin-agerande på tenant-data → skriv `audit_log`.
- Suspended tenant: `tenants.status` läses av M2-resolver (G03) och blockerar publik åtkomst.
