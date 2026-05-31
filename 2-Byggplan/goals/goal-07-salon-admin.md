## Goal 07 — Salon Admin M6

**Spår:** D · **Beror på:** G04 · **Modul:** M6 (Salon Admin)

**Mål:** Salongsägare (salon_admin) hanterar hela sin salong: tjänster/priser, personal, öppettider, white-label-branding, salonginställningar och översikt över alla bokningar.

**Kontext:** G02 (DB/RLS, alla kärntabeller), G04 (bokningsmotor) klara. Auth-mönster från G05/G06 finns (role=salon_admin). R2-binding finns från G01 för bilduppladdning.

**Omfattning (bygg detta):**
- Skyddad layout `app/(admin)/...` (session + role=salon_admin), scoped till egen tenant.
- CRUD:
  - **Tjänster** (`services`): namn, varaktighet, pris, kategori, aktiv.
  - **Personal** (`staff` + `profiles`): bjud in/lägg till, koppla `staff_services`, aktivera/avaktivera.
  - **Öppettider/scheman** per personal (`working_hours`).
- **Branding/white-label:** logo (R2-uppladdning), primary_color, tema → `tenants.brand`.
- **Salonginställningar:** namn, kontakt, avbokningsregler, tidszon, custom_domain (visa).
- **Bokningsöversikt:** alla bokningar i tenant (filtrera datum/personal/status), manuell statusändring.
- Enkel dashboard: dagens/veckans bokningar, intäkt (om payments finns).

**Utanför scope:**
- Plattformsövergripande admin (G08 = M7).
- Stripe-onboarding-UI (G09 lägger till, men knappen kan stubbas här).
- Avancerad rapport/analytics (senare).

**Berörda områden/filer:** `5-Kod/app/(admin)/`, `5-Kod/components/admin/`, `5-Kod/lib/r2/` (uppladdning), `5-Kod/app/(admin)/installningar/`.

**Steg:**
1. Skyddad `(admin)`-layout, role=salon_admin.
2. Bygg `lib/r2/upload.ts` för bilduppladdning till R2 (presigned eller via Worker).
3. CRUD för tjänster, personal (+staff_services), working_hours.
4. Branding-formulär (logo→R2, färg, tema) → `tenants.brand`; verifiera att M2/M3 plockar upp ändringen.
5. Salonginställningar (inkl. avbokningsregel som M4 läser).
6. Bokningsöversikt med filter + statusändring.
7. Dashboard. `pnpm build` + lint.

**Verifieras (DoD):**
- salon_admin kan skapa en tjänst → den dyker upp i M2/M3 direkt.
- Ändra branding (logo+färg) → M2 publik sajt visar nytt utseende.
- Lägg personal + koppla tjänst → bokningsbar i M3.
- Admin ser alla tenant-bokningar men inte annan tenants (RLS).
- Bilduppladdning till R2 fungerar och URL sparas.
- `pnpm build` grön.

**Tekniska noter:**
- RLS: salon_admin har full CRUD inom egen `tenant_id`, inget tvärs tenants.
- R2: ladda upp via server (service-side credentials) eller presigned PUT; spara publik URL i DB. Aldrig exponera R2-secrets mot klient.
- Branding-cache: invalidate M2-tenant-cache vid spar (revalidateTag).
- custom_domain-ändring kräver DNS/CF-routing — visa instruktion, faktisk koppling hanteras i G08/ops.
