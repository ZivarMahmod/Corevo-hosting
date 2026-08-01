# Testlista — Goal 93

## Katalog

- [x] Designmanifest, valbar kodkatalog och preview-DB har exakt samma 12
  nyvalbara Corevo-nycklar; deprecated/legacy räknas separat.
- [x] Alla nycklar, owners, states, versioner och referenser valideras.
- [x] Vertical defaults och module defaults pekar bara på giltiga poster.
- [x] Okänd/framtida manifestversion avvisas fail-closed.
- [x] Deprecated är renderbar för befintlig tenant, inte nyvalbar, och har replacement.

## Mekanisk matris

- [x] Varje mall × deklarerad route × 1360/390 körs.
- [x] Full, tom/off och relevant paused-fixture finns.
- [x] 0 oväntat skippade fall.
- [x] Copy, hex, fonts, radius, routes och moduler matchar designfacit.
- [x] 0 console errors, hydration errors, 404 och horisontell overflow.
- [x] Tangentbord, fokus, namn, felkoppling, 44×44 och kontrast verifieras.
- [x] Axe har 0 serious/critical.
- [x] Screenshotbaselines uppdateras aldrig automatiskt.

## Bevis

- [x] Probe rapporterar expected/actual per katalog-, schema-, browser-, visual-
  och a11y-grind.
- [x] Probet misslyckas om mall, route eller viewport saknas.
- [x] Previewmigration och rollback ger förväntad katalogdiff.

## Samlad verifiering 2026-07-30

- [x] 376/376 mekaniska browserfall.
- [x] 12/12 verkliga previewteman.
- [x] 5/5 centrala kontrakt, 7/7 självtester och katalog-SQL.
- [x] CSS-synk, kontrastvakt, 397 testfiler/3 015 tester, typecheck, lint utan
  fel och build.
- [x] Användaraudit och regressioner för mobilnav samt Calytrix-footer.
