# Användaraudit — Goal 92–93

Datum: 2026-07-30
Miljö: `localhost-acceptance` (`cwnhpesrgolflkmyjbrm`)
Produktion: orörd

## Resultat

- Goal 92 är internt tekniskt grön. Fyra externa prov är blockerade av saknade
  sandbox-/runtimeförutsättningar.
- Goal 93 är tekniskt grön och kan ingå i Goal 86.
- Previewdatabasen var ren efter samtliga fixturekörningar.

## Granskade användarflöden

### Goal 92

- Publik offert skickades och nådde adminens offertinkorg.
- Intern offertanteckning sparades med synlig bekräftelse.
- Publik webshop lade produkt i varukorgen och behöll den efter reload.
- Adminsidorna Media, Offerter och Webshop renderade utan runtimefel.
- Mediadialogen kunde stängas med Escape.
- Webshopens formulär använde native validering.
- Mobil admin hade ingen oavsiktlig sidöverskridning; avsiktlig tabellscroll
  och menyn Mer var nåbara.

### Goal 93

- Full mekanisk desktop-/mobilmatris kördes för samtliga tolv teman.
- Verkliga previewrutter kördes för samtliga tolv teman.
- Aurora, Snitt, Sol & Salt och Calytrix kontrollerades extra i faktisk UI.
- Mobilmeny, öppna/stäng, Escape, formulärvalidering och horisontell overflow
  kontrollerades.

## Fynd och rättningar

1. Alla temans mobila headers kunde visa desktopnavigation eftersom temats
   klass vann CSS-kaskaden. Rotfix: en gemensam, tillräckligt specifik
   mobilregel i `nav-shell.module.css`. Regression körs för alla teman.
2. Calytrix renderade Kontakt både från länklistan och som hårdkodad footerpost.
   Den dubbla hårdkodningen togs bort och ett exakt räknartest lades till.
3. En sparad offertanteckning skapade korrekt append-only auditdata men avslöjade
   att E2E-teardown försökte kaskadradera den. Teardownen avaktiverar nu endast
   delete-triggern i en transaktion, endast för E2E-tenants, och återaktiverar
   den omedelbart.
4. Fullsviten visade ett föråldrat seedkontrakt som krävde direkt
   tenantaktivering. Testet kräver nu den verkliga `publish_tenant`-gränsen.
5. In-app-browserns isolerade lagring såg först ut som förlorad varukorg.
   Riktig Playwright-reload bevisade att produkten var korrekt; regressionen
   behölls.

## Verifieringsbevis

- Goal 92: 6/6 källkontrakt; fyra SQL-sviter; två concurrencyprov; 2/2
  browserflöden; teardown och renhetskontroll.
- Goal 93: 376/376 browserfall på 4,3 minuter; 12/12 runtimefall på 7,3
  minuter; total fullkörning 715,7 sekunder.
- Goal 93: 5/5 centrala kontrakt, 7/7 validatorsjälvtester, katalog-SQL,
  previewvalidator, CSS-synk och kontrastvakt med 0 brott.
- Hela kodbasen: 397 testfiler/3 015 tester, typecheck, lint med 0 fel och
  produktionsbuild.

## Externa Goal 92-blockerare

- `08-X01` Stripe sandbox credentials.
- `08-X02` PayPal sandbox credentials.
- `08-X03` R2 Worker-bindning i lokal preview.
- `08-X04` mottagande e-postsink.

Goal 86 kan starta för alla lokalt testbara flöden. Blockerarna ovan ska provas
separat när respektive extern miljö finns.
