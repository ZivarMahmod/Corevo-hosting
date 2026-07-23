# Goal 77 — lokal kontroll av mallbyte

Körs mot Supabase-previewbranchen `localhost-acceptance`, aldrig produktion.

## En kontroll

1. Öppna en testkunds **Sida** i superadmin och skriv en tydlig unik hero-rubrik.
2. Välj en annan mall och **Behåll nuvarande innehåll**. Kontrollera att previewen
   visar den unika rubriken och publicera. Den publika previewen ska visa samma rubrik.
3. Byt till ytterligare en mall och välj **Använd mallens innehåll**. Kontrollera att
   previewen visar den nya mallens egen rubrik och publicera. Den publika previewen ska
   visa exakt samma rubrik.
4. Kontrollera snabbt att kontaktuppgifter, bokningsläge och aktiva moduler är oförändrade.

Godkänt när båda mallbytena fungerar utan att någon produktionsmiljö används.

## Resultat 2026-07-23

Godkänd mot `localhost-acceptance`.

- Leander → Källa, **Behåll nuvarande innehåll**: unik kundrubrik följde med.
- Källa → Snitt, **Använd mallens innehåll**: Snitts “Hår med kant.” tog över.
- Publicera var spärrad tills ett av de två innehållsvalen hade gjorts.
- Kontakt och moduler var oförändrade.
