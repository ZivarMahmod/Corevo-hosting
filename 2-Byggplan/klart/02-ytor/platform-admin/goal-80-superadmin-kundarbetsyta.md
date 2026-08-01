# Goal 80 — Superadminens kundarbetsyta

## Mål

Göra kundkortet och Sida-fliken användbara i localhost enligt det godkända
superadmin-paketet, utan att tappa någon befintlig funktion.

## Acceptans

- [x] Ett valt kundkort använder hela superadminens innehållsbredd; kundlistan
      visas inte samtidigt.
- [x] Tillbaka till kundlistan fungerar via `Kunder`.
- [x] Kundflikarna bryts över flera rader och alla befintliga flikar finns kvar.
- [x] Sida-studion använder exakt `400px/480px`, `16px`, sticky `78px` och
      previewhöjd `calc(100vh - 220px)` med minst `420px`.
- [x] Studion staplas innan kolumnerna blir smalare än designkontraktet.
- [x] Befintliga kundåtgärder, formulär och iframe-preview är kvar.
- [x] Riktade tester, typkontroll, lint, build och lokal browseracceptans är gröna.
- [x] Oberoende Fable 5-review har inga P0/P1.
- [x] Produktion är orörd.

## Verifierat

Verifieringsbevis och manuell testlista finns i
`6-Testing/goal-80-superadmin-kundarbetsyta-testlista.md`.

## Arbetsordning

1. Lägg kontraktstester som först visar nulägesfelet.
2. Rätta kundkortets arbetsyta.
3. Rätta flikrad och Sida-studio.
4. Verifiera automatiskt.
5. Verifiera visuellt i localhost mot Supabase-previewgrenen.
6. Oberoende review, rätta eventuella P0/P1 och arkivera först när allt är grönt.
