## Goal 05 — Kundportal M4

**Spår:** C · **Beror på:** G04 · **Modul:** M4 (Kundportal)

**Mål:** Inloggad kund kan se, om-/avboka sina tider, se historik och hantera sin profil — kopplat till bokningsmotorn (M3).

**Kontext:** G02 (DB/RLS), G04 (bokningsmotor + `createBooking`) klara. Supabase Auth finns från G01. `profiles.role='customer'`.

**Omfattning (bygg detta):**
- Kund-auth: registrering/inloggning (e-post + lösenord och/eller magic link) via Supabase Auth; skapa/koppla `profiles`-rad med role=customer + `tenant_id`.
- Skyddade routes `app/(customer)/konto/...` (kräver session + role=customer).
- Vyer:
  - "Mina tider" (kommande + tidigare bokningar för tenant).
  - Bokningsdetalj med av-/ombokning (respekterar tenant-regler/tidsgräns).
  - Profil (namn, telefon, e-post).
- Koppling: när inloggad kund bokar via M3 sätts `customer_profile_id` automatiskt.
- Om-/avboknings-Actions som frigör slot (statusändring + krockfrigöring).

**Utanför scope:**
- Betalning/återbetalning (G09).
- Personal-/admin-vyer.
- Notiser (e-post/SMS stubbas, G10).

**Berörda områden/filer:** `5-Kod/app/(customer)/`, `5-Kod/app/(auth)/`, `5-Kod/lib/auth/`, `5-Kod/components/customer/`.

**Steg:**
1. Bygg auth-sidor (login/register/magic link) med `@supabase/ssr`; säkerställ tenant-koppling vid signup.
2. Skapa skyddad layout `(customer)` som kräver session + role-check (annars redirect).
3. Bygg "Mina tider", bokningsdetalj, profil.
4. Implementera om-/avboknings-Actions (med tidsgräns-regel per tenant).
5. Koppla inloggad kund till M3-bokningsflödet.
6. `pnpm build` + lint.

**Verifieras (DoD):**
- Kund kan registrera sig, logga in, se sina bokningar (endast egna, RLS-bevis).
- Av-/ombokning ändrar status och frigör slotten (ny bokning på samma tid möjlig).
- Kund från tenant A ser inte tenant B:s data.
- Oinloggad åtkomst till `/konto/*` → redirect till login.
- `pnpm build` grön.

**Tekniska noter:**
- RLS: kund får endast `select/update` egna bokningar (`customer_profile_id = current_profile_id()` inom tenant).
- Auth callback-route för magic link/email confirm enligt App Router-mönster.
- Avbokningsregel (t.ex. min X h innan) konfigureras per tenant; läs från `tenants`-inställning.
- Återanvänd `createBooking`-krocklogik från G04 vid ombokning.
