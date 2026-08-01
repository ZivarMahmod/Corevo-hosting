# Goal 78 — manuell testlista

Kör mot localhost som använder Supabase-previewbranchen `localhost-acceptance`.
Kör inte mot produktion.

1. Öppna kundkortet → **Drift** och sätt Bokning till **Av**.
2. Öppna **Sida → Bokning**, ange en fullständig extern `https://`-länk och spara.
3. Kontrollera previewns nav, hero, tjänster och avslutande CTA:
   alla Boka-länkar ska öppna exakt den externa adressen i en ny flik.
4. Kontrollera att `/boka` ger 404 när Bokning är Av.
5. Byt Bokning till **Live**. Samma CTA ska nu öppna Corevos bokningsdialog och
   den externa länken ska inte användas.
6. Byt Bokning till **Pausad**. CTA ska stanna inom Corevo och får inte använda
   den sparade externa länken.
7. Byt Bokning till **Utkast**. CTA ska vara inaktiv trots att extern länk finns.
8. Prova en `http://`-länk. Sparningen ska nekas med ett begripligt fel.
9. Töm extern länk och sätt Bokning till Av. CTA ska vara inaktiv, aldrig gå till
   `/boka`.

Automatiska kontrakt:

- `lib/platform/tenant-modules-write.test.ts`
- `lib/platform/public-module-states.contract.test.ts`
- `lib/platform/booking-external-url.test.ts`
- `components/storefront/booking-controls.test.tsx`
- `lib/admin/scoped-settings.test.ts`
