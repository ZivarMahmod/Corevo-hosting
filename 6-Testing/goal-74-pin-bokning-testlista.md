# Goal-74 — manuell testlista för PIN-bokning

Kör först i staging med en verklig tenant, verklig tjänst, verklig personal och
en ledig tid. Produktion och skarpt SMS kräver separat godkännande.

## A. E-postfallback utan modem

- [ ] Lämna `GIADA_SMS_API_KEY` osatt eller gör Giada offline.
- [ ] Öppna bokningssidan i ett nytt privat fönster.
- [ ] Kontrollera att kontaktsteget visar **e-post**, inte mobilnummer.
- [ ] Välj tjänst, personal och tid; fyll namn och en e-postadress.
- [ ] Kontrollera att bokningen ännu inte finns i admin/databasen.
- [ ] Tryck fortsätt och kontrollera att mejlet med sexsiffrig PIN kommer direkt.
- [ ] Skriv fel PIN: ingen bokning ska skapas och återstående försök ska minska.
- [ ] Skriv rätt PIN: exakt en bokning ska skapas och bekräftelsen ska komma direkt.
- [ ] Kontrollera att bokningen syns på rätt tid i kundadmin och att tiden försvinner
      från den publika listan.
- [ ] Tryck Bekräfta igen med samma challenge om klienten tillåter det: ingen
      dubbelbokning eller andra outboxrad får skapas.

## B. Hold, resend och utgång

- [ ] Starta PIN men slutför inte. Öppna samma tid i ett annat privat fönster:
      tiden ska vara dold/upptagen under holden.
- [ ] Försök skicka om före 30 sekunder: det ska nekas utan ny PIN.
- [ ] Skicka om efter 30 sekunder: endast den nya PIN-koden ska godtas.
- [ ] Vänta mer än fem minuter: PIN får inte skapa bokning och tiden ska åter bli
      bokbar efter att holden löpt ut.
- [ ] Gör fem felaktiga försök: challenge ska låsas utan bokning.

## C. SMS-canary — kör bara efter Zivars uttryckliga ja

- [ ] Anslut modemet till Giada och verifiera lokalt modem online.
- [ ] Kontrollera att kabel-LAN fortfarande äger default route och DNS.
- [ ] Kontrollera att `/health` är färsk och rapporterar `modem_online=true`.
- [ ] Öppna bokningssidan på nytt: kontaktsteget ska nu visa **mobilnummer**.
- [ ] Använd endast det godkända canary-numret och boka en verklig demotid.
- [ ] PIN-SMS kommer direkt och innehåller rätt tenantnamn och fem minuters giltighet.
- [ ] Rätt PIN skapar exakt en bokning; bekräftelse-SMS kommer direkt.
- [ ] Giada visar stabila nycklar `outbox:<outbox-id>` för både PIN och
      bekräftelse utan dubbla modemjobb.
- [ ] Kontrollera sann status i bokning, `notifications_outbox` och Giadas journal.
- [ ] Bekräfta uttryckligen att SIM-SMS visar nummerbaserad avsändare; namn väntar
      på framtida A2P-avtal.

## D. Automatisk fallback vid driftfel

- [ ] Gör modemet offline men låt tunneln/API:t vara uppe. Ny sida ska välja e-post.
- [ ] Gör `/health` stale eller otillgänglig. Ny sida ska välja e-post inom cirka
      1,5 sekunder, inte hänga eller lova SMS.
- [ ] Låt modemet dö efter att telefonsteget visats men före PIN-send. Ingen
      bokning ska skapas, holden ska släppas och UI ska erbjuda e-postvägen.
- [ ] Återställ Giada och ladda om sidan. SMS-vägen ska återkomma utan kodändring.

## E. Samtidiga överlappande holds i staging

- [ ] Applicera PIN-migrationen i staging och exportera
      `NEXT_PUBLIC_SUPABASE_URL` samt `SUPABASE_SERVICE_ROLE_KEY` lokalt.
- [ ] Kör från `5-Kod/`:
      `node supabase/tests/concurrent_overlapping_holds.mjs`.
- [ ] Kontrollera `PASS`: två separata klienter begär starter 15 minuter isär
      för samma 30-minuterstjänst; exakt en hold lyckas och den andra får `23P01`.
- [ ] Kontrollera att testets `finally` har släppt den vinnande holden.

PIN-outboxraden innehåller bara challenge-ID, mall och kanal — aldrig klar PIN
eller full kontakt. Den exakta raden claimas med CAS i samma webbrequest och har
max ett transportförsök. En övergiven rad blir synlig för ordinarie städning först
när PIN-koden redan har gått ut och kan då inte skickas.

## Godkännandebevis

Fyll i först när varje separat canary faktiskt har körts:

```text
Staging-revision:
Migration applicerad/verifierad:
E-postfallback godkänd av Zivar (datum):
SMS-canary godkänd av Zivar (datum):
Boknings-id:
Outbox-id:
Giada-jobb-id:
Resultat/anmärkning:
```
