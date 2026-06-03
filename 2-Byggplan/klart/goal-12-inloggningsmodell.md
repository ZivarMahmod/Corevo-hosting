## Goal 12 — Inloggningsmodell: back-office vs storefront

**Spår:** Struktur · **Beror på:** G07/G08/G11 · **Modul:** routing/auth (tvärsnitt)

**Beslut (Zivar 2026-06-01 — "klart och redo"):** dela appen i två zoner efter publik. Back-office (personal) loggar in på `booking.corevo.se`. Storefront (kund) bor på salongens egen värd (`frisorN.corevo.se` nu, egen domän senare).

**Mål:**

1. **Ren plattform-URL.** Middleware-rewrite: för plattform-värden (`booking.corevo.se`) serveras `(platform)`-gruppen på ROTEN. `booking.corevo.se` = dashboard; `/salonger`; `/fakturering`. Inget `/platform` i URL:en.

2. **Enad back-office-inlogg på `booking.corevo.se`.** super_admin, salon_admin OCH staff loggar in här. **Tenant + roll kommer från det inloggade kontot (`tenant_id` i JWT app_metadata), INTE från värden.** Route:a på roll efter login:
   - super_admin → plattform-dashboard (alla salonger)
   - salon_admin → SIN salongs admin (tjänster, personal, scheman, varumärke, Stripe-koppling)
   - staff → sitt schema + frånvaro

3. **Storefront på tenant-värden.** `frisorN.corevo.se` servar ENBART publik sajt + `/boka` + kund-konto (`/konto`). Tenant = värden (subdomän) som idag. Kundens "logga in"-flik → sin profil + bokningar; visas bara om ägaren slagit på kundkonton (tenant-setting `customer_accounts_enabled`).

4. **Flytta** salon_admin- + staff-ytorna FRÅN tenant-värden (`frisorN.corevo.se/admin|/personal`) TILL `booking.corevo.se`. Tenant-värden slutar servera back-office.

**Två tenant-källor (kärnan):**
- back-office (`booking.corevo.se`) → tenant från KONTO.
- storefront (`frisorN.corevo.se`) → tenant från VÄRD.

**Samma data:** bokning skapad på storefront (tenant=X) → syns i ägarens + anställds back-office (RLS scopar till X). Samma rader, ingen extra koppling.

**Antagande v1:** ett konto = en tenant (super_admin = plattform). Multi-tenant-konto = senare.

**Utanför scope:** custom-domän-resolution (freshcut.se), `booking.freshcut.se`-inloggningssubdomän, design. Bygg mot `frisor1`/`frisor2`.

**OBS frysta filer:** `middleware.ts` + `lib/tenant.ts` ÄR kärnan här — ändras MEDVETET i denna goal (inte parallellt med annat).

**Steg:**
1. Middleware: host=plattform → rewrite `/` → `(platform)`-root; ta bort `/platform`-prefix.
2. Back-office-auth: efter login läs `tenant_id`+roll ur session → route super/salon/staff; salon_admin/staff scopas till kontots tenant.
3. Flytta `(salon)`+`(staff)` så de nås på plattform-värden via konto-tenant; ta bort dem från tenant-värd.
4. Storefront: tenant-värd servar bara `(public)`+`(booking)`+`(kund)`. Kund-login-flik villkorad på `customer_accounts_enabled`.
5. Uppdatera E2E: 3 back-office-login-flöden (super/salon/staff) + storefront-kund-flöde. `pnpm build`+lint+test gröna.

**Verifieras (DoD):**
- `booking.corevo.se` = plattform-dashboard på roten; `/salonger`, `/fakturering` rena (inget `/platform`).
- Ägar-konto loggar in på `booking.corevo.se` → ser SIN salongs admin (ej andras). Anställd → bara sitt schema. super_admin → alla.
- `frisor1.corevo.se` servar publik + `/boka` + kund-login; INTE admin/personal.
- Bokning på `frisor1.corevo.se` → syns i ägarens + anställds back-office.
- RLS: konto-tenant når ej annan salongs data. `pnpm build` grön.

**Rapportera KLAR + STANNA.** Nörden verifierar + flyttar till `_klart/`.
